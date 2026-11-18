import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createHQServer } from '../server.mjs';
import { createEventParser } from '../lib/providers.mjs';
import { createAdditionalEventParser } from '../lib/additional-providers.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Node 24 fetch replaces Host with the destination host. Raw HTTP is required
// to exercise server-side Host validation and explicit oversized request bodies.
function rawJSON(url, body, headers = {}) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        connection: 'close',
        ...headers,
      },
    }, (response) => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('HTTP test request timed out')));
    request.end(payload);
  });
}

async function eventually(check, message = 'condition did not become true') {
  const deadline = Date.now() + 3500;
  let result;
  do {
    result = await check();
    if (result) return result;
    await delay(15);
  } while (Date.now() < deadline);
  assert.fail(message);
}

function controlledProviders() {
  const calls = [];
  const providers = {
    detectProviders: async () => ['codex', 'claude'].map((id) => ({
      id,
      name: id === 'codex' ? 'ChatGPT / Codex' : 'Claude Code',
      installed: true,
      authenticated: true,
      status: 'ready',
      version: 'test',
      detail: 'Test provider: no external model is called',
      loginCommand: `${id} login`,
    })),
    startProvider: async (options) => {
      options.onEvent({ type: 'session', sessionId: options.resumeSessionId || randomUUID(), source: 'cli-session' });
      const call = { ...options, cancelled: 0, ended: false };
      call.emit = (text) => options.onEvent({ type: 'text', text });
      call.finish = (output = '작업 완료') => {
        if (call.ended) return;
        call.ended = true;
        options.onExit({ code: 0, output, usage: { inputTokens: 7, outputTokens: 11 } });
      };
      calls.push(call);
      return {
        cancel() {
          call.cancelled += 1;
          if (!call.ended) {
            call.ended = true;
            options.onExit({ code: null, error: 'Cancelled' });
          }
        },
      };
    },
  };
  return { providers, calls };
}

async function fixture(t, options = {}) {
  const dataDir = options.dataDir ?? await mkdtemp(path.join(tmpdir(), 'hq-server-test-'));
  const control = options.control ?? controlledProviders();
  const app = createHQServer({ dataDir, workspace: dataDir, port: 0, providers: control.providers });
  const { url } = await app.start();
  const initial = await (await fetch(`${url}/api/state`)).json();
  const token = initial.server.csrfToken;
  assert.ok(token, 'state must provide the per-server mutation token');
  let closed = false;
  async function close() {
    if (!closed) {
      closed = true;
      await app.close();
    }
  }
  t.after(async () => {
    await close();
    if (!options.keepData) await rm(dataDir, { recursive: true, force: true });
  });
  async function request(route, body, { method = 'POST', headers = {} } = {}) {
    return fetch(`${url}${route}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-hq-token': token, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  const state = async () => (await fetch(`${url}/api/state`)).json();
  const submit = async (overrides = {}) => {
    const response = await request('/api/tasks', {
      prompt: '프로젝트 구조를 살펴보고 계획을 한국어로 작성하세요.',
      departmentId: 'strategy',
      priority: 'normal',
      permission: 'read-only',
      ...overrides,
    });
    const body = await response.json();
    assert.ok(response.ok, `task submission failed: ${JSON.stringify(body)}`);
    assert.ok(body.task?.id);
    return body.task;
  };
  return { app, url, dataDir, token, initial, request, state, submit, close, ...control };
}

test('local mutations require a token and reject a hostile Origin even with a valid token', async (t) => {
  const f = await fixture(t);
  assert.equal(f.initial.server.mode, 'subscription-cli');
  assert.ok(f.initial.departments.some((department) => department.id === 'strategy'));
  assert.equal(f.initial.providers.length, 2);

  const noToken = await fetch(`${f.url}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello', departmentId: 'strategy' }),
  });
  assert.equal(noToken.status, 403);

  const foreignOrigin = await f.request('/api/tasks', { prompt: 'hello', departmentId: 'strategy' }, {
    headers: { origin: 'https://attacker.example' },
  });
  assert.equal(foreignOrigin.status, 403);
  const foreignHost = await rawJSON(`${f.url}/api/tasks`, { prompt: 'hello', departmentId: 'strategy' }, {
    host: 'attacker.example', 'x-hq-token': f.token,
  });
  assert.equal(foreignHost.status, 403);
  assert.equal((await f.state()).tasks.length, 0);
  assert.equal(f.calls.length, 0);
});

