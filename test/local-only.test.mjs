import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHQServer } from '../server.mjs';

const CLOUD = ['codex', 'claude', 'gemini', 'copilot'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check) {
  const end = Date.now() + 3500;
  do { const result = await check(); if (result) return result; await pause(15); } while (Date.now() < end);
  assert.fail('Expected local-only state was not reached');
}

async function fixture(t, options = {}) {
  const directory = options.directory ?? await mkdtemp(path.join(tmpdir(), 'imperium-local-only-'));
  const dataDir = path.join(directory, 'data');
  const workspace = path.join(directory, 'project');
  await mkdir(workspace, { recursive: true });
  const calls = [], detections = [], discoveries = [];
  const providers = {
    async detectProviders(...args) {
      detections.push(args);
      return [...CLOUD, 'ollama'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true, version: 'mock-no-network', detail: 'Offline test provider' }));
    },
    async startProvider(input) {
      let ended = false;
      calls.push({ ...input, complete() { if (!ended) { ended = true; input.onExit({ code: 0, output: '로컬 테스트 결과' }); } } });
      return { cancel() { if (!ended) { ended = true; input.onExit({ code: 130, error: 'Cancelled' }); } } };
    },
  };
  const app = createHQServer({
    dataDir, workspace, port: 0, providers,
    privateSessionToken: options.privateSessionToken,
    terminalManager: { closeAll() {}, list: () => [] },
    modelDiscovery: async id => { discoveries.push(id); return { models: [{ id: id === 'ollama' ? 'local-model:7b' : 'cloud-test-model', name: id, source: id === 'ollama' ? 'local' : 'alias' }], detail: 'No external request was made' }; },
  });
  const { url } = await app.start();
  const session = options.privateSessionToken ? { 'x-imperium-session': options.privateSessionToken } : {};
  const get = route => fetch(`${url}${route}`, { headers: session });
  const state = async () => (await get('/api/state')).json();
  const initial = await state();
  const request = (route, body, method = 'POST', headers = {}) => fetch(`${url}${route}`, {
    method, headers: { 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken, ...session, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function success(route, body, method = 'POST') {
    const response = await request(route, body, method); const value = await response.json();
    assert.ok(response.ok, `${route}: ${response.status} ${JSON.stringify(value)}`); return value;
  }
  const department = async (provider, extra = {}) => (await success('/api/departments', { name: `사용자 ${provider} 부서`, provider, role: '사용자가 지정한 작업만 수행합니다.', ...extra })).department;
  const task = async (departmentId, extra = {}) => (await success('/api/tasks', { departmentId, prompt: '오프라인 테스트 작업', permission: 'read-only', ...extra })).task;
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await app.close(); } };
  t.after(async () => { await close(); if (!options.keepData) await rm(directory, { recursive: true, force: true }); });
  return { app, directory, workspace, url, initial, calls, detections, discoveries, get, state, request, success, department, task, close };
}

function assertLocalStatuses(state) {
  assert.equal(state.settings.localOnly, true);
  for (const id of CLOUD) {
    const provider = state.providers.find(value => value.id === id);
    assert.ok(provider, `the disabled ${id} connection should remain visible`);
    assert.equal(provider.status, 'disabled');
    assert.equal(provider.authenticated, false);
  }
  const local = state.providers.find(value => value.id === 'ollama');
  assert.equal(local.status, 'ready');
  assert.equal(local.authenticated, true);
}

test('fresh data starts with an empty saved canvas and local-only is an explicit persisted choice', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'imperium-local-restart-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const before = await fixture(t, { directory, keepData: true });
  assert.equal(before.initial.settings.localOnly, false);
  assert.equal(before.initial.tasks.length, 0);
  assert.deepEqual((await (await before.get('/api/graph')).json()).graph, { nodes: [], edges: [] });
  await before.success('/api/settings', { localOnly: true });
  assertLocalStatuses(await before.state());
  await before.close();
  const after = await fixture(t, { directory, keepData: true });
  assertLocalStatuses(after.initial);
  assert.equal(after.calls.length, 0, 'reopening the application must not launch a model');
  await after.close();
});

test('enabling local-only refreshes and overrides cloud readiness reported by an injected detector', async t => {
  const f = await fixture(t);
  assert.equal(f.initial.providers.find(value => value.id === 'codex').status, 'ready');
  const previousDetections = f.detections.length;
  await f.success('/api/settings', { localOnly: true });
  assert.ok(f.detections.length > previousDetections, 'the settings response must await a fresh provider status');
  assertLocalStatuses(await f.state());
  await f.success('/api/settings', { localOnly: false });
  const normal = await f.state();
  assert.equal(normal.settings.localOnly, false);
  assert.equal(normal.providers.find(value => value.id === 'codex').status, 'ready');
  assert.equal(normal.providers.find(value => value.id === 'codex').authenticated, true);
  assert.equal((await f.request('/api/settings', { localOnly: 'false' })).status, 400);
  assert.equal((await f.state()).settings.localOnly, false);
});

