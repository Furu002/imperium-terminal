import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createUISnapshot } from '../lib/ui-snapshot.mjs';

const workspace = path.resolve('ui-project');
const otherWorkspace = path.resolve('ui-project-sibling');
const task = (id, changes = {}) => ({ id, workspace, status: 'completed', title: `업무 ${id}`, prompt: '원래 지시는 줄이지 않습니다.', provider: 'claude', modelId: 'configured-model', departmentId: 'engineering', permission: 'read-only', output: '결과', logs: [], usage: { inputTokens: 50, outputTokens: 20 }, ...changes });
const state = (tasks = [], changes = {}) => ({ settings: { workspace, localOnly: true, identity: { name: '나', title: '설계자' } }, tasks, departments: [{ id: 'engineering', name: '개발', role: '현재 역할' }], events: [], projects: [], graphs: {}, providers: [{ id: 'claude', status: 'ready' }], connections: [{ id: 'default-claude', providerId: 'claude', label: '개발 AI' }], server: { csrfToken: 'local-ui-token', version: '1.3.0' }, ...changes });

test('UI snapshot revisions increase per server state without changing the source', () => {
  const firstServer = state();
  const secondServer = state();
  assert.equal(createUISnapshot(firstServer).server.snapshotRevision, 1);
  assert.equal(createUISnapshot(firstServer).server.snapshotRevision, 2);
  assert.equal(createUISnapshot(secondServer).server.snapshotRevision, 1);
  assert.equal(createUISnapshot(firstServer).server.snapshotRevision, 3);
  assert.equal(Object.hasOwn(firstServer.server, 'snapshotRevision'), false);
});

test('200 long completed results have bounded UI previews while original results, prompts, and logs stay untouched', () => {
  const output = '가'.repeat(150_000);
  const logs = Array.from({ length: 300 }, (_, index) => ({ id: `log-${index}`, text: `긴 기록 ${index}` }));
  const source = state(Array.from({ length: 200 }, (_, index) => task(String(index), { output, logs })));
  const snapshot = createUISnapshot(source);
  assert.equal(snapshot.tasks.length, 200);
  for (const item of snapshot.tasks) {
    assert.equal(item.output.length, 2000);
    assert.equal(item.outputChars, 150_000);
    assert.equal(item.detailsTruncated, true);
    assert.deepEqual(item.logs, []);
    assert.equal(item.prompt, source.tasks[0].prompt);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 1_500_000);
  assert.equal(source.tasks[0].output.length, 150_000);
  assert.equal(source.tasks[199].output.length, 150_000);
  assert.equal(source.tasks[0].logs.length, 300);
  assert.equal(source.tasks[199].logs, logs);
  assert.equal(Object.hasOwn(source.tasks[0], 'detailsTruncated'), false);
});

test('running and queued tasks retain the full supported output and the latest 60 logs', () => {
  const logs = Array.from({ length: 80 }, (_, index) => ({ id: String(index), text: `log ${index}` }));
  const source = state(['running', 'queued'].map(status => task(status, { status, output: 'x'.repeat(200_000), logs })));
  const snapshot = createUISnapshot(source);
  for (const item of snapshot.tasks) {
    assert.equal(item.output.length, 200_000);
    assert.equal(item.outputChars, 200_000);
    assert.equal(item.logs.length, 60);
    assert.equal(item.logs[0].id, '20');
    assert.equal(item.logs.at(-1).id, '79');
    assert.equal(item.detailsTruncated, true);
  }
  snapshot.tasks[0].logs[0].text = 'changed UI copy';
  assert.equal(source.tasks[0].logs[20].text, 'log 20');
  assert.equal(source.tasks[0].logs.length, 80);
});

test('all inactive statuses use previews and clipping flags distinguish full output from omitted logs', () => {
  const source = state([
    ...['completed', 'cancelled', 'failed', 'interrupted'].map(status => task(status, { status, output: 'x'.repeat(2001), logs: [{ text: 'old' }] })),
    task('small'), task('logs-only', { logs: [{ text: 'omitted' }] }),
    task('active-full', { status: 'running', logs: [{ text: 'visible' }] }),
    task('active-over-limit', { status: 'running', output: 'x'.repeat(200_001) }),
  ]);
  const snapshot = createUISnapshot(source);
  for (const item of snapshot.tasks.slice(0, 4)) { assert.equal(item.output.length, 2000); assert.equal(item.detailsTruncated, true); assert.deepEqual(item.logs, []); }
  assert.equal(snapshot.tasks.find(item => item.id === 'small').detailsTruncated, false);
  assert.equal(snapshot.tasks.find(item => item.id === 'logs-only').detailsTruncated, true);
  assert.equal(snapshot.tasks.find(item => item.id === 'active-full').detailsTruncated, false);
  assert.equal(snapshot.tasks.find(item => item.id === 'active-over-limit').output.length, 200_000);
  assert.equal(snapshot.tasks.find(item => item.id === 'active-over-limit').outputChars, 200_001);
});