test('invalid input never enters the provider queue', async (t) => {
  const f = await fixture(t);
  for (const body of [
    { prompt: '   ', departmentId: 'strategy' },
    { prompt: 'hello', departmentId: 'not-a-department' },
    { prompt: 'hello', departmentId: 'strategy', provider: 'shell' },
    { prompt: 'hello', departmentId: 'strategy', permission: 'danger-full-access' },
    { prompt: 'x'.repeat(12001), departmentId: 'strategy' },
  ]) {
    const response = await f.request('/api/tasks', body);
    assert.ok(response.status >= 400 && response.status < 500, `expected validation error, got ${response.status}`);
  }
  const oversized = await rawJSON(`${f.url}/api/tasks`, { prompt: 'x'.repeat(80000), departmentId: 'strategy' }, {
    'x-hq-token': f.token,
  });
  assert.equal(oversized.status, 413);
  assert.equal((await f.state()).tasks.length, 0);
  assert.equal(f.calls.length, 0);
});

test('a maximum-length Korean instruction fits the UTF-8 request limit', async (t) => {
  const f = await fixture(t);
  const prompt = '가'.repeat(12000);
  const task = await f.submit({ prompt });
  await eventually(() => f.calls.length === 1);
  assert.equal(task.prompt, prompt);
  assert.ok(f.calls[0].prompt.includes(prompt));
  f.calls[0].finish();
  const oversized = await f.request('/api/tasks', { prompt: prompt + '가', departmentId: 'strategy' });
  assert.equal(oversized.status, 400);
  assert.equal(f.calls.length, 1);
});

test('a disconnected provider is reported honestly and cannot receive work', async (t) => {
  const control = controlledProviders();
  const detect = control.providers.detectProviders;
  control.providers.detectProviders = async () => (await detect()).map((provider) => provider.id === 'claude'
    ? { ...provider, installed: false, authenticated: false, status: 'missing', detail: 'Claude Code 설치 필요' }
    : provider);
  const f = await fixture(t, { control });
  assert.equal(f.initial.providers.find((provider) => provider.id === 'claude').status, 'missing');
  const response = await f.request('/api/tasks', { prompt: '실행할 작업', departmentId: 'engineering' });
  assert.equal(response.status, 409);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.state()).tasks.length, 0);
});

test('a prompt remains data while streamed output and token usage reach the completed task', async (t) => {
  const f = await fixture(t);
  const prompt = '한국어 폴더 C:\\작업 공간\\예제; $(whoami) `echo test` <script>alert(1)</script>';
  const task = await f.submit({ prompt });
  await eventually(() => f.calls.length === 1);
  assert.ok(f.calls[0].prompt.includes(prompt), 'the full user prompt must be passed as provider input');
  assert.equal(f.calls[0].permission, 'read-only');
  assert.equal(path.resolve(f.calls[0].cwd), path.resolve(f.dataDir));
  const output = '<img src=x onerror=alert(1)> 분석 결과';
  f.calls[0].emit(output);
  f.calls[0].finish(output);

  const completed = await eventually(async () => (await f.state()).tasks.find((item) => item.id === task.id && item.status === 'completed'));
  assert.equal(completed.output, output);
  assert.equal(completed.usage.inputTokens, 7);
  assert.equal(completed.usage.outputTokens, 11);
  assert.ok(completed.finishedAt);
});

test('public model summaries stream as timestamped status logs without inventing estimates or leaking markers', async t => {
  const f = await fixture(t), task = await f.submit(); await eventually(() => f.calls.length === 1);
  assert.match(f.calls[0].prompt, /IMPERIUM_STATUS/); assert.match(f.calls[0].prompt, /불확실하면 percent를 생략/);
  const report = `[[IMPERIUM_STATUS ${JSON.stringify({ summary: '프로젝트 파일 검토', source: 'process', reasoning: 'PRIVATE_REASONING' })}]]`;
  const before = Date.now(); for (const char of report) f.calls[0].emit(char);
  let snapshot = await f.state(), current = snapshot.tasks.find(value => value.id === task.id);
  assert.equal(current.progress, undefined); assert.equal(current.output, '');
  assert.deepEqual(current.logs.filter(log => log.source === 'model-summary').map(log => [log.type, log.text]), [['status', '프로젝트 파일 검토']]);
  const entry = current.logs.find(log => log.source === 'model-summary'); assert.ok(Date.parse(entry.timestamp) >= before && Date.parse(entry.timestamp) <= Date.now());
  assert.ok(snapshot.events.some(event => event.taskId === task.id && event.type === 'status' && event.text === entry.text && event.source === 'model-summary'));
  f.calls[0].emit(report); f.calls[0].emit('[[IMPERIUM_PROGRESS {"percent":20,"stage":"구현"}]][[IMPERIUM_PROGRESS {"percent":45,"stage":"구현"}]]');
  f.calls[0].emit('[[IMPERIUM_PROGRESS {"percent":60,"stage":"검증"}]]결과 본문');
  snapshot = await f.state(); current = snapshot.tasks.find(value => value.id === task.id);
  assert.deepEqual(current.logs.filter(log => log.source === 'model-summary').map(log => log.text), ['프로젝트 파일 검토']);
  assert.deepEqual(current.logs.filter(log => log.source === 'model-estimate').map(log => log.text), ['구현', '검증']);
  assert.equal(current.progress.percent, 60); assert.equal(current.progress.source, 'model-estimate'); assert.equal(current.output, '결과 본문');
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_REASONING'));
  f.calls[0].finish(); const completed = await eventually(async () => (await f.state()).tasks.find(value => value.id === task.id && value.status === 'completed'));
  assert.equal(completed.output, '결과 본문'); assert.equal(completed.progress.source, 'process'); assert.equal(completed.progress.percent, 100);
});

