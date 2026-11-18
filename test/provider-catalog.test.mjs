import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { PROVIDER_CATALOG, createCatalogRunner, discoverModels } from '../lib/provider-catalog.mjs';

test('provider catalog identifies local and subscription CLIs without implying shared credentials', () => {
  assert.deepEqual(PROVIDER_CATALOG.map(provider => provider.id), ['codex', 'claude', 'gemini', 'copilot', 'ollama']);
  assert.equal(PROVIDER_CATALOG.find(provider => provider.id === 'ollama').kind, 'local');
  assert.ok(PROVIDER_CATALOG.every(provider => provider.docsUrl.startsWith('https://') && typeof provider.requiresNode === 'boolean'));
});

test('Gemini and Copilot expose verified aliases without claiming account discovery', async () => {
  const mustNotRun = async () => assert.fail('aliases must not run a model or CLI');
  for (const id of ['gemini', 'copilot']) {
    const result = await discoverModels(id, { providerRunner: mustNotRun });
    assert.ok(result.models.length > 0);
    assert.ok(result.models.every(model => model.source === 'alias'));
    assert.ok(result.detail.includes('/model'));
  }
});

test('Claude discovery failures expose only conservative aliases and no upstream diagnostics', async () => {
  let calls = 0;
  const result = await discoverModels('claude', { providerRunner: async request => {
    calls++;
    assert.equal(request.id, 'claude'); assert.equal(request.operation, 'model/list');
    throw new Error('PRIVATE_ACCOUNT_DETAIL');
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result.models.map(model => model.id), ['opus', 'sonnet', 'haiku']);
  assert.ok(result.models.every(model => model.source === 'alias' && model.supportsFastMode === false && model.supportedReasoningEfforts.length === 0));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ACCOUNT_DETAIL/);
});

test('account model catalogs are bounded, deduplicated, and filtered without invented fallbacks', async () => {
  const requests = [];
  const result = await discoverModels('codex', { providerRunner: async request => {
    requests.push(request);
    return { data: [{ model: 'actual-account-model', displayName: 'Account Model' }, { model: 'actual-account-model' }, { model: 'hidden-model', hidden: true }, { model: 'bad\nmodel' }, { model: 'next-model' }] };
  } });
  assert.deepEqual(result.models, [{ id: 'actual-account-model', name: 'Account Model', source: 'account' }, { id: 'next-model', name: 'next-model', source: 'account' }]);
  assert.equal(requests[0].operation, 'model/list');
  assert.equal(requests[0].params.includeHidden, false);
  const failed = await discoverModels('codex', { providerRunner: async () => { throw Error('sensitive upstream diagnostic'); } });
  assert.deepEqual(failed.models, []);
  assert.ok(!failed.detail.includes('sensitive'));
});

test('Codex account discovery preserves advertised reasoning and speed capabilities without mutating provider data', async () => {
  const raw = { data: [
    { model: 'account-advanced', displayName: 'Advanced', isDefault: true, supportedReasoningEfforts: ['low', { reasoningEffort: 'medium' }, { reasoningEffort: 'max' }, { reasoningEffort: 'ultra' }, { reasoningEffort: 'max' }, { reasoningEffort: 'unknown-level' }], defaultReasoningEffort: 'max', serviceTiers: [{ id: 'priority', name: 'Fast' }], accountEmail: 'PRIVATE_ACCOUNT_DETAIL' },
    { model: 'account-standard', supportedReasoningEfforts: [{ reasoningEffort: 'medium' }], defaultReasoningEffort: 'max', serviceTiers: [] },
  ] };
  const before = structuredClone(raw), requests = [];
  const result = await discoverModels('codex', { providerRunner: async request => { requests.push(request); return raw; } });
  const [advanced, standard] = result.models;
  assert.deepEqual(advanced.supportedReasoningEfforts, ['low', 'medium', 'max', 'ultra']);
  assert.equal(advanced.defaultReasoningEffort, 'max'); assert.equal(advanced.supportsFastMode, true); assert.equal(advanced.isDefault, true);
  assert.deepEqual(standard.supportedReasoningEfforts, ['medium']);
  assert.equal(standard.supportsFastMode, false); assert.equal(standard.defaultReasoningEffort, undefined);
  assert.ok(result.models.every(model => model.source === 'account'));
  assert.deepEqual(requests.map(request => request.operation), ['model/list']);
  assert.deepEqual(raw, before, 'read-only discovery must leave provider metadata untouched');
  advanced.supportedReasoningEfforts.push('high');
  assert.deepEqual(raw, before, 'normalized capability arrays must not alias provider data');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ACCOUNT_DETAIL/);
});

