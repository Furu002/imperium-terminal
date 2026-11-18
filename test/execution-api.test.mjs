import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHQServer } from '../server.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check) {
  const deadline = Date.now() + 3500;
  do { const result = await check(); if (result) return result; await delay(15); } while (Date.now() < deadline);
  assert.fail('Expected execution state was not reached');
}

async function fixture(t) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'imperium-execution-api-')));
  await mkdir(path.join(directory, 'workspace'));
  const workspace = await realpath(path.join(directory, 'workspace'));
  const apps = [], closed = new WeakSet(), calls = [];
  let app, url, token;
  const providers = {
    detectProviders: async () => ['codex', 'claude', 'copilot', 'gemini', 'ollama'].map(id => ({ id, status: 'ready', installed: true, authenticated: true, name: id })),
    async startProvider(input) {
      let ended = false;
      const complete = () => { if (!ended) { ended = true; input.onExit({ code: 0, output: 'FAKE_RESULT', usage: { inputTokens: 1, outputTokens: 1 } }); } };
      calls.push({ ...input, complete });
      return { cancel() { if (!ended) { ended = true; input.onExit({ code: 130, error: 'Cancelled' }); } } };
    },
  };
  const closeOne = async instance => {
    if (closed.has(instance)) return;
    closed.add(instance); instance.server.closeAllConnections();
    try { await instance.close(); }
    finally { instance.server.closeAllConnections(); if (instance.server.listening) await new Promise(resolve => instance.server.close(resolve)); }
  };
  t.after(async () => {
    const stopped = await Promise.allSettled(apps.map(closeOne));
    const relative = path.relative(await realpath(tmpdir()), directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(directory).startsWith('imperium-execution-api-'));
    await rm(directory, { recursive: true, force: true });
    const failures = stopped.filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Execution fixture cleanup failed');
  });
  const get = async route => {
    const response = await fetch(`${url}${route}`), body = await response.json();
    assert.ok(response.ok, `GET ${route}: ${response.status} ${JSON.stringify(body)}`); return body;
  };
  const open = async () => {
    app = createHQServer({ dataDir: path.join(directory, 'data'), workspace, port: 0, providers, terminalManager: { list: () => [], closeAll() {} }, quotaReaders: {}, modelDiscovery: async () => ({ models: [] }) });
    apps.push(app); ({ url } = await app.start()); token = (await get('/api/state')).server.csrfToken;
  };
  const request = (route, body, method = 'POST') => fetch(`${url}${route}`, { method, headers: { 'content-type': 'application/json', 'x-hq-token': token }, body: JSON.stringify(body) });
  const successful = async (route, body, method = 'POST') => {
    const response = await request(route, body, method), result = await response.json();
    assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(result)}`); return result;
  };
  const department = async (extra = {}) => (await successful('/api/departments', { name: '실행 옵션 부서', provider: 'codex', role: '사용자에게서 받은 업무만 수행합니다.', workspace, ...extra })).department;
  const connection = async (providerId, modelId) => (await successful('/api/providers/register', { providerId, modelId, label: `${providerId} 공유 연결` })).connection;
  const task = async (departmentId, extra = {}) => (await successful('/api/tasks', { departmentId, workspace, prompt: '모델을 호출하지 않는 실행 옵션 검증', permission: 'read-only', ...extra })).task;
  const finish = async created => {
    const call = await eventually(() => calls.find(value => value.provider && value.cwd === workspace && !value.finished));
    call.finished = true; call.complete();
    await eventually(async () => (await get('/api/state')).tasks.find(value => value.id === created.id)?.status === 'completed');
    return call;
  };
  await open();
  return { get, state: () => get('/api/state'), request, successful, department, connection, task, finish, calls, workspace, open, close: () => closeOne(app) };
}
const options = value => ({ modelId: value.modelId, reasoningEffort: value.reasoningEffort, speed: value.speed });
const graphNode = id => ({ id: `department:${id}`, type: 'department', referenceId: id, x: 100, y: 100 });

test('agent defaults reach the runner, cannot change during active work, and persist with task history across restart', async t => {
  const f = await fixture(t);
  const preferences = { modelId: 'agent-model', reasoningEffort: 'xhigh', speed: 'fast' };
  const department = await f.department(preferences);
  assert.deepEqual(options(department), preferences);
  const task = await f.task(department.id);
  assert.deepEqual(options(task), preferences);
  await eventually(() => f.calls.length === 1);
  assert.deepEqual(options(f.calls[0]), preferences);
  assert.equal((await f.request(`/api/departments/${department.id}`, { workspace: f.workspace, speed: 'standard' }, 'PATCH')).status, 409);
  await f.finish(task); await f.close(); await f.open();
  const state = await f.state();
  assert.deepEqual(options(state.departments.find(value => value.id === department.id)), preferences);
  assert.deepEqual(options(state.tasks.find(value => value.id === task.id)), preferences);
});

test('model-only agent edits persist and explicit task model/effort/speed overrides do not alter agent defaults', async t => {
  const f = await fixture(t);
  const department = await f.department({ modelId: 'old-model', reasoningEffort: 'high', speed: 'fast' });
  const patched = (await f.successful(`/api/departments/${department.id}`, { workspace: f.workspace, modelId: 'new-model' }, 'PATCH')).department;
  assert.deepEqual(options(patched), { modelId: 'new-model', reasoningEffort: 'high', speed: 'fast' });
  const inherited = await f.task(department.id);
  assert.equal((await f.finish(inherited)).modelId, 'new-model');
  const override = { modelId: 'one-job-model', reasoningEffort: 'default', speed: 'standard' };
  const job = await f.task(department.id, override);
  assert.deepEqual(options(await f.finish(job)), override);
  assert.deepEqual(options((await f.state()).departments.find(value => value.id === department.id)), options(patched));
});

test('explicit task models outrank connection defaults and cross-provider connections reset inherited preferences', async t => {
  const f = await fixture(t);
  const codex = await f.connection('codex', 'connection-model');
  const department = await f.department({ connectionId: codex.id, modelId: 'agent-model', reasoningEffort: 'xhigh', speed: 'fast' });
  const agentDefault = await f.task(department.id);
  assert.equal((await f.finish(agentDefault)).modelId, 'agent-model', 'an agent explicit model must outrank its assigned connection default');
  const fromConnection = await f.task(department.id, { connectionId: codex.id });
  assert.deepEqual(options(await f.finish(fromConnection)), { modelId: 'connection-model', reasoningEffort: 'xhigh', speed: 'fast' });
  const explicit = await f.task(department.id, { connectionId: codex.id, modelId: 'explicit-model' });
  assert.equal((await f.finish(explicit)).modelId, 'explicit-model');
  const cliDefault = await f.task(department.id, { connectionId: codex.id, modelId: '' });
  assert.equal((await f.finish(cliDefault)).modelId, '');
  const claude = await f.connection('claude', 'sonnet');
  const changed = await f.task(department.id, { connectionId: claude.id });
  const call = await f.finish(changed);
  assert.equal(call.provider, 'claude');
  assert.deepEqual(options(call), { modelId: 'sonnet', reasoningEffort: 'default', speed: 'default' });
  const copilot = await f.task(department.id, { provider: 'copilot' });
  const other = await f.finish(copilot);
  assert.equal(other.provider, 'copilot');
  assert.deepEqual(options(other), { modelId: '', reasoningEffort: 'default', speed: 'default' });
});

test('changing an agent provider clears prior preferences and invalid unsupported settings never partially mutate it', async t => {
  const f = await fixture(t);
  const department = await f.department({ modelId: 'codex-only', reasoningEffort: 'xhigh', speed: 'fast' });
  const changed = (await f.successful(`/api/departments/${department.id}`, { workspace: f.workspace, provider: 'copilot' }, 'PATCH')).department;
  assert.deepEqual(options(changed), { modelId: '', reasoningEffort: 'default', speed: 'default' });
  const rejected = await f.request(`/api/departments/${department.id}`, { workspace: f.workspace, provider: 'gemini', reasoningEffort: 'high', name: '수정되면 안 되는 이름' }, 'PATCH');
  assert.equal(rejected.status, 400);
  assert.deepEqual((await f.state()).departments.find(value => value.id === department.id), changed);
  const job = await f.task(department.id, { reasoningEffort: 'high' });
  assert.deepEqual(options(await f.finish(job)), { modelId: '', reasoningEffort: 'high', speed: 'default' });
});

test('invalid option values and model flag injection are rejected before any task or agent is created', async t => {
  const f = await fixture(t);
  const department = await f.department();
  const before = await f.state();
  for (const extra of [{ reasoningEffort: null }, { speed: null }, { reasoningEffort: '--allow-all' }, { speed: true }, { modelId: '--dangerously-skip-permissions' }, { provider: 'copilot', speed: 'fast' }, { provider: 'gemini', reasoningEffort: 'high' }]) {
    const response = await f.request('/api/tasks', { departmentId: department.id, workspace: f.workspace, prompt: '거부되어야 할 실행', ...extra });
    assert.equal(response.status, 400, JSON.stringify(extra));
    await response.json();
  }
  assert.equal((await f.request('/api/departments', { workspace: f.workspace, name: '잘못된 옵션', role: '검토', provider: 'ollama', speed: 'fast' })).status, 400);
  const after = await f.state();
  assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.departments, before.departments);
  assert.equal(f.calls.length, 0);
});

test('mixed-provider workflows reject unsupported overrides atomically and otherwise use each agent own defaults', async t => {
  const f = await fixture(t);
  const first = await f.department({ name: '첫 단계', reasoningEffort: 'xhigh', speed: 'fast' });
  const second = await f.department({ name: '다음 단계', provider: 'gemini' });
  await f.successful('/api/graph', { workspace: f.workspace, nodes: [graphNode(first.id), graphNode(second.id)], edges: [{ id: 'handoff', source: `department:${first.id}`, target: `department:${second.id}`, type: 'handoff' }] }, 'PUT');
  for (const override of [{ reasoningEffort: 'high' }, { speed: 'fast' }]) {
    const rejected = await f.request('/api/workflows/run', { workspace: f.workspace, departmentId: first.id, prompt: '두 단계 작업', ...override });
    assert.equal(rejected.status, 400);
    await rejected.json();
    assert.deepEqual((await f.state()).tasks, []); assert.equal(f.calls.length, 0);
  }
  const workflow = await f.successful('/api/workflows/run', { workspace: f.workspace, departmentId: first.id, prompt: '기본 옵션으로 두 단계 작업' });
  await eventually(() => f.calls.length === 1);
  assert.equal(f.calls[0].reasoningEffort, 'xhigh'); assert.equal(f.calls[0].speed, 'fast');
  await f.finish(workflow.tasks[0]);
  await eventually(() => f.calls.length === 2);
  assert.equal(f.calls[1].provider, 'gemini'); assert.equal(f.calls[1].reasoningEffort, 'default'); assert.equal(f.calls[1].speed, 'default');
  await f.finish(workflow.tasks[1]);
});
