import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHQServer } from '../server.mjs';
import { MAX_HIERARCHY_DEPTH, depthOf, effectiveParents, reparentChildren, validateParentId } from '../lib/department-hierarchy.mjs';

const role = (id, parentId, extra = {}) => ({ id, code: 'AI', name: `Agent ${id}`, title: '', role: 'Do the work.', provider: 'claude', modelId: '', ...(parentId === undefined ? {} : { parentId }), ...extra });
const chain = length => Array.from({ length }, (_, index) => role(`d${index + 1}`, index ? `d${index}` : null));

test('parent validation rejects unknown ids, self, cycles and more than six levels', () => {
  const departments = [...chain(5), role('free')];
  assert.equal(validateParentId(departments, null, undefined), null);
  assert.equal(validateParentId(departments, null, null), null);
  assert.equal(validateParentId(departments, null, ''), null);
  assert.equal(validateParentId(departments, null, 'd5'), 'd5', 'a new agent may be the sixth level');
  assert.throws(() => validateParentId(departments, null, 'missing'), { status: 400, message: /찾을 수 없습니다/ });
  assert.throws(() => validateParentId(departments, null, 42), { status: 400 });
  assert.throws(() => validateParentId(departments, 'd2', 'd2'), { status: 400, message: /자기 자신/ });
  assert.throws(() => validateParentId(departments, 'd2', 'd4'), { status: 400, message: /순환/ });
  assert.throws(() => validateParentId(departments, 'd1', 'd5'), { status: 400, message: /순환/ });
  const six = [...chain(6), role('free')];
  assert.throws(() => validateParentId(six, null, 'd6'), { status: 400, message: /최대 6단계/ });
  assert.equal(validateParentId(six, 'free', 'd5'), 'd5');
  assert.throws(() => validateParentId(six, 'free', 'd6'), { status: 400, message: /최대 6단계/ });
  // Moving a subtree counts its whole height: d4..d6 is three levels, so its new parent may be at most level 3.
  const forest = [...chain(6), role('a', null), role('b', 'a'), role('c', 'b')];
  assert.equal(validateParentId(forest, 'd4', 'c'), 'c');
  assert.throws(() => validateParentId([...forest, role('e', 'c')], 'd4', 'e'), { status: 400, message: /최대 6단계/ });
  assert.equal(MAX_HIERARCHY_DEPTH, 6);
});

test('stored values are read as-is; dangling, self and cyclic parents only display as owner-direct', () => {
  const departments = [role('a'), role('b', 'a'), role('c', 'missing'), role('d', 'd'), role('e', 'f'), role('f', 'e'), role('g', 'e')];
  const before = structuredClone(departments);
  const parents = effectiveParents(departments);
  assert.deepEqual(Object.fromEntries(parents), { a: null, b: 'a', c: null, d: null, e: null, f: null, g: 'e' });
  assert.equal(depthOf(parents, 'b'), 2);
  assert.deepEqual(departments, before, 'nothing is migrated or rewritten');
});

test('removing a parent moves only its direct reports up to its own parent', () => {
  const departments = [role('root'), role('mid', 'root'), role('leaf1', 'mid'), role('leaf2', 'mid'), role('deep', 'leaf1'), role('other')];
  assert.deepEqual(reparentChildren(departments, 'mid'), ['leaf1', 'leaf2']);
  assert.deepEqual(departments.map(item => [item.id, item.parentId]), [['root', undefined], ['mid', 'root'], ['leaf1', 'root'], ['leaf2', 'root'], ['deep', 'leaf1'], ['other', undefined]]);
  assert.deepEqual(reparentChildren(departments, 'root'), ['mid', 'leaf1', 'leaf2']);
  assert.deepEqual(departments.filter(item => item.id !== 'root').map(item => Object.hasOwn(item, 'parentId') ? item.parentId : 'none'), [null, null, null, 'leaf1', 'none']);
});

