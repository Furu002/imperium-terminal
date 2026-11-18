import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { summarizeAnalytics } from '../lib/analytics.mjs';

const workspace = path.resolve('analytics-project');
const other = path.resolve('other-analytics-project');
const task = (id, data = {}) => ({ id, workspace, title: `Task ${id}`, provider: 'codex', modelId: 'model-one', departmentId: 'strategy', permission: 'read-only', status: 'completed', createdAt: '2026-11-18T00:00:00Z', startedAt: '2026-11-18T00:00:00Z', finishedAt: '2026-11-18T00:00:01Z', ...data });
const state = tasks => ({ settings: { workspace }, tasks });

test('empty analytics distinguish known zero task counts from unknown usage, credits and performance', () => {
  const result = summarizeAnalytics(state([]));
  assert.equal(result.totals.tasks, 0);
  assert.equal(result.totals.totalTokens, null);
  assert.equal(result.performance.successRate, null);
  assert.equal(result.performance.durationMs.p50, null);
  assert.equal(result.credits.remaining, null);
  assert.deepEqual(result.byDay, []);
  assert.deepEqual(result.tokenHistory, []);
});

test('workspace filtering excludes demo and foreign tasks while identifying legacy unattributed records', () => {
  const result = summarizeAnalytics(state([task('real'), task('demo', { demo: true }), task('foreign', { workspace: other }), task('legacy', { workspace: undefined })]));
  assert.equal(result.totals.tasks, 2);
  assert.equal(result.meta.legacyWorkspaceTasks, 1);
  assert.equal(result.meta.excludedDemoTasks, 1);
  assert.equal(summarizeAnalytics(state([task('legacy', { workspace: undefined }), task('other', { workspace: other })]), { workspace: other }).totals.tasks, 1);
});

test('only reported token values are summed and an explicit zero report stays a real zero', () => {
  const result = summarizeAnalytics(state([
    task('unknown', { usage: { inputTokens: 0, outputTokens: 0 } }),
    task('known-zero', { usageReported: true, usage: { inputTokens: 0, outputTokens: 0 } }),
    task('positive', { usage: { inputTokens: 10, outputTokens: 5 } }),
    task('partial', { usage: { inputTokens: 7 } }),
    task('invalid', { usage: { inputTokens: NaN, outputTokens: -1 } }),
  ]));
  assert.equal(result.totals.reportedTasks, 3);
  assert.equal(result.totals.unreportedTasks, 2);
  assert.equal(result.totals.inputTokens, 17);
  assert.equal(result.totals.outputTokens, 5);
  assert.equal(result.totals.totalTokens, 22);
  assert.equal(result.totals.completeUsageTasks, 2);
  assert.equal(result.taskBars.find(row => row.id === 'unknown').totalTokens, null);
  assert.equal(result.taskBars.find(row => row.id === 'known-zero').totalTokens, 0);
});

test('daily history uses UTC observations only and does not fabricate missing-day telemetry', () => {
  const result = summarizeAnalytics(state([
    task('one', { createdAt: '2026-11-01T23:00:00Z', usage: { inputTokens: 10, outputTokens: 2 } }),
    task('unknown', { createdAt: '2026-11-03T00:00:00Z' }),
    task('two', { createdAt: '2026-11-07T00:00:00Z', usage: { inputTokens: 5, outputTokens: 1 } }),
  ]));
  assert.deepEqual(result.byDay.map(row => row.day), ['2026-11-01', '2026-11-03', '2026-11-07']);
  assert.equal(result.byDay[1].totalTokens, null);
  assert.deepEqual(result.tokenHistory.map(row => row.cumulativeTokens), [12, 18]);
  assert.equal(result.meta.timeZone, 'UTC');
});

test('performance uses observed duration and first output, nearest-rank quantiles, and an explicit success denominator', () => {
  const jobs = Array.from({ length: 20 }, (_, i) => task(String(i), { finishedAt: `2026-11-18T00:00:${String(i + 1).padStart(2, '0')}Z`, status: i === 19 ? 'failed' : 'completed' }));
  jobs.push(task('cancelled', { status: 'cancelled', startedAt: null }), task('running', { status: 'running', finishedAt: null }));
  jobs[0].firstOutputAt = '2026-11-18T00:00:00.250Z';
  jobs[1].firstOutputAt = '2026-11-17T00:00:00Z';
  const result = summarizeAnalytics(state(jobs));
  assert.equal(result.performance.durationMs.p50, 10000);
  assert.equal(result.performance.durationMs.p95, 19000);
  assert.equal(result.performance.durationMs.samples, 20);
  assert.equal(result.performance.firstOutputLatencyMs.p50, 250);
  assert.equal(result.performance.firstOutputLatencyMs.samples, 1);
  assert.equal(result.performance.successSampleCount, 20);
  assert.equal(result.performance.successRate, .95);
});

test('memory separates initial context characters from subsequent lookup characters without calling them token savings', () => {
  const result = summarizeAnalytics(state([
    task('one', { memoryUsage: { contextChars: 1200, totalMemoryChars: 10000, retrievals: 2, retrievedChars: 500 } }),
    task('two', { memoryUsage: { contextChars: 100, totalMemoryChars: 2000, retrievals: 0 } }),
    task('unknown', { memoryUsage: { contextChars: 20, totalMemoryChars: 1000, retrievals: 1 } }),
  ]));
  assert.equal(result.memory.initialContextChars, 1320);
  assert.equal(result.memory.totalMemoryChars, 13000);
  assert.equal(result.memory.additionalRetrievals, 3);
  assert.equal(result.memory.retrievedChars, 500);
  assert.equal(result.memory.unknownRetrievedCharTasks, 1);
  assert.equal(result.memory.method, 'character-counts');
  assert.ok(!Object.hasOwn(result, 'costSavings'));
});

