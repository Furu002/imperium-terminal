import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const script = await readFile(new URL('../public/terminal-shell.js', import.meta.url), 'utf8');
function fixture(t) {
  const dom = new JSDOM('<html lang="en"><body><div class="app-shell"><header class="topbar"></header></div></body></html>', { runScripts: 'outside-only' });
  const { window } = dom, document = window.document, navigated = [], prepared = [], searches = [];
  window.eval(script);
  window.addEventListener('imperium:knowledge-search', event => searches.push(event.detail.query));
  const state = { settings: { workspace: 'C:\\Projects\\Alpha' }, tasks: [{ status: 'running' }, { status: 'queued' }, { status: 'running', demo: true }] };
  const callbacks = { connected: true, language: 'en', onNavigate: value => navigated.push(value), onPrepareTask: value => prepared.push(value) };
  window.ImperiumTerminalShell.render(state, callbacks);
  const input = document.querySelector('[data-terminal-command]');
  const command = text => { input.value = text; document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); };
  t.after(() => window.close());
  return { window, document, state, callbacks, input, command, navigated, prepared, searches };
}

test('terminal functions navigate and prepare commands without running AI or a shell', t => {
  const f = fixture(t);
  f.command('memory'); f.command('F6'); f.command('TASK Review "<script>" safely'); f.command('FIND project decisions');
  assert.deepEqual(f.navigated, ['knowledge', 'terminal', 'operations', 'knowledge']);
  assert.deepEqual(f.prepared, ['Review "<script>" safely']); assert.deepEqual(f.searches, ['project decisions']);
  f.command('rm -rf /'); assert.match(f.document.querySelector('[role=status]').textContent, /Unknown function/);
  assert.equal(f.input.value, 'rm -rf /'); assert.equal(f.navigated.length, 4);
  assert.equal(f.document.querySelectorAll('script').length, 0);
});

test('help and bounded input history remain keyboard accessible', t => {
  const f = fixture(t);
  f.command('NODES'); f.command('HELP'); assert.equal(f.document.querySelector('.terminal-command-help').hidden, false);
  f.input.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.equal(f.document.querySelector('.terminal-command-help').hidden, true);
  f.input.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); assert.equal(f.input.value, 'HELP');
  f.input.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); assert.equal(f.input.value, 'NODES');
  f.document.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); assert.equal(f.document.activeElement, f.input);
});

test('a blocked task replacement retains the new command and does not claim that an existing draft was replaced', t => {
  const f = fixture(t);
  f.window.ImperiumTerminalShell.render(f.state, { ...f.callbacks, onPrepareTask: () => false });
  f.command('TASK replacement instructions');
  assert.equal(f.input.value, 'TASK replacement instructions');
  assert.match(f.document.querySelector('[role=status]').textContent, /existing operation draft was kept/);
  assert.deepEqual(f.prepared, []);
});

test('status uses actual non-demo task counts and follows local-only and connection state', t => {
  const f = fixture(t), status = f.document.querySelector('.terminal-session-status');
  assert.match(status.textContent, /CONNECTED · RUN 1 · QUEUE 1/);
  f.state.settings.localOnly = true; f.window.ImperiumTerminalShell.render(f.state, f.callbacks); assert.match(status.textContent, /LOCAL ONLY/);
  f.window.ImperiumTerminalShell.render(f.state, { ...f.callbacks, connected: false }); assert.match(status.textContent, /DISCONNECTED/);
  assert.equal(status.dataset.state, 'offline'); assert.equal(f.document.querySelector('.terminal-project-name').textContent, 'PROJECT / Alpha');
});

test('render updates language and current view without replacing the command draft or duplicating controls', t => {
  const f = fixture(t); f.input.value = 'unfinished';
  f.window.ImperiumTerminalShell.render(f.state, { ...f.callbacks, language: 'ja', view: 'knowledge' });
  assert.equal(f.input.value, 'unfinished'); assert.equal(f.input.getAttribute('aria-label'), 'ターミナル機能コマンド');
  assert.equal(f.document.querySelectorAll('.terminal-shell').length, 1);
  assert.equal(f.document.querySelector('.terminal-tabs [aria-current=page]').textContent, 'MEMORY');
  f.window.ImperiumTerminalShell.render(f.state, { ...f.callbacks, language: 'ko' }); assert.equal(f.input.getAttribute('aria-label'), '터미널 기능 명령');
});
