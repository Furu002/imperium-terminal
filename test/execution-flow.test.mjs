import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { EXECUTION_CAPABILITIES } from '../lib/execution-options.mjs';

const [html, appScript, workspaceScript, executionScript] = await Promise.all([
  'index.html', 'app.js', 'workspace.js', 'execution-options.js',
].map(file => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8')));
const clone = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let index = 0; index < 8; index++) await new Promise(resolve => setImmediate(resolve)); };
const change = (window, element, value) => { assert.ok(element); element.value = value; element.dispatchEvent(new window.Event('change', { bubbles: true })); };
const reply = value => ({ ok: true, json: async () => clone(value) });
const workspaceA = 'C:\\Project A', workspaceB = 'C:\\Project B';
const connection = { id: 'temporary-codex-connection', providerId: 'codex', modelId: 'codex-only-model', label: 'Temporary Codex' };
function snapshot(workspace, departmentId, connections = []) {
  return {
    settings: { workspace, language: 'en', onboarded: true, maxConcurrent: 2, identity: { name: 'Me', title: 'Owner' } },
    server: { csrfToken: 'execution-flow-test', version: 'test' },
    providers: ['codex', 'claude'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true })), connections,
    departments: departmentId ? [{ id: departmentId, name: departmentId, provider: 'claude', role: 'Review', modelId: 'sonnet', reasoningEffort: 'default', speed: 'default' }] : [], tasks: [], events: [],
  };
}
function browser(t, content) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(content, { url: 'http://127.0.0.1:4310/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  return { window, document: window.document, errors };
}

test('returning to a project after its draft connection was deleted restores the agent model, not another provider model', async t => {
  const { window, document, errors } = browser(t, html);
  let state = snapshot(workspaceA, 'agent-a', [connection]);
  const requests = [], streams = [];
  window.EventSource = class {
    listeners = new Map();
    constructor() { streams.push(this); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    close() {}
    push(value) { this.listeners.get('state')?.({ data: JSON.stringify(value) }); }
  };
  window.fetch = async (url, options = {}) => {
    const body = options.body === undefined ? undefined : JSON.parse(options.body);
    requests.push({ url, body });
    if (url === '/api/state') return reply(state);
    if (url === '/api/execution/capabilities') return reply({ providers: EXECUTION_CAPABILITIES });
    if (url === '/api/settings') return reply({ settings: state.settings });
    if (url === '/api/tasks') return reply({ task: { ...body, id: 'fake-task', status: 'queued', createdAt: new Date().toISOString(), output: '', logs: [], usage: {}, demo: false } });
    throw new Error(`Unexpected request: ${url}`);
  };
  window.eval(executionScript); window.eval(appScript); await settle();
  change(window, document.querySelector('#dispatch-provider'), `connection:${connection.id}`); await settle();
  assert.equal(document.querySelector('#dispatch-execution-settings [data-execution-model]').value, 'codex-only-model');
  document.querySelector('#dispatch-prompt').value = 'Saved Project A command';
  state = snapshot(workspaceB, 'agent-b', [connection]); streams[0].push(state); await settle();
  // Account connections are global; removing this unassigned override in B is valid.
  state = snapshot(workspaceB, 'agent-b', []); streams[0].push(state); await settle();
  state = snapshot(workspaceA, 'agent-a', []); streams[0].push(state); await settle();
  assert.equal(document.querySelector('#dispatch-provider').value, '');
  assert.equal(document.querySelector('#dispatch-execution-settings .ie-options').dataset.provider, 'claude');
  assert.equal(document.querySelector('#dispatch-execution-settings [data-execution-model]').value, 'sonnet');
  assert.equal(document.querySelector('#dispatch-prompt').value, 'Saved Project A command');
  document.querySelector('#dispatch-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const submitted = requests.findLast(value => value.url === '/api/tasks').body;
  assert.equal(submitted.departmentId, 'agent-a'); assert.equal(submitted.modelId, 'sonnet');
  assert.equal(submitted.provider, undefined); assert.equal(submitted.connectionId, undefined);
  assert.deepEqual(errors, []);
});

test('a new agent posts its selected model preferences and captured workspace while a later project ignores the response', async t => {
  const { window, document, errors } = browser(t, '<!doctype html><html lang="en"><body><div class="app-shell" data-view="overview"><div id="node-workspace"></div></div></body></html>');
  const first = snapshot(workspaceA, null, [connection]), second = snapshot(workspaceB, null, [connection]);
  let submitted, resolveCreation;
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, 'http://127.0.0.1:4310'), body = options.body === undefined ? undefined : JSON.parse(options.body);
    if (parsed.pathname === '/api/graph') return reply({ graph: { nodes: [], edges: [] } });
    if (parsed.pathname === '/api/memory') return reply({ nodes: [] });
    if (parsed.pathname === '/api/execution/capabilities') return reply({ providers: EXECUTION_CAPABILITIES });
    if (parsed.pathname === '/api/departments') { submitted = body; return new Promise(resolve => { resolveCreation = resolve; }); }
    throw new Error(`Unexpected request: ${url}`);
  };
  window.eval(executionScript); window.eval(workspaceScript);
  const callbacks = { language: 'en', connected: true, t: key => key };
  window.ImperiumWorkspace.render(first, callbacks); await settle();
  document.querySelector('[data-iw-action="add-node"]').click(); await settle();
  const form = document.querySelector('.iw-agent-create-form');
  form.querySelector('input[aria-label="Agent name"]').value = 'My agent';
  form.querySelector('textarea').value = 'Follow the project instructions';
  change(window, form.querySelector('select[aria-label="Registered connection"]'), connection.id);
  change(window, form.querySelector('[data-execution-model]'), '__manual__');
  const manual = form.querySelector('[data-execution-model-manual]'); manual.value = 'explicit-agent-model'; manual.dispatchEvent(new window.Event('input', { bubbles: true }));
  change(window, form.querySelector('[data-execution-effort]'), 'high');
  change(window, form.querySelector('[data-execution-speed]'), 'standard');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.ok(submitted, 'the create request should be sent');
  assert.equal(submitted.workspace, workspaceA);
  assert.equal(submitted.connectionId, connection.id); assert.equal(submitted.modelId, 'explicit-agent-model');
  assert.equal(submitted.reasoningEffort, 'high'); assert.equal(submitted.speed, 'standard');
  window.ImperiumWorkspace.render(second, callbacks); await settle();
  resolveCreation(reply({ department: { ...submitted, id: 'new-agent-in-a', code: 'NEW' } })); await settle();
  assert.deepEqual(second.departments, []);
  assert.ok(!window.ImperiumWorkspace.getGraph().nodes.some(value => value.referenceId === 'new-agent-in-a'));
  assert.deepEqual(errors, []);
});
