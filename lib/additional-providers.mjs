import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, realpath, rm, rmdir, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createJsonLineReader, subscriptionEnvironment } from './providers.mjs';
import { executionArguments } from './execution-options.mjs';

// Protocol and permission references (no SDK dependency):
// https://geminicli.com/docs/reference/configuration/
// https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md
// https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/commands/models/list.ts
// https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
// https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts
// https://docs.ollama.com/api/generate
const LIMIT = 2 * 1024 * 1024;
const OLLAMA = 'http://127.0.0.1:11434';
const INFO = {
  gemini: { name: 'Gemini CLI', loginCommand: 'gemini' },
  copilot: { name: 'GitHub Copilot CLI', loginCommand: 'copilot login' },
  ollama: { name: 'Ollama', loginCommand: 'ollama list' },
};
const READ_TOOLS = ['read_file', 'list_directory', 'glob', 'grep_search', 'search_file_content', 'read_many_files'];
const WINDOWS_COMMAND_LINE_LIMIT = 30000;
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value);
const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const notify = (fn, value) => { try { fn?.(value); } catch {} };
const append = (current, text, limit = LIMIT) => (current + String(text)).slice(0, limit);
async function exists(file) { try { await access(file); return true; } catch { return false; } }

/** Exact UTF-16 length of Node/libuv's shell:false Windows command line, including its final NUL.
 * https://github.com/libuv/libuv/blob/v1.x/src/win/process.c (quote_cmd_arg)
 * CreateProcessW permits 32,767 units including NUL; the runner keeps a 30,000-unit budget.
 */
export function windowsCommandLineLength(command, args = []) {
  function quotedLength(value) {
    if (value.length === 0) return 2;
    if (!/[ \t"]/.test(value)) return value.length;
    let length = value.length + 2, beforeQuote = true;
    // Backslashes directly before an embedded/closing quote are doubled.
    // JS string.length counts UTF-16 units, including both halves of emoji.
    for (let index = value.length - 1; index >= 0; index--) {
      if (beforeQuote && value[index] === '\\') length++;
      else if (value[index] === '"') { beforeQuote = true; length++; }
      else beforeQuote = false;
    }
    return length;
  }
  return 1 + [command, ...args].reduce((length, value, index) => length + (index ? 1 : 0) + quotedLength(value), 0);
}

export function additionalEnvironment(source = process.env) {
  const excluded = /^(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_GEMINI_BASE_URL|GOOGLE_GENAI_USE_VERTEXAI|GOOGLE_GENAI_USE_GCA|GEMINI_CLI_USE_COMPUTE_ADC|CLOUD_SHELL|COPILOT_GITHUB_TOKEN|COPILOT_SDK_AUTH_TOKEN|GH_TOKEN|GITHUB_TOKEN|GEMINI_CLI_SYSTEM_SETTINGS_PATH)$/i;
  return Object.fromEntries(Object.entries(subscriptionEnvironment(source)).filter(([key]) => !excluded.test(key)));
}

export async function locateAdditionalProvider(id, { searchDirectories, platform = process.platform } = {}) {
  if (!INFO[id]) throw new Error('지원하지 않는 추가 모델입니다.');
  const pathValue = Object.entries(process.env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
  const dirs = [...pathValue.split(path.delimiter), path.join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs'), path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama'));
  dirs.push(process.cwd());
  for (const dir of [...new Set(searchDirectories || dirs)].filter(Boolean)) {
    // VS Code's shim is an installer/launcher, not proof that Copilot is installed.
    if (id === 'copilot' && /(?:^|[\\/])copilot-shim(?:[\\/]|$)/i.test(dir)) continue;
    const native = path.join(dir, platform === 'win32' ? `${id}.exe` : id);
    if (await exists(native)) {
      const resolved = await realpath(native);
      return /\.(?:mjs|cjs|js)$/i.test(resolved) ? { command: process.execPath, prefix: [resolved] } : { command: native, prefix: [] };
    }
    const packageRoot = id === 'gemini' ? path.join(dir, 'node_modules', '@google', 'gemini-cli') : id === 'copilot' ? path.join(dir, 'node_modules', '@github', 'copilot') : null;
    if (!packageRoot) continue;
    try {
      const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
      const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[id];
      if (!bin || typeof bin !== 'string') continue;
      const entry = path.resolve(packageRoot, bin);
      if (!entry.startsWith(`${path.resolve(packageRoot)}${path.sep}`) || !await exists(entry)) continue;
      if (/\.(?:js|mjs|cjs)$/i.test(entry)) return { command: process.execPath, prefix: [entry] };
      if (platform !== 'win32' || entry.endsWith('.exe')) return { command: entry, prefix: [] };
    } catch { /* Missing/incomplete npm packages are not launchable providers. */ }
  }
  return null;
}

function stopChild(child, spawnProcess = spawn, platform = process.platform) {
  if (!child || child.exitCode != null) return;
  if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => { try { child.kill(); } catch {} });
      killer.on('close', code => { if (code) { try { child.kill(); } catch {} } });
    } catch { try { child.kill(); } catch {} }
  } else { try { child.kill('SIGTERM'); } catch {} }
}

