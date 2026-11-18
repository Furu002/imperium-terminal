import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { summarizeAnalytics } from '../lib/analytics.mjs';

const adapter = readFileSync(new URL('../public/analytics-charts.js', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/analytics.js', import.meta.url), 'utf8');
const workspace = path.resolve('chart-project');
const job = (id, extra = {}) => ({ id, workspace, title: `Job ${id}`, provider: 'codex', modelId: 'test-model', departmentId: 'engineering', permission: 'read-only', status: 'completed', createdAt: '2026-11-01T00:00:00Z', startedAt: '2026-11-01T00:00:00Z', finishedAt: '2026-11-01T00:00:01Z', usage: { inputTokens: 10, outputTokens: 5 }, ...extra });
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(tasks, { Chart, language = 'en' } = {}) {
  const dom = new JSDOM('<section id="view"><div id="analytics"></div></section>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310' });
  const state = { settings: { workspace, language }, tasks };
  let calls = 0;
  dom.window.eval(adapter); dom.window.eval(script);
  const root = dom.window.document.querySelector('#analytics');
  const controller = dom.window.ImperiumAnalytics.mount(root, { Chart, getState: () => state, api: async () => { calls++; return { analytics: summarizeAnalytics(state) }; } });
  return { dom, state, root, controller, calls: () => calls, close() { controller.destroy(); dom.window.close(); } };
}
function chartMock() {
  const instances = [];
  class MockChart {
    constructor(canvas, config) { this.canvas = canvas; this.config = config; this.destroyed = 0; this.resizes = 0; instances.push(this); }
    destroy() { this.destroyed++; }
    resize() { this.resizes++; }
  }
  return { Chart: MockChart, instances };
}

test('locally injected Chart.js receives measured bar, line and doughnut data with accessible text tables', async () => {
  const mock = chartMock();
  const ui = fixture([
    job('zero', { usageReported: true, usage: { inputTokens: 0, outputTokens: 0 } }),
    job('unknown', { createdAt: '2026-11-02T00:00:00Z', usage: { inputTokens: 0, outputTokens: 0 }, finishedAt: null }),
    job('measured', { title: '<img src=x onerror=alert(1)>', createdAt: '2026-11-03T00:00:00Z', status: 'failed', memoryUsage: { contextChars: 40, totalMemoryChars: 300, retrievals: 1 } }),
  ], mock);
  try {
    await ui.controller.refresh();
    assert.deepEqual(mock.instances.map(chart => chart.config.type), ['bar', 'line', 'bar', 'doughnut', 'bar']);
    const daily = mock.instances[0].config;
    assert.deepEqual(Array.from(daily.data.datasets[0].data), [0, null, 10]);
    assert.deepEqual(Array.from(daily.data.datasets[1].data), [0, null, 5]);
    assert.equal(daily.data.datasets[0].backgroundColor, '#FF9F00');
    assert.equal(daily.data.datasets[1].backgroundColor, '#00B7EB');
    assert.equal(daily.options.locale, 'en-US');
    assert.equal(daily.options.responsive, true);
    assert.equal(daily.options.animation, false);
    assert.deepEqual(Array.from(mock.instances[1].config.data.datasets[0].data), [0, 15]);
    assert.deepEqual(Array.from(mock.instances[2].config.data.datasets[0].backgroundColor), ['#00D77A', '#FF4D4F']);
    assert.equal(mock.instances[4].config.data.datasets[0].data[2], null, 'unknown retrieval size stays unknown');
    assert.equal(ui.root.querySelectorAll('details.ia-chart-table').length, 5);
    assert.equal(ui.root.querySelectorAll('svg,img,script').length, 0);
    assert.ok(ui.root.textContent.includes('<img src=x onerror=alert(1)>'));
    assert.ok([...ui.root.querySelectorAll('canvas')].every(canvas => canvas.getAttribute('role') === 'img' && canvas.getAttribute('aria-label')));
    assert.ok([...ui.root.querySelectorAll('.ia-chart-table th')].every(cell => cell.scope === 'col'));
    const tooltip = daily.options.plugins.tooltip.callbacks.label;
    assert.equal(tooltip({ dataset: daily.data.datasets[0], dataIndex: 1 }), 'Input: Not reported');
    assert.equal(tooltip({ dataset: daily.data.datasets[0], dataIndex: 0 }), 'Input: 0 tokens');
  } finally { ui.close(); }
  assert.ok(mock.instances.every(chart => chart.destroyed === 1));
});

test('identical telemetry and view reopening reuse charts; locale and project changes clean up instances', async () => {
  const mock = chartMock(), ui = fixture([job('one')], mock);
  try {
    await ui.controller.refresh();
    const initial = mock.instances.slice();
    ui.controller.render(ui.state); await ui.controller.refresh();
    assert.equal(mock.instances.length, 4);
    assert.ok(initial.every(chart => chart.destroyed === 0));
    const view = ui.dom.window.document.querySelector('#view');
    view.hidden = true; await settle();
    const previousResize = initial[0].resizes;
    view.hidden = false; await settle();
    assert.equal(initial[0].resizes, previousResize + 1);
    assert.equal(mock.instances.length, 4);
    ui.state.settings.language = 'ja'; ui.controller.render(ui.state);
    assert.ok(initial.every(chart => chart.destroyed === 1));
    assert.equal(mock.instances.length, 8);
    assert.equal(mock.instances.at(-1).config.options.locale, 'ja-JP');
    assert.match(ui.root.textContent, /データ表を表示/);
    const second = mock.instances.slice(4);
    ui.state.settings.workspace = path.resolve('new-chart-project'); ui.state.tasks = [];
    ui.controller.render(ui.state); await ui.controller.refresh();
    assert.ok(second.every(chart => chart.destroyed === 1));
    assert.equal(ui.root.querySelectorAll('canvas').length, 0);
  } finally { ui.close(); }
});

test('comparison chart requires three real observations per cohort and never labels changes as billing savings', async () => {
  const mock = chartMock(), tasks = [100, 100, 100, 60, 60, 60].map((tokens, index) => job(String(index), { createdAt: `2026-11-0${index + 1}T00:00:00Z`, usage: { inputTokens: tokens, outputTokens: 0 } }));
  tasks.push(job('insufficient', { modelId: 'other-model' }));
  const ui = fixture(tasks, mock);
  try {
    await ui.controller.refresh();
    const comparison = mock.instances.at(-1).config;
    assert.equal(comparison.data.datasets[0].label, 'Older average');
    assert.equal(comparison.data.labels.length, 1);
    assert.deepEqual(Array.from(comparison.data.datasets[0].data), [100]);
    assert.deepEqual(Array.from(comparison.data.datasets[1].data), [60]);
    assert.match(ui.root.textContent, /not billing savings/);
    assert.match(ui.root.textContent, /Insufficient data/);
    ui.state.tasks = tasks.slice(0, 5); ui.controller.render(ui.state); await ui.controller.refresh();
    assert.ok(!mock.instances.filter(chart => !chart.destroyed).some(chart => chart.config.data.datasets[0].label === 'Older average'));
  } finally { ui.close(); }
});

test('missing or failed chart engines expose explicit unavailable states and open data tables', async () => {
  for (const Chart of [undefined, class { constructor() { throw new Error('no canvas'); } }]) {
    const ui = fixture([job('one')], { Chart });
    try {
      await ui.controller.refresh();
      assert.equal(ui.root.querySelectorAll('.ia-chart-unavailable').length, 4);
      assert.equal(ui.root.querySelectorAll('details.ia-chart-table[open]').length, 4);
      assert.ok([...ui.root.querySelectorAll('.ia-chart-stage')].every(stage => stage.hidden));
      assert.match(ui.root.textContent, /Chart unavailable. See the data table/);
      assert.equal(ui.root.querySelector('svg'), null);
      assert.equal(ui.calls(), 1, 'chart drawing makes no provider or external requests');
    } finally { ui.close(); }
  }
});

test('empty workspaces do not create synthetic zero charts', async () => {
  const mock = chartMock(), ui = fixture([], mock);
  try {
    await ui.controller.refresh();
    assert.equal(mock.instances.length, 0);
    assert.equal(ui.root.querySelector('canvas'), null);
    assert.match(ui.root.textContent, /No reported token usage yet/);
    assert.match(ui.root.textContent, /No task history yet/);
  } finally { ui.close(); }
});