test('local-only rejects every cloud execution path before queueing even when connections remain registered', async t => {
  const f = await fixture(t);
  const localDepartment = await f.department('ollama');
  const connection = (await f.success('/api/providers/register', { providerId: 'codex', label: '나중에 사용할 Codex', modelId: 'cloud-test-model' })).connection;
  await f.success('/api/settings', { localOnly: true });
  for (const provider of CLOUD) {
    const response = await f.request('/api/tasks', { departmentId: localDepartment.id, provider, prompt: 'Must be blocked', permission: 'read-only' });
    assert.equal(response.status, 403, `${provider} must be blocked by the mode rather than merely appear offline`);
  }
  const throughConnection = await f.request('/api/tasks', { departmentId: localDepartment.id, connectionId: connection.id, prompt: 'Must also be blocked' });
  assert.equal(throughConnection.status, 403);
  const kept = await f.success('/api/providers/register', { providerId: 'claude', label: '보관한 Claude 연결', modelId: 'sonnet' });
  assert.equal(kept.connection.providerId, 'claude');
  assert.equal((await f.state()).tasks.length, 0);
  assert.equal(f.calls.length, 0);
});

test('local-only prevents cloud model discovery while allowing the local Ollama catalog', async t => {
  const f = await fixture(t);
  await f.success('/api/settings', { localOnly: true });
  for (const provider of CLOUD) assert.equal((await f.get(`/api/providers/${provider}/models`)).status, 403);
  assert.deepEqual(f.discoveries, [], 'a rejected catalog request must not call a cloud account probe');
  const response = await f.get('/api/providers/ollama/models');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).models[0].id, 'local-model:7b');
  assert.deepEqual(f.discoveries, ['ollama']);
});

test('a user-created department can run its registered local model without invoking a cloud runner', async t => {
  const f = await fixture(t);
  await f.success('/api/settings', { localOnly: true });
  const connection = (await f.success('/api/providers/register', { providerId: 'ollama', label: '내 PC 모델', modelId: 'local-model:7b' })).connection;
  const department = await f.department('ollama', { name: '내 로컬 개발실', connectionId: connection.id });
  assert.equal(department.name, '내 로컬 개발실');
  const task = await f.task(department.id);
  await eventually(() => f.calls.length === 1);
  assert.equal(f.calls[0].provider, 'ollama');
  assert.equal(f.calls[0].modelId, 'local-model:7b');
  assert.equal(f.calls[0].memory, undefined, 'local generation must not launch a remote-provider MCP worker');
  assert.equal((await f.state()).tasks.find(value => value.id === task.id).connectionId, connection.id);
  f.calls[0].complete();
  await eventually(async () => (await f.state()).tasks.find(value => value.id === task.id)?.status === 'completed');
  assert.ok(f.calls.every(call => call.provider === 'ollama'));
});

test('local-only cannot change while work is running or queued and becomes editable after completion', async t => {
  const f = await fixture(t);
  const cloud = await f.department('codex');
  await f.task(cloud.id);
  await eventually(() => f.calls.length === 1);
  assert.equal((await f.request('/api/settings', { localOnly: true })).status, 409);
  assert.equal((await f.state()).settings.localOnly, false);
  f.calls[0].complete();
  await eventually(async () => (await f.state()).tasks.every(value => value.status === 'completed'));
  await f.success('/api/settings', { localOnly: true });
  const first = await f.department('ollama', { name: '로컬 부서 하나' });
  const second = await f.department('ollama', { name: '로컬 부서 둘' });
  const active = await f.task(first.id);
  const pending = await f.task(second.id);
  await eventually(() => f.calls.length === 2);
  assert.equal((await f.state()).tasks.find(value => value.id === pending.id).status, 'queued');
  assert.equal((await f.request('/api/settings', { localOnly: false })).status, 409);
  assert.equal((await f.state()).settings.localOnly, true);
  await f.success(`/api/tasks/${pending.id}/cancel`, {});
  await f.success(`/api/tasks/${active.id}/cancel`, {});
  await eventually(async () => (await f.state()).tasks.every(value => !['running', 'queued'].includes(value.status)));
  await f.success('/api/settings', { localOnly: false });
  assert.equal((await f.state()).settings.localOnly, false);
});

test('local-only settings keep the desktop private-session and CSRF requirements', async t => {
  const token = 'LOCAL_MODE_PRIVATE_APP_SESSION';
  const f = await fixture(t, { privateSessionToken: token });
  assert.equal((await fetch(`${f.url}/api/state`)).status, 403);
  const body = JSON.stringify({ localOnly: true });
  const withoutCSRF = await fetch(`${f.url}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-imperium-session': token }, body });
  assert.equal(withoutCSRF.status, 403);
  const withoutSession = await fetch(`${f.url}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hq-token': f.initial.server.csrfToken }, body });
  assert.equal(withoutSession.status, 403);
  assert.equal((await f.state()).settings.localOnly, false);
  await f.success('/api/settings', { localOnly: true });
  const snapshot = await f.state();
  assertLocalStatuses(snapshot);
  assert.ok(!JSON.stringify(snapshot).includes(token));
});
