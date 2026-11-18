import test from 'node:test';

test('Claude input totals include reported cache reads and writes while Codex totals do not count cache twice', () => {
  const claude = createEventParser('claude');
  claude.consume({ type: 'result', subtype: 'success', usage: { input_tokens: 7, cache_read_input_tokens: 100, cache_creation_input_tokens: 20, output_tokens: 5 } });
  assert.deepEqual(claude.state().usage, { inputTokens: 127, outputTokens: 5, cachedInputTokens: 100, cacheWriteInputTokens: 20 });
  const codex = createEventParser('codex');
  codex.consume({ type: 'turn.completed', usage: { input_tokens: 127, cached_input_tokens: 100, output_tokens: 5 } });
  assert.deepEqual(codex.state().usage, { inputTokens: 127, outputTokens: 5, cachedInputTokens: 100 });
});
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createEventParser, createJsonLineReader, createProviderRunner, providerArguments, subscriptionEnvironment, locateProvider } from '../lib/providers.mjs';

test('current Claude npm packages resolve both native binaries and the modern wrapper', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'imperium-provider-'));
  t.after(async () => { if (!path.resolve(root).startsWith(path.join(path.resolve(tmpdir()), 'imperium-provider-'))) throw new Error('Unexpected test path'); await rm(root, { recursive: true, force: true }); });
  const packageRoot = path.join(root, 'node_modules', '@anthropic-ai', 'claude-code');
  await mkdir(path.join(packageRoot, 'bin'), { recursive: true });
  const wrapper = path.join(packageRoot, 'cli-wrapper.cjs');
  await writeFile(wrapper, '// test fixture');
  assert.deepEqual(await locateProvider('claude', { searchDirectories: [root], platform: 'win32' }), { command: process.execPath, prefix: [wrapper] });
  const native = path.join(packageRoot, 'bin', 'claude.exe');
  await writeFile(native, 'test fixture');
  assert.deepEqual(await locateProvider('claude', { searchDirectories: [root], platform: 'win32' }), { command: native, prefix: [] });
});

