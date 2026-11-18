import assert from 'node:assert/strict';
import { EventEmitter, getEventListeners } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { readClaudeModels, readClaudeQuota } from '../lib/claude-quota.mjs';

const report = {
  session: { total_api_duration_ms: 0, total_cost_usd: 0, model_usage: {} },
  subscription_type: 'max', rate_limits_available: true,
  rate_limits: { five_hour: { utilization: 6, resets_at: '2026-11-18T17:10:00Z' }, seven_day: { utilization: 24, resets_at: '2026-11-22T11:00:00Z' }, limits: [{ kind: 'weekly_scoped', group: 'weekly', percent: 0, resets_at: '2026-11-22T11:00:00Z', scope: { model: { display_name: 'モデル 🧠' } }, severity: 'normal', is_active: true }], extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null, utilization: null, currency: null } },
};
const status = code => error => error.code === code && error.message === 'Claude usage is unavailable.';

function fixture(answer) {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
  child.exitCode = null; child.killed = 0;
  child.kill = () => { child.killed++; child.exitCode = 0; child.emit('close', 0); };
  const requests = [], spawns = []; let buffer = '';
  const emit = message => child.stdout.write(`${JSON.stringify(message)}\n`);
  child.stdin.on('data', chunk => {
    buffer += chunk;
    let boundary;
    while ((boundary = buffer.indexOf('\n')) !== -1) {
      const message = JSON.parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 1); requests.push(message);
      queueMicrotask(() => answer?.(message, emit, child));
    }
  });
  const options = {
    locate: async id => { assert.equal(id, 'claude'); return { command: 'C:\\CLI Space\\claude.exe', prefix: ['wrapper.js'] }; },
    spawnProcess: (command, args, config) => { spawns.push({ command, args, config }); return child; },
  };
  return { child, requests, spawns, options, emit };
}
const initThen = callback => (message, emit, child) => {
  if (message.request.subtype === 'initialize') emit({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: {} } });
  else callback(message, emit, child);
};

test('Claude quota sends only initialize and get_usage controls, preserving OAuth while disabling customizations and all model input', async () => {
  const f = fixture(initThen((message, emit) => emit({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: report } })));
  assert.deepEqual(await readClaudeQuota(f.options), report);
  assert.deepEqual(f.requests.map(message => message.type), ['control_request', 'control_request']);
  assert.deepEqual(f.requests.map(message => message.request.subtype), ['initialize', 'get_usage']);
  assert.deepEqual(f.requests[1].request, { subtype: 'get_usage', skip_behaviors: true });
  assert.ok(f.requests.every(message => !('message' in message) && !('prompt' in message)));
  const { args, config } = f.spawns[0];
  assert.equal(config.shell, false); assert.equal(config.windowsHide, true);
  assert.equal(config.env.ANTHROPIC_API_KEY, undefined); assert.equal(config.env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.ok(args.includes('--safe-mode')); assert.ok(!args.includes('--bare'));
  assert.equal(args[args.indexOf('--setting-sources') + 1], '');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.deepEqual(JSON.parse(args[args.indexOf('--settings') + 1]), { disableAllHooks: true, autoMemoryEnabled: false, promptSuggestionEnabled: false });
  assert.deepEqual(JSON.parse(args[args.indexOf('--mcp-config') + 1]), { mcpServers: {} });
  assert.ok(args.includes('--strict-mcp-config')); assert.ok(args.includes('--no-session-persistence'));
  assert.equal(f.child.killed, 1);
});

test('Claude quota decodes split UTF-8 and waits for the matching control response', async () => {
  const f = fixture(initThen((message, emit, child) => {
    emit({ type: 'control_response', response: { subtype: 'success', request_id: 'unrelated', response: { secret: 'ignored' } } });
    const bytes = Buffer.from(`${JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: report } })}\n`);
    for (let start = 0; start < bytes.length; start += 3) child.stdout.write(bytes.subarray(start, start + 3));
  }));
  assert.deepEqual(await readClaudeQuota(f.options), report);
});

test('an older Claude without get_usage fails without a fallback user prompt or leaking the upstream diagnostic', async () => {
  const f = fixture(initThen((message, emit) => emit({ type: 'control_response', response: { subtype: 'error', request_id: message.request_id, error: 'get_usage unsupported SECRET_UPSTREAM' } })));
  await assert.rejects(readClaudeQuota(f.options), status('unavailable'));
  assert.equal(f.requests.length, 2); assert.equal(f.child.killed, 1);
});

test('missing CLI and authentication failures are generic and never include account details', async () => {
  let spawned = false;
  await assert.rejects(readClaudeQuota({ locate: async () => null, spawnProcess: () => { spawned = true; } }), status('missing'));
  assert.equal(spawned, false);
  const f = fixture((message, emit) => emit({ type: 'control_response', response: { subtype: 'error', request_id: message.request_id, error: 'Not logged in: private@example.invalid' } }));
  await assert.rejects(readClaudeQuota(f.options), status('login_required'));
});

test('missing plan data and unexpected inference messages never produce a fabricated balance', async () => {
  for (const response of [{ rate_limits_available: false, rate_limits: null }, { rate_limits_available: true, rate_limits: null }]) {
    const f = fixture(initThen((message, emit) => emit({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response } })));
    await assert.rejects(readClaudeQuota(f.options), status('unavailable'));
  }
  const f = fixture((_, emit) => emit({ type: 'assistant', message: { content: 'unexpected model text' } }));
  await assert.rejects(readClaudeQuota(f.options), status('unavailable'));
  assert.equal(f.requests.length, 1); assert.equal(f.child.killed, 1);
});