test('usage comparisons require three samples in each matching configuration cohort and omit an odd middle sample', () => {
  const jobs = [100, 100, 100, 9999, 60, 60, 60].map((tokens, i) => task(`job-${i}`, { createdAt: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00Z`, usage: { inputTokens: tokens, outputTokens: 0 } }));
  jobs.push(task('different-provider', { provider: 'claude', usage: { inputTokens: 1, outputTokens: 0 } }));
  jobs.push(task('different-model', { modelId: 'model-two', usage: { inputTokens: 1, outputTokens: 0 } }));
  jobs.push(task('unknown-model', { modelId: '', usage: { inputTokens: 1, outputTokens: 0 } }));
  const result = summarizeAnalytics(state(jobs));
  const group = result.comparison.groups.find(row => row.provider === 'codex' && row.modelId === 'model-one');
  assert.equal(group.status, 'available');
  assert.equal(group.previousCount, 3); assert.equal(group.recentCount, 3);
  assert.equal(group.omittedMiddleCount, 1);
  assert.equal(group.previousAverageTokens, 100);
  assert.equal(group.recentAverageTokens, 60);
  assert.equal(group.changePercent, -40);
  assert.equal(result.comparison.excludedUnknownModelTasks, 1);
  assert.ok(result.comparison.groups.filter(row => row !== group).every(row => row.status === 'insufficient'));
});

test('insufficient and zero-baseline cohorts never produce invented percentages or infinity', () => {
  const few = summarizeAnalytics(state(Array.from({ length: 5 }, (_, i) => task(String(i), { usage: { inputTokens: 2, outputTokens: 1 } }))));
  assert.equal(few.comparison.groups[0].status, 'insufficient');
  assert.equal(few.comparison.groups[0].changePercent, null);
  const zero = summarizeAnalytics(state(Array.from({ length: 6 }, (_, i) => task(String(i), { usageReported: true, usage: { inputTokens: 0, outputTokens: 0 } }))));
  assert.equal(zero.comparison.groups[0].status, 'available');
  assert.equal(zero.comparison.groups[0].changePercent, null);
});

test('the analytics view renders measured SVG data as text and translates empty states without synthetic charts', async () => {
  const dom = new JSDOM('<div id="analytics"></div>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310' });
  const current = state([task('unsafe-title', { title: '<img src=x onerror=alert(1)>', usage: { inputTokens: 10, outputTokens: 5 } })]);
  let result = summarizeAnalytics(current);
  dom.window.eval(readFileSync(new URL('../public/analytics.js', import.meta.url), 'utf8'));
  const root = dom.window.document.querySelector('#analytics');
  const controller = dom.window.ImperiumAnalytics.mount(root, { getState: () => current, api: async () => ({ analytics: result }) });
  try {
    await controller.refresh();
    assert.equal(root.querySelectorAll('svg[role="img"]').length, 3);
    assert.equal(root.querySelector('img,script'), null);
    assert.ok(root.textContent.includes('<img src=x onerror=alert(1)>'));
    assert.ok([...root.querySelectorAll('svg')].every(image => image.getAttribute('aria-label')));
    current.tasks = [];
    current.settings.language = 'en';
    result = summarizeAnalytics(current);
    controller.render(current); await controller.refresh();
    assert.equal(root.querySelectorAll('svg').length, 0);
    assert.match(root.textContent, /Usage and operational performance/);
    assert.match(root.textContent, /No reported token usage yet/);
    current.settings.language = 'ja'; controller.render(current);
    assert.match(root.textContent, /使用量と稼働状況/);
    current.settings.language = 'ko'; controller.render(current);
    assert.match(root.textContent, /사용량과 운영 성능/);
  } finally { controller.destroy(); dom.window.close(); }
});

test('late analytics responses from a previous workspace cannot replace the current project', async () => {
  const dom = new JSDOM('<div id="analytics"></div>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310' });
  const current = state([task('first', { title: 'OLD_PROJECT_TASK', usage: { inputTokens: 1, outputTokens: 1 } })]);
  const oldResult = summarizeAnalytics(current);
  const pending = [];
  dom.window.eval(readFileSync(new URL('../public/analytics.js', import.meta.url), 'utf8'));
  const root = dom.window.document.querySelector('#analytics');
  const controller = dom.window.ImperiumAnalytics.mount(root, { getState: () => current, api: () => new Promise(resolve => pending.push(resolve)) });
  try {
    const first = controller.refresh();
    current.settings.workspace = other;
    current.tasks = [task('second', { workspace: other, title: 'CURRENT_PROJECT_TASK', usage: { inputTokens: 2, outputTokens: 3 } })];
    controller.render(current);
    const second = controller.refresh();
    pending[1]({ analytics: summarizeAnalytics(current) }); await second;
    pending[0]({ analytics: oldResult }); await first;
    assert.ok(root.textContent.includes('CURRENT_PROJECT_TASK'));
    assert.ok(!root.textContent.includes('OLD_PROJECT_TASK'));
  } finally { controller.destroy(); dom.window.close(); }
});
