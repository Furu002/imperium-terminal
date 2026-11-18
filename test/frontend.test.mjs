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
  assert.match(document.querySelector('#page-title').textContent, /AI組織図/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /どのような作業/);
  assert.match(document.querySelector('#department-grid').textContent, /戦略企画室/);
  assert.match(document.querySelector('#department-grid').textContent, /My custom research team/);

  change(window, picker, 'en');
  await settle();
  assert.equal(document.documentElement.lang, 'en');
  assert.match(document.querySelector('#page-title').textContent, /AI Organization/);
  assert.match(document.querySelector('#department-grid').textContent, /Strategy/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /What needs to be done/);
  assert.equal(window.localStorage.getItem('hq.language'), 'en');
  assert.equal(backend.settings.language, 'en');

  change(window, picker, 'ko');
  await settle();
  assert.equal(document.documentElement.lang, 'ko');
  assert.match(document.querySelector('#page-title').textContent, /AI 조직도/);
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
    prompt: '프로젝트 구조와 보완 사항을 분석해줘.', departmentId: 'strategy', priority: 'high', permission: 'read-only',
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

function organizationTask(overrides = {}) {
  return {
    id: 'org-running-task', title: '신규 기능의 실행 계획 작성', prompt: '다음 기능의 실행 계획을 작성해줘.',
    departmentId: 'strategy', provider: 'codex', status: 'running', priority: 'normal', permission: 'read-only',
    demo: false, createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: null,
    output: '', error: null, logs: [], usage: { inputTokens: 0, outputTokens: 0 }, ...overrides,
  };
}

test('organization is the first view and reflects the commander, real providers, and configured departments', async t => {
  const initial = sampleState();
  const { document, calls } = await loadUI(t, initial);
  assert.equal(document.querySelector('.app-shell').dataset.view, 'overview');
  assert.match(document.querySelector('#page-title').textContent, /AI 조직도/);
  assert.equal(document.querySelectorAll('#org-chart-root > .org-commander-node').length, 1);
  assert.equal(document.querySelector('.org-commander-name').textContent, '본부장');
  assert.equal(document.querySelectorAll('#org-model-branches > .org-model-branch').length, 2);
  assert.equal(document.querySelector('.org-provider-node[data-provider="codex"]').dataset.status, 'ready');
  assert.equal(document.querySelector('.org-provider-node[data-provider="claude"]').dataset.status, 'missing');
  const cards = [...document.querySelectorAll('.org-agent-card')];
  assert.equal(cards.length, initial.departments.length);
  for (const department of initial.departments) {
    const card = document.querySelector(`.org-agent-card[data-department-id="${department.id}"]`);
    assert.equal(card.closest('.org-model-branch').dataset.provider, department.provider);
    assert.equal(card.dataset.provider, department.provider);
    assert.equal(card.querySelector('.org-agent-name').textContent, department.name);
    assert.equal(card.querySelector('.org-agent-role').textContent, department.role);
    assert.equal(card.dataset.status, department.provider === 'codex' ? 'idle' : 'unavailable');
  }
  assert.match(document.querySelector('#org-summary [data-metric="providers"] .org-summary-value').textContent, /1\s*\/\s*2/);
  assert.equal(Number(document.querySelector('#org-summary [data-metric="departments"] .org-summary-value').textContent), 4);
  assert.equal(Number(document.querySelector('#org-summary [data-metric="running"] .org-summary-value').textContent), 0);
  assert.equal(calls.filter(call => call.method !== 'GET').length, 0, 'organization overview is read-only until the commander issues a task');
});

test('organization cards follow streamed running, queued, and completed tasks without fabricating activity', async t => {
  const initial = sampleState();
  const { document, streams, calls } = await loadUI(t, initial);
  const updated = clone(initial);
  updated.tasks = [
    organizationTask(),
    organizationTask({ id: 'org-queued-task', departmentId: 'research', title: '프로젝트 자료 조사', status: 'queued', startedAt: null }),
  ];
  streams[0].state(updated);
  await settle();
  let strategy = document.querySelector('.org-agent-card[data-department-id="strategy"]');
  const research = document.querySelector('.org-agent-card[data-department-id="research"]');
  assert.equal(strategy.dataset.status, 'running');
  assert.match(strategy.querySelector('.org-agent-task').textContent, /신규 기능의 실행 계획 작성/);
  assert.equal(research.dataset.status, 'queued');
  assert.match(research.querySelector('.org-agent-task').textContent, /프로젝트 자료 조사/);
  assert.equal(document.querySelector('.org-agent-card[data-department-id="engineering"]').dataset.status, 'unavailable');
  assert.equal(Number(document.querySelector('#org-summary [data-metric="running"] .org-summary-value').textContent), 1);

  updated.tasks[0].status = 'completed';
  updated.tasks[0].finishedAt = new Date().toISOString();
  streams[0].state(updated);
  await settle();
  strategy = document.querySelector('.org-agent-card[data-department-id="strategy"]');
  assert.equal(strategy.dataset.status, 'idle');
  assert.equal(document.querySelector('.org-agent-card[data-department-id="research"]').dataset.status, 'queued');
  assert.equal(Number(document.querySelector('#org-summary [data-metric="running"] .org-summary-value').textContent), 0);
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
});

