import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const source = readFileSync(new URL('../public/conversations.js', import.meta.url), 'utf8');
const output = readFileSync(new URL('../public/output-view.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/conversations.css', import.meta.url), 'utf8');
const workspace = 'C:\\Chat Project';
const conversation = (id, extra = {}) => ({ id, workspace, departmentId: 'engineering', provider: 'claude', connectionId: 'claude-account', modelId: 'requested-model', permission: 'read-only', transport: 'native-cli', createdAt: '2026-11-19T01:00:00Z', updatedAt: '2026-11-19T01:00:00Z', ...extra });
const turn = (id, conversationId, extra = {}) => ({ id, conversationId, workspace, departmentId: 'engineering', provider: 'claude', modelId: 'requested-model', permission: 'read-only', prompt: `Question ${id}`, title: `Title ${id}`, output: `Response ${id}`, status: 'completed', logs: [], createdAt: `2026-11-19T01:${String(Number(id) || 0).padStart(2, '0')}:00Z`, ...extra });
const initial = (extra = {}) => ({ settings: { workspace, language: 'en' }, departments: [{ id: 'engineering', name: 'Engineering', provider: 'claude', connectionId: 'claude-account', modelId: 'default-model', reasoningEffort: 'high', speed: 'fast' }, { id: 'research', name: 'Research', provider: 'gemini' }], connections: [{ id: 'claude-account', providerId: 'claude', modelId: 'account-model' }], conversations: [conversation('one'), conversation('two')], tasks: [turn('1', 'one'), turn('2', 'two')], ...extra });
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(value = initial(), api = async () => { throw new Error('unexpected request'); }) {
  const dom = new JSDOM('<section id="chat"></section>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/' });
  const calls = [], writes = []; let current = value;
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async text => writes.push(text) } });
  dom.window.eval(output); dom.window.eval(source);
  const root = dom.window.document.querySelector('#chat');
  const controller = dom.window.ImperiumConversations.mount(root, { getState: () => current, api: (path, options) => { calls.push(JSON.parse(JSON.stringify({ path, ...options }))); return api(path, options); }, onChanged: async result => { if (result.task) current = { ...current, tasks: [...current.tasks, result.task] }; if (result.conversation) current = { ...current, conversations: [...current.conversations, result.conversation] }; controller.render(current); } });
  return { dom, document: dom.window.document, root, calls, writes, render(value) { current = value; controller.render(current); }, type(text) { const input = root.querySelector('.ic-prompt'); input.value = text; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }, select(id) { [...root.querySelectorAll('.ic-conversation')].find(node => node.textContent.includes(`Title ${id}`)).click(); }, submit() { root.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }, close() { controller.destroy(); dom.window.close(); } };
}

test('chat reuses the selected conversation key for queued follow-ups and preserves edited in-flight drafts', async () => {
  const pending = deferred(), ui = fixture(initial({ tasks: [turn('1', 'one', { status: 'running' }), turn('2', 'two')] }), () => pending.promise);
  try {
    assert.match(ui.root.querySelector('.ic-send').textContent, /Add to queue/);
    ui.type('Follow-up question'); ui.submit(); ui.type('Next unsent thought');
    assert.equal(ui.root.querySelector('.ic-prompt').disabled, false);
    assert.equal(ui.calls[0].body.conversationId, 'one');
    assert.equal(ui.calls[0].body.modelId, 'requested-model');
    assert.equal(ui.calls[0].body.provider, 'claude');
    assert.equal(ui.calls[0].body.connectionId, 'claude-account');
    assert.equal(ui.calls[0].body.permission, 'read-only');
    assert.equal(Object.hasOwn(ui.calls[0].body, 'newConversation'), false);
    pending.resolve({ task: turn('3', 'one', { status: 'queued' }) }); await settle();
    assert.equal(ui.root.querySelector('.ic-prompt').value, 'Next unsent thought');
    assert.match(ui.root.textContent, /Response 1/);
    assert.match(ui.root.textContent, /Question 3/);
    assert.equal(ui.calls.length, 1);
  } finally { ui.close(); }
});

