const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const label = value => typeof value === 'string' ? value.replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, '').slice(0, 80) : '';
const iso = value => {
  const date = typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value * 1000) : typeof value === 'string' && /^\d{4}-\d\d-\d\d/.test(value) ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const windowLabel = minutes => minutes === 300 ? '5h' : minutes === 10080 ? '7d' : minutes && minutes % 60 === 0 ? `${minutes / 60}h` : minutes ? `${minutes}m` : '';
function windowValue(id, name, used, minutes, reset, extra = {}) {
  if (number(used) === null) return null;
  return { id, label: name, usedPercent: Math.min(100, used), remainingPercent: Math.max(0, 100 - used), windowMinutes: number(minutes), resetsAt: iso(reset), ...extra };
}
function credits(value) {
  if (!record(value)) return null;
  const balance = typeof value.balance === 'string' && /^\d{1,18}(?:\.\d{1,12})?$/.test(value.balance) ? value.balance : null;
  if (balance === null && typeof value.unlimited !== 'boolean' && typeof value.hasCredits !== 'boolean') return null;
  return { hasCredits: value.hasCredits === true, unlimited: value.unlimited === true, balance };
}

export function normalizeCodexQuota(raw = {}) {
  if (!record(raw)) return { windows: [], credits: null, planType: null, status: 'unavailable' };
  const buckets = record(raw.rateLimitsByLimitId) && Object.keys(raw.rateLimitsByLimitId).length ? Object.entries(raw.rateLimitsByLimitId).slice(0, 20) : record(raw.rateLimits) ? [[raw.rateLimits.limitId || 'codex', raw.rateLimits]] : [];
  const windows = [], wallets = [];
  let planType = null;
  for (const [key, bucket] of buckets) {
    if (!record(bucket)) continue;
    const id = label(bucket.limitId || key), name = label(bucket.limitName || id);
    planType ||= label(bucket.planType) || null;
    for (const type of ['primary', 'secondary']) {
      const value = bucket[type]; if (!record(value)) continue;
      const minutes = number(value.windowDurationMins);
      const row = windowValue(`${id}:${type}`, [name, windowLabel(minutes)].filter(Boolean).join(' · '), value.usedPercent, minutes, value.resetsAt);
      if (row) windows.push(row);
    }
    const wallet = credits(bucket.credits); if (wallet) wallets.push({ id, label: name, ...wallet });
  }
  const unique = new Map(wallets.map(value => [JSON.stringify([value.hasCredits, value.unlimited, value.balance]), value]));
  const balance = credits(raw.rateLimits?.credits) || (unique.size === 1 ? credits([...unique.values()][0]) : null);
  return { windows, credits: balance, creditBalances: unique.size > 1 ? wallets : [], planType: planType || label(raw.rateLimits?.planType) || null, resetCreditsAvailable: number(raw.rateLimitResetCredits?.availableCount), status: windows.length || balance || wallets.length ? 'available' : 'unavailable' };
}

