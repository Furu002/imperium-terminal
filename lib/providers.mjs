import { spawn } from 'node:child_process';
import { access, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { executionArguments } from './execution-options.mjs';

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
export async function locateProvider(provider, { searchDirectories, platform = process.platform } = {}) {
  if (!PROVIDERS[provider]) throw new Error('지원하지 않는 모델입니다.');
  const isWindows = platform === 'win32';
  const pathValue = Object.entries(process.env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
  const dirs = pathValue.split(path.delimiter).filter(Boolean);
  dirs.push(path.join(homedir(), '.local', 'bin'));
  if (process.platform === 'darwin') dirs.push('/opt/homebrew/bin', '/usr/local/bin', path.join(homedir(), '.npm-global', 'bin'));
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs'));
  const packageParts = provider === 'codex'
    ? ['@openai', 'codex', 'bin', 'codex.js']
    : ['@anthropic-ai', 'claude-code', 'cli.js'];
  for (const dir of [...new Set(searchDirectories || [...dirs, process.cwd()])]) {
    const executable = path.join(dir, isWindows ? `${provider}.exe` : provider);
    if (await exists(executable)) {
      if (!isWindows) {
        const resolved = await realpath(executable);
        if (/\.(?:mjs|cjs|js)$/.test(resolved)) return { command: process.execPath, prefix: [resolved] };
      }
      return { command: executable, prefix: [] };
    }
    if (provider === 'claude') {
      const root = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code');
      const native = path.join(root, 'bin', isWindows ? 'claude.exe' : 'claude');
      if (await exists(native)) return { command: native, prefix: [] };
      const wrapper = path.join(root, 'cli-wrapper.cjs');
      if (await exists(wrapper)) return { command: process.execPath, prefix: [wrapper] };
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

export const isNativeSessionId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function providerArguments(provider, permission = 'read-only', { modelId = '', memory, reasoningEffort, speed, resumeSessionId = '' } = {}) {
  if (!['read-only', 'workspace-write'].includes(permission)) throw new Error('잘못된 작업 권한입니다.');
  if (modelId && (typeof modelId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(modelId))) throw new Error('모델 ID를 확인해 주세요.');
  if (resumeSessionId !== '' && !isNativeSessionId(resumeSessionId)) throw new Error('이 앱에서 저장한 올바른 CLI 대화 ID가 필요합니다.');
  const memoryScript = fileURLToPath(new URL('./memory-mcp.mjs', import.meta.url)).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  if (provider === 'codex') {
    const extra = [...(modelId ? ['--model', modelId] : []), ...executionArguments(provider, { ...(reasoningEffort !== undefined ? { reasoningEffort } : {}), ...(speed !== undefined ? { speed } : {}) })];
    if (memory) {
      for (const [key, value] of Object.entries({ command: process.execPath, args: [memoryScript], env_vars: ['IMPERIUM_MEMORY_URL', 'IMPERIUM_MEMORY_TOKEN', 'ELECTRON_RUN_AS_NODE'], required: true })) {
        // JSON string/array literals are also valid TOML basic literals here.
        extra.push('-c', `mcp_servers.imperium_memory.${key}=${JSON.stringify(value)}`);
      }
    }
    // resume has no nested --sandbox option. Keep the same explicit sandbox on
    // the root command; never use --last/--all or discover other CLI sessions.
    if (resumeSessionId) return ['-a', 'never', '--sandbox', permission, ...extra, 'exec', 'resume', '--json', '--skip-git-repo-check', resumeSessionId.toLowerCase(), '-'];
    return ['-a', 'never', ...extra, 'exec', '--json', '--skip-git-repo-check', '--sandbox', permission, '-'];
  }
  if (provider === 'claude') {
    const tools = permission === 'read-only' ? 'Read,Glob,Grep' : 'Read,Glob,Grep,Edit,Write';
    // --tools limits the available set as well as --allowedTools pre-approving it.
    // Bash is deliberately absent, including in read-only mode.
    const extra = [...(modelId ? ['--model', modelId] : []), ...executionArguments(provider, { ...(reasoningEffort !== undefined ? { reasoningEffort } : {}), ...(speed !== undefined ? { speed } : {}) })];
    const memoryTools = memory ? ',mcp__imperium_memory__memory_search,mcp__imperium_memory__memory_get,mcp__imperium_memory__memory_list,mcp__imperium_memory__peer_tasks_list,mcp__imperium_memory__peer_task_get,mcp__imperium_memory__artifact_publish,mcp__imperium_memory__artifact_list,mcp__imperium_memory__artifact_get' : '';
    if (memory) extra.push('--strict-mcp-config', '--mcp-config', JSON.stringify({ mcpServers: { imperium_memory: { type: 'stdio', command: process.execPath, args: [memoryScript], env: { IMPERIUM_MEMORY_URL: '${IMPERIUM_MEMORY_URL}', IMPERIUM_MEMORY_TOKEN: '${IMPERIUM_MEMORY_TOKEN}', ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}) } } } }));
    return ['-p', ...(resumeSessionId ? ['--resume', resumeSessionId.toLowerCase()] : []), ...extra, '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--tools', tools, '--allowedTools', tools + memoryTools];
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
  let sessionId, reportedModel;
  let usage = { inputTokens: 0, outputTokens: 0 };
  const messageUsage = new Map();
  const observedSkillCalls = new Set();
  let lastAnonymousSkill = '';
  let legacyUsage = { inputTokens: 0, outputTokens: 0 };
  let finalUsageReported = false;
  const emit = (event) => notify(onEvent, event);
  const recordSession = value => {
    if (!isNativeSessionId(value)) return;
    const id = value.toLowerCase(); if (id === sessionId) return;
    sessionId = id; emit({ type: 'session', sessionId, source: 'cli-session' });
  };
  const recordModel = value => {
    if (typeof value !== 'string') return;
    const model = [...value.replace(/[\p{Cc}\u061C\u200B\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/gu, ' ').trim()].slice(0, 200).join('');
    if (!model || model === reportedModel) return;
    reportedModel = model; emit({ type: 'execution-model', model, source: 'cli' });
  };
  const recordSkill = (block, messageId, index) => {
    // Structured CLI invocation is observable, not proof of success. Never open
    // paths from model metadata or infer skills from command strings/thinking.
    if (provider !== 'claude' || block?.type !== 'tool_use') return;
    let rawName, source;
    if (block.name === 'Skill' && typeof block.input?.skill === 'string') { rawName = block.input.skill; source = 'cli-skill-call'; }
    if (block.name === 'Read' && typeof block.input?.file_path === 'string' && block.input.file_path.length <= 4096) {
      const parts = block.input.file_path.split(/[\\/]/), parent = parts.at(-2);
      if (parts.at(-1) === 'SKILL.md' && parent && !['.', '..'].includes(parent) && !/^[A-Za-z]:$/.test(parent)) { rawName = parent; source = 'cli-skill-read'; }
    }
    if (!source) return;
    const name = [...rawName.replace(/[\p{Cc}\u061C\u200B\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/gu, ' ').trim()].slice(0, 160).join('');
    if (!name) return;
    const key = typeof block.id === 'string' && block.id.length > 0 && block.id.length <= 512 ? `tool:${block.id}` : typeof messageId === 'string' && messageId.length > 0 && messageId.length <= 512 ? `message:${messageId}:${index}` : null;
    if (key) {
      if (observedSkillCalls.has(key)) return;
      observedSkillCalls.add(key);
      if (observedSkillCalls.size > 512) observedSkillCalls.delete(observedSkillCalls.values().next().value);
    } else { const signature = `${source}:${name}`; if (lastAnonymousSkill === signature) return; lastAnonymousSkill = signature; }
    emit({ type: 'skill', name, text: name, source, phase: 'invoked' });
  };
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
  const addUsage = (previous, next) => ({
    inputTokens: previous.inputTokens + next.inputTokens,
    outputTokens: previous.outputTokens + next.outputTokens,
    ...(previous.cachedInputTokens !== undefined || next.cachedInputTokens !== undefined ? { cachedInputTokens: (previous.cachedInputTokens || 0) + (next.cachedInputTokens || 0) } : {}),
    ...(previous.cacheWriteInputTokens !== undefined || next.cacheWriteInputTokens !== undefined ? { cacheWriteInputTokens: (previous.cacheWriteInputTokens || 0) + (next.cacheWriteInputTokens || 0) } : {}),
  });
  const recordUsage = (value, add = false, messageId) => {
    if (!value || typeof value !== 'object') return;
    if (provider === 'claude' && add && finalUsageReported) return;
    const cachedInputTokens = count(value.cached_input_tokens ?? value.cache_read_input_tokens);
    const cacheWriteInputTokens = count(value.cache_creation_input_tokens);
    const inputTokens = count(value.input_tokens ?? value.inputTokens) + (provider === 'claude' ? cachedInputTokens + cacheWriteInputTokens : 0);
    const outputTokens = count(value.output_tokens ?? value.outputTokens);
    const next = {
      inputTokens,
      outputTokens,
      ...(value.cached_input_tokens !== undefined || value.cache_read_input_tokens !== undefined ? { cachedInputTokens } : {}),
      ...(value.cache_creation_input_tokens !== undefined ? { cacheWriteInputTokens } : {}),
    };
    if (provider === 'claude' && add) {
      // Each content block may repeat cumulative usage for the same assistant message.
      // Keep its latest report so cancellation before a final result stays accurate.
      if (typeof messageId === 'string' && messageId) messageUsage.set(messageId, next);
      else legacyUsage = addUsage(legacyUsage, next);
      usage = [...messageUsage.values()].reduce(addUsage, legacyUsage);
    } else {
      usage = add ? addUsage(usage, next) : next;
      if (provider === 'claude') finalUsageReported = true;
    }
    emit({ type: 'usage', text: '토큰 사용량 갱신', ...usage });
  };
  function consume(event) {
    if (!event || typeof event !== 'object') return;
    if (provider === 'codex') {
      if (event.type === 'thread.started') { recordSession(event.thread_id); emit({ type: 'status', text: 'Codex 세션 연결' }); }
      recordModel(event.model);
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
    if (event.type === 'rate_limit_event' && event.rate_limit_info) { emit({ type: 'quota', quota: event.rate_limit_info }); return; }
    if (event.type === 'system' && event.subtype === 'init') { recordSession(event.session_id); recordModel(event.model); emit({ type: 'status', text: 'Claude 세션 연결' }); }
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
        // Stream starts usually have input: {}. Wait for the finalized assistant
        // tool_use unless a complete named call with a stable ID is already present.
        if (typeof delta.content_block.id === 'string' && delta.content_block.id) recordSkill(delta.content_block);
      }
    }
    if (event.type === 'assistant' && event.message) {
      for (const [index, block] of (Array.isArray(event.message.content) ? event.message.content : []).entries()) {
        if (!block || typeof block !== 'object') continue;
        if (block.type === 'text' && !streamedMessage) appendText(block.text);
        if (block.type === 'tool_use') emit({ type: 'tool', text: String(block.name || '도구 실행').slice(0, 1000) });
        recordSkill(block, event.message.id, index);
      }
      streamedMessage = false;
      recordUsage(event.message.usage, true, event.message.id);
    }
    if (event.type === 'result') {
      recordSession(event.session_id); recordModel(event.model);
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
  return { consume, state: () => ({ output: finalOutput || output, usage: { ...usage }, error, ...(sessionId ? { sessionId } : {}), ...(reportedModel ? { reportedModel } : {}) }) };
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
  if (!child || child.exitCode != null || child.signalCode != null) return;
  if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
      killer.on('error', () => { try { child.kill(); } catch {} });
      killer.on('close', (code) => { if (code) { try { child.kill(); } catch {} } });
    } catch { try { child.kill(); } catch {} }
  } else { try { child.kill('SIGTERM'); } catch {} }
}

// A direct child can exit while descendants still hold its output pipes open.
export function watchProviderChild(child, { spawnProcess, platform, signalProcessGroup, onClose }) {
  const pid = child.pid;
  let exited = false, done = false, cancelled = false, forceTimer, drainTimer;
  const signalGroup = signal => {
    if (platform === 'win32' || !signalProcessGroup || !Number.isSafeInteger(pid) || pid <= 1) return false;
    try { signalProcessGroup(-pid, signal); return true; } catch { return false; }
  };
  function finish(code, drainExpired = false) {
    if (done) return;
    done = true;
    clearTimeout(forceTimer);
    clearTimeout(drainTimer);
    if (cancelled || drainExpired) signalGroup('SIGKILL');
    if (drainExpired) {
      child.stdout.destroy();
      child.stderr.destroy();
    }
    onClose(code);
  }
  child.once('exit', code => {
    if (done) return;
    exited = true;
    clearTimeout(forceTimer);
    drainTimer = setTimeout(() => finish(code, true), 1000);
    drainTimer.unref?.();
  });
  child.once('close', code => finish(code));

  return () => {
    if (done || cancelled) return;
    cancelled = true;
    if (!exited) {
      forceTimer = setTimeout(() => {
        if (!signalGroup('SIGKILL') && child.exitCode == null && child.signalCode == null) {
          try { child.kill('SIGKILL'); } catch {}
        }
      }, 4000);
      forceTimer.unref?.();
    }
    if (!signalGroup('SIGTERM') && !exited) stopProcess(child, spawnProcess, platform);
  };
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
export function createProviderRunner({ spawnProcess = spawn, locate = locateProvider, platform = process.platform, signalProcessGroup = spawnProcess === spawn ? process.kill : undefined } = {}) {
  return async function run({ provider, prompt, cwd, permission = 'read-only', modelId = '', memory, reasoningEffort, speed, resumeSessionId, signal, onEvent, onExit }) {
    const args = providerArguments(provider, permission, { modelId, memory, reasoningEffort, speed, resumeSessionId });
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('작업 지시를 입력해 주세요.');
    signal?.throwIfAborted();
    const target = await locate(provider);
    signal?.throwIfAborted();
    if (!target) throw new Error(`${PROVIDERS[provider].name} CLI를 설치하고 로그인해 주세요.`);
    let child;
    let settled = false;
    let cancelled = false;
    let stderr = '', childError;
    let stopChild;
    const parser = createEventParser(provider, onEvent);
    const reader = createJsonLineReader(parser.consume, (text) => notify(onEvent, { type: 'status', text }));
    const finish = (code, processError) => {
      if (settled) return;
      settled = true;
      reader.end();
      const state = parser.state();
      const error = cancelled ? '작업이 취소되었습니다.' : processError || state.error || (code !== 0 ? stderr.trim() || `CLI가 종료 코드 ${code}로 종료되었습니다.` : undefined);
      notify(onExit, { code: cancelled ? 130 : error && code === 0 ? 1 : code, output: state.output, usage: state.usage, ...(state.sessionId ? { sessionId: state.sessionId } : {}), ...(state.reportedModel ? { reportedModel: state.reportedModel } : {}), ...(error ? { error: String(error).slice(0, 4000) } : {}) });
    };
    try {
      const environment = subscriptionEnvironment();
      if (provider === 'claude' && reasoningEffort && reasoningEffort !== 'default') {
        for (const key of Object.keys(environment)) if (key.toUpperCase() === 'CLAUDE_CODE_EFFORT_LEVEL') delete environment[key];
        environment.CLAUDE_CODE_EFFORT_LEVEL = reasoningEffort;
      }
      child = spawnProcess(target.command, [...target.prefix, ...args], {
        cwd, env: { ...environment, ...(memory ? { IMPERIUM_MEMORY_URL: memory.url, IMPERIUM_MEMORY_TOKEN: memory.token } : {}) }, shell: false, windowsHide: true, detached: platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => { if (!settled) reader.write(chunk); });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderr = boundedAppend(stderr, chunk, 8192); });
      child.on('error', (error) => { childError = `CLI를 실행하지 못했습니다: ${error.code || error.message}`; });
      stopChild = watchProviderChild(child, { spawnProcess, platform, signalProcessGroup, onClose: code => finish(code ?? (cancelled ? 130 : 1), childError) });
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
        stopChild();
      },
    };
  };
}

export const startProvider = createProviderRunner();