test('Claude account discovery normalizes fourteen model rows through initialization alone', async () => {
  const fullEffort = ['low', 'medium', 'high', 'xhigh', 'max'];
  const versions = [
    ['default', 'claude-opus-5-5'], ['opus', 'claude-opus-5-5'], ['fable', 'claude-fable-5-2'],
    ['sonnet', 'claude-sonnet-5-5'], ['haiku', 'claude-haiku-5-5'], ['claude-fable-5-1', 'claude-fable-5-1'],
    ['claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001'], ['claude-sonnet-5', 'claude-sonnet-5'],
    ['claude-opus-5', 'claude-opus-5'], ['claude-fable-5', 'claude-fable-5'], ['claude-opus-4-8', 'claude-opus-4-8'],
    ['claude-opus-4-7', 'claude-opus-4-7'], ['claude-opus-4-6', 'claude-opus-4-6'], ['claude-sonnet-4-6', 'claude-sonnet-4-6'],
  ];
  const models = versions.map(([value, resolvedModel]) => ({ value, resolvedModel, displayName: value === 'default' ? 'Default (recommended)' : resolvedModel, description: 'Published model metadata',
    ...(value === 'claude-haiku-4-5-20251001' ? {} : { supportsEffort: true }),
    ...(value === 'claude-haiku-4-5-20251001' ? {} : { supportedEffortLevels: value.endsWith('-4-6') ? ['low', 'medium', 'high', 'max'] : [...fullEffort] }),
    ...(['default', 'opus', 'fable', 'claude-opus-5', 'claude-opus-4-8'].includes(value) ? { supportsFastMode: true } : {}),
  }));
  const before = structuredClone(models), commands = [], spawns = [];
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.exitCode = null;
  child.kill = () => { child.exitCode = 0; child.emit('close', 0); };
  let buffer = '';
  child.stdin.on('data', chunk => {
    buffer += chunk;
    let boundary;
    while ((boundary = buffer.indexOf('\n')) !== -1) {
      const message = JSON.parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 1); commands.push(message);
      assert.equal(message.request.subtype, 'initialize');
      queueMicrotask(() => child.stdout.write(`${JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: { models, account: { email: 'PRIVATE_ACCOUNT_DETAIL' } } } })}\n`));
    }
  });
  const runner = createCatalogRunner({ locate: async id => { assert.equal(id, 'claude'); return { command: 'C:\\CLI Space\\claude.exe', prefix: [] }; }, spawnProcess: (command, args, options) => { spawns.push({ command, args, options }); return child; } });
  const result = await discoverModels('claude', { providerRunner: runner });
  assert.equal(result.models.length, 14);
  assert.ok(result.models.every(model => model.source === 'account'));
  assert.deepEqual(result.models.filter(model => model.isDefault).map(model => model.id), ['default']);
  assert.equal(result.models.find(model => model.id === 'default').resolvedModel, 'claude-opus-5-5');
  assert.equal(result.models.find(model => model.id === 'opus').resolvedModel, 'claude-opus-5-5');
  assert.deepEqual(result.models.find(model => model.id === 'opus').supportedReasoningEfforts, fullEffort);
  assert.deepEqual(result.models.find(model => model.id === 'claude-opus-4-6').supportedReasoningEfforts, ['low', 'medium', 'high', 'max']);
  assert.deepEqual(result.models.find(model => model.id === 'claude-haiku-4-5-20251001').supportedReasoningEfforts, []);
  assert.equal(result.models.find(model => model.id === 'sonnet').supportsFastMode, false);
  assert.equal(result.models.find(model => model.id === 'fable').supportsFastMode, true);
  assert.deepEqual(commands.map(message => [message.type, message.request.subtype]), [['control_request', 'initialize']]);
  assert.equal(spawns.length, 1); assert.equal(spawns[0].options.shell, false);
  assert.ok(spawns[0].args.includes('--safe-mode')); assert.ok(spawns[0].args.includes('--no-session-persistence'));
  assert.equal(spawns[0].options.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(child.exitCode, 0); assert.deepEqual(models, before);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ACCOUNT_DETAIL/);
});

