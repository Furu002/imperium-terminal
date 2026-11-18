import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createHQServer } from '../server.mjs';
import { createTerminalManager } from '../lib/terminal.mjs';
import { createStore } from '../lib/store.mjs';
import { resolveAccessSettings, validateAccessSettings, accessSettingsChanged, assertTaskPermission, assertTerminalEnabled } from '../lib/access-policy.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) { const result = await check(); if (result) return result; await delay(10); }
  assert.fail('Expected offline test state was not reached');
}
function fakePty() {
  const spawned = [];
  return {
    spawned,
    spawn() {
      const data = new Set(), exit = new Set();
      const process = {
        killed: 0, writes: [], sizes: [],
        onData(listener) { data.add(listener); return { dispose() { data.delete(listener); } }; },
        onExit(listener) { exit.add(listener); return { dispose() { exit.delete(listener); } }; },
        write(value) { process.writes.push(value); }, resize(...values) { process.sizes.push(values); }, kill() { process.killed++; },
      };
      spawned.push(process); return process;
    },
  };
}
async function fixture(t, options = {}) {
  const parent = await realpath(tmpdir()), directory = await realpath(await mkdtemp(path.join(parent, 'imperium-access-')));
  const calls = [], pty = fakePty();
  const terminal = createTerminalManager({ ptyModule: pty, closeOnProcessExit: false });
  const providers = {
    detectProviders: async () => ['codex', 'claude'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true })),
    startProvider: async options => {
      options.onEvent({ type: 'session', sessionId: options.resumeSessionId || randomUUID(), source: 'cli-session' });
      const call = { ...options, done: false, finish() { if (call.done) return; call.done = true; options.onExit({ code: 0, output: 'Offline fixture result' }); } };
      calls.push(call); return { cancel() { call.finish(); } };
    },
  };
  const app = createHQServer({ dataDir: path.join(directory, 'state'), workspace: directory, port: 0, providers, terminalManager: terminal, ...options });
  const { url } = await app.start();
  const state = async () => (await fetch(`${url}/api/state`)).json();
  const initial = await state();
  const request = (route, body, method = 'POST', extra = {}) => fetch(`${url}${route}`, { method, headers: { 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken, ...extra.headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...extra });
  const submit = (extra = {}) => request('/api/tasks', { prompt: 'Offline policy test', departmentId: 'strategy', ...extra });
  let closed = false;
  const close = async () => { if (!closed) { closed = true; app.server.closeAllConnections(); await app.close(); } };
  t.after(async () => {
    await close();
    const relative = path.relative(parent, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(directory).startsWith('imperium-access-'));
    await rm(directory, { recursive: true, force: true });
  });
  return { app, url, directory, state, request, submit, close, initial, calls, pty, terminal };
}

test('legacy defaults remain task-by-task and terminal enabled; corrupt persisted policy fails closed', () => {
  assert.deepEqual(resolveAccessSettings(), { accessPolicy: 'task-confirm', terminalEnabled: true });
  assert.deepEqual(resolveAccessSettings({ accessPolicy: 'full-access', terminalEnabled: 'true' }), { accessPolicy: 'read-only', terminalEnabled: false });
  assert.doesNotThrow(() => assertTaskPermission({}, 'workspace-write'));
  assert.throws(() => assertTaskPermission({ accessPolicy: 'read-only' }, 'workspace-write'), error => error.status === 403);
  assert.doesNotThrow(() => assertTaskPermission({ accessPolicy: 'read-only' }, 'read-only'));
  assert.throws(() => assertTerminalEnabled({ terminalEnabled: false }), error => error.status === 403);
  for (const accessPolicy of [null, false, 0, '', 'auto', 'bypassPermissions', 'workspace-write', [], {}]) assert.throws(() => validateAccessSettings({ accessPolicy }), error => error.status === 400);
  for (const terminalEnabled of [null, 0, 1, 'false', [], {}]) assert.throws(() => validateAccessSettings({ terminalEnabled }), error => error.status === 400);
  const current = { accessPolicy: 'read-only', terminalEnabled: true };
  assert.deepEqual(validateAccessSettings({ terminalEnabled: false }, current), { accessPolicy: 'read-only', terminalEnabled: false });
  assert.deepEqual(current, { accessPolicy: 'read-only', terminalEnabled: true });
  assert.equal(accessSettingsChanged(current, current), false);
  assert.equal(accessSettingsChanged(current, { ...current, terminalEnabled: false }), true);
});

