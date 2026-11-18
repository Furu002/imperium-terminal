import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, truncateSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createCollaborationStore } from '../lib/collaboration.mjs';
import { createMemoryStore, canonicalMemoryWorkspace } from '../lib/memory.mjs';
import { createMemoryMcpServer } from '../lib/memory-mcp.mjs';
import { providerArguments } from '../lib/providers.mjs';
import { createHQServer } from '../server.mjs';

const publication = extra => ({ title: 'Public finding', content: 'Intermediate implementation contract', kind: 'finding', idempotencyKey: 'finding-v1', ...extra });
function fixture(t, { deferCleanup = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'imperium-collaboration-')), workspace = path.join(dir, 'project'), other = path.join(dir, 'other'), dataDir = path.join(dir, 'data'); mkdirSync(workspace); mkdirSync(other);
  if (!deferCleanup) t.after(() => rmSync(dir, { recursive: true, force: true }));
  const tasks = [{ id: 'author', workspace, status: 'running', provider: 'codex', departmentId: 'engineering', title: 'Author', output: 'Public live output', logs: [{ type: 'reasoning', text: 'PRIVATE_RAW_THINKING' }, { type: 'status', source: 'model-summary', text: 'Reviewing interface', timestamp: '2026-11-19T01:00:00Z' }], nativeSessionId: 'PRIVATE_SESSION' }, { id: 'peer', workspace, status: 'running', provider: 'claude', departmentId: 'quality', output: 'Peer partial result' }, { id: 'foreign', workspace: other, status: 'running', output: 'PRIVATE_FOREIGN_RESULT' }];
  const getState = () => ({ tasks }); return { dir, dataDir, workspace, other, tasks, getState, board: createCollaborationStore({ dataDir, getState }) };
}

test('board publications are append-only, unverified, idempotent, durable, and cannot overwrite pinned memory', t => {
  const f = fixture(t), memory = createMemoryStore({ dataDir: f.dataDir });
  const note = memory.upsert({ title: 'Pinned user policy', content: 'DO NOT OVERWRITE', workspace: f.workspace, kind: 'constraint', pinned: true, source: 'user' });
  const first = f.board.publish({ task: f.tasks[0], input: publication() });
  assert.equal(first.created, true); assert.equal(first.artifact.taskId, 'author'); assert.equal(first.artifact.confidence, 'unverified');
  assert.equal(Object.hasOwn(first.artifact, 'idempotencyKey'), false);
  const second = f.board.publish({ task: f.tasks[0], input: publication() }); assert.equal(second.created, false); assert.equal(second.artifact.id, first.artifact.id);
  assert.throws(() => f.board.publish({ task: f.tasks[0], input: publication({ content: 'Changed after publication' }) }), { status: 409 });
  assert.throws(() => f.board.publish({ task: f.tasks[0], input: publication({ pinned: true }) }), { status: 400 });
  assert.throws(() => f.board.publish({ task: f.tasks[0], input: publication({ content: 'x'.repeat(8001) }) }), { status: 400 });
  assert.throws(() => f.board.publish({ task: { ...f.tasks[0], status: 'cancelled' }, input: publication() }), { status: 403 });
  assert.throws(() => f.board.get({ workspace: f.other, id: first.artifact.id }), { status: 404 });
  assert.deepEqual(memory.get(note.id), note);
  const restarted = createCollaborationStore({ dataDir: f.dataDir, getState: f.getState });
  assert.equal(restarted.get({ workspace: f.workspace, id: first.artifact.id }).content, publication().content);
  assert.equal(restarted.list({ workspace: f.workspace }).artifacts[0].content, undefined);
  assert.match(readFileSync(path.join(f.dataDir, 'collaboration-board.json'), 'utf8'), /unverified/);
});

