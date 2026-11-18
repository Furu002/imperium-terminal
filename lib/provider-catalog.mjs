import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { locateProvider, subscriptionEnvironment } from './providers.mjs';

/** Official CLI metadata, reviewed 2026-11-18. Installation commands are displayed
 * to the user; this module never executes installers, login, or inference.
 * Sources are included so the UI can distinguish aliases from account results.
 */
export const PROVIDER_CATALOG = Object.freeze([
  Object.freeze({ id: 'codex', name: 'ChatGPT / Codex', description: 'ChatGPT 계정으로 로그인한 Codex CLI', installCommand: 'npm install -g @openai/codex', loginCommand: 'codex login', requiresNode: true, kind: 'subscription-cli', docsUrl: 'https://learn.chatgpt.com/docs/app-server' }),
  Object.freeze({ id: 'claude', name: 'Claude Code', description: 'Claude 계정으로 로그인한 Claude Code', installCommand: process.platform === 'win32' ? 'winget install Anthropic.ClaudeCode' : process.platform === 'darwin' ? 'brew install --cask claude-code' : 'curl -fsSL https://claude.ai/install.sh | bash', loginCommand: 'claude auth login', requiresNode: false, kind: 'subscription-cli', docsUrl: 'https://code.claude.com/docs/en/model-config' }),
  Object.freeze({ id: 'gemini', name: 'Gemini CLI', description: 'Google 계정 로그인과 계정별 사용 한도를 사용하는 Gemini CLI', installCommand: 'npm install -g @google/gemini-cli', loginCommand: 'gemini', requiresNode: true, kind: 'subscription-cli', docsUrl: 'https://geminicli.com/docs/cli/cli-reference/' }),
  Object.freeze({ id: 'copilot', name: 'GitHub Copilot CLI', description: 'GitHub 계정과 Copilot 플랜으로 사용하는 CLI', installCommand: 'npm install -g @github/copilot', loginCommand: 'copilot login', requiresNode: true, kind: 'subscription-cli', docsUrl: 'https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference' }),
  Object.freeze({ id: 'ollama', name: 'Ollama', description: '이 컴퓨터의 Ollama 서비스에 설치된 로컬 모델', installCommand: process.platform === 'win32' ? 'irm https://ollama.com/install.ps1 | iex' : 'curl -fsSL https://ollama.com/install.sh | sh', loginCommand: 'ollama list', requiresNode: false, kind: 'local', docsUrl: 'https://docs.ollama.com/api/tags' }),
]);

const ALIASES = {
  claude: [['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']],
  gemini: [['auto', 'Auto'], ['pro', 'Pro'], ['flash', 'Flash'], ['flash-lite', 'Flash Lite']],
  copilot: [['auto', 'Auto']],
};
const safeModelId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value);
const displayName = (value, fallback) => typeof value === 'string' && value.trim() ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120) : fallback;
const failure = message => Object.assign(new Error(message), { status: 400 });

function stopChild(child, spawnProcess) {
  if (!child || child.exitCode != null) return;
  if (process.platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => { try { child.kill(); } catch {} });
      killer.on('close', code => { if (code) { try { child.kill(); } catch {} } });
    } catch { try { child.kill(); } catch {} }
  } else { try { child.kill(); } catch {} }
}

function readCodexModels(target, { spawnProcess, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let child;
    let timer;
    let settled = false;
    let buffer = '';
    let totalBytes = 0;
    let requestId = 1;
    let pages = 0;
    const models = [];
    const decoder = new StringDecoder('utf8');
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child?.stdin.end(); } catch {}
      stopChild(child, spawnProcess);
      if (error) reject(new Error('Codex 모델 목록을 확인하지 못했습니다. CLI 로그인과 버전을 확인해 주세요.'));
      else resolve(result);
    };
    const send = value => {
      try { child.stdin.write(`${JSON.stringify(value)}\n`); }
      catch { finish(true); }
    };
    const nextPage = cursor => send({ id: ++requestId, method: 'model/list', params: { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) } });
    const consume = value => {
      if (value.id !== requestId) return;
      if (value.error) { finish(true); return; }
      if (!Object.hasOwn(value, 'result')) return;
      if (requestId === 1) {
        send({ method: 'initialized', params: {} });
        nextPage();
        return;
      }
      if (!Array.isArray(value.result?.data)) { finish(true); return; }
      models.push(...value.result.data.slice(0, Math.max(0, 100 - models.length)));
      pages += 1;
      if (value.result.nextCursor && pages < 3 && models.length < 100) nextPage(value.result.nextCursor);
      else finish(false, { data: models });
    };
    try {
      child = spawnProcess(target.command, [...target.prefix, 'app-server', '--listen', 'stdio://'], { env: subscriptionEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      child.on('error', () => finish(true));
      child.on('close', () => finish(true));
      child.stdin.on('error', () => finish(true));
      child.stdout.on('data', chunk => {
        if (settled) return;
        totalBytes += Buffer.byteLength(chunk);
        if (totalBytes > 1024 * 1024) { finish(true); return; }
        buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
        let boundary;
        while (!settled && (boundary = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
          try { consume(JSON.parse(line)); } catch { /* Non-JSON diagnostics are not model data. */ }
        }
        if (buffer.length > 262144) finish(true);
      });
      child.stderr.on('data', () => {});
      timer = setTimeout(() => finish(true), timeoutMs);
      timer.unref?.();
      send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'imperium_terminal', title: 'Imperium', version: '1.0.0' } } });
    } catch { finish(true); }
  });
}

