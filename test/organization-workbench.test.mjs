import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../public/organization-workbench.js', import.meta.url), 'utf8');
const workspace = 'C:\\Projects\\Company';
const department = (id, extra = {}) => ({ id, name: `Role ${id}`, title: 'Engineer', role: 'Implement tested changes', provider: 'codex', modelId: 'requested-model', ...extra });
const work = (id, departmentId, extra = {}) => ({ id, workspace, departmentId, departmentName: `Role ${departmentId}`, title: `Work ${id}`, status: 'completed', createdAt: '2026-11-19T05:00:00Z', logs: [], ...extra });
const initial = extra => ({ settings: { workspace, language: 'en', identity: { name: 'Sato', title: 'Owner' } }, server: { csrfToken: 'csrf', skillsRevision: 1 }, providers: [{ id: 'codex', status: 'ready', authenticated: true }], connections: [{ id: 'account', providerId: 'codex', label: 'My account', modelId: 'account-model' }], departments: [department('fe'), department('be', { provider: 'claude' })], tasks: [], graph: { nodes: [], edges: [] }, ...extra });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
function fixture(t, { state = initial(), api = async path => path.startsWith('/api/skills') ? { workspace: new URL(path, 'http://localhost').searchParams.get('workspace'), skills: [], bindings: {}, revision: 1 } : {}, execution = false } = {}) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body><section id="organization-section"></section><textarea id="dispatch-prompt"></textarea><select id="dispatch-department"><option>Role</option></select></body></html>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/' });
  const { window } = dom; const calls = [], navigations = [], assignments = [], edits = [], notices = []; let current = state, changed = 0, destroyed = 0;
  if (execution) window.ImperiumExecution = { create() { return { element: window.document.createElement('div'), getValue: () => ({ modelId: 'chosen-model', reasoningEffort: 'high', speed: 'standard' }), setContext() {}, destroy() { destroyed++; } }; } };
  window.eval(source);
  const callbacks = { language: 'en', connected: true, getState: () => current, api: async (path, config = {}) => { calls.push({ path, ...config }); return api(path, config); }, onNavigate: value => navigations.push(value), onAssignDepartment: id => assignments.push(id), onEditDepartment: dept => edits.push(dept.id), toast: value => notices.push(value), onChanged: async () => { changed++; } };
  const render = (next = current, options = {}) => { current = next; window.ImperiumOrganization.render(current, { ...callbacks, ...options }); };
  render(); t.after(() => window.close());
  return { window, document: window.document, calls, navigations, assignments, edits, notices, get changed() { return changed; }, get destroyed() { return destroyed; }, render, get state() { return current; }, card(id) { return window.document.querySelector(`[data-department-id="${id}"]`); }, clickText(text, root = window.document) { const button = [...root.querySelectorAll('button')].find(item => item.textContent === text); assert.ok(button, text); button.click(); return button; }, openCreate() { window.document.querySelector('.org-add-agent').click(); return window.document.querySelector('.org-create-form'); } };
}

test('roles are direct cards with actual owner and all configured providers; no model is run by rendering', async t => {
  const ui = fixture(t, { state: initial({ departments: ['codex', 'claude', 'gemini', 'copilot', 'ollama'].map(id => department(id, { provider: id })) }) }); await tick();
  assert.equal(ui.document.querySelectorAll('#org-model-branches > li.org-agent-card').length, 5);
  assert.equal(ui.document.querySelector('.org-commander-name').textContent, 'Sato');
  assert.equal(ui.document.querySelector('.org-commander-role').textContent, 'Owner');
  assert.equal(ui.document.querySelectorAll('.org-provider-icon[src^="/model-icons/"]').length, 5);
  assert.equal(ui.card('codex').querySelector('.org-agent-model').textContent.includes('Requested model: requested-model'), true);
  assert.equal(ui.calls.every(call => call.path.startsWith('/api/skills') && !call.method), true);
  ui.card('codex').querySelector('.org-agent-actions button').click(); assert.deepEqual(ui.assignments, ['codex']);
  ui.clickText('Edit role', ui.card('codex')); assert.deepEqual(ui.edits, ['codex']);
});

