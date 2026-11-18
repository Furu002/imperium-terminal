import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const [workspaceScript, accountsScript] = await Promise.all([
  readFile(new URL('../public/workspace.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/accounts.js', import.meta.url), 'utf8'),
]);
const copy = value => JSON.parse(JSON.stringify(value));
const settle = async (delay = 0) => { if (delay) await new Promise(resolve => setTimeout(resolve, delay)); for (let turn = 0; turn < 4; turn++) await new Promise(resolve => setImmediate(resolve)); };
function initialState() {
  return {
    settings: { workspace: 'C:\\프로젝트 A', language: 'en', onboarded: true }, server: { csrfToken: 'test-node-csrf' },
    providers: [{ id: 'codex', name: 'ChatGPT / Codex', status: 'ready', authenticated: true }, { id: 'claude', name: 'Claude Code', status: 'missing', authenticated: false }],
    departments: [{ id: 'strategy', code: 'STR', name: 'Strategy', provider: 'codex', role: 'Plan the implementation.' }, { id: 'quality', code: 'QAT', name: 'Quality', provider: 'claude', role: 'Review the implementation.' }], tasks: [],
  };
}
async function setup(t, { graphDelay, startOnboarded = true, initialGraph, initialConnections, deleteResponse, deleteDelay } = {}) {
  const virtualConsole = new VirtualConsole(), errors = [];
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div class="app-shell" data-view="overview"><div id="node-workspace"></div><div id="accounts"></div></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom; const state = initialState(); state.settings.onboarded = startOnboarded;
  if (initialConnections) state.connections = copy(initialConnections);
  const calls = [], graphByProject = new Map(), memories = [{ id: 'memory-1', title: '<img src=x onerror="window.bad=1">', content: '<script>window.bad=2</script>Verified source facts.', kind: 'note', revision: 2, pinned: true }];
  if (initialGraph) graphByProject.set(state.settings.workspace, copy(initialGraph));
  let sequence = 0;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} } });
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, 'http://127.0.0.1:4310'), path = parsed.pathname, method = options.method || 'GET', body = options.body === undefined ? undefined : JSON.parse(options.body);
    calls.push({ url, path, method, body, headers: options.headers, workspace: parsed.searchParams.get('workspace') });
    let value;
    if (method === 'DELETE' && deleteDelay) await deleteDelay(path, body);
    if (method === 'DELETE' && deleteResponse) { const result = await deleteResponse(path, body); if (result) return result; }
    if (path === '/api/graph' && method === 'GET') { if (graphDelay) await graphDelay(parsed.searchParams.get('workspace')); value = { graph: graphByProject.get(parsed.searchParams.get('workspace')) || { nodes: [], edges: [] } }; }
    else if (path === '/api/graph' && method === 'PUT') { graphByProject.set(body.workspace, { nodes: body.nodes, edges: body.edges }); value = { graph: { nodes: body.nodes, edges: body.edges } }; }
    else if (path === '/api/memory' && method === 'GET') value = { nodes: memories, edges: [] };
    else if (path === '/api/memory' && method === 'POST') { const node = { ...body, id: `memory-new-${++sequence}`, revision: 1 }; memories.push(node); value = { node }; }
    else if (path.startsWith('/api/memory/') && method === 'PATCH') { const index = memories.findIndex(memory => memory.id === path.split('/').at(-1)); memories[index] = { ...memories[index], ...body, revision: memories[index].revision + 1 }; value = { node: memories[index] }; }
    else if (path === '/api/workflows/run') value = { workflow: { id: 'workflow-1' } };
    else if (path === '/api/departments' && method === 'POST') value = { department: { ...body, id: `custom-agent-${++sequence}`, code: 'NEW' } };
    else if (path.startsWith('/api/departments/') && method === 'DELETE') { if (state.settings.workspace === body.workspace) state.departments = state.departments.filter(agent => agent.id !== path.split('/').at(-1)); const current = graphByProject.get(body.workspace); if (current) { current.nodes = current.nodes.filter(node => node.referenceId !== path.split('/').at(-1)); const ids = new Set(current.nodes.map(node => node.id)); current.edges = current.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)); } value = { ok: true, departments: state.departments }; }
    else if (path.startsWith('/api/providers/connections/') && method === 'DELETE') { state.connections = (state.connections || []).filter(connection => connection.id !== path.split('/').at(-1)); value = { ok: true }; }
    else if (path === '/api/state') value = state;
    else if (path === '/api/providers/catalog') value = { catalog: [{ id: 'codex', name: 'Codex', requiresNode: true, installCommand: 'npm install -g @openai/codex', loginCommand: 'codex login' }, { id: 'claude', name: 'Claude', installCommand: 'npm install -g @anthropic-ai/claude-code', loginCommand: 'claude auth login' }], connections: state.connections || [] };
    else if (path === '/api/providers/codex/models') value = { models: [{ id: 'actual-account-model', name: 'Account Model', source: 'account' }], detail: 'Reported by the account.' };
    else if (path === '/api/providers/claude/models') value = { models: [], detail: 'No account catalog is available.' };
    else if (path === '/api/providers/register') value = { connection: { id: 'connection-1', ...body } };
    else if (path === '/api/providers/refresh') value = { providers: state.providers };
    else if (path === '/api/settings') { Object.assign(state.settings, body); value = { settings: state.settings }; }
    else if (path === '/api/demo') value = { tasks: [] };
    else throw new Error(`Unexpected request: ${method} ${url}`);
    return { ok: true, status: 200, json: async () => copy(value) };
  };
  window.eval(workspaceScript); window.eval(accountsScript);
  const options = { language: 'en', connected: true, t: key => key, onAssignDepartment: id => { window.assignedDepartment = id; } };
  window.ImperiumWorkspace.render(state, options); await settle();
  t.after(() => window.close());
  return { window, document: window.document, state, options, calls, graphByProject, memories, errors };
}
function connect(document, source, target) { document.querySelector(`[data-node-id="${source}"] .iw-port-out`).click(); document.querySelector(`[data-input-node="${target}"]`).click(); }
function select(window, document, id) { document.querySelector(`[data-node-id="${id}"]`).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
async function addFromLibrary(document, type, referenceId) { document.querySelector('[data-iw-action="add-node"]').click(); await settle(); const item = document.querySelector(`[data-library-type="${type}"][data-library-reference="${referenceId}"]`); assert.ok(item, `library should contain ${type}:${referenceId}`); item.click(); }

test('node workspace starts empty and shows actual status only after the user adds nodes', async t => {
  const { window, document, state, options, calls, errors } = await setup(t);
  assert.equal(document.querySelectorAll('.iw-node').length, 0); assert.equal(document.querySelectorAll('.iw-edge-organization').length, 0);
  assert.equal(document.querySelector('.iw-empty-canvas').hidden, false); assert.match(document.querySelector('.iw-empty-canvas').textContent, /Empty workspace/);
  assert.equal(calls.filter(call => call.method !== 'GET').length, 0, 'loading an empty canvas does not populate or save a template');
  await addFromLibrary(document, 'commander', 'commander'); await addFromLibrary(document, 'provider', 'codex'); await addFromLibrary(document, 'department', 'strategy'); await addFromLibrary(document, 'department', 'quality');
  assert.equal(document.querySelectorAll('.iw-node').length, 4); assert.equal(document.querySelectorAll('.iw-edge-organization').length, 2);
  assert.equal(document.querySelector('[data-library-type="provider"][data-library-reference="claude"]'), null, 'uninstalled, unregistered providers are not offered as installed nodes');
  assert.equal(document.querySelector('[data-node-id="department:quality"]').dataset.status, 'unavailable');
  const card = document.querySelector('[data-node-id="department:strategy"]'); const before = window.ImperiumWorkspace.getGraph().nodes.find(node => node.id === card.dataset.nodeId).x;
  card.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
  window.dispatchEvent(new window.MouseEvent('pointermove', { clientX: 150, clientY: 130 })); window.dispatchEvent(new window.MouseEvent('pointerup', { clientX: 150, clientY: 130 }));
  assert.notEqual(window.ImperiumWorkspace.getGraph().nodes.find(node => node.id === card.dataset.nodeId).x, before);
  connect(document, 'department:strategy', 'department:quality'); await settle(420);
  const write = calls.find(call => call.path === '/api/graph' && call.method === 'PUT');
  assert.equal(write.headers['x-hq-token'], 'test-node-csrf'); assert.equal(write.body.workspace, state.settings.workspace); assert.equal(write.body.edges[0].type, 'handoff');
  assert.equal(calls.filter(call => call.path === '/api/workflows/run').length, 0);
  connect(document, 'department:quality', 'department:strategy');
  assert.equal(window.ImperiumWorkspace.getGraph().edges.length, 1, 'local cycle validation rejects an inverse handoff');
  window.ImperiumWorkspace.render(state, { ...options, connected: false });
  assert.ok([...document.querySelectorAll('.iw-node')].every(node => node.dataset.status === 'offline'));
  assert.deepEqual(errors, []);
});

test('agent registration removal requires explicit confirmation and refreshes authoritative state while retaining history', async t => {
  const { window, document, state, calls, options } = await setup(t);
  state.tasks = [{ id: 'retained', departmentId: 'strategy', status: 'completed', output: 'RETAINED_RESULT' }];
  await addFromLibrary(document, 'department', 'strategy'); select(window, document, 'department:strategy');
  document.querySelector('[data-iw-action="remove-agent"]').click();
  const dialog = document.querySelector('[data-iw-remove-dialog="strategy"]'); assert.match(dialog.textContent, /Strategy/); assert.match(dialog.textContent, /Conversations, tasks and memories are retained/); assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
  dialog.querySelector('button').click(); assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
  document.querySelector('[data-iw-action="remove-agent"]').click(); document.querySelector('[data-iw-confirm-remove="strategy"]').click(); await settle(30);
  const removed = calls.find(call => call.method === 'DELETE'); assert.equal(removed.path, '/api/departments/strategy'); assert.equal(removed.body.workspace, state.settings.workspace); assert.equal(removed.headers['x-hq-token'], 'test-node-csrf');
  assert.equal(state.departments.some(agent => agent.id === 'strategy'), false); assert.equal(state.tasks[0].output, 'RETAINED_RESULT'); assert.equal(document.querySelector('[data-node-id="department:strategy"]'), null);
});

test('busy agents cannot be removed and server rejection leaves the registration and canvas intact', async t => {
  const { window, document, state, options, calls } = await setup(t, { deleteResponse: () => ({ ok: false, status: 409, json: async () => ({ error: 'Agent is still assigned to queued work' }) }) });
  await addFromLibrary(document, 'department', 'strategy'); state.tasks = [{ id: 'busy', departmentId: 'strategy', status: 'queued' }]; window.ImperiumWorkspace.render(state, options); select(window, document, 'department:strategy');
  assert.equal(document.querySelector('[data-iw-action="remove-agent"]').disabled, true); assert.match(document.querySelector('[data-iw-removal-blocked]').textContent, /running and queued/);
  state.tasks = []; window.ImperiumWorkspace.render(state, options); select(window, document, 'department:strategy'); document.querySelector('[data-iw-action="remove-agent"]').click(); document.querySelector('[data-iw-confirm-remove="strategy"]').click(); await settle();
  assert.match(document.querySelector('[data-iw-remove-dialog] [role="alert"]').textContent, /queued work/); assert.ok(document.querySelector('[data-node-id="department:strategy"]')); assert.ok(state.departments.some(agent => agent.id === 'strategy')); assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
});

test('model connection removal shows assignment reasons and confirms without logging out or executing commands', async t => {
  const { window, document, state, calls } = await setup(t, { initialConnections: [{ id: 'assigned', label: 'Assigned <img src=x>', providerId: 'codex' }, { id: 'unused', label: 'Personal model', providerId: 'codex' }] });
  state.departments[0].connectionId = 'assigned'; window.ImperiumAccounts.mount('#accounts', { getState: () => state }); await settle();
  assert.equal(document.querySelector('[data-remove-connection="assigned"]').disabled, true); assert.match(document.querySelector('[data-connection-blocked="assigned"]').textContent, /Strategy/); assert.equal(document.querySelector('img[src="x"]'), null);
  document.querySelector('[data-remove-connection="unused"]').click(); const dialog = document.querySelector('[data-connection-remove-dialog="unused"]'); assert.match(dialog.textContent, /CLI sign-in and installation stay in place/); assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
  dialog.querySelector('[data-confirm-connection-remove]').click(); await settle(); assert.equal(document.querySelector('[data-connection-id="unused"]'), null); assert.ok(document.querySelector('[data-connection-id="assigned"]'));
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1); assert.ok(!calls.some(call => /logout|uninstall|terminal/.test(call.path)));
});

