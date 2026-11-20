import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = await readFile(new URL('../public/quotas.js', import.meta.url), 'utf8');
const NOW = Date.UTC(2026, 10, 18, 9, 0), clone = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let turn = 0; turn < 5; turn++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  return { providers: [
    { id: 'codex', name: 'ChatGPT / Codex', status: 'available', planType: 'pro', checkedAt: new Date(NOW - 10000).toISOString(), source: 'codex-app-server', windows: [{ id: 'primary-model-bucket', label: '5-hour window', usedPercent: 63, remainingPercent: 37, windowMinutes: 300, resetsAt: new Date(NOW + 3600000).toISOString() }, { id: 'weekly', label: 'Weekly', usedPercent: 10, remainingPercent: 90, windowMinutes: 10080, resetsAt: new Date(NOW + 86400000).toISOString() }], credits: { hasCredits: true, unlimited: false, balance: '12.34' }, reason: '', usageUrl: 'https://chatgpt.com/codex/settings/usage' },
    { id: 'claude', name: 'Claude Code', status: 'unavailable', planType: null, checkedAt: null, source: null, windows: [], credits: null, reason: 'No official quota event is available.', usageUrl: 'https://claude.ai/settings/usage' },
    { id: 'copilot', name: 'GitHub Copilot CLI', status: 'available', planType: 'premium', checkedAt: new Date(NOW).toISOString(), source: 'copilot-cli', windows: [{ id: 'premium-requests', label: 'Premium requests', usedPercent: 33.3, remainingPercent: 66.7, remaining: 200, limit: 300, unit: 'requests', resetsAt: null }], credits: null, reason: '', usageUrl: 'https://github.com/settings/copilot' },
    { id: 'ollama', name: 'Ollama', status: 'local', planType: null, checkedAt: null, source: null, windows: [], credits: null, reason: '', usageUrl: null },
  ], refreshAfterMs: 60000, localOnly: false };
}
async function setup(t, { initial = fixture(), route, useCallbackAPI = false, compact = false } = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="quotas"></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom; window.Date.now = () => NOW;
  const state = { server: { csrfToken: 'test-quota-csrf' }, settings: { workspace: 'C:\\Project A', localOnly: false, language: 'en' }, providers: [{ id: 'codex', status: 'ready', installed: true }, { id: 'claude', status: 'missing', installed: false }, { id: 'ollama', status: 'ready', installed: true, kind: 'local' }], connections: [{ id: 'copilot-connection', providerId: 'copilot' }] }, calls = [];
  const call = async (path, options = {}, structured = false) => {
    const method = options.method || 'GET', body = options.body === undefined ? undefined : structured ? options.body : JSON.parse(options.body);
    calls.push({ path, method, body, headers: options.headers });
    assert.ok(['/api/quotas', '/api/quotas/refresh'].includes(path), 'quota UI must not call inference, terminal, login, or unrelated APIs');
    return route ? route({ path, method, body, state, index: calls.length - 1 }) : clone(initial);
  };
  window.fetch = async (path, options) => ({ ok: true, json: async () => clone(await call(path, options)) });
  const callbacks = { getState: () => state, compact, ...(useCallbackAPI ? { api: (path, options) => call(path, options, true) } : {}) };
  window.eval(script); window.ImperiumQuotas.mount(window.document.querySelector('#quotas'), callbacks); await settle();
  t.after(() => window.close()); return { window, document: window.document, state, calls, errors };
}