test('final-only provider output strips public status, progress and skill markers while retaining broken literals', async t => {
  const f = await fixture(t), task = await f.submit(); await eventually(() => f.calls.length === 1);
  const broken = '[[IMPERIUM_STATUS {bad}]]';
  f.calls[0].finish(`[[IMPERIUM_STATUS {"summary":"결과 검증"}]][[IMPERIUM_PROGRESS {"percent":99}]][[IMPERIUM_SKILL {"name":"review"}]]최종 결과 ${broken}`);
  const completed = await eventually(async () => (await f.state()).tasks.find(value => value.id === task.id && value.status === 'completed'));
  assert.equal(completed.output, `최종 결과 ${broken}`); assert.ok(!completed.output.includes('결과 검증'));
});

test('skill logs distinguish actual Claude calls, skill-document Read attempts and explicit model reports', async t => {
  const f = await fixture(t), task = await f.submit({ provider: 'claude' }); await eventually(() => f.calls.length === 1);
  assert.match(f.calls[0].prompt, /IMPERIUM_SKILL/); assert.match(f.calls[0].prompt, /보유하거나 설치만 한 스킬은 보고하지/);
  const parser = createEventParser('claude', event => f.calls[0].onEvent(event));
  const blocks = [{ type: 'tool_use', id: 'skill-read', name: 'Read', input: { file_path: '/local/private/skills/review/SKILL.md' } }, { type: 'tool_use', id: 'skill-call', name: 'Skill', input: { skill: 'review', args: 'PRIVATE_ARGS' } }];
  for (const block of blocks) {
    parser.consume({ type: 'stream_event', event: { type: 'content_block_start', content_block: { ...block, input: {} } } });
    parser.consume({ type: 'assistant', message: { id: `message-${block.id}`, content: [block] } });
    parser.consume({ type: 'assistant', message: { id: `message-${block.id}`, content: [block] } });
  }
  const report = '[[IMPERIUM_SKILL {"name":"review","source":"cli-skill-call","phase":"completed","thinking":"PRIVATE_THOUGHT"}]]';
  for (const char of report) f.calls[0].emit(char); f.calls[0].emit(report);
  f.calls[0].onEvent({ type: 'skill', text: 'forged', source: 'process', phase: 'completed' });
  const snapshot = await f.state(), current = snapshot.tasks.find(value => value.id === task.id), skills = current.logs.filter(log => log.type === 'skill');
  assert.deepEqual(skills.map(log => [log.text, log.source, log.phase]), [['review', 'cli-skill-read', 'invoked'], ['review', 'cli-skill-call', 'invoked'], ['review', 'model-reported', undefined]]);
  assert.ok(skills.every(log => Number.isFinite(Date.parse(log.timestamp)))); assert.equal(current.output, ''); assert.equal(current.progress, undefined);
  assert.deepEqual(snapshot.events.filter(event => event.taskId === task.id && event.type === 'skill').map(event => event.source), ['cli-skill-read', 'cli-skill-call', 'model-reported']);
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_')); assert.ok(!JSON.stringify(snapshot).includes('/local/private/'));
  f.calls[0].emit('최종 공개 결과'); f.calls[0].finish();
  assert.equal((await eventually(async () => (await f.state()).tasks.find(value => value.id === task.id && value.status === 'completed'))).output, '최종 공개 결과');
});

