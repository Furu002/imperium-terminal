import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCodexQuota, normalizeClaudeQuota, normalizeCopilotQuota } from '../lib/quota-normalize.mjs';

const codexWindow = (usedPercent, extra = {}) => ({ usedPercent, windowDurationMins: 300, resetsAt: 1794992400, ...extra });
const knownWallet = balance => ({ hasCredits: true, unlimited: false, balance });

test('Codex authoritative meter buckets replace the legacy view and identical account credits appear once', () => {
  const raw = {
    rateLimits: { limitId: 'codex', primary: codexWindow(99) },
    rateLimitsByLimitId: {
      codex: { limitId: 'codex', limitName: 'Codex', planType: 'pro', primary: codexWindow(6), secondary: codexWindow(20, { windowDurationMins: 10080 }), credits: knownWallet('12.50') },
      review: { limitId: 'review', limitName: 'Code review', primary: codexWindow(0), credits: knownWallet('12.50') },
    },
    rateLimitResetCredits: { availableCount: 2 },
  };
  const result = normalizeCodexQuota(raw);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.windows.map(value => value.id), ['codex:primary', 'codex:secondary', 'review:primary']);
  assert.deepEqual(result.windows.map(value => value.remainingPercent), [94, 80, 100]);
  assert.deepEqual(result.credits, knownWallet('12.50'));
  assert.deepEqual(result.creditBalances, []);
  assert.equal(result.planType, 'pro');
  assert.equal(result.resetCreditsAvailable, 2);
});

test('different Codex credit balances retain their separate meter labels and are never summed', () => {
  const result = normalizeCodexQuota({ rateLimitsByLimitId: {
    a: { limitName: 'Meter A', credits: knownWallet('10') },
    b: { limitName: 'Meter B', credits: knownWallet('20') },
  } });
  assert.equal(result.status, 'available');
  assert.equal(result.credits, null);
  assert.deepEqual(result.creditBalances.map(value => [value.label, value.balance]), [['Meter A', '10'], ['Meter B', '20']]);
  assert.ok(!JSON.stringify(result).includes('"balance":"30"'));
});

test('known zero usage and credit balance remain distinct from missing or malformed input', () => {
  const zero = normalizeCodexQuota({ rateLimits: { primary: codexWindow(0), credits: { hasCredits: false, unlimited: false, balance: '0' } } });
  assert.equal(zero.windows[0].usedPercent, 0);
  assert.equal(zero.windows[0].remainingPercent, 100);
  assert.equal(zero.credits.balance, '0');
  for (const normalize of [normalizeCodexQuota, normalizeClaudeQuota, normalizeCopilotQuota]) {
    for (const raw of [undefined, null, {}, [], 'untrusted input']) {
      const result = normalize(raw);
      assert.equal(result.status, 'unavailable');
      assert.deepEqual(result.windows, []);
      assert.equal(result.credits, null);
    }
  }
});

test('untrusted percentages, labels, counts and oversized lists stay bounded without invented values', () => {
  for (const usedPercent of [-1, NaN, Infinity, '6', null]) {
    assert.deepEqual(normalizeCodexQuota({ rateLimits: { primary: codexWindow(usedPercent) } }).windows, []);
  }
  const result = normalizeCodexQuota({ rateLimits: {
    limitName: `BAD\n\u202e${'a'.repeat(120)}`, primary: codexWindow(120), credits: knownWallet('USD 10'),
  }, rateLimitResetCredits: { availableCount: -1 } });
  assert.equal(result.windows[0].usedPercent, 100);
  assert.equal(result.windows[0].remainingPercent, 0);
  assert.doesNotMatch(result.windows[0].label, /[\n\u202e]/u);
  assert.ok(result.windows[0].label.length <= 85);
  assert.equal(result.credits.balance, null);
  assert.equal(result.resetCreditsAvailable, null);
  const buckets = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [String(index), { primary: codexWindow(1), secondary: codexWindow(2) }]));
  assert.equal(normalizeCodexQuota({ rateLimitsByLimitId: buckets }).windows.length, 40);
});

test('Claude get_usage percent units and streaming fraction units both report six percent used as 94 percent remaining', () => {
  const control = normalizeClaudeQuota({ rate_limits_available: true, rate_limits: { five_hour: { utilization: 6 } } });
  const streaming = normalizeClaudeQuota({ rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.06 } } } });
  for (const result of [control, streaming]) {
    assert.equal(result.windows[0].usedPercent, 6);
    assert.equal(result.windows[0].remainingPercent, 94);
    assert.equal(result.windows[0].windowMinutes, 300);
  }
  assert.equal(normalizeClaudeQuota({ rate_limit_info: { rateLimitType: 'five_hour', utilization: 0 } }).windows[0].remainingPercent, 100);
  for (const raw of [{ rate_limits: { five_hour: { utilization: 125 } } }, { rate_limit_info: { unifiedWindows: { five_hour: { utilization: 1.25 } } } }]) {
    const value = normalizeClaudeQuota(raw).windows[0];
    assert.equal(value.usedPercent, 100); assert.equal(value.remainingPercent, 0);
  }
});