test('workspace filtering retains canonical current paths and flagged legacy tasks without leaking sibling details', () => {
  const same = path.join(workspace, 'nested', '..');
  const foreign = task('foreign', { workspace: otherWorkspace, output: 'SIBLING_SECRET' });
  const source = state([task('current', { workspace: same }), task('legacy', { workspace: undefined }), foreign], {
    events: [{ id: 'current-event', taskId: 'current', text: 'current' }, { id: 'foreign-event', taskId: 'foreign', text: 'SIBLING_SECRET' }, { id: 'foreign-scope', workspace: otherWorkspace, text: 'SIBLING_SECRET' }, { id: 'system', type: 'system', text: 'online' }],
    graphs: { [workspace]: { nodes: [{ id: 'current-node' }], edges: [] }, [otherWorkspace]: { nodes: [{ id: 'SIBLING_SECRET' }], edges: [] } },
  });
  const snapshot = createUISnapshot(source);
  assert.deepEqual(snapshot.tasks.map(item => item.id), ['current', 'legacy']);
  assert.equal(snapshot.tasks[0].legacyWorkspace, false);
  assert.equal(snapshot.tasks[1].legacyWorkspace, true);
  assert.deepEqual(snapshot.events.map(event => event.id), ['current-event', 'system']);
  assert.deepEqual(Object.keys(snapshot.graphs), [workspace]);
  assert.equal(JSON.stringify(snapshot).includes('SIBLING_SECRET'), false);
  assert.equal(source.tasks.length, 3);
  assert.equal(source.events.length, 4);
  assert.ok(source.graphs[otherWorkspace]);
});

test('project summaries omit definitions, use live active counts, and preserve shared model connections', () => {
  const source = state([], { projects: [
    { id: 'active', name: '현재 프로젝트', color: '#112233', workspace, departments: [{ role: 'STALE_PRIVATE' }, { role: 'STALE_PRIVATE' }] },
    { id: 'other', name: '다른 프로젝트', color: '#AABBCC', workspace: otherWorkspace, departments: [{ role: 'SIBLING_DEFINITION' }, { role: 'SIBLING_DEFINITION' }, { role: 'SIBLING_DEFINITION' }] },
  ] });
  const snapshot = createUISnapshot(source);
  assert.deepEqual(snapshot.projects.map(project => [project.current, project.departmentCount]), [[true, 1], [false, 3]]);
  for (const project of snapshot.projects) assert.equal(Object.hasOwn(project, 'departments'), false);
  assert.equal(JSON.stringify(snapshot).includes('SIBLING_DEFINITION'), false);
  assert.equal(JSON.stringify(snapshot).includes('STALE_PRIVATE'), false);
  assert.deepEqual(snapshot.connections, source.connections);
  assert.deepEqual(snapshot.providers, source.providers);
  assert.equal(snapshot.server.csrfToken, 'local-ui-token');
  assert.equal(source.projects[1].departments.length, 3);
});

test('UTF-16 preview boundaries preserve Korean and complete emoji pairs without a dangling high surrogate', () => {
  const source = state([
    task('split', { output: `${'가'.repeat(1999)}🙂마지막` }),
    task('whole', { output: `${'나'.repeat(1998)}🙂마지막` }),
    task('active-split', { status: 'running', output: `${'다'.repeat(199_999)}🙂` }),
  ]);
  const snapshot = createUISnapshot(source);
  assert.equal(snapshot.tasks[0].output, '가'.repeat(1999));
  assert.equal(snapshot.tasks[0].outputChars, source.tasks[0].output.length);
  assert.equal(snapshot.tasks[1].output, `${'나'.repeat(1998)}🙂`);
  assert.equal(snapshot.tasks[2].output, '다'.repeat(199_999));
  assert.ok(snapshot.tasks.every(item => !/[\uD800-\uDBFF]$/u.test(item.output)));
});

test('small mutable UI metadata is copied and unmodified task fields remain available', () => {
  const source = state([task('one', { progress: { percent: 40, source: 'model-estimate' }, historicalETA: { medianSeconds: 30 }, memoryUsage: { selectedIds: ['note-one'], contextChars: 10 }, dependsOn: ['previous'], finishedAt: '2026-11-18T01:00:00Z' })]);
  const snapshot = createUISnapshot(source);
  snapshot.tasks[0].usage.inputTokens = 999;
  snapshot.tasks[0].progress.percent = 90;
  snapshot.tasks[0].memoryUsage.selectedIds.push('new-note');
  snapshot.tasks[0].dependsOn.push('new-task');
  snapshot.settings.identity.name = 'changed';
  snapshot.connections[0].label = 'changed';
  assert.equal(source.tasks[0].usage.inputTokens, 50);
  assert.equal(source.tasks[0].progress.percent, 40);
  assert.deepEqual(source.tasks[0].memoryUsage.selectedIds, ['note-one']);
  assert.deepEqual(source.tasks[0].dependsOn, ['previous']);
  assert.equal(source.settings.identity.name, '나');
  assert.equal(source.connections[0].label, '개발 AI');
  assert.equal(snapshot.tasks[0].finishedAt, source.tasks[0].finishedAt);
  assert.equal(snapshot.tasks[0].modelId, 'configured-model');
});

test('missing current scope does not accidentally expose explicitly scoped tasks or graphs', () => {
  const snapshot = createUISnapshot(state([task('scoped'), task('legacy', { workspace: undefined })], { settings: {}, graphs: { [workspace]: { nodes: [], edges: [] } } }));
  assert.deepEqual(snapshot.tasks.map(item => item.id), ['legacy']);
  assert.deepEqual(snapshot.graphs, {});
  assert.doesNotThrow(() => JSON.stringify(createUISnapshot()));
});
