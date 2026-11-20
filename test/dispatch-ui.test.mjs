import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { JSDOM } from 'jsdom';

const [html, script] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
]);

const alpha = '/projects/alpha';
const beta = '/projects/beta';
const snapshot = (workspace, { revision, token = 'test-token', tasks = [] } = {}) => ({
  settings: { workspace, accessPolicy: 'task-confirm', language: 'ko' },
  departments: [{ id: 'engineering', name: 'Engineering', provider: 'codex' }],
  providers: [{ id: 'codex', name: 'Codex', status: 'ready', authenticated: true }],
  server: { csrfToken: token, snapshotRevision: revision },
  tasks,
  events: [],
});
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });

async function renderer(t, fetch) {
  const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const field = id => window.document.getElementById(id);
  let stream;
  window.EventSource = class extends window.EventTarget {
    constructor() { super(); stream = this; }
  };
  window.fetch = fetch;
  window.eval(script);
  await setImmediate();
  assert.ok(stream);

  const emit = value => stream.dispatchEvent(new window.MessageEvent('state', { data: JSON.stringify(value) }));
  const submit = async () => {
    field('dispatch-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await setImmediate();
  };
  return { field, emit, submit, stream, document: window.document };
}

test('switching projects scopes dispatch drafts and requires a new file-edit opt-in', async t => {
  const requests = [];
  const { field, emit, submit } = await renderer(t, async (path, options) => {
    if (path === '/api/state') return response(snapshot(alpha));
    assert.equal(path, '/api/tasks');
    requests.push(JSON.parse(options.body));
    return requests.length === 1 ? response({ error: 'Invalid operation' }, 400) : response({}, 201);
  });
  const permission = field('write-permission');
  const priority = field('dispatch-priority');
  const prompt = field('dispatch-prompt');
  const error = field('dispatch-error');

  permission.checked = true;
  priority.value = 'high';
  prompt.value = 'Draft a change in Alpha';
  emit(snapshot(alpha));
  assert.equal(permission.checked, true);
  await submit();
  assert.equal(error.hidden, false);

  emit(snapshot(beta));
  assert.equal(prompt.value, '');
  assert.equal(permission.checked, false);
  assert.equal(priority.value, 'normal');
  assert.equal(error.hidden, true);
  prompt.value = 'Review the existing Beta configuration';
  await submit();
  assert.deepEqual(requests.map(({ workspace, permission, priority }) => ({ workspace, permission, priority })), [
    { workspace: alpha, permission: 'workspace-write', priority: 'high' },
    { workspace: beta, permission: 'read-only', priority: 'normal' },
  ]);

  emit(snapshot(alpha));
  assert.equal(prompt.value, 'Draft a change in Alpha');
  assert.equal(priority.value, 'high');
  assert.equal(permission.checked, false);
  assert.equal(error.hidden, true);
});

test('a late HTTP snapshot cannot restore an old workspace over a newer event, including after a restart', async t => {
  const delayed = Promise.withResolvers();
  const afterRestart = Promise.withResolvers();
  const snapshots = [response(snapshot(alpha, { revision: 1 })), delayed.promise, afterRestart.promise];
  const { field, emit, stream } = await renderer(t, path => {
    assert.equal(path, '/api/state');
    return snapshots.shift();
  });
  const projectName = () => field('project-switcher').textContent.trim();
  const prompt = field('dispatch-prompt');
  assert.match(projectName(), /alpha$/);
  stream.onopen();
  emit(snapshot(beta, { revision: 3 }));
  prompt.value = 'Retain this Beta draft';
  delayed.resolve(response(snapshot(alpha, { revision: 2 })));
  await setImmediate();
  assert.match(projectName(), /beta$/);
  assert.equal(prompt.value, 'Retain this Beta draft');

  stream.onopen();
  emit(snapshot(beta, { revision: 1, token: 'restarted-server' }));
  afterRestart.resolve(response(snapshot(alpha, { revision: 4 })));
  await setImmediate();
  assert.match(projectName(), /beta$/);
  assert.equal(prompt.value, 'Retain this Beta draft');
});

test('the Operations table labels stopping an entire team turn and reports the actual cancellation result', async t => {
  const base = { departmentId: 'engineering', provider: 'codex', status: 'running', title: 'Write tests', createdAt: '2026-11-20T00:00:00Z' };
  const team = { ...base, id: 'team-role', teamId: 'team' };
  const regular = { ...base, id: 'operation', title: 'Run tests' };
  const { document, field } = await renderer(t, async path => {
    if (path === '/api/state') return response(snapshot(alpha, { tasks: [team, regular] }));
    if (path === '/api/tasks/team-role/cancel') return response({ task: { ...team, status: 'cancelled' } });
    assert.equal(path, '/api/tasks/operation/cancel');
    return response({ task: { ...regular, status: 'completed' } });
  });
  const actions = [...document.querySelectorAll('.cancel-task')];
  const teamAction = actions.find(action => action.title === '팀 실행 전체 중지');
  const regularAction = actions.find(action => action.title === '작업 취소');
  assert.match(teamAction.getAttribute('aria-label'), /^팀 실행 전체 중지/);
  assert.match(regularAction.getAttribute('aria-label'), /^작업 취소/);

  teamAction.click();
  await setImmediate();
  assert.match(field('toast-container').textContent, /팀 실행을 중지했습니다/);
  document.querySelector('.cancel-task').click();
  await setImmediate();
  assert.match(field('toast-container').textContent, /이미 종료된 작업입니다/);
  assert.doesNotMatch(field('toast-container').textContent, /작업을 취소했습니다/);
});
