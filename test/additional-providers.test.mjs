import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir, tmpdir } from 'node:os';
import {
  additionalEnvironment, additionalProviderArguments, createAdditionalDetector,
  createAdditionalEventParser, createAdditionalProviderRunner, prepareGeminiContext, probeCopilotAuth,
  windowsCommandLineLength,
} from '../lib/additional-providers.mjs';

const settle = async () => { for (let turn = 0; turn < 5; turn++) await new Promise(resolve => setImmediate(resolve)); };
function childProcess() {
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.pid = 23456; child.exitCode = null; child.kills = 0;
  child.kill = () => { child.kills++; child.emit('close', null); return true; };
  return child;
}
const help = '--approval-mode --admin-policy --output-format --available-tools --deny-tool --disable-builtin-mcps';
const target = { command: 'C:\\Program Files\\node.exe', prefix: ['C:\\한글 CLI\\entry.js'] };
const mockContext = () => Promise.resolve({ env: { PATH: '/bin', GEMINI_CLI_SYSTEM_SETTINGS_PATH: '/mock/settings.json' }, policyPath: '/mock/read-only.toml', cleanup: async () => {} });
const jsonResponse = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });

test('additional provider environment preserves account login and removes API/token overrides', () => {
  const original = { PATH: '/bin', GEMINI_API_KEY: 'hidden', GOOGLE_API_KEY: 'hidden', GOOGLE_GENAI_USE_VERTEXAI: 'true', GOOGLE_APPLICATION_CREDENTIALS: 'hidden', COPILOT_GITHUB_TOKEN: 'hidden', GITHUB_TOKEN: 'hidden', GH_TOKEN: 'hidden', OPENAI_API_KEY: 'hidden', GEMINI_CLI_SYSTEM_SETTINGS_PATH: '/old/settings.json', KEEP: 'yes' };
  const result = additionalEnvironment(original);
  assert.equal(result.KEEP, 'yes');
  const directories = result.PATH.split(path.delimiter);
  assert.equal(directories[0], '/bin', 'the caller path retains its original precedence');
  const additions = process.platform === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin', path.join(homedir(), '.local', 'bin')] : [];
  assert.deepEqual(directories, [...new Set(['/bin', ...additions])], 'only the documented macOS CLI search locations are appended');
  for (const key of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI', 'GOOGLE_APPLICATION_CREDENTIALS', 'COPILOT_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'OPENAI_API_KEY', 'GEMINI_CLI_SYSTEM_SETTINGS_PATH']) assert.equal(result[key], undefined);
  assert.equal(original.GEMINI_API_KEY, 'hidden', 'parent environment is never mutated');
});

test('additional adapters reject file writing and enforce a real Copilot read-only tool list', () => {
  for (const provider of ['gemini', 'copilot', 'ollama']) assert.throws(() => additionalProviderArguments(provider, { permission: 'workspace-write' }), /읽기 전용/);
  const args = additionalProviderArguments('copilot', { prompt: '검토', modelId: 'claude-sonnet-test' });
  assert.equal(args[args.indexOf('--available-tools') + 1], 'view,glob,grep');
  assert.equal(args[args.indexOf('--deny-tool') + 1], 'shell,write,url,memory');
  assert.ok(args.includes('--disable-builtin-mcps'));
  assert.ok(!args.some(arg => /allow-all|yolo/.test(arg)));
  assert.throws(() => additionalProviderArguments('copilot', { modelId: '--allow-all' }), /모델 ID/);
});

test('Gemini gets a temporary OAuth-only configuration and an administrator deny-by-default policy', async t => {
  const systemDirectory = await mkdtemp(path.join(tmpdir(), 'imperium-test-gemini-system-'));
  t.after(() => rmdir(systemDirectory));
  const context = await prepareGeminiContext({ systemDirectory });
  t.after(context.cleanup);
  const settings = JSON.parse(await readFile(context.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH, 'utf8'));
  assert.deepEqual(settings.security.auth, { selectedType: 'oauth-personal', enforcedType: 'oauth-personal', useExternal: false });
  assert.equal(settings.hooksConfig.enabled, false);
  assert.equal(settings.admin.mcp.enabled, false); assert.equal(settings.admin.extensions.enabled, false);
  assert.equal(settings.advanced.ignoreLocalEnv, true);
  assert.ok(!settings.tools.core.includes('run_shell_command'));
  const policy = await readFile(context.policyPath, 'utf8');
  assert.match(policy, /toolName = "\*"\ndecision = "deny"\npriority = 998/);
  assert.match(policy, /toolName = "read_file"\ndecision = "allow"\npriority = 999/);
  assert.ok(!policy.includes('toolName = "run_shell_command"\ndecision = "allow"'));
  const args = additionalProviderArguments('gemini', { policyPath: context.policyPath });
  assert.deepEqual(args.slice(2, 6), ['--approval-mode', 'plan', '--admin-policy', context.policyPath]);
});

