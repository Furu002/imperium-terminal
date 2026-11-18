import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = await readFile(new URL('../public/projects.js', import.meta.url), 'utf8');
const settle = async () => { for (let turn = 0; turn < 5; turn++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const projectA = { id: 'project-a', name: 'Project A', workspace: 'C:\\Projects\\A', color: '#C48A5A', departmentCount: 2 };
const projectB = { id: 'project-b', name: 'Project B', workspace: 'C:\\Projects\\B', color: '#73A193', departmentCount: 1 };
const snapshot = (currentProjectId, names = {}) => ({ projects: [projectA, projectB].map(project => ({ ...project, name: names[project.id] || project.name })), currentProjectId });

function setup(t, { onChanged } = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="projects"></div><div id="second-mount"></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom, state = { settings: { workspace: projectA.workspace, language: 'en' }, tasks: [] }, calls = [], selected = [];
  const callbacks = {
    getState: () => state,
    api(path, options = {}) { const response = deferred(); calls.push({ path, method: options.method || 'GET', body: options.body, response }); return response.promise; },
    onChanged: onChanged || (() => Promise.resolve()),
    onSelect: project => selected.push(project.id),
  };
  window.eval(script); window.ImperiumProjects.mount(window.document.querySelector('#projects'), callbacks);
  t.after(() => window.close());
  return { window, document: window.document, state, calls, callbacks, selected, errors };
}
const gets = calls => calls.filter(call => call.path === '/api/projects' && call.method === 'GET');

test('an old mount GET cannot overwrite the selected project after delayed onChanged and a newer reload', async t => {
  const changed = deferred();
  const { window, document, state, calls, selected, errors } = setup(t, { onChanged: () => changed.promise });
  const initialMount = gets(calls)[0];
  const firstRefresh = window.ImperiumProjects.reload();
  assert.equal(gets(calls).length, 2, 'an explicit refresh supersedes an in-flight mount request');
  gets(calls)[1].response.resolve(snapshot(projectA.id)); await firstRefresh;
  document.querySelector('[data-project-id="project-b"] .ip-primary').click();
  const selection = calls.find(call => call.path === '/api/projects/project-b/select'); assert.ok(selection);
  selection.response.resolve({ project: projectB }); await settle();
  assert.equal(document.querySelector('.ip-active').dataset.projectId, projectB.id, 'the successful POST selects the new card before the delayed callback finishes');

  state.settings.workspace = projectB.workspace;
  window.ImperiumProjects.render(state); // Root's state refresh can happen inside onChanged.
  const scopeReload = gets(calls).at(-1);
  changed.resolve(); await settle();
  const selectionReload = gets(calls).at(-1);
  assert.notEqual(selectionReload, scopeReload);
  selectionReload.response.resolve(snapshot(projectB.id, { [projectB.id]: 'Newest project B' })); await settle();
  assert.equal(document.querySelector('.ip-active').dataset.projectId, projectB.id); assert.match(document.querySelector('.ip-active h4').textContent, /Newest project B/);
  assert.deepEqual(selected, [projectB.id]);

  // Both arrive after the newer selection result, in deliberately bad order.
  scopeReload.response.resolve(snapshot(projectA.id, { [projectB.id]: 'Older project B' }));
  initialMount.response.resolve(snapshot(projectA.id, { [projectB.id]: 'Old mount project B' })); await settle();
  assert.equal(document.querySelector('.ip-active').dataset.projectId, projectB.id); assert.equal(document.querySelector('.ip-active h4').textContent, 'Newest project B'); assert.deepEqual(errors, []);
});

test('only the latest refresh may change cards and obsolete errors do not replace current UI feedback', async t => {
  const { window, document, calls, errors } = setup(t);
  gets(calls)[0].response.resolve(snapshot(projectA.id)); await settle();
  const older = window.ImperiumProjects.reload(), oldRequest = gets(calls).at(-1);
  const newer = window.ImperiumProjects.reload(), newRequest = gets(calls).at(-1);
  newRequest.response.resolve(snapshot(projectB.id, { [projectB.id]: 'Latest refresh' })); await newer;
  oldRequest.response.reject(new Error('obsolete refresh error')); await older;
  assert.equal(document.querySelector('.ip-active').dataset.projectId, projectB.id); assert.equal(document.querySelector('.ip-active h4').textContent, 'Latest refresh'); assert.ok(!document.querySelector('.ip-message').textContent.includes('obsolete refresh error')); assert.deepEqual(errors, []);
});

test('workspace changes invalidate requests even when the root mutates the same state object', async t => {
  const { window, document, state, calls } = setup(t);
  gets(calls)[0].response.resolve(snapshot(projectA.id)); await settle();
  const older = window.ImperiumProjects.reload(), oldRequest = gets(calls).at(-1);
  state.settings.workspace = projectB.workspace; window.ImperiumProjects.render(state);
  const currentRequest = gets(calls).at(-1); assert.notEqual(currentRequest, oldRequest);
  currentRequest.response.resolve(snapshot(projectB.id)); await settle();
  oldRequest.response.resolve(snapshot(projectA.id, { [projectB.id]: 'Stale scope B' })); await older;
  assert.equal(document.querySelector('.ip-active').dataset.projectId, projectB.id); assert.equal(document.querySelector('[data-project-id="project-b"] h4').textContent, projectB.name);
});

test('project edits invalidate reads started before and during the mutation', async t => {
  const { window, document, calls } = setup(t);
  gets(calls)[0].response.resolve(snapshot(projectA.id)); await settle();
  const beforeEdit = window.ImperiumProjects.reload(), beforeRequest = gets(calls).at(-1);
  document.querySelector('[data-project-id="project-a"] .ip-actions button:last-child').click();
  const edit = document.querySelector('.ip-edit'); edit.querySelector('input').value = 'Reviewed project A'; edit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const mutation = calls.find(call => call.method === 'PATCH'); assert.ok(mutation);
  const duringEdit = window.ImperiumProjects.reload(), duringRequest = gets(calls).at(-1);
  mutation.response.resolve({ project: { ...projectA, name: 'Reviewed project A' } }); await settle();
  beforeRequest.response.resolve(snapshot(projectA.id)); duringRequest.response.resolve(snapshot(projectA.id)); await Promise.all([beforeEdit, duringEdit]);
  assert.equal(document.querySelector('[data-project-id="project-a"] h4').textContent, 'Reviewed project A'); assert.equal(document.querySelector('.ip-edit'), null);
});

test('a response issued by an earlier mount cannot update the new mounted owner', async t => {
  const { window, document, state, calls, callbacks } = setup(t);
  const firstRequest = gets(calls)[0]; state.settings.workspace = projectB.workspace;
  window.ImperiumProjects.mount(document.querySelector('#second-mount'), callbacks);
  const secondRequest = gets(calls).at(-1); secondRequest.response.resolve(snapshot(projectB.id)); await settle();
  firstRequest.response.resolve(snapshot(projectA.id)); await settle();
  assert.equal(document.querySelector('#second-mount .ip-active').dataset.projectId, projectB.id);
});

test('creating a project while the initial list is pending reloads the committed list instead of remaining in loading state', async t => {
  const { window, document, calls, selected } = setup(t);
  const mountRequest = gets(calls)[0], projectC = { ...projectB, id: 'project-c', name: 'New project C', workspace: 'C:\\Projects\\C' };
  const form = document.querySelector('.ip-create'); form.querySelector('input[aria-label="Name"]').value = projectC.name;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const creation = calls.find(call => call.path === '/api/projects' && call.method === 'POST'); assert.ok(creation);
  creation.response.resolve({ project: projectC }); await settle();
  const fresh = gets(calls).at(-1); assert.notEqual(fresh, mountRequest);
  fresh.response.resolve({ projects: [projectA, projectB, projectC], currentProjectId: projectA.id }); await settle();
  mountRequest.response.resolve(snapshot(projectA.id)); await settle();
  assert.ok(document.querySelector('[data-project-id="project-c"]')); assert.equal(document.querySelector('.ip-active').dataset.projectId, projectA.id); assert.equal(document.querySelector('.ip-grid .ip-empty'), null); assert.deepEqual(selected, []);
});
