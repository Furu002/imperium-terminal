import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { EXECUTION_CAPABILITIES, executionArguments, resolveExecutionOptions } from '../lib/execution-options.mjs';
import { createProviderRunner, providerArguments } from '../lib/providers.mjs';
import { additionalProviderArguments, createAdditionalProviderRunner } from '../lib/additional-providers.mjs';

const invalid = error => error.status === 400;

test('an older Copilot CLI cannot start an effort-controlled task without advertising its flag', async () => {
  let spawned = 0;
  const runner = createAdditionalProviderRunner({
    locate: async () => ({ command: '/fake/copilot', prefix: [] }), platform: 'linux',
    probe: async () => ({ code: 0, stdout: '--available-tools --deny-tool --output-format --disable-builtin-mcps', stderr: '' }),
    spawnProcess: () => { spawned++; throw new Error('Must not run'); },
  });
  await assert.rejects(runner({ provider: 'copilot', prompt: 'No inference', reasoningEffort: 'high' }), /업데이트/);
  assert.equal(spawned, 0);
});

test('execution preferences default explicitly and inherit only omitted fields without mutating inputs', () => {
  for (const provider of ['codex', 'claude', 'copilot', 'gemini', 'ollama']) {
    assert.deepEqual(resolveExecutionOptions(provider), { reasoningEffort: 'default', speed: 'default' });
    assert.ok(EXECUTION_CAPABILITIES[provider].reasoningEfforts.includes('default'));
    assert.ok(EXECUTION_CAPABILITIES[provider].speeds.includes('default'));
  }
  const defaults = { reasoningEffort: 'xhigh', speed: 'fast' }, input = { speed: 'standard' };
  assert.deepEqual(resolveExecutionOptions('codex', input, defaults), { reasoningEffort: 'xhigh', speed: 'standard' });
  assert.deepEqual(resolveExecutionOptions('codex', { reasoningEffort: 'default', speed: 'default' }, defaults), { reasoningEffort: 'default', speed: 'default' });
  assert.deepEqual(defaults, { reasoningEffort: 'xhigh', speed: 'fast' });
  assert.deepEqual(input, { speed: 'standard' });
});

test('invalid values, explicit nulls, option-shaped values and unsupported provider capabilities are rejected', () => {
  for (const value of [null, undefined, true, 1, [], {}, '', '--model', 'high" -c unsafe=true', 'HIGH']) {
    for (const key of ['reasoningEffort', 'speed']) assert.throws(() => resolveExecutionOptions('codex', { [key]: value }), invalid, `${key}: ${String(value)}`);
  }
  for (const provider of ['powershell', 'constructor', '__proto__', 'toString']) assert.throws(() => resolveExecutionOptions(provider), invalid);
  for (const provider of ['gemini', 'ollama']) assert.throws(() => resolveExecutionOptions(provider, { reasoningEffort: 'high' }), invalid);
  for (const provider of ['gemini', 'ollama', 'copilot']) assert.throws(() => resolveExecutionOptions(provider, { speed: 'fast' }), invalid);
  assert.throws(() => resolveExecutionOptions('claude', { reasoningEffort: 'none' }), invalid);
});

test('Codex reasoning and fast/standard settings are invocation-scoped, separately quoted TOML arguments', () => {
  assert.deepEqual(executionArguments('codex', { reasoningEffort: 'xhigh', speed: 'fast' }), [
    '-c', 'model_reasoning_effort="xhigh"', '-c', 'features.fast_mode=true', '-c', 'service_tier="fast"',
  ]);
  assert.deepEqual(executionArguments('codex', { speed: 'standard' }), ['-c', 'features.fast_mode=false', '-c', 'service_tier="default"']);
  assert.deepEqual(executionArguments('codex', { reasoningEffort: 'none' }), ['-c', 'model_reasoning_effort="none"']);
});

test('Claude effort and speed use supported flags and explicit JSON settings without changing global files', () => {
  const fast = executionArguments('claude', { reasoningEffort: 'max', speed: 'fast' });
  assert.deepEqual(fast.slice(0, 2), ['--effort', 'max']);
  assert.equal(fast[2], '--settings'); assert.deepEqual(JSON.parse(fast[3]), { fastMode: true });
  assert.deepEqual(executionArguments('claude', { speed: 'standard' }), ['--settings', '{"fastMode":false}']);
  assert.ok(!fast.includes('--fast'));
});

