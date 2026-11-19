import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../public/output-view.js', import.meta.url), 'utf8');
const task = (extra = {}) => ({ id: 'task-a', workspace: 'C:\\Project A', title: 'Implementation result', prompt: 'Implement a small feature', output: 'A real response.\n\n```js\nconst result = 42;\n```', status: 'running', provider: 'codex', modelId: 'requested-model', reportedModel: 'observed-model', logs: [], ...extra });
const settle = () => new Promise(resolve => setTimeout(resolve, 25));
function fixture(t) {
  const dom = new JSDOM('<!doctype html><html><body><button id="origin">Open output</button><textarea id="background">Unsent user draft</textarea><div id="panel"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://127.0.0.1:4310/' });
  const { window } = dom, writes = []; let modalCalls = 0;
  window.HTMLDialogElement.prototype.show = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.showModal = function () { modalCalls++; this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  Object.defineProperty(window, 'innerWidth', { value: 1260, writable: true, configurable: true }); Object.defineProperty(window, 'innerHeight', { value: 714, writable: true, configurable: true });
  const observers = [];
  window.ResizeObserver = class { constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); } observe() {} unobserve() {} disconnect() { this.disconnected = true; } };
  window.eval(script);
  const view = window.ImperiumOutput.create({ onCopy: async value => { writes.push(value); return true; } }); window.document.querySelector('#panel').append(view.element);
  view.update({ task: task(), language: 'en', provider: 'ChatGPT / Codex' });
  t.after(() => { view.destroy(); dom.window.close(); });
  return { dom, window, document: window.document, view, writes, observers, get modalCalls() { return modalCalls; }, update(value, language = 'en') { view.update({ task: value, language, provider: 'ChatGPT / Codex' }); }, dialog() { return window.document.querySelector('.io-dialog'); }, key(key) { window.document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); } };
}
const bounds = dialog => Object.fromEntries(['left', 'top', 'width', 'height'].map(key => [key, Number.parseFloat(dialog.style.getPropertyValue(`--io-window-${key}`))]));
function assertInside(rect, width, height) { for (const value of Object.values(rect)) assert.ok(Number.isFinite(value), 'window bounds must be finite'); assert.ok(rect.left >= 0); assert.ok(rect.top >= 0); assert.ok(rect.width > 0 && rect.width <= width); assert.ok(rect.height > 0 && rect.height <= height); assert.ok(rect.left + rect.width <= width + 1); assert.ok(rect.top + rect.height <= height + 1); }

test('floating output is nonmodal, retains a stable panel host and does not reopen on ordinary updates', t => {
  const ui = fixture(t), host = ui.view.element, reader = host.querySelector('.io-conversation');
  assert.equal(host.classList.contains('io-output-host'), true); assert.equal(ui.view.getDisplayMode(), 'panel');
  ui.document.querySelector('#origin').focus(); ui.view.openWindow();
  assert.equal(ui.view.getDisplayMode(), 'window'); assert.equal(ui.dialog().dataset.mode, 'window'); assert.equal(ui.modalCalls, 0);
  assert.equal(ui.document.querySelector('#panel').contains(host), true); assert.equal(ui.dialog().contains(reader), true); assert.notEqual(ui.dialog().getAttribute('aria-modal'), 'true');
  ui.view.openWindow(); assert.equal(ui.document.querySelectorAll('.io-dialog').length, 1);
  ui.document.querySelector('#background').focus(); assert.equal(ui.document.activeElement.id, 'background');
  ui.update(task({ output: 'An actual streamed update.' })); assert.equal(ui.view.getDisplayMode(), 'window'); assert.equal(ui.document.activeElement.id, 'background');
  ui.view.dock(); assert.equal(ui.view.getDisplayMode(), 'panel'); assert.equal(ui.dialog(), null); assert.equal(host.contains(reader), true);
  ui.update(task({ status: 'completed' })); assert.equal(ui.dialog(), null, 'streaming never implicitly opens a window');
});

test('panel, floating and fullscreen keep the same reader, raw chunks, expanded details and font preference', async t => {
  const ui = fixture(t), output = 'Exact output line 한글🙂\n'.repeat(5000); ui.update(task({ output }));
  const reader = ui.view.element.querySelector('.io-conversation');
  reader.querySelectorAll('.io-mode')[1].click(); reader.querySelector('.io-raw-view .io-load-more').click();
  const raw = reader.querySelector('.io-raw'), rawText = raw.textContent, details = reader.querySelector('.io-task-details'); details.open = true;
  reader.querySelector('.io-font-up').click(); const font = reader.style.getPropertyValue('--io-body-size'); raw.scrollTop = 91;
  ui.view.openWindow(); ui.view.openFull();
  assert.equal(ui.view.getDisplayMode(), 'fullscreen'); assert.equal(ui.dialog().dataset.mode, 'fullscreen'); assert.equal(ui.dialog().querySelector('.io-conversation'), reader);
  assert.equal(raw.textContent, rawText); assert.equal(raw.scrollTop, 91); assert.equal(details.open, true); assert.equal(reader.style.getPropertyValue('--io-body-size'), font); assert.equal(reader.querySelector('.io-raw-view').hidden, false);
  ui.dialog().querySelector('.io-window-restore').click(); assert.equal(ui.view.getDisplayMode(), 'window');
  ui.dialog().querySelector('.io-window-dock').click(); assert.equal(ui.view.getDisplayMode(), 'panel'); assert.equal(ui.view.element.contains(reader), true); assert.equal(details.open, true);
  ui.view.openWindow(); reader.querySelector('.io-answer-copy').click(); await settle(); assert.equal(ui.writes.at(-1), output);
});

