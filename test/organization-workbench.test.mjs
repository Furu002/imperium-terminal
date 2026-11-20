import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../public/organization-workbench.js', import.meta.url), 'utf8');
const nodesSource = readFileSync(new URL('../public/organization-nodes.js', import.meta.url), 'utf8');
const workspace = 'C:\\Projects\\Company';
const department = (id, extra = {}) => ({ id, name: `Role ${id}`, title: 'Engineer', role: 'Implement tested changes', provider: 'codex', modelId: 'requested-model', ...extra });
const work = (id, departmentId, extra = {}) => ({ id, workspace, departmentId, departmentName: `Role ${departmentId}`, title: `Work ${id}`, status: 'completed', createdAt: '2026-11-19T05:00:00Z', logs: [], ...extra });
const initial = extra => ({ settings: { workspace, language: 'en', identity: { name: 'Sato', title: 'Owner' } }, server: { csrfToken: 'csrf', skillsRevision: 1 }, providers: [{ id: 'codex', status: 'ready', authenticated: true }], connections: [{ id: 'account', providerId: 'codex', label: 'My account', modelId: 'account-model' }], departments: [department('fe'), department('be', { provider: 'claude' })], tasks: [], graph: { nodes: [], edges: [] }, ...extra });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
function fixture(t, { state = initial(), api = async path => path.startsWith('/api/skills') ? { workspace: new URL(path, 'http://localhost').searchParams.get('workspace'), skills: [], bindings: {}, revision: 1 } : {}, execution = false, canvas = false, nodes } = {}) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body><section id="organization-section"></section><textarea id="dispatch-prompt"></textarea><select id="dispatch-department"><option>Role</option></select></body></html>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/' });
  const { window } = dom; const calls = [], navigations = [], assignments = [], edits = [], notices = []; let current = state, changed = 0, destroyed = 0;
  if (execution) window.ImperiumExecution = { create() { return { element: window.document.createElement('div'), getValue: () => ({ modelId: 'chosen-model', reasoningEffort: 'high', speed: 'standard' }), setContext() {}, destroy() { destroyed++; } }; } };
  if (canvas) window.eval(nodesSource);
  if (nodes) window.ImperiumOrganizationNodes = nodes;
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