test('drafts survive selection, language and project changes without sending any tasks', () => {
  const ui = fixture();
  try {
    ui.type('Draft in one'); ui.select('2'); ui.type('Draft in two'); ui.select('1');
    assert.equal(ui.root.querySelector('.ic-prompt').value, 'Draft in one');
    ui.render(initial({ settings: { workspace, language: 'ja' } }));
    assert.equal(ui.root.querySelector('.ic-prompt').value, 'Draft in one');
    assert.match(ui.root.querySelector('.ic-new').textContent, /新しい会話/);
    const other = 'C:\\Other Chat'; ui.render(initial({ settings: { workspace: other, language: 'ko' }, conversations: [], tasks: [] })); ui.type('Other project draft');
    ui.render(initial()); assert.equal(ui.root.querySelector('.ic-prompt').value, 'Draft in one');
    assert.deepEqual(ui.calls, []);
  } finally { ui.close(); }
});

test('an explicit new conversation uses agent defaults and requires file-write opt-in', async () => {
  const ui = fixture(initial(), async (path, { body }) => ({ task: turn('3', 'fresh', { prompt: body.prompt, permission: body.permission }), conversation: conversation('fresh', { modelId: body.modelId, permission: body.permission }) }));
  try {
    ui.root.querySelector('.ic-new').click();
    assert.equal(ui.root.querySelector('.ic-write-label input').checked, false);
    ui.type('New request'); ui.submit(); await settle();
    const body = ui.calls[0].body;
    assert.equal(body.newConversation, true); assert.equal(Object.hasOwn(body, 'conversationId'), false);
    assert.equal(body.modelId, 'default-model'); assert.equal(body.reasoningEffort, 'high'); assert.equal(body.speed, 'fast');
    assert.equal(body.permission, 'read-only');
    assert.equal(ui.root.querySelector('.ic-prompt').value, '');
    ui.type('Continue fresh'); ui.submit(); await settle();
    assert.equal(ui.calls[1].body.conversationId, 'fresh');
  } finally { ui.close(); }
});

test('strict read-only blocks old write conversations and disables new write opt-in without changing their identity', () => {
  const data = initial({ settings: { workspace, language: 'en', accessPolicy: 'read-only' }, conversations: [conversation('one', { permission: 'workspace-write' })], tasks: [turn('1', 'one')] }), ui = fixture(data);
  try {
    assert.equal(ui.root.querySelector('.ic-send').disabled, true);
    assert.match(ui.root.textContent, /Start a new read-only conversation/);
    ui.type('Must not send'); ui.submit(); assert.equal(ui.calls.length, 0);
    ui.root.querySelector('.ic-new').click();
    assert.equal(ui.root.querySelector('.ic-write-label input').checked, false);
    assert.equal(ui.root.querySelector('.ic-write-label input').disabled, true);
    assert.equal(ui.root.querySelector('.ic-send').disabled, false);
  } finally { ui.close(); }
});

test('only the selected conversation hydrates full task details and stale project responses never render', async () => {
  const pending = deferred(), data = initial({ tasks: [turn('1', 'one', { detailsTruncated: true }), turn('2', 'two', { detailsTruncated: true })] }), ui = fixture(data, () => pending.promise);
  try {
    assert.deepEqual(ui.calls.map(call => call.path), ['/api/tasks/1']);
    const other = 'C:\\Other Chat';
    ui.render(initial({ settings: { workspace: other, language: 'en' }, conversations: [conversation('other', { workspace: other })], tasks: [turn('3', 'other', { workspace: other, output: 'Only other project' })] }));
    pending.resolve({ task: turn('1', 'one', { output: 'PRIVATE OLD PROJECT RESPONSE' }) }); await settle();
    assert.doesNotMatch(ui.root.textContent, /PRIVATE OLD PROJECT RESPONSE/);
    assert.match(ui.root.textContent, /Only other project/);
  } finally { ui.close(); }
});