test('goal and dispatch share one draft and retain focus, selection and text through SSE and language rerenders', t => {
  const ui = fixture(t), goal = ui.document.querySelector('.org-goal-input'), dispatch = ui.document.querySelector('#dispatch-prompt');
  goal.focus(); goal.value = 'Build a safe product'; goal.setSelectionRange(4, 10); goal.dispatchEvent(new ui.window.Event('input', { bubbles: true }));
  assert.equal(dispatch.value, goal.value);
  ui.render({ ...ui.state, tasks: [work('active', 'fe', { status: 'running' })] }, { language: 'ja' });
  assert.equal(ui.document.querySelector('.org-goal-input'), goal); assert.equal(ui.document.activeElement, goal); assert.equal(goal.selectionStart, 4); assert.equal(goal.value, 'Build a safe product');
  dispatch.value = 'Prepared elsewhere'; dispatch.dispatchEvent(new ui.window.Event('input')); assert.equal(goal.value, 'Prepared elsewhere');
  ui.document.querySelector('.org-goal-actions button').click(); assert.deepEqual(ui.navigations, ['operations']);
  assert.equal(ui.calls.some(call => call.path === '/api/tasks'), false);
});

test('bound skill metadata and observed/self-reported events remain distinct and refresh only on actual stamp changes', async t => {
  const ui = fixture(t, { state: initial({ tasks: [work('one', 'fe', { logs: [{ type: 'skill', source: 'cli-skill-read', text: 'testing' }, { type: 'skill', source: 'model-reported', text: 'testing' }, { type: 'text', text: 'Skill used' }] })] }), api: async () => ({ workspace, skills: [{ id: 'safe', name: 'Testing <img src=x>', description: 'Real metadata' }], bindings: { fe: ['safe'] }, revision: 3 }) }); await tick();
  assert.equal(ui.card('fe').querySelector('.org-skill-chip').textContent, 'Testing <img src=x>'); assert.equal(ui.card('fe').querySelector('img[src=x]'), null);
  assert.match(ui.card('fe').querySelector('.org-skill-evidence').textContent, /1 tool observations · 1 model reports/);
  assert.equal(ui.card('be').querySelector('.org-skill-evidence').textContent, 'Skill use not observed');
  const count = ui.calls.length; ui.render(); ui.render(ui.state, { language: 'ko' }); await tick(); assert.equal(ui.calls.length, count);
  ui.render({ ...ui.state, server: { ...ui.state.server, skillsRevision: 2 } }); await tick(); assert.equal(ui.calls.length, count + 1);
  let event; ui.window.addEventListener('imperium:skills-agent', value => { event = value.detail; }); ui.card('fe').querySelector('.org-agent-actions button:nth-child(3)').click();
  assert.deepEqual(ui.navigations, ['skills']); assert.equal(event.workspace, workspace); assert.equal(event.departmentId, 'fe');
});

test('cross-project skill responses are ignored and no fetch occurs before a valid app session', async t => {
  const pending = deferred(); const ui = fixture(t, { api: async path => path.includes(encodeURIComponent(workspace)) ? pending.promise : { workspace: 'C:\\Other', skills: [], bindings: {}, revision: 1 } });
  const other = initial({ settings: { workspace: 'C:\\Other', language: 'en' }, departments: [department('new')] }); ui.render(other); await tick();
  pending.resolve({ workspace, skills: [{ id: 'secret', name: 'Private old project' }], bindings: { new: ['secret'] }, revision: 1 }); await tick();
  assert.doesNotMatch(ui.document.querySelector('#org-model-branches').textContent, /Private old project/);
  const before = ui.calls.length; ui.render({ ...other, server: {} }); ui.window.dispatchEvent(new ui.window.CustomEvent('imperium:skills-changed')); await tick(); assert.equal(ui.calls.length, before);
});

