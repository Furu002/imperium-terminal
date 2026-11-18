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
import { createEventParser, createJsonLineReader, createProviderRunner, providerArguments, subscriptionEnvironment, locateProvider, isNativeSessionId } from '../lib/providers.mjs';

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

test('Claude records named Skill invocations once across stream/final messages, without claiming success', () => {
  const events = [], parser = createEventParser('claude', event => events.push(event));
  const block = { type: 'tool_use', id: 'skill-call-1', name: 'Skill', input: { skill: '문서 검토', args: 'PRIVATE_ARGS' } };
  parser.consume({ type: 'stream_event', event: { type: 'content_block_start', content_block: { ...block, input: {} } } });
  assert.equal(events.filter(event => event.type === 'skill').length, 0);
  parser.consume({ type: 'assistant', message: { id: 'message-1', content: [block] } });
  parser.consume({ type: 'assistant', message: { id: 'message-1', content: [block] } });
  const other = { ...block, id: 'skill-call-2' };
  parser.consume({ type: 'stream_event', event: { type: 'content_block_start', content_block: other } });
  parser.consume({ type: 'assistant', message: { id: 'message-2', content: [other] } });
  assert.deepEqual(events.filter(event => event.type === 'skill'), [1, 2].map(() => ({ type: 'skill', name: '문서 검토', text: '문서 검토', source: 'cli-skill-call', phase: 'invoked' })));
  assert.ok(!JSON.stringify(events).includes('PRIVATE_ARGS')); assert.equal(parser.state().output, '');
});

test('Claude skill document observations use only structured Read basenames on Windows and POSIX', () => {
  const events = [], parser = createEventParser('claude', event => events.push(event));
  for (const [index, file_path] of ['/workspace/.claude/skills/review/SKILL.md', 'C:\\Users\\user\\skills\\문서 검토\\SKILL.md'].entries()) {
    const block = { type: 'tool_use', id: `read-${index}`, name: 'Read', input: { file_path } };
    parser.consume({ type: 'stream_event', event: { type: 'content_block_start', content_block: { ...block, input: {} } } });
    parser.consume({ type: 'assistant', message: { id: `read-message-${index}`, content: [block] } });
    parser.consume({ type: 'assistant', message: { id: `read-message-${index}`, content: [block] } });
  }
  assert.deepEqual(events.filter(event => event.type === 'skill').map(event => [event.name, event.source, event.phase]), [['review', 'cli-skill-read', 'invoked'], ['문서 검토', 'cli-skill-read', 'invoked']]);
  assert.ok(!JSON.stringify(events).includes('/workspace/')); assert.ok(!JSON.stringify(events).includes('C:\\Users'));
  for (const file_path of ['/SKILL.md', 'C:\\SKILL.md', '/skills/review/OTHER.md', '/skills/review/SKILL.md.bak', '/skills/review/SKILL.md/', '/skills/review/skill.md', '/skills/../SKILL.md']) parser.consume({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path } }] } });
  assert.equal(events.filter(event => event.type === 'skill').length, 2);
});