test('hidden reasoning and thinking channels cannot inject public summary markers or private text into task logs', async t => {
  const f = await fixture(t), task = await f.submit(); await eventually(() => f.calls.length === 1);
  const hidden = 'PRIVATE_REASONING [[IMPERIUM_STATUS {"summary":"PRIVATE_SUMMARY"}]][[IMPERIUM_SKILL {"name":"PRIVATE_SKILL"}]]';
  const onEvent = event => f.calls[0].onEvent(event);
  const codex = createEventParser('codex', onEvent);
  codex.consume({ type: 'item.started', item: { type: 'reasoning', text: hidden, summary: hidden } });
  codex.consume({ type: 'item.completed', item: { type: 'reasoning', text: hidden, summary: hidden } });
  const claude = createEventParser('claude', onEvent);
  claude.consume({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'thinking', thinking: hidden } } });
  claude.consume({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: hidden } } });
  claude.consume({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: hidden }] } });
  const copilot = createAdditionalEventParser('copilot', onEvent); copilot.consume({ type: 'assistant.reasoning_delta', data: { content: hidden } });
  const ollama = createAdditionalEventParser('ollama', onEvent); ollama.consume({ thinking: hidden });
  const snapshot = await f.state(), current = snapshot.tasks.find(value => value.id === task.id);
  assert.equal(current.output, ''); assert.equal(current.progress, undefined); assert.ok(!current.logs.some(log => log.source === 'model-summary' || log.type === 'skill')); assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_'));
  codex.consume({ type: 'item.completed', item: { type: 'agent_message', text: '[[IMPERIUM_STATUS {"summary":"공개 파일 검토"}]]' } });
  assert.ok((await f.state()).tasks.find(value => value.id === task.id).logs.some(log => log.source === 'model-summary' && log.text === '공개 파일 검토'));
});

test('two writable departments sharing a workspace run sequentially', async (t) => {
  const f = await fixture(t);
  await f.request('/api/settings', { workspace: f.dataDir, maxConcurrent: 2 });
  const first = await f.submit({ permission: 'workspace-write', provider: 'codex' });
  const second = await f.submit({ permission: 'workspace-write', provider: 'claude', departmentId: 'engineering' });
  await eventually(() => f.calls.length === 1);
  await delay(60);
  assert.equal(f.calls.length, 1, 'a second writer must wait until the first exits');
  let snapshot = await f.state();
  assert.equal(snapshot.tasks.find((item) => item.id === first.id).status, 'running');
  assert.equal(snapshot.tasks.find((item) => item.id === second.id).status, 'queued');

  f.calls[0].finish();
  await eventually(() => f.calls.length === 2);
  f.calls[1].finish();
  await eventually(async () => (await f.state()).tasks.every((item) => item.status === 'completed'));
});

test('queued cancellation prevents execution and active cancellation reaches its process once', async (t) => {
  const f = await fixture(t);
  const settings = await f.request('/api/settings', { workspace: f.dataDir, maxConcurrent: 1 });
  assert.ok(settings.ok);
  const running = await f.submit();
  await eventually(() => f.calls.length === 1);
  const queued = await f.submit({ provider: 'claude', departmentId: 'engineering' });

  const cancelQueued = await f.request(`/api/tasks/${queued.id}/cancel`, {});
  assert.ok(cancelQueued.ok);
  assert.equal((await cancelQueued.json()).task.status, 'cancelled');
  const cancelRunning = await f.request(`/api/tasks/${running.id}/cancel`, {});
  assert.ok(cancelRunning.ok);
  await eventually(() => f.calls[0].cancelled === 1);
  await delay(40);
  assert.equal(f.calls.length, 1, 'cancelled queued work must never launch');
  const snapshot = await f.state();
  assert.ok(snapshot.tasks.every((item) => item.status === 'cancelled'));
});

test('restart preserves output and leaves interrupted work stopped', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'hq-restart-test-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const before = await fixture(t, { dataDir, keepData: true });
  const task = await before.submit();
  await eventually(() => before.calls.length === 1);
  before.calls[0].emit('재시작 전 남긴 작업 기록');
  await eventually(async () => (await before.state()).tasks.find((item) => item.id === task.id)?.output.includes('작업 기록'));
  await before.close();

  const after = await fixture(t, { dataDir, keepData: true });
  const restored = (await after.state()).tasks.find((item) => item.id === task.id);
  assert.ok(restored, 'task history must survive a server restart');
  assert.equal(restored.status, 'interrupted');
  assert.ok(restored.output.includes('재시작 전 남긴 작업 기록'));
  await delay(30);
  assert.equal(after.calls.length, 0, 'restored tasks must not consume the subscription automatically');
  await after.close();
});