test('peer retrieval only exposes scoped public output and explicit public status, never internal fields', t => {
  const f = fixture(t), listed = f.board.peers({ workspace: f.workspace });
  assert.equal(listed.length, 2); assert.doesNotMatch(JSON.stringify(listed), /PRIVATE_|nativeSession|reasoning/);
  assert.equal(listed.find(task => task.id === 'author').publicSummary.text, 'Reviewing interface');
  const partial = f.board.peer({ workspace: f.workspace, taskId: 'author', maxChars: 6 });
  assert.equal(partial.output, 'Public'); assert.equal(partial.nextOffset, 6); assert.equal(partial.final, false); assert.equal(partial.truncated, true);
  assert.throws(() => f.board.peer({ workspace: f.workspace, taskId: 'foreign' }), { status: 404 });
  assert.throws(() => f.board.peer({ workspace: f.workspace, taskId: 'author', maxChars: 8001 }), { status: 400 });
  for (let i = 0; i < 20; i++) f.board.publish({ task: f.tasks[0], input: publication({ idempotencyKey: `p-${i}` }) });
  assert.throws(() => f.board.publish({ task: f.tasks[0], input: publication({ idempotencyKey: 'over-limit' }) }), { status: 409 });
  assert.equal(f.tasks.length, 3, 'tool calls never create or wait for tasks');
});

test('project retention removes only old completed artifacts and preserves active peers with a bounded audit trail', t => {
  const f = fixture(t); mkdirSync(f.dataDir, { recursive: true });
  const scope = path.resolve(f.workspace).toLowerCase();
  const artifacts = Array.from({ length: 500 }, (_, index) => ({ id: `artifact-${index}`, sequence: index + 1, workspace: process.platform === 'win32' ? scope : f.workspace, taskId: index < 20 ? 'peer' : 'old-completed', provider: 'claude', departmentId: 'quality', title: `Record ${index}`, content: 'retained', kind: 'finding', idempotencyKey: `key-${index}`, createdAt: '2026-11-19T00:00:00Z', confidence: 'unverified' }));
  writeFileSync(path.join(f.dataDir, 'collaboration-board.json'), JSON.stringify({ version: 1, sequence: 500, artifacts, events: [] }));
  const board = createCollaborationStore({ dataDir: f.dataDir, getState: f.getState }); board.publish({ task: f.tasks[0], input: publication() });
  assert.equal(board.get({ workspace: f.workspace, id: 'artifact-0' }).taskId, 'peer');
  assert.throws(() => board.get({ workspace: f.workspace, id: 'artifact-20' }), { status: 404 });
  assert.equal(JSON.parse(readFileSync(path.join(f.dataDir, 'collaboration-board.json'), 'utf8')).artifacts.length, 500);
  for (let i = 0; i < 110; i++) board.audit({ workspace: f.workspace, sourceTaskId: 'peer', targetTaskId: 'author', action: 'peer_task_get', chars: 100 });
  assert.equal(board.events({ workspace: f.workspace }).length, 100);
  assert.doesNotMatch(JSON.stringify(board.events({ workspace: f.workspace })), /retained|content|token/);
});

test('stored audit validation rejects corrupt entries and keeps legacy single-target records compatible', t => {
  const f = fixture(t), file = path.join(f.dataDir, 'collaboration-board.json');
  const legacy = { id: 'event-1', sequence: 1, workspace: canonicalMemoryWorkspace(f.workspace), sourceTaskId: 'reader', targetTaskId: 'peer', action: 'peer_task_get', artifactId: null, chars: 10, timestamp: '2026-11-19T00:00:00Z' };
  const save = event => writeFileSync(file, JSON.stringify({ version: 1, sequence: 1, artifacts: [], events: [event] }));
  for (const invalid of [null, [], { ...legacy, workspace: 123 }, { ...legacy, sequence: 0 }, { ...legacy, sequence: 1.5 }, { ...legacy, sourceTaskId: '../escape' }, { ...legacy, action: 'spawn_agent' }, { ...legacy, targetTaskIds: [null] }, { ...legacy, targetTaskIds: ['other'] }, { ...legacy, targetTaskIds: Array(21).fill('peer') }]) {
    save(invalid); const before = readFileSync(file, 'utf8'); assert.throws(() => createCollaborationStore({ dataDir: f.dataDir, getState: f.getState }), { status: 503 }); assert.equal(readFileSync(file, 'utf8'), before);
  }
  for (const valid of [legacy, { ...legacy, targetTaskIds: ['peer'] }, { ...legacy, sourceTaskId: null }, { ...legacy, action: 'artifact_publish', targetTaskId: null, targetTaskIds: [] }]) {
    save(valid); const store = createCollaborationStore({ dataDir: f.dataDir, getState: f.getState }); assert.equal(store.events({ workspace: f.workspace }).length, 1);
  }
});

