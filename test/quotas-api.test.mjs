import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { createHQServer } from '../server.mjs';

test('quota HTTP uses the private session, CSRF, account cache and local-only isolation without model calls', async t => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'imperium-quotas-http-')));
  const calls = [];
  const app = createHQServer({ dataDir: directory, workspace: directory, port: 0, privateSessionToken: 'PRIVATE_TEST_SESSION',
    providers: { detectProviders: async () => ['codex', 'claude'].map(id => ({ id, status: 'ready', installed: true, authenticated: true })), startProvider() { assert.fail('Quota requests must never invoke a model'); } },
    quotaReaders: {
      codex: async () => { calls.push('codex'); return { rateLimits: { primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 1900000000 }, credits: { hasCredits: false, unlimited: false, balance: '0' } }, PRIVATE_SECRET: 'never transmit' }; },
      claude: async () => { calls.push('claude'); return { subscription_type: 'max', rate_limits_available: true, rate_limits: { five_hour: { utilization: 6, resets_at: '2030-03-01T00:00:00Z' } } }; },
    },
  });
  t.after(async () => { try { await app.close(); } finally { await rm(directory, { recursive: true, force: true }); } });
  const { url } = await app.start(); const headers = { 'x-imperium-session': 'PRIVATE_TEST_SESSION' };
  assert.equal((await fetch(url + '/api/quotas')).status, 403); assert.deepEqual(calls, []);
  const state = await (await fetch(url + '/api/state', { headers })).json();
  assert.equal((await fetch(url + '/api/quotas/refresh', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })).status, 403);
  const first = await (await fetch(url + '/api/quotas', { headers })).json();
  assert.equal(first.providers.find(row => row.id === 'codex').windows[0].remainingPercent, 100);
  assert.equal(first.providers.find(row => row.id === 'claude').windows[0].remainingPercent, 94);
  assert.ok(!JSON.stringify(first).includes('PRIVATE_SECRET')); assert.ok(!JSON.stringify(first).includes('never transmit'));
  await fetch(url + '/api/quotas', { headers }); assert.deepEqual(calls.sort(), ['claude', 'codex']);
  const mutation = { ...headers, 'content-type': 'application/json', 'x-hq-token': state.server.csrfToken };
  assert.equal((await fetch(url + '/api/settings', { method: 'POST', headers: mutation, body: JSON.stringify({ localOnly: true }) })).status, 200);
  const offline = await (await fetch(url + '/api/quotas/refresh', { method: 'POST', headers: mutation, body: '{}' })).json();
  assert.equal(offline.localOnly, true); assert.ok(offline.providers.filter(row => row.id !== 'ollama').every(row => row.windows.length === 0 && row.usageUrl === null)); assert.equal(calls.length, 2);
  const after = await (await fetch(url + '/api/state', { headers })).json(); assert.deepEqual(after.tasks, []);
  for (const asset of ['/quotas.js', '/quotas.css']) assert.equal((await fetch(url + asset, { headers })).status, 200);
});
