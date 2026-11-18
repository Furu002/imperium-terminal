import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readCodexQuota } from '../lib/codex-quota.mjs';

function fixture(responder) {
  const child = new EventEmitter(), calls = [];
  Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, kills: 0 });
  child.kill = () => { child.kills++; child.exitCode = 0; child.emit('close', 0); };
  child.stdin.on('data', chunk => { for (const line of chunk.toString().trim().split('\n')) { const call = JSON.parse(line); calls.push(call); queueMicrotask(() => responder?.(call, child)); } });
  return { child, calls, options: { locate: async () => ({ command: 'codex', prefix: [] }), spawnProcess: () => child, platform: 'linux', timeoutMs: 500 } };
}
test('Codex quota only initializes and reads account rate limits, retaining true zero without inference', async () => {
  const raw = { rateLimits: { primary: { usedPercent: 100, resetsAt: 1900000000 } }, SECRET_UNRENDERED: 'private data' };
  const f = fixture((call, child) => {
    if (call.id === 1) child.stdout.write(JSON.stringify({ id: 1, result: {} }) + '\n');
    if (call.id === 2) { const reply = Buffer.from(JSON.stringify({ id: 2, result: raw }) + '\n'); for (const byte of reply) child.stdout.write(Buffer.from([byte])); }
  });
  let args;
  assert.deepEqual(await readCodexQuota({ ...f.options, spawnProcess: (...value) => { args = value; return f.child; } }), raw);
  assert.deepEqual(f.calls.map(value => value.method), ['initialize', 'initialized', 'account/rateLimits/read']);
  assert.equal(args[2].shell, false); assert.equal(args[2].windowsHide, true); assert.equal(f.child.kills, 1);
});
test('Codex auth errors and output limits are sanitized and processes stop', async () => {
  const f = fixture((call, child) => { if (call.id === 1) child.stdout.write(JSON.stringify({ id: 1, error: { message: 'unauthorized PRIVATE_SECRET' } }) + '\n'); });
  await assert.rejects(readCodexQuota(f.options), error => error.code === 'login_required' && !error.message.includes('PRIVATE_SECRET'));
  const huge = fixture((call, child) => { if (call.id === 1) child.stderr.write('x'.repeat(2 * 1024 * 1024 + 1)); });
  await assert.rejects(readCodexQuota(huge.options), error => error.code === 'error'); assert.equal(huge.child.kills, 1);
});
test('Codex lookup and active requests are bounded and abort cannot launch a delayed process', async () => {
  let resolve, spawned = 0;
  const lookup = new Promise(done => { resolve = done; });
  const controller = new AbortController();
  const request = readCodexQuota({ locate: () => lookup, spawnProcess: () => { spawned++; }, signal: controller.signal, timeoutMs: 100 });
  controller.abort(); await assert.rejects(request, error => error.code === 'offline'); resolve({ command: 'codex', prefix: [] }); await new Promise(done => setImmediate(done)); assert.equal(spawned, 0);
  await assert.rejects(readCodexQuota({ locate: () => new Promise(() => {}), timeoutMs: 5 }), error => error.code === 'error');
  const f = fixture(); const active = new AbortController(); const result = readCodexQuota({ ...f.options, signal: active.signal });
  await new Promise(done => setImmediate(done)); active.abort(); await assert.rejects(result, error => error.code === 'offline'); assert.equal(f.child.kills, 1);
});
