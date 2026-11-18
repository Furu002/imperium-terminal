import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStore, renameWithRetry } from '../lib/store.mjs';

async function fixture(t) {
  const parent = await realpath(tmpdir());
  const root = await realpath(await mkdtemp(path.join(parent, 'imperium-store-')));
  t.after(async () => {
    const relative = path.relative(parent, root);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(root).startsWith('imperium-store-')) throw new Error('Unexpected temporary store path');
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
const locked = code => Object.assign(new Error(`private path and content must not be exposed: C:\\private\\record.json`), { code });

function timers() {
  const callbacks = new Map(), delays = [];
  let next = 0;
  return {
    setTimer(callback, delay) { const id = ++next; callbacks.set(id, callback); delays.push(delay); return id; },
    clearTimer(id) { callbacks.delete(id); },
    flush() { const current = [...callbacks.values()]; callbacks.clear(); for (const callback of current) callback(); },
    pending: () => callbacks.size,
    delays,
  };
}

test('a transient rename failure retries once and atomically replaces the existing file', async t => {
  const root = await fixture(t), source = path.join(root, 'state.json.tmp'), target = path.join(root, 'state.json');
  writeFileSync(source, 'new state'); writeFileSync(target, 'previous state');
  let attempts = 0; const pauses = [];
  renameWithRetry(source, target, { rename(from, to) { if (++attempts === 1) throw locked('EPERM'); renameSync(from, to); }, pause: ms => pauses.push(ms) });
  assert.equal(attempts, 2);
  assert.deepEqual(pauses, [20]);
  assert.equal(await readFile(target, 'utf8'), 'new state');
  assert.equal(existsSync(source), false);
});

test('transient rename retries are bounded and exhaustion preserves both the old state and pending replacement', async t => {
  const root = await fixture(t), source = path.join(root, 'state.json.tmp'), target = path.join(root, 'state.json');
  writeFileSync(source, 'new state'); writeFileSync(target, 'previous state');
  for (const code of ['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY', 'EEXIST', 'ETXTBSY']) {
    const error = locked(code), pauses = []; let attempts = 0;
    assert.throws(() => renameWithRetry(source, target, { rename() { attempts++; throw error; }, pause: ms => pauses.push(ms) }), error);
    assert.equal(attempts, 5, code);
    assert.deepEqual(pauses, [20, 20, 20, 20], code);
    assert.equal(await readFile(target, 'utf8'), 'previous state');
    assert.equal(await readFile(source, 'utf8'), 'new state');
  }
});

test('non-transient storage errors throw immediately without blocking retries', () => {
  let attempts = 0; const pauses = [], error = locked('ENOSPC');
  assert.throws(() => renameWithRetry('source', 'target', { rename() { attempts++; throw error; }, pause: ms => pauses.push(ms) }), error);
  assert.equal(attempts, 1); assert.deepEqual(pauses, []);
});

test('timer save failures are caught with safe metadata and a subsequent persist recovers without a retry loop', async t => {
  const root = await fixture(t), clock = timers(), warnings = [], pauses = [];
  let failRename = false, attempts = 0;
  const store = createStore({ dataDir: root, workspace: path.join(root, 'workspace') }, {
    ...clock, warn: (...args) => warnings.push(args), pause: ms => pauses.push(ms),
    rename(from, to) { attempts++; if (failRename) throw locked('EPERM'); renameSync(from, to); },
  });
  const file = path.join(root, 'state.json'), previous = await readFile(file, 'utf8');
  store.state.settings.language = 'en';
  failRename = true; store.persist(); store.persist();
  assert.equal(clock.pending(), 1); assert.deepEqual(clock.delays, [1000]);
  assert.doesNotThrow(() => clock.flush());
  assert.equal(attempts, 6);
  assert.deepEqual(pauses, [20, 20, 20, 20]);
  assert.equal(clock.pending(), 0);
  assert.equal(await readFile(file, 'utf8'), previous);
  assert.equal(store.state.server.storageError.code, 'EPERM');
  assert.ok(store.state.server.storageError.message);
  assert.ok(!JSON.stringify({ warnings, error: store.state.server.storageError }).includes('private'));
  assert.deepEqual(warnings, [['[IMPERIUM storage]', 'EPERM']]);
  failRename = false; store.persist(); clock.flush();
  assert.equal(store.state.server.storageError, undefined);
  const persisted = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(persisted.settings.language, 'en');
  assert.equal(Object.hasOwn(persisted, 'server'), false);
  assert.equal(Object.hasOwn(persisted, 'providers'), false);
});

test('explicit save failure throws, retains existing state, clears pending work, and later saves recover', async t => {
  const root = await fixture(t), clock = timers();
  let failRename = false;
  const store = createStore({ dataDir: root, workspace: path.join(root, 'workspace') }, {
    ...clock, pause() {}, rename(from, to) { if (failRename) throw locked('EACCES'); renameSync(from, to); },
  });
  const file = path.join(root, 'state.json'), previous = await readFile(file, 'utf8');
  store.state.settings.language = 'ja'; store.persist();
  failRename = true;
  assert.throws(() => store.save(), { code: 'EACCES' });
  assert.equal(clock.pending(), 0);
  assert.equal(store.state.server.storageError.code, 'EACCES');
  assert.equal(await readFile(file, 'utf8'), previous);
  failRename = false; store.save(); clock.flush();
  assert.equal(store.state.server.storageError, undefined);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).settings.language, 'ja');
});

test('an immediate explicit save cancels its timer and persists the newest data once', async t => {
  const root = await fixture(t), clock = timers(); let renames = 0;
  const store = createStore({ dataDir: root, workspace: path.join(root, 'workspace') }, { ...clock, rename(from, to) { renames++; renameSync(from, to); } });
  store.event('status', '종료 직전 저장');
  assert.equal(clock.pending(), 1);
  store.save(); clock.flush();
  assert.equal(renames, 2);
  assert.equal(clock.pending(), 0);
  assert.equal(JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8')).events.at(-1).text, '종료 직전 저장');
});

test('timer failures remain non-throwing when the warning logger fails and unsafe error codes are replaced', async t => {
  const root = await fixture(t), clock = timers(); let failRename = false;
  const store = createStore({ dataDir: root, workspace: path.join(root, 'workspace') }, {
    ...clock, warn() { throw new Error('logger unavailable'); }, pause() {},
    rename(from, to) { if (failRename) throw locked('C:\\private\\state.json'); renameSync(from, to); },
  });
  failRename = true; store.persist();
  assert.doesNotThrow(() => clock.flush());
  assert.equal(store.state.server.storageError.code, 'ESTORAGE');
  assert.ok(!store.state.server.storageError.message.includes('private'));
});
