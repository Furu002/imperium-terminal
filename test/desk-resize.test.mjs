import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const script = await readFile(new URL('../public/desk-resize.js', import.meta.url), 'utf8');
const key = 'imperium.desk.operation-controls-width';

async function fixture(t, { saved, view = 'operations', width = 1280, deskWidth = 1220 } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><main class="app-shell" data-view="${view}">
    <div class="workspace-grid"><div id="operation-controls-column"></div>
      <div class="secondary-column"><section id="inspector-section"></section></div>
    </div>
  </main></html>`, { url: 'http://localhost:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const grid = document.querySelector('.workspace-grid');
  Object.defineProperty(grid, 'clientWidth', { get: () => deskWidth });
  window.innerWidth = width;
  if (saved !== undefined) window.localStorage.setItem(key, saved);
  window.eval(script);
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  const divider = grid.querySelector('.desk-pane-divider');
  const value = () => Number(divider.getAttribute('aria-valuenow'));
  const press = (key, extra = {}) => divider.dispatchEvent(new window.KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...extra }));
  const pointer = (target, type, clientX, pointerId = 3) => {
    const event = new window.MouseEvent(type, { clientX, button: 0, cancelable: true, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    target.dispatchEvent(event);
  };
  const resize = (outer, content) => {
    deskWidth = content;
    window.innerWidth = outer;
    window.dispatchEvent(new window.Event('resize'));
  };
  return { window, document, grid, divider, value, press, pointer, resize };
}

test('the desktop splitter restores a saved width, offers keyboard bounds, and resets to adaptive layout', async t => {
  const f = await fixture(t, { saved: '525' });
  assert.equal(f.divider.getAttribute('role'), 'separator');
  assert.equal(f.divider.getAttribute('aria-controls'), 'operation-controls-column');
  assert.equal(f.value(), 525);
  f.press('ArrowRight', { shiftKey: true });
  assert.equal(f.value(), 589);
  assert.equal(f.window.localStorage.getItem(key), '589');
  f.press('End');
  assert.equal(f.value(), Number(f.divider.getAttribute('aria-valuemax')));
  f.press('ArrowRight');
  assert.equal(f.value(), 820);
  f.press('Home');
  assert.equal(f.value(), Number(f.divider.getAttribute('aria-valuemin')));
  f.press('Enter');
  assert.equal(f.window.localStorage.getItem(key), null);
  assert.equal(f.value(), 430);
  f.resize(1800, 1760);
  assert.ok(f.value() > 430);
});

test('pointer drag updates the adjoining pane, ignores other pointers, and remembers only completed adjustments', async t => {
  const f = await fixture(t);
  const original = f.value();
  f.pointer(f.divider, 'pointerdown', 430);
  f.pointer(f.window, 'pointermove', 480, 2);
  assert.equal(f.value(), original);
  f.pointer(f.window, 'pointermove', 520);
  assert.equal(f.value(), original + 90);
  assert.equal(f.window.localStorage.getItem(key), null);
  f.pointer(f.window, 'pointerup', 520);
  assert.equal(f.window.localStorage.getItem(key), String(original + 90));
  f.pointer(f.divider, 'pointerdown', 520);
  f.pointer(f.window, 'pointermove', 200);
  assert.ok(f.value() < original);
  f.pointer(f.window, 'pointercancel', 200);
  assert.equal(f.value(), original + 90);
  assert.equal(f.grid.hasAttribute('data-desk-resizing'), false);
  f.divider.dispatchEvent(new f.window.MouseEvent('dblclick', { bubbles: true }));
  assert.equal(f.value(), original);
  assert.equal(f.window.localStorage.getItem(key), null);
});

test('narrow and inactive views retain their normal layout and restore the saved width on return', async t => {
  const f = await fixture(t, { saved: '700', width: 900, deskWidth: 876 });
  assert.equal(f.divider.hidden, true);
  assert.equal(f.grid.hasAttribute('data-desk-split'), false);
  f.resize(1050, 1026);
  assert.equal(f.divider.hidden, false);
  assert.equal(f.value(), 626);
  assert.equal(f.window.localStorage.getItem(key), '700');
  f.resize(1280, 1220);
  assert.equal(f.value(), 700);
  f.document.querySelector('.app-shell').dataset.view = 'logs';
  await Promise.resolve();
  assert.equal(f.divider.hidden, true);
  assert.equal(f.grid.hasAttribute('data-desk-split'), false);
  assert.equal(f.grid.style.getPropertyValue('--desk-task-pane-width'), '');
});