export async function prepareGeminiContext({ systemDirectory } = {}) {
  const standardRoot = systemDirectory || (process.platform === 'win32' ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'gemini-cli') : process.platform === 'darwin' ? '/Library/Application Support/GeminiCli' : '/etc/gemini-cli');
  const systemFile = !systemDirectory && process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH || path.join(standardRoot, 'settings.json');
  // Do not replace enterprise settings or rely on a supplemental policy that a
  // central administrator's policy directory would cause Gemini to ignore.
  const policies = await readdir(path.join(standardRoot, 'policies')).catch(() => []);
  if (await exists(systemFile) || policies.some(name => name.endsWith('.toml'))) throw new Error('Gemini 중앙 관리 설정이 있어 읽기 전용 제한을 보장할 수 없습니다. 이 환경의 실행은 지원하지 않습니다.');
  const directory = await mkdtemp(path.join(tmpdir(), 'imperium-gemini-'));
  const policyPath = path.join(directory, 'read-only.toml');
  const settingsPath = path.join(directory, 'settings.json');
  const cleanup = async () => {
    await Promise.allSettled([rm(policyPath, { force: true }), rm(settingsPath, { force: true })]);
    await rmdir(directory).catch(() => {});
  };
  try {
    const rules = ['[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 998\n', ...READ_TOOLS.map(tool => `[[rule]]\ntoolName = "${tool}"\ndecision = "allow"\npriority = 999\n`)].join('\n');
    const settings = {
      security: { auth: { selectedType: 'oauth-personal', enforcedType: 'oauth-personal', useExternal: false }, disableYoloMode: true },
      advanced: { ignoreLocalEnv: true }, hooksConfig: { enabled: false },
      admin: { secureModeEnabled: true, extensions: { enabled: false }, mcp: { enabled: false }, skills: { enabled: false } },
      tools: { core: READ_TOOLS }, general: { enableAutoUpdate: false, defaultApprovalMode: 'plan' },
      experimental: { enableAgents: false, autoMemory: false }, telemetry: { enabled: false },
    };
    await Promise.all([writeFile(policyPath, rules, { encoding: 'utf8', mode: 0o600 }), writeFile(settingsPath, JSON.stringify(settings), { encoding: 'utf8', mode: 0o600 })]);
    return { env: { ...additionalEnvironment(), GEMINI_CLI_SYSTEM_SETTINGS_PATH: settingsPath }, policyPath, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

export function additionalProviderArguments(id, { permission = 'read-only', modelId, prompt, policyPath, reasoningEffort, speed } = {}) {
  if (!INFO[id]) throw new Error('지원하지 않는 추가 모델입니다.');
  if (permission !== 'read-only') throw new Error(`${INFO[id].name} 연결은 현재 읽기 전용입니다. 파일 수정 작업은 Codex 또는 Claude Code를 선택해 주세요.`);
  if (modelId != null && modelId !== '' && !safeId(modelId)) throw new Error('올바른 모델 ID를 선택해 주세요.');
  const model = modelId && modelId !== 'auto' ? ['--model', modelId] : [];
  const execution = executionArguments(id, { ...(reasoningEffort !== undefined ? { reasoningEffort } : {}), ...(speed !== undefined ? { speed } : {}) });
  if (id === 'gemini') {
    if (!policyPath) throw new Error('Gemini 읽기 전용 정책이 준비되지 않았습니다.');
    return ['--output-format', 'stream-json', '--approval-mode', 'plan', '--admin-policy', policyPath, ...model];
  }
  if (id === 'copilot') return ['--no-auto-update', '--output-format', 'json', '--no-color', '--no-ask-user', '--no-custom-instructions', '--disable-builtin-mcps', '--available-tools', 'view,glob,grep', '--allow-tool', 'read', '--deny-tool', 'shell,write,url,memory', ...model, ...execution, '-p', prompt];
  return [];
}

function capture(target, args, { spawnProcess = spawn, env = additionalEnvironment(), timeoutMs = 8000, platform = process.platform } = {}) {
  return new Promise(resolve => {
    let child, timer, done = false, stdout = '', stderr = '';
    const finish = code => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout, stderr }); };
    try {
      child = spawnProcess(target.command, [...target.prefix, ...args], { env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      for (const [stream, sink] of [[child.stdout, 'out'], [child.stderr, 'err']]) {
        stream.setEncoding('utf8');
        stream.on('data', text => { if (sink === 'out') stdout = append(stdout, text, LIMIT); else stderr = append(stderr, text, 8192); });
      }
      child.on('error', () => finish(-1)); child.on('close', finish);
      child.stdin.on('error', () => {}); child.stdin.end();
      timer = setTimeout(() => { stopChild(child, spawnProcess, platform); finish(-1); }, timeoutMs);
      timer.unref?.();
    } catch { finish(-1); }
  });
}

/** Copilot's own credential-free SDK RPC: no credential files or cookies read. */
export function probeCopilotAuth(target, { spawnProcess = spawn, timeoutMs = 8000, platform = process.platform } = {}) {
  return new Promise(resolve => {
    let child, timer, settled = false, buffer = Buffer.alloc(0);
    const finish = authenticated => {
      if (settled) return; settled = true; clearTimeout(timer);
      try { child?.stdin.end(); } catch {}
      stopChild(child, spawnProcess, platform); resolve(authenticated === true);
    };
    const send = value => {
      const payload = Buffer.from(JSON.stringify(value));
      child.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`); child.stdin.write(payload);
    };
    try {
      child = spawnProcess(target.command, [...target.prefix, '--headless', '--stdio', '--no-auto-update'], { env: additionalEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      child.on('error', () => finish(false)); child.on('close', () => finish(false));
      child.stdin.on('error', () => finish(false)); child.stderr.on('data', () => {});
      child.stdout.on('data', chunk => {
        if (settled) return;
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
        if (buffer.length > LIMIT) { finish(false); return; }
        for (;;) {
          const boundary = buffer.indexOf('\r\n\r\n');
          if (boundary < 0) return;
          const length = Number(/Content-Length:\s*(\d+)/i.exec(buffer.subarray(0, boundary).toString('ascii'))?.[1]);
          if (!Number.isSafeInteger(length) || length < 0 || length > LIMIT) { finish(false); return; }
          if (buffer.length < boundary + 4 + length) return;
          const payload = buffer.subarray(boundary + 4, boundary + 4 + length); buffer = buffer.subarray(boundary + 4 + length);
          let value; try { value = JSON.parse(payload.toString('utf8')); } catch { finish(false); return; }
          if (value.id === 1) send({ jsonrpc: '2.0', id: 2, method: 'auth.getStatus', params: {} });
          else if (value.id === 2) {
            const status = value.result;
            const ownAccount = !status?.authType || ['user', 'account', 'gh-cli'].includes(status.authType);
            finish(!value.error && status?.isAuthenticated === true && ownAccount); return;
          } else if (value.id != null && value.method) send({ jsonrpc: '2.0', id: value.id, error: { code: -32601, message: 'Credential and tool callbacks are not available during status checks.' } });
          if (settled) return;
        }
      });
      timer = setTimeout(() => finish(false), timeoutMs); timer.unref?.();
      send({ jsonrpc: '2.0', id: 1, method: 'connect', params: { clientInfo: { editorName: 'Imperium', editorVersion: '1.1.0' } } });
    } catch { finish(false); }
  });
}

async function responseJSON(response, limit = LIMIT) {
  if (!response.ok) { await response.body?.cancel?.().catch(() => {}); throw new Error('로컬 Ollama 응답 오류'); }
  if (Number(response.headers?.get?.('content-length')) > limit) throw new Error('로컬 모델 목록이 너무 큽니다.');
  if (!response.body?.getReader) {
    const text = await response.text(); if (Buffer.byteLength(text) > limit) throw new Error('응답 크기 초과'); return JSON.parse(text);
  }
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) throw new Error('응답 크기 초과'); chunks.push(Buffer.from(value)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function localModels(fetchImpl, timeoutMs = 3000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref?.();
  try {
    const value = await responseJSON(await fetchImpl(`${OLLAMA}/api/tags`, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } }));
    if (!Array.isArray(value.models)) throw new Error('Ollama 모델 목록 형식을 확인할 수 없습니다.');
    return value.models.filter(row => row && !row.remote_host && !row.remote_model).map(row => row.name || row.model).filter(name => safeId(name) && !/(?:^|[:/-])cloud$/i.test(name)).slice(0, 100);
  } finally { clearTimeout(timer); }
}

export function createAdditionalDetector({ locate = locateAdditionalProvider, spawnProcess = spawn, fetchImpl = globalThis.fetch, probe = capture, copilotAuth = probeCopilotAuth, prepareGemini = prepareGeminiContext, timeoutMs = 8000, platform = process.platform } = {}) {
  return async ({ localOnly = false } = {}) => Promise.all(Object.entries(INFO).filter(([id]) => !localOnly || id === 'ollama').map(async ([id, info]) => {
    const base = { id, ...info, installed: false, authenticated: false, status: 'missing', version: '', detail: 'CLI 설치 또는 로컬 서비스 연결이 필요합니다.', supportedPermissions: ['read-only'] };
    let target;
    try { target = await locate(id); } catch { return { ...base, status: 'error', detail: 'CLI 설치 상태를 확인하지 못했습니다.' }; }
    if (id === 'ollama') {
      try {
        const models = await localModels(fetchImpl, Math.min(timeoutMs, 3000));
        return { ...base, installed: true, authenticated: models.length > 0, status: models.length ? 'ready' : 'error', detail: models.length ? `로컬 Ollama 모델 ${models.length}개를 확인했습니다. 파일 도구 없이 텍스트를 생성합니다.` : 'Ollama는 연결되었지만 설치된 로컬 모델이 없습니다.', models };
      } catch { return { ...base, installed: Boolean(target), status: target ? 'error' : 'missing', detail: '127.0.0.1:11434의 Ollama 서비스와 로컬 모델 설치 상태를 확인해 주세요.' }; }
    }
    if (!target) return base;
    const options = { spawnProcess, timeoutMs, platform };
    const version = await probe(target, ['--version'], options);
    base.installed = true; base.version = version.stdout.trim().split('\n')[0].slice(0, 120);
    if (version.code !== 0) return { ...base, status: 'error', detail: 'CLI를 실행하지 못했습니다. 설치와 버전을 확인해 주세요.' };
    try {
      let authenticated;
      if (id === 'copilot') authenticated = await copilotAuth(target, options);
      else {
        const context = await prepareGemini();
        try {
          // Gemini otherwise silently returns a default model catalog on auth
          // failure. enforcedType in this process-only configuration makes its
          // own models-list command propagate auth failures (never inference).
          const result = await probe(target, ['models', 'list', '--output-format', 'json'], { ...options, env: context.env });
          const models = result.code === 0 ? JSON.parse(result.stdout) : null;
          authenticated = Array.isArray(models) && models.length > 0 && models.every(model => typeof (model.modelId || model.id) === 'string');
        } finally { await context.cleanup(); }
      }
      return { ...base, authenticated: authenticated === true, status: authenticated === true ? 'ready' : 'login_required', detail: authenticated === true ? 'CLI가 로그인 상태를 확인했습니다. 읽기 전용 작업을 실행할 수 있습니다.' : 'CLI의 계정 인증을 확인하지 못했습니다. 터미널에서 로그인한 뒤 다시 확인해 주세요.' };
    } catch (error) { return { ...base, status: 'error', detail: error.message?.startsWith('Gemini 중앙') ? error.message : 'CLI 계정 상태를 자동으로 확인하지 못했습니다. CLI 버전과 로그인을 확인해 주세요.' }; }
  }));
}

export function createAdditionalEventParser(id, onEvent) {
  let output = '', finalText = '', error = '', usedDeltas = false;
  let usage = { inputTokens: 0, outputTokens: 0 };
  const emit = value => notify(onEvent, value);
  const text = value => { if (typeof value !== 'string' || !value) return; const part = value.slice(0, LIMIT - output.length); if (part) { output += part; emit({ type: 'text', text: part }); } };
  const fail = value => { error = String(value || '모델 실행 오류').slice(0, 4000); emit({ type: 'error', text: error }); };
  const tokens = value => {
    if (!value) return;
    const models = value.models && Object.values(value.models);
    usage = models ? models.reduce((total, model) => ({ inputTokens: total.inputTokens + integer(model.tokens?.input ?? model.tokens?.prompt), outputTokens: total.outputTokens + integer(model.tokens?.output ?? model.tokens?.candidates) }), { inputTokens: 0, outputTokens: 0 }) : { inputTokens: integer(value.input_tokens ?? value.inputTokens ?? value.prompt_eval_count), outputTokens: integer(value.output_tokens ?? value.outputTokens ?? value.eval_count) };
    emit({ type: 'usage', text: '토큰 사용량 갱신', ...usage });
  };
  return {
    consume(event) {
      if (!event || typeof event !== 'object') return;
      const data = event.data || event;
      if (id === 'ollama') { text(event.response); if (event.error) fail(event.error); if (event.done) tokens(event); return; }
      if (id === 'gemini') {
        if (event.type === 'init') emit({ type: 'status', text: 'Gemini 세션 연결' });
        if (event.type === 'message' && event.role === 'assistant') text(event.content);
        if (event.type === 'tool_use') emit({ type: 'tool', text: String(event.tool_name || event.name || '읽기 도구').slice(0, 1000) });
        if (event.type === 'error' && event.severity !== 'warning') fail(event.message || event.error?.message);
        if (event.type === 'result') {
          if (event.response && !output) text(event.response);
          tokens(event.stats || event.usage);
          if (event.status === 'error' || event.error) fail(event.error?.message || event.message || event.error);
        }
      } else {
        if (event.type === 'assistant.message_delta') { usedDeltas = true; text(data.deltaContent ?? data.content ?? data.text); }
        if (event.type === 'assistant.message') { if (!usedDeltas) text(data.content); usedDeltas = false; finalText = typeof data.content === 'string' ? data.content.slice(0, LIMIT) : finalText; }
        if (event.type === 'tool.execution_start') emit({ type: 'tool', text: String(data.toolName || '읽기 도구').slice(0, 1000) });
        if (event.type === 'assistant.usage') tokens(data);
        if (event.type === 'session.error' || event.type === 'error') fail(data.message || data.error?.message || data.error);
        if (event.type === 'result') { if (typeof data.result === 'string' && !output) text(data.result); tokens(data.usage); if (data.is_error) fail(data.result); }
      }
    },
    state: () => ({ output: finalText || output, error, usage }),
    fail,
  };
}

export function createAdditionalProviderRunner({ spawnProcess = spawn, locate = locateAdditionalProvider, fetchImpl = globalThis.fetch, probe = capture, prepareGemini = prepareGeminiContext, platform = process.platform, timeoutMs = 8000 } = {}) {
  return async ({ provider, prompt, cwd, permission = 'read-only', modelId, reasoningEffort, speed, onEvent, onExit }) => {
    if (!INFO[provider]) throw new Error('지원하지 않는 추가 모델입니다.');
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('작업 지시를 입력해 주세요.');
    if (permission !== 'read-only') throw new Error(`${INFO[provider].name}은 현재 읽기 전용입니다. 파일 수정은 Codex 또는 Claude Code를 선택해 주세요.`);
    if (modelId != null && modelId !== '' && !safeId(modelId)) throw new Error('올바른 모델 ID를 선택해 주세요.');
    const parser = createAdditionalEventParser(provider, onEvent);
    let settled = false, cancelled = false, child, cancelTimer, stderr = '', cleanup = async () => {};
    const controller = new AbortController();
    const reader = createJsonLineReader(parser.consume, () => parser.fail('모델 응답의 JSON 스트림을 읽지 못했습니다.'));
    const finish = (code, message) => {
      if (settled) return; settled = true; clearTimeout(cancelTimer); reader.end();
      const state = parser.state();
      const error = cancelled ? '작업이 취소되었습니다.' : message || state.error || (code !== 0 ? stderr.trim() || 'CLI가 비정상 종료되었습니다.' : undefined);
      void cleanup();
      notify(onExit, { code: cancelled ? 130 : error && code === 0 ? 1 : code, output: state.output, usage: state.usage, ...(error ? { error: String(error).slice(0, 4000) } : {}) });
    };
    const handle = { cancel() { if (settled || cancelled) return; cancelled = true; controller.abort(); if (child) { cancelTimer = setTimeout(() => finish(130), 4000); cancelTimer.unref?.(); stopChild(child, spawnProcess, platform); } else finish(130); } };
    if (provider === 'ollama') {
      const models = await localModels(fetchImpl);
      const selected = modelId || models[0];
      if (!selected || !models.includes(selected)) throw new Error('Ollama에 설치된 로컬 모델을 선택해 주세요. 클라우드 모델은 실행하지 않습니다.');
      notify(onEvent, { type: 'status', text: `로컬 Ollama ${selected} · 텍스트 생성 시작` });
      void (async () => {
        let streamReader;
        try {
          const response = await fetchImpl(`${OLLAMA}/api/generate`, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' }, body: JSON.stringify({ model: selected, prompt, stream: true }) });
          if (!response.ok || !response.body?.getReader) throw new Error('로컬 Ollama 생성 스트림에 연결하지 못했습니다.');
          streamReader = response.body.getReader(); let received = 0, complete = false;
          const ollamaReader = createJsonLineReader(value => { if (value.done === true) complete = true; parser.consume(value); }, () => parser.fail('Ollama 응답 형식 오류'));
          for (;;) {
            const { done, value } = await streamReader.read(); if (done) break;
            if (settled) return;
            received += value.byteLength; if (received > 16 * LIMIT) throw new Error('Ollama 스트림이 최대 크기를 초과했습니다.');
            ollamaReader.write(value);
          }
          ollamaReader.end();
          finish(complete ? 0 : 1, complete ? undefined : 'Ollama 응답이 완료되기 전에 연결이 종료되었습니다.');
        } catch (error) { finish(cancelled ? 130 : 1, cancelled ? undefined : error.message); }
        finally { if (streamReader) { await streamReader.cancel().catch(() => {}); streamReader.releaseLock(); } }
      })();
      return handle;
    }
    const target = await locate(provider);
    if (!target) throw new Error(`${INFO[provider].name} CLI를 설치하고 로그인해 주세요.`);
    const copilotArgs = provider === 'copilot' ? additionalProviderArguments(provider, { permission, modelId, reasoningEffort, speed, prompt }) : null;
    if (copilotArgs && platform === 'win32') {
      const length = windowsCommandLineLength(target.command, [...target.prefix, ...copilotArgs]);
      if (length > WINDOWS_COMMAND_LINE_LIMIT) throw new Error(`GitHub Copilot CLI의 Windows 명령줄이 실행 경로와 인용을 포함해 ${length.toLocaleString('ko-KR')} UTF-16자로, 안전 한도 30,000자를 초과했습니다. 작업 지시를 나누거나 연결된 기억·선행 부서 출력을 줄여 다시 실행해 주세요.`);
    }
    const help = await probe(target, ['--help'], { spawnProcess, timeoutMs, platform });
    const helpText = `${help.stdout}\n${help.stderr}`;
    const required = provider === 'gemini' ? ['--approval-mode', '--admin-policy', '--output-format'] : ['--available-tools', '--deny-tool', '--output-format', '--disable-builtin-mcps'];
    if (provider === 'copilot' && reasoningEffort && reasoningEffort !== 'default') required.push('--reasoning-effort');
    if (help.code !== 0 || required.some(flag => !helpText.includes(flag))) throw new Error(`${INFO[provider].name} 버전에서 안전한 읽기 전용 옵션을 확인하지 못했습니다. CLI를 업데이트해 주세요.`);
    let context;
    if (provider === 'gemini') { context = await prepareGemini(); cleanup = context.cleanup; }
    const args = copilotArgs || additionalProviderArguments(provider, { permission, modelId, reasoningEffort, speed, prompt, policyPath: context?.policyPath });
    try {
      child = spawnProcess(target.command, [...target.prefix, ...args], { cwd, env: context?.env || additionalEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { if (!settled) reader.write(chunk); });
      child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { stderr = append(stderr, text, 8192); });
      child.on('error', error => finish(1, `CLI 실행 실패: ${error.code || 'spawn error'}`)); child.on('close', code => finish(code ?? 1));
      child.stdin.on('error', error => { if (error.code !== 'EPIPE') parser.fail('지시를 CLI에 전달하지 못했습니다.'); });
      child.stdin.end(provider === 'gemini' ? prompt : '', 'utf8');
      notify(onEvent, { type: 'status', text: `${INFO[provider].name} 읽기 전용 작업 시작` });
    } catch (error) { finish(1, `CLI 실행 실패: ${error.code || 'spawn error'}`); }
    return handle;
  };
}

export const detectAdditionalProviders = createAdditionalDetector();
export const startAdditionalProvider = createAdditionalProviderRunner();
