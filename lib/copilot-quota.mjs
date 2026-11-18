import { spawn } from 'node:child_process';
import { additionalEnvironment, locateAdditionalProvider } from './additional-providers.mjs';

// Official read-only SDK schema: account.getQuota({}) uses the current CLI account.
// https://github.com/github/copilot-sdk/blob/main/nodejs/src/generated/rpc.ts
// Never call account.getCurrentAuth: its AuthInfo union can contain credentials.
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_HEADER_BYTES = 8192;
const MESSAGES = {
  missing: 'GitHub Copilot CLI를 설치하고 로그인해 주세요.',
  login_required: 'GitHub Copilot CLI에서 구독 계정으로 로그인한 뒤 다시 조회해 주세요.',
  unavailable: 'Copilot 계정 한도를 조회하지 못했습니다. CLI 버전과 연결 상태를 확인한 뒤 다시 시도해 주세요.',
  error: 'Copilot 계정 한도 응답을 확인하지 못했습니다. 잠시 후 다시 조회해 주세요.',
};
const codedError = code => Object.assign(new Error(MESSAGES[code]), { code });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function stopChild(child, { spawnProcess, platform }) {
  if (!child || child.exitCode != null) return;
  const kill = () => {
    try { child.kill('SIGTERM'); } catch {}
    if (child.exitCode != null) return;
    const timer = setTimeout(() => { if (child.exitCode == null) { try { child.kill('SIGKILL'); } catch {} } }, 250);
    timer.unref?.();
    child.once('close', () => clearTimeout(timer));
  };
  if (platform === 'win32' && Number.isSafeInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      let fallbackUsed = false;
      const fallback = () => { if (!fallbackUsed) { fallbackUsed = true; kill(); } };
      killer.once('error', fallback);
      killer.once('close', code => { if (code !== 0) fallback(); });
      killer.unref?.();
    } catch { kill(); }
  } else kill();
}

/** Metadata only: no session, generation, credential callbacks, or paid inference.
 * signal/platform are optional lifecycle and test hooks; errors expose only a safe code/message.
 */
export function readCopilotQuota({
  locate = locateAdditionalProvider, spawnProcess = spawn, timeoutMs = 8000,
  signal, platform = process.platform,
} = {}) {
  return new Promise((resolve, reject) => {
    let child, timer, settled = false, expectedId = 1, buffer = Buffer.alloc(0), receivedBytes = 0;
    const finish = (code, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      try { child?.stdin.end(); } catch {}
      stopChild(child, { spawnProcess, platform });
      if (code) reject(codedError(code)); else resolve(result);
    };
    const abort = () => finish('unavailable');
    const send = request => {
      if (settled) return;
      try {
        const payload = Buffer.from(JSON.stringify(request), 'utf8');
        child.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
        child.stdin.write(payload);
      } catch { finish('error'); }
    };
    const request = (id, method, params = {}) => { expectedId = id; send({ jsonrpc: '2.0', id, method, params }); };
    const consume = value => {
      if (!record(value)) { finish('error'); return; }
      if (typeof value.method === 'string') {
        // The probe never supplies credentials, accepts permissions, or runs tools.
        if (value.id !== undefined && value.id !== null) send({ jsonrpc: '2.0', id: value.id, error: { code: -32601, message: 'Callbacks are unavailable during quota checks.' } });
        return;
      }
      if (value.id !== expectedId) return;
      if (value.error) { finish(value.error.code === -32601 ? 'unavailable' : 'error'); return; }
      if (!Object.hasOwn(value, 'result')) { finish('error'); return; }
      if (expectedId === 1) { request(2, 'auth.getStatus'); return; }
      if (expectedId === 2) {
        const status = value.result;
        if (!record(status) || status.isAuthenticated !== true || status.authType && !['user', 'account', 'gh-cli'].includes(status.authType)) { finish('login_required'); return; }
        request(3, 'account.getQuota'); return;
      }
      if (!record(value.result) || !record(value.result.quotaSnapshots)) { finish('unavailable'); return; }
      finish(null, value.result);
    };
    const count = chunk => {
      receivedBytes += Buffer.byteLength(chunk);
      if (receivedBytes > MAX_BYTES) { finish('error'); return false; }
      return true;
    };
    if (signal?.aborted) { finish('unavailable'); return; }
    signal?.addEventListener('abort', abort, { once: true });
    const duration = Number.isFinite(timeoutMs) ? Math.min(30000, Math.max(1, timeoutMs)) : 8000;
    // Include locating the executable in the deadline; a slow filesystem must
    // not permit a delayed process launch after timeout or local-only activation.
    timer = setTimeout(() => finish('unavailable'), duration);
    void (async () => {
      let target;
      try { target = await locate('copilot'); } catch { finish('unavailable'); return; }
      if (settled) return;
      if (!target) { finish('missing'); return; }
      try {
        child = spawnProcess(target.command, [...(target.prefix || []), '--headless', '--stdio', '--no-auto-update'], {
          env: additionalEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        });
        child.on('error', error => finish(error?.code === 'ENOENT' ? 'missing' : 'error'));
        child.on('close', () => finish('unavailable'));
        child.stdin.on('error', () => finish('error'));
        child.stdout.on('error', () => finish('error'));
        child.stderr.on('error', () => finish('error'));
        child.stderr.on('data', chunk => { if (!settled) count(chunk); });
        child.stdout.on('data', chunk => {
          if (settled || !count(chunk)) return;
          buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
          while (!settled) {
            const boundary = buffer.indexOf('\r\n\r\n');
            if (boundary < 0) { if (buffer.length > MAX_HEADER_BYTES) finish('error'); return; }
            if (boundary > MAX_HEADER_BYTES) { finish('error'); return; }
            const lengths = [...buffer.subarray(0, boundary).toString('ascii').matchAll(/^Content-Length:\s*(\d+)\s*$/gim)];
            const length = lengths.length === 1 ? Number(lengths[0][1]) : NaN;
            if (!Number.isSafeInteger(length) || length < 1 || length > MAX_BYTES) { finish('error'); return; }
            if (buffer.length < boundary + 4 + length) return;
            const payload = buffer.subarray(boundary + 4, boundary + 4 + length);
            buffer = buffer.subarray(boundary + 4 + length);
            let value;
            try { value = JSON.parse(payload.toString('utf8')); } catch { finish('error'); return; }
            consume(value);
          }
        });
        request(1, 'connect', { clientInfo: { editorName: 'Imperium', editorVersion: '1.3.2' } });
      } catch (error) { finish(error?.code === 'ENOENT' ? 'missing' : 'error'); }
    })();
  });
}
