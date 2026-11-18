import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { createHQServer } from '../server.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check, message = 'Expected state was not reached') {
  const end = Date.now() + 3500;
  do { const value = await check(); if (value) return value; await delay(15); } while (Date.now() < end);
  assert.fail(message);
}

function fakeProviders({ deferCancel = false } = {}) {
  const calls = [];
  return {
    calls,
    providers: {
      detectProviders: async () => ['codex', 'claude', 'gemini', 'copilot', 'ollama'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true, version: 'offline-test' })),
      startProvider: async options => {
        if (['codex', 'claude'].includes(options.provider)) options.onEvent({ type: 'session', sessionId: options.resumeSessionId || randomUUID(), source: 'cli-session' });
        let ended = false;
        const call = {
          ...options,
          complete(output = '실제 프로세스를 실행하지 않은 테스트 결과', usage = { inputTokens: 3, outputTokens: 5 }) { if (ended) return; ended = true; options.onExit({ code: 0, output, usage }); },
          fail(message = 'Upstream failure') { if (ended) return; ended = true; options.onExit({ code: 1, error: message }); },
        };
        calls.push(call);
        return { cancel() { if (!ended) { call.cancelRequested = true; if (!deferCancel) { ended = true; options.onExit({ code: 130, error: 'Cancelled' }); } } } };
      },
    },
  };
}

function fakeTerminal() {
  const sessions = new Map(), writes = [], sizes = [];
  let count = 0;
  const metadata = session => Object.fromEntries(Object.entries(session).filter(([key]) => !['output', 'listeners'].includes(key)));
  const lookup = id => { const item = sessions.get(id); if (!item) throw Object.assign(new Error('Missing terminal'), { status: 404 }); return item; };
  return {
    writes, sizes,
    list: () => [...sessions.values()].map(metadata),
    start({ cwd, shell, cols = 100, rows = 28 }) {
      const id = `term_${(++count).toString(16).padStart(24, '0')}`;
      const session = { id, cwd, shell, cols, rows, status: 'running', createdAt: new Date().toISOString(), output: 'TERMINAL_INITIAL_PRIVATE\n', listeners: new Set() };
      sessions.set(id, session); return metadata(session);
    },
    get(id) { const session = lookup(id); return { ...metadata(session), output: session.output }; },
    subscribe(id, listener) { const session = lookup(id); session.listeners.add(listener); return () => session.listeners.delete(listener); },
    emit(id, data) { const session = lookup(id); session.output += data; for (const listener of session.listeners) listener({ type: 'data', data }); },
    write(id, data) { lookup(id); writes.push({ id, data }); },
    resize(id, cols, rows) { const item = lookup(id); item.cols = cols; item.rows = rows; sizes.push({ id, cols, rows }); },
    close(id) { const item = lookup(id); item.status = 'closed'; item.output = ''; for (const listener of item.listeners) listener({ type: 'exit', exitCode: 0 }); },
    closeAll() { for (const id of sessions.keys()) this.close(id); },
  };
}