export function normalizeClaudeQuota(raw = {}) {
  if (!record(raw)) return { windows: [], credits: null, planType: null, status: 'unavailable' };
  const windows = [];
  // get_usage uses percent units; rate_limit_event.unifiedWindows uses fractions.
  // Do not confuse a 6-percent usage report with 600-percent stream utilization.
  if (record(raw.rate_limits)) {
    const rates = raw.rate_limits;
    if (raw.rate_limits_available !== false && Array.isArray(rates.limits) && rates.limits.length) {
      rates.limits.slice(0, 30).forEach((value, index) => {
        if (!record(value)) return;
        const minutes = value.group === 'session' || value.kind === 'session' ? 300 : value.group === 'weekly' || typeof value.kind === 'string' && value.kind.startsWith('weekly') ? 10080 : null;
        const scope = label(value.scope?.model?.display_name || value.scope?.model?.id || value.scope?.surface);
        const id = value.kind === 'session' ? 'five_hour' : value.kind === 'weekly_all' ? 'seven_day' : value.kind === 'weekly_scoped' && scope ? `seven_day_${scope.toLowerCase()}` : `${label(value.kind || 'limit')}:${index}`;
        const row = windowValue(id, [scope, windowLabel(minutes) || label(value.kind)].filter(Boolean).join(' · '), value.percent, minutes, value.resets_at);
        if (row) windows.push(row);
      });
    } else if (raw.rate_limits_available !== false) {
      for (const [id, minutes] of [['five_hour', 300], ['seven_day', 10080], ['seven_day_opus', 10080], ['seven_day_sonnet', 10080]]) {
        const value = rates[id]; if (!record(value)) continue;
        const row = windowValue(id, id === 'five_hour' ? '5h' : id === 'seven_day' ? '7d' : id.replaceAll('_', ' '), value.utilization, minutes, value.resets_at);
        if (row) windows.push(row);
      }
    }
    const extra = rates.extra_usage;
    const validMoney = record(extra) && extra.is_enabled === true && Number.isInteger(extra.decimal_places) && extra.decimal_places >= 0 && extra.decimal_places <= 6 && typeof extra.currency === 'string' && /^[A-Za-z]{3}$/.test(extra.currency) && Number.isSafeInteger(extra.monthly_limit) && extra.monthly_limit >= 0 && Number.isSafeInteger(extra.used_credits) && extra.used_credits >= 0;
    const extraUsage = validMoney ? { enabled: true, limit: extra.monthly_limit / 10 ** extra.decimal_places, used: extra.used_credits / 10 ** extra.decimal_places, remaining: Math.max(0, extra.monthly_limit - extra.used_credits) / 10 ** extra.decimal_places, currency: extra.currency.toUpperCase(), decimalPlaces: extra.decimal_places } : record(extra) && extra.is_enabled === false ? { enabled: false } : null;
    return { windows, credits: null, extraUsage, planType: label(raw.subscription_type) || null, status: windows.length || validMoney ? 'available' : 'unavailable' };
  }
  const info = record(raw.rate_limit_info) ? raw.rate_limit_info : raw;
  const unified = record(info.unifiedWindows) ? info.unifiedWindows : {};
  for (const [id, minutes] of [['five_hour', 300], ['seven_day', 10080], ['seven_day_opus', 10080], ['seven_day_sonnet', 10080], ['seven_day_overage_included', 10080]]) {
    const value = unified[id] || info[id]; if (!record(value)) continue;
    const used = number(value.used_percentage) ?? (number(value.utilization) === null ? null : value.utilization * 100);
    const row = windowValue(id, id === 'five_hour' ? '5h' : id === 'seven_day' ? '7d' : id.replaceAll('_', ' '), used, minutes, value.resetsAt ?? value.resets_at);
    if (row) windows.push(row);
  }
  if (!windows.length && typeof info.rateLimitType === 'string') {
    const used = number(info.utilization); const id = info.rateLimitType;
    const row = windowValue(label(id), label(id).replaceAll('_', ' '), used === null ? null : used * 100, id === 'five_hour' ? 300 : id.startsWith('seven_day') ? 10080 : null, info.resetsAt);
    if (row) windows.push(row);
  }
  return { windows, credits: null, planType: label(raw.planType || raw.plan_type) || null, status: windows.length ? 'available' : 'unavailable' };
}

export function normalizeCopilotQuota(raw = {}) {
  if (!record(raw)) return { windows: [], credits: null, planType: null, status: 'unavailable' };
  const windows = [];
  if (record(raw.quotaSnapshots)) for (const [key, value] of Object.entries(raw.quotaSnapshots).slice(0, 20)) {
    if (!record(value)) continue;
    if (value.isUnlimitedEntitlement === true) { windows.push({ id: label(key), label: label(key).replaceAll('_', ' '), unlimited: true, usedPercent: null, remainingPercent: null, windowMinutes: null, resetsAt: iso(value.resetDate ?? raw.quotaResetDate) }); continue; }
    const remainingPercent = number(value.remainingPercentage);
    const limit = number(value.entitlementRequests), used = number(value.usedRequests);
    const counted = limit !== null && used !== null ? { limit, remaining: Math.max(0, limit - used), unit: 'requests' } : {};
    const usedPercent = remainingPercent !== null && remainingPercent <= 100 ? 100 - remainingPercent : limit > 0 && used !== null ? used / limit * 100 : null;
    const row = windowValue(label(key), label(key).replaceAll('_', ' '), usedPercent, null, value.resetDate ?? raw.quotaResetDate, counted);
    if (row) windows.push(row);
  }
  return { windows, credits: null, planType: label(raw.copilotPlan || raw.plan) || null, status: windows.length ? 'available' : 'unavailable' };
}