test('late agent removal does not change a different project', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const { window, document, state, options, graphByProject, calls } = await setup(t, { deleteDelay: () => pending });
  await addFromLibrary(document, 'department', 'strategy'); select(window, document, 'department:strategy'); document.querySelector('[data-iw-action="remove-agent"]').click(); document.querySelector('[data-iw-confirm-remove="strategy"]').click(); await settle();
  state.settings.workspace = 'C:\\Project B'; state.departments = [{ id: 'strategy', name: 'B agent', provider: 'codex' }]; graphByProject.set(state.settings.workspace, { nodes: [{ id: 'department:strategy', type: 'department', referenceId: 'strategy', x: 10, y: 10 }], edges: [] }); window.ImperiumWorkspace.render(state, options); await settle(); release(); await settle();
  assert.ok(document.querySelector('[data-node-id="department:strategy"]')); assert.equal(state.departments[0].name, 'B agent'); assert.equal(document.querySelector('[data-iw-remove-dialog]'), null); assert.equal(calls.filter(call => call.path === '/api/state').length, 0);
});

test('connection rejection is visible without deleting its row and removal labels translate to Korean and Japanese', async t => {
  const { window, document, state, options } = await setup(t, { initialConnections: [{ id: 'unused', label: 'Model <script>literal</script>', providerId: 'codex' }], deleteResponse: () => ({ ok: false, status: 409, json: async () => ({ error: 'Assigned in another project. Unassign that agent first.' }) }) });
  window.ImperiumAccounts.mount('#accounts', { getState: () => state }); await settle();
  document.querySelector('[data-remove-connection="unused"]').click(); document.querySelector('[data-confirm-connection-remove="unused"]').click(); await settle();
  assert.match(document.querySelector('[data-connection-remove-dialog] [role="alert"]').textContent, /another project/); assert.ok(document.querySelector('[data-connection-id="unused"]')); assert.equal(document.querySelector('script'), null);
  document.documentElement.lang = 'ja'; window.ImperiumAccounts.render(state); assert.equal(document.querySelector('[data-remove-connection="unused"]').textContent, 'モデル接続を削除');
  document.documentElement.lang = 'ko'; window.ImperiumAccounts.render(state); assert.equal(document.querySelector('[data-remove-connection="unused"]').textContent, '모델 연결 제거');
  await addFromLibrary(document, 'department', 'strategy'); select(window, document, 'department:strategy'); window.ImperiumWorkspace.render(state, { ...options, language: 'ja' }); assert.equal(document.querySelector('[data-iw-action="remove-agent"]').textContent, 'エージェントを削除');
});

