import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const script = await readFile(new URL('../public/team-mode.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const plan = {
  roles: [
    { id: 'research', name: 'Research', role: 'Gather evidence', provider: 'claude', task: 'Inspect the material.', dependsOn: [] },
    { id: 'final', name: 'Lead', role: 'Combine evidence', provider: 'codex', task: 'Write the result.', dependsOn: ['research'] },
  ],
  finalRoleId: 'final',
};
const team = (turn, workspace = '/project-a') => ({
  id: 'team-1', workspace, title: 'Goal', plannerProvider: 'codex', plan: turn.status === 'planning' ? null : plan,
  turns: [{ id: 'turn-1', prompt: 'Goal', taskIds: {}, permission: 'read-only', ...turn }],
});

function fixture(t, responder = async () => ({ team: team({ status: 'planning' }) })) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><section id="conversations-section" class="ic-chat">
    <aside class="ic-sidebar"><header class="ic-sidebar-heading"></header></aside>
    <div class="ic-main"><textarea id="individual-draft"></textarea></div>
  </section></html>`, { url: 'http://localhost:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  const requests = [], opened = [];
  window.ImperiumMascots = { createMark(provider) { const image = document.createElement('img'); image.alt = ''; image.dataset.brand = provider; return image; } };
  window.eval(script);
  const root = document.querySelector('#conversations-section');
  const desk = window.ImperiumTeam.mount(root, {
    api: async (route, options) => { requests.push({ route, ...clone(options) }); return responder(route, options); },
    onSelectTask: id => opened.push(id),
  });
  const initial = { settings: { workspace: '/project-a' }, teamRuns: [], tasks: [],
    providers: [{ id: 'codex', status: 'ready', authenticated: true }, { id: 'claude', status: 'ready', authenticated: true }, { id: 'ollama', status: 'missing' }] };
  const query = selector => root.querySelector(selector);
  const update = (patch = {}, options = {}) => desk.render({ ...initial, ...patch }, { language: 'en', connected: true, ...options });
  const enter = value => { const input = query('.team-composer textarea'); input.value = value; input.dispatchEvent(new window.Event('input', { bubbles: true })); return input; };
  const send = () => query('.team-composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  update();
  return { root, document, desk, requests, opened, query, update, enter, send };
}

test('team mode requires explicit dispatch and preserves individual chat and read-only defaults', async t => {
  const f = fixture(t);
  f.query('#individual-draft').value = 'unsent individual';
  assert.equal(f.query('.team-page').hidden, true);
  f.query('.team-mode-toggle').click();
  assert.equal(f.root.dataset.chatMode, 'team');
  assert.equal(f.query('.team-composer input[type=checkbox]').checked, false);
  assert.equal(f.query('.team-compose-controls select').options.length, 3);
  const input = f.enter('  Goal  ');
  assert.equal(f.document.activeElement, input);
  f.update();
  assert.equal(input.value, '  Goal  ');
  assert.equal(f.document.activeElement, input);
  assert.equal(f.requests.length, 0);
  f.send();
  f.send();
  await tick();
  assert.deepEqual(f.requests, [{ route: '/api/teams', method: 'POST', body: { workspace: '/project-a', prompt: 'Goal', permission: 'read-only' } }]);
  assert.equal(f.query('.team-heading .team-status').textContent, 'Planning');
  assert.equal(f.query('.team-stop').hidden, false);
  assert.equal(f.query('.team-composer [type=submit]').disabled, true);
  f.query('.team-actions button').click();
  assert.equal(f.root.hasAttribute('data-chat-mode'), false);
  assert.equal(f.query('#individual-draft').value, 'unsent individual');
});

test('team structure follows actual dependencies and status, opens the actual result, and submits a follow-up to the same team', async t => {
  const f = fixture(t, async () => ({ team: { ...team({ status: 'completed' }), turns: [{ id: 'turn-1', status: 'completed' }, { id: 'turn-2', status: 'running' }] } }));
  const complete = team({ status: 'completed', taskIds: { research: 'task-research', final: 'task-lead' }, finalTaskId: 'task-lead', result: '<b>Evidence</b>', resultTruncated: true });
  const tasks = [
    { id: 'task-research', workspace: '/project-a', status: 'completed', reportedModel: 'Claude example' },
    { id: 'task-lead', workspace: '/project-a', status: 'completed', reportedModel: 'Codex example' },
  ];
  f.update({ teamRuns: [complete], tasks });
  f.query('.team-mode-toggle').click();
  assert.equal(f.query('.team-graph').hidden, true);
  f.query('.team-history > button').click();
  assert.equal(f.root.querySelectorAll('.team-stage').length, 2);
  assert.match(f.query('.team-role[data-final=true] .team-role-dependencies').textContent, /Research/);
  assert.match(f.query('.team-role-provider').textContent, /Claude example/);
  assert.equal(f.query('.team-role-heading img').dataset.brand, 'claude');
  assert.equal(f.query('.team-result-text').textContent, '<b>Evidence</b>');
  assert.equal(f.query('.team-result-text b'), null);
  assert.equal(f.query('.team-turns').nextElementSibling, f.query('.team-result'));
  f.query('.team-result-heading button').click();
  assert.deepEqual(f.opened, ['task-lead']);
  f.enter('Follow up');
  f.send();
  await tick();
  assert.deepEqual(f.requests[0], { route: '/api/teams/team-1/turns', method: 'POST', body: { workspace: '/project-a', prompt: 'Follow up', permission: 'read-only' } });
  assert.equal(f.query('.team-turns').hidden, false);
  assert.equal(f.query('.team-request').nextElementSibling, f.query('.team-result'));
});

test('a delayed run stays in its origin project and changing access policy resets the write opt-in', async t => {
  let complete;
  const f = fixture(t, () => new Promise(resolve => { complete = resolve; }));
  f.query('.team-mode-toggle').click();
  f.query('.team-composer input[type=checkbox]').click();
  f.enter('Project A');
  f.send();
  assert.equal(f.requests[0].body.permission, 'workspace-write');
  f.update({ settings: { workspace: '/project-b', accessPolicy: 'read-only' } });
  f.enter('Project B draft');
  complete({ team: team({ status: 'planning' }) });
  await tick();
  assert.equal(f.query('.team-composer textarea').value, 'Project B draft');
  assert.equal(f.query('.team-history > button'), null);
  assert.equal(f.query('.team-composer input[type=checkbox]').checked, false);
  assert.equal(f.query('.team-composer input[type=checkbox]').disabled, true);
  f.update();
  assert.notEqual(f.query('.team-history > button'), null);
  assert.equal(f.query('.team-composer textarea').value, '');
});