async function setup(t, { seed } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'imperium-hierarchy-')), dataDir = path.join(root, 'data'), workspace = path.join(root, 'workspace');
  await mkdir(workspace); await mkdir(dataDir);
  if (seed) await writeFile(path.join(dataDir, 'state.json'), JSON.stringify(seed(workspace)));
  const providers = { detectProviders: async () => ['codex', 'claude'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true })), startProvider: async () => ({ cancel() {} }) };
  const options = { dataDir, workspace, port: 0, quotaReaders: {}, providers };
  let app = createHQServer(options), url = (await app.start()).url;
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  const request = async (route, method = 'GET', body) => {
    const response = await fetch(url + route, { method, headers: { 'content-type': 'application/json', 'x-hq-token': app.store.state.server.csrfToken }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, value: await response.json() };
  };
  const restart = async () => { await app.close(); app = createHQServer(options); url = (await app.start()).url; return app.store.state; };
  return { get state() { return app.store.state; }, request, restart, workspace, dataDir };
}

test('POST and PATCH accept parentId and reject unknown, self, cyclic and too-deep parents', async t => {
  const { state, request, workspace } = await setup(t);
  const create = (name, parentId) => request('/api/departments', 'POST', { workspace, name, role: 'Lead the team.', provider: 'claude', ...(parentId === undefined ? {} : { parentId }) });
  const lead = (await create('Lead')).value.department;
  assert.equal(lead.parentId, null);
  const member = await create('Member', lead.id);
  assert.equal(member.status, 201);
  assert.equal(member.value.department.parentId, lead.id);
  assert.equal((await create('Lost', 'missing-agent')).status, 400);
  assert.equal((await create('Typed', 7)).status, 400);
  const id = member.value.department.id;
  assert.equal((await request(`/api/departments/${lead.id}`, 'PATCH', { workspace, parentId: lead.id })).status, 400, 'self');
  assert.equal((await request(`/api/departments/${lead.id}`, 'PATCH', { workspace, parentId: id })).status, 400, 'cycle');
  let parent = id;
  for (let level = 3; level <= 6; level++) parent = (await create(`Level ${level}`, parent)).value.department.id;
  const tooDeep = await create('Level 7', parent);
  assert.equal(tooDeep.status, 400);
  assert.match(tooDeep.value.error, /최대 6단계/);
  assert.equal((await request('/api/departments/strategy', 'PATCH', { workspace, parentId: parent })).status, 400, 'depth via PATCH');
  const moved = await request('/api/departments/strategy', 'PATCH', { workspace, parentId: lead.id });
  assert.equal(moved.status, 200);
  assert.equal(moved.value.department.parentId, lead.id);
  const unchanged = await request('/api/departments/strategy', 'PATCH', { workspace, name: '전략실' });
  assert.equal(unchanged.value.department.parentId, lead.id, 'PATCH without parentId keeps the parent');
  const cleared = await request('/api/departments/strategy', 'PATCH', { workspace, parentId: null });
  assert.equal(cleared.value.department.parentId, null);
  const rejected = state.departments.find(item => item.id === lead.id);
  assert.equal(rejected.parentId, null, 'failed PATCH requests change nothing');
});

