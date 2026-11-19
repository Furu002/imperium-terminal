import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const [html, script, outputScript] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/output-view.js', import.meta.url), 'utf8'),
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

async function loadUI(t, initial = sampleState(), savedLanguage, { taskDetails = {}, fetchTaskDetail, stateSnapshots = {} } = {}) {
  const virtualConsole = new VirtualConsole();
  const runtimeErrors = [];
  virtualConsole.on('jsdomError', error => runtimeErrors.push(error));
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4310/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const calls = [];
  const streams = [];
  const clipboardWrites = [];
  const backend = clone(initial);
  window.addEventListener('error', event => runtimeErrors.push(event.error || new Error(event.message)));
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.URL.createObjectURL = () => 'blob:mock-export';
  window.URL.revokeObjectURL = () => {};
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async value => { clipboardWrites.push(value); } }, configurable: true });
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
    const detailMatch = /^\/api\/tasks\/([^/?]+)$/.exec(url);
    if (url === '/api/state' && method === 'GET') data = { ...backend, ...stateSnapshots[backend.settings.workspace], settings: backend.settings };
    else if (detailMatch && method === 'GET') {
      const id = decodeURIComponent(detailMatch[1]);
      const task = fetchTaskDetail ? await fetchTaskDetail(id, { backend, url }) : taskDetails[id];
      if (!task) throw new Error(`No mocked task detail for ${id}`);
      data = { task };
    }
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
  window.eval(outputScript); window.eval(script);
  await settle();
  assert.deepEqual(runtimeErrors.map(error => error.message), [], 'the app should initialize without runtime errors');
  t.after(() => { dom.window.close(); });
  return { window, document: window.document, backend, calls, streams, runtimeErrors, clipboardWrites };
}