test('the compact chart opens details on selection and retains the agent actions with current guards', async t => {
  const running = work('active', 'fe', { provider: 'codex', status: 'running', modelId: 'requested-model', reportedModel: 'runtime-model' });
  const ui = fixture(t, { canvas: true, state: initial({ tasks: [running] }) });
  await tick();
  const card = ui.card('fe');
  const handle = card.querySelector('.org-agent-heading');
  const inspector = ui.document.querySelector('.on-inspector');
  assert.equal(inspector.hidden, true);
  assert.equal(card.querySelector('.org-agent-summary').textContent, 'runtime-model');
  assert.equal(ui.document.querySelector('.org-count').textContent, '2 agents');
  handle.click();
  assert.equal(inspector.hidden, false);
  assert.match(inspector.textContent, /Execution model: runtime-model/);
  assert.match(inspector.textContent, /Work active/);
  const button = action => inspector.querySelector(`[data-inspector-action="${action}"]`);
  assert.equal(button('remove').disabled, true);
  button('assign').click();
  button('edit').click();
  button('skills').click();
  assert.deepEqual(ui.assignments, ['fe']);
  assert.deepEqual(ui.edits, ['fe']);
  assert.deepEqual(ui.navigations, ['skills']);
  ui.render(initial());
  assert.equal(button('remove').disabled, false);
  button('close').focus();
  button('close').click();
  assert.equal(inspector.hidden, true);
  assert.equal(ui.document.activeElement, handle);
  handle.dispatchEvent(new ui.window.KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  assert.equal(inspector.hidden, false);
  button('remove').click();
  assert.ok(ui.document.querySelector('.org-remove-dialog[open]'));
  assert.equal(ui.calls.some(call => call.method === 'DELETE'), false);
});

test('goal and dispatch share one draft and retain focus, selection and text through SSE and language rerenders', t => {
  const ui = fixture(t), goal = ui.document.querySelector('.org-goal-input'), dispatch = ui.document.querySelector('#dispatch-prompt');
  const toggle = ui.document.querySelector('.org-goal-toggle'), panel = ui.document.querySelector('#org-goal-panel');
  assert.equal(panel.hidden, true); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click(); assert.equal(panel.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'true'); assert.equal(ui.document.activeElement, goal);
  goal.focus(); goal.value = 'Build a safe product'; goal.setSelectionRange(4, 10); goal.dispatchEvent(new ui.window.Event('input', { bubbles: true }));
  assert.equal(dispatch.value, goal.value);
  ui.render({ ...ui.state, tasks: [work('active', 'fe', { status: 'running' })] }, { language: 'ja' });
  assert.equal(ui.document.querySelector('.org-goal-input'), goal); assert.equal(ui.document.activeElement, goal); assert.equal(goal.selectionStart, 4); assert.equal(goal.value, 'Build a safe product');
  assert.equal(panel.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  toggle.click(); assert.equal(panel.hidden, true); assert.equal(toggle.getAttribute('aria-expanded'), 'false'); assert.equal(goal.value, 'Build a safe product');
  toggle.click(); assert.equal(panel.hidden, false); assert.equal(ui.document.activeElement, goal); assert.equal(goal.value, 'Build a safe product'); assert.equal(dispatch.value, goal.value);
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

const plain = value => JSON.parse(JSON.stringify(value));
const importPreview = (includeHandoffs = false, extra = {}) => ({ ok: true, dryRun: true, template: 'quant', includeHandoffs, created: [{ index: 0, name: 'Chief', title: 'Lead', provider: 'claude', group: 'board', lead: true, parent: null }], skipped: [{ index: 1, name: 'Role fe', departmentId: 'fe', reason: 'exists' }], errors: [], handoffs: { included: includeHandoffs, total: 1, created: includeHandoffs ? [{ handoffIndex: 0, source: 'Chief', target: 'Role fe' }] : [], skipped: [] }, limit: { existing: 2, adding: 1, max: 64 }, ...extra });
const skillsResponse = path => ({ workspace: new URL(path, 'http://localhost').searchParams.get('workspace'), skills: [], bindings: {}, revision: 1 });

test('template import previews with a dry run, lists every row and imports only after confirmation', async t => {
  const api = async (path, config = {}) => {
    if (path.startsWith('/api/skills')) return skillsResponse(path);
    if (path !== '/api/departments/import') return {};
    if (config.body.dryRun) return importPreview(config.body.includeHandoffs);
    return { ...importPreview(config.body.includeHandoffs), dryRun: false, created: [{ ...importPreview().created[0], departmentId: 'new-id' }], layout: { saved: false, required: true, message: '배치는 수동 조정 필요' } };
  };
  const ui = fixture(t, { api }); await tick();
  const button = ui.document.querySelector('.org-import-template');
  assert.equal(button.textContent, 'Import template');
  button.click();
  const dialog = ui.document.querySelector('.org-import-dialog'), text = dialog.querySelector('[data-org-import-text]'), checkbox = dialog.querySelector('[data-org-import-handoffs]'), submit = dialog.querySelector('button[type=submit]');
  const imports = () => ui.calls.filter(call => call.path === '/api/departments/import');
  const type = value => { text.value = value; text.dispatchEvent(new ui.window.Event('input')); };
  const preview = async () => { dialog.querySelector('[data-org-import-preview]').click(); await tick(); await tick(); };
  assert.match(dialog.textContent, /Also connect handoffs/);
  assert.match(dialog.querySelector('.org-import-warning').textContent, /When a workflow runs, the connected downstream agents run in sequence/);
  assert.equal(checkbox.checked, false, 'handoffs are off by default');
  assert.equal(submit.disabled, true);
  type('{ broken'); await preview();
  assert.match(dialog.querySelector('.form-error').textContent, /could not be read/);
  assert.equal(imports().length, 0, 'invalid JSON never reaches the server');
  const template = { template: 'quant', agents: [{ name: 'Chief', role: 'Lead', provider: 'claude' }], handoffs: [['Chief', 'Role fe']] };
  type(JSON.stringify(template)); await preview();
  assert.deepEqual(plain(imports()[0].body), { workspace, dryRun: true, includeHandoffs: false, template });
  assert.deepEqual([...dialog.querySelectorAll('[data-import-row]')].map(row => row.dataset.importRow), ['created', 'skipped']);
  assert.match(dialog.querySelector('[data-import-row=created]').textContent, /Chief.*Lead · Claude Code · Group: board · Lead/);
  assert.equal(dialog.querySelector('.org-import-summary').textContent, 'Create 1 · Skip 1 · Errors 0 · 1 handoffs will not be connected');
  assert.equal(submit.disabled, false);
  checkbox.checked = true; checkbox.dispatchEvent(new ui.window.Event('change')); await tick(); await tick();
  assert.equal(imports()[1].body.includeHandoffs, true, 'toggling handoffs re-runs the preview');
  assert.match(dialog.querySelector('.org-import-summary').textContent, /Handoffs: connect 1 · skip 0/);
  type(JSON.stringify(template) + ' ');
  assert.equal(submit.disabled, true, 'editing the template invalidates the preview');
  assert.equal(dialog.querySelector('.org-import-preview').dataset.stale, 'true');
  await preview();
  assert.equal(imports().filter(call => !call.body.dryRun).length, 0, 'nothing is imported before confirmation');
  dialog.querySelector('form').dispatchEvent(new ui.window.Event('submit', { cancelable: true })); await tick(); await tick();
  const real = imports().at(-1);
  assert.deepEqual(plain(real.body), { workspace, includeHandoffs: true, template });
  assert.equal(ui.document.querySelector('.org-import-dialog'), null);
  assert.equal(ui.changed, 1);
  assert.deepEqual(ui.notices, ['Template imported: 1 created, 1 skipped.', 'The card layout needs manual adjustment.']);
});

test('template import keeps confirmation disabled for preview errors and shows server details on failure', async t => {
  const api = async (path, config = {}) => {
    if (path.startsWith('/api/skills')) return skillsResponse(path);
    if (path !== '/api/departments/import') return {};
    if (config.body.template.agents.length > 1) return importPreview(false, { ok: false, errors: [{ code: 'invalid', index: 1, name: 'Broken', field: 'role', message: '이름과 역할을 올바르게 입력해 주세요.' }] });
    if (config.body.dryRun) return importPreview(false);
    const failure = new Error('프로젝트당 에이전트는 최대 64개까지 등록할 수 있습니다. 아무것도 저장하지 않았습니다.');
    failure.status = 409; failure.details = importPreview(false, { ok: false, errors: [{ code: 'limit', field: 'agents', message: 'limit reached' }] });
    throw failure;
  };
  const ui = fixture(t, { api }); await tick();
  ui.document.querySelector('.org-import-template').click();
  const dialog = ui.document.querySelector('.org-import-dialog'), text = dialog.querySelector('[data-org-import-text]'), submit = dialog.querySelector('button[type=submit]');
  text.value = JSON.stringify({ template: 't', agents: [{ name: 'Fine' }, { name: 'Broken' }] }); text.dispatchEvent(new ui.window.Event('input'));
  dialog.querySelector('[data-org-import-preview]').click(); await tick(); await tick();
  assert.equal(dialog.querySelector('[data-import-row=error]').textContent.includes('이름과 역할을 올바르게 입력해 주세요.'), true);
  assert.equal(submit.disabled, true);
  text.value = JSON.stringify({ template: 't', agents: [{ name: 'Fine' }] }); text.dispatchEvent(new ui.window.Event('input'));
  dialog.querySelector('[data-org-import-preview]').click(); await tick(); await tick();
  assert.equal(submit.disabled, false);
  dialog.querySelector('form').dispatchEvent(new ui.window.Event('submit', { cancelable: true })); await tick(); await tick();
  assert.ok(ui.document.querySelector('.org-import-dialog'), 'the dialog stays open on failure');
  assert.match(dialog.querySelector('.form-error').textContent, /아무것도 저장하지 않았습니다/);
  assert.equal(dialog.querySelector('[data-import-row=error]').textContent.includes('limit reached'), true);
  assert.equal(submit.disabled, true, 'a failed import needs a fresh preview');
  assert.equal(ui.changed, 0);
});

test('the add dialog offers a parent agent and sends parentId; owner-direct is the default', async t => {
  const pending = deferred();
  const ui = fixture(t, { canvas: true, state: initial({ departments: [department('fe'), department('be', { parentId: 'fe' })] }), api: async (path, config = {}) => path.startsWith('/api/skills') ? skillsResponse(path) : config.method === 'POST' ? pending.promise : {} }); await tick();
  const form = ui.openCreate(), parent = form.querySelector('[data-org-parent]');
  assert.deepEqual([...parent.options].map(option => [option.value, option.textContent]), [['', 'Owner (direct report)'], ['fe', 'Role fe'], ['be', 'Role be']]);
  assert.equal(parent.value, '');
  form.querySelector('[data-org-name]').value = 'Reviewer'; form.querySelector('[data-org-role]').value = 'Review changes';
  parent.value = 'be';
  form.dispatchEvent(new ui.window.Event('submit', { cancelable: true })); await tick();
  assert.equal(ui.calls.find(call => call.method === 'POST').body.parentId, 'be');
  pending.resolve({ department: department('created', { parentId: 'be' }) }); await tick();
  const second = ui.openCreate();
  second.querySelector('[data-org-name]').value = 'Direct'; second.querySelector('[data-org-role]').value = 'Owner report';
  second.dispatchEvent(new ui.window.Event('submit', { cancelable: true })); await tick();
  assert.equal(ui.calls.filter(call => call.method === 'POST').at(-1).body.parentId, null);
});

test('a parse failure during an in-flight preview leaves Preview usable, and the canvas refits after the state refresh', async t => {
  const first = deferred(), order = [];
  let call = 0;
  const api = async (path, config = {}) => {
    if (path.startsWith('/api/skills')) return skillsResponse(path);
    if (path !== '/api/departments/import') return {};
    if (config.body.dryRun) return ++call === 1 ? first.promise : importPreview(false);
    return { ...importPreview(false), dryRun: false, layout: { saved: true, required: true, revision: 2 } };
  };
  const nodes = { create: () => ({ update() {}, reloadAndFit() { order.push(`fit after ${ui.changed} refreshes`); }, destroy() {} }) };
  const ui = fixture(t, { api, nodes }); await tick();
  ui.document.querySelector('.org-import-template').click();
  const dialog = ui.document.querySelector('.org-import-dialog'), text = dialog.querySelector('[data-org-import-text]'), previewButton = dialog.querySelector('[data-org-import-preview]');
  text.value = JSON.stringify({ template: 't', agents: [{ name: 'Fine' }] }); text.dispatchEvent(new ui.window.Event('input'));
  previewButton.click(); await tick();
  assert.equal(previewButton.disabled, true);
  text.value = '{ broken'; text.dispatchEvent(new ui.window.Event('input'));
  dialog.querySelector('[data-org-import-handoffs]').click(); await tick();
  first.resolve(importPreview(false)); await tick(); await tick();
  assert.equal(previewButton.disabled, false, 'Preview is not stuck after a newer run failed to parse');
  text.value = JSON.stringify({ template: 't', agents: [{ name: 'Fine' }] }); text.dispatchEvent(new ui.window.Event('input'));
  previewButton.click(); await tick(); await tick();
  dialog.querySelector('form').dispatchEvent(new ui.window.Event('submit', { cancelable: true })); await tick(); await tick();
  assert.deepEqual(order, ['fit after 1 refreshes']);
  assert.equal(dialog.querySelector('[data-org-import-handoffs]').getAttribute('aria-describedby'), 'org-import-handoff-note');
  assert.ok(dialog.querySelector('#org-import-handoff-note'));
});

test('the client size check uses the request body that is actually sent, and a malformed preview response is reported', async t => {
  const ui = fixture(t); await tick();
  ui.document.querySelector('.org-import-template').click();
  const dialog = ui.document.querySelector('.org-import-dialog'), text = dialog.querySelector('[data-org-import-text]');
  const body = role => JSON.stringify({ template: 't', agents: [{ name: 'A', role, provider: 'codex' }] });
  text.value = body('x'.repeat(128 * 1024 - body('').length - 20)); text.dispatchEvent(new ui.window.Event('input'));
  assert.ok(new TextEncoder().encode(text.value).length <= 128 * 1024, 'the template text alone is under the limit');
  dialog.querySelector('[data-org-import-preview]').click(); await tick();
  assert.match(dialog.querySelector('.form-error').textContent, /128 KB or smaller/);
  assert.equal(ui.calls.some(call => call.path === '/api/departments/import'), false);
  text.value = body('fine'); text.dispatchEvent(new ui.window.Event('input'));
  dialog.querySelector('[data-org-import-preview]').click(); await tick(); await tick();
  assert.equal(dialog.querySelector('.form-error').textContent, 'The request could not be completed.', 'a response without preview lists is an error, not a crash');
  assert.equal(dialog.querySelector('button[type=submit]').disabled, true);
});