test('turns show explicit reported-model mismatches, native failures and safe text with bounded twenty-turn pages', () => {
  const payload = '<img src=x onerror=alert(1)>', tasks = Array.from({ length: 25 }, (_, index) => turn(String(index), 'one', { reportedModel: index === 24 ? 'actual-model' : undefined, output: index === 24 ? payload : `Response ${index}`, error: index === 24 ? 'Native session missing; resume failed' : null }));
  const ui = fixture(initial({ conversations: [conversation('one')], tasks }));
  try {
    assert.equal(ui.root.querySelectorAll('.ic-turn').length, 20);
    assert.match(ui.root.textContent, /CLI-reported model differs/);
    assert.match(ui.root.textContent, /actual-model/);
    assert.match(ui.root.textContent, /Native session missing; resume failed/);
    assert.equal(ui.root.querySelector('img,script,iframe'), null);
    assert.match(ui.root.textContent, /<img src=x onerror=alert\(1\)>/);
    ui.root.querySelector('.ic-page').click();
    assert.equal(ui.root.querySelectorAll('.ic-turn').length, 5);
    assert.equal(ui.root.querySelector('.ic-page').disabled, true);
    assert.doesNotMatch(source, /\.\s*(?:innerHTML|outerHTML)\b|insertAdjacentHTML\s*\(|\beval\s*\(/);
  } finally { ui.close(); }
});

test('new-draft edits made during submission move to the created conversation and Ctrl+Enter sends once', async () => {
  const pending = deferred(), ui = fixture(initial({ conversations: [], tasks: [] }), () => pending.promise);
  try {
    ui.type('First question');
    const form = ui.root.querySelector('form'); form.requestSubmit = () => ui.submit();
    ui.root.querySelector('textarea').dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    ui.type('Do not discard this new thought');
    pending.resolve({ task: turn('1', 'created'), conversation: conversation('created') }); await settle();
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.root.querySelector('textarea').value, 'Do not discard this new thought');
    assert.equal(ui.root.querySelector('select').disabled, true);
  } finally { ui.close(); }
});

test('the desktop chat surface is a grid while unrelated views keep it hidden', () => {
  const dom = new JSDOM('<div class="app-shell" data-view="chat"><section id="conversations-section" class="ic-chat"><aside class="ic-sidebar"></aside><section class="ic-main"></section></section><div class="workspace-grid"></div></div>');
  try {
    const style = dom.window.document.createElement('style'); style.textContent = css; dom.window.document.head.append(style);
    const chat = dom.window.document.querySelector('#conversations-section'), app = dom.window.document.querySelector('.app-shell');
    assert.equal(dom.window.getComputedStyle(chat).display, 'grid', 'the sidebar and conversation must share the desktop grid row');
    assert.match(dom.window.getComputedStyle(chat).gridTemplateColumns, /^230px minmax\(0(?:px)?,\s*1fr\)$/);
    assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('.workspace-grid')).display, 'none');
    app.dataset.view = 'operations';
    assert.equal(dom.window.getComputedStyle(chat).display, 'none');
  } finally { dom.window.close(); }
});

test('removing the selected agent preserves readable history, model identity and unsent drafts while blocking sends', () => {
  const data = initial({ tasks: [turn('1', 'one', { departmentName: 'Former Engineering', reportedModel: 'actual-model' }), turn('2', 'two')] }), ui = fixture(data);
  try {
    ui.type('Keep this unsent draft');
    const modelBefore = ui.root.querySelector('.ic-model-notice').textContent;
    ui.render({ ...data, departments: data.departments.filter(department => department.id !== 'engineering') });
    assert.equal(ui.root.querySelector('.ic-main-heading h2').textContent, 'Former Engineering');
    assert.equal(ui.root.querySelector('.ic-prompt').value, 'Keep this unsent draft');
    assert.equal(ui.root.querySelector('.ic-model-notice').textContent, modelBefore);
    assert.match(ui.root.textContent, /Response 1/);
    assert.match(ui.root.querySelector('.ic-defaults').textContent, /agent was removed.*read-only/);
    assert.equal(ui.root.querySelector('.ic-send').disabled, true);
    ui.submit(); assert.deepEqual(ui.calls, []);
    ui.root.querySelector('.ic-new').click();
    assert.equal(ui.root.querySelector('.ic-send').disabled, false, 'another configured agent can start a new conversation');
    ui.select('1');
    assert.equal(ui.root.querySelector('.ic-prompt').value, 'Keep this unsent draft');
    ui.render({ ...data, departments: [] }, { language: 'ko' });
  } finally { ui.close(); }
});

test('removing a registered connection blocks follow-ups without silently falling back to another account', () => {
  const data = initial(), ui = fixture(data);
  try {
    ui.type('Keep the account-specific question');
    for (const [language, message] of [['en', /registered connection was removed/], ['ko', /등록된 연결이 제거/], ['ja', /登録された接続が削除/]]) {
      ui.render({ ...data, settings: { ...data.settings, language }, connections: [] });
      assert.match(ui.root.querySelector('.ic-defaults').textContent, message);
      assert.equal(ui.root.querySelector('.ic-send').disabled, true);
      assert.equal(ui.root.querySelector('.ic-prompt').value, 'Keep the account-specific question');
      ui.submit();
    }
    assert.deepEqual(ui.calls, []);
    assert.match(ui.root.querySelector('.ic-compose-context').textContent, /requested-model/);
    assert.match(ui.root.textContent, /Response 1/);
  } finally { ui.close(); }
});