test('new MCP tools validate strict schemas, have truthful annotations, and traverse actual split UTF-8 stdio framing', async () => {
  const calls = [], input = new PassThrough(), output = new PassThrough(); let resultText = ''; output.setEncoding('utf8'); output.on('data', value => { resultText += value; });
  const server = createMemoryMcpServer({ input, output, env: { IMPERIUM_MEMORY_URL: 'http://127.0.0.1:4310', IMPERIUM_MEMORY_TOKEN: 'PRIVATE_TOKEN' }, fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ artifact: { id: 'published', confidence: 'unverified' } })); } }).start();
  try {
    const listed = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const publish = listed.result.tools.find(tool => tool.name === 'artifact_publish'); assert.equal(publish.annotations.readOnlyHint, false); assert.equal(publish.annotations.idempotentHint, true); assert.equal(publish.annotations.destructiveHint, false);
    assert.ok(listed.result.tools.filter(tool => tool.name !== 'artifact_publish').every(tool => tool.annotations.readOnlyHint));
    const invalid = await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'artifact_publish', arguments: publication({ workspace: '/foreign' }) } }); assert.equal(invalid.error.code, -32602);
    const missing = await server.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'artifact_publish', arguments: { title: 'Missing key', content: 'x', kind: 'note' } } }); assert.equal(missing.error.code, -32602);
    const bytes = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: '한글', method: 'tools/call', params: { name: 'artifact_publish', arguments: publication({ title: '공유 연구' }) } }) + '\n');
    for (let i = 0; i < bytes.length; i += 2) input.write(bytes.subarray(i, i + 2));
    for (let i = 0; i < 10 && !resultText; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(JSON.parse(resultText.trim()).result.isError, false); assert.equal(calls[0].url, 'http://127.0.0.1:4310/api/agent-memory/artifacts/publish');
    assert.equal(JSON.parse(calls[0].options.body).title, '공유 연구'); assert.equal(calls[0].options.headers['x-imperium-memory-token'], 'PRIVATE_TOKEN'); assert.doesNotMatch(resultText, /PRIVATE_TOKEN/);
    const args = providerArguments('claude', 'read-only', { memory: { token: 'x', url: 'http://127.0.0.1' } }); const tools = args[args.indexOf('--tools') + 1], allowed = args[args.indexOf('--allowedTools') + 1];
    assert.equal(tools, 'Read,Glob,Grep'); assert.doesNotMatch(tools, /Bash/); for (const name of ['peer_tasks_list', 'peer_task_get', 'artifact_publish', 'artifact_list', 'artifact_get']) assert.ok(allowed.includes(`mcp__imperium_memory__${name}`));
  } finally { server.close(); input.destroy(); output.destroy(); }
});

