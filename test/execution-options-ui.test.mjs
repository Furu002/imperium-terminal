import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = await readFile(new URL('../public/execution-options.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let turn = 0; turn < 5; turn++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const caps = { providers: {
  codex: { reasoningEfforts: ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'], speeds: ['default', 'standard', 'fast'] },
  claude: { reasoningEfforts: ['default', 'low', 'medium', 'high', 'xhigh', 'max'], speeds: ['default', 'standard', 'fast'] },
  copilot: { reasoningEfforts: ['default', 'low', 'medium', 'high', 'xhigh', 'max'], speeds: ['default'] },
  gemini: { reasoningEfforts: ['default'], speeds: ['default'] }, ollama: { reasoningEfforts: ['default'], speeds: ['default'] },
} };
const models = {
  codex: { models: [
    { id: 'gpt-full', name: 'Reported account model', source: 'account', supportedReasoningEfforts: ['none', 'low', 'high', 'max', 'ultra'], defaultReasoningEffort: 'high', supportsFastMode: true, isDefault: true },
    { id: 'gpt-luna', name: 'Reported limited model', source: 'account', supportedReasoningEfforts: ['low', 'high', 'max'], supportsFastMode: false },
    { id: 'constrained-model', name: 'No optional effort', source: 'account', supportedReasoningEfforts: [], supportsFastMode: false },
  ], detail: 'Models reported by the account.' },
  claude: { models: [{ id: 'sonnet', resolvedModel: 'claude-canonical-sonnet', name: 'Account Sonnet', source: 'account', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'], supportsFastMode: true, isDefault: true }], detail: 'Official read-only model metadata.' },
};
async function setup(t, { configuration = {}, route } = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="widgets"></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom, calls = [], changes = [];
  const api = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET' }); assert.equal(options.method || 'GET', 'GET');
    if (route) return route(path, calls.length - 1);
    if (path === '/api/execution/capabilities') return clone(caps);
    const match = /^\/api\/providers\/([^/]+)\/models$/.exec(path); if (match) return clone(models[match[1]] || { models: [] });
    throw new Error(`Unexpected widget request ${path}`);
  };
  window.eval(script);
  const create = options => { const widget = window.ImperiumExecution.create({ api, provider: 'codex', onChange: value => changes.push(clone(value)), ...options }); window.document.querySelector('#widgets').append(widget.element); return widget; };
  const widget = create(configuration); await settle(); t.after(() => window.close());
  return { window, document: window.document, widget, create, calls, changes, errors };
}
const find = (widget, field) => widget.element.querySelector(`[data-execution-${field}]`);
function change(window, element, value) { element.value = value; element.dispatchEvent(new window.Event('change', { bubbles: true })); }
const values = select => [...select.options].map(option => option.value);

test('current model IDs survive discovery and only reported provider reasoning and speed choices are offered', async t => {
  const { widget, calls, errors } = await setup(t, { configuration: { modelId: 'saved-current-model', reasoningEffort: 'ultra', speed: 'fast' } });
  assert.deepEqual(clone(widget.getValue()), { modelId: 'saved-current-model', reasoningEffort: 'ultra', speed: 'fast' });
  assert.equal(find(widget, 'model').selectedOptions[0].dataset.modelSource, 'current'); assert.match(find(widget, 'model').selectedOptions[0].textContent, /Current setting/);
  assert.ok(values(find(widget, 'effort')).includes('none')); assert.ok(values(find(widget, 'effort')).includes('ultra')); assert.deepEqual(values(find(widget, 'speed')), ['default', 'standard', 'fast']);
  assert.deepEqual(calls.map(call => call.path), ['/api/execution/capabilities']);
  find(widget, 'load-models').click(); await settle();
  assert.equal(widget.getValue().modelId, 'saved-current-model'); assert.equal(find(widget, 'model').value, 'saved-current-model'); assert.match(widget.element.querySelector('.ie-capability-note').textContent, /Support can vary by model/); assert.equal(find(widget, 'model').querySelector('option[value="gpt-full"]').dataset.modelSource, 'account'); assert.deepEqual(errors, []);
});

test('selected model metadata restricts effort and Fast and CLI default uses the reported default-model metadata', async t => {
  const { window, widget } = await setup(t, { configuration: { modelId: 'gpt-full', reasoningEffort: 'ultra', speed: 'fast' } });
  find(widget, 'load-models').click(); await settle(); assert.equal(widget.getValue().reasoningEffort, 'ultra');
  change(window, find(widget, 'model'), 'gpt-luna');
  assert.deepEqual(clone(widget.getValue()), { modelId: 'gpt-luna', reasoningEffort: 'default', speed: 'default' }); assert.ok(!values(find(widget, 'effort')).includes('ultra')); assert.ok(!values(find(widget, 'speed')).includes('fast')); assert.match(widget.element.querySelector('.ie-reset-note').textContent, /reset to default/);
  change(window, find(widget, 'model'), 'constrained-model'); assert.deepEqual(values(find(widget, 'effort')), ['default']); assert.equal(find(widget, 'effort').disabled, true);
  change(window, find(widget, 'model'), ''); assert.ok(values(find(widget, 'effort')).includes('ultra')); assert.ok(values(find(widget, 'speed')).includes('fast')); assert.equal(widget.getValue().reasoningEffort, 'default'); assert.match(widget.element.querySelector('.ie-model-default').textContent, /HIGH/);
});

test('manual IDs are validated without executing requests and unknown models retain only provider-reported choices', async t => {
  const { window, document, widget, calls, changes } = await setup(t);
  change(window, find(widget, 'model'), '__manual__'); assert.throws(() => widget.getValue(), /Enter a model ID/);
  let input = find(widget, 'model-manual'); input.value = 'safe-model:v1/path'; input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(widget.getValue().modelId, 'safe-model:v1/path'); assert.ok(values(find(widget, 'effort')).includes('ultra'));
  const before = changes.length; input.value = 'bad; <img src=x onerror=alert(1)>'; input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.throws(() => widget.getValue(), /Model IDs must/); assert.equal(changes.length, before); assert.equal(document.querySelector('img[src="x"]'), null);
  input.value = 'a'.repeat(201); input.dispatchEvent(new window.Event('input')); assert.throws(() => widget.getValue(), /200 characters/);
  assert.deepEqual(calls.map(call => call.path), ['/api/execution/capabilities']);
});

test('independent instances preserve same-provider selections and reset provider changes unless values are explicit', async t => {
  const { window, widget, create } = await setup(t, { configuration: { modelId: 'codex-model', reasoningEffort: 'ultra', speed: 'fast' } });
  const other = create({ provider: 'claude', modelId: 'sonnet', reasoningEffort: 'max', speed: 'fast' }); await settle();
  change(window, find(widget, 'effort'), 'high'); widget.setContext({ provider: 'codex' }); assert.equal(widget.getValue().reasoningEffort, 'high'); assert.equal(widget.getValue().speed, 'fast'); assert.equal(other.getValue().reasoningEffort, 'max');
  widget.setContext({ provider: 'ollama' }); await settle(); assert.deepEqual(clone(widget.getValue()), { modelId: '', reasoningEffort: 'default', speed: 'default' }); assert.equal(find(widget, 'effort').disabled, true); assert.equal(find(widget, 'speed').disabled, true);
  widget.setContext({ provider: 'copilot', modelId: 'saved-copilot-model', reasoningEffort: 'xhigh', speed: 'fast' }); await settle();
  assert.deepEqual(clone(widget.getValue()), { modelId: 'saved-copilot-model', reasoningEffort: 'xhigh', speed: 'default' }); assert.equal(other.getValue().speed, 'fast');
  const ids = [...window.document.querySelectorAll('[id^="ie-"]')].map(element => element.id); assert.equal(new Set(ids).size, ids.length);
});

test('late model responses from the previous provider do not replace current models or settings', async t => {
  const oldModels = deferred();
  const { window, widget } = await setup(t, { route: path => path === '/api/execution/capabilities' ? clone(caps) : path.includes('/codex/') ? oldModels.promise : clone(models.claude) });
  find(widget, 'load-models').click(); widget.setContext({ provider: 'claude' }); await settle(); find(widget, 'load-models').click(); await settle(); change(window, find(widget, 'model'), 'sonnet'); change(window, find(widget, 'effort'), 'high');
  oldModels.resolve({ models: [{ id: 'old-codex-model', name: 'Obsolete model', source: 'account', supportedReasoningEfforts: [] }] }); await settle();
  assert.equal(widget.getValue().modelId, 'sonnet'); assert.equal(widget.getValue().reasoningEffort, 'high'); assert.equal(find(widget, 'model').querySelector('option[value="old-codex-model"]'), null); assert.equal(widget.element.dataset.provider, 'claude');
});

test('late capability responses are ignored and failed discovery falls back to verified-safe defaults', async t => {
  const oldCaps = deferred(); let requests = 0;
  const { widget } = await setup(t, { route: path => { assert.equal(path, '/api/execution/capabilities'); return ++requests === 1 ? oldCaps.promise : clone(caps); } });
  widget.setContext({ provider: 'claude', reasoningEffort: 'high', speed: 'standard' }); await settle();
  const obsolete = clone(caps); obsolete.providers.claude = { reasoningEfforts: ['default'], speeds: ['default'] }; oldCaps.resolve(obsolete); await settle();
  assert.equal(widget.getValue().reasoningEffort, 'high'); assert.equal(widget.getValue().speed, 'standard');
  const failure = await setup(t, { configuration: { provider: 'codex', modelId: 'keep-current-id', reasoningEffort: 'ultra', speed: 'fast' }, route: () => Promise.reject(new Error('Capabilities unavailable')) });
  assert.deepEqual(clone(failure.widget.getValue()), { modelId: 'keep-current-id', reasoningEffort: 'default', speed: 'default' }); assert.deepEqual(values(find(failure.widget, 'effort')), ['default']); assert.deepEqual(values(find(failure.widget, 'speed')), ['default']); assert.match(failure.widget.element.querySelector('.ie-capability-note').textContent, /only default options/);
});

test('Claude Fast credits and default-versus-standard semantics are explicit in all three languages', async t => {
  const { document, widget } = await setup(t, { configuration: { provider: 'claude', speed: 'fast' } });
  assert.match(widget.element.querySelector('.ie-fast-note').textContent, /separate usage credits/); assert.match(find(widget, 'speed').querySelector('option[value="default"]').textContent, /Inherit CLI speed/); assert.match(find(widget, 'speed').querySelector('option[value="standard"]').textContent, /Fast off/);
  document.documentElement.lang = 'ko'; await settle(); assert.match(widget.element.textContent, /별도 사용 크레딧/); assert.match(widget.element.textContent, /추론 강도/);
  document.documentElement.lang = 'ja'; await settle(); assert.match(widget.element.textContent, /別枠の使用クレジット/); assert.match(widget.element.textContent, /推論の強度/); assert.equal(widget.getValue().speed, 'fast');
});

test('destroyed widgets ignore outstanding model discovery and detach their language observers', async t => {
  const delayed = deferred();
  const { document, widget, calls, changes } = await setup(t, { route: path => path === '/api/execution/capabilities' ? clone(caps) : delayed.promise });
  find(widget, 'load-models').click(); const count = calls.length, before = changes.length; widget.destroy();
  delayed.resolve(clone(models.codex)); document.documentElement.lang = 'ja'; await settle(); widget.setContext({ provider: 'claude' });
  assert.equal(document.querySelector('[data-execution-instance]'), null); assert.equal(calls.length, count); assert.equal(changes.length, before);
});

test('official discovery success and fallback details follow the selected UI language', async t => {
  const details = [
    ['로그인한 공식 CLI가 반환한 계정 모델과 지원 설정입니다. 계정·조직 정책에 따라 실행 시 조정되거나 거절될 수 있습니다.', /signed-in official CLI/, /公式CLI/],
    ['이 컴퓨터의 Ollama에서 조회한 설치 모델입니다. 클라우드 모델은 제외했습니다.', /Cloud models are excluded/, /クラウドモデルは除外/],
    ['계정 모델 조회에 실패해 공식 별칭만 표시합니다. 지원 설정 확인 전에는 기본값을 사용하세요.', /only official aliases/, /公式エイリアスのみ/],
    ['Codex 모델 목록을 불러오지 못했습니다. Codex CLI 로그인과 버전을 확인하거나 모델 ID를 직접 입력하세요.', /Codex CLI sign-in and version/, /ログイン状態とバージョン/],
    ['로컬 Ollama 서비스에 연결하지 못했습니다. Ollama를 실행하고 모델 설치 상태를 확인하세요.', /Start Ollama/, /Ollamaを起動/],
  ];
  let detail = '';
  const { document, widget } = await setup(t, { route: path => path === '/api/execution/capabilities' ? clone(caps) : { models: [], detail } });
  for (const [original, english, japanese] of details) {
    detail = original; document.documentElement.lang = 'en'; await settle(); find(widget, 'load-models').click(); await settle();
    assert.match(widget.element.querySelector('.ie-discovery-detail').textContent, english);
    document.documentElement.lang = 'ja'; await settle(); assert.match(widget.element.querySelector('.ie-discovery-detail').textContent, japanese);
    document.documentElement.lang = 'ko'; await settle(); assert.equal(widget.element.querySelector('.ie-discovery-detail').textContent, original);
  }
});
