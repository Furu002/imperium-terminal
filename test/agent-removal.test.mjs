import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createHQServer } from '../server.mjs';
import { canonicalMemoryWorkspace } from '../lib/memory.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check) { const end = Date.now() + 3000; while (Date.now() < end) { if (await check()) return; await delay(10); } assert.fail('Offline removal state was not reached'); }
async function fixture(t) {
  const parent = await realpath(tmpdir()), directory = await realpath(await mkdtemp(path.join(parent, 'imperium-removal-'))), other = path.join(directory, 'other'); await mkdir(other);
  const calls = [], providers = {
    detectProviders: async () => ['codex', 'claude'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true })),
    startProvider: async options => {
      options.onEvent({ type: 'session', source: 'cli-session', sessionId: randomUUID() });
      const call = { ...options, finished: false, finish(result = {}) { if (call.finished) return; call.finished = true; options.onExit({ code: 0, output: 'RETAINED_AGENT_RESULT', ...result }); } };
      calls.push(call); return { cancel() { call.cancelled = true; } };
    },
  };
  const app = createHQServer({ dataDir: path.join(directory, 'data'), workspace: directory, port: 0, providers }); const { url } = await app.start();
  const state = async () => (await fetch(`${url}/api/state`)).json(), initial = await state();
  const request = (route, body, method = 'POST') => fetch(`${url}${route}`, { method, headers: { 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ok = async (route, body, method = 'POST') => { const response = await request(route, body, method), value = await response.json(); assert.ok(response.ok, `${route}: ${response.status} ${JSON.stringify(value)}`); return value; };
  const connection = async () => (await ok('/api/providers/register', { providerId: 'claude', label: 'My registered model', modelId: 'configured' })).connection;
  const agent = async (connectionId, name = 'Removal agent') => (await ok('/api/departments', { name, role: 'Offline agent role', provider: 'claude', connectionId })).department;
  const remove = (id, workspace = directory) => request(`/api/departments/${id}`, { workspace }, 'DELETE');
  t.after(async () => {
    app.server.closeAllConnections(); await app.close(); const relative = path.relative(parent, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(directory).startsWith('imperium-removal-'));
    await rm(directory, { recursive: true, force: true });
  });
  return { app, url, directory, other, calls, state, request, ok, connection, agent, remove };
}
const node = id => ({ id: `department:${id}`, type: 'department', referenceId: id, x: 100, y: 100 });

test('agent removal prunes only its real graph references and preserves tasks, results, memory, conversations and registered models', async t => {
  const f = await fixture(t), connection = await f.connection(), removed = await f.agent(connection.id), retained = await f.agent(undefined, 'Retained agent');
  const memory = (await f.ok('/api/memory', { title: 'Retained memory', content: 'RETAINED_MEMORY', kind: 'note' })).node;
  await f.ok('/api/graph', { nodes: [node(removed.id), node(retained.id), { id: `memory:${memory.id}`, type: 'memory', referenceId: memory.id, x: 0, y: 0 }], edges: [
    { id: 'removed-handoff', type: 'handoff', source: `department:${removed.id}`, target: `department:${retained.id}` },
    { id: 'removed-context', type: 'memory_context', source: `memory:${memory.id}`, target: `department:${removed.id}` },
    { id: 'retained-context', type: 'memory_context', source: `memory:${memory.id}`, target: `department:${retained.id}` },
  ] }, 'PUT');
  const task = (await f.ok('/api/tasks', { departmentId: removed.id, prompt: 'Offline original task', permission: 'read-only' })).task;
  await eventually(() => f.calls.length === 1); f.calls[0].finish(); await eventually(async () => (await f.state()).tasks.find(item => item.id === task.id).status === 'completed');
  const storedTask = f.app.store.state.tasks.find(item => item.id === task.id); delete storedTask.departmentName;
  const otherGraph = { nodes: [node(removed.id)], edges: [] }; f.app.store.state.graphs[canonicalMemoryWorkspace(f.other)] = structuredClone(otherGraph);
  const before = await f.state(), memoryBefore = (await f.ok('/api/memory', undefined, 'GET')).nodes;
  const response = await f.remove(removed.id); assert.equal(response.status, 200); assert.equal((await response.json()).departmentId, removed.id);
  const after = await f.state(); assert.ok(!after.departments.some(item => item.id === removed.id)); assert.ok(after.departments.some(item => item.id === retained.id));
  assert.equal(after.tasks.length, before.tasks.length); const history = after.tasks.find(item => item.id === task.id);
  assert.equal(history.output, 'RETAINED_AGENT_RESULT'); assert.equal(history.departmentName, removed.name); assert.equal(history.conversationId, task.conversationId);
  assert.deepEqual(after.conversations, before.conversations); assert.deepEqual(after.connections, before.connections);
  assert.deepEqual((await f.ok('/api/memory', undefined, 'GET')).nodes, memoryBefore);
  const graph = (await f.ok('/api/graph', undefined, 'GET')).graph;
  assert.deepEqual(graph.nodes.map(item => item.id).sort(), [`department:${retained.id}`, `memory:${memory.id}`].sort()); assert.deepEqual(graph.edges.map(item => item.id), ['retained-context']);
  assert.deepEqual(f.app.store.state.graphs[canonicalMemoryWorkspace(f.other)], otherGraph);
  assert.ok(after.events.some(event => event.type === 'agent_removed' && event.departmentId === removed.id));
  const profile = f.app.store.state.projects.find(project => canonicalMemoryWorkspace(project.workspace) === canonicalMemoryWorkspace(f.directory)); assert.ok(!profile.departments.some(item => item.id === removed.id));
  const persisted = JSON.parse(await readFile(path.join(f.directory, 'data', 'state.json'), 'utf8')); assert.ok(!persisted.departments.some(item => item.id === removed.id)); assert.equal(persisted.tasks.find(item => item.id === task.id).departmentName, removed.name);
  await f.ok('/api/settings', { workspace: f.other }); await f.ok('/api/settings', { workspace: f.directory }); assert.ok(!(await f.state()).departments.some(item => item.id === removed.id));
  assert.equal((await f.request(`/api/providers/connections/${connection.id}`, undefined, 'DELETE')).status, 200);
});

test('removal requires the exact current workspace, an existing agent and mutation authentication', async t => {
  const f = await fixture(t), agent = await f.agent();
  assert.equal((await f.request(`/api/departments/${agent.id}`, {}, 'DELETE')).status, 400);
  assert.equal((await f.remove(agent.id, 'relative/path')).status, 400);
  assert.equal((await f.remove(agent.id, f.other)).status, 409);
  assert.equal((await f.remove('missing-agent')).status, 404);
  const hostile = await fetch(`${f.url}/api/departments/${agent.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: f.directory }) }); assert.equal(hostile.status, 403);
  assert.ok((await f.state()).departments.some(item => item.id === agent.id));
});

test('running, queued and cancelled-but-still-running process assignments prevent agent removal', async t => {
  const f = await fixture(t), agent = await f.agent();
  const first = (await f.ok('/api/tasks', { departmentId: agent.id, prompt: 'First offline task' })).task; await eventually(() => f.calls.length === 1);
  const second = (await f.ok('/api/tasks', { departmentId: agent.id, prompt: 'Queued offline task' })).task;
  assert.equal((await f.remove(agent.id)).status, 409);
  await f.ok(`/api/tasks/${second.id}/cancel`, {}); await f.ok(`/api/tasks/${first.id}/cancel`, {});
  assert.equal((await f.state()).tasks.find(item => item.id === first.id).status, 'cancelled'); assert.equal(f.calls[0].cancelled, true);
  assert.equal((await f.remove(agent.id)).status, 409, 'process ownership survives an immediately visible cancelled status');
  const retainedHistory = f.app.store.state.tasks;
  f.app.store.state.tasks = retainedHistory.filter(task => task.id !== first.id);
  assert.equal((await f.remove(agent.id)).status, 409, 'the active process remains protected even if a terminal history row was evicted');
  f.app.store.state.tasks = retainedHistory;
  f.calls[0].finish({ code: 130, error: 'Offline process exited' }); await delay(10);
  assert.equal((await f.remove(agent.id)).status, 200);
  assert.equal((await f.state()).tasks.length, 2);
});

test('a registered model cannot be removed while assigned in another project, and becomes removable after both agents are removed', async t => {
  const f = await fixture(t), connection = await f.connection(), homeAgent = await f.agent(connection.id);
  assert.equal((await f.request(`/api/providers/connections/${connection.id}`, undefined, 'DELETE')).status, 409);
  await f.ok('/api/settings', { workspace: f.other }); const otherAgent = await f.agent(connection.id, 'Other project agent');
  const otherGraph = { nodes: [node(otherAgent.id)], edges: [] }; await f.ok('/api/graph', otherGraph, 'PUT');
  await f.ok('/api/settings', { workspace: f.directory }); assert.equal((await f.remove(homeAgent.id)).status, 200);
  assert.equal((await f.request(`/api/providers/connections/${connection.id}`, undefined, 'DELETE')).status, 409);
  await f.ok('/api/settings', { workspace: f.other }); assert.ok((await f.state()).departments.some(item => item.id === otherAgent.id)); assert.deepEqual((await f.ok('/api/graph', undefined, 'GET')).graph.nodes, otherGraph.nodes);
  assert.equal((await f.remove(otherAgent.id, f.other)).status, 200); assert.equal((await f.request(`/api/providers/connections/${connection.id}`, undefined, 'DELETE')).status, 200);
  assert.ok(!(await f.state()).connections.some(item => item.id === connection.id));
});