test('Ollama exposes installed local names and excludes cloud proxies', async () => {
  const result = await discoverModels('ollama', { providerRunner: async () => ({ models: [{ name: 'qwen:8b' }, { name: 'qwen:8b' }, { name: 'gemma:cloud' }, { name: 'hosted-model', remote_host: 'https://example.test' }] }) });
  assert.deepEqual(result.models, [{ id: 'qwen:8b', name: 'qwen:8b', source: 'local' }]);
});

test('the default Ollama discovery transport uses fixed loopback and rejects redirects', async () => {
  const calls = [];
  const runner = createCatalogRunner({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ models: [{ name: 'local:latest' }] }));
  } });
  assert.equal((await runner({ id: 'ollama', operation: 'api/tags' })).models[0].name, 'local:latest');
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/tags');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.body, undefined);
});

test('Codex discovery sends only initialize and model/list JSONL with shell disabled', async () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
  child.exitCode = null;
  child.kill = () => { child.exitCode = 0; child.emit('close', 0); };
  const commands = [];
  let lineBuffer = '';
  child.stdin.on('data', chunk => {
    lineBuffer += chunk.toString();
    let boundary;
    while ((boundary = lineBuffer.indexOf('\n')) !== -1) {
      const request = JSON.parse(lineBuffer.slice(0, boundary)); lineBuffer = lineBuffer.slice(boundary + 1);
      commands.push(request);
      if (request.method === 'initialize') queueMicrotask(() => child.stdout.write(`${JSON.stringify({ id: request.id, result: {} })}\n`));
      if (request.method === 'model/list') queueMicrotask(() => child.stdout.write(`${JSON.stringify({ id: request.id, result: { data: [{ model: 'account-only' }], nextCursor: null } })}\n`));
    }
  });
  const spawned = [];
  const runner = createCatalogRunner({ locate: async () => ({ command: 'C:\\CLI Space\\codex.exe', prefix: [] }), spawnProcess: (command, args, options) => { spawned.push({ command, args, options }); return child; } });
  const result = await runner({ id: 'codex', operation: 'model/list' });
  assert.equal(result.data[0].model, 'account-only');
  assert.deepEqual(commands.map(command => command.method), ['initialize', 'initialized', 'model/list']);
  assert.ok(commands.every(command => !command.method.includes('turn') && !command.method.includes('thread')));
  assert.equal(spawned[0].options.shell, false);
  assert.equal(spawned[0].options.env.OPENAI_API_KEY, undefined);
  assert.deepEqual(spawned[0].args, ['app-server', '--listen', 'stdio://']);
});

test('unknown providers are rejected instead of invoking an arbitrary executable', async () => {
  await assert.rejects(discoverModels('powershell'), error => error.status === 400);
  const runner = createCatalogRunner();
  await assert.rejects(runner({ id: 'codex', operation: 'turn/start' }), error => error.status === 400);
});
