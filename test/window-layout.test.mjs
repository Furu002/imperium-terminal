import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const { windowBounds } = createRequire(import.meta.url)('../desktop/window-layout.cjs');

test('startup bounds and minimum sizes stay inside common work areas, including small scaled and secondary displays', () => {
  for (const area of [
    { x: 0, y: 0, width: 1366, height: 728 }, { x: 0, y: 0, width: 1920, height: 1040 },
    { x: 0, y: 0, width: 2560, height: 1400 }, { x: 0, y: 0, width: 900, height: 700 },
    { x: 0, y: 0, width: 1280, height: 680 }, { x: 0, y: 0, width: 800, height: 540 },
    { x: -1920, y: -120, width: 1920, height: 1040 }, { x: 2560, y: 0, width: 1280, height: 720 },
  ]) {
    const bounds = windowBounds(area);
    assert.ok(bounds.x >= area.x && bounds.y >= area.y);
    assert.ok(bounds.x + bounds.width <= area.x + area.width && bounds.y + bounds.height <= area.y + area.height);
    assert.ok(bounds.minWidth <= bounds.width && bounds.minHeight <= bounds.height);
    assert.ok(bounds.width < area.width && bounds.height < area.height);
  }
});

test('work areas are used directly without multiplying by the physical display scale', () => {
  const area = { x: 0, y: 0, width: 1280, height: 680 };
  assert.deepEqual(windowBounds({ ...area, scaleFactor: 2 }), windowBounds({ ...area, scaleFactor: 1.25 }));
  const bounds = windowBounds(area);
  assert.equal(bounds.width, 1240); assert.equal(bounds.height, 654); assert.equal(bounds.minWidth, 900); assert.equal(bounds.minHeight, 600);
});