test('deleting an agent moves its reports to its parent and updates project copies and export', async t => {
  const { state, request, workspace, dataDir } = await setup(t);
  const create = async (name, parentId) => (await request('/api/departments', 'POST', { workspace, name, role: 'Work.', provider: 'claude', parentId })).value.department;
  const top = await create('Top', null), mid = await create('Mid', top.id), low = await create('Low', mid.id), sibling = await create('Sibling', mid.id), leaf = await create('Leaf', low.id);
  assert.equal((await request(`/api/departments/${mid.id}`, 'DELETE', { workspace })).status, 200);
  const parentOf = id => state.departments.find(item => item.id === id).parentId;
  assert.equal(parentOf(low.id), top.id);
  assert.equal(parentOf(sibling.id), top.id);
  assert.equal(parentOf(leaf.id), low.id, 'grandchildren keep their own parent');
  assert.equal((await request(`/api/departments/${top.id}`, 'DELETE', { workspace })).status, 200);
  assert.equal(parentOf(low.id), null, 'reports of an owner-direct agent become owner-direct');
  assert.equal(parentOf(leaf.id), low.id);
  const project = state.projects.find(item => item.workspace === workspace);
  assert.equal(project.departments.find(item => item.id === leaf.id).parentId, low.id);
  const persisted = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(persisted.departments.find(item => item.id === low.id).parentId, null);
  assert.equal(persisted.projects.find(item => item.workspace === workspace).departments.find(item => item.id === leaf.id).parentId, low.id);
  const exported = (await request('/api/export')).value;
  assert.equal(exported.departments.find(item => item.id === leaf.id).parentId, low.id);
  const snapshot = (await request('/api/state')).value;
  assert.equal(snapshot.departments.find(item => item.id === leaf.id).parentId, low.id);
});

test('an existing state.json without parentId loads unchanged and is not migrated', async t => {
  const seed = workspace => ({
    departments: [
      { id: 'legacy-a', code: 'AI', name: 'Legacy A', title: '', role: 'Old role.', provider: 'codex', modelId: '' },
      { id: 'legacy-b', code: 'AI', name: 'Legacy B', title: '', role: 'Old role.', provider: 'claude', modelId: '', parentId: 'gone' },
    ],
    projects: [{ id: '0c4f6c8e-6c2c-4c55-9a39-5f1b7a1f6c11', name: 'Legacy', color: '#ffad32', workspace, createdAt: '2026-01-01T00:00:00.000Z', departments: [{ id: 'legacy-a', code: 'AI', name: 'Legacy A', title: '', role: 'Old role.', provider: 'codex', modelId: '' }] }],
    settings: { workspace },
  });
  const { request, restart, workspace, dataDir } = await setup(t, { seed });
  const loaded = (await request('/api/state')).value.departments;
  assert.equal(Object.hasOwn(loaded[0], 'parentId'), false);
  assert.equal(loaded[1].parentId, 'gone', 'a dangling value is kept as stored');
  assert.equal((await request('/api/departments/legacy-a', 'PATCH', { workspace, name: 'Renamed' })).status, 200);
  assert.equal((await request('/api/departments', 'POST', { workspace, name: 'New', role: 'Fresh.', provider: 'claude' })).status, 201);
  assert.equal((await request('/api/departments/legacy-a', 'PATCH', { workspace, parentId: 'gone' })).status, 400);
  const state = await restart();
  const legacy = state.departments.find(item => item.id === 'legacy-a');
  assert.equal(legacy.name, 'Renamed');
  assert.equal(Object.hasOwn(legacy, 'parentId'), false, 'unrelated edits do not add the field');
  const persisted = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(Object.hasOwn(persisted.departments[0], 'parentId'), false);
  assert.equal(persisted.departments[1].parentId, 'gone');
  assert.equal(Object.hasOwn(persisted.projects[0].departments[0], 'parentId'), false);
});

test('parentId is display-only: workflow runs still follow handoff edges only', async t => {
  const { request, workspace } = await setup(t);
  const create = async (name, parentId) => (await request('/api/departments', 'POST', { workspace, name, role: 'Work.', provider: 'claude', parentId })).value.department;
  const lead = await create('Lead', null), member = await create('Member', lead.id), reviewer = await create('Reviewer', null);
  const node = item => ({ id: `department:${item.id}`, type: 'department', referenceId: item.id, x: 0, y: 0 });
  assert.equal((await request('/api/graph', 'PUT', { workspace, nodes: [node(lead), node(member), node(reviewer)], edges: [{ id: 'h1', source: `department:${member.id}`, target: `department:${reviewer.id}`, type: 'handoff' }] })).status, 200);
  const fromLead = await request('/api/workflows/run', 'POST', { workspace, departmentId: lead.id, prompt: 'Plan the quarter.' });
  assert.equal(fromLead.status, 201);
  assert.deepEqual(fromLead.value.tasks.map(task => task.departmentId), [lead.id], 'a parent does not run its reports');
  const fromMember = await request('/api/workflows/run', 'POST', { workspace, departmentId: member.id, prompt: 'Draft the report.' });
  assert.deepEqual(fromMember.value.tasks.map(task => task.departmentId), [member.id, reviewer.id], 'the handoff is followed, not the parent');
});