test('quota cards show actual shared account percentages credits and request counts without inventing unknown Claude data', async t => {
  const { document, calls, errors } = await setup(t);
  const codex = document.querySelector('[data-quota-provider="codex"]'), claude = document.querySelector('[data-quota-provider="claude"]'), copilot = document.querySelector('[data-quota-provider="copilot"]'), local = document.querySelector('[data-quota-provider="ollama"]');
  assert.match(codex.textContent, /ACCOUNT-SHARED/); assert.equal(codex.querySelector('[data-quota-window="primary-model-bucket"] .iq-remaining').textContent, '37%'); assert.equal(codex.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '37'); assert.match(codex.querySelector('.iq-credits').textContent, /12.34/); assert.match(codex.querySelector('.iq-source').textContent, /Codex account server/);
  assert.equal(claude.querySelector('[role="progressbar"]'), null); assert.equal(claude.querySelector('.iq-remaining'), null); assert.match(claude.textContent, /No official quota event/); assert.equal(claude.querySelector('a').href, 'https://claude.ai/settings/usage');
  assert.match(copilot.querySelector('.iq-remaining-count').textContent, /200 \/ 300 requests/); assert.equal(copilot.querySelector('.iq-remaining').textContent, '66.7%');
  assert.match(local.textContent, /Cloud account quotas do not apply/); assert.equal(local.querySelector('[role="progressbar"]'), null); assert.equal(local.querySelector('a'), null);
  assert.deepEqual(calls.map(call => [call.path, call.method]), [['/api/quotas', 'GET']]); assert.deepEqual(errors, []);
});

test('default refresh is cached GET and only an explicit refresh button sends POST with no inference', async t => {
  const { window, document, calls } = await setup(t);
  await window.ImperiumQuotas.refresh(); assert.equal(calls.at(-1).path, '/api/quotas'); assert.equal(calls.at(-1).method, 'GET');
  document.querySelector('[data-quota-refresh]').click(); await settle();
  assert.equal(calls.at(-1).path, '/api/quotas/refresh'); assert.equal(calls.at(-1).method, 'POST'); assert.deepEqual(calls.at(-1).body, {}); assert.equal(calls.at(-1).headers['x-hq-token'], 'test-quota-csrf');
});

test('stale reports and expired reset times preserve the last reported number instead of assuming a full reset', async t => {
  const data = fixture(), codex = data.providers[0]; codex.checkedAt = new Date(NOW - 180000).toISOString(); codex.windows = [{ id: 'expired', label: 'Previous window', usedPercent: 80, remainingPercent: 20, resetsAt: new Date(NOW - 1000).toISOString() }];
  const { document } = await setup(t, { initial: data });
  const card = document.querySelector('[data-quota-provider="codex"]'), window = card.querySelector('[data-quota-window]');
  assert.equal(card.dataset.quotaStale, 'true'); assert.match(card.textContent, /Over 2 minutes old/); assert.equal(window.dataset.resetExpired, 'true'); assert.match(window.textContent, /Last reported value/); assert.match(window.textContent, /reset time has passed/); assert.equal(window.querySelector('.iq-remaining').textContent, '20%'); assert.equal(window.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '20'); assert.ok(!window.textContent.includes('100%'));
});

test('local-only mode immediately removes cached cloud values and links and ignores a late cloud response', async t => {
  const slow = deferred(), cloud = fixture(), local = { providers: [cloud.providers.find(provider => provider.id === 'ollama')], localOnly: true, refreshAfterMs: 60000 };
  const { window, document, state, calls } = await setup(t, { route: ({ index, state }) => index === 0 ? clone(cloud) : index === 1 ? slow.promise : clone(state.settings.localOnly ? local : cloud), useCallbackAPI: true });
  assert.match(document.querySelector('#quotas').textContent, /12.34/); const staleRequest = window.ImperiumQuotas.refresh();
  state.settings.localOnly = true; window.ImperiumQuotas.render(state);
  assert.equal(document.querySelector('[data-quota-provider="codex"]'), null); assert.equal(document.querySelector('[data-quota-provider="claude"]'), null); assert.equal(document.querySelectorAll('#quotas a').length, 0); assert.ok(!document.querySelector('#quotas').textContent.includes('12.34')); assert.match(document.querySelector('.iq-local-notice').textContent, /Cloud allowance and external usage links are hidden/);
  await settle(); const old = clone(cloud); old.providers[0].credits.balance = '999.99'; slow.resolve(old); await staleRequest; await settle();
  assert.equal(document.querySelectorAll('#quotas a').length, 0); assert.ok(!document.querySelector('#quotas').textContent.includes('999.99')); assert.ok(document.querySelector('[data-quota-provider="ollama"]')); assert.ok(calls.every(call => call.method === 'GET'));
});

