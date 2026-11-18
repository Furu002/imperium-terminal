import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuotaManager } from '../lib/quotas.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const rawCodex = usedPercent => ({ rateLimits: { primary: { usedPercent, windowDurationMins: 300 } } });
const find = (snapshot, id) => snapshot.providers.find(value => value.id === id);

function fixture(t, options = {}) {
  const state = { settings: { workspace: 'C:\\Project A', localOnly: options.offline === true }, providers: ['codex', 'claude', 'copilot', 'gemini', 'ollama'].map(id => ({ id, status: 'ready', installed: true, authenticated: true })), connections: [], tasks: [{ prompt: 'PRIVATE_TASK_PROMPT', output: 'PRIVATE_TASK_RESULT' }] };
  let clock = Date.parse('2026-11-18T09:00:00Z'), changes = 0;
  const manager = createQuotaManager({ getState: () => state, readers: options.readers ?? { codex: async () => rawCodex(6) }, now: () => clock, ttlMs: options.ttlMs ?? 60000, timeoutMs: options.timeoutMs ?? 500, onChanged: () => { changes++; options.onChanged?.(); } });
  t.after(() => manager.close());
  const offline = value => { state.settings.localOnly = value; manager.setOffline(value); };
  return { manager, state, advance: ms => { clock += ms; }, offline, changes: () => changes };
}

test('snapshots do not query providers and current-account quota is shared across model connections and projects', async t => {
  let calls = 0;
  const f = fixture(t, { readers: { codex: async () => { calls++; return rawCodex(6); } } });
  f.state.connections = Array.from({ length: 12 }, (_, index) => ({ id: `connection-${index}`, providerId: 'codex', modelId: `model-${index}` }));
  const empty = f.manager.snapshot();
  assert.equal(calls, 0); assert.equal(empty.accountScope, 'current-os-user-cli-account');
  assert.equal(find(empty, 'ollama').status, 'local'); assert.equal(find(empty, 'gemini').status, 'unavailable');
  const first = await f.manager.get();
  assert.equal(calls, 1); assert.equal(first.providers.filter(value => value.id === 'codex').length, 1);
  assert.equal(find(first, 'codex').windows[0].remainingPercent, 94);
  f.state.settings.workspace = 'C:\\Project B';
  assert.equal(find(await f.manager.get(), 'codex').windows[0].remainingPercent, 94);
  assert.equal(calls, 1, 'switching a project must not create a separate wallet or request');
  assert.doesNotMatch(JSON.stringify(first), /PRIVATE_TASK/);
});

test('normal TTL caching and force refresh use a ten-second minimum cooldown', async t => {
  let calls = 0;
  const f = fixture(t, { readers: { codex: async () => rawCodex(++calls) } });
  await f.manager.get(); assert.equal(calls, 1);
  f.advance(9999); await f.manager.get({ force: true }); assert.equal(calls, 1);
  f.advance(1); await f.manager.get({ force: true }); assert.equal(calls, 2);
  f.advance(59999); await f.manager.get(); assert.equal(calls, 2);
  f.advance(1); await f.manager.get(); assert.equal(calls, 3);
  assert.equal(find(f.manager.snapshot(), 'codex').checkedAt, '2026-11-18T09:01:10.000Z');
});

test('concurrent refreshes share one in-flight read even when force is requested', async t => {
  const response = deferred(); let calls = 0;
  const f = fixture(t, { readers: { codex: () => { calls++; return response.promise; } } });
  const first = f.manager.get(), second = f.manager.get({ force: true }), third = f.manager.get();
  await tick(); assert.equal(calls, 1);
  response.resolve(rawCodex(10));
  const results = await Promise.all([first, second, third]);
  assert.ok(results.every(result => find(result, 'codex').windows[0].remainingPercent === 90));
  assert.equal(calls, 1);
});

test('local-only mode never queries cloud readers and disables cloud usage links', async t => {
  let calls = 0;
  const f = fixture(t, { offline: true, readers: { codex: async () => { calls++; return rawCodex(6); } } });
  for (const snapshot of [f.manager.snapshot(), await f.manager.get(), await f.manager.get({ force: true })]) {
    assert.equal(snapshot.localOnly, true);
    for (const row of snapshot.providers.filter(value => value.id !== 'ollama')) { assert.equal(row.status, 'offline'); assert.equal(row.usageUrl, null); assert.deepEqual(row.windows, []); }
    assert.equal(find(snapshot, 'ollama').status, 'local');
  }
  assert.equal(calls, 0);
  f.offline(false); await f.manager.get(); assert.equal(calls, 1);
});

