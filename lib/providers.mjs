import { spawn } from 'node:child_process';
import { access, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

const OUTPUT_LIMIT = 2 * 1024 * 1024;
const LINE_LIMIT = 1024 * 1024;
const PROVIDERS = {
  codex: { name: 'ChatGPT / Codex', loginCommand: 'codex login' },
  claude: { name: 'Claude Code', loginCommand: 'claude auth login' },
};

export function subscriptionEnvironment(source = process.env) {
  const excluded = new Set(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']);
  const environment = Object.fromEntries(Object.entries(source).filter(([name]) => !excluded.has(name.toUpperCase())));
  // Packaged Electron is also the Node runtime for npm-installed CLI wrappers.
  // Native CLI executables ignore this flag; regular Node ignores it as well.
  if (process.versions.electron) environment.ELECTRON_RUN_AS_NODE = '1';
  if (process.platform === 'darwin') {
    const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path') || 'PATH';
    environment[pathKey] = [...new Set([...(environment[pathKey] || '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin', path.join(homedir(), '.local', 'bin')])].filter(Boolean).join(path.delimiter);
  }
  return environment;
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

/** Resolve wrappers to their JS entry point; never execute cmd.exe or a shell. */
export async function locateProvider(provider) {
  if (!PROVIDERS[provider]) throw new Error('지원하지 않는 모델입니다.');
  const isWindows = process.platform === 'win32';
  const pathValue = Object.entries(process.env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
  const dirs = pathValue.split(path.delimiter).filter(Boolean);
  dirs.push(path.join(homedir(), '.local', 'bin'));
  if (process.platform === 'darwin') dirs.push('/opt/homebrew/bin', '/usr/local/bin', path.join(homedir(), '.npm-global', 'bin'));
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs'));
  const packageParts = provider === 'codex'
    ? ['@openai', 'codex', 'bin', 'codex.js']
    : ['@anthropic-ai', 'claude-code', 'cli.js'];
  for (const dir of [...new Set(dirs)]) {
    const executable = path.join(dir, isWindows ? `${provider}.exe` : provider);
    if (await exists(executable)) {
      if (!isWindows) {
        const resolved = await realpath(executable);
        if (/\.(?:mjs|cjs|js)$/.test(resolved)) return { command: process.execPath, prefix: [resolved] };
      }
      return { command: executable, prefix: [] };
    }
    // npm on Windows provides .cmd/.ps1 shims. Executing the package with Node
    // preserves exact arguments and avoids putting user prompts into a shell.
    const entry = path.join(dir, 'node_modules', ...packageParts);
    if (await exists(entry)) return { command: process.execPath, prefix: [entry] };
  }
  const localEntry = path.join(process.cwd(), 'node_modules', ...packageParts);
  if (await exists(localEntry)) return { command: process.execPath, prefix: [localEntry] };
  return null;
}

export function providerArguments(provider, permission = 'read-only') {
  if (!['read-only', 'workspace-write'].includes(permission)) throw new Error('잘못된 작업 권한입니다.');
  if (provider === 'codex') return ['-a', 'never', 'exec', '--json', '--skip-git-repo-check', '--sandbox', permission, '-'];
  if (provider === 'claude') {
    const tools = permission === 'read-only' ? 'Read,Glob,Grep' : 'Read,Glob,Grep,Edit,Write';
    // --tools limits the available set as well as --allowedTools pre-approving it.
    // Bash is deliberately absent, including in read-only mode.
    return ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--tools', tools, '--allowedTools', tools];
  }
  throw new Error('지원하지 않는 모델입니다.');
}

function notify(callback, value) {
  try { callback?.(value); } catch { /* A disconnected UI must not crash the worker. */ }
}

function boundedAppend(current, next, limit = OUTPUT_LIMIT) {
  return current.length >= limit ? current : (current + next).slice(0, limit);
}

function count(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

/** Consume parsed provider events. Exposed to test provider protocol changes. */
export function createEventParser(provider, onEvent) {
  let output = '';
  let finalOutput = '';
  let error = '';
  let streamedMessage = false;
  let usage = { inputTokens: 0, outputTokens: 0 };
  const emit = (event) => notify(onEvent, event);
  const appendText = (text) => {
    if (typeof text !== 'string' || !text) return;
    const remaining = OUTPUT_LIMIT - output.length;
    if (remaining <= 0) return;
    const bounded = text.slice(0, remaining);
    output += bounded;
    emit({ type: 'text', text: bounded });
  };
  const recordError = (text) => {
    error = String(text || '모델 실행에 실패했습니다.').slice(0, 4000);
    emit({ type: 'error', text: error });
  };
  const recordUsage = (value, add = false) => {
    if (!value || typeof value !== 'object') return;
    const inputTokens = count(value.input_tokens ?? value.inputTokens);
    const outputTokens = count(value.output_tokens ?? value.outputTokens);
    usage = {
      inputTokens: inputTokens + (add ? usage.inputTokens : 0),
      outputTokens: outputTokens + (add ? usage.outputTokens : 0),
    };
    emit({ type: 'usage', text: '토큰 사용량 갱신', ...usage });
  };
  function consume(event) {
    if (!event || typeof event !== 'object') return;
    if (provider === 'codex') {
      if (event.type === 'thread.started') emit({ type: 'status', text: 'Codex 세션 연결' });
      if (event.type === 'turn.started') emit({ type: 'status', text: 'Codex가 작업 중입니다.' });
      if (event.type?.startsWith('item.') && event.item) {
        const item = event.item;
        if (item.type === 'agent_message' && event.type === 'item.completed') appendText(item.text);
        else if (item.type === 'reasoning') {
          if (event.type === 'item.started') emit({ type: 'status', text: '작업을 검토하고 있습니다.' });
        } else if (item.type !== 'agent_message') {
          const label = item.command || item.tool || item.type || '도구 실행';
          emit({ type: 'tool', text: String(label).slice(0, 1000) });
        }
      }
      if (event.type === 'turn.completed') recordUsage(event.usage, true);
      if (event.type === 'error' || event.type === 'turn.failed') recordError(event.error?.message || event.message || event.error);
      return;
    }
    if (event.type === 'system' && event.subtype === 'init') emit({ type: 'status', text: 'Claude 세션 연결' });
    if (event.type === 'system' && event.subtype === 'permission_denied') emit({ type: 'status', text: '현재 권한으로 허용되지 않은 도구입니다.' });
    if (event.type === 'stream_event') {
      const delta = event.event;
      if (delta?.type === 'message_start') streamedMessage = false;
      if (delta?.type === 'content_block_delta' && delta.delta?.type === 'text_delta') {
        streamedMessage = true;
        appendText(delta.delta.text);
      }
      if (delta?.type === 'content_block_start' && delta.content_block?.type === 'tool_use') {
        emit({ type: 'tool', text: String(delta.content_block.name || '도구 실행').slice(0, 1000) });
      }
    }
    if (event.type === 'assistant' && event.message) {
      for (const block of event.message.content || []) {
        if (block.type === 'text' && !streamedMessage) appendText(block.text);
        if (block.type === 'tool_use') emit({ type: 'tool', text: String(block.name || '도구 실행').slice(0, 1000) });
      }
      streamedMessage = false;
      recordUsage(event.message.usage, true);
    }
    if (event.type === 'result') {
      if (typeof event.result === 'string') {
        finalOutput = event.result.slice(0, OUTPUT_LIMIT);
        if (!output) appendText(finalOutput);
      }
      recordUsage(event.usage);
      if (event.is_error || (event.subtype && event.subtype !== 'success')) {
        recordError(Array.isArray(event.errors) ? event.errors.join('\n') : event.result || event.subtype);
      }
    }
    if (event.type === 'error') recordError(event.error?.message || event.message || event.error);
  }
  return { consume, state: () => ({ output: finalOutput || output, usage: { ...usage }, error }) };
}

/** Incrementally decode UTF-8, including split Hangul characters and final lines. */
export function createJsonLineReader(onValue, onInvalid = () => {}) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  let dropping = false;
  const readLine = (line) => {
    if (!line.trim()) return;
    try { onValue(JSON.parse(line)); } catch (error) {
      if (error instanceof SyntaxError) onInvalid('모델 응답에 JSON이 아닌 출력이 포함되어 있습니다.');
      else throw error;
    }
  };
  function accept(text) {
    buffer += text;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!dropping && line.length <= LINE_LIMIT) readLine(line);
      else if (!dropping) onInvalid('모델 이벤트가 최대 길이를 초과했습니다.');
      dropping = false;
    }
    if (buffer.length > LINE_LIMIT) {
      buffer = '';
      if (!dropping) onInvalid('모델 이벤트가 최대 길이를 초과했습니다.');
      dropping = true;
    }
  }
  return {
    write(chunk) { accept(typeof chunk === 'string' ? chunk : decoder.write(chunk)); },
    end() { accept(decoder.end()); if (buffer && !dropping) readLine(buffer); buffer = ''; },
  };
}

function stopProcess(child, spawnProcess = spawn, platform = process.platform) {
  if (!child || child.exitCode !== null && child.exitCode !== undefined) return;
  if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
      killer.on('error', () => { try { child.kill(); } catch {} });
      killer.on('close', (code) => { if (code) { try { child.kill(); } catch {} } });
    } catch { try { child.kill(); } catch {} }
  } else { try { child.kill('SIGTERM'); } catch {} }
}

function capture(target, args, timeout = 8000) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, ...result });
    };
    try {
      child = spawn(target.command, [...target.prefix, ...args], { env: subscriptionEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout = boundedAppend(stdout, chunk, 262144); });
      child.stderr.on('data', (chunk) => { stderr = boundedAppend(stderr, chunk, 262144); });
      child.on('error', () => finish({ code: -1 }));
      child.on('close', (code) => finish({ code }));
      child.stdin.on('error', () => {});
      child.stdin.end();
      timer = setTimeout(() => { stopProcess(child); finish({ code: -1, timedOut: true }); }, timeout);
      timer.unref?.();
    } catch { finish({ code: -1 }); }
  });
}