test('organization shows offline state when the server disconnects and restores actual provider state on reconnect', async t => {
  const initial = sampleState();
  const { window, document, streams, runtimeErrors } = await loadUI(t, initial);
  assert.equal(document.querySelector('.org-agent-card[data-department-id="strategy"]').dataset.status, 'idle');
  assert.equal(typeof streams[0].onerror, 'function');
  streams[0].onerror(new window.Event('error'));
  await settle();
  assert.equal(document.querySelector('.org-provider-node[data-provider="codex"]').dataset.status, 'offline');
  assert.equal(document.querySelector('.org-provider-node[data-provider="claude"]').dataset.status, 'offline');
  for (const card of document.querySelectorAll('.org-agent-card')) assert.equal(card.dataset.status, 'offline');
  streams[0].state(initial);
  await settle();
  assert.equal(document.querySelector('.org-provider-node[data-provider="codex"]').dataset.status, 'ready');
  assert.equal(document.querySelector('.org-provider-node[data-provider="claude"]').dataset.status, 'missing');
  assert.equal(document.querySelector('.org-agent-card[data-department-id="strategy"]').dataset.status, 'idle');
  assert.equal(document.querySelector('.org-agent-card[data-department-id="engineering"]').dataset.status, 'unavailable');
  assert.deepEqual(runtimeErrors.map(error => error.message), []);
});

test('a streamed department reassignment moves its card to the configured provider branch', async t => {
  const initial = sampleState();
  const { document, streams } = await loadUI(t, initial);
  assert.equal(document.querySelector('.org-agent-card[data-department-id="engineering"]').closest('.org-model-branch').dataset.provider, 'claude');
  const updated = clone(initial);
  updated.departments.find(department => department.id === 'engineering').provider = 'codex';
  streams[0].state(updated);
  await settle();
  const card = document.querySelector('.org-agent-card[data-department-id="engineering"]');
  assert.equal(card.closest('.org-model-branch').dataset.provider, 'codex');
  assert.equal(card.dataset.provider, 'codex');
  assert.equal(card.dataset.status, 'idle');
  assert.equal(document.querySelectorAll('.org-model-branch[data-provider="codex"] .org-agent-card').length, 3);
  assert.equal(document.querySelectorAll('.org-model-branch[data-provider="claude"] .org-agent-card').length, 1);
  assert.equal(document.querySelectorAll('.org-agent-card').length, 4);
});

test('organization dispatch buttons select a department and focus operations without sending a model request', async t => {
  const { document, calls } = await loadUI(t);
  const prompt = document.querySelector('#dispatch-prompt');
  prompt.value = '아직 보내지 않은 본부 지시';
  document.querySelector('.org-agent-card[data-department-id="research"] .org-agent-dispatch').click();
  await settle();
  assert.equal(document.querySelector('.app-shell').dataset.view, 'operations');
  assert.equal(document.querySelector('#dispatch-department').value, 'research');
  assert.equal(document.activeElement, prompt);
  assert.equal(prompt.value, '아직 보내지 않은 본부 지시');
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
});

test('organization translates its own labels while custom names and roles remain safe literal text', async t => {
  const name = '<img src=x onerror="window.ORG_XSS=1">Custom team';
  const role = '<script>window.ORG_XSS=2</script>Review & plan';
  const initial = sampleState();
  initial.settings.language = 'en';
  initial.departments[0].name = name;
  initial.departments[0].role = role;
  const { window, document, calls } = await loadUI(t, initial);
  assert.match(document.querySelector('#page-title').textContent, /AI Organization/);
  assert.equal(document.querySelector('.org-commander-name').textContent, 'Commander');
  assert.match(document.querySelector('.org-agent-card[data-department-id="engineering"] .org-agent-name').textContent, /Engineering/);
  assert.match(document.querySelector('.org-agent-dispatch').textContent, /Assign work/);
  for (const language of ['en', 'ja']) {
    if (language !== 'en') { change(window, document.querySelector('#language-select'), language); await settle(); }
    const card = document.querySelector('.org-agent-card[data-department-id="strategy"]');
    assert.equal(card.querySelector('.org-agent-name').textContent, name);
    assert.equal(card.querySelector('.org-agent-role').textContent, role);
    assert.equal(card.querySelector('img'), null);
    assert.equal(card.querySelector('script'), null);
    assert.equal(window.ORG_XSS, undefined);
  }
  assert.match(document.querySelector('#page-title').textContent, /AI組織図/);
  assert.equal(document.querySelector('.org-commander-name').textContent, '本部長');
  assert.match(document.querySelector('.org-agent-card[data-department-id="engineering"] .org-agent-name').textContent, /開発本部/);
  assert.match(document.querySelector('.org-agent-dispatch').textContent, /業務を指示/);
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
});
