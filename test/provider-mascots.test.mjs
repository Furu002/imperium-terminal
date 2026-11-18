import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = readFileSync(new URL('../public/provider-mascots.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/provider-mascots.css', import.meta.url), 'utf8');
const workspace = 'C:\\Projects\\Imperium';
const connection = (providerId, extra = {}) => ({ id: `account-${providerId}`, providerId, label: `My ${providerId}`, modelId: 'configured-model', ...extra });
const task = (id, provider, extra = {}) => ({ id, provider, workspace, modelId: 'actual-model', status: 'running', ...extra });
function fixture(t, change = {}) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html><head></head><body><div class="app-shell"><header class="topbar"></header><section class="terminal-shell"></section><aside class="sidebar"></aside><main></main><footer class="statusbar"></footer></div></body></html>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310', virtualConsole });
  dom.window.fetch = () => { throw new Error('Activity avatars must not make network requests'); };
  dom.window.eval(script);
  const state = { settings: { workspace, language: 'en' }, connections: [connection('codex')], providers: [{ id: 'codex', status: 'ready' }], tasks: [], ...change };
  const render = options => dom.window.ImperiumMascots.render(state, options);
  const item = id => [...dom.window.document.querySelectorAll('.im-model-avatar')].find(node => node.dataset.provider === id);
  render(); t.after(() => dom.window.close());
  return { window: dom.window, document: dom.window.document, state, errors, render, item };
}

test('only registered providers receive original SVG avatars; identity, departments and detected tools do not imply activity', t => {
  const ui = fixture(t, { connections: [], providers: [{ id: 'claude', status: 'ready' }], departments: [{ id: 'engineering', provider: 'claude' }], tasks: [task('real', 'claude')], settings: { workspace, identity: { name: 'CEO' } } });
  assert.equal(ui.document.querySelectorAll('.im-model-avatar').length, 0);
  assert.equal(ui.document.querySelector('.im-model-activity').hidden, true);
  assert.equal(ui.document.querySelector('.app-shell').classList.contains('im-has-model-activity'), false);
  ui.state.connections = [connection('claude')]; ui.render({ language: 'en' });
  assert.equal(ui.item('claude').dataset.status, 'running');
  assert.equal(ui.document.querySelectorAll('.im-model-avatar').length, 1);
  assert.equal(ui.document.querySelectorAll('[data-provider="CEO"]').length, 0);
  assert.equal(ui.document.querySelector('.terminal-shell').nextElementSibling.className, 'im-model-activity');
  assert.deepEqual(ui.errors, []);
});

test('working and queued counts come only from real tasks in the exact current project', t => {
  const ui = fixture(t, { tasks: [
    task('current', 'codex'), task('same-windows-path', 'codex', { workspace: 'c:/projects/imperium/' }),
    task('queued', 'codex', { status: 'queued' }), task('demo', 'codex', { demo: true }),
    task('other', 'codex', { workspace: `${workspace}-other` }), task('missing-workspace', 'codex', { workspace: undefined }),
    task('finished', 'codex', { status: 'completed' }), task('other-provider', 'claude'),
  ] });
  assert.equal(ui.item('codex').dataset.status, 'running');
  assert.match(ui.item('codex').textContent, /Working 2 · Queued 1/);
  assert.match(ui.item('codex').title, /Requested models: actual-model/);
  ui.state.tasks = [task('queued', 'codex', { status: 'queued' })]; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'queued');
  assert.match(ui.item('codex').textContent, /Queued 1/);
  ui.state.tasks = [task('failed', 'codex', { status: 'failed' })]; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'idle', 'historical failures do not imply a current connection error');
  ui.state.tasks = [task('demo', 'codex', { demo: true })]; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'idle');
});

test('project switching and case-sensitive local paths never leak another project’s activity', t => {
  const ui = fixture(t, { tasks: [task('a', 'codex')] });
  ui.state.settings.workspace = 'C:\\Projects\\Another'; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'idle');
  ui.state.settings.workspace = '/Users/me/Project'; ui.state.tasks = [task('b', 'codex', { workspace: '/Users/me/project' })]; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'idle');
  ui.state.tasks[0].workspace = '/Users/me/Project/'; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'running');
  ui.state.settings.workspace = ''; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'idle');
});

test('idle, sign-in, install, offline, error and unknown states stay distinct without inventing work', t => {
  const statuses = { codex: 'ready', claude: 'login_required', gemini: 'missing', copilot: 'error', ollama: 'offline', custom: 'unknown' };
  const ui = fixture(t, { connections: Object.keys(statuses).map(id => connection(id)), providers: Object.entries(statuses).map(([id, status]) => ({ id, status })) });
  for (const [id, expected] of Object.entries({ codex: 'idle', claude: 'auth', gemini: 'missing', copilot: 'error', ollama: 'offline', custom: 'unknown' })) assert.equal(ui.item(id).dataset.status, expected);
  assert.equal(ui.document.querySelectorAll('svg').length, 6);
  const designs = new Set([...ui.document.querySelectorAll('svg')].map(picture => picture.dataset.avatar));
  assert.equal(designs.size, 6);
  assert.ok([...ui.document.querySelectorAll('svg')].every(picture => picture.namespaceURI === 'http://www.w3.org/2000/svg' && picture.getAttribute('aria-hidden') === 'true'));
  assert.equal(ui.document.querySelectorAll('img,image,script,iframe,button').length, 0);
  assert.deepEqual(ui.errors, []);
});

