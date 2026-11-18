import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const [html, script] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
]);

const clone = value => JSON.parse(JSON.stringify(value));
const settle = async () => {
  // Fetch, response.json, language persistence and form finalizers use separate
  // promise turns; no network, model calls or browser process is involved.
  for (let turn = 0; turn < 4; turn++) await new Promise(resolve => setImmediate(resolve));
};

function sampleState(overrides = {}) {
  return {
    departments: [
      { id: 'strategy', name: '전략기획실', code: 'STR', provider: 'codex', role: '목표를 구체화하고 실행 계획, 우선순위와 의사결정 근거를 정리합니다.' },
      { id: 'engineering', name: '개발본부', code: 'ENG', provider: 'claude', role: '요구사항을 분석하고 설계, 코드 구현과 개선을 담당합니다.' },
      { id: 'research', name: '리서치센터', code: 'RES', provider: 'codex', role: '자료와 프로젝트를 조사하고 출처, 사실, 추론을 구분해 보고합니다.' },
      { id: 'quality', name: '품질관리실', code: 'QAT', provider: 'claude', role: '결과를 검토하고 오류, 위험과 누락된 요구사항을 검증합니다.' },
    ],
    tasks: [], events: [],
    providers: [
      { id: 'codex', name: 'ChatGPT / Codex', installed: true, authenticated: true, status: 'ready', version: 'test', loginCommand: 'codex login' },
      { id: 'claude', name: 'Claude Code', installed: false, authenticated: false, status: 'missing', detail: 'CLI 없음', loginCommand: 'claude auth login' },
    ],
    settings: { workspace: 'C:\\테스트 프로젝트\\workspace', maxConcurrent: 2, language: 'ko' },
    server: { startedAt: new Date().toISOString(), version: 'test', mode: 'subscription-cli', csrfToken: 'test-csrf-token' },
    ...overrides,
  };
}

async function loadUI(t, initial = sampleState(), savedLanguage) {
  const virtualConsole = new VirtualConsole();
  const runtimeErrors = [];
  virtualConsole.on('jsdomError', error => runtimeErrors.push(error));
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4310/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const calls = [];
  const streams = [];
  const backend = clone(initial);
  window.addEventListener('error', event => runtimeErrors.push(event.error || new Error(event.message)));
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.URL.createObjectURL = () => 'blob:mock-export';
  window.URL.revokeObjectURL = () => {};
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  if (savedLanguage) window.localStorage.setItem('hq.language', savedLanguage);
  window.EventSource = class {
    listeners = new Map();
    constructor(url) { this.url = url; streams.push(this); }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    close() {}
    state(value) { this.listeners.get('state')?.({ data: JSON.stringify(value) }); }
  };
  window.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const body = options.body === undefined ? undefined : JSON.parse(options.body);
    calls.push({ url, method, body, headers: { ...options.headers } });
    let data;
    if (url === '/api/state' && method === 'GET') data = backend;
    else if (url === '/api/settings' && method === 'POST') {
      Object.assign(backend.settings, body);
      data = { settings: backend.settings };
    } else if (url === '/api/tasks' && method === 'POST') {
      const task = {
        ...body, id: `test-task-${backend.tasks.length + 1}`, title: body.prompt.split('\n')[0],
        status: 'queued', createdAt: new Date().toISOString(), startedAt: null, finishedAt: null,
        output: '', error: null, logs: [], usage: { inputTokens: 0, outputTokens: 0 }, demo: false,
      };
      backend.tasks.unshift(task);
      data = { task };
    } else throw new Error(`Unexpected mocked request: ${method} ${url}`);
    return { ok: true, status: 200, json: async () => clone(data) };
  };
  window.eval(script);
  await settle();
  assert.deepEqual(runtimeErrors.map(error => error.message), [], 'the app should initialize without runtime errors');
  t.after(() => { dom.window.close(); });
  return { window, document: window.document, backend, calls, streams, runtimeErrors };
}

function change(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
}

