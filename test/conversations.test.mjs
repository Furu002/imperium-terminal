import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createHQServer } from '../server.mjs';
import { createUISnapshot } from '../lib/ui-snapshot.mjs';
import { assignConversation, validateConversationRequest, normalizeConversations, captureConversationMetadata, conversationRunContext, pruneConversations, CONVERSATION_HISTORY_LIMIT } from '../lib/conversations.mjs';

const SESSION_A = '11111111-1111-4111-8111-111111111111', SESSION_B = '22222222-2222-4222-8222-222222222222';
const workspace = path.resolve('conversation-fixture');
const context = (extra = {}) => ({ workspace, departmentId: 'engineering', provider: 'claude', connectionId: null, modelId: 'configured', permission: 'read-only', ...extra });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check) { const end = Date.now() + 3000; while (Date.now() < end) { const result = await check(); if (result) return result; await delay(10); } assert.fail('Offline conversation state was not reached'); }

async function fixture(t) {
  const parent = await realpath(tmpdir()), directory = await realpath(await mkdtemp(path.join(parent, 'imperium-conversation-')));
  const calls = [], dataDir = path.join(directory, 'data');
  const providers = {
    detectProviders: async () => ['codex', 'claude', 'gemini', 'copilot', 'ollama'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true })),
    startProvider: async options => {
      const call = { ...options, ended: false, emit(event) { options.onEvent(event); }, finish(result = {}) { if (call.ended) return; call.ended = true; options.onExit({ code: 0, output: 'Offline assistant answer', ...result }); } };
      calls.push(call); return { cancel() { call.finish({ code: 130, error: 'Offline cancellation' }); } };
    },
  };
  let app, url, token, closed;
  async function boot() {
    app = createHQServer({ dataDir, workspace: directory, port: 0, providers });
    ({ url } = await app.start()); closed = false; token = (await state()).server.csrfToken;
  }
  async function state() { return (await fetch(`${url}/api/state`)).json(); }
  async function close() { if (!closed) { closed = true; app.server.closeAllConnections(); await app.close(); } }
  const request = (route, body, method = 'POST') => fetch(`${url}${route}`, { method, headers: { 'content-type': 'application/json', 'x-hq-token': token }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  async function submit(extra = {}) { const response = await request('/api/tasks', { departmentId: 'engineering', provider: 'claude', prompt: 'Offline user message', modelId: 'configured', permission: 'read-only', ...extra }); const value = await response.json(); assert.equal(response.status, 201, JSON.stringify(value)); return value.task; }
  await boot();
  t.after(async () => {
    await close(); const relative = path.relative(parent, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(directory).startsWith('imperium-conversation-'));
    await rm(directory, { recursive: true, force: true });
  });
  return { get app() { return app; }, get url() { return url; }, directory, dataDir, calls, state, request, submit, close, async restart() { await close(); await boot(); } };
}

test('conversation keys isolate workspace, agent, provider, connection, requested model and file permission', () => {
  const state = { conversations: [], tasks: [] }, first = assignConversation(state, {}, context());
  assert.notEqual(assignConversation(state, {}, context()).id, first.id);
  assert.equal(assignConversation(state, { conversationId: first.id }, context()).id, first.id);
  for (const difference of [{ workspace: path.resolve('other-project') }, { departmentId: 'quality' }, { provider: 'codex' }, { connectionId: 'other-account' }, { modelId: 'other-model' }, { permission: 'workspace-write' }]) assert.notEqual(assignConversation(state, {}, context(difference)).id, first.id);
  assert.notEqual(assignConversation(state, { newConversation: true }, context()).id, first.id);
  assert.throws(() => validateConversationRequest(state, { conversationId: first.id }, context({ permission: 'workspace-write' })), error => error.status === 409);
  assert.throws(() => validateConversationRequest(state, { conversationId: first.id }, context({ workspace: path.resolve('other-project') })), error => error.status === 404);
  for (const bad of [{ resumeSessionId: SESSION_A }, { sessionId: SESSION_A }, { conversationId: SESSION_A }, { conversationId: '../../other' }, { newConversation: 'true' }, { newConversation: true, conversationId: first.id }]) assert.throws(() => validateConversationRequest(state, bad, context()));
});

test('only strict captured CLI metadata becomes a native session; a session cannot move between conversations', () => {
  const state = { conversations: [], tasks: [] }, first = assignConversation(state, {}, context());
  const task = { id: 'one', ...context(), conversationId: first.id };
  for (const event of [{ type: 'session', sessionId: 'not-a-uuid', source: 'cli-session' }, { type: 'session', sessionId: SESSION_A, source: 'model-reported' }, { type: 'execution-model', model: 'made-up', source: 'model-reported' }, { type: 'execution-model', model: '--invalid', source: 'cli' }]) assert.equal(captureConversationMetadata(state, task, event), false);
  assert.equal(conversationRunContext(state, task).resumeSessionId, undefined);
  assert.equal(captureConversationMetadata(state, task, { type: 'session', sessionId: SESSION_A, source: 'cli-session' }), true);
  assert.equal(captureConversationMetadata(state, task, { type: 'session', sessionId: SESSION_B, source: 'cli-session' }), false);
  assert.equal(captureConversationMetadata(state, task, { type: 'execution-model', model: 'actual-model', source: 'cli' }), true);
  assert.equal(task.modelId, 'configured'); assert.equal(task.reportedModel, 'actual-model');
  const second = assignConversation(state, { newConversation: true }, context()), next = { ...task, id: 'two', conversationId: second.id };
  assert.equal(captureConversationMetadata(state, next, { type: 'session', sessionId: SESSION_A, source: 'cli-session' }), false);
  assert.equal(captureConversationMetadata(state, next, { type: 'session', sessionId: SESSION_B, source: 'cli-session' }), true);
  assert.equal(conversationRunContext(state, task).resumeSessionId, SESSION_A); assert.equal(conversationRunContext(state, next).resumeSessionId, SESSION_B);
  const loaded = normalizeConversations([...state.conversations, { ...second, id: randomUUID() }]);
  assert.equal(loaded.filter(item => item.sessionId === SESSION_B).length, 1);
  const untrusted = normalizeConversations([{ ...first, sessionSource: 'model-reported' }]); assert.equal(untrusted[0].sessionId, undefined);
});

test('bounded history context includes only completed real turns in the same conversation and remains quoted JSON', () => {
  const state = { conversations: [], tasks: [] }, config = context({ provider: 'copilot' }), conversation = assignConversation(state, {}, config);
  const current = { ...config, id: 'current', conversationId: conversation.id, prompt: 'Continue now' };
  const previous = (id, extra = {}) => ({ ...config, id, conversationId: conversation.id, status: 'completed', createdAt: `2026-11-01T00:00:0${id}Z`, finishedAt: `2026-11-01T00:00:0${id}Z`, prompt: 'previous user', output: 'previous assistant', ...extra });
  state.tasks = [previous('1'), previous('2', { demo: true, output: 'DEMO_SECRET' }), previous('3', { status: 'failed', output: 'FAILED_SECRET' }), previous('4', { workspace: path.resolve('other-project'), output: 'PROJECT_SECRET' }), previous('5', { conversationId: randomUUID(), output: 'CONVERSATION_SECRET' }), current];
  let result = conversationRunContext(state, current);
  assert.equal(result.transport, 'history-context'); assert.equal(result.resumeSessionId, undefined);
  assert.match(result.historyContext, /previous user/); assert.match(result.historyContext, /previous assistant/); assert.ok(!/SECRET/.test(result.historyContext));
  state.tasks[0].prompt = '"\\\n'.repeat(6000); state.tasks[0].output = '🙂긴 답변'.repeat(5000);
  result = conversationRunContext(state, current); assert.ok(result.historyContext.length <= CONVERSATION_HISTORY_LIMIT);
  const history = JSON.parse(result.historyContext.slice(result.historyContext.indexOf('\n[') + 1));
  assert.deepEqual(history.map(turn => turn.role), ['user', 'assistant']);
  assert.ok(history.every(turn => !/[\uD800-\uDBFF]$/.test(turn.content)));
  assert.ok(conversationRunContext(state, current, { historyLimit: 1000 }).historyContext.length <= 1000);
});

test('conversation pruning retains every conversation referenced by a saved or active task', () => {
  const state = { conversations: [], tasks: [] };
  for (let index = 0; index < 7; index++) { const conversation = assignConversation(state, { newConversation: true }, context()); if (index < 4) state.tasks.push({ conversationId: conversation.id, status: index ? 'completed' : 'running' }); }
  const retained = state.tasks.map(task => task.conversationId); pruneConversations(state, 2);
  assert.equal(state.conversations.length, 4); assert.ok(retained.every(id => state.conversations.some(conversation => conversation.id === id)));
});

test('two queued native followups resolve the captured session at execution time only after the previous exit', async t => {
  const f = await fixture(t);
  for (const provider of ['codex', 'claude']) {
    const start = f.calls.length, first = await f.submit({ provider }); await eventually(() => f.calls.length === start + 1);
    const second = await f.submit({ provider, conversationId: first.conversationId, prompt: 'Follow up one', priority: 'normal' }), third = await f.submit({ provider, conversationId: first.conversationId, prompt: 'Follow up two', priority: 'high' });
    assert.equal(first.conversationId, second.conversationId); assert.equal(second.conversationId, third.conversationId); assert.equal(f.calls.length, start + 1);
    const nativeId = provider === 'codex' ? SESSION_A : SESSION_B;
    f.calls[start].finish({ sessionId: nativeId, reportedModel: 'actual-cli-model' }); await eventually(() => f.calls.length === start + 2);
    assert.equal(f.calls[start + 1].resumeSessionId, nativeId); assert.equal(f.calls.length, start + 2);
    assert.match(f.calls[start + 1].prompt, /Follow up one/);
    f.calls[start + 1].finish(); await eventually(() => f.calls.length === start + 3);
    assert.equal(f.calls[start + 2].resumeSessionId, nativeId); f.calls[start + 2].finish();
    assert.match(f.calls[start + 2].prompt, /Follow up two/);
    await eventually(async () => (await f.state()).tasks.find(task => task.id === third.id).status === 'completed');
    const reported = (await f.state()).tasks.find(task => task.id === first.id); assert.equal(reported.modelId, 'configured'); assert.equal(reported.reportedModel, 'actual-cli-model');
  }
});

test('owned conversation validation rejects foreign IDs and configuration changes; native resume failure never silently retries', async t => {
  const f = await fixture(t), first = await f.submit(); await eventually(() => f.calls.length === 1);
  f.calls[0].emit({ type: 'session', sessionId: SESSION_A, source: 'cli-session' }); f.calls[0].finish();
  await eventually(async () => (await f.state()).tasks[0].status === 'completed');
  for (const extra of [{ modelId: 'other' }, { permission: 'workspace-write' }, { provider: 'codex' }, { departmentId: 'quality' }]) {
    const response = await f.request('/api/tasks', { departmentId: 'engineering', provider: 'claude', prompt: 'Rejected', modelId: 'configured', permission: 'read-only', conversationId: first.conversationId, ...extra }); assert.equal(response.status, 409);
  }
  for (const extra of [{ resumeSessionId: SESSION_A }, { sessionId: SESSION_A }, { conversationId: SESSION_A }, { conversationId: first.conversationId, newConversation: true }]) assert.ok([400, 404].includes((await f.request('/api/tasks', { departmentId: 'engineering', provider: 'claude', prompt: 'Rejected', modelId: 'configured', ...extra })).status));
  const followup = await f.submit({ conversationId: first.conversationId }); await eventually(() => f.calls.length === 2);
  assert.equal(f.calls[1].resumeSessionId, SESSION_A); f.calls[1].finish({ code: 1, error: 'Native resume unavailable' });
  await eventually(async () => (await f.state()).tasks.find(task => task.id === followup.id).status === 'failed'); await delay(25); assert.equal(f.calls.length, 2);
  const fresh = await f.submit({ newConversation: true }); await eventually(() => f.calls.length === 3);
  assert.notEqual(fresh.conversationId, first.conversationId); assert.equal(f.calls[2].resumeSessionId, undefined); f.calls[2].finish();
  await eventually(async () => (await f.state()).tasks.find(task => task.id === fresh.id).status === 'completed');
  const other = path.join(f.directory, 'other'); await mkdir(other); assert.equal((await f.request('/api/settings', { workspace: other })).status, 200);
  const created = await f.request('/api/departments', { name: 'Other agent', role: 'Offline other project', provider: 'claude' }); assert.equal(created.status, 201);
  const otherAgent = (await created.json()).department;
  assert.equal((await f.request('/api/tasks', { departmentId: otherAgent.id, provider: 'claude', prompt: 'Foreign', modelId: 'configured', conversationId: first.conversationId })).status, 404);
  const snapshot = await f.state(); assert.equal(snapshot.conversations.length, 0); assert.ok(!JSON.stringify(snapshot).includes(SESSION_A));
});

test('native metadata persists across restart, while UI snapshots expose only current project conversation summaries', async t => {
  const f = await fixture(t), first = await f.submit(); await eventually(() => f.calls.length === 1);
  f.calls[0].emit({ type: 'session', sessionId: 'invalid', source: 'cli-session' });
  f.calls[0].emit({ type: 'execution-model', model: 'guessed-from-text', source: 'model-reported' });
  f.calls[0].emit({ type: 'session', sessionId: SESSION_A, source: 'cli-session' });
  f.calls[0].emit({ type: 'execution-model', model: 'actual-claude', source: 'cli' }); f.calls[0].finish();
  await eventually(async () => (await f.state()).tasks[0].status === 'completed');
  const snapshot = await f.state(); assert.equal(snapshot.conversations[0].sessionReady, true); assert.equal(snapshot.conversations[0].transport, 'native-cli');
  assert.ok(!JSON.stringify(snapshot).includes(SESSION_A)); assert.equal(snapshot.tasks[0].reportedModel, 'actual-claude'); assert.ok(!snapshot.tasks[0].output.includes(SESSION_A));
  const exported = await f.request('/api/export', undefined, 'GET'); assert.equal(exported.status, 200); assert.ok(!(await exported.text()).includes(SESSION_A));
  const persisted = JSON.parse(await readFile(path.join(f.dataDir, 'state.json'), 'utf8')); assert.equal(persisted.conversations[0].sessionId, SESSION_A);
  const foreign = { ...persisted.conversations[0], id: randomUUID(), workspace: path.resolve('foreign-conversation'), modelId: 'FOREIGN_MODEL_SECRET' };
  const bounded = createUISnapshot({ ...persisted, conversations: [...persisted.conversations, foreign] }); assert.equal(bounded.conversations.length, 1); assert.ok(!JSON.stringify(bounded).includes('FOREIGN_MODEL_SECRET'));
  await f.restart(); const followup = await f.submit({ conversationId: first.conversationId }); await eventually(() => f.calls.length === 2);
  assert.equal(followup.conversationId, first.conversationId); assert.equal(f.calls[1].resumeSessionId, SESSION_A);
});

test('a successful native turn without a reported session makes queued and new followups fail explicitly; a first failed turn may retry fresh', async t => {
  const f = await fixture(t), first = await f.submit(); await eventually(() => f.calls.length === 1);
  const queued = await f.submit({ conversationId: first.conversationId, prompt: 'Already queued followup' }); assert.equal(queued.conversationId, first.conversationId);
  f.calls[0].finish({ output: '' });
  await eventually(async () => (await f.state()).tasks.find(task => task.id === queued.id).status === 'failed');
  assert.equal(f.calls.length, 1); assert.match((await f.state()).tasks.find(task => task.id === queued.id).error, /CLI 실행 세션/);
  const missing = await f.request('/api/tasks', { departmentId: 'engineering', provider: 'claude', conversationId: first.conversationId, prompt: 'Unsafe continuation without a captured session', modelId: 'configured' }); assert.equal(missing.status, 409);
  const fresh = await f.submit({ newConversation: true }); await eventually(() => f.calls.length === 2);
  assert.notEqual(fresh.conversationId, first.conversationId); assert.equal(f.calls[1].resumeSessionId, undefined);
  f.calls[1].finish({ code: 1, error: 'Failed before CLI init', output: '' });
  await eventually(async () => (await f.state()).tasks.find(task => task.id === fresh.id).status === 'failed');
  const retried = await f.submit({ conversationId: fresh.conversationId }); await eventually(() => f.calls.length === 3);
  assert.equal(retried.conversationId, fresh.conversationId); assert.equal(f.calls[2].resumeSessionId, undefined);
  f.calls[2].finish({ sessionId: SESSION_B });
});

test('other providers receive bounded completed history context, never a claimed native session', async t => {
  const f = await fixture(t), first = await f.submit({ provider: 'gemini', prompt: 'ORIGINAL_USER_TURN' }); await eventually(() => f.calls.length === 1);
  f.calls[0].finish({ output: 'ORIGINAL_ASSISTANT_TURN' }); await eventually(async () => (await f.state()).tasks[0].status === 'completed');
  const second = await f.submit({ provider: 'gemini', conversationId: first.conversationId, prompt: 'Continue this conversation' }); await eventually(() => f.calls.length === 2);
  assert.equal(first.conversationId, second.conversationId); assert.equal(second.conversationTransport, 'history-context'); assert.equal(f.calls[1].resumeSessionId, undefined);
  assert.match(f.calls[1].prompt, /ORIGINAL_USER_TURN/); assert.match(f.calls[1].prompt, /ORIGINAL_ASSISTANT_TURN/);
  const snapshot = await f.state(), current = snapshot.tasks.find(task => task.id === second.id); assert.ok(current.conversationContextChars > 0 && current.conversationContextChars <= 12000); assert.equal(snapshot.conversations[0].sessionReady, false);
});

test('standalone dispatch and default workflows never resume a matching existing chat without an explicit conversation ID', async t => {
  const f = await fixture(t), chat = await f.submit(); await eventually(() => f.calls.length === 1);
  f.calls[0].finish({ sessionId: SESSION_A }); await eventually(async () => (await f.state()).tasks.find(task => task.id === chat.id).status === 'completed');
  const standalone = await f.submit(); await eventually(() => f.calls.length === 2);
  assert.notEqual(standalone.conversationId, chat.conversationId); assert.equal(f.calls[1].resumeSessionId, undefined);
  f.calls[1].finish({ sessionId: SESSION_B }); await eventually(async () => (await f.state()).tasks.find(task => task.id === standalone.id).status === 'completed');
  const workflowResponse = await f.request('/api/workflows/run', { departmentId: 'engineering', provider: 'claude', prompt: 'Independent workflow', modelId: 'configured', permission: 'read-only' });
  assert.equal(workflowResponse.status, 201); const workflow = await workflowResponse.json(); await eventually(() => f.calls.length === 3);
  assert.equal(workflow.tasks.length, 1); assert.notEqual(workflow.tasks[0].conversationId, chat.conversationId); assert.notEqual(workflow.tasks[0].conversationId, standalone.conversationId);
  assert.equal(f.calls[2].resumeSessionId, undefined); f.calls[2].finish();
});