test('next handoffs use actual dependencies or saved graph edges and never fabricate department sequence', t => {
  const ui = fixture(t, { state: initial({ tasks: [work('parent', 'fe'), work('child', 'be', { status: 'queued', dependsOn: ['parent'] }), work('foreign', 'fe', { workspace: 'C:\\Other', status: 'running', title: 'Other secret' })] }) });
  assert.equal(ui.card('fe').querySelector('.org-agent-next').textContent, 'Next handoff: Role be'); assert.doesNotMatch(ui.card('fe').textContent, /Other secret/);
  ui.render(initial()); assert.equal(ui.card('fe').querySelector('.org-agent-next').textContent, 'Next handoff: None yet');
  ui.render(initial({ graph: { nodes: [], edges: [{ source: 'department:fe', target: 'department:be', type: 'handoff' }] } }));
  assert.equal(ui.card('fe').querySelector('.org-agent-next').textContent, 'Next connected role: Role be');
});

test('registration posts the captured project and execution settings exactly once without creating canvas nodes or model tasks', async t => {
  const pending = deferred(); const ui = fixture(t, { execution: true, api: async (path, config) => config.method === 'POST' ? pending.promise : { workspace, skills: [], bindings: {}, revision: 1 } });
  const form = ui.openCreate(); form.querySelector('[data-org-name]').value = 'Frontend'; form.querySelector('[data-org-role]').value = 'Build accessible UI';
  form.dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true })); await tick();
  const writes = ui.calls.filter(call => call.method); assert.equal(writes.length, 1); assert.equal(writes[0].path, '/api/departments');
  assert.equal(writes[0].body.workspace, workspace); assert.equal(writes[0].body.name, 'Frontend'); assert.equal(writes[0].body.modelId, 'chosen-model'); assert.equal(writes[0].body.reasoningEffort, 'high'); assert.equal(writes[0].body.speed, 'standard');
  pending.resolve({ department: department('created') }); await tick(); assert.equal(ui.changed, 1); assert.equal(ui.destroyed, 1); assert.equal(ui.document.querySelector('dialog'), null);
  assert.equal(ui.calls.some(call => ['/api/graph', '/api/tasks', '/api/workflows/run'].includes(call.path)), false);
});

test('a registration response after project change cannot mutate or refresh the new project and drafts survive same-project rerenders', async t => {
  const pending = deferred(); const ui = fixture(t, { api: async (path, config) => config.method === 'POST' ? pending.promise : { workspace: new URL(path, 'http://localhost').searchParams.get('workspace'), skills: [], bindings: {}, revision: 1 } });
  const form = ui.openCreate(), name = form.querySelector('[data-org-name]'); name.value = 'In progress'; form.querySelector('[data-org-role]').value = 'Implement'; name.focus();
  ui.render(); assert.equal(ui.document.activeElement, name); assert.equal(name.value, 'In progress');
  form.dispatchEvent(new ui.window.Event('submit', { cancelable: true })); ui.render(initial({ settings: { workspace: 'C:\\Other' }, departments: [department('other')] }));
  pending.resolve({ department: department('old-created') }); await tick(); assert.equal(ui.changed, 0); assert.equal(ui.notices.length, 0); assert.equal(ui.document.querySelector('dialog'), null); assert.equal(ui.card('old-created'), null);
});

test('local mode only registers a local provider, renders cloud roles honestly disabled, and failed deletion preserves records', async t => {
  const ui = fixture(t, { state: initial({ settings: { workspace, localOnly: true } }), api: async (path, config) => { if (config.method === 'DELETE') { const failure = new Error('A process is still shutting down'); failure.status = 409; throw failure; } return { workspace, skills: [], bindings: {}, revision: 1 }; } });
  assert.equal(ui.card('fe').dataset.status, 'disabled'); assert.equal(ui.card('fe').querySelector('.org-agent-actions button').disabled, true);
  const form = ui.openCreate(); assert.deepEqual([...form.querySelector('[data-org-provider]').options].map(option => option.value), ['ollama']);
  ui.clickText('Cancel', form); ui.clickText('Remove agent', ui.card('fe')); assert.equal(ui.calls.some(call => call.method === 'DELETE'), false);
  ui.clickText('Remove agent', ui.document.querySelector('.org-remove-dialog')); await tick();
  assert.equal(ui.calls.find(call => call.method === 'DELETE').body.workspace, workspace); assert.equal(ui.card('fe') !== null, true); assert.match(ui.document.querySelector('.org-remove-dialog .form-error').textContent, /shutting down/);
});