test('frontend renders truthful connection state and does not dispatch to a missing CLI', async t => {
  const { window, document, calls, streams } = await loadUI(t);
  assert.equal(document.title, 'IMPERIUM — AI Command Terminal');
  assert.equal(document.querySelector('#metric-running').textContent, '00');
  assert.equal(document.querySelector('#metric-providers').textContent, '1/2');
  assert.equal(document.querySelectorAll('.department-card').length, 4);
  assert.equal(document.querySelectorAll('.department-state.unavailable').length, 2);
  assert.equal(document.querySelector('#mission-rows').children.length, 0);
  assert.equal(document.querySelector('#dispatch-prompt').maxLength, 12000);
  assert.equal(streams[0].url, '/api/events');
  assert.equal(calls.filter(call => call.method !== 'GET').length, 0, 'opening the app must not call a model or modify settings');

  change(window, document.querySelector('#dispatch-department'), 'engineering');
  document.querySelector('#dispatch-prompt').value = '연결되지 않은 모델에는 보내지 않기';
  document.querySelector('#dispatch-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
  assert.equal(document.querySelector('#settings-dialog').open, true, 'missing CLI should show actionable connection guidance');
  const missing = document.querySelector('.provider-card[data-provider="claude"]');
  assert.match(missing.textContent, /설치 필요/);
  assert.match(missing.textContent, /npm install -g @anthropic-ai\/claude-code/);
  assert.match(missing.textContent, /claude auth login/);
  assert.equal(document.querySelectorAll('input[type="password"]').length, 0, 'subscription setup must not collect secrets');
});

test('frontend restores the saved server language and persists Korean, English and Japanese changes', async t => {
  const initial = sampleState();
  initial.settings.language = 'ja';
  initial.departments[2].name = 'My custom research team';
  const { window, document, backend, calls } = await loadUI(t, initial);
  const picker = document.querySelector('#language-select');
  assert.equal(document.documentElement.lang, 'ja');
  assert.match(document.querySelector('#page-title').textContent, /コマンドセンター/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /どのような作業/);
  assert.match(document.querySelector('#department-grid').textContent, /戦略企画室/);
  assert.match(document.querySelector('#department-grid').textContent, /My custom research team/);

  change(window, picker, 'en');
  await settle();
  assert.equal(document.documentElement.lang, 'en');
  assert.match(document.querySelector('#page-title').textContent, /Command center/);
  assert.match(document.querySelector('#department-grid').textContent, /Strategy/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /What needs to be done/);
  assert.equal(window.localStorage.getItem('hq.language'), 'en');
  assert.equal(backend.settings.language, 'en');

  change(window, picker, 'ko');
  await settle();
  assert.equal(document.documentElement.lang, 'ko');
  assert.match(document.querySelector('#page-title').textContent, /지휘 통제실/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /어떤 일을 맡길까요/);
  assert.equal(backend.settings.language, 'ko');
  const saves = calls.filter(call => call.url === '/api/settings');
  assert.deepEqual(saves.map(call => call.body), [{ language: 'en' }, { language: 'ko' }]);
  assert.ok(saves.every(call => call.headers['x-hq-token'] === 'test-csrf-token'));
  assert.equal(backend.settings.workspace, initial.settings.workspace, 'changing display language must preserve the project directory');
});

test('dispatch sends the state CSRF token and requires an explicit selection for file edits', async t => {
  const { window, document, calls } = await loadUI(t);
  const prompt = document.querySelector('#dispatch-prompt');
  const form = document.querySelector('#dispatch-form');
  const permission = document.querySelector('#write-permission');
  assert.equal(permission.checked, false);
  change(window, document.querySelector('#dispatch-priority'), 'high');
  prompt.value = '  프로젝트 구조와 보완 사항을 분석해줘.  ';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  let submits = calls.filter(call => call.url === '/api/tasks');
  assert.equal(submits.length, 1);
  assert.equal(submits[0].headers['x-hq-token'], 'test-csrf-token');
  assert.equal(submits[0].headers['content-type'], 'application/json');
  assert.deepEqual(submits[0].body, {
    prompt: '프로젝트 구조와 보완 사항을 분석해줘.', departmentId: 'strategy', provider: 'codex', priority: 'high', permission: 'read-only',
  });
  assert.equal(prompt.value, '', 'successful dispatch clears the composer');
  assert.equal(document.querySelectorAll('#mission-rows tr').length, 1);

  permission.checked = true;
  permission.dispatchEvent(new window.Event('change', { bubbles: true }));
  prompt.value = '선택한 폴더에 README를 작성해줘.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  submits = calls.filter(call => call.url === '/api/tasks');
  assert.equal(submits.length, 2);
  assert.equal(submits[1].body.permission, 'workspace-write');
  assert.equal(document.querySelector('#dispatch-submit').disabled, false);
});

test('model output, task titles, department names and streamed events are rendered as text', async t => {
  const payload = '<img src=x onerror="window.HQ_XSS=1"><script>window.HQ_XSS=2</script>';
  const initial = sampleState();
  initial.departments[0].name = payload;
  const task = {
    id: 'untrusted-output-task', title: payload, prompt: payload, departmentId: 'strategy', provider: 'codex',
    status: 'completed', priority: 'normal', permission: 'read-only', demo: false, createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), output: payload,
    logs: [], usage: { inputTokens: 17, outputTokens: 22 },
  };
  initial.tasks.push(task);
  initial.events.push({ id: 'untrusted-event', timestamp: new Date().toISOString(), taskId: task.id, departmentId: 'strategy', provider: 'codex', type: 'tool', text: payload });
  const { window, document, streams, calls, runtimeErrors } = await loadUI(t, initial);
  assert.equal(document.querySelector('.inspector-result pre').textContent, payload);
  assert.equal(document.querySelector('.task-name').textContent, payload);
  assert.equal(document.querySelector('.department-name').textContent, payload);
  assert.equal(document.querySelector('.feed-entry-text').textContent, payload);
  assert.equal(document.querySelector('img[src="x"]'), null);
  assert.equal(window.HQ_XSS, undefined);

  const updated = clone(initial);
  updated.tasks[0].output = `${payload}\nA streamed update`;
  streams[0].state(updated);
  await settle();
  assert.equal(document.querySelector('.inspector-result pre').textContent, `${payload}\nA streamed update`);
  assert.equal(document.querySelector('img[src="x"]'), null);
  assert.equal(window.HQ_XSS, undefined);
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
  assert.deepEqual(runtimeErrors.map(error => error.message), []);
});