function change(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function completedTask(id, title, output, extra = {}) {
  return { id, title, prompt: `Instruction for ${title}`, departmentId: 'strategy', provider: 'codex', status: 'completed', priority: 'normal', permission: 'read-only', createdAt: '2026-11-18T03:00:00.000Z', startedAt: '2026-11-18T03:00:01.000Z', finishedAt: '2026-11-18T03:00:30.000Z', output, error: null, logs: [], usage: { inputTokens: 12, outputTokens: 34 }, demo: false, ...extra };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function rawOutput(document) {
  const result = document.querySelector('.inspector-result');
  result.querySelectorAll('.io-mode')[1].click();
  const raw = result.querySelector('.io-raw-view');
  while (raw.querySelector('.io-load-more')) raw.querySelector('.io-load-more').click();
  return raw.querySelector('pre').textContent;
}

test('a selected truncated task loads its complete output once and copies the full result across repeated metadata snapshots', async t => {
  const full = 'Complete task result 한글🙂\n'.repeat(10000).slice(0, 200000), preview = full.slice(0, 2000), detail = deferred();
  const short = completedTask('short-task', 'Short operation', 'A short complete result.');
  const long = completedTask('long-task', 'Long operation', preview, { detailsTruncated: true, outputChars: full.length });
  const initial = sampleState({ tasks: [short, long] });
  const { document, calls, streams, clipboardWrites } = await loadUI(t, initial, undefined, { fetchTaskDetail: id => { assert.equal(id, long.id); return detail.promise; } });
  assert.equal(calls.filter(call => call.url === '/api/tasks/long-task').length, 0, 'unselected summaries should not fetch large details');
  document.querySelector('#mission-rows tr[aria-label^="Long operation"]').click();
  await settle();
  assert.equal(calls.filter(call => call.url === '/api/tasks/long-task').length, 1); assert.equal(rawOutput(document), preview); assert.equal(document.querySelector('#copy-output').disabled, true);
  document.querySelector('#copy-output').click(); assert.deepEqual(clipboardWrites, []);
  streams[0].state(clone(initial)); streams[0].state(clone(initial)); await settle();
  assert.equal(calls.filter(call => call.url === '/api/tasks/long-task').length, 1, 'metadata rerenders should share the pending detail request');
  detail.resolve({ ...long, output: full, logs: [{ id: 'full-log', type: 'text', text: full }], detailsTruncated: false }); await settle();
  assert.equal(rawOutput(document), full); assert.equal(document.querySelector('#copy-output').disabled, false);
  document.querySelector('#copy-output').click(); await settle(); assert.deepEqual(clipboardWrites, [full]);
  streams[0].state(clone(initial)); streams[0].state(clone(initial)); await settle();
  assert.equal(calls.filter(call => call.url === '/api/tasks/long-task').length, 1); assert.equal(rawOutput(document), full);
});

test('a delayed full-output response from the old project cannot replace the current inspector or copied output', async t => {
  const oldDetail = deferred(), oldTask = completedTask('project-a-task', 'Project A result', 'A preview', { detailsTruncated: true, outputChars: 50000 });
  const initial = sampleState({ tasks: [oldTask] });
  const { document, streams, clipboardWrites, calls } = await loadUI(t, initial, undefined, { fetchTaskDetail: () => oldDetail.promise });
  assert.equal(calls.filter(call => call.url === '/api/tasks/project-a-task').length, 1);
  const projectB = sampleState({ settings: { ...initial.settings, workspace: 'C:\\Project B' }, tasks: [completedTask('project-b-task', 'Project B result', 'Only the current project B result.')] });
  streams[0].state(projectB); await settle();
  oldDetail.resolve({ ...oldTask, output: 'OLD PROJECT A FULL OUTPUT'.repeat(2000), detailsTruncated: false }); await settle();
  assert.equal(document.querySelector('.inspector-meta h3').textContent, 'Project B result'); assert.equal(rawOutput(document), 'Only the current project B result.');
  document.querySelector('#copy-output').click(); await settle(); assert.deepEqual(clipboardWrites, ['Only the current project B result.']);
});

test('returning to a project retries a full detail response that was discarded while another project was active', async t => {
  const firstDetail = deferred(), task = completedTask('return-to-a-task', 'Project A long result', 'A preview', { detailsTruncated: true, outputChars: 40000 });
  const full = { ...task, output: 'Project A complete output\n'.repeat(1600), detailsTruncated: false };
  let requests = 0;
  const initial = sampleState({ tasks: [task] });
  const { document, streams, calls } = await loadUI(t, initial, undefined, { fetchTaskDetail: () => ++requests === 1 ? firstDetail.promise : Promise.resolve(full) });
  const projectB = sampleState({ settings: { ...initial.settings, workspace: 'C:\\Project B' } });
  streams[0].state(projectB); firstDetail.resolve(full); await settle();
  streams[0].state(clone(initial)); await settle();
  assert.equal(calls.filter(call => call.url === '/api/tasks/return-to-a-task').length, 2, 'a finished but discarded request must not remain marked in flight');
  assert.equal(rawOutput(document), full.output); assert.equal(document.querySelector('#copy-output').disabled, false);
});

test('project switching isolates composer drafts and restores each project draft on return', async t => {
  const initial = sampleState();
  const { window, document, streams, calls } = await loadUI(t, initial);
  const prompt = document.querySelector('#dispatch-prompt'); prompt.value = 'Only project A draft'; change(window, document.querySelector('#dispatch-provider'), 'codex');
  const projectB = sampleState({ settings: { ...initial.settings, workspace: 'C:\\Project B' } });
  streams[0].state(projectB); await settle(); assert.equal(prompt.value, ''); assert.equal(document.querySelector('#dispatch-provider').value, '');
  prompt.value = 'Only project B draft'; change(window, document.querySelector('#dispatch-provider'), 'claude');
  streams[0].state(clone(initial)); await settle(); assert.equal(prompt.value, 'Only project A draft'); assert.equal(document.querySelector('#dispatch-provider').value, 'codex');
  streams[0].state(clone(projectB)); await settle(); assert.equal(prompt.value, 'Only project B draft'); assert.equal(document.querySelector('#dispatch-provider').value, 'claude');
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0, 'switching projects must not dispatch or persist a draft as a task');
});

test('settings workspace changes clear the previous project draft and select the new project task', async t => {
  const initial = sampleState({ tasks: [completedTask('settings-project-a-task', 'Settings project A result', 'Project A output.')] });
  initial.settings.localOnly = false; initial.settings.identity = { name: 'Sato', title: 'Workspace owner' };
  const projectB = 'C:\\Settings Project B';
  const snapshots = { [projectB]: { departments: clone(initial.departments), tasks: [completedTask('settings-project-b-task', 'Settings project B result', 'Project B output.')] } };
  const { window, document, calls } = await loadUI(t, initial, undefined, { stateSnapshots: snapshots });
  change(window, document.querySelector('#dispatch-department'), 'research');
  document.querySelector('#dispatch-prompt').value = 'A research draft must remain in project A';
  change(window, document.querySelector('#dispatch-provider'), 'codex');
  assert.equal(document.querySelector('.inspector-meta h3').textContent, 'Settings project A result');
  document.querySelector('#settings-top').click(); document.querySelector('#settings-workspace').value = projectB;
  document.querySelector('#settings-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.deepEqual(calls.find(call => call.url === '/api/settings' && call.method === 'POST').body, { workspace: projectB });
  assert.equal(document.querySelector('#dispatch-prompt').value, ''); assert.equal(document.querySelector('#dispatch-provider').value, '');
  assert.equal(document.querySelector('.inspector-meta h3').textContent, 'Settings project B result'); assert.equal(rawOutput(document), 'Project B output.');
  assert.equal(document.querySelector('#settings-dialog').open, false); assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
});

test('settings workspace round trips restore the research department prompt and provider even when projects share department IDs', async t => {
  const initial = sampleState(); initial.settings.localOnly = false; initial.settings.identity = { name: 'Sato', title: 'Workspace owner' };
  const projectA = initial.settings.workspace, projectB = 'C:\\Settings Project B';
  const { window, document, calls } = await loadUI(t, initial, undefined, { stateSnapshots: { [projectB]: { departments: clone(initial.departments), tasks: [] } } });
  change(window, document.querySelector('#dispatch-department'), 'research'); change(window, document.querySelector('#dispatch-provider'), 'codex'); document.querySelector('#dispatch-prompt').value = 'Restore this research instruction for A';
  document.querySelector('#settings-top').click(); document.querySelector('#settings-workspace').value = projectB; document.querySelector('#settings-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  change(window, document.querySelector('#dispatch-department'), 'engineering'); change(window, document.querySelector('#dispatch-provider'), 'claude'); document.querySelector('#dispatch-prompt').value = 'A different engineering draft for B';
  document.querySelector('#settings-top').click(); document.querySelector('#settings-workspace').value = projectA; document.querySelector('#settings-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(document.querySelector('#dispatch-prompt').value, 'Restore this research instruction for A'); assert.equal(document.querySelector('#dispatch-provider').value, 'codex'); assert.equal(document.querySelector('#dispatch-department').value, 'research');
  assert.deepEqual(calls.filter(call => call.url === '/api/settings' && call.method === 'POST').map(call => call.body), [{ workspace: projectB }, { workspace: projectA }]);
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
});

test('settings saves send only changed fields and preserve task scheduling settings for identity-only edits', async t => {
  const initial = sampleState(); initial.settings.localOnly = false; initial.settings.identity = { name: 'Sato', title: 'Workspace owner' };
  initial.tasks = [{ ...completedTask('active-task', 'Active operation', ''), status: 'running', finishedAt: null }];
  const { window, document, calls, backend } = await loadUI(t, initial);
  document.querySelector('#settings-top').click(); document.querySelector('#settings-name').value = 'Rin';
  document.querySelector('#settings-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  let saves = calls.filter(call => call.url === '/api/settings' && call.method === 'POST');
  assert.deepEqual(saves.map(call => call.body), [{ identity: { name: 'Rin', title: 'Workspace owner' } }]); assert.equal(saves[0].headers['x-hq-token'], 'test-csrf-token'); assert.equal(backend.settings.workspace, initial.settings.workspace); assert.equal(backend.settings.maxConcurrent, 2);
  document.querySelector('#settings-top').click(); document.querySelector('#settings-local-only').checked = true;
  document.querySelector('#settings-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  saves = calls.filter(call => call.url === '/api/settings' && call.method === 'POST'); assert.deepEqual(saves.at(-1).body, { localOnly: true });
  document.querySelector('#settings-top').click();
  document.querySelector('#settings-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  saves = calls.filter(call => call.url === '/api/settings' && call.method === 'POST'); assert.deepEqual(saves.at(-1).body, {});
});

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
  assert.ok(missing.querySelector('[data-provider-setup="claude"]'), 'connection setup should route to the official account guide');
  assert.equal(missing.querySelector('.provider-command'), null, 'legacy settings should not guess installation or login commands');
  assert.equal(document.querySelectorAll('input[type="password"]').length, 0, 'subscription setup must not collect secrets');
});

test('missing Gemini Copilot and Ollama providers route to account setup without guessed Codex commands or automatic actions', async t => {
  const initial = sampleState();
  initial.providers.push(...[
    ['gemini', 'Gemini CLI'], ['copilot', 'GitHub Copilot CLI'], ['ollama', 'Ollama'],
  ].map(([id, name]) => ({ id, name, installed: false, authenticated: false, status: 'missing', detail: 'Not installed' })));
  const { document, calls } = await loadUI(t, initial);
  for (const id of ['gemini', 'copilot', 'ollama']) {
    document.querySelector('#settings-top').click();
    const card = document.querySelector(`.provider-card[data-provider="${id}"]`);
    assert.ok(card); assert.match(card.textContent, /설치 필요/);
    assert.ok(!card.textContent.includes('@openai/codex'), `${id} must not display a guessed Codex installation command`);
    assert.equal(card.querySelector('.provider-command'), null);
    const guide = card.querySelector(`[data-provider-setup="${id}"]`); assert.ok(guide); guide.click();
    assert.equal(document.querySelector('#settings-dialog').open, false); assert.equal(document.querySelector('.app-shell').dataset.view, 'accounts'); assert.match(document.querySelector('#page-title').textContent, /AI 계정/);
  }
  assert.ok(calls.every(call => call.method === 'GET' && call.url === '/api/state'), 'setup navigation must not install a CLI, send terminal commands, or start a model');
});

test('frontend restores the saved server language and persists Korean, English and Japanese changes', async t => {
  const initial = sampleState();
  initial.settings.language = 'ja';
  initial.departments[2].name = 'My custom research team';
  const { window, document, backend, calls } = await loadUI(t, initial);
  const picker = document.querySelector('#language-select');
  assert.equal(document.documentElement.lang, 'ja');
  assert.match(document.querySelector('#page-title').textContent, /組織図/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /どのような作業/);
  assert.match(document.querySelector('#department-grid').textContent, /戦略企画室/);
  assert.match(document.querySelector('#department-grid').textContent, /My custom research team/);

  change(window, picker, 'en');
  await settle();
  assert.equal(document.documentElement.lang, 'en');
  assert.match(document.querySelector('#page-title').textContent, /Organization/);
  assert.match(document.querySelector('#department-grid').textContent, /Strategy/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /What needs to be done/);
  assert.equal(window.localStorage.getItem('hq.language'), 'en');
  assert.equal(backend.settings.language, 'en');

  change(window, picker, 'ko');
  await settle();
  assert.equal(document.documentElement.lang, 'ko');
  assert.match(document.querySelector('#page-title').textContent, /조직도/);
  assert.match(document.querySelector('#dispatch-prompt').placeholder, /어떤 일을 맡길까요/);
  assert.equal(backend.settings.language, 'ko');
  const saves = calls.filter(call => call.url === '/api/settings');
  assert.deepEqual(saves.map(call => call.body), [{ language: 'en' }, { language: 'ko' }]);
  assert.ok(saves.every(call => call.headers['x-hq-token'] === 'test-csrf-token'));
  assert.equal(backend.settings.workspace, initial.settings.workspace, 'changing display language must preserve the project directory');
});

test('dispatch sends the state CSRF token and requires an explicit selection for file edits', async t => {
  const { window, document, calls, backend } = await loadUI(t);
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
    prompt: '프로젝트 구조와 보완 사항을 분석해줘.', departmentId: 'strategy', workspace: backend.settings.workspace, priority: 'high', permission: 'read-only',
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
  assert.equal(rawOutput(document), payload);
  assert.equal(document.querySelector('.task-name').textContent, payload);
  assert.equal(document.querySelector('.department-name').textContent, payload);
  assert.equal(document.querySelector('.feed-entry-text').textContent, payload);
  assert.equal(document.querySelector('img[src="x"]'), null);
  assert.equal(window.HQ_XSS, undefined);

  const updated = clone(initial);
  updated.tasks[0].output = `${payload}\nA streamed update`;
  streams[0].state(updated);
  await settle();
  assert.equal(rawOutput(document), `${payload}\nA streamed update`);
  assert.equal(document.querySelector('img[src="x"]'), null);
  assert.equal(window.HQ_XSS, undefined);
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
  assert.deepEqual(runtimeErrors.map(error => error.message), []);
});

test('the inspector integrates readable conversation, exact code copying and a project-scoped expanded view', async t => {
  const output = '# Delivered\n\nA **readable** response.\n\n```js\nconsole.log("ready");\n```';
  const selected = completedTask('readable-task', 'Readable operation', output, { logs: [{ id: 'real-log', type: 'tool', text: 'Read existing source' }] });
  const initial = sampleState({ tasks: [selected] });
  const { document, streams, clipboardWrites } = await loadUI(t, initial);
  assert.equal(document.querySelector('.io-markdown h2').textContent, 'Delivered');
  assert.equal(document.querySelector('.io-request-text').textContent, selected.prompt);
  assert.equal(document.querySelector('.io-task-details').open, false);
  assert.equal(document.querySelector('.io-execution-logs').open, false);
  document.querySelector('.io-code-copy').click(); await settle();
  assert.deepEqual(clipboardWrites, ['console.log("ready");\n']);
  document.querySelector('.io-answer-copy').click(); await settle();
  assert.equal(clipboardWrites.at(-1), output);
  const reading = document.querySelector('.io-markdown');
  document.querySelector('.io-task-details').open = true;
  document.querySelector('#inspector-content').scrollTop = 123;
  streams[0].state(clone(initial)); await settle();
  assert.equal(document.querySelector('.io-markdown'), reading);
  assert.equal(document.querySelector('.io-task-details').open, true);
  assert.equal(document.querySelector('#inspector-content').scrollTop, 123);
  document.querySelector('.io-expand').click();
  assert.equal(document.querySelector('.io-dialog').open, true);
  streams[0].state(sampleState({ settings: { ...initial.settings, workspace: 'C:\\Different Project' }, tasks: [completedTask('other-task', 'Other result', 'Other project output')] })); await settle();
  assert.equal(document.querySelector('.io-dialog'), null);
  assert.equal(document.querySelector('.io-markdown').textContent, 'Other project output');
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
  assert.match(document.querySelector('#page-title').textContent, /조직도/);
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
  assert.match(document.querySelector('#page-title').textContent, /Organization/);
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
  assert.match(document.querySelector('#page-title').textContent, /組織図/);
  assert.equal(document.querySelector('.org-commander-name').textContent, '本部長');
  assert.match(document.querySelector('.org-agent-card[data-department-id="engineering"] .org-agent-name').textContent, /開発本部/);
  assert.match(document.querySelector('.org-agent-dispatch').textContent, /業務を指示/);
  assert.equal(calls.filter(call => call.url === '/api/tasks').length, 0);
});