test('settings validate and persist without changing existing defaults or silently upgrading task permissions', async t => {
  const f = await fixture(t);
  assert.equal(f.initial.settings.accessPolicy, 'task-confirm'); assert.equal(f.initial.settings.terminalEnabled, true);
  let response = await f.request('/api/settings', { accessPolicy: 'read-only', terminalEnabled: false });
  assert.equal(response.status, 200); const settings = (await response.json()).settings;
  assert.equal(settings.accessPolicy, 'read-only'); assert.equal(settings.terminalEnabled, false);
  for (const bad of [{ accessPolicy: 'full-access' }, { terminalEnabled: 'false' }, { accessPolicy: null }, { terminalEnabled: null }]) assert.equal((await f.request('/api/settings', bad)).status, 400);
  const persisted = JSON.parse(await readFile(path.join(f.directory, 'state', 'state.json'), 'utf8'));
  assert.equal(persisted.settings.accessPolicy, 'read-only'); assert.equal(persisted.settings.terminalEnabled, false);
  response = await f.submit(); assert.equal(response.status, 201);
  assert.equal((await response.json()).task.permission, 'read-only');
  await eventually(() => f.calls.length === 1); assert.equal(f.calls[0].permission, 'read-only');
  f.calls[0].finish(); await f.close();
  const reopened = createStore({ dataDir: path.join(f.directory, 'state'), workspace: f.directory });
  assert.equal(reopened.state.settings.accessPolicy, 'read-only'); assert.equal(reopened.state.settings.terminalEnabled, false);
});

test('read-only policy rejects forged direct and workflow write requests before queuing any task', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/settings', { accessPolicy: 'read-only' })).status, 200);
  assert.equal((await f.submit({ permission: 'workspace-write', provider: 'codex' })).status, 403);
  assert.equal((await f.submit({ permission: 'workspace-write', provider: 'claude' })).status, 403);
  assert.equal((await f.request('/api/workflows/run', { departmentId: 'strategy', prompt: 'Offline workflow', permission: 'workspace-write' })).status, 403);
  assert.equal(f.calls.length, 0); assert.equal((await f.state()).tasks.length, 0);
  assert.equal((await f.request('/api/settings', { accessPolicy: 'task-confirm' })).status, 200);
  assert.equal((await f.submit({ permission: 'workspace-write' })).status, 201);
  await eventually(() => f.calls.length === 1); assert.equal(f.calls[0].permission, 'workspace-write');
});

test('actual policy changes wait for running and queued AI work; an idempotent save remains allowed', async t => {
  const f = await fixture(t);
  assert.equal((await f.submit()).status, 201); await eventually(() => f.calls.length === 1);
  assert.equal((await f.submit()).status, 201);
  assert.equal((await f.request('/api/settings', { accessPolicy: 'read-only' })).status, 409);
  assert.equal((await f.request('/api/settings', { terminalEnabled: false })).status, 409);
  assert.equal((await f.request('/api/settings', { accessPolicy: 'task-confirm', terminalEnabled: true })).status, 200);
  assert.equal((await f.state()).settings.accessPolicy, 'task-confirm'); assert.equal((await f.state()).settings.terminalEnabled, true);
  f.calls[0].finish(); await eventually(() => f.calls.length === 2);
  assert.equal((await f.request('/api/settings', { accessPolicy: 'read-only' })).status, 409);
  f.calls[1].finish(); await eventually(async () => (await f.state()).tasks.every(task => task.status === 'completed'));
  assert.equal((await f.request('/api/settings', { accessPolicy: 'read-only', terminalEnabled: false })).status, 200);
});

