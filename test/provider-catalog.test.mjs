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

test('Claude, Gemini and Copilot expose verified aliases without claiming account discovery', async () => {
  const mustNotRun = async () => assert.fail('aliases must not run a model or CLI');
  for (const id of ['claude', 'gemini', 'copilot']) {
    const result = await discoverModels(id, { providerRunner: mustNotRun });
    assert.ok(result.models.length > 0);
    assert.ok(result.models.every(model => model.source === 'alias'));
    assert.ok(result.detail.includes('/model'));
  }
  const claude = await discoverModels('claude');
  assert.deepEqual(claude.models.map(model => model.id), ['opus', 'sonnet', 'haiku']);
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