test('template import resolves "parent" names to ids, never re-parents skipped agents and lays out a tree', async t => {
  const { state, request, workspace } = await setup(t);
  const agents = [
    { name: 'Chief', role: 'Leads.', provider: 'claude' },
    { name: 'Team A', role: 'Works.', provider: 'claude', parent: 'Chief' },
    { name: 'Team B', role: 'Works.', provider: 'codex', parent: 'Chief' },
    { name: 'Analyst', role: 'Works.', provider: 'codex', parent: 'Team A' },
    { name: '전략기획실', role: 'Skipped, never re-parented.', provider: 'codex', parent: 'Chief' },
    { name: 'Under strategy', role: 'Reports to an existing agent.', provider: 'codex', parent: '전략기획실' },
  ];
  const result = await request('/api/departments/import', 'POST', { workspace, template: { template: 'tree', agents } });
  assert.equal(result.status, 201, JSON.stringify(result.value.errors));
  const find = name => state.departments.find(item => item.name === name);
  assert.equal(find('Team A').parentId, find('Chief').id);
  assert.equal(find('Analyst').parentId, find('Team A').id);
  assert.equal(find('Under strategy').parentId, 'strategy');
  assert.equal(Object.hasOwn(find('전략기획실'), 'parentId'), false, 'the skipped existing agent is unchanged');
  assert.deepEqual(result.value.created.find(item => item.name === 'Analyst').parent, 'Team A');
  const layout = (await request(`/api/organization-layout?workspace=${encodeURIComponent(workspace)}`)).value.positions;
  const at = name => layout[`agent:${find(name).id}`];
  assert.equal(at('Team A').x, at('Chief').x + 40);
  assert.equal(at('Analyst').x, at('Chief').x + 80);
  assert.ok(at('Chief').y < at('Team A').y && at('Team A').y < at('Analyst').y && at('Analyst').y < at('Team B').y, 'depth-first column under the parent');
  const bad = async parentName => (await request('/api/departments/import', 'POST', { workspace, dryRun: true, template: { template: 'bad', agents: [{ name: 'X', role: 'r', provider: 'codex', parent: parentName }, { name: 'Y', role: 'r', provider: 'codex', parent: 'X' }] } })).value.errors;
  assert.equal((await bad('Nobody'))[0].field, 'parent');
  assert.equal((await bad('X'))[0].field, 'parent', 'self');
  assert.equal((await bad('Y'))[0].message.includes('순환'), true);
  const deep = Array.from({ length: 7 }, (_, index) => ({ name: `Deep ${index}`, role: 'r', provider: 'codex', ...(index ? { parent: `Deep ${index - 1}` } : {}) }));
  const depth = await request('/api/departments/import', 'POST', { workspace, dryRun: true, template: { template: 'deep', agents: deep } });
  assert.deepEqual(depth.value.errors.map(error => error.name), ['Deep 6']);
});

test('a cycle already present in stored data cannot be extended through PATCH validation', () => {
  const departments = [role('a', 'b'), role('b', 'a'), role('c', 'a')];
  assert.throws(() => validateParentId(departments, 'b', 'c'), { status: 400, message: /순환/ });
  assert.equal(validateParentId(departments, 'b', null), null, 'the stored cycle can still be broken by choosing the owner');
  assert.equal(validateParentId([...departments, role('d', null)], 'a', 'd'), 'd');
});