test('Gemini refuses to replace existing central administrator settings', async t => {
  const systemDirectory = await mkdtemp(path.join(tmpdir(), 'imperium-test-managed-gemini-'));
  const settings = path.join(systemDirectory, 'settings.json');
  await writeFile(settings, '{"admin":{"secureModeEnabled":true}}');
  t.after(async () => { await rm(settings); await rmdir(systemDirectory); });
  await assert.rejects(prepareGeminiContext({ systemDirectory }), /중앙 관리 설정/);
  assert.equal(await readFile(settings, 'utf8'), '{"admin":{"secureModeEnabled":true}}');
});

function rpcAuthChild(status) {
  const child = childProcess(); const methods = []; let input = Buffer.alloc(0);
  child.stdin.on('data', chunk => {
    input = Buffer.concat([input, chunk]);
    for (;;) {
      const boundary = input.indexOf('\r\n\r\n'); if (boundary < 0) return;
      const length = Number(/Content-Length: (\d+)/.exec(input.subarray(0, boundary).toString())[1]);
      if (input.length < boundary + 4 + length) return;
      const request = JSON.parse(input.subarray(boundary + 4, boundary + 4 + length).toString('utf8'));
      input = input.subarray(boundary + 4 + length); methods.push(request.method);
      const result = request.method === 'connect' ? { protocolVersion: 3 } : status;
      const payload = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
      const framed = Buffer.concat([Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`), payload]);
      setImmediate(() => { child.stdout.write(framed.subarray(0, 13)); child.stdout.write(framed.subarray(13)); });
    }
  });
  return { child, methods };
}

test('Copilot authentication uses only credential-free RPC and handles fragmented byte-framed messages', async () => {
  const { child, methods } = rpcAuthChild({ isAuthenticated: true, authType: 'user', activeLogin: '테스트 사용자' });
  const authenticated = await probeCopilotAuth(target, { spawnProcess: () => child, platform: 'linux' });
  assert.equal(authenticated, true);
  assert.deepEqual(methods, ['connect', 'auth.getStatus']);
  assert.equal(child.kills, 1);
});

test('Copilot never treats unknown status or API-key authentication as a subscription login', async () => {
  for (const status of [{}, { isAuthenticated: false }, { isAuthenticated: true, authType: 'api-key' }]) {
    const { child } = rpcAuthChild(status);
    assert.equal(await probeCopilotAuth(target, { spawnProcess: () => child, platform: 'linux' }), false);
  }
});

test('provider detection requires actual auth evidence and only lists installed local Ollama models', async () => {
  let cleaned = 0; const calls = [];
  const detect = createAdditionalDetector({
    locate: async id => id === 'ollama' ? null : target,
    probe: async (_target, args) => { calls.push(args); return { code: 0, stdout: args[0] === '--version' ? 'test-cli 1.2' : '[{"modelId":"gemini-test"}]', stderr: '' }; },
    copilotAuth: async () => true,
    prepareGemini: async () => ({ ...await mockContext(), cleanup: async () => { cleaned++; } }),
    fetchImpl: async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:11434/api/tags'); assert.equal(options.redirect, 'error');
      return jsonResponse({ models: [{ name: 'test-local:8b' }, { name: 'remote:cloud' }, { name: 'remote-alias', remote_host: 'https://example.test' }] });
    },
  });
  const providers = await detect();
  assert.ok(providers.every(provider => provider.authenticated && provider.status === 'ready'));
  assert.deepEqual(providers.find(provider => provider.id === 'ollama').models, ['test-local:8b']);
  assert.deepEqual(calls.find(args => args[0] === 'models'), ['models', 'list', '--output-format', 'json']);
  assert.equal(cleaned, 1);
  const unverified = await createAdditionalDetector({ locate: async () => target, probe: async () => ({ code: 0, stdout: '[]', stderr: '' }), copilotAuth: async () => undefined, prepareGemini: mockContext, fetchImpl: async () => jsonResponse({ models: [] }) })();
  assert.ok(unverified.every(provider => !provider.authenticated && provider.status !== 'ready'));
});

test('Gemini and Copilot event streams expose text, real tool events and token counts without duplicate deltas', () => {
  const events = [];
  const gemini = createAdditionalEventParser('gemini', event => events.push(event));
  gemini.consume({ type: 'message', role: 'user', content: 'do not show this as output' });
  gemini.consume({ type: 'message', role: 'assistant', content: '분석 ', delta: true });
  gemini.consume({ type: 'message', role: 'assistant', content: '완료', delta: true });
  gemini.consume({ type: 'tool_use', tool_name: 'read_file' });
  gemini.consume({ type: 'result', status: 'success', stats: { input_tokens: 7, output_tokens: 3 } });
  assert.equal(gemini.state().output, '분석 완료'); assert.deepEqual(gemini.state().usage, { inputTokens: 7, outputTokens: 3 });
  assert.equal(events.find(event => event.type === 'tool').text, 'read_file');
  const copilot = createAdditionalEventParser('copilot');
  copilot.consume({ type: 'assistant.message_delta', data: { deltaContent: '검토 완료' } });
  copilot.consume({ type: 'assistant.message', data: { content: '검토 완료' } });
  copilot.consume({ type: 'assistant.usage', data: { inputTokens: 9, outputTokens: 4 } });
  assert.equal(copilot.state().output, '검토 완료'); assert.deepEqual(copilot.state().usage, { inputTokens: 9, outputTokens: 4 });
});

test('shell characters remain exact prompt data for Copilot; cancellation exits once', async () => {
  const child = childProcess(); const calls = []; const exits = [];
  const prompt = '한글 " & $(whoami) ; `echo unsafe`\n다음 줄';
  const run = createAdditionalProviderRunner({ locate: async () => target, probe: async () => ({ code: 0, stdout: help, stderr: '' }), spawnProcess: (...args) => { calls.push(args); return child; }, platform: 'linux' });
  const handle = await run({ provider: 'copilot', prompt, cwd: 'C:\\한글 작업 폴더', modelId: 'model-test', onExit: value => exits.push(value) });
  assert.equal(calls[0][2].shell, false); assert.equal(calls[0][2].cwd, 'C:\\한글 작업 폴더');
  assert.equal(calls[0][1].at(-1), prompt); assert.equal(calls[0][1].at(-2), '-p');
  handle.cancel(); handle.cancel(); child.emit('close', 0);
  assert.equal(exits.length, 1); assert.equal(exits[0].code, 130); assert.equal(child.kills, 1);
});

test('Windows command length counts executable, separators, exact libuv escaping and UTF-16 units', () => {
  // Expected serialized strings include argv0, spaces and the terminating NUL.
  const examples = [
    [[], 'cli.exe'],
    [[''], 'cli.exe ""'],
    [['plain', '한글😀'], 'cli.exe plain 한글😀'],
    [['hello world'], 'cli.exe "hello world"'],
    [['hello\tworld'], 'cli.exe "hello\tworld"'],
    [['hello\nworld'], 'cli.exe hello\nworld'],
    [['hello"world'], String.raw`cli.exe "hello\"world"`],
    [[String.raw`hello\world`], String.raw`cli.exe hello\world`],
    [[String.raw`hello\"world`], String.raw`cli.exe "hello\\\"world"`],
    [[String.raw`hello\\"world`], String.raw`cli.exe "hello\\\\\"world"`],
    [['hello world\\'], String.raw`cli.exe "hello world\\"`],
  ];
  for (const [args, serialized] of examples) assert.equal(windowsCommandLineLength('cli.exe', args), serialized.length + 1, JSON.stringify(args));
  assert.equal(windowsCommandLineLength('C:\\Program Files\\node.exe', ['C:\\한글 CLI\\entry.js', '-p', '😀']), '"C:\\Program Files\\node.exe" "C:\\한글 CLI\\entry.js" -p 😀'.length + 1);
});

test('Copilot refuses oversized Windows command lines before any probe/spawn without truncating the prompt', async () => {
  let probes = 0, spawned = 0;
  const run = createAdditionalProviderRunner({
    locate: async () => target, platform: 'win32',
    probe: async () => { probes++; return { code: 0, stdout: help, stderr: '' }; },
    spawnProcess: () => { spawned++; return childProcess(); },
  });
  for (const prompt of ['a'.repeat(30000), '"'.repeat(15000), String.raw` \"`.repeat(7500), '😀'.repeat(15000)]) {
    const args = additionalProviderArguments('copilot', { prompt });
    const expectedLength = windowsCommandLineLength(target.command, [...target.prefix, ...args]);
    assert.ok(expectedLength > 30000);
    const original = prompt;
    await assert.rejects(run({ provider: 'copilot', prompt }), error => {
      assert.match(error.message, /Windows.*30,000/);
      assert.ok(error.message.includes(expectedLength.toLocaleString('ko-KR')));
      assert.match(error.message, /작업 지시/);
      assert.match(error.message, /기억·선행 부서 출력을 줄여/);
      return true;
    });
    assert.equal(prompt, original);
  }
  assert.equal(probes, 0);
  assert.equal(spawned, 0);
});

test('Copilot accepts the exact Windows budget and retains its original prompt argument and empty stdin', async () => {
  const seed = '한글 😀 "검토" & $(whoami) \tC:\\폴더\\';
  const ordinaryArgs = additionalProviderArguments('copilot', { prompt: seed, modelId: 'model-test' });
  const allowance = 30000 - windowsCommandLineLength(target.command, [...target.prefix, ...ordinaryArgs]);
  const prompt = seed.slice(0, -1) + 'a'.repeat(allowance) + seed.slice(-1);
  const child = childProcess(), calls = [], exits = [];
  let stdin = '';
  child.stdin.on('data', chunk => { stdin += chunk.toString('utf8'); });
  const run = createAdditionalProviderRunner({
    locate: async () => target, platform: 'win32',
    probe: async () => ({ code: 0, stdout: help, stderr: '' }),
    spawnProcess: (...args) => { calls.push(args); return child; },
  });
  await run({ provider: 'copilot', prompt, modelId: 'model-test', onExit: value => exits.push(value) });
  assert.equal(calls.length, 1);
  assert.equal(windowsCommandLineLength(calls[0][0], calls[0][1]), 30000);
  assert.equal(calls[0][1].at(-2), '-p');
  assert.equal(calls[0][1].at(-1), prompt);
  assert.equal(calls[0][2].shell, false);
  assert.equal(calls[0][2].windowsVerbatimArguments, undefined);
  assert.equal(child.stdin.writableEnded, true);
  assert.equal(stdin, '');
  child.emit('close', 0);
  assert.equal(exits[0].code, 0);
  await assert.rejects(run({ provider: 'copilot', prompt: `a${prompt}`, modelId: 'model-test' }), /30,000/);
  assert.equal(calls.length, 1);
});

test('Gemini sends its prompt through stdin and cleans its process-only policy after completion', async () => {
  const child = childProcess(); let input = '', cleaned = 0; const exits = [];
  child.stdin.on('data', chunk => { input += chunk.toString('utf8'); });
  const run = createAdditionalProviderRunner({ locate: async () => target, probe: async () => ({ code: 0, stdout: help, stderr: '' }), prepareGemini: async () => ({ ...await mockContext(), cleanup: async () => { cleaned++; } }), spawnProcess: () => child });
  await run({ provider: 'gemini', prompt: '개발 계획을 검토해줘.', onExit: value => exits.push(value) });
  assert.equal(input, '개발 계획을 검토해줘.');
  child.stdout.write('{"type":"message","role":"assistant","content":"완료"}\n');
  child.stdout.write('{"type":"result","status":"success"}'); child.emit('close', 0);
  assert.equal(exits[0].output, '완료'); assert.equal(exits[0].code, 0); assert.equal(cleaned, 1);
});

test('older CLIs fail before inference when safe tool restriction flags are unavailable', async () => {
  let spawned = 0;
  const run = createAdditionalProviderRunner({ locate: async () => target, probe: async () => ({ code: 0, stdout: '--help --version', stderr: '' }), spawnProcess: () => { spawned++; return childProcess(); } });
  await assert.rejects(run({ provider: 'copilot', prompt: '읽기 전용 검토' }), /읽기 전용 옵션/);
  await assert.rejects(run({ provider: 'gemini', prompt: '읽기 전용 검토' }), /읽기 전용 옵션/);
  assert.equal(spawned, 0);
});

test('Ollama streams an installed local model through fixed loopback and records actual counts', async () => {
  const calls = []; const exits = []; const events = [];
  const body = Buffer.from('{"response":"안녕 ","done":false}\n{"response":"본부","done":true,"prompt_eval_count":11,"eval_count":2}\n');
  const run = createAdditionalProviderRunner({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/api/tags')) return jsonResponse({ models: [{ name: 'local-test:8b' }] });
      return new Response(new ReadableStream({ start(controller) { for (const byte of body) controller.enqueue(Uint8Array.of(byte)); controller.close(); } }));
    },
  });
  await run({ provider: 'ollama', prompt: '안녕', modelId: 'local-test:8b', onEvent: event => events.push(event), onExit: result => exits.push(result) });
  await settle();
  assert.deepEqual(calls.map(call => call.url), ['http://127.0.0.1:11434/api/tags', 'http://127.0.0.1:11434/api/generate']);
  assert.deepEqual(JSON.parse(calls[1].options.body), { model: 'local-test:8b', prompt: '안녕', stream: true });
  assert.equal(calls[1].options.redirect, 'error');
  assert.equal(exits.length, 1); assert.equal(exits[0].code, 0); assert.equal(exits[0].output, '안녕 본부');
  assert.deepEqual(exits[0].usage, { inputTokens: 11, outputTokens: 2 });
  assert.equal(events.filter(event => event.type === 'text').map(event => event.text).join(''), '안녕 본부');
});

test('Ollama refuses cloud aliases and models that were not returned by the local service', async () => {
  let generations = 0;
  const run = createAdditionalProviderRunner({ fetchImpl: async url => { assert.ok(url.startsWith('http://127.0.0.1:11434/')); if (url.endsWith('/api/generate')) generations++; return jsonResponse({ models: [{ name: 'remote:cloud' }, { name: 'gpt-oss:120b-cloud' }, { name: 'remote-alias', remote_model: 'private-proxy' }, { name: 'safe:8b' }] }); } });
  await assert.rejects(run({ provider: 'ollama', prompt: '읽기', modelId: 'remote:cloud' }), /설치된 로컬 모델/);
  await assert.rejects(run({ provider: 'ollama', prompt: '읽기', modelId: 'gpt-oss:120b-cloud' }), /설치된 로컬 모델/);
  await assert.rejects(run({ provider: 'ollama', prompt: '읽기', modelId: 'remote-alias' }), /설치된 로컬 모델/);
  await assert.rejects(run({ provider: 'ollama', prompt: '읽기', modelId: 'not-installed:8b' }), /설치된 로컬 모델/);
  assert.equal(generations, 0);
});

test('Ollama marks truncated streams as failures and cancellation aborts a pending generation once', async () => {
  const truncated = [];
  const run = createAdditionalProviderRunner({ fetchImpl: async url => url.endsWith('/api/tags') ? jsonResponse({ models: [{ name: 'local:8b' }] }) : new Response('{"response":"partial","done":false}\n') });
  await run({ provider: 'ollama', prompt: '읽기', onExit: result => truncated.push(result) }); await settle();
  assert.equal(truncated[0].code, 1); assert.match(truncated[0].error, /완료되기 전/);
  const exits = []; let signal;
  const cancelRun = createAdditionalProviderRunner({ fetchImpl: async (url, options) => {
    if (url.endsWith('/api/tags')) return jsonResponse({ models: [{ name: 'local:8b' }] });
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
  } });
  const handle = await cancelRun({ provider: 'ollama', prompt: '읽기', onExit: result => exits.push(result) });
  handle.cancel(); handle.cancel(); await settle();
  assert.equal(signal.aborted, true); assert.equal(exits.length, 1); assert.equal(exits[0].code, 130);
});

test('Windows cancellation uses one numeric process-tree termination without a shell', async () => {
  const child = childProcess(); const killer = new EventEmitter(); const calls = []; const exits = [];
  const run = createAdditionalProviderRunner({
    locate: async () => target, probe: async () => ({ code: 0, stdout: help, stderr: '' }), platform: 'win32',
    spawnProcess: (...args) => { calls.push(args); return calls.length === 1 ? child : killer; },
  });
  const handle = await run({ provider: 'copilot', prompt: '상태 확인', onExit: result => exits.push(result) });
  handle.cancel(); handle.cancel();
  assert.deepEqual(calls[1][1], ['/PID', '23456', '/T', '/F']);
  assert.equal(calls[1][2].shell, false);
  killer.emit('close', 0); child.emit('close', null); child.emit('close', 0);
  assert.equal(exits.length, 1); assert.equal(exits[0].code, 130);
});

test('invalid CLI JSON and spawn failures cannot become successful empty tasks', async () => {
  for (const failure of ['json', 'spawn']) {
    const child = childProcess(); const exits = [];
    const run = createAdditionalProviderRunner({ locate: async () => target, probe: async () => ({ code: 0, stdout: help, stderr: '' }), spawnProcess: () => child });
    await run({ provider: 'copilot', prompt: '검토', onExit: result => exits.push(result) });
    if (failure === 'json') child.stdout.write('not a JSON event\n');
    else child.emit('error', Object.assign(new Error('missing executable'), { code: 'ENOENT' }));
    child.emit('close', 0);
    assert.equal(exits.length, 1); assert.equal(exits[0].code, 1);
    assert.ok(exits[0].error);
  }
});
