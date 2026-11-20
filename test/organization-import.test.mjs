import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHQServer } from '../server.mjs';
import { createOrganizationLayout } from '../lib/organization-layout.mjs';
import { parseImportRequest, planImport, importPositions } from '../lib/organization-import.mjs';

const template = JSON.parse(await readFile(new URL('../docs/examples/quant-firm-org.json', import.meta.url), 'utf8'));
const copy = value => structuredClone(value);
const byName = (departments, name) => departments.find(item => item.name === name);

async function setup(t, extra = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'imperium-org-import-')), dataDir = path.join(root, 'data'), workspace = path.join(root, 'workspace'), other = path.join(root, 'other');
  await mkdir(workspace); await mkdir(other);
  const options = { dataDir, workspace, port: 0, quotaReaders: {}, providers: { detectProviders: async () => [], startProvider: async () => { throw Error('No model calls'); } }, ...extra.options?.({ dataDir }) };
  const app = createHQServer(options), { url } = await app.start();
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  const request = async (route, method = 'GET', body, { token = app.store.state.server.csrfToken, raw } = {}) => {
    const response = await fetch(url + route, { method, headers: { 'content-type': 'application/json', ...(token === null ? {} : { 'x-hq-token': token }) }, ...(raw !== undefined ? { body: raw } : body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, value: await response.json() };
  };
  const importTemplate = (body, settings) => request('/api/departments/import', 'POST', { workspace, template: copy(template), ...body }, settings);
  const saves = { count: 0 };
  const save = app.store.save;
  app.store.save = (...args) => { saves.count++; return save(...args); };
  return { app, state: app.store.state, request, importTemplate, workspace, other, dataDir, saves };
}

test('importing the example template creates every agent, handoff and card position in one save', async t => {
  const { state, request, importTemplate, workspace, saves, dataDir } = await setup(t);
  const before = state.departments.map(item => ({ ...item }));
  const result = await importTemplate({ includeHandoffs: true });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  assert.equal(result.value.ok, true);
  assert.equal(result.value.created.length, 17);
  assert.equal(result.value.skipped.length, 0);
  assert.deepEqual(result.value.errors, []);
  assert.equal(result.value.handoffs.created.length, 10);
  assert.equal(result.value.layout.saved, true);
  assert.equal(saves.count, 1, 'state.json is written exactly once');
  assert.equal(state.departments.length, 21);
  assert.deepEqual(state.departments.slice(0, 4), before, 'existing agents are not changed');
  const board = byName(state.departments, '투자위원회'), research = byName(state.departments, '퀀트 리서치');
  assert.deepEqual({ provider: board.provider, connectionId: board.connectionId, title: board.title, code: board.code, parentId: board.parentId }, { provider: 'claude', connectionId: 'default-claude', title: 'CEO 직속 · 전략 승인·자본 배분', code: 'AI', parentId: null });
  assert.equal(research.connectionId, 'default-codex');
  assert.match(state.events.at(-1).text, /^조직도 템플릿 가져오기: 17개 생성, 0개 건너뜀$/);

  const graph = (await request('/api/graph')).value.graph;
  const id = name => `department:${byName(state.departments, name).id}`;
  const handoffs = graph.edges.filter(edge => edge.type === 'handoff').map(edge => [edge.source, edge.target]);
  assert.equal(handoffs.length, 10);
  for (const [from, to] of template.handoffs) assert.ok(handoffs.some(([source, target]) => source === id(from) && target === id(to)), `${from} → ${to}`);
  assert.equal(graph.nodes.filter(node => node.type === 'department').length, 11, 'only agents used by handoffs get workflow nodes');

  const layout = (await request(`/api/organization-layout?workspace=${encodeURIComponent(workspace)}`)).value;
  assert.equal(layout.revision, 1);
  const at = name => layout.positions[`agent:${byName(state.departments, name).id}`];
  const leads = ['CIO 투자부문 총괄', 'CTO 기술부문 총괄', 'CRO 리스크 총괄', 'COO 운영부문 총괄', '법무·컴플라이언스'].map(at);
  assert.ok(layout.positions.owner.y < at('투자위원회').y, 'owner is on top');
  assert.ok(at('투자위원회').y < leads[0].y, 'the board is on the next row');
  assert.equal(new Set(leads.map(point => point.y)).size, 1, 'leads share one row');
  assert.deepEqual(leads.map(point => point.x), [...leads.map(point => point.x)].sort((a, b) => a - b), 'leads are left to right in template order');
  const center = (leads[0].x + leads.at(-1).x + 320) / 2;
  assert.equal(at('투자위원회').x + 160, center, 'the board is centred above the leads');
  assert.equal(layout.positions.owner.x + 120, center, 'the owner is centred');
  const team = ['CTO 기술부문 총괄', '퀀트 개발', '데이터 엔지니어링', '인프라·HPC', '보안·SRE'].map(at);
  assert.equal(new Set(team.map(point => point.x)).size, 1, 'a team shares its lead column');
  assert.deepEqual(team.map(point => point.y), [...team.map(point => point.y)].sort((a, b) => a - b));
  for (const name of ['전략기획실', '개발본부', '리서치센터', '품질관리실']) assert.ok(at(name).y > team.at(-1).y, `${name} is placed below the imported block`);

  const project = state.projects.find(item => item.workspace === workspace);
  assert.equal(project.departments.length, 21, 'the per-project copy is updated');
  const persisted = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(persisted.departments.length, 21);
  assert.equal(persisted.projects.find(item => item.workspace === workspace).departments.length, 21);
});

test('a dry run reports created, skipped and error rows and saves nothing', async t => {
  const { state, request, importTemplate, workspace, saves } = await setup(t);
  const departments = JSON.stringify(state.departments), events = state.events.length;
  const result = await importTemplate({ dryRun: true, includeHandoffs: true });
  assert.equal(result.status, 200);
  assert.equal(result.value.dryRun, true);
  assert.equal(result.value.ok, true);
  assert.equal(result.value.created.length, 17);
  assert.equal(result.value.created.every(item => item.departmentId === undefined), true);
  assert.equal(result.value.handoffs.created.length, 10);
  assert.equal(saves.count, 0);
  assert.equal(JSON.stringify(state.departments), departments);
  assert.equal(state.events.length, events);
  assert.deepEqual((await request('/api/graph')).value.graph, { nodes: [], edges: [] });
  assert.equal((await request(`/api/organization-layout?workspace=${encodeURIComponent(workspace)}`)).value.revision, 0);
});

test('more than 64 agents in total cancels the whole import', async t => {
  const { state, importTemplate } = await setup(t);
  const agents = Array.from({ length: 61 }, (_, index) => ({ name: `Agent ${index + 1}`, title: '', role: 'Review the result.', provider: 'codex' }));
  const preview = await importTemplate({ dryRun: true, template: { template: 'large', agents, handoffs: [] } });
  assert.equal(preview.status, 200);
  assert.equal(preview.value.ok, false);
  assert.equal(preview.value.errors[0].code, 'limit');
  const result = await importTemplate({ template: { template: 'large', agents, handoffs: [] } });
  assert.equal(result.status, 409);
  assert.equal(result.value.details.errors[0].code, 'limit');
  assert.equal(state.departments.length, 4);
  const fits = await importTemplate({ template: { template: 'fits', agents: agents.slice(0, 60), handoffs: [] } });
  assert.equal(fits.status, 201);
  assert.equal(state.departments.length, 64);
});

test('one invalid agent cancels every agent, handoff and position', async t => {
  const { state, request, importTemplate, workspace, saves } = await setup(t);
  const broken = copy(template);
  broken.agents[5].role = 'x'.repeat(1501);
  broken.agents[7].modelId = 'bad model';
  const preview = await importTemplate({ dryRun: true, includeHandoffs: true, template: broken });
  assert.equal(preview.value.ok, false);
  assert.deepEqual(preview.value.errors.map(error => [error.index, error.field]), [[5, 'role'], [7, 'modelId']]);
  const result = await importTemplate({ includeHandoffs: true, template: broken });
  assert.equal(result.status, 400);
  assert.match(result.value.error, /아무것도 저장하지 않았습니다/);
  assert.equal(result.value.details.errors.length, 2);
  assert.equal(state.departments.length, 4);
  assert.equal(saves.count, 0);
  assert.deepEqual((await request('/api/graph')).value.graph, { nodes: [], edges: [] });
  assert.equal((await request(`/api/organization-layout?workspace=${encodeURIComponent(workspace)}`)).value.revision, 0);
  const unknownConnection = copy(template);
  unknownConnection.agents[0].connectionId = 'missing-connection';
  assert.equal((await importTemplate({ template: unknownConnection })).value.details.errors[0].field, 'connectionId');
  const invalidProvider = copy(template);
  invalidProvider.agents[0].provider = 'gpt';
  assert.equal((await importTemplate({ template: invalidProvider })).value.details.errors[0].field, 'provider');
  assert.equal(state.departments.length, 4);
});

test('existing names are skipped without overwriting, and importing twice adds nothing', async t => {
  const { state, request, importTemplate } = await setup(t);
  const strategy = { ...byName(state.departments, '전략기획실') };
  const withExisting = copy(template);
  withExisting.agents.push({ name: '  전략기획실 ', title: 'Changed', role: 'Overwrite attempt', provider: 'claude' });
  const first = await importTemplate({ includeHandoffs: true, template: withExisting });
  assert.equal(first.status, 201);
  assert.deepEqual(first.value.skipped, [{ index: 17, name: '전략기획실', departmentId: 'strategy', reason: 'exists' }]);
  assert.deepEqual(byName(state.departments, '전략기획실'), strategy, 'the existing agent is unchanged');
  const edges = JSON.stringify((await request('/api/graph')).value.graph.edges);
  const second = await importTemplate({ includeHandoffs: true, template: withExisting });
  assert.equal(second.status, 200);
  assert.equal(second.value.created.length, 0);
  assert.equal(second.value.skipped.length, 18);
  assert.equal(second.value.handoffs.created.length, 0);
  assert.equal(second.value.handoffs.skipped.length, 10);
  assert.equal(second.value.handoffs.skipped.every(item => item.reason === 'exists'), true);
  assert.equal(second.value.layout.required, false);
  assert.equal(state.departments.length, 21);
  assert.equal(new Set(state.departments.map(item => item.name)).size, 21);
  assert.equal(JSON.stringify((await request('/api/graph')).value.graph.edges), edges);
  assert.match(state.events.at(-1).text, /^조직도 템플릿 가져오기: 0개 생성, 18개 건너뜀$/);
  const repeated = copy(template);
  repeated.agents.push({ ...repeated.agents[0] });
  const duplicate = await importTemplate({ dryRun: true, template: repeated });
  assert.equal(duplicate.value.errors[0].code, 'duplicate');
});

test('a handoff cycle cancels the import including agent creation', async t => {
  const { state, request, importTemplate, saves } = await setup(t);
  const cyclic = copy(template);
  cyclic.handoffs.push(['재무·펀드회계', '데이터 엔지니어링'], ['퀀트 리서치', '데이터 엔지니어링']);
  const preview = await importTemplate({ dryRun: true, includeHandoffs: true, template: cyclic });
  assert.equal(preview.value.errors.some(error => error.code === 'cycle'), true);
  const result = await importTemplate({ includeHandoffs: true, template: cyclic });
  assert.equal(result.status, 400);
  assert.equal(state.departments.length, 4);
  assert.equal(saves.count, 0);
  assert.deepEqual((await request('/api/graph')).value.graph, { nodes: [], edges: [] });
  const withoutHandoffs = await importTemplate({ template: cyclic });
  assert.equal(withoutHandoffs.status, 201, 'handoffs are ignored unless includeHandoffs is set');
  assert.deepEqual((await request('/api/graph')).value.graph, { nodes: [], edges: [] });
});

test('a cycle through an existing workflow edge is rejected and the existing graph is untouched', async t => {
  const { state, request, importTemplate, workspace } = await setup(t);
  const graph = { workspace, nodes: [{ id: 'department:strategy', type: 'department', referenceId: 'strategy', x: 10, y: 20 }, { id: 'department:research', type: 'department', referenceId: 'research', x: 300, y: 20 }], edges: [{ id: 'existing-handoff', source: 'department:strategy', target: 'department:research', type: 'handoff' }] };
  assert.equal((await request('/api/graph', 'PUT', graph)).status, 200);
  const result = await importTemplate({ includeHandoffs: true, template: { template: 'loop', agents: [{ name: 'Bridge', role: 'Connects work.', provider: 'claude' }], handoffs: [['리서치센터', 'Bridge'], ['Bridge', '전략기획실']] } });
  assert.equal(result.status, 400);
  assert.equal(result.value.details.errors[0].code, 'cycle');
  assert.equal(state.departments.length, 4);
  assert.deepEqual((await request('/api/graph')).value.graph.edges, graph.edges);
});

test('handoff merge keeps existing workflow nodes and memory links', async t => {
  const { request, importTemplate, workspace, state } = await setup(t);
  const note = (await request('/api/memory', 'POST', { workspace, title: 'Risk limits', content: 'Daily loss limit is 2%.' })).value.node;
  const graph = { workspace, nodes: [{ id: 'commander', type: 'commander', referenceId: 'commander', x: 0, y: 0 }, { id: `memory:${note.id}`, type: 'memory', referenceId: note.id, x: 40, y: 400 }, { id: 'department:quality', type: 'department', referenceId: 'quality', x: 400, y: 400 }, { id: 'department:engineering', type: 'department', referenceId: 'engineering', x: 700, y: 400 }], edges: [{ id: 'memory-edge', source: `memory:${note.id}`, target: 'department:quality', type: 'memory_context' }, { id: 'old-handoff', source: 'department:engineering', target: 'department:quality', type: 'handoff' }] };
  const saved = (await request('/api/graph', 'PUT', graph)).value.graph;
  const withExisting = copy(template);
  withExisting.handoffs.push(['품질관리실', '투자위원회']);
  const result = await importTemplate({ includeHandoffs: true, template: withExisting });
  assert.equal(result.status, 201, JSON.stringify(result.value.errors));
  const merged = (await request('/api/graph')).value.graph;
  assert.deepEqual(merged.nodes.slice(0, saved.nodes.length), saved.nodes);
  assert.deepEqual(merged.edges.slice(0, saved.edges.length), saved.edges);
  assert.equal(merged.edges.length, saved.edges.length + 11);
  assert.equal(merged.nodes.filter(node => node.id === 'department:quality').length, 1, 'existing nodes are reused, not duplicated');
  const board = `department:${byName(state.departments, '투자위원회').id}`;
  assert.ok(merged.edges.some(edge => edge.source === 'department:quality' && edge.target === board));
  for (const node of merged.nodes.slice(saved.nodes.length)) assert.ok(node.x > 700, 'new workflow nodes are placed to the right of existing ones');
});

test('an existing graph that no longer validates blocks only handoff imports with a clear message', async t => {
  const { request, importTemplate, workspace, state } = await setup(t);
  const note = (await request('/api/memory', 'POST', { workspace, title: 'Old note', content: 'Archived later.' })).value.node;
  assert.equal((await request('/api/graph', 'PUT', { workspace, nodes: [{ id: `memory:${note.id}`, type: 'memory', referenceId: note.id, x: 0, y: 0 }, { id: 'department:quality', type: 'department', referenceId: 'quality', x: 300, y: 0 }], edges: [{ id: 'memory-edge', source: `memory:${note.id}`, target: 'department:quality', type: 'memory_context' }] })).status, 200);
  const scope = Object.keys(state.graphs)[0];
  state.graphs[scope].nodes[0].referenceId = 'missing-note';
  state.graphs[scope].nodes[0].id = 'memory:missing-note';
  state.graphs[scope].edges[0].source = 'memory:missing-note';
  const result = await importTemplate({ dryRun: true, includeHandoffs: true });
  assert.equal(result.value.errors[0].code, 'graph');
  assert.match(result.value.errors[0].message, /그래프를 정리한 뒤/);
  assert.equal((await importTemplate({ dryRun: true })).value.ok, true);
});

test('a different workspace is 409 and a missing CSRF token is 403', async t => {
  const { state, importTemplate, request, other } = await setup(t);
  assert.equal((await importTemplate({ workspace: other })).status, 409);
  assert.equal((await importTemplate({ workspace: other, dryRun: true })).status, 409);
  assert.equal((await importTemplate({}, { token: null })).status, 403);
  assert.equal((await importTemplate({}, { token: 'x'.repeat(64) })).status, 403);
  assert.equal((await request('/api/departments/import', 'POST', null, { raw: JSON.stringify({ workspace: 'relative/path', template }) })).status, 400);
  assert.equal(state.departments.length, 4);
});

test('unknown keys and malformed fields are rejected with 400, even for a dry run', async t => {
  const { state, importTemplate, request, workspace } = await setup(t);
  const cases = [
    { extra: true },
    { template: { ...copy(template), version: 2 } },
    { template: { ...copy(template), agents: [{ ...template.agents[0], color: 'red' }] } },
    { template: { ...copy(template), agents: [{ ...template.agents[0], group: 'Board' }] } },
    { template: { ...copy(template), agents: [{ ...template.agents[0], group: 'x'.repeat(33) }] } },
    { template: { ...copy(template), agents: [{ ...template.agents[0], lead: 'yes' }] } },
    { template: { ...copy(template), handoffs: [['퀀트 리서치']] } },
    { template: { ...copy(template), agents: [] } },
    { template: { template: '', agents: template.agents } },
    { dryRun: 'true' },
  ];
  for (const body of cases) {
    const result = await importTemplate({ dryRun: true, ...body });
    assert.equal(result.status, 400, JSON.stringify(body).slice(0, 120));
  }
  const large = await request('/api/departments/import', 'POST', null, { raw: JSON.stringify({ workspace, dryRun: true, template: { template: 'large', agents: [{ name: 'A', role: 'x'.repeat(140 * 1024), provider: 'codex' }] } }) });
  assert.equal(large.status, 413);
  assert.equal(state.departments.length, 4);
});

test('lead rules and handoff names are reported as preview errors', async t => {
  const { importTemplate } = await setup(t);
  const leads = copy(template);
  leads.agents[2].lead = true;
  delete leads.agents[0].group;
  leads.handoffs.push(['퀀트 리서치', '없는 에이전트'], ['퀀트 리서치', '퀀트 리서치']);
  const result = await importTemplate({ dryRun: true, includeHandoffs: true, template: leads });
  assert.deepEqual(result.value.errors.map(error => error.field).sort(), ['handoffs', 'handoffs', 'lead', 'lead']);
});

test('a missing connectionId uses the only connection for that provider, otherwise only the provider', async t => {
  const { state, request, importTemplate } = await setup(t);
  assert.equal((await request('/api/providers/register', 'POST', { providerId: 'codex', label: 'Second Codex', modelId: 'gpt-x' })).status, 201);
  const ollama = (await request('/api/providers/register', 'POST', { providerId: 'ollama', label: 'Local', modelId: 'llama3' })).value;
  const agents = [
    { name: 'Codex agent', role: 'Two codex connections exist.', provider: 'codex' },
    { name: 'Claude agent', role: 'One claude connection exists.', provider: 'claude' },
    { name: 'Gemini agent', role: 'No gemini connection exists.', provider: 'gemini' },
    { name: 'Ollama agent', role: 'One ollama connection exists.', provider: 'ollama' },
    { name: 'Explicit model', role: 'Explicit model wins.', provider: 'claude', modelId: 'claude-explicit' },
  ];
  const result = await importTemplate({ template: { template: 'connections', agents } });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  const pick = name => { const item = byName(state.departments, name); return [item.provider, item.connectionId, item.modelId]; };
  assert.deepEqual(pick('Codex agent'), ['codex', null, '']);
  assert.deepEqual(pick('Claude agent'), ['claude', 'default-claude', '']);
  assert.deepEqual(pick('Gemini agent'), ['gemini', null, '']);
  const local = state.connections.find(item => item.providerId === 'ollama');
  assert.ok(ollama);
  assert.deepEqual(pick('Ollama agent'), ['ollama', local.id, 'llama3']);
  assert.deepEqual(pick('Explicit model'), ['claude', 'default-claude', 'claude-explicit']);
});


test('a layout revision conflict keeps the created agents and asks for manual arrangement', async t => {
  let appState;
  const { state, importTemplate, saves } = await setup(t, { options: ({ dataDir }) => {
    const real = createOrganizationLayout({ dataDir, getWorkspace: () => appState.settings.workspace, getDepartments: () => appState.departments });
    // Another window saves between the import's read and write, so the import loses the revision check.
    return { organizationLayoutManager: { put: input => real.put(input), get: async input => { const current = await real.get(input); await real.put({ workspace: input.workspace, revision: current.revision, positions: current.positions, viewport: current.viewport }); return current; } } };
  } });
  appState = state;
  const result = await importTemplate({ includeHandoffs: true });
  assert.equal(result.status, 201);
  assert.deepEqual({ saved: result.value.layout.saved, message: result.value.layout.message }, { saved: false, message: '배치는 수동 조정 필요' });
  assert.match(result.value.layout.reason, /revision|갱신/);
  assert.equal(state.departments.length, 21);
  assert.equal(saves.count, 1);
});

test('agents with saved positions are never moved by an import', async t => {
  const { state, request, importTemplate, workspace } = await setup(t);
  const positions = { owner: { x: 500, y: -40 }, 'agent:strategy': { x: 900, y: 600 }, 'agent:quality': { x: -300, y: 80 } };
  assert.equal((await request('/api/organization-layout', 'PUT', { workspace, revision: 0, positions, viewport: { pan: { x: 12, y: 34 }, zoom: 0.8 } })).status, 200);
  const result = await importTemplate({});
  assert.equal(result.value.layout.saved, true);
  const layout = (await request(`/api/organization-layout?workspace=${encodeURIComponent(workspace)}`)).value;
  for (const [key, point] of Object.entries(positions)) assert.deepEqual(layout.positions[key], point, key);
  assert.deepEqual(layout.viewport, { pan: { x: 12, y: 34 }, zoom: 0.8 });
  const added = state.departments.filter(item => !['strategy', 'quality'].includes(item.id)).map(item => layout.positions[`agent:${item.id}`]);
  assert.equal(added.length, 19);
  assert.ok(added.every(point => point && point.y >= 600 + 92 + 80), 'new and previously unplaced cards go below every saved card');
});

test('the planner and layout helpers are pure and deterministic about placement', () => {
  const request = parseImportRequest({ workspace: 'C:\project', dryRun: true, template: copy(template) });
  const before = JSON.stringify(template);
  const plan = planImport(request, { departments: [], connections: [] });
  assert.equal(JSON.stringify(template), before);
  assert.equal(plan.result.created.length, 17);
  const departments = plan.departments;
  const positions = importPositions({ departments, created: plan.layout });
  assert.deepEqual(positions.owner, { x: 784, y: 32 });
  assert.deepEqual(positions[`agent:${departments[0].id}`], { x: 744, y: 160 });
  assert.deepEqual(positions[`agent:${departments[1].id}`], { x: 40, y: 296 });
  assert.deepEqual(positions[`agent:${departments[2].id}`], { x: 40, y: 396 });
  assert.deepEqual(positions[`agent:${departments[16].id}`], { x: 1448, y: 296 });
});

test('group/lead layout survives "parent" links and existing reporting lines', () => {
  const request = parseImportRequest({ workspace: 'C:\\project', template: copy(template) });
  const leads = new Map(template.agents.filter(agent => agent.lead).map(agent => [agent.group, agent.name]));
  const withParents = copy(template);
  for (const agent of withParents.agents) if (!agent.lead && agent.group !== 'board') agent.parent = leads.get(agent.group);
  const existing = [{ id: 'strategy', name: '전략기획실', role: 'r', provider: 'codex' }, { id: 'engineering', name: '개발본부', role: 'r', provider: 'claude', parentId: 'strategy' }];
  for (const [label, body, departments] of [['plain fixture with existing reporting lines', request, existing], ['members report to their lead', parseImportRequest({ workspace: 'C:\\project', template: withParents }), []]]) {
    const plan = planImport(body, { departments, connections: [] });
    assert.deepEqual(plan.result.errors, [], label);
    const all = [...departments, ...plan.departments];
    const positions = importPositions({ departments: all, created: plan.layout });
    const at = name => positions[`agent:${all.find(item => item.name === name).id}`];
    const leadPoints = [...leads.values()].filter(name => name !== '투자위원회').map(at);
    assert.equal(new Set(leadPoints.map(point => point.y)).size, 1, `${label}: leads share one row`);
    assert.ok(at('투자위원회').y < leadPoints[0].y, `${label}: the board has its own row`);
    const center = (leadPoints[0].x + leadPoints.at(-1).x + 320) / 2;
    assert.equal(at('투자위원회').x + 160, center, `${label}: the board is centred`);
    for (const [group, lead] of leads) {
      if (group === 'board') continue;
      const team = template.agents.filter(agent => agent.group === group).map(agent => at(agent.name));
      assert.ok(team.slice(1).every(point => point.y > at(lead).y && point.x >= at(lead).x && point.x <= at(lead).x + 40), `${label}: ${group} is stacked under its lead`);
    }
    if (departments.length) for (const name of ['전략기획실', '개발본부']) assert.ok(at(name).y > Math.max(...Object.values(positions).map(point => point.y)) - 300, `${label}: unplaced existing agents go below the block`);
  }
});

test('imported workflow nodes never share a position, even near the canvas edge', () => {
  const graph = { nodes: [{ id: 'department:strategy', type: 'department', referenceId: 'strategy', x: 5800, y: 120 }], edges: [] };
  const request = parseImportRequest({ workspace: 'C:\\project', includeHandoffs: true, template: copy(template) });
  const plan = planImport(request, { departments: [{ id: 'strategy', name: '전략기획실', role: 'r', provider: 'codex' }], connections: [], graph });
  assert.equal(plan.result.ok, true);
  const added = plan.graph.nodes.slice(1);
  assert.equal(added.length, 11);
  for (const node of plan.graph.nodes) assert.ok(node.x >= -2000 && node.x <= 6000 && node.y >= -2000 && node.y <= 6000);
  for (const [index, node] of plan.graph.nodes.entries()) for (const other of plan.graph.nodes.slice(index + 1)) assert.ok(Math.abs(node.x - other.x) >= 240 || Math.abs(node.y - other.y) >= 172, `${node.id} overlaps ${other.id}`);
});