test('memory context is persisted, editable, safe as text and used only by an explicit workflow action', async t => {
  const { window, document, state, calls, errors } = await setup(t);
  await addFromLibrary(document, 'department', 'strategy');
  document.querySelector('[data-iw-action="add-memory"]').click(); await settle(); document.querySelector('.iw-memory-list button').click();
  assert.equal(document.querySelectorAll('.iw-node-memory').length, 1); assert.equal(document.querySelector('img[src="x"]'), null); assert.equal(window.bad, undefined);
  assert.equal(document.querySelector('.iw-memory-form textarea').maxLength, 24000);
  document.querySelector('.iw-memory-form textarea').value = 'A revised verified fact.';
  document.querySelector('.iw-memory-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const patch = calls.find(call => call.method === 'PATCH'); assert.equal(patch.body.workspace, state.settings.workspace); assert.equal(patch.body.content, 'A revised verified fact.');
  connect(document, 'memory:memory-1', 'department:strategy'); await settle(420);
  assert.equal(window.ImperiumWorkspace.getGraph().edges[0].type, 'memory_context');
  select(window, document, 'department:strategy'); document.querySelector('.iw-workflow-form textarea').value = 'Use the connected facts and make a plan.';
  document.querySelector('.iw-workflow-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const run = calls.find(call => call.path === '/api/workflows/run'); assert.equal(run.body.departmentId, 'strategy'); assert.equal(run.body.permission, 'read-only'); assert.equal(run.body.workspace, state.settings.workspace);
  const contextSaveIndex = calls.findLastIndex(call => call.path === '/api/graph' && call.method === 'PUT'); assert.ok(contextSaveIndex < calls.indexOf(run), 'graph persistence precedes workflow execution');
  assert.ok(calls.filter(call => ['/api/graph', '/api/memory'].includes(call.path) && call.method === 'GET').every(call => call.workspace === state.settings.workspace));
  assert.deepEqual(errors, []);
});

test('templates are explicit, auto arrangement never creates nodes, and removing nodes preserves underlying records', async t => {
  const initialGraph = { nodes: [{ id: 'department:strategy', type: 'department', referenceId: 'strategy', x: 87, y: 91 }, { id: 'department:deleted', type: 'department', referenceId: 'deleted', x: 900, y: 900 }], edges: [] };
  const { window, document, state, options, graphByProject } = await setup(t, { initialGraph });
  assert.equal(document.querySelectorAll('.iw-node').length, 1, 'saved nodes are preserved and only stale references are removed');
  assert.equal(window.ImperiumWorkspace.getGraph().nodes[0].x, 87);
  document.querySelector('[data-iw-action="arrange"]').click(); assert.equal(document.querySelectorAll('.iw-node').length, 1);
  const position = { ...window.ImperiumWorkspace.getGraph().nodes[0] };
  document.querySelector('[data-iw-action="add-node"]').click(); await settle(); document.querySelector('.iw-node-library [data-iw-action="template"]').click();
  assert.equal(document.querySelectorAll('.iw-node').length, 4);
  assert.equal(window.ImperiumWorkspace.getGraph().nodes.find(node => node.id === position.id).x, position.x, 'loading a template does not move an existing custom node');
  for (const item of [...window.ImperiumWorkspace.getGraph().nodes]) { select(window, document, item.id); document.querySelector('[data-iw-action="remove-node"]').click(); }
  assert.equal(document.querySelectorAll('.iw-node').length, 0); assert.equal(state.departments.length, 2); assert.equal(state.providers.length, 2);
  await settle(420); assert.equal(graphByProject.get(state.settings.workspace).nodes.length, 0);
  window.ImperiumWorkspace.render(state, options); await window.ImperiumWorkspace.reload();
  assert.equal(document.querySelectorAll('.iw-node').length, 0, 'a persisted empty graph stays empty after reload');
});

test('the library supports drag and drop and creates custom agents with free names and titles', async t => {
  const { window, document, calls, state } = await setup(t);
  document.querySelector('[data-iw-action="add-node"]').click(); await settle();
  const entry = document.querySelector('[data-library-type="provider"][data-library-reference="codex"]');
  const values = new Map(), transfer = { types: ['application/x-imperium-node'], setData: (key, value) => values.set(key, value), getData: key => values.get(key) };
  const start = new window.Event('dragstart', { bubbles: true }); Object.defineProperty(start, 'dataTransfer', { value: transfer }); entry.dispatchEvent(start);
  const drop = new window.MouseEvent('drop', { bubbles: true, clientX: 350, clientY: 240 }); Object.defineProperty(drop, 'dataTransfer', { value: transfer }); document.querySelector('.iw-stage').dispatchEvent(drop);
  const provider = window.ImperiumWorkspace.getGraph().nodes.find(node => node.id === 'provider:codex'); assert.equal(provider.x, 350); assert.equal(provider.y, 240);
  const form = document.querySelector('.iw-agent-create-form');
  assert.equal(form.querySelector('input[aria-label="Agent name"]').maxLength, 24); assert.equal(form.querySelector('input[aria-label="Title"]').maxLength, 80); assert.equal(form.querySelector('textarea').maxLength, 1500);
  form.querySelector('input[aria-label="Agent name"]').value = 'Aster'; form.querySelector('input[aria-label="Title"]').value = 'Systems analyst'; form.querySelector('textarea').value = 'Review system assumptions.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const create = calls.find(call => call.path === '/api/departments'); assert.deepEqual(create.body, { name: 'Aster', title: 'Systems analyst', role: 'Review system assumptions.', provider: 'codex', workspace: state.settings.workspace });
  const card = document.querySelector('[data-node-id="department:custom-agent-1"]'); assert.ok(card); assert.equal(card.querySelector('.iw-node-title').textContent, 'Aster'); assert.equal(card.querySelector('.iw-node-kind').textContent, 'Systems analyst');
  await addFromLibrary(document, 'commander', 'commander'); select(window, document, 'commander');
  const identity = document.querySelector('.iw-identity-form'); identity.querySelector('input[aria-label="Name"]').value = 'Sato'; identity.querySelector('input[aria-label="Title"]').value = 'Technical director'; identity.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.deepEqual(calls.find(call => call.path === '/api/settings').body.identity, { name: 'Sato', title: 'Technical director' });
  assert.equal(document.querySelector('[data-node-id="commander"] .iw-node-title').textContent, 'Sato'); assert.equal(document.querySelector('[data-node-id="commander"] .iw-node-description').textContent, 'Technical director');
});

test('local-only mode hides cloud library choices without deleting saved cloud nodes', async t => {
  const initialGraph = { nodes: [{ id: 'provider:codex', type: 'provider', referenceId: 'codex', x: 100, y: 80 }, { id: 'department:strategy', type: 'department', referenceId: 'strategy', x: 100, y: 290 }], edges: [] };
  const { window, document, state, options } = await setup(t, { initialGraph });
  state.providers.push({ id: 'ollama', name: 'Ollama', installed: true, status: 'ready', kind: 'local' }); state.departments.push({ id: 'local-agent', name: 'Local analyst', title: 'Offline reviewer', role: 'Review local files.', provider: 'ollama' }); state.settings.localOnly = true;
  window.ImperiumWorkspace.render(state, options);
  assert.equal(document.querySelectorAll('.iw-node').length, 2); assert.equal(document.querySelector('[data-node-id="provider:codex"]').dataset.status, 'disabled');
  document.querySelector('[data-iw-action="add-node"]').click(); await settle();
  assert.equal(document.querySelector('[data-library-type="provider"][data-library-reference="codex"]'), null); assert.ok(document.querySelector('[data-library-type="provider"][data-library-reference="ollama"]'));
  assert.equal(document.querySelector('[data-library-type="department"][data-library-reference="strategy"]'), null); assert.ok(document.querySelector('[data-library-type="department"][data-library-reference="local-agent"]'));
  assert.match(document.querySelector('.iw-local-notice').textContent, /Cloud providers are hidden/);
  select(window, document, 'department:strategy'); assert.equal(document.querySelector('.iw-workflow-run').disabled, true);
});

test('node progress labels model estimates separately from historical estimates and expires ETA without completing', async t => {
  const { window, document, state, options } = await setup(t);
  let now = Date.UTC(2026, 10, 18, 9, 30); window.Date.now = () => now;
  state.tasks = [{ id: 'task-estimate', departmentId: 'strategy', title: 'Analyze the project', status: 'running', createdAt: new Date(now - 180000).toISOString(), progress: { percent: 42, etaMinutes: 12, stage: '<img src=x>Reviewing requirements', source: 'model-estimate', updatedAt: new Date(now - 120000).toISOString() }, historicalETA: { source: 'history', sampleCount: 8, medianSeconds: 600, p90Seconds: 900, remainingSeconds: 300 } }];
  window.ImperiumWorkspace.render(state, options); await addFromLibrary(document, 'department', 'strategy');
  let progress = document.querySelector('.iw-node-progress');
  assert.equal(progress.dataset.progressSource, 'model-estimate'); assert.equal(progress.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '42'); assert.match(progress.textContent, /AI self-estimate/); assert.match(progress.textContent, /AI ETA ~10 min/); assert.match(progress.querySelector('[data-estimate-source="history"]').textContent, /History 8 runs: ~5 min.*p90 15 min/);
  select(window, document, 'department:strategy'); assert.match(document.querySelector('.iw-progress-stage').textContent, /AI-reported work stage/); assert.match(document.querySelector('.iw-progress-stage').textContent, /<img src=x>Reviewing requirements/); assert.equal(document.querySelector('img[src="x"]'), null);
  now += 13 * 60000; window.ImperiumWorkspace.render(state, options); progress = document.querySelector('.iw-node-progress');
  assert.match(progress.textContent, /Estimate exceeded.*awaiting update/); assert.match(document.querySelector('.iw-task-progress').textContent, /Estimate exceeded/); assert.equal(progress.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '42'); assert.equal(state.tasks[0].status, 'running');
});

test('missing model progress has no invented percentage and only completed processes show 100 percent', async t => {
  const { window, document, state, options } = await setup(t);
  state.tasks = [{ id: 'task-no-model-report', departmentId: 'strategy', title: 'Review work', status: 'running', createdAt: new Date().toISOString(), historicalETA: { source: 'history', sampleCount: 3, medianSeconds: 180, p90Seconds: 300, remainingSeconds: 120 } }];
  window.ImperiumWorkspace.render(state, options); await addFromLibrary(document, 'department', 'strategy');
  let progress = document.querySelector('.iw-node-progress');
  assert.match(progress.textContent, /Awaiting AI estimate/); assert.equal(progress.querySelector('[role="progressbar"]'), null); assert.equal(progress.querySelector('.iw-progress-percent'), null); assert.match(progress.textContent, /History 3 runs: ~2 min/);
  state.tasks[0].status = 'failed'; state.tasks[0].progress = { source: 'model-estimate', percent: 100, etaMinutes: 0, updatedAt: new Date().toISOString() }; window.ImperiumWorkspace.render(state, options);
  progress = document.querySelector('.iw-node-progress'); assert.match(progress.textContent, /Failed/); assert.equal(progress.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '99'); assert.ok(!progress.textContent.includes('100%'));
  state.tasks[0].status = 'cancelled'; state.tasks[0].progress = { source: 'process', percent: 100 }; window.ImperiumWorkspace.render(state, options);
  progress = document.querySelector('.iw-node-progress'); assert.match(progress.textContent, /Cancelled/); assert.equal(progress.querySelector('[role="progressbar"]'), null); assert.ok(!progress.textContent.includes('100%'));
  state.tasks[0].status = 'completed'; window.ImperiumWorkspace.render(state, options);
  progress = document.querySelector('.iw-node-progress'); assert.equal(progress.dataset.progressSource, 'process'); assert.equal(progress.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '100'); assert.match(progress.textContent, /Process completed.*100%/);
});

test('progress labels translate and a zero-minute estimate waits for re-estimation instead of claiming completion', async t => {
  const { window, document, state, options } = await setup(t);
  state.tasks = [{ id: 'task-zero-eta', departmentId: 'strategy', title: '작업 검토', status: 'running', createdAt: new Date().toISOString(), progress: { source: 'model-estimate', percent: 90, etaMinutes: 0, updatedAt: new Date().toISOString() } }];
  window.ImperiumWorkspace.render(state, options); await addFromLibrary(document, 'department', 'strategy');
  window.ImperiumWorkspace.render(state, { ...options, language: 'ko' }); assert.match(document.querySelector('.iw-node-progress').textContent, /AI 자체 추정.*90%.*재추정 대기/);
  window.ImperiumWorkspace.render(state, { ...options, language: 'ja' }); assert.match(document.querySelector('.iw-node-progress').textContent, /AI自身の推定.*90%.*再推定待ち/); assert.equal(state.tasks[0].status, 'running');
});

test('a delayed graph response from a previous project cannot overwrite the current project', async t => {
  let releaseOld; const oldResponse = new Promise(resolve => { releaseOld = resolve; });
  const { window, document, state, options, graphByProject } = await setup(t, { graphDelay: workspace => workspace === 'C:\\프로젝트 A' ? oldResponse : Promise.resolve() });
  graphByProject.set('C:\\프로젝트 A', { nodes: [{ id: 'old-memory', type: 'memory', referenceId: 'memory-1', x: 100, y: 100 }], edges: [] });
  state.settings.workspace = 'C:\\프로젝트 B'; window.ImperiumWorkspace.render(state, options); await settle(); releaseOld(); await settle();
  assert.equal(document.querySelector('[data-node-id="old-memory"]'), null); assert.equal(window.ImperiumWorkspace.getGraph().nodes.some(node => node.id === 'old-memory'), false);
});

test('account manager distinguishes discovered models from manual IDs and only prepares terminal commands', async t => {
  const { window, document, state, calls, errors } = await setup(t);
  window.ImperiumAccounts.mount(document.querySelector('#accounts'), { getState: () => state }); await settle();
  assert.equal(document.querySelectorAll('.ia-provider-card').length, 2); assert.equal(document.querySelector('.ia-provider-card[data-provider-id="claude"]').dataset.status, 'missing');
  document.querySelector('.ia-model-heading button').click(); await settle(); const option = document.querySelector('option[data-model-source="account"]'); assert.equal(option.value, 'actual-account-model');
  document.querySelector('.ia-register-form input').value = 'Personal account'; const model = document.querySelector('.ia-register-form select[aria-label="Choose a model"]'); model.value = option.value;
  document.querySelector('.ia-register-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(calls.find(call => call.path === '/api/providers/register').body.modelId, 'actual-account-model'); assert.equal(document.querySelectorAll('.ia-connection').length, 1);
  const provider = document.querySelector('.ia-register-form select[aria-label="Provider"]'); provider.value = 'claude'; provider.dispatchEvent(new window.Event('change')); document.querySelector('.ia-model-heading button').click(); await settle();
  assert.equal(model.value, '__manual__'); assert.equal(document.querySelector('.ia-register-form input[aria-label="Model ID"]').hidden, false); assert.match(document.querySelector('.ia-field-help').textContent, /No account catalog/);
  let prepared; window.addEventListener('imperium:terminal-command', event => { prepared = event.detail.command; }); document.querySelector('.ia-command>div button:last-child').click();
  assert.equal(prepared, 'npm install -g @openai/codex'); assert.equal(calls.filter(call => call.path.includes('terminal') || call.path === '/api/workflows/run').length, 0);
  assert.deepEqual(errors, []);
});

test('onboarding requires explicit navigation and sample activation and persists completion', async t => {
  const { window, document, state, calls } = await setup(t, { startOnboarded: false });
  window.ImperiumAccounts.mount(document.querySelector('#accounts'), { getState: () => state }); await settle();
  assert.equal(document.querySelector('.ia-wizard').open, true); assert.equal(calls.filter(call => call.path === '/api/demo').length, 0);
  for (let step = 0; step < 3; step++) document.querySelector('.ia-wizard-navigation .ia-primary').click();
  assert.match(document.querySelector('.ia-wizard-body').textContent, /Samples do not call a model/);
  document.querySelector('.ia-wizard-body>.ia-primary').click(); await settle();
  assert.equal(calls.filter(call => call.path === '/api/demo').length, 1); assert.ok(calls.some(call => call.path === '/api/settings' && call.body.onboarded === true)); assert.equal(document.querySelector('.ia-wizard').open, false);
});