test('local-only mode disables cloud avatars despite stale running tasks and allows verified local providers', t => {
  const ui = fixture(t, { settings: { workspace, localOnly: true }, connections: [connection('codex'), connection('ollama'), connection('custom-local')], providers: [{ id: 'codex', status: 'ready' }, { id: 'ollama', status: 'ready', kind: 'local' }, { id: 'custom-local', status: 'ready', kind: 'local' }], tasks: [task('cloud', 'codex'), task('local', 'ollama'), task('custom', 'custom-local')] });
  ui.render({ language: 'en' });
  assert.equal(ui.item('codex').dataset.status, 'disabled');
  assert.match(ui.item('codex').textContent, /Disabled · local only/);
  assert.equal(ui.item('ollama').dataset.status, 'running');
  assert.equal(ui.item('custom-local').dataset.status, 'running');
  assert.match(ui.item('ollama').getAttribute('aria-label'), /Local/);
  ui.state.settings.localOnly = false; ui.render();
  assert.equal(ui.item('codex').dataset.status, 'running');
});

test('multiple connections share one provider avatar and repeated telemetry preserves its SVG and DOM', t => {
  const ui = fixture(t, { connections: [connection('codex'), connection('codex', { id: 'second', label: '<img src=x onerror=alert(1)>', modelId: 'other-model' })], tasks: [task('one', 'codex')] });
  const node = ui.item('codex'), picture = node.querySelector('svg'), children = [...node.childNodes];
  assert.equal(ui.document.querySelectorAll('.im-model-avatar').length, 1);
  assert.match(node.title, /other-model/);
  assert.match(node.title, /<img src=x onerror=alert\(1\)>/);
  for (let index = 0; index < 5; index++) { ui.state.tasks[0].progress = index * 20; ui.render(); }
  assert.equal(ui.item('codex'), node); assert.equal(node.querySelector('svg'), picture); assert.deepEqual([...node.childNodes], children);
  assert.equal(ui.document.querySelector('img'), null);
  ui.state.tasks[0].status = 'completed'; ui.render();
  assert.equal(ui.item('codex'), node); assert.equal(node.querySelector('svg'), picture); assert.equal(node.dataset.status, 'idle');
  ui.state.connections = []; ui.render(); assert.equal(ui.document.querySelectorAll('.im-model-avatar').length, 0);
  assert.equal(ui.document.querySelector('.im-model-activity').hidden, true);
});

test('tooltips and read-only accessible status labels support Korean, English and Japanese without replacing avatars', t => {
  const ui = fixture(t, { tasks: [task('one', 'codex')] }), node = ui.item('codex'), picture = node.querySelector('svg');
  for (const [language, expected, heading] of [['ko', /작업 중 1/, /모델 활동/], ['en', /Working 1/, /MODEL ACTIVITY/], ['ja', /作業中 1/, /モデル稼働/]]) {
    ui.render({ language }); assert.match(node.title, expected); assert.match(node.getAttribute('aria-label'), expected);
    assert.match(ui.document.querySelector('.im-model-heading').textContent, heading); assert.equal(node.querySelector('svg'), picture);
  }
  assert.equal(ui.document.querySelector('.im-model-activity').getAttribute('role'), 'region');
  assert.equal(node.hasAttribute('tabindex'), false);
});

test('hidden documents pause activity animation and reduced-motion rules disable it without changing real status', t => {
  const ui = fixture(t, { tasks: [task('one', 'codex')] }), strip = ui.document.querySelector('.im-model-activity');
  Object.defineProperty(ui.document, 'hidden', { configurable: true, value: false }); ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
  assert.equal(strip.dataset.paused, 'false');
  Object.defineProperty(ui.document, 'hidden', { configurable: true, value: true }); ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
  assert.equal(strip.dataset.paused, 'true'); assert.equal(ui.item('codex').dataset.status, 'running');
  assert.match(css, /data-status=running\] \.im-avatar-motion[^}]+animation:/);
  assert.match(css, /data-paused=true[^}]+animation-play-state:paused!important/);
  assert.match(css, /prefers-reduced-motion:reduce[^]+animation:none!important/);
  const style = ui.document.createElement('style'); style.textContent = css; ui.document.head.append(style);
  assert.ok(style.sheet.cssRules.length); assert.deepEqual(ui.errors, []);
});