test('subscription environment removes keys without changing the parent environment', () => {
  const env = { PATH: '/bin', OPENAI_API_KEY: 'secret', anthropic_api_key: 'secret', CLAUDE_CODE_OAUTH_TOKEN: 'secret', OPENAI_BASE_URL: 'https://example.test', KEEP: 'yes' };
  const result = subscriptionEnvironment(env);
  assert.equal(result.KEEP, 'yes');
  assert.ok(result.PATH.split(path.delimiter).includes('/bin'));
  for (const key of ['OPENAI_API_KEY', 'anthropic_api_key', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_BASE_URL']) assert.equal(result[key], undefined);
  assert.equal(env.OPENAI_API_KEY, 'secret');
});

test('JSON lines preserve split UTF-8 Hangul, ignore malformed lines, and flush the last line', () => {
  const values = [];
  const invalid = [];
  const reader = createJsonLineReader((value) => values.push(value), (text) => invalid.push(text));
  const bytes = Buffer.from('{"text":"본부 지시"}\nmalformed\n{"done":true}');
  for (const byte of bytes) reader.write(Buffer.from([byte]));
  reader.end();
  assert.deepEqual(values, [{ text: '본부 지시' }, { done: true }]);
  assert.equal(invalid.length, 1);
});

test('Codex parser emits final agent text, real tools, and usage with failure details', () => {
  const events = [];
  const parser = createEventParser('codex', (event) => events.push(event));
  parser.consume({ type: 'item.updated', item: { type: 'agent_message', text: '부분' } });
  parser.consume({ type: 'item.started', item: { type: 'command_execution', command: 'node --test' } });
  parser.consume({ type: 'item.completed', item: { type: 'agent_message', text: '검토 완료' } });
  parser.consume({ type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 6 } });
  parser.consume({ type: 'turn.failed', error: { message: '사용 한도 도달' } });
  assert.equal(parser.state().output, '검토 완료');
  assert.deepEqual(parser.state().usage, { inputTokens: 12, outputTokens: 6 });
  assert.equal(parser.state().error, '사용 한도 도달');
  assert.equal(events.filter((event) => event.type === 'text').length, 1);
  assert.equal(events.find((event) => event.type === 'tool').text, 'node --test');
});

test('Claude stream deltas and full assistant/result messages do not duplicate output', () => {
  const events = [];
  const parser = createEventParser('claude', (event) => events.push(event));
  parser.consume({ type: 'stream_event', event: { type: 'message_start' } });
  for (const text of ['개발 ', '완료']) parser.consume({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });
  parser.consume({ type: 'assistant', message: { content: [{ type: 'text', text: '개발 완료' }], usage: { input_tokens: 10, output_tokens: 2 } } });
  parser.consume({ type: 'result', subtype: 'success', result: '개발 완료', usage: { input_tokens: 10, output_tokens: 2 } });
  assert.equal(events.filter((event) => event.type === 'text').map((event) => event.text).join(''), '개발 완료');
  assert.equal(parser.state().output, '개발 완료');
  assert.deepEqual(parser.state().usage, { inputTokens: 10, outputTokens: 2 });
});

test('Claude result-only response is displayed and failures remain failures', () => {
  const events = [];
  const parser = createEventParser('claude', (event) => events.push(event));
  parser.consume({ type: 'result', subtype: 'error_max_turns', is_error: true, result: '허용 단계 초과' });
  assert.equal(parser.state().output, '허용 단계 초과');
  assert.equal(parser.state().error, '허용 단계 초과');
  assert.equal(events[0].type, 'text');
});

test('Claude repeated content blocks count the same assistant message once without a final result', () => {
  const events = [];
  const parser = createEventParser('claude', event => events.push(event));
  for (const content of [[{ type: 'tool_use', name: 'Read' }], [{ type: 'text', text: '검토했습니다.' }]]) {
    parser.consume({ type: 'assistant', message: { id: 'msg-one', content, usage: { input_tokens: 5000, output_tokens: 10 } } });
  }
  assert.deepEqual(parser.state().usage, { inputTokens: 5000, outputTokens: 10 });
  const reports = events.filter(event => event.type === 'usage');
  assert.deepEqual(reports.map(event => event.inputTokens + event.outputTokens), [5010, 5010]);
});

test('Claude cumulative message usage uses the latest report and adds distinct message IDs with cache totals', () => {
  const events = [];
  const parser = createEventParser('claude', event => events.push(event));
  const first = { input_tokens: 7, cache_read_input_tokens: 100, cache_creation_input_tokens: 20, output_tokens: 20 };
  parser.consume({ type: 'assistant', message: { id: 'msg-one', content: [], usage: first } });
  parser.consume({ type: 'assistant', message: { id: 'msg-one', content: [], usage: { ...first, output_tokens: 30 } } });
  assert.deepEqual(parser.state().usage, { inputTokens: 127, outputTokens: 30, cachedInputTokens: 100, cacheWriteInputTokens: 20 });
  parser.consume({ type: 'assistant', message: { id: 'msg-two', content: [], usage: { input_tokens: 50, output_tokens: 8 } } });
  assert.deepEqual(parser.state().usage, { inputTokens: 177, outputTokens: 38, cachedInputTokens: 100, cacheWriteInputTokens: 20 });
  const reports = events.filter(event => event.type === 'usage');
  assert.deepEqual(reports.map(event => [event.inputTokens, event.outputTokens]), [[127, 20], [127, 30], [177, 38]]);
});

test('Claude final result usage replaces message totals and remains authoritative for late assistant reports', () => {
  const events = [];
  const parser = createEventParser('claude', event => events.push(event));
  for (const id of ['msg-one', 'msg-two']) parser.consume({ type: 'assistant', message: { id, content: [], usage: { input_tokens: 5000, output_tokens: 10 } } });
  parser.consume({ type: 'result', subtype: 'success', usage: { input_tokens: 9000, cache_read_input_tokens: 200, cache_creation_input_tokens: 30, output_tokens: 25 } });
  const expected = { inputTokens: 9230, outputTokens: 25, cachedInputTokens: 200, cacheWriteInputTokens: 30 };
  assert.deepEqual(parser.state().usage, expected);
  parser.consume({ type: 'assistant', message: { id: 'msg-two', content: [], usage: { input_tokens: 5000, output_tokens: 99 } } });
  assert.deepEqual(parser.state().usage, expected);
  const finalEvent = events.filter(event => event.type === 'usage').at(-1);
  for (const [key, value] of Object.entries(expected)) assert.equal(finalEvent[key], value);
});

test('Claude older messages without IDs remain additive alongside deduplicated messages', () => {
  const parser = createEventParser('claude');
  const keyed = { id: 'msg-one', content: [], usage: { input_tokens: 20, output_tokens: 3 } };
  parser.consume({ type: 'assistant', message: keyed });
  parser.consume({ type: 'assistant', message: { content: [], usage: { input_tokens: 4, cache_read_input_tokens: 10, output_tokens: 2 } } });
  parser.consume({ type: 'assistant', message: { content: [], usage: { input_tokens: 5, output_tokens: 1 } } });
  parser.consume({ type: 'assistant', message: keyed });
  parser.consume({ type: 'result', subtype: 'error_max_turns', is_error: true });
  assert.deepEqual(parser.state().usage, { inputTokens: 39, outputTokens: 6, cachedInputTokens: 10 });
});

test('permissions restrict available Claude tools and never bypass Codex sandbox', () => {
  const readOnly = providerArguments('claude', 'read-only');
  assert.equal(readOnly[readOnly.indexOf('--tools') + 1], 'Read,Glob,Grep');
  const writable = providerArguments('claude', 'workspace-write');
  assert.equal(writable[writable.indexOf('--tools') + 1], 'Read,Glob,Grep,Edit,Write');
  assert.ok(!writable.includes('Bash'));
  assert.deepEqual(providerArguments('codex', 'read-only').slice(-3), ['--sandbox', 'read-only', '-']);
  assert.throws(() => providerArguments('codex', 'danger-full-access'));
});

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.pid = 12345;
  child.exitCode = null;
  child.killCalls = 0;
  child.kill = () => { child.killCalls += 1; child.emit('close', null); return true; };
  return child;
}

