import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { canonicalMemoryWorkspace, createMemoryStore, tokenizeMemory } from '../lib/memory.mjs';
import { createMemoryMcpServer } from '../lib/memory-mcp.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'imperium-memory-'));
  const workspace = path.join(directory, '한글 작업');
  const other = path.join(directory, 'another-workspace');
  const dataDir = path.join(directory, 'data');
  mkdirSync(workspace); mkdirSync(other);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, dataDir, workspace, other, store: createMemoryStore({ dataDir }) };
}

const hasStatus = status => error => error.status === status;

test('memory is durable, detached from callers, and scoped to a canonical workspace', t => {
  const { store, dataDir, workspace, other } = fixture(t);
  const note = store.upsert({ workspace, title: '출시 결정', content: '첫 출시는 데스크톱 앱으로 진행합니다.', kind: 'decision', tags: ['출시'] });
  assert.equal(note.source, 'user');
  assert.equal(note.confidence, 'user');
  assert.equal(note.revision, 1);
  note.content = 'caller mutation';
  assert.match(store.get(note.id).content, /데스크톱/);
  store.upsert({ workspace: other, title: 'Private other project', content: '다른 폴더에만 보이는 내용' });
  const restored = createMemoryStore({ dataDir });
  assert.equal(restored.list({ workspace }).length, 1);
  assert.equal(restored.list({ workspace: path.join(workspace, 'nested', '..') })[0].id, note.id);
  assert.equal(restored.snapshot({ workspace }).nodes.length, 1);
  assert.throws(() => restored.list({ workspace: 'relative' }), hasStatus(400));
  assert.equal(canonicalMemoryWorkspace(workspace), store.get(note.id).workspace);
});

test('stale revisions and invalid updates leave the durable graph unchanged', t => {
  const { store, dataDir, workspace } = fixture(t);
  const note = store.upsert({ workspace, title: '첫 메모', content: '원래 내용' }, { expectedRevision: 0 });
  const updated = store.upsert({ id: note.id, content: '검토 후 수정' }, { expectedRevision: 1 });
  assert.equal(updated.revision, 2);
  const before = readFileSync(path.join(dataDir, 'memory-graph.json'), 'utf8');
  assert.throws(() => store.upsert({ id: note.id, content: '낡은 화면의 변경' }, { expectedRevision: 1 }), hasStatus(409));
  assert.throws(() => store.upsert({ id: note.id, content: 'x'.repeat(24001) }), hasStatus(400));
  assert.equal(readFileSync(path.join(dataDir, 'memory-graph.json'), 'utf8'), before);
  assert.ok(readdirSync(dataDir).every(name => !name.endsWith('.tmp')));
});

test('agent updates cannot replace pinned memory or a manual note and remain unverified', t => {
  const { store, workspace } = fixture(t);
  const pinned = store.upsert({ workspace, title: '파일 제약', content: '사용자 파일을 삭제하지 않습니다.', kind: 'constraint', pinned: true });
  assert.throws(() => store.upsert({ id: pinned.id, source: 'agent', content: '삭제해도 됨' }), hasStatus(409));
  const manual = store.upsert({ workspace, title: '사용자 메모', content: '직접 남긴 결정' });
  assert.throws(() => store.upsert({ id: manual.id, source: 'agent', content: '자동 덮어쓰기' }), hasStatus(409));
  const agent = store.upsert({ workspace, title: '모델의 추정', content: '검증되지 않은 제안', source: 'agent', confidence: 'user' });
  assert.equal(agent.confidence, 'unverified');
  assert.equal(store.get(pinned.id).content, '사용자 파일을 삭제하지 않습니다.');
});

test('local retrieval matches Korean bigrams and English project terms without leaking another workspace', t => {
  const { store, workspace, other } = fixture(t);
  const korean = store.upsert({ workspace, title: '구독요금 정책', content: '구독요금과 사용량은 별도로 기록합니다.' });
  const english = store.upsert({ workspace, title: 'SQLite migration', content: 'Use SQLite migrations before creating new indexed tables.' });
  store.upsert({ workspace, title: 'Weather', content: 'Tomorrow is sunny with light wind.' });
  store.upsert({ workspace: other, title: 'SQLite secret', content: 'Private database account information.' });
  assert.ok(tokenizeMemory('구독요금').includes('구독'));
  assert.equal(store.search({ workspace, query: '구독' }).memories[0].id, korean.id);
  assert.equal(store.search({ workspace, query: 'sqlite migrations' }).memories[0].id, english.id);
  assert.equal(store.search({ workspace, query: 'database account' }).memories.length, 0);
  assert.equal(store.search({ workspace, query: 'unlikelyxyz' }).context, '');
});