test('skill observers bound names and replay state while ignoring prose, other tools, hidden thoughts and Codex commands', () => {
  const events = [], parser = createEventParser('claude', event => events.push(event));
  assert.doesNotThrow(() => { parser.consume({ type: 'assistant', message: { content: 'Skill: pretend' } }); parser.consume({ type: 'assistant', message: { content: [null, 1] } }); });
  for (const block of [
    { type: 'thinking', name: 'Skill', input: { skill: 'PRIVATE' }, thinking: 'PRIVATE' },
    { type: 'tool_use', name: 'Bash', input: { command: 'cat /skills/pretend/SKILL.md', skill: 'pretend' } },
    { type: 'tool_use', name: 'Skill', input: { skill: {} } },
    { type: 'tool_use', name: 'Skill', input: { skill: '\u0000\u202e' } },
    { type: 'tool_result', name: 'Skill', input: { skill: 'pretend' } },
  ]) parser.consume({ type: 'assistant', message: { content: [block] } });
  parser.consume({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'PRIVATE Skill: pretend' } } });
  assert.equal(events.filter(event => event.type === 'skill').length, 0); assert.ok(!JSON.stringify(events).includes('PRIVATE'));
  parser.consume({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'bounded', name: 'Skill', input: { skill: `\u0000\u001b\u202e${'🙂'.repeat(180)}`, source: 'model-reported', phase: 'completed' } }] } });
  assert.equal(events.find(event => event.type === 'skill').name, '🙂'.repeat(160));
  for (let index = 0; index < 600; index++) parser.consume({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `call-${index}`, name: 'Skill', input: { skill: 'repeated-real-call' } }] } });
  const count = events.filter(event => event.type === 'skill').length;
  parser.consume({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'call-599', name: 'Skill', input: { skill: 'repeated-real-call' } }] } });
  assert.equal(events.filter(event => event.type === 'skill').length, count);
  const codexEvents = [], codex = createEventParser('codex', event => codexEvents.push(event));
  codex.consume({ type: 'item.completed', item: { type: 'command_execution', command: 'cat /skills/not-evidence/SKILL.md', input: { skill: 'not-evidence' } } });
  codex.consume({ type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE Skill call' } });
  assert.equal(codexEvents.filter(event => event.type === 'skill').length, 0); assert.ok(!JSON.stringify(codexEvents).includes('PRIVATE'));
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

const SESSION_ID = '019a1234-5678-7abc-8def-123456789abc';
test('native resumes use only a strict session UUID and retain explicit sandbox and Claude tool limits', () => {
  const codex = providerArguments('codex', 'read-only', { resumeSessionId: SESSION_ID.toUpperCase(), modelId: 'confirmed-model', reasoningEffort: 'high', speed: 'fast', memory: {} });
  assert.deepEqual(codex.slice(0, 4), ['-a', 'never', '--sandbox', 'read-only']);
  assert.ok(codex.indexOf('--sandbox') < codex.indexOf('exec')); assert.deepEqual(codex.slice(-6), ['exec', 'resume', '--json', '--skip-git-repo-check', SESSION_ID, '-']);
  assert.ok(codex.includes('confirmed-model')); assert.ok(codex.includes('model_reasoning_effort="high"')); assert.ok(codex.some(arg => arg.includes('mcp_servers.imperium_memory.required=true')));
  const claude = providerArguments('claude', 'read-only', { resumeSessionId: SESSION_ID });
  assert.deepEqual(claude.slice(0, 3), ['-p', '--resume', SESSION_ID]); assert.equal(claude[claude.indexOf('--tools') + 1], 'Read,Glob,Grep'); assert.equal(claude[claude.indexOf('--allowedTools') + 1], 'Read,Glob,Grep');
  const writable = providerArguments('claude', 'workspace-write', { resumeSessionId: SESSION_ID }); assert.equal(writable[writable.indexOf('--tools') + 1], 'Read,Glob,Grep,Edit,Write');
  for (const args of [codex, claude, writable]) for (const forbidden of ['--last', '--all', '--dangerously-bypass-approvals-and-sandbox', '--dangerously-skip-permissions', 'Bash']) assert.ok(!args.includes(forbidden));
  for (const invalid of [null, 123, '--last', `${SESSION_ID}\n`, `${SESSION_ID} --all`, '00000000-0000-0000-0000-000000000000', 'other-session']) { assert.equal(isNativeSessionId(invalid), false); assert.throws(() => providerArguments('codex', 'read-only', { resumeSessionId: invalid })); assert.throws(() => providerArguments('claude', 'read-only', { resumeSessionId: invalid })); }
});

test('native session and actual model metadata are explicit, deduplicated and never inferred from output or usage', () => {
  for (const provider of ['codex', 'claude']) {
    const events = [], parser = createEventParser(provider, event => events.push(event));
    assert.equal(Object.hasOwn(parser.state(), 'sessionId'), false); assert.equal(Object.hasOwn(parser.state(), 'reportedModel'), false);
    if (provider === 'codex') {
      parser.consume({ type: 'thread.started', thread_id: SESSION_ID.toUpperCase(), model: 'actual-model' });
      parser.consume({ type: 'thread.started', thread_id: SESSION_ID, model: 'actual-model' });
      parser.consume({ type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE', session_id: 'different-session', model: 'PRIVATE_MODEL' } });
      parser.consume({ type: 'turn.completed', usage: { model: 'NOT_ACTUAL', input_tokens: 1 } });
    } else {
      parser.consume({ type: 'system', subtype: 'init', session_id: SESSION_ID.toUpperCase(), model: 'actual-model' });
      parser.consume({ type: 'result', subtype: 'success', session_id: SESSION_ID, model: 'actual-model', usage: { model: 'NOT_ACTUAL', input_tokens: 1 } });
      parser.consume({ type: 'assistant', session_id: 'different-session', message: { model: 'PRIVATE_MODEL', content: [{ type: 'thinking', thinking: 'PRIVATE' }] } });
    }
    assert.deepEqual(events.filter(event => event.type === 'session'), [{ type: 'session', sessionId: SESSION_ID, source: 'cli-session' }]);
    assert.deepEqual(events.filter(event => event.type === 'execution-model'), [{ type: 'execution-model', model: 'actual-model', source: 'cli' }]);
    assert.equal(parser.state().sessionId, SESSION_ID); assert.equal(parser.state().reportedModel, 'actual-model'); assert.ok(!JSON.stringify(events).includes('PRIVATE'));
  }
});

test('invalid native session IDs are ignored and reported models are bounded control-free public labels', () => {
  const events = [], parser = createEventParser('claude', event => events.push(event));
  parser.consume({ type: 'system', subtype: 'init', session_id: '--last', model: {} });
  parser.consume({ type: 'result', session_id: `${SESSION_ID}\n`, model: '\u0000\u001b\u202e' });
  assert.equal(events.filter(event => ['session', 'execution-model'].includes(event.type)).length, 0);
  parser.consume({ type: 'system', subtype: 'init', model: `\u0000\u001b\u202e${'🙂'.repeat(230)}` });
  assert.equal(events.find(event => event.type === 'execution-model').model, '🙂'.repeat(200)); assert.equal(Object.hasOwn(parser.state(), 'sessionId'), false);
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

test('resumed runner sends follow-up through stdin and returns only session/model metadata actually reported by its CLI', async () => {
  for (const provider of ['codex', 'claude']) {
    const child = fakeChild(), calls = [], events = [], exits = []; let input = '';
    child.stdin.setEncoding('utf8'); child.stdin.on('data', value => { input += value; });
    const runner = createProviderRunner({ locate: async () => ({ command: '/mock/native-cli', prefix: [] }), spawnProcess: (...args) => { calls.push(args); return child; }, platform: 'linux' });
    const prompt = '기존 대화 이어서 확인; $(unsafe) "한글"';
    await runner({ provider, prompt, cwd: '/owned-workspace', modelId: 'requested-model', resumeSessionId: SESSION_ID, onEvent: event => events.push(event), onExit: value => exits.push(value) });
    assert.equal(input, prompt); assert.equal(calls[0][2].shell, false); assert.ok(calls[0][1].includes(SESSION_ID)); assert.ok(!calls[0][1].includes(prompt));
    const metadata = provider === 'codex' ? { type: 'thread.started', thread_id: SESSION_ID, model: 'actual-model' } : { type: 'system', subtype: 'init', session_id: SESSION_ID, model: 'actual-model' };
    child.stdout.write(JSON.stringify(metadata) + '\n'); child.emit('close', 0);
    assert.equal(exits.length, 1); assert.equal(exits[0].sessionId, SESSION_ID); assert.equal(exits[0].reportedModel, 'actual-model'); assert.notEqual(exits[0].reportedModel, 'requested-model');
    assert.equal(events.filter(event => event.type === 'session').length, 1);
  }
  const child = fakeChild(), exits = [], runner = createProviderRunner({ locate: async () => ({ command: '/mock/codex', prefix: [] }), spawnProcess: () => child, platform: 'linux' });
  await runner({ provider: 'codex', prompt: 'No metadata', modelId: 'requested-only', onExit: value => exits.push(value) }); child.emit('close', 0);
  assert.equal(Object.hasOwn(exits[0], 'sessionId'), false); assert.equal(Object.hasOwn(exits[0], 'reportedModel'), false);
});

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