test('Claude cancellation and crashes retain deduplicated latest usage when no final result arrives', async () => {
  for (const cancel of [true, false]) {
    const child = fakeChild(), exits = [];
    const run = createProviderRunner({ locate: async () => ({ command: '/mock/claude', prefix: [] }), spawnProcess: () => child, platform: 'linux' });
    const handle = await run({ provider: 'claude', prompt: '독립 검토', onExit: event => exits.push(event) });
    for (const output_tokens of [20, 30]) {
      child.stdout.write(JSON.stringify({ type: 'assistant', message: { id: 'msg-one', content: [], usage: { input_tokens: 5000, output_tokens } } }) + '\n');
    }
    if (cancel) handle.cancel();
    else child.emit('error', Object.assign(new Error('mock crash'), { code: 'ECONNRESET' }));
    child.emit('close', 1);
    assert.equal(exits.length, 1);
    assert.equal(exits[0].code, cancel ? 130 : 1);
    assert.deepEqual(exits[0].usage, { inputTokens: 5000, outputTokens: 30 });
  }
});

test('prompts with shell characters and Hangul spaces go through stdin with shell disabled', async () => {
  const child = fakeChild();
  const invocations = [];
  const exits = [];
  let input = '';
  child.stdin.setEncoding('utf8');
  child.stdin.on('data', (chunk) => { input += chunk; });
  const run = createProviderRunner({
    locate: async () => ({ command: 'C:\\Program Files\\node.exe', prefix: ['C:\\한글 폴더\\codex.js'] }),
    spawnProcess: (...args) => { invocations.push(args); return child; }, platform: 'linux',
  });
  const prompt = '본부 지시 " & del X; $(whoami) `echo unsafe`\n다음 줄';
  await run({ provider: 'codex', prompt, cwd: 'C:\\프로젝트 폴더', onExit: (event) => exits.push(event) });
  assert.equal(input, prompt);
  assert.equal(invocations[0][2].shell, false);
  assert.equal(invocations[0][2].cwd, 'C:\\프로젝트 폴더');
  assert.equal(invocations[0][1][0], 'C:\\한글 폴더\\codex.js');
  assert.ok(!invocations[0][1].includes(prompt));
  child.stdout.write(Buffer.from('{"type":"item.completed","item":{"type":"agent_message","text":"완료"}}'));
  child.emit('close', 0);
  assert.equal(exits[0].output, '완료');
  assert.equal(exits[0].code, 0);
});

test('cancellation and repeated process events finish only once', async () => {
  const child = fakeChild();
  const exits = [];
  const run = createProviderRunner({ locate: async () => ({ command: '/bin/codex', prefix: [] }), spawnProcess: () => child, platform: 'linux' });
  const handle = await run({ provider: 'codex', prompt: '상태 확인', onExit: (event) => exits.push(event) });
  handle.cancel();
  handle.cancel();
  child.emit('error', Object.assign(new Error('late event'), { code: 'ECANCELED' }));
  child.emit('close', 0);
  assert.equal(child.killCalls, 1);
  assert.equal(exits.length, 1);
  assert.equal(exits[0].code, 130);
});

test('spawn failure becomes one actionable exit without throwing from event handlers', async () => {
  const child = fakeChild();
  const exits = [];
  const run = createProviderRunner({ locate: async () => ({ command: '/missing/claude', prefix: [] }), spawnProcess: () => child });
  await run({ provider: 'claude', prompt: '검토', onExit: (event) => exits.push(event) });
  child.emit('error', Object.assign(new Error('not found'), { code: 'ENOENT' }));
  child.emit('close', -2);
  assert.equal(exits.length, 1);
  assert.match(exits[0].error, /ENOENT/);
});

test('Windows cancellation terminates the numeric process tree without invoking a shell', async () => {
  const child = fakeChild();
  const killer = new EventEmitter();
  const calls = [];
  const exits = [];
  const run = createProviderRunner({
    locate: async () => ({ command: 'C:\\claude.exe', prefix: [] }), platform: 'win32',
    spawnProcess: (...args) => { calls.push(args); return calls.length === 1 ? child : killer; },
  });
  const handle = await run({ provider: 'claude', prompt: '중단 확인', onExit: (event) => exits.push(event) });
  handle.cancel();
  assert.equal(calls[1][0], 'taskkill.exe');
  assert.deepEqual(calls[1][1], ['/PID', '12345', '/T', '/F']);
  assert.equal(calls[1][2].shell, false);
  killer.emit('close', 0);
  child.emit('close', null);
  assert.equal(exits.length, 1);
  assert.equal(exits[0].code, 130);
});