test('Claude model-scoped limit rows are authoritative and do not duplicate legacy aggregate rows', () => {
  const limits = [
    { kind: 'weekly_opus', group: 'weekly', percent: 30, scope: { model: { display_name: 'Opus' } } },
    { kind: 'weekly_sonnet', group: 'weekly', percent: 10, scope: { model: { display_name: 'Sonnet' } } },
  ];
  const result = normalizeClaudeQuota({ subscription_type: 'max', rate_limits_available: true, rate_limits: { limits, five_hour: { utilization: 50 }, seven_day: { utilization: 60 } } });
  assert.equal(result.windows.length, 2);
  assert.deepEqual(result.windows.map(value => value.remainingPercent), [70, 90]);
  assert.match(result.windows[0].label, /Opus/); assert.match(result.windows[1].label, /Sonnet/);
  assert.ok(result.windows.every(value => value.windowMinutes === 10080));
  assert.equal(new Set(result.windows.map(value => value.id)).size, 2);
  assert.equal(result.planType, 'max');
  assert.deepEqual(normalizeClaudeQuota({ rate_limits_available: false, rate_limits: { limits } }).windows, []);
  assert.equal(normalizeClaudeQuota({ rate_limits: { limits: Array.from({ length: 100 }, () => limits[0]) } }).windows.length, 30);
});

test('Claude extra usage is money only with explicit minor-unit metadata and never fabricates a credit wallet', () => {
  const extra = { is_enabled: true, monthly_limit: 1000, used_credits: 125 };
  const unknown = normalizeClaudeQuota({ rate_limits: { extra_usage: extra } });
  assert.equal(unknown.extraUsage, null); assert.equal(unknown.credits, null);
  const known = normalizeClaudeQuota({ rate_limits: { extra_usage: { ...extra, currency: 'usd', decimal_places: 2 } } });
  assert.deepEqual(known.extraUsage, { enabled: true, limit: 10, used: 1.25, remaining: 8.75, currency: 'USD', decimalPlaces: 2 });
  assert.equal(known.credits, null);
  const exhausted = normalizeClaudeQuota({ rate_limits: { extra_usage: { ...extra, monthly_limit: 100, used_credits: 125, currency: 'JPY', decimal_places: 0 } } });
  assert.equal(exhausted.extraUsage.remaining, 0);
  for (const changes of [{ currency: '$' }, { decimal_places: 7 }, { decimal_places: 1.5 }, { used_credits: '125' }, { monthly_limit: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(normalizeClaudeQuota({ rate_limits: { extra_usage: { ...extra, currency: 'USD', decimal_places: 2, ...changes } } }).extraUsage, null);
  }
});

test('provider reset timestamps normalize timezone offsets and invalid timestamps remain unknown', () => {
  const epoch = Date.parse('2026-11-18T09:00:00Z') / 1000;
  const codex = normalizeCodexQuota({ rateLimits: { primary: codexWindow(1, { resetsAt: epoch }) } }).windows[0];
  const claude = normalizeClaudeQuota({ rate_limits: { five_hour: { utilization: 1, resets_at: '2026-11-18T18:00:00+09:00' } } }).windows[0];
  const copilot = normalizeCopilotQuota({ quotaSnapshots: { premium_interactions: { remainingPercentage: 99, resetDate: '2026-11-18T09:00:00Z' } } }).windows[0];
  for (const value of [codex, claude, copilot]) assert.equal(value.resetsAt, '2026-11-18T09:00:00.000Z');
  for (const resetsAt of ['PRIVATE_PATH', '2026-99-99T99:99:99Z', Infinity, Number.MAX_VALUE, -1]) {
    assert.equal(normalizeCodexQuota({ rateLimits: { primary: codexWindow(1, { resetsAt }) } }).windows[0].resetsAt, null);
  }
});

test('Copilot preserves reported remaining percentages, unlimited status, and request counts without dollar conversions', () => {
  const result = normalizeCopilotQuota({ copilotPlan: 'pro', quotaSnapshots: {
    premium_interactions: { remainingPercentage: 0, entitlementRequests: 300, usedRequests: 320 },
    chat: { isUnlimitedEntitlement: true, entitlementRequests: -1, remainingPercentage: 100 },
    completions: { remainingPercentage: 60 },
  } });
  assert.equal(result.windows.length, 3);
  const [premium, chat, completions] = result.windows;
  assert.equal(premium.remainingPercent, 0); assert.equal(premium.remaining, 0); assert.equal(premium.limit, 300); assert.equal(premium.unit, 'requests');
  assert.equal(chat.unlimited, true); assert.equal(chat.remainingPercent, null); assert.equal(chat.usedPercent, null); assert.ok(!Object.hasOwn(chat, 'remaining'));
  assert.equal(completions.remainingPercent, 60); assert.ok(!Object.hasOwn(completions, 'limit'));
  assert.equal(result.credits, null); assert.equal(result.planType, 'pro');
  for (const remainingPercentage of [-1, 101, NaN, Infinity, '50']) assert.deepEqual(normalizeCopilotQuota({ quotaSnapshots: { bad: { remainingPercentage } } }).windows, []);
});

test('normalizers neither mutate provider input nor forward arbitrary credential or task fields', () => {
  const raw = { rateLimits: { primary: codexWindow(6) }, accessToken: 'PRIVATE_SECRET', prompt: 'PRIVATE_TASK_PROMPT', output: 'PRIVATE_TASK_RESULT' };
  const before = structuredClone(raw), result = normalizeCodexQuota(raw);
  result.windows[0].remainingPercent = 2;
  assert.deepEqual(raw, before);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SECRET|PRIVATE_TASK/);
});