async function fixture(t, options = {}) {
  const directory = options.directory ?? await mkdtemp(path.join(tmpdir(), 'imperium-workspace-api-'));
  const dataDir = path.join(directory, 'data');
  const workspace = path.join(directory, 'project-one');
  const other = path.join(directory, 'project-two');
  await mkdir(workspace, { recursive: true }); await mkdir(other, { recursive: true });
  const control = fakeProviders(options);
  const terminal = fakeTerminal();
  const modelCalls = [];
  const app = createHQServer({
    dataDir, workspace, port: 0, providers: control.providers, terminalManager: terminal,
    privateSessionToken: options.privateSessionToken,
    modelDiscovery: async id => { modelCalls.push(id); return { models: [{ id: 'offline-model', name: 'Offline model', source: 'alias' }], detail: 'Offline catalog' }; },
  });
  const { url } = await app.start();
  const sessionHeaders = options.privateSessionToken ? { 'x-imperium-session': options.privateSessionToken } : {};
  const state = async () => (await fetch(`${url}/api/state`, { headers: sessionHeaders })).json();
  const initial = await state();
  let closed = false;
  const close = async () => {
    if (!closed) {
      closed = true;
      // Test assertions may fail with a streaming client still connected.
      app.server.closeAllConnections();
      await app.close();
    }
  };
  t.after(async () => { await close(); if (!options.keepData) await rm(directory, { recursive: true, force: true }); });
  const request = (route, body, method = 'POST', headers = {}) => fetch(`${url}${route}`, {
    method, headers: { 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken, ...sessionHeaders, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function successful(route, body, method = 'POST') {
    const response = await request(route, body, method);
    const result = await response.json();
    assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(result)}`);
    return result;
  }
  const note = async (input = {}) => (await successful('/api/memory', { title: '사용자가 남긴 기억', content: '다음 실행에서도 보존할 결정', kind: 'note', ...input })).node;
  const submit = async (input = {}) => (await successful('/api/tasks', { prompt: '테스트 작업을 수행하세요.', departmentId: 'strategy', permission: 'read-only', priority: 'normal', ...input })).task;
  const get = async route => { const response = await fetch(`${url}${route}`, { headers: sessionHeaders }); assert.ok(response.ok, `${route}: ${response.status}`); return response.json(); };
  return { ...control, app, url, directory, dataDir, workspace, other, terminal, modelCalls, initial, state, request, successful, note, submit, get, close };
}

const departmentNode = id => ({ id: `department:${id}`, type: 'department', referenceId: id, x: 200, y: 300 });
const memoryNode = id => ({ id: `memory:${id}`, type: 'memory', referenceId: id, x: 0, y: 300 });
const handoff = (source, target) => ({ id: `handoff-${source}-${target}`, source: `department:${source}`, target: `department:${target}`, type: 'handoff' });

test('model progress markers update a labeled estimate without entering result text and only process success reaches 100', async t => {
  const f = await fixture(t);
  const task = await f.submit();
  await eventually(() => f.calls.length === 1);
  f.calls[0].onEvent({ type: 'text', text: '시작\n[[IMPERIUM_PRO' });
  f.calls[0].onEvent({ type: 'text', text: 'GRESS {"percent":42,"etaMinutes":3,"stage":"검토 중"}]]\n결과' });
  let current = (await f.state()).tasks.find(value => value.id === task.id);
  assert.equal(current.progress.percent, 42);
  assert.equal(current.progress.source, 'model-estimate');
  assert.equal(current.progress.etaMinutes, 3);
  assert.equal(current.output, '시작\n\n결과');
  assert.ok(current.firstOutputAt);
  assert.ok(!JSON.stringify(current.logs).includes('IMPERIUM_PROGRESS'));
  f.calls[0].complete();
  await eventually(async () => (await f.state()).tasks.find(value => value.id === task.id).status === 'completed');
  current = (await f.state()).tasks.find(value => value.id === task.id);
  assert.equal(current.progress.percent, 100);
  assert.equal(current.progress.source, 'process');
});

test('completed task snapshots stay compact while scoped details and exports retain the full result and logs', async t => {
  const f = await fixture(t);
  const homeId = (await f.get('/api/projects')).currentProjectId;
  const task = await f.submit();
  await eventually(() => f.calls.length === 1);
  const output = '한'.repeat(1999) + '😀' + 'FULL_DETAIL_TAIL'.repeat(300);
  f.calls[0].onEvent({ type: 'status', text: 'FULL_DETAIL_LOG_MARKER' });
  f.calls[0].onEvent({ type: 'text', text: output });
  f.calls[0].complete();
  const compact = await eventually(async () => {
    const value = (await f.state()).tasks.find(value => value.id === task.id);
    return value?.status === 'completed' ? value : false;
  });
  assert.equal(compact.output, '한'.repeat(1999), 'the 2000-unit preview must not split an emoji surrogate pair');
  assert.equal(compact.outputChars, output.length);
  assert.equal(compact.detailsTruncated, true);
  assert.deepEqual(compact.logs, []);
  const details = (await f.get(`/api/tasks/${task.id}`)).task;
  assert.equal(details.output, output);
  assert.ok(details.logs.some(value => value.text === 'FULL_DETAIL_LOG_MARKER'));
  const exported = (await f.get('/api/export')).tasks.find(value => value.id === task.id);
  assert.equal(exported.output, output);
  assert.deepEqual(exported.logs, details.logs);
  const project = (await f.successful('/api/projects', { name: '다른 프로젝트', color: '#123456', parentDir: f.directory })).project;
  await f.successful(`/api/projects/${project.id}/select`, {});
  const denied = await fetch(`${f.url}/api/tasks/${task.id}`);
  assert.equal(denied.status, 404);
  assert.ok(!(await denied.text()).includes('FULL_DETAIL_TAIL'));
  assert.ok(!(await f.state()).tasks.some(value => value.id === task.id));
  await f.successful(`/api/projects/${homeId}/select`, {});
  assert.equal((await f.get(`/api/tasks/${task.id}`)).task.output, output);
});

test('a cancelled task retains usage arriving at final process exit and publishes the update to UI subscribers', async t => {
  const f = await fixture(t, { deferCancel: true });
  let eventRequest, eventResponse, timer;
  try {
    const task = await f.submit();
    await eventually(() => f.calls.length === 1);
    f.calls[0].onEvent({ type: 'text', text: 'VISIBLE[[IMPERIUM_PRO' });
    const cancelled = (await f.successful(`/api/tasks/${task.id}/cancel`, {})).task;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(f.calls[0].cancelRequested, true);
    // Own a single unpooled TCP connection so failed SSE assertions cannot
    // leave an undici fetch/body cancellation or keep-alive handle pending.
    timer = setTimeout(() => eventRequest?.destroy(new Error('Timed out awaiting final usage state')), 3000);
    eventResponse = await new Promise((resolve, reject) => {
      eventRequest = http.get(`${f.url}/api/events`, { agent: false }, resolve);
      eventRequest.once('error', reject);
    });
    assert.equal(eventResponse.statusCode, 200);
    assert.match(eventResponse.headers['content-type'], /text\/event-stream/);
    const reader = eventResponse[Symbol.asyncIterator](), decoder = new TextDecoder();
    let buffer = '';
    const nextState = async check => {
      for (;;) {
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const data = frame.split('\n').find(line => line.startsWith('data: '));
          if (frame.includes('event: state') && data) {
            const value = JSON.parse(data.slice(6));
            if (check(value)) return value;
          }
        }
        const chunk = await reader.next();
        assert.equal(chunk.done, false, 'the state event stream ended before the final usage update');
        buffer += decoder.decode(chunk.value, { stream: true });
      }
    };
    await nextState(state => state.tasks.some(value => value.id === task.id && value.status === 'cancelled'));
    const usage = { inputTokens: 17, outputTokens: 23, cachedInputTokens: 5 };
    f.calls[0].complete('late process result', usage);
    const pushed = await nextState(state => state.tasks.some(value => value.id === task.id && value.usage?.inputTokens === 17));
    const updated = pushed.tasks.find(value => value.id === task.id);
    assert.equal(updated.status, 'cancelled', 'late successful exit must never revive a cancelled task');
    assert.deepEqual(updated.usage, usage);
    assert.equal(updated.usageReported, true);
    const fullTask = (await f.get(`/api/tasks/${task.id}`)).task;
    assert.deepEqual(fullTask.usage, usage);
    assert.equal(fullTask.output, 'VISIBLE[[IMPERIUM_PRO', 'cancellation must flush a partial progress marker as literal result text');
    const persisted = await eventually(async () => {
      const state = JSON.parse(await readFile(path.join(f.dataDir, 'state.json'), 'utf8'));
      return state.tasks.find(value => value.id === task.id && value.usage?.inputTokens === 17);
    }, 'final cancelled-task usage was not persisted');
    assert.equal(persisted.status, 'cancelled');
    assert.deepEqual(persisted.usage, usage);
  } finally {
    clearTimeout(timer);
    eventResponse?.destroy(); eventRequest?.destroy();
    f.calls[0]?.complete();
  }
});

test('memory HTTP CRUD enforces revisions and prevents cross-workspace modification', async t => {
  const f = await fixture(t);
  const note = await f.note();
  assert.equal(note.revision, 1);
  const updated = (await f.successful(`/api/memory/${note.id}`, { content: '검토된 변경', expectedRevision: 1 }, 'PATCH')).node;
  assert.equal(updated.revision, 2);
  assert.equal((await f.request(`/api/memory/${note.id}`, { content: 'stale', expectedRevision: 1 }, 'PATCH')).status, 409);
  await f.successful('/api/settings', { workspace: f.other });
  assert.equal((await f.get('/api/memory')).nodes.length, 0);
  assert.equal((await f.request(`/api/memory/${note.id}`, { content: 'scope escape' }, 'PATCH')).status, 404);
  assert.equal((await f.request(`/api/memory/${note.id}`, {}, 'DELETE')).status, 404);
  await f.successful('/api/settings', { workspace: f.workspace });
  assert.equal((await f.get('/api/memory')).nodes[0].content, '검토된 변경');
  await f.successful(`/api/memory/${note.id}`, {}, 'DELETE');
  assert.equal((await f.get('/api/memory')).nodes.length, 0);
});

test('editable graph connections persist across restart and remain workspace scoped', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'imperium-graph-api-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await fixture(t, { directory, keepData: true });
  const memory = await first.note();
  const graph = { nodes: [departmentNode('strategy'), departmentNode('engineering'), memoryNode(memory.id)], edges: [handoff('strategy', 'engineering'), { id: 'memory-context', source: `memory:${memory.id}`, target: 'department:strategy', type: 'memory_context' }] };
  assert.deepEqual((await first.successful('/api/graph', graph, 'PUT')).graph, graph);
  await first.successful('/api/settings', { workspace: first.other });
  assert.deepEqual((await first.get('/api/graph')).graph, { nodes: [], edges: [] });
  await first.successful('/api/settings', { workspace: first.workspace });
  await first.close();
  const after = await fixture(t, { directory, keepData: true });
  assert.deepEqual((await after.get('/api/graph')).graph, graph);
  assert.equal(after.calls.length, 0, 'saving graph edges must not launch any model');
  await after.close();
});

test('explicit workflows wait for upstream results before dispatching downstream departments', async t => {
  const f = await fixture(t);
  await f.successful('/api/graph', { nodes: ['strategy', 'engineering', 'quality'].map(departmentNode), edges: [handoff('strategy', 'engineering'), handoff('engineering', 'quality')] }, 'PUT');
  assert.equal(f.calls.length, 0);
  const workflow = await f.successful('/api/workflows/run', { departmentId: 'strategy', prompt: '설계, 구현, 검증을 순서대로 진행하세요.', permission: 'read-only' });
  assert.equal(workflow.tasks.length, 3);
  assert.deepEqual(workflow.tasks[1].dependsOn, [workflow.tasks[0].id]);
  assert.deepEqual(workflow.tasks[2].dependsOn, [workflow.tasks[1].id]);
  await eventually(() => f.calls.length === 1);
  await delay(40);
  assert.equal(f.calls.length, 1, 'Claude must wait even when an independent provider slot is free');
  f.calls[0].complete('UPSTREAM_DESIGN_RESULT');
  await eventually(() => f.calls.length === 2);
  assert.ok(f.calls[1].prompt.includes('UPSTREAM_DESIGN_RESULT'));
  f.calls[1].complete('UPSTREAM_IMPLEMENTATION_RESULT');
  await eventually(() => f.calls.length === 3);
  assert.ok(f.calls[2].prompt.includes('UPSTREAM_IMPLEMENTATION_RESULT'));
  f.calls[2].complete();
  await eventually(async () => (await f.state()).tasks.every(task => task.status === 'completed'));
});

test('a failed upstream task stops its workflow descendants instead of leaving queued work', async t => {
  const f = await fixture(t);
  await f.successful('/api/graph', { nodes: ['strategy', 'engineering', 'quality'].map(departmentNode), edges: [handoff('strategy', 'engineering'), handoff('engineering', 'quality')] }, 'PUT');
  const result = await f.successful('/api/workflows/run', { departmentId: 'strategy', prompt: '실패 시 후속 작업을 시작하지 마세요.' });
  await eventually(() => f.calls.length === 1);
  f.calls[0].fail('CONTROLLED_UPSTREAM_FAILURE');
  const failed = await eventually(async () => {
    const tasks = (await f.state()).tasks.filter(task => task.workflowId === result.workflowId);
    return tasks.length === 3 && tasks.every(task => !['queued', 'running'].includes(task.status)) ? tasks : false;
  });
  assert.equal(failed.find(task => task.id === result.tasks[0].id).status, 'failed');
  assert.equal(f.calls.length, 1);
});

test('an unsupported downstream permission rejects the whole workflow before any job is saved or launched', async t => {
  const f = await fixture(t);
  await f.successful('/api/departments/engineering', { provider: 'gemini' }, 'PATCH');
  await f.successful('/api/graph', { nodes: ['strategy', 'engineering'].map(departmentNode), edges: [handoff('strategy', 'engineering')] }, 'PUT');
  const response = await f.request('/api/workflows/run', {
    departmentId: 'strategy', prompt: 'A rejected workflow must never partially modify project files.', permission: 'workspace-write',
  });
  assert.equal(response.status, 400);
  await response.json();
  await delay(30);
  assert.equal((await f.state()).tasks.length, 0, 'a later validation error must not leave an earlier Codex job in the queue');
  assert.equal(f.calls.length, 0, 'no provider may start after the request was rejected');
});

test('selected memory enters the actual prompt while task capabilities remain private and are revoked', async t => {
  const f = await fixture(t);
  const selected = await f.note({ title: '선택된 설계', content: 'SELECTED_MEMORY_CONTEXT' });
  const constraint = await f.note({ title: '사용자 고정 제약', content: 'PINNED_USER_CONSTRAINT', kind: 'constraint', pinned: true });
  await f.note({ title: 'needle unselected', content: 'UNSELECTED_PRIVATE_NEEDLE' });
  await f.successful('/api/settings', { workspace: f.other });
  const foreign = await f.note({ title: '다른 프로젝트', content: 'OTHER_WORKSPACE_PRIVATE_CONTEXT' });
  await f.successful('/api/settings', { workspace: f.workspace });
  await f.successful('/api/graph', { nodes: [departmentNode('strategy'), memoryNode(selected.id)], edges: [{ id: 'selected-context', source: `memory:${selected.id}`, target: 'department:strategy', type: 'memory_context' }] }, 'PUT');
  const task = await f.submit({ prompt: 'needle 작업을 진행하세요.' });
  await eventually(() => f.calls.length === 1);
  const call = f.calls[0];
  assert.ok(call.prompt.includes('SELECTED_MEMORY_CONTEXT'));
  assert.ok(call.prompt.includes('PINNED_USER_CONSTRAINT'));
  assert.ok(!call.prompt.includes('UNSELECTED_PRIVATE_NEEDLE'));
  assert.ok(call.memory?.token && call.memory.url, 'runner must receive only its private task-scoped memory capability');
  const snapshot = await f.state();
  const active = snapshot.tasks.find(item => item.id === task.id);
  assert.ok(active.memoryUsage.selectedIds.includes(selected.id));
  assert.ok(active.memoryUsage.selectedIds.includes(constraint.id));
  assert.ok(active.memoryUsage.contextChars > 0 && active.memoryUsage.contextChars <= 6000);
  assert.equal(active.memoryUsage.method, 'local-keyword');
  assert.ok(!JSON.stringify(snapshot).includes(call.memory.token));
  assert.ok(!JSON.stringify(await f.get('/api/export')).includes(call.memory.token));
  const headers = { 'content-type': 'application/json', 'x-imperium-memory-token': call.memory.token };
  const authorized = await fetch(`${f.url}/api/agent-memory/get/${selected.id}`, { headers });
  assert.equal(authorized.status, 200);
  assert.equal((await authorized.json()).node.content, 'SELECTED_MEMORY_CONTEXT');
  const escaped = await fetch(`${f.url}/api/agent-memory/get/${foreign.id}`, { headers });
  assert.equal(escaped.status, 404);
  const search = await fetch(`${f.url}/api/agent-memory/search`, { method: 'POST', headers, body: JSON.stringify({ query: 'private context', workspace: f.other }) });
  assert.equal(search.status, 200);
  assert.ok(!JSON.stringify(await search.json()).includes('OTHER_WORKSPACE_PRIVATE_CONTEXT'));
  assert.ok((await f.state()).tasks.find(item => item.id === task.id).memoryUsage.retrievals >= 2);
  f.calls[0].complete('Finished with memory');
  await eventually(async () => (await f.state()).tasks.find(item => item.id === task.id)?.status === 'completed');
  assert.equal((await fetch(`${f.url}/api/agent-memory/get/${selected.id}`, { headers })).status, 403);
  assert.ok(!(await readFile(path.join(f.dataDir, 'state.json'), 'utf8')).includes(call.memory.token));
});

test('terminal API transports explicit input and SSE output without exposing shell bytes in state or exports', async t => {
  const f = await fixture(t);
  const session = (await f.successful('/api/terminal', { shell: 'default', cols: 90, rows: 24 })).session;
  assert.equal(session.cwd, f.workspace);
  assert.ok(!Object.hasOwn(session, 'output'));
  await f.successful(`/api/terminal/${session.id}/input`, { data: 'PRIVATE_USER_SHELL_INPUT\r' });
  await f.successful(`/api/terminal/${session.id}/resize`, { cols: 120, rows: 35 });
  assert.equal(f.terminal.writes[0].data, 'PRIVATE_USER_SHELL_INPUT\r');
  assert.deepEqual(f.terminal.sizes[0], { id: session.id, cols: 120, rows: 35 });
  const abort = new AbortController();
  const response = await fetch(`${f.url}/api/terminal/${session.id}/events`, { signal: abort.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const timer = setTimeout(() => abort.abort(), 2500);
  f.terminal.emit(session.id, 'PRIVATE_STREAMED_SHELL_OUTPUT');
  let received = '';
  try {
    while (!received.includes('PRIVATE_STREAMED_SHELL_OUTPUT')) {
      const { done, value } = await reader.read();
      if (done) break;
      received += new TextDecoder().decode(value);
    }
  } finally { clearTimeout(timer); abort.abort(); await reader.cancel().catch(() => {}); }
  assert.ok(received.includes('event: data'));
  assert.ok(received.includes('TERMINAL_INITIAL_PRIVATE'));
  assert.ok(received.includes('PRIVATE_STREAMED_SHELL_OUTPUT'));
  for (const value of [await f.state(), await f.get('/api/export'), await f.get('/api/terminal')]) {
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE_USER_SHELL_INPUT|PRIVATE_STREAMED_SHELL_OUTPUT|TERMINAL_INITIAL_PRIVATE/);
  }
  assert.doesNotMatch(await readFile(path.join(f.dataDir, 'state.json'), 'utf8'), /PRIVATE_USER_SHELL_INPUT|PRIVATE_STREAMED_SHELL_OUTPUT/);
  await f.successful(`/api/terminal/${session.id}/close`, {});
  assert.equal((await f.get('/api/terminal')).sessions[0].status, 'closed');
});

test('Excel export is a real XLSX workbook containing project memory but no terminal buffer', async t => {
  const f = await fixture(t);
  await f.note({ title: 'XLSX_MEMORY_TITLE', content: 'XLSX_MEMORY_CONTENT' });
  await f.successful('/api/terminal', {});
  const response = await fetch(`${f.url}/api/export.xlsx`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /spreadsheetml\.sheet/);
  assert.match(response.headers.get('content-disposition'), /\.xlsx/);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 4).toString('hex'), '504b0304');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.ok(workbook.worksheets.length >= 5);
  const values = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
  assert.ok(values.includes('XLSX_MEMORY_TITLE') && values.includes('XLSX_MEMORY_CONTENT'));
  assert.doesNotMatch(values, /TERMINAL_INITIAL_PRIVATE/);
});

test('registered provider connections carry the assigned model ID into the real runner arguments', async t => {
  const f = await fixture(t);
  const catalog = await f.get('/api/providers/catalog');
  assert.ok(catalog.catalog.some(provider => provider.id === 'codex'));
  const discovery = await f.get('/api/providers/codex/models');
  assert.equal(discovery.models[0].id, 'offline-model');
  assert.deepEqual(f.modelCalls, ['codex']);
  const connection = (await f.successful('/api/providers/register', { providerId: 'codex', label: '팀의 Codex', modelId: 'offline-model' })).connection;
  await f.successful('/api/departments/strategy', { connectionId: connection.id, provider: 'codex' }, 'PATCH');
  const task = await f.submit();
  await eventually(() => f.calls.length === 1);
  assert.equal(f.calls[0].provider, 'codex');
  assert.equal(f.calls[0].modelId, 'offline-model');
  const active = (await f.state()).tasks.find(item => item.id === task.id);
  assert.equal(active.connectionId, connection.id);
  assert.equal(active.modelId, 'offline-model');
  assert.equal((await f.request(`/api/providers/connections/${connection.id}`, undefined, 'DELETE')).status, 409);
  f.calls[0].complete();
});

test('a provider override does not inherit another provider connection model', async t => {
  const f = await fixture(t);
  const connection = (await f.successful('/api/providers/register', { providerId: 'codex', label: 'Assigned Codex model', modelId: 'gpt-codex-only-test' })).connection;
  await f.successful('/api/departments/strategy', { connectionId: connection.id, provider: 'codex' }, 'PATCH');
  const task = await f.submit({ provider: 'claude' });
  await eventually(() => f.calls.length === 1);
  assert.equal(f.calls[0].provider, 'claude');
  assert.equal(f.calls[0].modelId, '', 'the Codex model ID must not reach the Claude CLI');
  assert.equal((await f.state()).tasks.find(item => item.id === task.id).connectionId, null);
  f.calls[0].complete();
});

test('private desktop APIs require the app session while an agent receives only a scoped read capability', async t => {
  const privateSessionToken = 'OFFLINE_PRIVATE_DESKTOP_SESSION';
  const f = await fixture(t, { privateSessionToken });
  for (const route of ['/api/state', '/api/memory', '/api/terminal', '/api/export', '/api/export.xlsx']) {
    assert.equal((await fetch(`${f.url}${route}`)).status, 403, `${route} must not be accessible to an unrelated local client`);
  }
  const noCSRF = await fetch(`${f.url}/api/terminal`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-imperium-session': privateSessionToken }, body: '{}' });
  assert.equal(noCSRF.status, 403);
  const note = await f.note({ content: 'PRIVATE_APP_AUTHORIZED_MEMORY' });
  const task = await f.submit();
  await eventually(() => f.calls.length === 1);
  const memoryToken = f.calls[0].memory.token;
  assert.notEqual(memoryToken, privateSessionToken);
  assert.ok(!JSON.stringify(await f.state()).includes(privateSessionToken));
  assert.ok(!JSON.stringify(await f.get('/api/export')).includes(privateSessionToken));
  const read = await fetch(`${f.url}/api/agent-memory/get/${note.id}`, { headers: { 'x-imperium-memory-token': memoryToken } });
  assert.equal(read.status, 200, 'an agent must not need the private desktop session or browser CSRF token');
  assert.equal((await read.json()).node.content, 'PRIVATE_APP_AUTHORIZED_MEMORY');
  assert.equal((await fetch(`${f.url}/api/agent-memory/get/${note.id}`, { headers: { 'x-imperium-memory-token': privateSessionToken } })).status, 403);
  f.calls[0].complete();
  await eventually(async () => (await f.state()).tasks.find(item => item.id === task.id)?.status === 'completed');
  assert.equal((await fetch(`${f.url}/api/agent-memory/get/${note.id}`, { headers: { 'x-imperium-memory-token': memoryToken } })).status, 403);
});