test('offline activation aborts pending reads and pre-offline replies cannot overwrite a newer online snapshot', async t => {
  const pending = [], signals = [];
  const f = fixture(t, { readers: { codex: ({ signal }) => { const request = deferred(); signals.push(signal); pending.push(request); return request.promise; } } });
  const previous = f.manager.get(); await tick();
  f.offline(true);
  assert.equal(signals[0].aborted, true);
  assert.equal((await previous).localOnly, true);
  f.offline(false);
  const current = f.manager.get(); await tick(); assert.equal(pending.length, 2);
  pending[1].resolve(rawCodex(10)); await current;
  pending[0].resolve(rawCodex(99)); await tick();
  assert.equal(find(f.manager.snapshot(), 'codex').windows[0].remainingPercent, 90);
  assert.ok(f.changes() >= 3);
});

test('providers without authenticated ready status are skipped and errors never leak raw diagnostics', async t => {
  const calls = [];
  const f = fixture(t, { readers: {
    codex: async () => { calls.push('codex'); throw Object.assign(new Error('PRIVATE_SECRET C:\\private-path'), { code: 'unavailable' }); },
    claude: async () => { calls.push('claude'); throw Object.assign(new Error('PRIVATE_SECRET'), { code: 'missing' }); },
    copilot: async () => { calls.push('copilot'); throw new Error('PRIVATE_SECRET'); },
  } });
  f.state.providers.find(value => value.id === 'codex').status = 'login_required';
  f.state.providers.find(value => value.id === 'claude').authenticated = false;
  Object.assign(f.state.providers.find(value => value.id === 'copilot'), { status: 'missing', installed: false });
  const skipped = await f.manager.get();
  assert.deepEqual(calls, []);
  assert.ok(skipped.providers.filter(value => ['codex', 'claude', 'copilot'].includes(value.id)).every(value => value.status === 'login_required'));
  for (const provider of f.state.providers) Object.assign(provider, { status: 'ready', installed: true, authenticated: true });
  const result = await f.manager.get();
  assert.deepEqual(calls.sort(), ['claude', 'codex', 'copilot']);
  assert.equal(find(result, 'codex').status, 'unavailable');
  assert.equal(find(result, 'claude').status, 'login_required');
  assert.equal(find(result, 'copilot').status, 'error');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SECRET|private-path|PRIVATE_TASK/);
});

test('observed Claude stream limits use fraction units and cached snapshots are defensive copies', async t => {
  let calls = 0;
  const f = fixture(t, { readers: { claude: async () => { calls++; return {}; } } });
  f.manager.observe('claude', { rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.06 } } }, accessToken: 'PRIVATE_SECRET' });
  const first = f.manager.snapshot(), row = find(first, 'claude');
  assert.equal(row.source, 'claude-cli-event'); assert.equal(row.windows[0].remainingPercent, 94);
  row.windows[0].remainingPercent = 0;
  assert.equal(find(f.manager.snapshot(), 'claude').windows[0].remainingPercent, 94);
  await f.manager.get(); assert.equal(calls, 0);
  f.manager.observe('claude', {});
  assert.equal(find(f.manager.snapshot(), 'claude').windows[0].remainingPercent, 94);
  assert.doesNotMatch(JSON.stringify(f.manager.snapshot()), /PRIVATE_SECRET|PRIVATE_TASK/);
  f.offline(true); f.manager.observe('claude', { rateLimitType: 'five_hour', utilization: 0.9 });
  assert.deepEqual(find(f.manager.snapshot(), 'claude').windows, []);
});

test('partial Claude stream events retain full plan, weekly, scoped and extra-usage data without postponing the full-read TTL', async t => {
  let calls = 0;
  const fullReport = {
    subscription_type: 'max', rate_limits_available: true,
    rate_limits: {
      limits: [
        { kind: 'session', group: 'session', percent: 25, resets_at: '2026-11-18T14:00:00Z', scope: null },
        { kind: 'weekly_all', group: 'weekly', percent: 40, resets_at: '2026-11-22T09:00:00Z', scope: null },
        { kind: 'weekly_scoped', group: 'weekly', percent: 5, resets_at: '2026-11-22T09:00:00Z', scope: { model: { display_name: 'Fable' } } },
      ],
      extra_usage: { is_enabled: true, monthly_limit: 10000, used_credits: 1234, decimal_places: 2, currency: 'usd' },
    },
    accountEmail: 'PRIVATE_ACCOUNT_DETAIL',
  };
  const f = fixture(t, { readers: { claude: async () => { calls++; return structuredClone(fullReport); } } });
  const initial = find(await f.manager.get(), 'claude');
  assert.equal(initial.source, 'claude-cli-usage'); assert.equal(initial.planType, 'max');
  assert.deepEqual(initial.windows.map(window => window.id), ['five_hour', 'seven_day', 'seven_day_fable']);
  assert.deepEqual(initial.extraUsage, { enabled: true, limit: 100, used: 12.34, remaining: 87.66, currency: 'USD', decimalPlaces: 2 });
  assert.equal(initial.checkedAt, '2026-11-18T09:00:00.000Z');
  f.advance(59000);
  f.manager.observe('claude', { rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.3, resetsAt: Date.parse('2026-11-18T14:30:00Z') / 1000 } } } });
  const updated = find(f.manager.snapshot(), 'claude');
  assert.equal(updated.source, 'claude-cli-event'); assert.equal(updated.status, 'available');
  assert.equal(updated.windows.length, 3, 'the five-hour event must replace its canonical row rather than append a duplicate');
  const fiveHour = updated.windows.find(window => window.id === 'five_hour');
  assert.equal(fiveHour.remainingPercent, 70); assert.equal(fiveHour.resetsAt, '2026-11-18T14:30:00.000Z');
  assert.deepEqual(updated.windows.filter(window => window.id !== 'five_hour'), initial.windows.filter(window => window.id !== 'five_hour'));
  assert.equal(updated.planType, initial.planType); assert.deepEqual(updated.extraUsage, initial.extraUsage); assert.equal(updated.credits, null);
  assert.equal(updated.checkedAt, initial.checkedAt, 'partial observations must keep the timestamp of the complete account report');
  await f.manager.get(); assert.equal(calls, 1);
  f.advance(999); await f.manager.get(); assert.equal(calls, 1);
  f.advance(1); const refreshed = find(await f.manager.get(), 'claude');
  assert.equal(calls, 2, 'the original full report expires at 60 seconds despite a stream update at 59 seconds');
  assert.equal(refreshed.checkedAt, '2026-11-18T09:01:00.000Z');
  assert.equal(refreshed.source, 'claude-cli-usage');
  assert.doesNotMatch(JSON.stringify(f.manager.snapshot()), /PRIVATE_ACCOUNT_DETAIL|PRIVATE_TASK/);
});