test('Copilot receives only its reasoning flag while providers without a verified control retain defaults', () => {
  assert.deepEqual(executionArguments('copilot', { reasoningEffort: 'high' }), ['--reasoning-effort', 'high']);
  for (const provider of Object.keys(EXECUTION_CAPABILITIES)) assert.deepEqual(executionArguments(provider, { reasoningEffort: 'default', speed: 'default' }), []);
});

test('default provider arguments remain unchanged and new controls preserve model, permissions and stdin routing', () => {
  assert.deepEqual(providerArguments('codex'), ['-a', 'never', 'exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', '-']);
  assert.deepEqual(providerArguments('claude'), ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--tools', 'Read,Glob,Grep', '--allowedTools', 'Read,Glob,Grep']);
  const codex = providerArguments('codex', 'workspace-write', { modelId: 'account-model', reasoningEffort: 'high', speed: 'standard' });
  assert.equal(codex[codex.indexOf('--model') + 1], 'account-model');
  assert.ok(codex.indexOf('model_reasoning_effort="high"') < codex.indexOf('exec'));
  assert.equal(codex[codex.indexOf('--sandbox') + 1], 'workspace-write'); assert.equal(codex.at(-1), '-');
  const claude = providerArguments('claude', 'read-only', { modelId: 'sonnet', reasoningEffort: 'high', speed: 'standard' });
  assert.equal(claude[claude.indexOf('--model') + 1], 'sonnet'); assert.equal(claude[claude.indexOf('--effort') + 1], 'high');
  assert.deepEqual(JSON.parse(claude[claude.indexOf('--settings') + 1]), { fastMode: false });
  assert.equal(claude[claude.indexOf('--tools') + 1], 'Read,Glob,Grep');
});

test('additional provider arguments preserve the complete Copilot prompt and enforce option allowlists', () => {
  const prompt = '한글 " & $(whoami)\n원문은 그대로 전달';
  const args = additionalProviderArguments('copilot', { prompt, modelId: 'account-model', reasoningEffort: 'xhigh' });
  assert.equal(args[args.indexOf('--reasoning-effort') + 1], 'xhigh');
  assert.equal(args[args.indexOf('--available-tools') + 1], 'view,glob,grep');
  assert.deepEqual(args.slice(-2), ['-p', prompt]);
  assert.throws(() => providerArguments('codex', 'read-only', { reasoningEffort: 'high" --sandbox danger-full-access' }), invalid);
  assert.throws(() => additionalProviderArguments('copilot', { prompt, reasoningEffort: '--allow-all' }), invalid);
  assert.throws(() => providerArguments('claude', 'read-only', { modelId: '--dangerously-skip-permissions' }), /모델 ID/);
});

test('explicit Claude effort overrides inherited environment while default preserves it without global mutation', async t => {
  const original = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  t.after(() => { if (original === undefined) delete process.env.CLAUDE_CODE_EFFORT_LEVEL; else process.env.CLAUDE_CODE_EFFORT_LEVEL = original; });
  process.env.CLAUDE_CODE_EFFORT_LEVEL = 'high';
  const calls = [];
  const runner = createProviderRunner({
    locate: async () => ({ command: '/fake/claude', prefix: [] }), platform: 'linux',
    spawnProcess: (command, args, options) => {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
      child.exitCode = null; child.kill = () => { child.exitCode = 0; child.emit('close', 0); };
      calls.push({ child, command, args, options }); return child;
    },
  });
  await runner({ provider: 'claude', prompt: 'No model call', reasoningEffort: 'max' });
  assert.equal(calls[0].options.env.CLAUDE_CODE_EFFORT_LEVEL, 'max');
  assert.equal(calls[0].args[calls[0].args.indexOf('--effort') + 1], 'max');
  calls[0].child.emit('close', 0);
  await runner({ provider: 'claude', prompt: 'No model call', reasoningEffort: 'default' });
  assert.equal(calls[1].options.env.CLAUDE_CODE_EFFORT_LEVEL, 'high');
  assert.ok(!calls[1].args.includes('--effort'));
  calls[1].child.emit('close', 0);
  assert.equal(process.env.CLAUDE_CODE_EFFORT_LEVEL, 'high');
});