test('unsafe usage URLs and invalid percentages are omitted while official links remain accessible', async t => {
  const data = fixture(); data.providers[0].usageUrl = 'https://chatgpt.com@evil.example/usage'; data.providers[0].windows = [{ id: 'unknown', label: '<img src=x>Unknown', usedPercent: -1, remainingPercent: 101, resetsAt: null }]; data.providers[1].reason = '<script>window.bad=1</script>'; data.providers[2].usageUrl = 'javascript:alert(1)';
  const { document, window } = await setup(t, { initial: data });
  const codex = document.querySelector('[data-quota-provider="codex"]'), claude = document.querySelector('[data-quota-provider="claude"]'), copilot = document.querySelector('[data-quota-provider="copilot"]');
  assert.equal(codex.querySelector('a'), null); assert.equal(copilot.querySelector('a'), null); assert.equal(codex.querySelector('[role="progressbar"]'), null); assert.equal(codex.querySelector('.iq-remaining').textContent, '—'); assert.match(codex.querySelector('.iq-used').textContent, /Unknown/);
  const official = claude.querySelector('a'); assert.equal(official.target, '_blank'); assert.match(official.rel, /noreferrer/); assert.match(official.rel, /noopener/); assert.equal(document.querySelector('img[src="x"]'), null); assert.equal(window.bad, undefined);
});

test('quotas remain account-global across project changes and built-in labels switch Korean English and Japanese', async t => {
  const pending = deferred();
  const { window, document, state, calls } = await setup(t, { route: () => pending.promise });
  state.settings.workspace = 'C:\\Project B'; window.ImperiumQuotas.render(state); assert.equal(calls.length, 1);
  pending.resolve(fixture()); await settle(); assert.ok(document.querySelector('[data-quota-provider="codex"] .iq-remaining'));
  document.documentElement.lang = 'ko'; window.ImperiumQuotas.render(state); assert.match(document.querySelector('.iq-heading').textContent, /계정별 잔여 한도/);
  document.documentElement.lang = 'ja'; window.ImperiumQuotas.render(state); assert.match(document.querySelector('.iq-heading').textContent, /アカウントの利用枠/);
  document.documentElement.lang = 'en'; window.ImperiumQuotas.render(state); assert.match(document.querySelector('.iq-heading').textContent, /Account allowance/); assert.equal(calls.length, 1);
});

test('an explicit new refresh supersedes an older cached request without stale values winning', async t => {
  const old = deferred(), fresh = fixture(); fresh.providers[0].windows[0].remainingPercent = 51;
  const { window, document, calls } = await setup(t, { route: ({ method }) => method === 'POST' ? clone(fresh) : old.promise, useCallbackAPI: true });
  await window.ImperiumQuotas.refresh(true); old.resolve(fixture()); await settle();
  assert.equal(document.querySelector('[data-quota-provider="codex"] .iq-remaining').textContent, '51%'); assert.deepEqual(calls.map(call => call.method), ['GET', 'POST']);
});