test('Copilot request counts provide remaining percentages when the CLI omits percentage fields', async t => {
  const f = fixture(t, { readers: { copilot: async () => ({ copilotPlan: 'pro', quotaResetDate: '2026-12-01T00:00:00Z', quotaSnapshots: {
    monthly: { entitlementRequests: 100, usedRequests: 25 },
    overrun: { entitlementRequests: 100, usedRequests: 125 },
    zero_limit: { entitlementRequests: 0, usedRequests: 0 },
  } }) } });
  const row = find(await f.manager.get(), 'copilot');
  assert.equal(row.status, 'available'); assert.equal(row.planType, 'pro'); assert.equal(row.credits, null);
  const monthly = row.windows.find(window => window.id === 'monthly');
  assert.equal(monthly.usedPercent, 25); assert.equal(monthly.remainingPercent, 75);
  assert.equal(monthly.limit, 100); assert.equal(monthly.remaining, 75); assert.equal(monthly.unit, 'requests');
  assert.equal(monthly.resetsAt, '2026-12-01T00:00:00.000Z');
  const overrun = row.windows.find(window => window.id === 'overrun');
  assert.equal(overrun.remainingPercent, 0); assert.equal(overrun.remaining, 0);
  assert.ok(!row.windows.some(window => window.id === 'zero_limit'), 'a zero allowance cannot produce a fabricated percentage');
});

test('invalidation cancels outstanding reads and close prevents subsequent queries or stale updates', async t => {
  const pending = deferred(); let signal, calls = 0;
  const f = fixture(t, { readers: { codex: options => { calls++; signal = options.signal; return pending.promise; } } });
  const reading = f.manager.get(); await tick();
  f.manager.invalidate(); assert.equal(signal.aborted, true); await reading;
  f.manager.close(); pending.resolve(rawCodex(80)); await tick();
  await f.manager.get({ force: true }); f.manager.observe('codex', rawCodex(1));
  assert.equal(calls, 1);
  assert.deepEqual(find(f.manager.snapshot(), 'codex').windows, []);
});

test('a newer observed usage event survives an older pending read result or error', async t => {
  for (const fails of [false, true]) {
    const response = deferred();
    const f = fixture(t, { readers: { claude: () => response.promise } });
    const reading = f.manager.get(); await tick();
    f.manager.observe('claude', { rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.06 } } } });
    if (fails) response.reject(new Error('PRIVATE_SECRET stale read failure'));
    else response.resolve({ rate_limits: { five_hour: { utilization: 80 } } });
    await reading;
    const current = find(f.manager.snapshot(), 'claude');
    assert.equal(current.status, 'available');
    assert.equal(current.source, 'claude-cli-event');
    assert.equal(current.windows[0].remainingPercent, 94);
  }
});

test('metadata read deadlines abort a stalled reader and return only generic failure state', async t => {
  let signal;
  const f = fixture(t, { timeoutMs: 15, readers: { codex: options => { signal = options.signal; return new Promise(() => {}); } }, onChanged: () => { throw new Error('PRIVATE_SECRET callback error'); } });
  const result = await f.manager.get();
  assert.equal(signal.aborted, true);
  assert.equal(find(result, 'codex').status, 'error');
  assert.equal(find(result, 'codex').reason, 'read-failed');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SECRET|PRIVATE_TASK/);
});