export async function detectProviders() {
  return Promise.all(Object.entries(PROVIDERS).map(async ([id, info]) => {
    const base = { id, ...info, installed: false, authenticated: false, status: 'missing', version: '', detail: 'CLI가 설치되어 있지 않습니다.' };
    const target = await locateProvider(id);
    if (!target) return base;
    const [version, auth] = await Promise.all([capture(target, ['--version']), capture(target, id === 'codex' ? ['login', 'status'] : ['auth', 'status'])]);
    base.installed = true;
    base.version = version.stdout.trim().split('\n')[0].slice(0, 160);
    if (version.code !== 0 || auth.timedOut) return { ...base, status: 'error', detail: 'CLI 상태를 확인하지 못했습니다. 터미널에서 설치 상태를 확인해 주세요.' };
    let authenticated = false;
    if (id === 'codex') authenticated = auth.code === 0 && /logged\s+in\s+using\s+chatgpt/i.test(auth.stdout + auth.stderr);
    else {
      try {
        const status = JSON.parse(auth.stdout);
        authenticated = auth.code === 0 && status.loggedIn !== false && status.authMethod === 'claude.ai';
      } catch { /* Unknown auth formats are never assumed to be subscription auth. */ }
    }
    return { ...base, authenticated, status: authenticated ? 'ready' : 'login_required', detail: authenticated ? '구독 계정으로 연결되었습니다.' : '구독 계정으로 CLI 로그인이 필요합니다.' };
  }));
}

