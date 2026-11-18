import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { locateProvider, subscriptionEnvironment } from './providers.mjs';

// Official read-only protocol: https://learn.chatgpt.com/docs/app-server#rate-limits-chatgpt
// No threads, turns, prompts, reset-credit consumption, or credential exports.
const failure = code => Object.assign(new Error('Codex quota could not be read.'), { code });
export async function readCodexQuota({ locate = locateProvider, spawnProcess = spawn, timeoutMs = 8000, signal, platform = process.platform } = {}) {
  if (signal?.aborted) throw failure('offline');
  const started = Date.now(), duration = Number.isFinite(timeoutMs) ? Math.min(30000, Math.max(1, timeoutMs)) : 8000;
  let locatingTimer, abortLookup;
  const cancelled = new Promise((_, reject) => {
    abortLookup = () => reject(failure('offline'));
    signal?.addEventListener('abort', abortLookup, { once: true });
    locatingTimer = setTimeout(() => reject(failure('error')), duration);
  });
  let target;
  try { target = await Promise.race([Promise.resolve().then(() => locate('codex')), cancelled]); }
  catch (error) { throw failure(error?.code === 'offline' ? 'offline' : 'error'); }
  finally { clearTimeout(locatingTimer); signal?.removeEventListener('abort', abortLookup); }
  if (!target) throw failure('missing');
  if (signal?.aborted) throw failure('offline');
  return new Promise((resolve, reject) => {
    let child, timer, settled = false, size = 0, buffer = '', requestId = 1;
    const decoder = new StringDecoder('utf8');
    const stop = () => {
      if (!child || child.exitCode != null) return;
      try { child.stdin.end(); } catch {}
      if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
        try {
          const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
          killer.on('error', () => { try { child.kill(); } catch {} });
          killer.on('close', code => { if (code) { try { child.kill(); } catch {} } });
        } catch { try { child.kill(); } catch {} }
      } else { try { child.kill(); } catch {} }
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted); stop();
      if (error) reject(failure(error)); else resolve(value);
    };
    const aborted = () => finish('offline');
    const send = value => { try { child.stdin.write(`${JSON.stringify(value)}\n`); } catch { finish('error'); } };
    const consume = value => {
      if (settled || value?.id !== requestId) return;
      if (value.error) { finish(/auth|log.?in|unauthori/i.test(String(value.error.message)) ? 'login_required' : 'unavailable'); return; }
      if (!Object.hasOwn(value, 'result')) return;
      if (requestId === 1) {
        requestId = 2; send({ method: 'initialized', params: {} }); send({ id: 2, method: 'account/rateLimits/read' });
      } else if (value.result && typeof value.result === 'object') finish(null, value.result);
      else finish('unavailable');
    };
    try {
      child = spawnProcess(target.command, [...target.prefix, 'app-server', '--listen', 'stdio://'], { shell: false, windowsHide: true, env: subscriptionEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
      child.on('error', () => finish('error')); child.on('close', () => finish('unavailable')); child.stdin.on('error', () => finish('error'));
      child.stdout.on('error', () => finish('error')); child.stderr.on('error', () => finish('error'));
      child.stdout.on('data', chunk => {
        if (settled) return;
        size += Buffer.byteLength(chunk); if (size > 2 * 1024 * 1024) { finish('error'); return; }
        buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
        let end;
        while (!settled && (end = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try { consume(JSON.parse(line)); } catch { /* Non-JSON diagnostics are not quota data. */ }
        }
      });
      // Drain diagnostics without collecting credentials or arbitrary error text.
      child.stderr.on('data', chunk => { size += Buffer.byteLength(chunk); if (size > 2 * 1024 * 1024) finish('error'); });
      signal?.addEventListener('abort', aborted, { once: true });
      timer = setTimeout(() => finish('error'), Math.max(1, duration - (Date.now() - started)));
      if (signal?.aborted) { aborted(); return; }
      send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'imperium_quota', title: 'Imperium quota monitor', version: '1.4.0' } } });
    } catch { finish('error'); }
  });
}
