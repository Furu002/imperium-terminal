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
async function setup(t, { graphDelay, startOnboarded = true } = {}) {
  const virtualConsole = new VirtualConsole(), errors = [];
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div class="app-shell" data-view="overview"><div id="node-workspace"></div><div id="accounts"></div></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom; const state = initialState(); state.settings.onboarded = startOnboarded;
  const calls = [], graphByProject = new Map(), memories = [{ id: 'memory-1', title: '<img src=x onerror="window.bad=1">', content: '<script>window.bad=2</script>Verified source facts.', kind: 'note', revision: 2, pinned: true }];
  let sequence = 0;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} } });
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, 'http://127.0.0.1:4310'), path = parsed.pathname, method = options.method || 'GET', body = options.body === undefined ? undefined : JSON.parse(options.body);
    calls.push({ url, path, method, body, headers: options.headers, workspace: parsed.searchParams.get('workspace') });
    let value;
    if (path === '/api/graph' && method === 'GET') { if (graphDelay) await graphDelay(parsed.searchParams.get('workspace')); value = { graph: graphByProject.get(parsed.searchParams.get('workspace')) || { nodes: [], edges: [] } }; }
    else if (path === '/api/graph' && method === 'PUT') { graphByProject.set(body.workspace, { nodes: body.nodes, edges: body.edges }); value = { graph: { nodes: body.nodes, edges: body.edges } }; }
    else if (path === '/api/memory' && method === 'GET') value = { nodes: memories, edges: [] };
    else if (path === '/api/memory' && method === 'POST') { const node = { ...body, id: `memory-new-${++sequence}`, revision: 1 }; memories.push(node); value = { node }; }
    else if (path.startsWith('/api/memory/') && method === 'PATCH') { const index = memories.findIndex(memory => memory.id === path.split('/').at(-1)); memories[index] = { ...memories[index], ...body, revision: memories[index].revision + 1 }; value = { node: memories[index] }; }
    else if (path === '/api/workflows/run') value = { workflow: { id: 'workflow-1' } };
    else if (path === '/api/providers/catalog') value = { catalog: [{ id: 'codex', name: 'Codex', requiresNode: true, installCommand: 'npm install -g @openai/codex', loginCommand: 'codex login' }, { id: 'claude', name: 'Claude', installCommand: 'npm install -g @anthropic-ai/claude-code', loginCommand: 'claude auth login' }], connections: [] };
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

test('node workspace renders real organization state and does not execute while arranging or connecting', async t => {
  const { window, document, state, options, calls, errors } = await setup(t);
  assert.equal(document.querySelectorAll('.iw-node').length, 5); assert.equal(document.querySelectorAll('.iw-edge-organization').length, 4);
  assert.equal(document.querySelector('[data-node-id="provider:claude"]').dataset.status, 'missing');
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

test('memory context is persisted, editable, safe as text and used only by an explicit workflow action', async t => {
  const { window, document, state, calls, errors } = await setup(t);
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