test('real HTTP collaboration honors running capability, private UI session, project isolation, audit and cancellation revocation', async t => {
  const f = fixture(t, { deferCleanup: true }), calls = [];
  const app = createHQServer({ dataDir: f.dataDir, workspace: f.workspace, port: 0, privateSessionToken: 'private-ui-session', providers: { detectProviders: async () => ['codex', 'claude'].map(id => ({ id, installed: true, authenticated: true, status: 'ready' })), startProvider: async options => { calls.push(options); return { cancel() { options.onExit({ code: 130, error: 'Cancelled' }); } }; } } });
  const { url } = await app.start();
  t.after(async () => { app.server.closeAllConnections(); try { await app.close(); } finally { rmSync(f.dir, { recursive: true, force: true }); } });
  const session = { 'x-imperium-session': 'private-ui-session' }, initial = await fetch(`${url}/api/state`, { headers: session }).then(response => response.json());
  const response = await fetch(`${url}/api/tasks`, { method: 'POST', headers: { ...session, 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken }, body: JSON.stringify({ departmentId: 'strategy', prompt: 'Collaboration offline test', permission: 'read-only' }) }); assert.equal(response.status, 201); const { task } = await response.json();
  for (let i = 0; i < 50 && !calls.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
  const token = calls[0].memory.token, headers = { 'x-imperium-memory-token': token, 'content-type': 'application/json' };
  assert.match(calls[0].prompt, /artifact_publish/); assert.match(calls[0].prompt, /반복 조회하지/);
  const published = await fetch(`${url}/api/agent-memory/artifacts/publish`, { method: 'POST', headers, body: JSON.stringify(publication()) }).then(response => response.json());
  assert.equal(published.artifact.taskId, task.id);
  assert.equal((await fetch(`${url}/api/collaboration`)).status, 403);
  const ui = await fetch(`${url}/api/collaboration?workspace=${encodeURIComponent(f.workspace)}`, { headers: session }).then(response => response.json());
  assert.equal(ui.artifacts.length, 1); assert.equal(ui.artifacts[0].content, undefined); assert.equal(ui.events[0].sourceTaskId, task.id); assert.equal(ui.events[0].action, 'artifact_publish');
  assert.doesNotMatch(JSON.stringify(ui), new RegExp(token));
  assert.equal((await fetch(`${url}/api/collaboration?workspace=${encodeURIComponent(f.other)}`, { headers: session })).status, 409);
  const peer = await fetch(`${url}/api/agent-memory/peer/${task.id}`, { headers }).then(response => response.json()); assert.equal(peer.task.id, task.id); assert.equal(peer.final, false);
  for (let index = 0; index < 20; index++) app.store.state.tasks.push({ id: `peer:${index}`, workspace: f.workspace, provider: 'claude', departmentId: 'engineering', title: `Peer ${index}`, status: 'completed', output: `Public peer ${index}`, logs: [], createdAt: '2099-01-01T00:00:00Z' });
  const beforeList = JSON.parse(readFileSync(path.join(f.dataDir, 'collaboration-board.json'), 'utf8'));
  const peers = await fetch(`${url}/api/agent-memory/peers?limit=20`, { headers }).then(response => response.json()); assert.equal(peers.tasks.length, 20);
  const afterList = JSON.parse(readFileSync(path.join(f.dataDir, 'collaboration-board.json'), 'utf8'));
  assert.equal(afterList.sequence, beforeList.sequence + 1, 'a list call records exactly one audit transaction');
  assert.equal(afterList.events.length, beforeList.events.length + 1);
  const listEvent = afterList.events.at(-1); assert.equal(listEvent.sourceTaskId, task.id); assert.equal(listEvent.targetTaskIds.length, 20); assert.equal(listEvent.targetTaskId, listEvent.targetTaskIds[0]);
  const colonPeer = await fetch(`${url}/api/agent-memory/peer/${encodeURIComponent('peer:0')}`, { headers }); assert.equal(colonPeer.status, 200); assert.equal((await colonPeer.json()).task.id, 'peer:0');
  const afterPeer = JSON.parse(readFileSync(path.join(f.dataDir, 'collaboration-board.json'), 'utf8')).events.at(-1);
  assert.equal(afterPeer.sourceTaskId, task.id); assert.equal(afterPeer.targetTaskId, 'peer:0'); assert.deepEqual(afterPeer.targetTaskIds, ['peer:0']);
  const mcp = createMemoryMcpServer({ env: { IMPERIUM_MEMORY_URL: url, IMPERIUM_MEMORY_TOKEN: token } });
  for (const [index, [name, args]] of [['peer_tasks_list', {}], ['peer_task_get', { taskId: task.id, maxChars: 10 }], ['artifact_list', {}], ['artifact_get', { id: published.artifact.id }]].entries()) {
    const result = await mcp.handle({ jsonrpc: '2.0', id: index + 1, method: 'tools/call', params: { name, arguments: args } }); assert.equal(result.result.isError, false, name);
  }
  mcp.close();
  const snapshot = await fetch(`${url}/api/state`, { headers: session }).then(response => response.json()); assert.ok(snapshot.collaborationUpdatedAt); assert.equal(snapshot.tasks.length, 21); assert.equal(calls.length, 1, 'reading peers never starts more models'); assert.ok(snapshot.tasks[0].logs.some(log => log.type === 'collaboration'));
  await fetch(`${url}/api/tasks/${task.id}/cancel`, { method: 'POST', headers: { ...session, 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken }, body: '{}' });
  assert.equal((await fetch(`${url}/api/agent-memory/artifacts`, { headers })).status, 403);
  assert.equal((await fetch(`${url}/api/agent-memory/artifacts/publish`, { method: 'POST', headers, body: JSON.stringify(publication({ idempotencyKey: 'after-cancel' })) })).status, 403);
});

test('corrupt, invalid-event and oversized optional boards isolate 503 failures while tasks and all original memory tools keep working', async t => {
  for (const kind of ['corrupt', 'invalid-event', 'oversized']) {
    const f = fixture(t, { deferCleanup: true }), memory = createMemoryStore({ dataDir: f.dataDir });
    const note = memory.upsert({ workspace: f.workspace, title: 'Pinned project rule', content: 'Existing memory still works', kind: 'constraint', pinned: true, source: 'user' });
    const file = path.join(f.dataDir, 'collaboration-board.json'); writeFileSync(file, kind === 'invalid-event' ? JSON.stringify({ version: 1, sequence: 1, artifacts: [], events: [null] }) : '{invalid board data'); if (kind === 'oversized') truncateSync(file, 64 * 1024 * 1024 + 1);
    const before = statSync(file), calls = [];
    const app = createHQServer({ dataDir: f.dataDir, workspace: f.workspace, port: 0, providers: { detectProviders: async () => [{ id: 'codex', installed: true, authenticated: true, status: 'ready' }], startProvider: async options => { calls.push(options); return { cancel() { options.onExit({ code: 130, error: 'Cancelled' }); } }; } } });
    const { url } = await app.start(); t.after(async () => { app.server.closeAllConnections(); try { await app.close(); } finally { rmSync(f.dir, { recursive: true, force: true }); } });
    const stateResponse = await fetch(`${url}/api/state`); assert.equal(stateResponse.status, 200); const state = await stateResponse.json();
    assert.equal((await fetch(`${url}/api/memory`)).status, 200); assert.equal((await fetch(`${url}/api/graph`)).status, 200); assert.equal((await fetch(`${url}/api/collaboration`)).status, 503);
    assert.equal((await fetch(`${url}/api/collaboration/artifacts/any-id`)).status, 503);
    const submitted = await fetch(`${url}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hq-token': state.server.csrfToken }, body: JSON.stringify({ departmentId: 'strategy', prompt: 'Use existing project memory', permission: 'read-only' }) }); assert.equal(submitted.status, 201);
    for (let i = 0; i < 50 && !calls.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
    const mcp = createMemoryMcpServer({ env: { IMPERIUM_MEMORY_URL: url, IMPERIUM_MEMORY_TOKEN: calls[0].memory.token } });
    for (const [index, [name, args]] of [['memory_search', { query: 'Pinned project rule' }], ['memory_get', { id: note.id }], ['memory_list', {}]].entries()) {
      const response = await mcp.handle({ jsonrpc: '2.0', id: index + 1, method: 'tools/call', params: { name, arguments: args } }); assert.equal(response.result.isError, false, `${kind}: ${name}`);
    }
    for (const [index, [name, args]] of [['peer_tasks_list', {}], ['peer_task_get', { taskId: 'any-id' }], ['artifact_list', {}], ['artifact_get', { id: 'any-id' }], ['artifact_publish', publication()]].entries()) {
      const response = await mcp.handle({ jsonrpc: '2.0', id: index + 10, method: 'tools/call', params: { name, arguments: args } }); assert.equal(response.result.isError, true); assert.match(response.result.content[0].text, /503/);
    }
    mcp.close(); const after = statSync(file); assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs); if (kind === 'corrupt') assert.equal(readFileSync(file, 'utf8'), '{invalid board data');
  }
});

test('memory cleanup HTTP routes require revisions, remove only a manual link, and archive without deleting notes', async t => {
  const f = fixture(t, { deferCleanup: true }), memory = createMemoryStore({ dataDir: f.dataDir });
  const first = memory.upsert({ workspace: f.workspace, title: 'Alpha', content: 'Isolated alpha observation' }), second = memory.upsert({ workspace: f.workspace, title: 'Beta', content: 'Unrelated beta record' });
  const edge = memory.link({ source: first.id, target: second.id, type: 'depends_on' });
  const agentNote = memory.upsert({ workspace: f.workspace, title: 'Agent finding', content: 'Unverified result', source: 'agent', pinned: true });
  const app = createHQServer({ dataDir: f.dataDir, workspace: f.workspace, port: 0, providers: { detectProviders: async () => [], startProvider: async () => { assert.fail('cleanup cannot start a model'); } } });
  const { url } = await app.start(); t.after(async () => { app.server.closeAllConnections(); try { await app.close(); } finally { rmSync(f.dir, { recursive: true, force: true }); } });
  const state = await fetch(`${url}/api/state`).then(response => response.json());
  const request = (route, body, method) => fetch(`${url}${route}`, { method, headers: { 'content-type': 'application/json', 'x-hq-token': state.server.csrfToken }, body: JSON.stringify(body) });
  assert.equal((await request(`/api/memory/links/${edge.id}`, { workspace: f.workspace }, 'DELETE')).status, 400);
  assert.equal((await request(`/api/memory/links/${edge.id}`, { workspace: f.workspace, expectedSourceRevision: 99, expectedTargetRevision: 1 }, 'DELETE')).status, 409);
  const removed = await request(`/api/memory/links/${edge.id}`, { workspace: f.workspace, expectedSourceRevision: 1, expectedTargetRevision: 1 }, 'DELETE'); assert.equal(removed.status, 200); assert.equal((await removed.json()).removed, true);
  const archived = await request(`/api/memory/${first.id}`, { workspace: f.workspace, expectedRevision: 1, archived: true }, 'PATCH'); assert.equal(archived.status, 200); assert.equal((await archived.json()).node.archived, true);
  const agentArchived = await request(`/api/memory/${agentNote.id}`, { workspace: f.workspace, expectedRevision: 1, archived: true }, 'PATCH');
  assert.equal(agentArchived.status, 200);
  const archivedAgentNode = (await agentArchived.json()).node;
  assert.equal(archivedAgentNode.source, 'agent'); assert.equal(archivedAgentNode.confidence, 'unverified');
  const restored = await request(`/api/memory/${agentNote.id}`, { workspace: f.workspace, expectedRevision: archivedAgentNode.revision, archived: false }, 'PATCH');
  assert.equal(restored.status, 200); assert.equal((await restored.json()).node.confidence, 'unverified');
  const after = await fetch(`${url}/api/memory`).then(response => response.json()); assert.equal(after.nodes.length, 3); assert.equal(after.nodes.find(node => node.id === first.id).content, first.content); assert.ok(!after.edges.some(link => link.id === edge.id));
});