test('language can change during active work, validates input, and survives restart', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'imperium-language-test-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const before = await fixture(t, { dataDir, keepData: true });
  const task = await before.submit();
  await eventually(() => before.calls.length === 1);

  const switched = await before.request('/api/settings', { language: 'en' });
  assert.equal(switched.status, 200, 'display language must remain changeable while a worker runs');
  assert.equal((await switched.json()).settings.language, 'en');
  let snapshot = await before.state();
  assert.equal(snapshot.settings.language, 'en');
  assert.equal(snapshot.tasks.find((item) => item.id === task.id).status, 'running');
  assert.equal(before.calls.length, 1, 'changing language must not restart a worker');

  const invalid = await before.request('/api/settings', { language: 'unsupported' });
  assert.equal(invalid.status, 400);
  const workspaceChange = await before.request('/api/settings', { workspace: dataDir });
  assert.equal(workspaceChange.status, 409, 'active work still protects workspace changes');
  snapshot = await before.state();
  assert.equal(snapshot.settings.language, 'en', 'invalid settings must not overwrite the saved preference');

  before.calls[0].finish();
  await eventually(async () => (await before.state()).tasks.find((item) => item.id === task.id)?.status === 'completed');
  await before.close();
  const after = await fixture(t, { dataDir, keepData: true });
  assert.equal(after.initial.settings.language, 'en');
  assert.equal(after.calls.length, 0);
  await after.close();
});

test('the SSE stream publishes real task state changes', async (t) => {
  const f = await fixture(t);
  const abort = new AbortController();
  const response = await fetch(`${f.url}/api/events`, { signal: abort.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  t.after(async () => {
    abort.abort();
    await reader.cancel().catch(() => {});
  });
  const task = await f.submit();
  let buffer = '';
  let observed = false;
  const stop = setTimeout(() => abort.abort(), 3500);
  try {
    while (!observed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const message = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (!message.includes('event: state')) continue;
        const line = message.split('\n').find((item) => item.startsWith('data:'));
        if (line) observed ||= JSON.parse(line.slice(5)).tasks.some((item) => item.id === task.id);
      }
    }
  } finally {
    clearTimeout(stop);
    abort.abort();
  }
  assert.ok(observed, 'a dispatched task must appear in the event stream');
});

test('cancelling a writer holds the workspace lock until its process exits', async (t) => {
  const control = controlledProviders();
  const originalStart = control.providers.startProvider;
  control.providers.startProvider = async options => {
    await originalStart(options);
    const call = control.calls.at(-1);
    return { cancel() { call.cancelled += 1; } };
  };
  const f = await fixture(t, { control });
  const first = await f.submit({ permission: 'workspace-write' });
  await eventually(() => f.calls.length === 1);
  await f.submit({ departmentId: 'engineering', permission: 'workspace-write' });
  const cancelled = await f.request(`/api/tasks/${first.id}/cancel`);
  assert.equal(cancelled.status, 200);
  await delay(80);
  assert.equal(f.calls.length, 1, 'a second writer must wait for the cancelled process to stop');
  assert.equal(f.calls[0].cancelled, 1);
  f.calls[0].finish('ignored cancelled output');
  await eventually(() => f.calls.length === 2);
  assert.equal((await f.state()).tasks.find(item => item.id === first.id).status, 'cancelled');
  f.calls[1].finish();
});

test('export contains persisted results and department routing', async (t) => {
  const f = await fixture(t);
  const task = await f.submit();
  await eventually(() => f.calls.length === 1);
  f.calls[0].finish('내보낼 보고서');
  await eventually(async () => (await f.state()).tasks.find((item) => item.id === task.id)?.status === 'completed');
  const response = await fetch(`${f.url}/api/export`);
  assert.ok(response.ok);
  const exported = await response.json();
  assert.ok(exported.departments.some((department) => department.id === 'strategy'));
  const exportedTask = exported.tasks.find((item) => item.id === task.id);
  assert.equal(exportedTask.output, '내보낼 보고서');
  assert.equal(exportedTask.provider, 'codex');
});

test('shutdown closes an unfinished request and releases its listening socket even when saving fails', async t => {
  const f = await fixture(t);
  const pending = http.request(`${f.url}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hq-token': f.token, 'content-length': 1000 } });
  pending.on('error', () => {});
  t.after(() => pending.destroy());
  pending.write('{');
  await delay(30);
  const save = f.app.store.save;
  f.app.store.save = () => { throw Object.assign(new Error('Controlled disk failure'), { code: 'EACCES' }); };
  const started = Date.now();
  try { await assert.rejects(f.close(), /Controlled disk failure/); }
  finally { f.app.store.save = save; }
  assert.equal(f.app.server.listening, false);
  assert.ok(Date.now() - started < 4000, 'shutdown must not wait for the 15-second upload timeout');
});