test('Claude quota bounds lookup, stdout and process lifetime, and never spawns after a lookup deadline', async () => {
  let spawned = false;
  await assert.rejects(readClaudeQuota({ locate: () => new Promise(() => {}), spawnProcess: () => { spawned = true; }, timeoutMs: 15 }), status('unavailable'));
  assert.equal(spawned, false);
  const waiting = fixture(() => {});
  await assert.rejects(readClaudeQuota({ ...waiting.options, timeoutMs: 15 }), status('unavailable'));
  assert.equal(waiting.child.killed, 1);
  const huge = fixture((_, __, child) => child.stdout.write('x'.repeat(2 * 1024 * 1024 + 1)));
  await assert.rejects(readClaudeQuota(huge.options), status('unavailable'));
  assert.equal(huge.child.killed, 1);
});

test('Claude spawn errors and malformed protocol output stay generic', async () => {
  const f = fixture((_, __, child) => child.stdout.write('{invalid JSON}\n'));
  await assert.rejects(readClaudeQuota(f.options), status('unavailable'));
  const broken = fixture(() => {});
  const spawn = broken.options.spawnProcess;
  await assert.rejects(readClaudeQuota({ ...broken.options, spawnProcess: (...args) => {
    const child = spawn(...args);
    queueMicrotask(() => child.emit('error', Object.assign(new Error('private launch failure'), { code: 'ENOENT' })));
    return child;
  } }), status('missing'));
});

test('aborting a quota lookup prevents a later cloud process launch and removes the abort listener', async () => {
  const controller = new AbortController();
  let resolveLookup, spawns = 0, lookups = 0;
  const lookup = new Promise(resolve => { resolveLookup = resolve; });
  const pending = readClaudeQuota({ signal: controller.signal, locate: () => { lookups++; return lookup; }, spawnProcess: () => { spawns++; } });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
  controller.abort();
  await assert.rejects(pending, status('unavailable'));
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  resolveLookup({ command: 'claude', prefix: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lookups, 1); assert.equal(spawns, 0, 'a late lookup cannot start a probe after local-only is enabled');
  await assert.rejects(readClaudeQuota({ signal: controller.signal, locate: () => { lookups++; } }), status('unavailable'));
  assert.equal(lookups, 1, 'an already-aborted probe does not even locate the CLI');
});

test('aborting an active Claude quota request kills its owned process immediately without sending user input', async () => {
  const controller = new AbortController();
  const f = fixture(initThen(() => {}));
  f.child.pid = 8123;
  const pending = readClaudeQuota({ ...f.options, signal: controller.signal, platform: 'linux' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.requests.map(message => message.request.subtype), ['initialize', 'get_usage']);
  controller.abort();
  await assert.rejects(pending, status('unavailable'));
  assert.equal(f.child.killed, 1); assert.equal(f.spawns.length, 1, 'the injected platform chooses direct child termination');
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.ok(f.requests.every(message => message.type === 'control_request'));
});

test('Claude stderr shares the exact stdout byte limit and stream errors expose no diagnostics', async () => {
  const f = fixture((_, __, child) => {
    child.stdout.write('x'.repeat(1024 * 1024));
    child.stderr.write('s'.repeat(1024 * 1024));
    assert.equal(child.killed, 0, 'the combined 2 MiB boundary is accepted');
    child.stderr.write('!');
  });
  await assert.rejects(readClaudeQuota(f.options), status('unavailable'));
  assert.equal(f.child.killed, 1);
  for (const stream of ['stdout', 'stderr']) {
    const broken = fixture((_, __, child) => child[stream].emit('error', new Error('SECRET transport diagnostic')));
    await assert.rejects(readClaudeQuota(broken.options), status('error'));
    assert.equal(broken.child.killed, 1);
  }
});

test('Claude model discovery returns only initialization model metadata and never sends get_usage or model input', async () => {
  const models = [
    { value: 'opus', resolvedModel: 'claude-opus-5-5', displayName: 'Opus 5.5', description: 'Advanced reasoning', supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'], supportsFastMode: true },
    { value: 'haiku', resolvedModel: 'claude-haiku-5-5', displayName: 'Haiku 5.5', description: 'Fast responses', supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'] },
  ];
  const f = fixture((message, emit) => emit({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: { models, account: { email: 'private@example.invalid', token: 'PRIVATE' }, commands: [{ name: 'PRIVATE' }] } } }));
  const controller = new AbortController();
  const result = await readClaudeModels({ ...f.options, signal: controller.signal });
  assert.deepEqual(result, models);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.deepEqual(f.requests.map(message => message.request), [{ subtype: 'initialize', hooks: {} }]);
  assert.ok(f.requests.every(message => message.type === 'control_request' && !('message' in message) && !('prompt' in message)));
  assert.equal(f.child.killed, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('Claude model discovery fails closed for missing metadata and aborts without launching a late child', async () => {
  const f = fixture((message, emit) => emit({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: { account: { email: 'private@example.invalid' } } } }));
  await assert.rejects(readClaudeModels(f.options), status('unavailable'));
  assert.equal(f.requests.length, 1);
  assert.equal(f.child.killed, 1);
  const controller = new AbortController();
  let resolveLookup, spawned = false;
  const pending = readClaudeModels({ signal: controller.signal, locate: () => new Promise(resolve => { resolveLookup = resolve; }), spawnProcess: () => { spawned = true; } });
  controller.abort();
  await assert.rejects(pending, status('unavailable'));
  resolveLookup({ command: 'claude', prefix: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(spawned, false);
});
