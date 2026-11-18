import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const source = readFileSync(new URL('../public/collaboration.js', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../public/workspace.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/collaboration.css', import.meta.url), 'utf8');
const workspace = 'C:\\Team Project', other = 'C:\\Other Project';
const settle = async () => { for (let index = 0; index < 4; index++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const task = extra => ({ id: 'task-a', title: 'Inspect source', departmentId: 'engineering', departmentName: 'Engineering', provider: 'claude', modelId: 'requested', status: 'running', workspace, createdAt: '2026-11-19T01:00:00Z', ...extra });
const artifact = extra => ({ id: 'artifact-a', workspace, taskId: 'task-a', departmentId: 'engineering', provider: 'claude', title: 'Saved finding', snippet: 'Actual shared excerpt', kind: 'finding', confidence: 'unverified', createdAt: '2026-11-19T01:02:00Z', ...extra });
const board = extra => ({ workspace, tasks: [task({ workspace: undefined, publicSummary: { text: 'Reviewing files', source: 'model-summary', timestamp: '2026-11-19T01:01:00Z' } })], artifacts: [artifact()], events: [{ id: 'event-a', workspace, sourceTaskId: 'task-a', targetTaskId: 'task-b', action: 'peer_task_get', chars: 122, timestamp: '2026-11-19T01:03:00Z' }], latestSequence: 2, ...extra });
function fixture(t, { response = board(), handler, visible = true, initial } = {}) {
  const errors = [], console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<div id="board"></div>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/', pretendToBeVisual: true, virtualConsole: console });
  const calls = [], selected = []; let state = initial || { settings: { workspace, language: 'en' }, tasks: [], collaborationUpdatedAt: 1 };
  dom.window.eval(source);
  const controller = dom.window.ImperiumCollaboration.mount('#board', { getState: () => state, isVisible: () => visible, onSelectTask: id => selected.push(id), api: async (url, options) => {
    calls.push({ url, options }); if (handler) return handler(url, options);
    return url.includes('/artifacts/') ? { workspace, artifact: { ...artifact(), content: 'Full actual content' } } : response;
  } });
  t.after(() => { controller.destroy(); dom.window.close(); });
  return { window: dom.window, document: dom.window.document, calls, selected, errors, controller, render(next, options) { state = next; controller.render(state, options); }, get state() { return state; }, setVisible(value) { visible = value; controller.render(state); } };
}

test('board displays actual public tasks, explicit provenance, artifact previews and read traces without dispatch', async t => {
  const ui = fixture(t); await settle();
  assert.match(ui.document.querySelector('[data-collaboration-task]').textContent, /Reviewing files/); assert.match(ui.document.querySelector('[data-artifact-id]').textContent, /Agent authored · unverified/);
  assert.match(ui.document.querySelector('[data-collaboration-event]').textContent, /Read peer result/); assert.match(ui.document.querySelector('[data-collaboration-event]').textContent, /122/);
  assert.equal(ui.document.querySelector('[data-artifact-content]'), null); ui.document.querySelector('[data-collaboration-task] button').click(); assert.deepEqual(ui.selected, ['task-a']);
  ui.document.querySelector('[data-artifact-id]').click(); await settle(); assert.equal(ui.document.querySelector('[data-artifact-content]').textContent, 'Full actual content');
  assert.ok(ui.calls.every(call => !call.options.method || call.options.method === 'GET')); assert.ok(ui.calls.every(call => new URL(call.url, 'http://local').searchParams.get('workspace') === 'c:/team project'));
  assert.deepEqual(ui.errors, []);
});

test('honest empty states contain no fake artifacts, agent activity or trace entries', async t => {
  const ui = fixture(t, { response: board({ tasks: [], artifacts: [], events: [] }) }); await settle();
  assert.equal(ui.document.querySelectorAll('[data-artifact-id],[data-collaboration-task],[data-collaboration-event]').length, 0);
  assert.match(ui.document.body.textContent, /No shared artifacts have been published/); assert.match(ui.document.body.textContent, /No read or publish records/); assert.equal(ui.calls.length, 1);
});

test('one peer-list audit shows its actual reader and multiple targets in one row without extra reads', async t => {
  const peers = [task({ id: 'reader', title: 'Reader operation', departmentName: 'Reader agent', status: 'running' }), task({ id: 'peer-one', title: 'First peer output', departmentName: 'First author', status: 'completed' }), task({ id: 'peer-two', title: 'Second peer output', departmentName: 'Second author', status: 'queued' })];
  const ui = fixture(t, { response: board({ tasks: peers, artifacts: [], events: [{ id: 'list-once', workspace, sourceTaskId: 'reader', targetTaskId: 'peer-one', targetTaskIds: ['peer-one', 'peer-two', 'peer-one'], action: 'peer_tasks_list', chars: 0, timestamp: '2026-11-19T01:03:00Z' }] }) }); await settle();
  const rows = ui.document.querySelectorAll('[data-collaboration-event]'); assert.equal(rows.length, 1);
  assert.match(rows[0].children[1].textContent, /Reader agent · Reader operation/); assert.match(rows[0].children[3].textContent, /First author/); assert.match(rows[0].children[3].textContent, /Second author/);
  const targets = rows[0].querySelector('details'); assert.equal(targets.dataset.auditTargetCount, '2'); assert.equal(targets.querySelectorAll('[data-audit-target]').length, 2); targets.open = true;
  assert.equal(ui.calls.length, 1); assert.equal(ui.document.querySelector('[data-collaboration-task]').dataset.collaborationTask, 'reader');
  assert.equal(ui.document.querySelectorAll('[data-collaboration-task]')[1].dataset.collaborationTask, 'peer-two', 'active tasks retain priority over completed work');
});

test('legacy single-target audits still render and publish records do not invent a target', async t => {
  const ui = fixture(t, { response: board({ events: [{ id: 'legacy', workspace, sourceTaskId: 'reader', targetTaskId: 'old-peer', action: 'peer_task_get', chars: 4 }, { id: 'published', workspace, sourceTaskId: 'publisher', targetTaskId: null, targetTaskIds: [], action: 'artifact_publish', chars: 8 }] }) }); await settle();
  assert.equal(ui.document.querySelector('[data-collaboration-event="legacy"]').children[3].textContent, 'old-peer'); assert.equal(ui.document.querySelector('[data-collaboration-event="published"]').children[3].textContent, '—'); assert.equal(ui.calls.length, 1);
});

test('only visible stamp changes refresh the board; live public status updates need no extra request', async t => {
  const ui = fixture(t); await settle(); const original = ui.state;
  for (let index = 0; index < 4; index++) ui.render({ ...original, tasks: [task({ logs: [{ type: 'status', source: 'model-summary', text: `Live summary ${index}`, timestamp: '2026-11-19T01:04:00Z' }] })] });
  assert.equal(ui.calls.length, 1); assert.match(ui.document.querySelector('.ib-summary').textContent, /Live summary 3/);
  ui.render({ ...original, tasks: [task({ status: 'completed', logs: [] })] }); assert.match(ui.document.querySelector('.ib-summary').textContent, /Live summary 3/); assert.equal(ui.calls.length, 1);
  ui.setVisible(false); ui.render({ ...original, collaborationUpdatedAt: 2 }); await settle(); assert.equal(ui.calls.length, 1);
  ui.setVisible(true); await settle(); assert.equal(ui.calls.length, 2);
  ui.document.querySelector('[data-collaboration-refresh]').click(); await settle(); assert.equal(ui.calls.length, 3);
});

test('an initial pending board read is not duplicated by repeated state renders', async t => {
  const pending = deferred(), ui = fixture(t, { handler: () => pending.promise });
  for (let index = 0; index < 6; index++) ui.render(ui.state); assert.equal(ui.calls.length, 1);
  pending.resolve(board()); await settle(); assert.equal(ui.calls.length, 1);
});

test('search uses a bounded encoded query and all external artifact text remains literal', async t => {
  const attack = '<img src=x onerror="window.bad=1"><script>bad()</script>', ui = fixture(t, { response: board({ artifacts: [artifact({ title: attack, snippet: attack })] }), handler: async url => url.includes('/artifacts/') ? { workspace, artifact: { ...artifact(), content: attack } } : board({ artifacts: [artifact({ title: attack, snippet: attack })], truncated: true }) }); await settle();
  const input = ui.document.querySelector('input[type=search]'); input.value = '한글 & /?query'; ui.document.querySelector('form').dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(new URL(ui.calls.at(-1).url, 'http://local').searchParams.get('query'), '한글 & /?query');
  ui.document.querySelector('[data-artifact-id]').click(); await settle(); assert.equal(ui.document.querySelector('[data-artifact-content]').textContent, attack); assert.equal(ui.document.querySelector('img,script,iframe'), null); assert.equal(ui.window.bad, undefined); assert.equal(ui.document.querySelector('.ib-limit').hidden, false);
});

test('late board and artifact reads from a previous project cannot overwrite the current workspace', async t => {
  const oldRead = deferred(), detailRead = deferred(); let requests = 0;
  const ui = fixture(t, { handler: url => { if (url.includes('/artifacts/')) return detailRead.promise; return ++requests === 1 ? oldRead.promise : Promise.resolve(board({ workspace: other, artifacts: [artifact({ id: 'other-artifact', workspace: other, title: 'Other project artifact' })], tasks: [], events: [] })); } });
  ui.render({ settings: { workspace: other, language: 'en' }, collaborationUpdatedAt: 2 }); await settle(); oldRead.resolve(board()); await settle();
  assert.equal(ui.document.querySelector('[data-artifact-id="artifact-a"]'), null); assert.ok(ui.document.querySelector('[data-artifact-id="other-artifact"]'));
  ui.document.querySelector('[data-artifact-id]').click(); ui.render({ settings: { workspace, language: 'en' }, collaborationUpdatedAt: 3 }); await settle(); detailRead.resolve({ workspace: other, artifact: { ...artifact({ id: 'other-artifact', workspace: other }), content: 'FOREIGN_PRIVATE_CONTENT' } }); await settle();
  assert.ok(!ui.document.body.textContent.includes('FOREIGN_PRIVATE_CONTENT')); assert.equal(ui.document.querySelector('[data-artifact-content]'), null);
});

test('Korean and Japanese labels, errors and destruction remain safe and the reader uses readable type', async t => {
  const ui = fixture(t, { handler: async () => { throw new Error('Read unavailable'); } }); await settle(); assert.match(ui.document.querySelector('.ib-message').textContent, /Read unavailable/);
  ui.render({ settings: { workspace, language: 'ko' }, collaborationUpdatedAt: 1 }); assert.match(ui.document.querySelector('h2').textContent, /협업 보드/);
  ui.render({ settings: { workspace, language: 'ja' }, collaborationUpdatedAt: 1 }); assert.match(ui.document.querySelector('h2').textContent, /共同作業ボード/);
  const style = ui.document.createElement('style'); style.textContent = css; ui.document.head.append(style); assert.ok(style.sheet.cssRules.length); assert.match(css, /font:16px\/1\.75/);
  ui.controller.destroy(); await ui.controller.reload(); assert.equal(ui.calls.length, 1);
});

async function workflowFixture(t, { unavailable = false, policy = 'read-only', rejectRun = false } = {}) {
  const dom = new JSDOM('<div class="app-shell"><div id="node-workspace"></div></div>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/', pretendToBeVisual: true });
  const state = { settings: { workspace, accessPolicy: policy }, server: { csrfToken: 'workflow-test' }, providers: [{ id: 'codex', status: 'ready', authenticated: true }, { id: 'claude', status: unavailable ? 'missing' : 'ready', authenticated: true }], departments: [{ id: 'start', name: 'Starting engineer', role: 'Inspect source', provider: 'codex' }, { id: 'review', name: 'Review engineer', role: 'Review the result', provider: 'claude' }], tasks: [] }, calls = [];
  let graph = { nodes: [{ id: 'department:start', type: 'department', referenceId: 'start', x: 0, y: 0 }, { id: 'department:review', type: 'department', referenceId: 'review', x: 300, y: 0 }], edges: [{ id: 'handoff', type: 'handoff', source: 'department:start', target: 'department:review' }] };
  dom.window.fetch = async (url, options = {}) => { const parsed = new URL(url, 'http://local'), body = options.body && JSON.parse(options.body); calls.push({ path: parsed.pathname, method: options.method || 'GET', body });
    if (parsed.pathname === '/api/workflows/run' && rejectRun) return { ok: false, json: async () => ({ error: 'Queue is full' }) };
    if (parsed.pathname === '/api/graph' && options.method === 'PUT') graph = body;
    return { ok: true, json: async () => parsed.pathname === '/api/graph' ? { graph } : parsed.pathname === '/api/memory' ? { nodes: [] } : { tasks: [{ id: 'started' }] } };
  };
  let opened = 0; const options = { language: 'en', connected: true, onOpenCollaboration: () => { opened++; } };
  dom.window.eval(workspaceSource); dom.window.ImperiumWorkspace.render(state, options); await settle();
  dom.window.document.querySelector('[data-node-id="department:start"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  t.after(() => dom.window.close()); return { window: dom.window, document: dom.window.document, calls, state, options, get opened() { return opened; } };
}

test('connected workflow exposes its real reachable agents and default read-only policy before explicit dispatch', async t => {
  const ui = await workflowFixture(t); assert.equal(ui.document.querySelectorAll('[data-workflow-agent]').length, 2); assert.match(ui.document.querySelector('.iw-workflow-form').textContent, /Starting engineer/); assert.match(ui.document.querySelector('.iw-workflow-form').textContent, /Review engineer/);
  const form = ui.document.querySelector('.iw-workflow-form'), checkbox = form.querySelector('input'); assert.equal(checkbox.checked, false); assert.equal(checkbox.disabled, true); assert.equal(ui.calls.filter(call => call.path === '/api/workflows/run').length, 0);
  ui.document.querySelector('[data-iw-action="collaboration"]').click(); assert.equal(ui.opened, 1);
  const node = ui.document.querySelector('[data-node-id="department:start"]'); node.dispatchEvent(new ui.window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })); ui.window.dispatchEvent(new ui.window.MouseEvent('pointermove', { clientX: 55, clientY: 55 })); ui.window.dispatchEvent(new ui.window.MouseEvent('pointerup', { clientX: 55, clientY: 55 }));
  form.querySelector('textarea').value = 'Review the connected implementation'; form.dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const request = ui.calls.find(call => call.path === '/api/workflows/run'); assert.equal(request.body.departmentId, 'start'); assert.equal(request.body.workspace, workspace); assert.equal(request.body.permission, 'read-only');
  assert.ok(ui.calls.findIndex(call => call.path === '/api/graph' && call.method === 'PUT') < ui.calls.indexOf(request)); assert.ok(ui.calls.some(call => call.path === '/api/graph' && call.method === 'PUT'));
});

test('unavailable downstream providers block the workflow and server rejection preserves the draft', async t => {
  const blocked = await workflowFixture(t, { unavailable: true }); assert.equal(blocked.document.querySelector('.iw-workflow-run').disabled, true); assert.match(blocked.document.querySelector('[data-workflow-blocked]').textContent, /Review engineer/);
  const ui = await workflowFixture(t, { policy: 'task-confirm', rejectRun: true }), form = ui.document.querySelector('.iw-workflow-form'), input = form.querySelector('textarea');
  input.value = 'KEEP MY WORKFLOW DRAFT'; input.dispatchEvent(new ui.window.Event('input', { bubbles: true })); form.dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(input.value, 'KEEP MY WORKFLOW DRAFT'); assert.match(ui.document.querySelector('.iw-save-status').textContent, /Queue is full/); assert.equal(form.querySelector('input').checked, false);
});