/** Dependency injection keeps tests offline and never spends subscription quota. */
export function createProviderRunner({ spawnProcess = spawn, locate = locateProvider, platform = process.platform } = {}) {
  return async function run({ provider, prompt, cwd, permission = 'read-only', onEvent, onExit }) {
    const args = providerArguments(provider, permission);
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('작업 지시를 입력해 주세요.');
    const target = await locate(provider);
    if (!target) throw new Error(`${PROVIDERS[provider].name} CLI를 설치하고 로그인해 주세요.`);
    let child;
    let settled = false;
    let cancelled = false;
    let stderr = '';
    let cancelTimer;
    const parser = createEventParser(provider, onEvent);
    const reader = createJsonLineReader(parser.consume, (text) => notify(onEvent, { type: 'status', text }));
    const finish = (code, processError) => {
      if (settled) return;
      settled = true;
      clearTimeout(cancelTimer);
      reader.end();
      const state = parser.state();
      const error = cancelled ? '작업이 취소되었습니다.' : processError || state.error || (code !== 0 ? stderr.trim() || `CLI가 종료 코드 ${code}로 종료되었습니다.` : undefined);
      notify(onExit, { code: cancelled ? 130 : error && code === 0 ? 1 : code, output: state.output, usage: state.usage, ...(error ? { error: String(error).slice(0, 4000) } : {}) });
    };
    try {
      child = spawnProcess(target.command, [...target.prefix, ...args], {
        cwd, env: subscriptionEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => { if (!settled) reader.write(chunk); });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderr = boundedAppend(stderr, chunk, 8192); });
      child.on('error', (error) => finish(1, `CLI를 실행하지 못했습니다: ${error.code || error.message}`));
      child.on('close', (code) => finish(code ?? (cancelled ? 130 : 1)));
      child.stdin.on('error', (error) => { if (error.code !== 'EPIPE') notify(onEvent, { type: 'error', text: '작업 지시를 CLI에 전달하지 못했습니다.' }); });
      // The prompt never becomes a command-line argument or shell source.
      child.stdin.end(prompt, 'utf8');
      notify(onEvent, { type: 'status', text: `${PROVIDERS[provider].name} 작업을 시작했습니다.` });
    } catch (error) { finish(1, `CLI를 실행하지 못했습니다: ${error.code || error.message}`); }
    return {
      cancel() {
        if (cancelled || settled) return;
        cancelled = true;
        notify(onEvent, { type: 'status', text: '작업을 중단하고 있습니다.' });
        cancelTimer = setTimeout(() => finish(130), 4000);
        cancelTimer.unref?.();
        stopProcess(child, spawnProcess, platform);
      },
    };
  };
}

export const startProvider = createProviderRunner();