test('window bounds clamp to resized viewports and fullscreen restores the previous floating rectangle', async t => {
  const ui = fixture(t); ui.view.openWindow(); assertInside(bounds(ui.dialog()), 1260, 714);
  const before = bounds(ui.dialog()); ui.view.openFull(); ui.dialog().querySelector('.io-window-restore').click(); assert.deepEqual(bounds(ui.dialog()), before);
  ui.window.innerWidth = 480; ui.window.innerHeight = 320; ui.window.dispatchEvent(new ui.window.Event('resize')); await settle(); assertInside(bounds(ui.dialog()), 480, 320);
  ui.view.openFull(); ui.window.innerWidth = 360; ui.window.innerHeight = 240; ui.window.dispatchEvent(new ui.window.Event('resize')); await settle(); ui.dialog().querySelector('.io-window-restore').click(); assertInside(bounds(ui.dialog()), 360, 240);
});

test('title dragging changes only floating geometry and stops at pointer release or on header buttons', async t => {
  const ui = fixture(t); ui.window.innerWidth = 2000; ui.window.innerHeight = 1200; ui.view.openWindow();
  const heading = ui.dialog().querySelector('.io-dialog-heading'), before = bounds(ui.dialog());
  const pointer = (target, type, x, y) => { const event = new ui.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event); };
  pointer(heading, 'pointerdown', 100, 100); pointer(ui.document, 'pointermove', 130, 140); pointer(ui.document, 'pointerup', 130, 140); await settle();
  const moved = bounds(ui.dialog()); assert.notDeepEqual(moved, before); assertInside(moved, 2000, 1200);
  pointer(ui.document, 'pointermove', 500, 600); await settle(); assert.deepEqual(bounds(ui.dialog()), moved);
  pointer(heading.querySelector('button'), 'pointerdown', 100, 100); pointer(ui.document, 'pointermove', 150, 160); pointer(ui.document, 'pointerup', 150, 160); await settle(); assert.deepEqual(bounds(ui.dialog()), moved);
});

test('streamed output and translated controls update inside the open window while original copy stays exact', async t => {
  const ui = fixture(t); ui.view.openWindow(); const windowNode = ui.dialog();
  windowNode.querySelectorAll('.io-mode')[1].click(); const output = 'First real response.\nSecond streamed line <script>untrusted()</script>\n';
  ui.update(task({ output, status: 'completed', reportedModel: 'actually-reported-model', logs: [{ id: 'log', type: 'tool', text: 'Read completed' }] }), 'ja');
  assert.equal(ui.dialog(), windowNode); assert.equal(ui.view.getDisplayMode(), 'window'); assert.equal(windowNode.querySelector('.io-raw-view').hidden, false); assert.equal(windowNode.querySelector('.io-raw').textContent, output);
  assert.match(windowNode.querySelector('.io-model-label').textContent, /actually-reported-model/); assert.equal(windowNode.querySelector('script'), null);
  windowNode.querySelector('.io-answer-copy').click(); await settle(); assert.equal(ui.writes.at(-1), output); assert.equal(ui.document.querySelector('#background').value, 'Unsent user draft');
});

test('Escape affects only the focused top output window, stepping fullscreen to floating to panel', t => {
  const ui = fixture(t); ui.view.openWindow();
  const other = ui.window.ImperiumOutput.create(); ui.document.querySelector('#panel').append(other.element); other.update({ task: task({ id: 'task-b', title: 'Second task' }), language: 'en' });
  t.after(() => other.destroy()); other.openFull();
  const top = [...ui.document.querySelectorAll('.io-dialog')].at(-1); top.querySelector('.io-dialog-close').focus(); ui.key('Escape');
  assert.equal(other.getDisplayMode(), 'window'); assert.equal(ui.view.getDisplayMode(), 'window');
  top.querySelector('.io-dialog-close').focus(); ui.key('Escape'); assert.equal(other.getDisplayMode(), 'panel'); assert.equal(ui.view.getDisplayMode(), 'window'); assert.equal(ui.document.querySelectorAll('.io-dialog').length, 1);
});

test('an unrelated settings modal owns focus and Escape while output streams in the background', t => {
  const ui = fixture(t); ui.view.openFull();
  const modal = ui.document.createElement('dialog'), input = ui.document.createElement('input'); modal.append(input); ui.document.body.append(modal); modal.showModal(); input.focus();
  ui.update(task({ output: 'Background stream continues' })); ui.key('Escape');
  assert.equal(ui.view.getDisplayMode(), 'fullscreen'); assert.equal(ui.document.activeElement, input); assert.equal(modal.open, true);
});