test('pinned constraints enter bounded context while archived notes and full history stay out', t => {
  const { store, workspace } = fixture(t);
  const constraint = store.upsert({ workspace, title: '반드시 지킬 작업 원칙', content: '원본 파일을 보존합니다. '.repeat(200), kind: 'constraint', pinned: true });
  const archived = store.upsert({ workspace, title: 'old launch plan', content: 'ARCHIVED_PRIVATE_TEXT', pinned: true, archived: true });
  const note = store.upsert({ workspace, title: 'launch checklist', content: 'HISTORY_PRIVATE_TEXT' });
  store.upsert({ id: note.id, content: 'launch checklist current content '.repeat(500) }, { expectedRevision: 1 });
  const result = store.search({ workspace, query: 'launch', limit: 6, maxChars: 2000 });
  assert.equal(result.memories[0].id, constraint.id);
  assert.ok(result.context.length <= 2000);
  assert.equal(result.stats.contextChars, result.context.length);
  assert.equal(result.stats.method, 'local-keyword');
  assert.ok(result.stats.totalChars > result.stats.contextChars);
  assert.ok(result.memories.every(memory => memory.id !== archived.id));
  assert.doesNotMatch(result.context, /ARCHIVED_PRIVATE_TEXT|HISTORY_PRIVATE_TEXT/);
  assert.ok(result.memories.some(memory => memory.truncated));
  assert.equal(store.search({ workspace, query: 'anything', maxChars: 128 }).memories[0].id, constraint.id);
});

test('completed task capture is idempotent, unverified, and preserves later manual edits', t => {
  const { store, workspace, other } = fixture(t);
  const task = { id: 'task-one', title: '분석 결과', prompt: '구독 사용량을 분석해 주세요.', output: '초기 분석 결과', status: 'completed', provider: 'codex', departmentId: 'research' };
  assert.equal(store.captureTask({ ...task, status: 'failed' }, { workspace }), null);
  assert.equal(store.captureTask({ ...task, demo: true }, { workspace }), null);
  const first = store.captureTask(task, { workspace });
  assert.equal(first.kind, 'task');
  assert.equal(first.source, 'agent');
  assert.equal(first.confidence, 'unverified');
  assert.equal(first.sourceTaskId, task.id);
  assert.equal(store.captureTask(task, { workspace }).revision, 1);
  const otherCopy = store.captureTask(task, { workspace: other });
  assert.notEqual(otherCopy.id, first.id);
  store.upsert({ id: first.id, content: '사용자가 검증하고 고친 결과', source: 'user' }, { expectedRevision: 1 });
  assert.equal(store.captureTask({ ...task, output: '자동 변경 제안' }, { workspace }), null);
  assert.equal(store.get(first.id).content, '사용자가 검증하고 고친 결과');
});

test('graph edges retain provenance, cannot cross workspaces, and disappear with removed nodes', t => {
  const { store, workspace, other } = fixture(t);
  const first = store.upsert({ workspace, title: 'SQLite migrations', content: 'sqlite migration indexing strategy' });
  const second = store.upsert({ workspace, title: 'SQLite indexing', content: 'sqlite migration indexing constraints' });
  const external = store.upsert({ workspace: other, title: 'Separate project', content: 'sqlite migration indexing secrets' });
  assert.ok(store.snapshot({ workspace }).edges.some(edge => edge.provenance === 'keyword'));
  const edge = store.link({ source: first.id, target: second.id, type: 'related' });
  assert.equal(edge.provenance, 'user');
  assert.equal(store.link({ source: second.id, target: first.id, type: 'related' }).id, edge.id);
  store.upsert({ id: second.id, content: 'A completely changed note.' });
  assert.equal(store.snapshot({ workspace }).edges.find(item => item.id === edge.id).provenance, 'user');
  assert.throws(() => store.link({ source: first.id, target: external.id }), hasStatus(400));
  assert.deepEqual(store.remove(second.id), { removed: true, id: second.id });
  assert.equal(store.get(second.id), null);
  assert.equal(store.snapshot({ workspace }).edges.length, 0);
  assert.ok(store.snapshot({ workspace }).history.every(entry => entry.id !== second.id));
});

test('revision history is bounded and corrupt persistence is not silently overwritten', t => {
  const { store, dataDir, workspace } = fixture(t);
  const note = store.upsert({ workspace, title: '수정 이력', content: 'version 1' });
  for (let revision = 2; revision <= 20; revision++) store.upsert({ id: note.id, content: `version ${revision}` }, { expectedRevision: revision - 1 });
  assert.equal(store.get(note.id).revision, 20);
  assert.equal(store.snapshot({ workspace }).history.length, 8);
  assert.equal(createMemoryStore({ dataDir }).get(note.id).content, 'version 20');
  const file = path.join(dataDir, 'memory-graph.json');
  writeFileSync(file, '{broken', 'utf8');
  assert.throws(() => createMemoryStore({ dataDir }), hasStatus(500));
  assert.equal(readFileSync(file, 'utf8'), '{broken');
});