async function readOllamaModels(fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetchImpl('http://127.0.0.1:11434/api/tags', { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } });
    if (!response.ok) { await response.body?.cancel?.().catch(() => {}); throw new Error(); }
    if (Number(response.headers?.get?.('content-length')) > 1024 * 1024) throw new Error();
    const reader = response.body?.getReader?.();
    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text) > 1024 * 1024) throw new Error();
      return JSON.parse(text);
    }
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 1024 * 1024) throw new Error();
        chunks.push(Buffer.from(value));
      }
      return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } finally { clearTimeout(timer); }
}

/** Discovery-only runner: never pass startProvider here. The injectable function
 * accepts {id, operation, params} and returns the raw model-list JSON. */
export function createCatalogRunner({ spawnProcess = spawn, locate = locateProvider, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  return async ({ id, operation }) => {
    if (id === 'codex' && operation === 'model/list') {
      const target = await locate('codex');
      if (!target) throw new Error('Codex CLI를 설치하고 로그인해 주세요.');
      return readCodexModels(target, { spawnProcess, timeoutMs });
    }
    if (id === 'ollama' && operation === 'api/tags') return readOllamaModels(fetchImpl, timeoutMs);
    throw failure('지원하지 않는 모델 탐색 요청입니다.');
  };
}
const defaultRunner = createCatalogRunner();

/** Return {models:[{id,name,source}],detail}. Aliases deliberately do not claim
 * entitlement. Codex model/list is a client/account catalog, not a live access
 * test. Ollama returns installed local entries and excludes :cloud aliases. */
export async function discoverModels(id, { providerRunner = defaultRunner } = {}) {
  if (!PROVIDER_CATALOG.some(provider => provider.id === id)) throw failure('지원하지 않는 모델 제공자입니다.');
  if (ALIASES[id]) return {
    models: ALIASES[id].map(([modelId, name]) => ({ id: modelId, name, source: 'alias' })),
    detail: id === 'claude' ? '공식 모델 별칭입니다. 실제 사용 가능 모델은 Claude 구독과 관리 설정에 따라 달라집니다. Claude Code에서 /model로 확인하세요.' : `${id === 'gemini' ? 'Gemini' : 'Copilot'} CLI의 공식 별칭입니다. 계정별 모델 목록을 자동으로 확인하지 않았습니다. CLI에서 /model로 확인하거나 모델 ID를 직접 입력하세요.`,
  };
  if (typeof providerRunner !== 'function') throw failure('모델 탐색기를 올바르게 지정해 주세요.');
  try {
    const raw = await providerRunner({ id, operation: id === 'codex' ? 'model/list' : 'api/tags', params: id === 'codex' ? { limit: 100, includeHidden: false } : {} });
    const rows = id === 'codex' ? raw?.data : raw?.models;
    if (!Array.isArray(rows)) throw new Error();
    const unique = new Map();
    for (const item of rows.slice(0, 500)) {
      if (!item || typeof item !== 'object' || item.hidden === true) continue;
      const modelId = id === 'codex' ? item.model || item.id : item.name || item.model;
      if (!safeModelId(modelId)) continue;
      if (id === 'ollama' && (/(?:^|[:/-])cloud$/i.test(modelId) || item.remote_host || item.remote_model)) continue;
      if (!unique.has(modelId)) unique.set(modelId, { id: modelId, name: displayName(item.displayName || item.name, modelId), source: id === 'codex' ? 'account' : 'local' });
      if (unique.size >= 100) break;
    }
    return {
      models: [...unique.values()],
      detail: id === 'codex' ? '로그인한 Codex app-server가 반환한 모델 카탈로그입니다. 실제 모델 접근 권한은 구독과 계정 설정에 따라 달라지며 목록 조회만으로 보장되지 않습니다.' : '이 컴퓨터의 Ollama에서 조회한 설치 모델입니다. 클라우드 모델은 제외했습니다.',
    };
  } catch {
    return { models: [], detail: id === 'codex' ? 'Codex 모델 목록을 불러오지 못했습니다. Codex CLI 로그인과 버전을 확인하거나 모델 ID를 직접 입력하세요.' : '로컬 Ollama 서비스에 연결하지 못했습니다. Ollama를 실행하고 모델 설치 상태를 확인하세요.' };
  }
}
