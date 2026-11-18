import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { locateProvider, subscriptionEnvironment } from './providers.mjs';

const LIMIT = 2 * 1024 * 1024;
const INIT_ID = 'imperium-quota-initialize';
const USAGE_ID = 'imperium-quota-read';
const failure = code => Object.assign(new Error('Claude usage is unavailable.'), { code });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function stop(child, spawnProcess, platform) {
  if (!child || child.exitCode != null) return;
  const kill = () => {
    try { child.kill('SIGTERM'); } catch {}
    if (child.exitCode != null) return;
    const deadline = setTimeout(() => { if (child.exitCode == null) { try { child.kill('SIGKILL'); } catch {} } }, 250);
    deadline.unref?.();
    child.once('close', () => clearTimeout(deadline));
  };
  if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      let fallbackUsed = false;
      const fallback = () => { if (!fallbackUsed) { fallbackUsed = true; kill(); } };
      killer.once('error', fallback);
      killer.once('close', code => { if (code !== 0) fallback(); });
      killer.unref?.();
      return;
    } catch { /* Native direct-child fallback. */ }
  }
  kill();
}

/**
 * Read the CLI's experimental get_usage control response, without any user
 * message, model turn, direct credential access or global configuration edits.
 * Published in Agent SDK 0.3.169; verified with Claude Code 2.1.327.
 * https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md
 * Older CLIs fail closed instead of treating /usage as an inference prompt.
 */
export function readClaudeQuota(options = {}) {
  return readClaudeControl('usage', options);
}

/**
 * Read the published ModelInfo metadata returned by SDK initialization. Only
 * the model rows leave this adapter; account information in the same response
 * is deliberately discarded. Initialization never sends a model/user message.
 * https://platform.claude.com/docs/en/agent-sdk/typescript#modelinfo
 */
export function readClaudeModels(options = {}) {
  return readClaudeControl('models', options);
}

function readClaudeControl(operation, { locate = locateProvider, spawnProcess = spawn, timeoutMs = 8000, signal, platform = process.platform } = {}) {
  const budget = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(30000, timeoutMs)) : 8000;
  return new Promise((resolve, reject) => {
    let child, timer, settled = false, initialized = false, total = 0, buffer = '';
    const decoder = new StringDecoder('utf8');
    const abort = () => finish(failure('unavailable'));
    function finish(error, value) {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      try { child?.stdin.end(); } catch {}
      stop(child, spawnProcess, platform);
      if (error) reject(error); else resolve(value);
    }
    function send(request_id, request) {
      if (settled) return;
      try { child.stdin.write(`${JSON.stringify({ type: 'control_request', request_id, request })}\n`); }
      catch { finish(failure('unavailable')); }
    }
    function consume(message) {
      if (!record(message) || settled) return;
      // No user/assistant turn belongs to a metadata-only control connection.
      if (['user', 'assistant', 'stream_event', 'control_request'].includes(message.type)) { finish(failure('unavailable')); return; }
      if (message.type !== 'control_response' || !record(message.response)) return;
      const response = message.response;
      if (![INIT_ID, USAGE_ID].includes(response.request_id)) return;
      if (response.subtype !== 'success') {
        const authentication = /not logged in|login required|unauthorized|authentication required|\b401\b/i.test(String(response.error || ''));
        finish(failure(authentication ? 'login_required' : 'unavailable')); return;
      }
      if (response.request_id === INIT_ID && !initialized) {
        initialized = true;
        if (operation === 'models') {
          const models = response.response?.models;
          if (!Array.isArray(models)) { finish(failure('unavailable')); return; }
          finish(null, models);
        } else send(USAGE_ID, { subtype: 'get_usage', skip_behaviors: true });
      } else if (response.request_id === USAGE_ID && initialized) {
        const usage = response.response;
        if (!record(usage) || usage.rate_limits_available !== true || !record(usage.rate_limits)) { finish(failure('unavailable')); return; }
        // This is raw provider usage data; the caller normalizes known fields.
        finish(null, usage);
      }
    }
    const count = chunk => {
      if (settled) return false;
      total += Buffer.byteLength(chunk);
      if (total > LIMIT) { finish(failure('unavailable')); return false; }
      return true;
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    // The same deadline and abort listener cover executable lookup and transport.
    // A lookup resolving after local-only activation cannot start a cloud probe.
    timer = setTimeout(() => finish(failure('unavailable')), budget);
    void (async () => {
      let target;
      try { target = await locate('claude'); } catch { finish(failure('error')); return; }
      if (settled) return;
      if (!target) { finish(failure('missing')); return; }
      try {
        child = spawnProcess(target.command, [...(target.prefix || []), '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
          '--safe-mode', '--setting-sources', '', '--settings', JSON.stringify({ disableAllHooks: true, autoMemoryEnabled: false, promptSuggestionEnabled: false }),
          '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence'],
        { env: subscriptionEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        // Also cover an injected launcher that synchronously aborts during spawn.
        if (settled) { stop(child, spawnProcess, platform); return; }
        child.on('error', error => finish(failure(error?.code === 'ENOENT' ? 'missing' : 'error')));
        child.on('close', () => finish(failure('unavailable')));
        child.stdin.on('error', () => finish(failure('unavailable')));
        child.stdout.on('error', () => finish(failure('error')));
        child.stderr.on('error', () => finish(failure('error')));
        child.stdout.on('data', chunk => {
          if (!count(chunk)) return;
          buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
          let boundary;
          while (!settled && (boundary = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
            try { consume(JSON.parse(line)); } catch { finish(failure('unavailable')); }
          }
        });
        // Diagnostics share the stdout byte budget and are never retained.
        child.stderr.on('data', chunk => { count(chunk); });
        send(INIT_ID, { subtype: 'initialize', hooks: {} });
      } catch (error) { finish(failure(error?.code === 'ENOENT' ? 'missing' : 'error')); }
    })();
  });
}
