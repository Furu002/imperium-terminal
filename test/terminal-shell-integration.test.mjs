import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const [html, shellScript, appScript, knowledgeScript] = await Promise.all(['index.html', 'terminal-shell.js', 'app.js', 'knowledge.js'].map(file => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8')));
const settle = async () => { for (let index = 0; index < 6; index++) await new Promise(resolve => setImmediate(resolve)); };

async function fixture(t, { knowledge = false, memory } = {}) {
  const errors = [], requests = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4310/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  const { window } = dom, document = window.document;
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.EventSource = class { addEventListener() {} close() {} };
  const state = {
    settings: { workspace: 'C:\\Projects\\Alpha', language: 'en', onboarded: true, maxConcurrent: 2, identity: { name: 'Me', title: 'Owner' } },
    server: { csrfToken: 'terminal-integration-test', version: 'test' }, providers: [], connections: [], departments: [], tasks: [], events: [],
  };
  window.fetch = async (url, options = {}) => {
    const body = options.body === undefined ? undefined : JSON.parse(options.body);
    requests.push({ url, method: options.method || 'GET', body });
    if (url === '/api/state') return { ok: true, json: async () => structuredClone(state) };
    if (url === '/api/settings') { Object.assign(state.settings, body); return { ok: true, json: async () => ({ settings: structuredClone(state.settings) }) }; }
    if (knowledge && new URL(url, window.location.href).pathname === '/api/memory') return { ok: true, json: async () => structuredClone(await memory) };
    throw new Error(`Unexpected request: ${url}`);
  };
  if (knowledge) window.eval(knowledgeScript);
  window.eval(shellScript); window.eval(appScript); await settle();
  const input = document.querySelector('[data-terminal-command]'), prompt = document.querySelector('#dispatch-prompt');
  const command = text => { input.value = text; document.querySelector('.terminal-commandbar').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); };
  return { window, document, requests, errors, input, prompt, command };
}

test('the actual app preserves an existing operation draft and prepares an empty one without submitting work', async t => {
  const f = await fixture(t);
  f.prompt.value = 'Original unsent operation';
  f.command('TASK Different proposed instructions');
  assert.equal(f.prompt.value, 'Original unsent operation');
  assert.equal(f.input.value, 'TASK Different proposed instructions');
  assert.match(f.document.querySelector('.terminal-command-message').textContent, /existing operation draft was kept/);
  f.prompt.value = '';
  f.command('TASK Review <script> as literal text');
  assert.equal(f.prompt.value, 'Review <script> as literal text');
  assert.equal(f.document.activeElement, f.prompt);
  assert.equal(f.document.querySelector('.app-shell').dataset.view, 'operations');
  assert.equal(f.document.querySelector('#prompt-count').textContent, `${f.prompt.value.length} / 12,000`);
  assert.ok(!f.requests.some(request => /^\/api\/(?:tasks|terminal)(?:\/|$)/.test(request.url)));
  assert.deepEqual(f.errors, []);
});

test('integrated language and connection renders retain command focus and modal dialogs block the global focus shortcut', async t => {
  const f = await fixture(t);
  f.input.value = 'unfinished TASK draft'; f.input.focus();
  const select = f.document.querySelector('#language-select');
  select.value = 'ja'; select.dispatchEvent(new f.window.Event('change', { bubbles: true })); await settle();
  assert.equal(f.document.querySelector('[data-terminal-command]'), f.input);
  assert.equal(f.document.activeElement, f.input);
  assert.equal(f.input.value, 'unfinished TASK draft');
  assert.equal(f.input.getAttribute('aria-label'), 'ターミナル機能コマンド');
  const dialog = f.document.querySelector('#settings-dialog'); dialog.showModal();
  const modalInput = f.document.querySelector('#settings-workspace'); modalInput.focus();
  modalInput.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  assert.equal(f.document.activeElement, modalInput);
  dialog.close();
  f.document.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  assert.equal(f.document.activeElement, f.input);
  assert.deepEqual(f.errors, []);
});

test('the first FIND mounts real knowledge synchronously, retains its query after loading, and real F5/F11 shortcuts prevent browser defaults', async t => {
  let releaseMemory;
  const memory = new Promise(resolve => { releaseMemory = resolve; });
  const f = await fixture(t, { knowledge: true, memory });
  assert.equal(f.document.querySelector('.app-shell').dataset.view, 'overview');
  assert.equal(f.document.querySelector('#knowledge-section input[type="search"]'), null);
  f.command('FIND golden query');
  const search = f.document.querySelector('#knowledge-section input[type="search"]');
  assert.ok(search);
  assert.equal(f.document.querySelector('.app-shell').dataset.view, 'knowledge');
  assert.equal(search.value, 'golden query');
  assert.equal(f.document.activeElement, search);
  const request = f.requests.find(request => new URL(request.url, f.window.location.href).pathname === '/api/memory');
  assert.ok(request); assert.equal(request.method, 'GET');
  assert.equal(new URL(request.url, f.window.location.href).searchParams.get('workspace'), 'C:\\Projects\\Alpha');
  const node = (id, title) => ({ id, title, content: 'Project reference.', kind: 'note', tags: [], confidence: 'user', source: 'user', revision: 1, updatedAt: '2026-11-18T00:00:00.000Z' });
  releaseMemory({ nodes: [node('match', 'Golden query reference'), node('other', 'Unrelated record')], edges: [], history: [], stats: {} });
  await settle();
  assert.equal(search.value, 'golden query');
  assert.match(f.document.querySelector('.ik-results-list').textContent, /Golden query reference/);
  assert.doesNotMatch(f.document.querySelector('.ik-results-list').textContent, /Unrelated record/);
  for (const [key, view] of [['F5', 'accounts'], ['F11', 'knowledge']]) {
    const event = new f.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    f.document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, `${key} prevents its browser default`);
    assert.equal(f.document.querySelector('.app-shell').dataset.view, view);
  }
  assert.equal(f.document.querySelector('#knowledge-section input[type="search"]').value, 'golden query');
  assert.ok(!f.requests.some(request => /^\/api\/(?:tasks|terminal)(?:\/|$)/.test(request.url)));
  assert.deepEqual(f.errors, []);
});