test('two consecutive Escape keys restore fullscreen and dock the focused window without a focus reset', t => {
  const ui=fixture(t);ui.view.openFull();ui.key('Escape');assert.equal(ui.view.getDisplayMode(),'window');ui.key('Escape');assert.equal(ui.view.getDisplayMode(),'panel');
});

test('fullscreen makes covered app controls inert and preserves this until the last fullscreen reader closes', t => {
  const ui=fixture(t),app=ui.document.querySelector('#panel');app.classList.add('app-shell');ui.view.openFull();assert.equal(app.inert,true);
  const other=ui.window.ImperiumOutput.create();app.append(other.element);other.update({task:task({id:'other'}),language:'en'});other.openFull();
  ui.view.dock();assert.equal(app.inert,true);other.destroy();assert.equal(app.inert,false);
});

test('temporary compact CSS geometry does not replace the preferred desktop rectangle', t => {
  const ui=fixture(t);ui.view.openWindow();const desktop=bounds(ui.dialog());ui.window.innerWidth=390;ui.window.innerHeight=700;ui.window.dispatchEvent(new ui.window.Event('resize'));
  ui.observers[0].callback([{borderBoxSize:[{inlineSize:390,blockSize:700}]}]);ui.window.innerWidth=1260;ui.window.innerHeight=714;ui.window.dispatchEvent(new ui.window.Event('resize'));
  assert.deepEqual(bounds(ui.dialog()),desktop);
});

test('docking and reopening retain the reader scroll offset and text size', t => {
  const ui=fixture(t),reader=ui.view.element.querySelector('.io-conversation');reader.style.overflowY='auto';reader.scrollTop=125;
  const size=reader.style.getPropertyValue('--io-body-size');ui.view.openWindow();const body=ui.dialog().querySelector('.io-dialog-body');assert.equal(body.scrollTop,125);assert.equal(reader.style.getPropertyValue('--io-body-size'),size);
  body.scrollTop=260;ui.view.dock();assert.equal(reader.scrollTop,260);ui.view.openFull();assert.equal(ui.dialog().querySelector('.io-dialog-body').scrollTop,260);assert.equal(reader.style.getPropertyValue('--io-body-size'),size);
});

test('updating another output window never steals focus from the foreground window action', t => {
  const ui = fixture(t); ui.view.openWindow();
  const other = ui.window.ImperiumOutput.create(); ui.document.querySelector('#panel').append(other.element); other.update({ task: task({ id: 'task-b', title: 'Foreground task' }), language: 'en' }); other.openWindow();
  t.after(() => other.destroy()); const foreground = [...ui.document.querySelectorAll('.io-dialog')].at(-1), focused = foreground.querySelector('.io-window-dock'); focused.focus();
  ui.update(task({ title: 'Updated background task', output: 'New background output' }), 'ja');
  assert.equal(ui.document.activeElement, focused); assert.equal(other.getDisplayMode(), 'window');
});

test('stream updates preserve paragraph selections without moving their start to a preceding heading', t => {
  const ui = fixture(t); ui.update(task({ output: '# Heading\n\nSelected paragraph text.' })); ui.view.openWindow();
  const paragraph=ui.document.querySelector('.io-dialog .io-markdown p').firstChild, range=ui.document.createRange(); range.setStart(paragraph,0);range.setEnd(paragraph,8);
  ui.window.getSelection().removeAllRanges();ui.window.getSelection().addRange(range);
  ui.update(task({ output: '# Heading\n\nSelected paragraph text.\n\nMore output.' }));
  const restored=ui.window.getSelection().getRangeAt(0);
  assert.equal(restored.startContainer,ui.document.querySelector('.io-dialog .io-markdown p').firstChild);assert.equal(restored.startOffset,0);assert.equal(ui.window.getSelection().toString(),'Selected');
});

test('closing or destroying an output leaves no orphan window or stale response under a replacement project', async t => {
  const ui = fixture(t); ui.document.querySelector('#origin').focus(); ui.view.openWindow(); ui.dialog().querySelector('.io-dialog-close').click();
  assert.equal(ui.view.getDisplayMode(), 'panel'); assert.equal(ui.dialog(), null);
  ui.view.openWindow(); const oldNode = ui.dialog(); ui.view.destroy();
  assert.equal(oldNode.isConnected, false); assert.equal(ui.document.querySelector('.io-dialog'), null);
  ui.window.innerWidth = 400; ui.window.dispatchEvent(new ui.window.Event('resize')); ui.window.dispatchEvent(new ui.window.MouseEvent('pointermove', { clientX: 300, clientY: 200 })); await settle(); assert.equal(ui.document.querySelector('.io-dialog'), null);
  const replacement = ui.window.ImperiumOutput.create(); ui.document.querySelector('#panel').append(replacement.element); replacement.update({ task: task({ id: 'other', workspace: 'C:\\Other', output: 'Only project B output' }), language: 'en' }); t.after(() => replacement.destroy());
  assert.doesNotMatch(ui.document.querySelector('#panel').textContent, /const result = 42/); assert.match(ui.document.querySelector('#panel').textContent, /Only project B output/);
});
