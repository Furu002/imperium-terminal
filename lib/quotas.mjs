import { readCodexQuota } from './codex-quota.mjs';
import { readClaudeQuota } from './claude-quota.mjs';
import { readCopilotQuota } from './copilot-quota.mjs';
import { normalizeCodexQuota, normalizeClaudeQuota, normalizeCopilotQuota } from './quota-normalize.mjs';

const INFO = {
  codex: { name: 'ChatGPT / Codex', source: 'codex-app-server', usageUrl: 'https://chatgpt.com/codex/settings/usage' },
  claude: { name: 'Claude Code', source: 'claude-cli-usage', usageUrl: 'https://claude.ai/settings/usage' },
  copilot: { name: 'GitHub Copilot CLI', source: 'copilot-cli', usageUrl: 'https://github.com/settings/copilot' },
  gemini: { name: 'Gemini CLI', source: null, usageUrl: 'https://geminicli.com/docs/resources/quota-and-pricing/' },
  ollama: { name: 'Ollama', source: null, usageUrl: null },
};
const NORMALIZE = { codex: normalizeCodexQuota, claude: normalizeClaudeQuota, copilot: normalizeCopilotQuota };
const READERS = { codex: readCodexQuota, claude: readClaudeQuota, copilot: readCopilotQuota };
const empty = (id, status, reason) => ({ id, ...INFO[id], status, reason, checkedAt: null, planType: null, windows: [], credits: null });

/** Account-level volatile snapshots only. No credentials, task cost estimates,
 * prompts, quota resets/redemption, or persisted balances. */
export function createQuotaManager({ getState, readers = READERS, now = Date.now, ttlMs = 60000, timeoutMs = 10000, onChanged = () => {} } = {}) {
  const cache = new Map(), controllers = new Set(), revisions = new Map();
  let offline = Boolean(getState?.()?.settings?.localOnly), generation = 0, inFlight = null, closed = false;
  const changed = () => { try { onChanged(); } catch {} };
  function invalidate() {
    generation++; cache.clear(); inFlight = null;
    for (const controller of controllers) controller.abort(); controllers.clear(); changed();
  }
  function setOffline(value) {
    const next = value === true;
    if (next !== offline) { offline = next; invalidate(); }
  }
  function stateChanged() { setOffline(getState?.()?.settings?.localOnly === true); }
  function providerState(id) { return getState?.()?.providers?.find(value => value.id === id); }
  function row(id) {
    if (id === 'ollama') return empty(id, 'local', 'local-no-subscription-quota');
    if (offline) return { ...empty(id, 'offline', 'local-only'), usageUrl: null };
    const provider = providerState(id);
    if (provider?.status !== 'ready' || provider.authenticated !== true) return empty(id, 'login_required', provider?.installed ? 'login-required' : 'not-installed');
    if (!readers[id]) return empty(id, 'unavailable', 'not-exposed-by-cli');
    return structuredClone(cache.get(id)?.value || empty(id, 'unavailable', 'not-checked'));
  }
  function snapshot() {
    stateChanged();
    return { providers: ['codex', 'claude', 'copilot', 'gemini', 'ollama'].map(row), refreshAfterMs: ttlMs, localOnly: offline, accountScope: 'current-os-user-cli-account' };
  }
  async function query(id, version) {
    const revision = revisions.get(id) || 0;
    const controller = new AbortController(); controllers.add(controller);
    let timer, abortListener;
    try {
      const expired = new Promise((_, reject) => {
        abortListener = () => reject(Object.assign(new Error('Quota read cancelled.'), { code: 'offline' }));
        controller.signal.addEventListener('abort', abortListener, { once: true });
        timer = setTimeout(() => controller.abort(), timeoutMs);
      });
      const raw = await Promise.race([Promise.resolve().then(() => readers[id]({ signal: controller.signal, timeoutMs })), expired]);
      if (closed || offline || version !== generation || revision !== (revisions.get(id) || 0)) return;
      const parsed = NORMALIZE[id](raw);
      cache.set(id, { at: now(), value: { ...empty(id, parsed.status, parsed.status === 'available' ? '' : 'not-exposed-by-cli'), ...parsed, checkedAt: new Date(now()).toISOString() } });
    } catch (error) {
      if (closed || offline || version !== generation || revision !== (revisions.get(id) || 0)) return;
      const status = error?.code === 'login_required' || error?.code === 'missing' ? 'login_required' : error?.code === 'unavailable' ? 'unavailable' : 'error';
      cache.set(id, { at: now(), value: empty(id, status, status === 'login_required' ? 'login-required' : status === 'unavailable' ? 'not-exposed-by-cli' : 'read-failed') });
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', abortListener); controllers.delete(controller);
    }
  }
  async function get({ force = false } = {}) {
    stateChanged();
    if (offline || closed) return snapshot();
    if (inFlight) return inFlight;
    const ids = Object.keys(readers).filter(id => INFO[id] && NORMALIZE[id] && providerState(id)?.status === 'ready' && providerState(id)?.authenticated === true && (!cache.has(id) || now() - cache.get(id).at >= (force ? 10000 : ttlMs)));
    if (!ids.length) return snapshot();
    const version = generation;
    const work = Promise.all(ids.map(id => query(id, version))).then(() => { if (!closed && version === generation) changed(); return snapshot(); });
    inFlight = work;
    try { return await work; } finally { if (inFlight === work) inFlight = null; }
  }
  function observe(provider, raw) {
    stateChanged();
    if (closed || offline || !NORMALIZE[provider]) return;
    const parsed = NORMALIZE[provider](raw);
    if (parsed.status !== 'available') return;
    revisions.set(provider, (revisions.get(provider) || 0) + 1);
    const previous = cache.get(provider), full = previous?.value?.status === 'available' ? previous.value : null;
    const replacements = new Map(parsed.windows.map(value => [value.id, value]));
    const mergedWindows = full ? full.windows.map(value => replacements.has(value.id) ? replacements.get(value.id) : value).concat(parsed.windows.filter(value => !full.windows.some(old => old.id === value.id))) : parsed.windows;
    // A partial stream event updates matching windows only. Preserve scoped
    // windows, plan and extra-usage data, and do not postpone a full refresh.
    cache.set(provider, { at: full ? previous.at : now(), value: { ...(full || empty(provider, 'available', '')), ...parsed, windows: mergedWindows, planType: parsed.planType || full?.planType || null, credits: parsed.credits || full?.credits || null, ...(full?.extraUsage !== undefined && parsed.extraUsage === undefined ? { extraUsage: full.extraUsage } : {}), source: provider === 'claude' ? 'claude-cli-event' : INFO[provider].source, checkedAt: full?.checkedAt || new Date(now()).toISOString() } }); changed();
  }
  return { get, snapshot, observe, setOffline, invalidate, close() { closed = true; invalidate(); } };
}