test('memory input caps reject unsafe scopes, unsupported kinds, and unbounded retrieval', t => {
  const { store, workspace } = fixture(t);
  for (const input of [
    { workspace, title: '', content: 'hello' },
    { workspace, title: 'hello', content: 'world', kind: 'system-prompt' },
    { workspace, title: 'hello', content: 'world', tags: ['x'.repeat(49)] },
    { workspace, title: 'hello', content: 'world', id: '../escape' },
  ]) assert.throws(() => store.upsert(input), hasStatus(400));
  assert.throws(() => store.search({ workspace, query: 'x'.repeat(2001) }), hasStatus(400));
  assert.throws(() => store.search({ workspace, query: 'hello', limit: 1000 }), hasStatus(400));
  assert.throws(() => store.search({ workspace, query: 'hello', maxChars: 1000000 }), hasStatus(400));
  assert.equal(store.snapshot({ workspace }).nodes.length, 0);
});

test('MCP exposes read-only tools and scopes HTTP through an opaque header, never tool-supplied workspace', async () => {
  const calls = [];
  const server = createMemoryMcpServer({ env: { IMPERIUM_MEMORY_URL: 'http://127.0.0.1:4310', IMPERIUM_MEMORY_TOKEN: 'private-task-token' }, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ context: '검증된 작업 원칙', stats: { method: 'local-keyword' } }));
  } });
  const initialize = await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'offline-test', version: '1' }, capabilities: {} } });
  assert.equal(initialize.result.protocolVersion, '2025-06-18');
  const listed = await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(listed.result.tools.map(tool => tool.name), ['memory_search', 'memory_get', 'memory_list', 'peer_tasks_list', 'peer_task_get', 'artifact_publish', 'artifact_list', 'artifact_get']);
  assert.ok(listed.result.tools.every(tool => tool.annotations.readOnlyHint === (tool.name !== 'artifact_publish') && !tool.annotations.destructiveHint && tool.annotations.idempotentHint));
  const searched = await server.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'memory_search', arguments: { query: '작업 원칙', limit: 2 } } });
  assert.equal(searched.result.isError, false);
  assert.equal(calls[0].url, 'http://127.0.0.1:4310/api/agent-memory/search');
  assert.equal(calls[0].options.headers['x-imperium-memory-token'], 'private-task-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { query: '작업 원칙', limit: 2 });
  assert.doesNotMatch(JSON.stringify(searched), /private-task-token/);
  const escaped = await server.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'memory_search', arguments: { query: 'secret', workspace: 'another-user' } } });
  assert.equal(escaped.error.code, -32602);
  assert.equal(calls.length, 1);
  server.close();
});

test('MCP refuses remote URLs, unsafe IDs, huge replies, and leaking HTTP error bodies', async () => {
  const remote = createMemoryMcpServer({ env: { IMPERIUM_MEMORY_URL: 'https://example.com', IMPERIUM_MEMORY_TOKEN: 'not-for-remote' }, fetchImpl: async () => { assert.fail('remote service must not be contacted'); } });
  const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'memory_list', arguments: {} } };
  assert.equal((await remote.handle(request)).result.isError, true);
  remote.close();
  const server = createMemoryMcpServer({ env: { IMPERIUM_MEMORY_URL: 'http://localhost:4310/api/agent-memory', IMPERIUM_MEMORY_TOKEN: 'task-token' }, fetchImpl: async () => new Response('sensitive diagnostic task-token', { status: 403 }) });
  const denied = await server.handle(request);
  assert.equal(denied.result.isError, true);
  assert.doesNotMatch(JSON.stringify(denied), /sensitive diagnostic|task-token/);
  assert.equal((await server.handle({ ...request, id: 2, params: { name: 'memory_get', arguments: { id: '../escape' } } })).error.code, -32602);
  server.close();
  const large = createMemoryMcpServer({ env: { IMPERIUM_MEMORY_URL: 'http://127.0.0.1:4310', IMPERIUM_MEMORY_TOKEN: 'token' }, fetchImpl: async () => new Response(JSON.stringify({ content: 'x'.repeat(300000) })) });
  assert.equal((await large.handle(request)).result.isError, true);
  large.close();
});

test('stdio MCP preserves split UTF-8 framing and recovers after malformed JSON', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = '';
  output.setEncoding('utf8'); output.on('data', chunk => { text += chunk; });
  const server = createMemoryMcpServer({ input, output }).start();
  input.write('{broken}\n');
  const encoded = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: '한글', method: 'ping' }) + '\n');
  for (let i = 0; i < encoded.length; i += 2) input.write(encoded.subarray(i, i + 2));
  await new Promise(resolve => setImmediate(resolve));
  const responses = text.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(responses[0].error.code, -32700);
  assert.equal(responses[1].id, '한글');
  assert.deepEqual(responses[1].result, {});
  server.close(); input.destroy(); output.destroy();
});