test('disabling the terminal closes its owned sessions and SSE, and gates forged list/start/input/resize/events requests', async t => {
  const f = await fixture(t);
  const started = await f.request('/api/terminal', {}); assert.equal(started.status, 201);
  const id = (await started.json()).session.id;
  assert.equal((await f.request(`/api/terminal/${id}/input`, { data: 'echo offline\r' })).status, 200);
  assert.deepEqual(f.pty.spawned[0].writes, ['echo offline\r']);
  const controller = new AbortController(); t.after(() => controller.abort());
  const response = await fetch(`${f.url}/api/terminal/${id}/events`, { signal: controller.signal });
  assert.equal(response.status, 200); const reader = response.body.getReader(); await reader.read();
  assert.equal((await f.request('/api/settings', { terminalEnabled: false })).status, 200);
  assert.equal(f.pty.spawned[0].killed, 1); assert.deepEqual(f.terminal.list(), []);
  const ended = async () => { for (;;) { const chunk = await reader.read(); if (chunk.done) return true; } };
  assert.equal(await Promise.race([ended(), delay(2000).then(() => false)]), true);
  for (const [route, body, method] of [
    ['/api/terminal', undefined, 'GET'], ['/api/terminal', {}, 'POST'],
    [`/api/terminal/${id}/input`, { data: 'forged' }, 'POST'], [`/api/terminal/${id}/resize`, { cols: 100, rows: 30 }, 'POST'],
    [`/api/terminal/${id}/events`, undefined, 'GET'],
  ]) assert.equal((await f.request(route, body, method)).status, 403, route);
  assert.deepEqual(f.pty.spawned[0].writes, ['echo offline\r']); assert.equal(f.pty.spawned.length, 1);
  assert.equal((await f.request(`/api/terminal/${id}/close`, {})).status, 404, 'explicit cleanup is not blocked by policy');
  const review = await f.request('/api/changes', undefined, 'GET'); assert.equal(review.status, 200, 'purpose-built read-only Git review stays available');
  assert.ok((await review.json()).review);
  assert.equal((await f.request('/api/settings', { terminalEnabled: true })).status, 200);
  assert.equal((await f.request('/api/terminal', {})).status, 201); assert.equal(f.pty.spawned.length, 2);
});

test('a terminal request whose body is still uploading cannot bypass a newly disabled terminal policy', async t => {
  const f = await fixture(t);
  const started = await f.request('/api/terminal', {}), id = (await started.json()).session.id;
  const payload = JSON.stringify({ data: 'must never reach the shell' });
  let finishUpload, sent;
  const firstBytes = new Promise(resolve => { sent = resolve; });
  const response = new Promise((resolve, reject) => {
    const request = http.request(`${f.url}/api/terminal/${id}/input`, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-hq-token': f.initial.server.csrfToken } }, result => {
      result.resume(); result.on('end', () => resolve(result.statusCode)); result.on('error', reject);
    });
    request.on('error', reject); request.setTimeout(4000, () => request.destroy(new Error('Upload fixture timed out')));
    request.write(payload.slice(0, 1), sent); finishUpload = () => request.end(payload.slice(1));
    t.after(() => request.destroy());
  });
  await firstBytes; await delay(20);
  assert.equal((await f.request('/api/settings', { terminalEnabled: false })).status, 200);
  finishUpload(); assert.equal(await response, 403);
  assert.equal(f.pty.spawned[0].killed, 1); assert.deepEqual(f.pty.spawned[0].writes, []);
});

test('a read-only changes request rejects an in-flight review after the current project changes', async t => {
  let release, announce, capturedWorkspace;
  const started = new Promise(resolve => { announce = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { changeReview: async workspace => { capturedWorkspace = workspace; announce(); await pending; return { available: true, workspace, diff: 'PRIVATE_PREVIOUS_PROJECT_DIFF' }; } });
  t.after(release);
  const review = f.request('/api/changes', undefined, 'GET'); await started;
  assert.equal(capturedWorkspace, f.initial.settings.workspace);
  const next = path.join(f.directory, 'other-project'); await mkdir(next);
  assert.equal((await f.request('/api/settings', { workspace: next })).status, 200);
  release(); const response = await review; assert.equal(response.status, 409);
  assert.ok(!(await response.text()).includes('PRIVATE_PREVIOUS_PROJECT_DIFF'));
  assert.equal(f.calls.length, 0); assert.equal(f.pty.spawned.length, 0);
});