test('distinct credit buckets are not summed and normalized extra-usage dollars are not divided or called credits', async t => {
  const data = fixture(); data.providers[0].creditBalances = [{ id: 'bucket-a', label: 'Reported bucket A', balance: '10.00', hasCredits: true, unlimited: false }, { id: 'bucket-b', label: 'Reported bucket B', balance: '5.00', hasCredits: true, unlimited: false }];
  data.providers[1] = { ...data.providers[1], status: 'available', checkedAt: new Date(NOW).toISOString(), source: 'claude-cli-usage', windows: [{ id: 'session', label: 'Current session', usedPercent: 20, remainingPercent: 80, resetsAt: null }], extraUsage: { enabled: true, limit: 10, used: 3, remaining: 7, currency: 'USD', decimalPlaces: 2 } };
  data.providers.push({ id: 'gemini', name: 'Gemini CLI', status: 'unavailable', windows: [], credits: null, usageUrl: 'https://geminicli.com/docs/resources/quota-and-pricing/' });
  const { window, document, state } = await setup(t, { initial: data });
  const codex = document.querySelector('[data-quota-provider="codex"]'); assert.equal(codex.querySelectorAll('[data-credit-bucket]').length, 2); assert.match(codex.querySelector('[data-credit-bucket="bucket-a"]').textContent, /10\.00/); assert.match(codex.querySelector('[data-credit-bucket="bucket-b"]').textContent, /5\.00/); assert.ok(!codex.textContent.includes('15.00'));
  const claude = document.querySelector('[data-quota-provider="claude"]'); assert.match(claude.querySelector('.iq-source').textContent, /Claude account usage/); const extra = claude.querySelector('.iq-extra-usage'); assert.match(extra.textContent, /\$10\.00/); assert.match(extra.textContent, /\$3\.00/); assert.match(extra.textContent, /\$7\.00/); assert.ok(!extra.textContent.includes('$0.07')); assert.ok(!extra.textContent.toLowerCase().includes('credit'));
  assert.match(document.querySelector('[data-quota-provider="copilot"] .iq-source').textContent, /Copilot account quota/);
  state.connections.push({ id: 'gemini-connection', providerId: 'gemini' }); window.ImperiumQuotas.render(state);
  const guide = document.querySelector('[data-quota-provider="gemini"] a'); assert.equal(guide.href, 'https://geminicli.com/docs/resources/quota-and-pricing/'); assert.match(guide.textContent, /Official usage guide/);
});

test('compact quotas start collapsed retain expansion and remove cloud summary values in local-only mode', async t => {
  const data = fixture(); data.providers[0].credits = { hasCredits: false, unlimited: false, balance: 0 }; data.providers[0].checkedAt = new Date(NOW - 180000).toISOString(); data.providers[0].windows[0].resetsAt = new Date(NOW - 1000).toISOString();
  const { window, document, state } = await setup(t, { initial: data, compact: true });
  let disclosure = document.querySelector('.iq-disclosure'), summary = disclosure.querySelector('summary');
  assert.equal(disclosure.open, false); assert.match(summary.querySelector('.iq-compact-heading').textContent, /Account allowance/); assert.match(summary.textContent, /5-hour window 37%/); assert.match(summary.textContent, /Weekly 90%/); assert.match(summary.textContent, /Credit balance 0/);
  assert.equal(summary.querySelector('[data-compact-quota-provider="codex"] [data-quota-freshness]').dataset.quotaFreshness, 'stale'); assert.match(summary.querySelector('[data-compact-quota-window="primary-model-bucket"]').title, /reset time has passed/); assert.ok(!summary.querySelector('[data-compact-quota-provider="codex"]').textContent.includes('100%'));
  assert.match(disclosure.querySelector('[data-quota-provider="codex"] .iq-credits').textContent, /Credit balance 0/); assert.equal(disclosure.querySelector('[data-quota-provider="codex"] .iq-credits').dataset.creditStatus, 'reported');
  disclosure.open = true; window.ImperiumQuotas.render(state); disclosure = document.querySelector('.iq-disclosure'); assert.equal(disclosure.open, true, 'rendering preserves the native open state even before a queued toggle event'); assert.ok(disclosure.querySelector('[data-quota-refresh]'));
  window.ImperiumQuotas.render(state); assert.equal(document.querySelector('.iq-disclosure').open, true);
  state.settings.localOnly = true; window.ImperiumQuotas.render(state); await settle();
  disclosure = document.querySelector('.iq-disclosure'); summary = disclosure.querySelector('summary');
  assert.equal(disclosure.open, true); assert.equal(summary.querySelector('[data-compact-quota-provider="codex"]'), null); assert.equal(summary.querySelector('[data-compact-quota-provider="claude"]'), null); assert.ok(summary.querySelector('[data-compact-quota-provider="ollama"]'));
  assert.ok(!summary.textContent.includes('37%')); assert.ok(!summary.textContent.includes('90%')); assert.ok(!summary.textContent.includes('Credit balance 0')); assert.equal(document.querySelectorAll('#quotas a').length, 0);
});
