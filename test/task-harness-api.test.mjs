import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { createHQServer } from '../server.mjs';

const criteria = '설계의 입력, 출력, 예외 조건을 설명하세요.';
const artifactTitle = '검토 결과';

async function eventually(read, message) {
  const deadline = Date.now() + 5000;
  do {
    const result = await read();
    if (result) return result;
    await delay(15);
  } while (Date.now() < deadline);
  assert.fail(message);
}

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'imperium-task-harness-'));
  const workspace = path.join(directory, 'project');
  await mkdir(workspace);
  const calls = [];
  const app = createHQServer({
    dataDir: path.join(directory, 'data'), workspace, port: 0, quotaReaders: {},
    providers: {
      detectProviders: async () => ['codex', 'claude', 'ollama'].map(id => ({ id, installed: true, authenticated: true, status: 'ready' })),
      startProvider: async options => {
        const call = { ...options, cancelled: false };
        calls.push(call);
        return { cancel() { call.cancelled = true; } };
      },
    },
  });
  t.after(async () => {
    try { await app.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  });
  const { url } = await app.start();
  const initial = await fetch(`${url}/api/state`).then(response => response.json());
  assert.ok(initial.server.csrfToken);
  const request = (route, body, method = 'POST', headers = {}) => fetch(`${url}${route}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = async (...args) => {
    const response = await request(...args);
    const data = await response.json();
    assert.ok(response.ok, `${args[0]} returned ${response.status}: ${JSON.stringify(data)}`);
    return data;
  };
  const input = { workspace, departmentId: 'strategy', prompt: '설계를 검토해 주세요.' };
  const submit = async harness => (await json('/api/tasks', { ...input, ...(harness === undefined ? {} : { harness }) })).task;
  const waitCall = index => eventually(() => calls[index], `provider call ${index} did not start`);
  const state = () => json('/api/state', undefined, 'GET');
  const detail = async id => (await json(`/api/tasks/${id}`, undefined, 'GET')).task;
  const waitTask = (id, status) => eventually(async () => {
    const task = await detail(id);
    return task.status === status && task;
  }, `task did not reach ${status}`);
  const memory = () => json('/api/memory', undefined, 'GET');
  const publish = async (call, options = {}) => {
    assert.ok(call.memory?.token, 'the fake provider must receive its scoped artifact capability');
    const { artifact } = await json('/api/agent-memory/artifacts/publish', {
      title: artifactTitle, kind: 'result', content: '검토 요약과 관측한 근거', idempotencyKey: 'evidence-1', ...options,
    }, 'POST', { 'x-imperium-memory-token': call.memory.token });
    return artifact;
  };
  const workflow = async harness => {
    await json('/api/graph', {
      workspace,
      nodes: ['strategy', 'engineering'].map((id, index) => ({ id: `department:${id}`, type: 'department', referenceId: id, x: index * 250, y: 20 })),
      edges: [{ id: 'strategy-engineering', type: 'handoff', source: 'department:strategy', target: 'department:engineering' }],
    }, 'PUT');
    return json('/api/workflows/run', { ...input, harness });
  };
  return { input, calls, request, json, submit, waitCall, state, detail, waitTask, memory, publish, workflow };
}

function assertReport(task, status, checks) {
  const result = task.harness?.result;
  assert.equal(result?.status, status);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)), 'harness report has a timestamp');
  if (checks) assert.deepEqual(result.checks.map(({ id, passed, artifactId }) => ({ id, passed, ...(artifactId ? { artifactId } : {}) })), checks);
}

test('harness passes from final-only response and own exact result artifact, and saves evidence in task detail and state', async t => {
  const f = await fixture(t);
  const task = await f.submit({ criteria, artifactTitle });
  const call = await f.waitCall(0);
  assert.match(call.prompt, /설계의 입력, 출력, 예외 조건을 설명하세요/);
  assert.ok(call.prompt.includes(artifactTitle));
  assert.equal(call.permission, 'read-only');
  const artifact = await f.publish(call);
  assert.equal(artifact.taskId, task.id);
  assert.equal(artifact.confidence, 'unverified');
  call.onEvent({ type: 'text', text: '  \n' });
  call.onExit({ code: 0, output: '입력과 출력, 예외 조건을 정리했습니다.' });
  const completed = await f.waitTask(task.id, 'completed');
  assert.equal(completed.output, '입력과 출력, 예외 조건을 정리했습니다.');
  assert.equal(completed.harness.criteria, criteria);
  assert.equal(completed.harness.artifactTitle, artifactTitle);
  assertReport(completed, 'passed', [{ id: 'output', passed: true }, { id: 'artifact', passed: true, artifactId: artifact.id }]);
  const snapshot = await f.state();
  assert.deepEqual(snapshot.tasks.find(item => item.id === task.id).harness, completed.harness);
  assert.ok(!JSON.stringify(snapshot).includes(call.memory.token));
  assert.ok((await f.memory()).nodes.some(note => note.sourceTaskId === task.id));
});

test('a provider zero exit with only a progress marker never becomes a successful harness task', async t => {
  const f = await fixture(t);
  const task = await f.submit({ criteria });
  const call = await f.waitCall(0);
  call.onEvent({ type: 'text', text: '[[IMPERIUM_PROGRESS {"percent":99,"etaMinutes":1,"stage":"확인 중"}]]\n' });
  call.onExit({ code: 0, output: '   ' });
  const failed = await f.waitTask(task.id, 'failed');
  assert.equal(failed.output.trim(), '');
  assert.notEqual(failed.progress?.percent, 100);
  assertReport(failed, 'failed', [{ id: 'output', passed: false }]);
  assert.ok(!(await f.memory()).nodes.some(note => note.sourceTaskId === task.id));
});

test('a matching title from a prior task or wrong artifact kind cannot satisfy this task', async t => {
  const f = await fixture(t);
  const prior = await f.submit();
  const priorCall = await f.waitCall(0);
  await f.publish(priorCall);
  priorCall.onExit({ code: 0, output: '이전 작업 결과' });
  await f.waitTask(prior.id, 'completed');

  const task = await f.submit({ criteria, artifactTitle });
  const call = await f.waitCall(1);
  await f.publish(call, { kind: 'finding' });
  await f.publish(call, { title: `${artifactTitle} 추가`, idempotencyKey: 'different-title' });
  call.onExit({ code: 0, output: '이 작업에서 게시했다고 주장합니다.' });
  const failed = await f.waitTask(task.id, 'failed');
  assertReport(failed, 'failed', [{ id: 'output', passed: true }, { id: 'artifact', passed: false }]);
  const notes = (await f.memory()).nodes;
  assert.ok(notes.some(note => note.sourceTaskId === prior.id));
  assert.ok(!notes.some(note => note.sourceTaskId === task.id));
});

test('a verified workflow starting task releases an unchanged successor without copying its checks', async t => {
  const f = await fixture(t);
  const { tasks } = await f.workflow({ criteria, artifactTitle });
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks[1].dependsOn, [tasks[0].id]);
  assert.equal(tasks[1].harness, undefined);
  const starter = await f.waitCall(0);
  assert.equal(starter.provider, 'codex');
  assert.equal(f.calls.length, 1);
  await f.publish(starter);
  starter.onExit({ code: 0, output: '선행 작업 결과' });
  const successor = await f.waitCall(1);
  assert.equal(successor.provider, 'claude');
  assert.doesNotMatch(successor.prompt, /설계의 입력, 출력, 예외 조건을 설명하세요/);
  assert.match(successor.prompt, /선행 작업 결과/);
  successor.onExit({ code: 0, output: '' });
  assert.equal((await f.waitTask(tasks[1].id, 'completed')).harness, undefined);
  assertReport(await f.waitTask(tasks[0].id, 'completed'), 'passed');
});

test('a workflow harness failure cancels the dependent task before a second provider call or memory capture', async t => {
  const f = await fixture(t);
  const { tasks } = await f.workflow({ criteria, artifactTitle });
  const starter = await f.waitCall(0);
  starter.onExit({ code: 0, output: '산출물을 게시하지 않은 결과' });
  assertReport(await f.waitTask(tasks[0].id, 'failed'), 'failed');
  await f.waitTask(tasks[1].id, 'cancelled');
  assert.equal(f.calls.length, 1);
  assert.deepEqual((await f.memory()).nodes, []);
});

test('invalid harness metadata is rejected on tasks and workflow runs before any queue side effects', async t => {
  const f = await fixture(t);
  for (const harness of [[], { criteria: 12 }, { criteria: '가'.repeat(1201) }, { artifactTitle: '가'.repeat(161) }, { criteria, result: { status: 'passed' } }, { criteria, command: 'anything' }]) {
    for (const route of ['/api/tasks', '/api/workflows/run']) {
      const response = await f.request(route, { ...f.input, harness });
      assert.equal(response.status, 400);
    }
  }
  const unsupported = await f.request('/api/tasks', { ...f.input, provider: 'ollama', harness: { criteria, artifactTitle } });
  assert.equal(unsupported.status, 400);
  const snapshot = await f.state();
  assert.deepEqual(snapshot.tasks, []);
  assert.deepEqual(snapshot.conversations, []);
  assert.equal(f.calls.length, 0);
});

test('process failure skips harness checks even with present output and artifact, and cancellation never claims a pass', async t => {
  const f = await fixture(t);
  const task = await f.submit({ criteria, artifactTitle });
  const call = await f.waitCall(0);
  await f.publish(call);
  call.onExit({ code: 7, output: '오류와 함께 나온 출력', error: 'Provider failed' });
  const failed = await f.waitTask(task.id, 'failed');
  assertReport(failed, 'skipped');
  assert.equal(failed.error, 'Provider failed');

  const cancelling = await f.submit({ criteria });
  const cancellingCall = await f.waitCall(1);
  await f.json(`/api/tasks/${cancelling.id}/cancel`, {});
  assert.equal(cancellingCall.cancelled, true);
  cancellingCall.onExit({ code: 0, output: '뒤늦게 도착한 출력' });
  const cancelled = await f.waitTask(cancelling.id, 'cancelled');
  assert.notEqual(cancelled.harness?.result?.status, 'passed');
  assert.deepEqual((await f.memory()).nodes, []);
});

test('a task without a harness preserves the legacy execution lifecycle', async t => {
  const f = await fixture(t);
  const task = await f.submit();
  const call = await f.waitCall(0);
  call.onExit({ code: 0, output: '' });
  const completed = await f.waitTask(task.id, 'completed');
  assert.equal(completed.harness, undefined);
  assert.equal(completed.progress.percent, 100);
});
