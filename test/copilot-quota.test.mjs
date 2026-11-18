import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { readCopilotQuota } from '../lib/copilot-quota.mjs';

const target = { command: 'C:\\Program Files\\node.exe', prefix: ['C:\\한글 CLI\\copilot.cjs'] };
const frame = value => {
  const payload = Buffer.from(JSON.stringify(value));
  return Buffer.concat([Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`), payload]);
};
function controlledChild(onRequest = () => {}) {
  const child = new EventEmitter(), requests = [];
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.exitCode = null; child.kills = [];
  child.kill = signal => { child.kills.push(signal); child.exitCode = 0; child.emit('close', 0); return true; };
  let buffer = Buffer.alloc(0);
  child.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const boundary = buffer.indexOf('\r\n\r\n'); if (boundary < 0) return;
      const size = Number(/Content-Length: (\d+)/.exec(buffer.subarray(0, boundary).toString())[1]);
      if (buffer.length < boundary + 4 + size) return;
      const request = JSON.parse(buffer.subarray(boundary + 4, boundary + 4 + size).toString('utf8'));
      buffer = buffer.subarray(boundary + 4 + size); requests.push(request);
      queueMicrotask(() => onRequest(request, child));
    }
  });
  return { child, requests };
}
const optionsFor = child => ({ locate: async () => target, spawnProcess: () => child, platform: 'linux', timeoutMs: 500 });
const errorCode = code => error => {
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /PRIVATE_SECRET|private-path|upstream diagnostic/);
  return true;
};
const quota = { quotaSnapshots: { premium_interactions: { isUnlimitedEntitlement: false, entitlementRequests: 300, usedRequests: 300, remainingPercentage: 0, overage: 0, resetDate: '2026-12-01T00:00:00Z' } } };
function standardResponder(request, child) {
  if (request.method === 'connect') child.stdout.write(frame({ jsonrpc: '2.0', id: request.id, result: {} }));
  if (request.method === 'auth.getStatus') child.stdout.write(frame({ jsonrpc: '2.0', id: request.id, result: { isAuthenticated: true, authType: 'user' } }));
  if (request.method === 'account.getQuota') child.stdout.write(frame({ jsonrpc: '2.0', id: request.id, result: quota }));
}

test('Copilot quota uses only three read-only methods, byte-framed Unicode and sanitized subscription environment', async t => {
  const keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GH_TOKEN', 'COPILOT_GITHUB_TOKEN', 'ELECTRON_RUN_AS_NODE'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  for (const key of keys) process.env[key] = key === 'ELECTRON_RUN_AS_NODE' ? '1' : 'PRIVATE_SECRET';
  const { child, requests } = controlledChild((request, process) => {
    const result = request.method === 'connect' ? {} : request.method === 'auth.getStatus' ? { isAuthenticated: true, authType: 'account' } : { ...quota, label: '구독 계정 😀' };
    const response = frame({ jsonrpc: '2.0', id: request.id, result });
    // Byte-by-byte fragmentation splits Hangul, emoji, framing headers and payloads.
    for (const byte of response) process.stdout.write(Buffer.from([byte]));
  });
  let spawned;
  const result = await readCopilotQuota({ ...optionsFor(child), spawnProcess: (...args) => { spawned = args; return child; } });
  assert.equal(result.label, '구독 계정 😀');
  assert.deepEqual(result.quotaSnapshots, quota.quotaSnapshots);
  assert.deepEqual(requests.map(request => request.method), ['connect', 'auth.getStatus', 'account.getQuota']);
  assert.deepEqual(requests.at(-1).params, {});
  assert.ok(requests.every(request => !/session|generate|turn|thread|CurrentAuth/i.test(request.method)));
  assert.deepEqual(spawned[1], [...target.prefix, '--headless', '--stdio', '--no-auto-update']);
  assert.equal(spawned[2].shell, false); assert.equal(spawned[2].windowsHide, true);
  assert.equal(spawned[2].env.ELECTRON_RUN_AS_NODE, '1');
  for (const key of keys.filter(key => key !== 'ELECTRON_RUN_AS_NODE')) assert.equal(spawned[2].env[key], undefined);
  assert.equal(child.stdin.writableEnded, true); assert.deepEqual(child.kills, ['SIGTERM']);
});

test('unknown or API-key authentication never reads account quota', async () => {
  for (const auth of [{}, { isAuthenticated: false }, { isAuthenticated: true, authType: 'api-key' }, { isAuthenticated: true, authType: 'token' }]) {
    const { child, requests } = controlledChild((request, process) => process.stdout.write(frame({ id: request.id, result: request.method === 'connect' ? {} : auth })));
    await assert.rejects(readCopilotQuota(optionsFor(child)), errorCode('login_required'));
    assert.deepEqual(requests.map(request => request.method), ['connect', 'auth.getStatus']);
    assert.equal(child.kills.length, 1);
  }
});

test('wrong IDs and server credential/tool callbacks cannot advance the probe or expose secrets', async () => {
  const { child, requests } = controlledChild((request, process) => {
    if (!request.method) return;
    process.stdout.write(frame({ id: 9999, result: { PRIVATE_SECRET: true } }));
    process.stdout.write(frame({ id: 'credential-request', method: 'github.token.acquire', params: {} }));
    standardResponder(request, process);
  });
  assert.deepEqual(await readCopilotQuota(optionsFor(child)), quota);
  assert.deepEqual(requests.filter(request => request.method).map(request => request.method), ['connect', 'auth.getStatus', 'account.getQuota']);
  assert.ok(requests.filter(request => request.id === 'credential-request').every(request => request.error?.code === -32601 && !Object.hasOwn(request, 'result')));
});

test('missing executables, spawn errors and RPC errors expose only safe coded failures', async () => {
  await assert.rejects(readCopilotQuota({ locate: async () => null }), errorCode('missing'));
  await assert.rejects(readCopilotQuota({ locate: async () => { throw new Error('private-path PRIVATE_SECRET'); } }), errorCode('unavailable'));
  await assert.rejects(readCopilotQuota({ locate: async () => target, spawnProcess: () => { throw Object.assign(new Error('private-path'), { code: 'ENOENT' }); } }), errorCode('missing'));
  for (const [rpcCode, expected] of [[-32601, 'unavailable'], [-32000, 'error']]) {
    const { child } = controlledChild((request, process) => process.stdout.write(frame({ id: request.id, error: { code: rpcCode, message: 'PRIVATE_SECRET upstream diagnostic' } })));
    child.stderr.write('PRIVATE_SECRET upstream diagnostic');
    await assert.rejects(readCopilotQuota(optionsFor(child)), errorCode(expected));
    assert.equal(child.kills.length, 1);
  }
  for (const stream of ['stdin', 'stdout', 'stderr']) {
    const { child } = controlledChild((_request, process) => process[stream].emit('error', new Error('PRIVATE_SECRET upstream diagnostic')));
    await assert.rejects(readCopilotQuota(optionsFor(child)), errorCode('error'));
    assert.equal(child.kills.length, 1);
  }
});

test('malformed framing, payloads and combined stream overflow stop the process', async () => {
  const invalid = [
    Buffer.from('Content-Length: 2097153\r\n\r\n'),
    Buffer.from('Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}'),
    Buffer.from('Content-Length: 1\r\n\r\n{'),
    Buffer.alloc(8193, 65),
  ];
  for (const payload of invalid) {
    const { child } = controlledChild((_request, process) => process.stdout.write(payload));
    await assert.rejects(readCopilotQuota(optionsFor(child)), errorCode('error'));
    assert.equal(child.kills.length, 1);
  }
  const { child } = controlledChild((_request, process) => process.stderr.write(Buffer.alloc(2 * 1024 * 1024 + 1, 65)));
  await assert.rejects(readCopilotQuota(optionsFor(child)), errorCode('error'));
  assert.equal(child.kills.length, 1);
  const combined = controlledChild((_request, process) => {
    process.stdout.write(Buffer.concat([Buffer.from('Content-Length: 2097100\r\n\r\n'), Buffer.alloc(1024 * 1024, 32)]));
    process.stderr.write(Buffer.alloc(1024 * 1024, 65));
  }).child;
  await assert.rejects(readCopilotQuota(optionsFor(combined)), errorCode('error'));
  assert.equal(combined.kills.length, 1, 'each stream is below 2MiB, but their combined bytes exceed the transport cap');
});

test('timeouts include executable lookup and never launch a process after a late lookup completes', async () => {
  let resolveLocate, spawned = 0;
  const reading = readCopilotQuota({ locate: () => new Promise(resolve => { resolveLocate = resolve; }), spawnProcess: () => { spawned++; }, timeoutMs: 15 });
  await assert.rejects(reading, errorCode('unavailable'));
  resolveLocate(target); await new Promise(resolve => setImmediate(resolve));
  assert.equal(spawned, 0);
  const { child } = controlledChild();
  await assert.rejects(readCopilotQuota({ ...optionsFor(child), timeoutMs: 15 }), errorCode('unavailable'));
  assert.equal(child.kills.length, 1);
});

test('abort before or during a quota probe blocks further RPCs and terminates the owned child', async () => {
  const before = new AbortController(); before.abort();
  let located = false;
  await assert.rejects(readCopilotQuota({ signal: before.signal, locate: async () => { located = true; return target; } }), errorCode('unavailable'));
  assert.equal(located, false);
  const signal = new AbortController();
  const { child, requests } = controlledChild();
  const reading = readCopilotQuota({ ...optionsFor(child), signal: signal.signal });
  await new Promise(resolve => setImmediate(resolve)); signal.abort(); signal.abort();
  await assert.rejects(reading, errorCode('unavailable'));
  assert.deepEqual(requests.map(request => request.method), ['connect']);
  assert.equal(child.kills.length, 1);
});

test('Windows cleanup kills only the numeric owned process tree and falls back safely if taskkill fails', async () => {
  const { child } = controlledChild(standardResponder); child.pid = 54321;
  const killer = new EventEmitter(), calls = [];
  killer.unref = () => {};
  const result = await readCopilotQuota({
    ...optionsFor(child), platform: 'win32', spawnProcess: (...args) => { calls.push(args); return calls.length === 1 ? child : killer; },
  });
  assert.deepEqual(result, quota);
  assert.equal(calls[1][0], 'taskkill.exe');
  assert.deepEqual(calls[1][1], ['/PID', '54321', '/T', '/F']);
  assert.equal(calls[1][2].shell, false); assert.equal(calls[1][2].windowsHide, true);
  killer.emit('error', new Error('PRIVATE_SECRET')); killer.emit('close', 1);
  assert.deepEqual(child.kills, ['SIGTERM']);
});
