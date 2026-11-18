import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = await readFile(new URL('../public/knowledge.js', import.meta.url), 'utf8');
const graphScript = await readFile(new URL('../public/knowledge-graph.js', import.meta.url), 'utf8');
const cytoscapeScript = await readFile(new URL('../node_modules/cytoscape/dist/cytoscape.min.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const settle = async (delay = 0) => { if (delay) await new Promise(resolve => setTimeout(resolve, delay)); for (let turn = 0; turn < 4; turn++) await new Promise(resolve => setImmediate(resolve)); };
function knowledge() {
  const updatedAt = '2026-11-18T09:00:00.000Z';
  return {
    nodes: [
      { id: 'fact-1', title: 'Validated architecture', content: 'The application stores local workspace data.', kind: 'fact', source: 'user', confidence: 'user', pinned: true, revision: 2, updatedAt },
      { id: 'task-1', title: 'Agent proposal', content: 'An unverified implementation proposal.', kind: 'task', source: 'agent', confidence: 'unverified', pinned: false, revision: 1, sourceTaskId: 'source-task-123', updatedAt },
      { id: 'decision-1', title: 'Local storage decision', content: 'Use project-scoped storage.', kind: 'decision', source: 'user', confidence: 'user', revision: 1, updatedAt },
    ],
    edges: [{ id: 'actual-keyword-edge', source: 'fact-1', target: 'task-1', type: 'related', provenance: 'keyword' }, { id: 'actual-user-edge', source: 'task-1', target: 'decision-1', type: 'depends_on', provenance: 'user' }, { id: 'missing-target-edge', source: 'fact-1', target: 'missing-node', type: 'related', provenance: 'keyword' }],
    history: [{ id: 'fact-1', title: 'Older architecture', content: 'Earlier source text.', revision: 1, source: 'user', confidence: 'user', updatedAt, recordedAt: updatedAt }], stats: { method: 'local-keyword' },
  };
}
async function setup(t, { initial = knowledge(), delayed, delayedWrite, writeResponse, graphEngine = true, graphWidth = 920 } = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="knowledge"></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom, state = { settings: { workspace: 'C:\\Project A', language: 'en' }, server: { csrfToken: 'knowledge-test-csrf' } }, calls = [], byProject = new Map([[state.settings.workspace, copy(initial)]]);
  window.__graphWidth = graphWidth; window.__graphHeight = 560;
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.classList.contains('ik-cytoscape') ? window.__graphWidth : 0; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.classList.contains('ik-cytoscape') ? window.__graphHeight : 0; } });
  const resizeObservers = [];
  window.ResizeObserver = class { constructor(callback) { this.callback = callback; resizeObservers.push(this); } observe(host) { this.host = host; } disconnect() { this.disconnected = true; } };
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, 'http://127.0.0.1:4310'), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : undefined, workspace = method === 'GET' ? parsed.searchParams.get('workspace') : body.workspace;
    calls.push({ path: parsed.pathname, method, body, workspace, headers: options.headers });
    if (delayed && method === 'GET') await delayed(workspace);
    if (delayedWrite && method === 'PATCH') await delayedWrite(workspace, body);
    if (writeResponse && method === 'PATCH') { const response = await writeResponse(workspace, body); if (response) return response; }
    const current = byProject.get(workspace) || { nodes: [], edges: [], history: [], stats: {} }; let result;
    if (method === 'GET') result = current;
    else if (method === 'PATCH') {
      const id = parsed.pathname.split('/').at(-1), index = current.nodes.findIndex(node => node.id === id), old = current.nodes[index];
      if (body.expectedRevision !== old.revision) return { ok: false, status: 409, json: async () => ({ error: 'Revision conflict' }) };
      current.history.push({ ...old, recordedAt: new Date().toISOString() }); current.nodes[index] = { ...old, ...body, revision: old.revision + 1, source: 'user', confidence: 'user' }; result = { node: current.nodes[index] };
    } else if (method === 'POST') { const node = { ...body, id: 'new-memory', revision: 1, source: 'user', confidence: 'user', updatedAt: new Date().toISOString() }; current.nodes.push(node); byProject.set(workspace, current); result = { node }; }
    else throw new Error(`Unexpected ${method} ${url}`);
    return { ok: true, status: 200, json: async () => copy(result) };
  };
  if (graphEngine) window.eval(cytoscapeScript + '\nwindow.__graphEngines = []; window.__headlessGraph = options => { const cy = cytoscape({ ...options, container: undefined, headless: true, styleEnabled: true }); window.__graphEngines.push(cy); return cy; };');
  const engines = window.__graphEngines || [], cytoscapeFactory = window.__headlessGraph;
  window.eval(graphScript); window.eval(script); window.ImperiumKnowledge.mount(window.document.querySelector('#knowledge'), { getState: () => state, cytoscapeFactory }); await settle(); t.after(() => { window.ImperiumKnowledge.unmount(); window.close(); });
  return { window, document: window.document, state, calls, byProject, errors, engines, resizeObservers };
}

test('an empty knowledge graph has no invented nodes, edges, or automatic writes', async t => {
  const { document, calls, state, errors } = await setup(t, { initial: { nodes: [], edges: [], history: [], stats: {} } });
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 0); assert.equal(document.querySelectorAll('[data-memory-edge]').length, 0);
  assert.match(document.querySelector('.ik-empty').textContent, /first result or memory/); assert.match(document.querySelector('.ik-explanation').textContent, /model weights are not trained/);
  assert.ok(calls.every(call => call.method === 'GET' && call.path === '/api/memory' && call.workspace === state.settings.workspace)); assert.deepEqual(errors, []);
});

test('wiki links use project-scoped normalized titles, navigate aliases, expose backlinks and render markdown without HTML', async t => {
  const initial = knowledge();
  initial.nodes[0].content = '# Source heading\n**Reviewed** <img src=x onerror="window.bad=1">\n[[ agent PROPOSAL | Proposal alias ]] [[Missing]] [[Double]] [[fact-1]] [[Elsewhere]]\n<script>window.bad=2</script>';
  initial.nodes[2].content = 'Decision follows [[Validated architecture]].';
  initial.nodes.push({ id: 'double-1', title: 'Double', content: 'One duplicate', kind: 'note', revision: 1 }, { id: 'double-2', title: 'ＤＯＵＢＬＥ', content: 'Another normalized duplicate', kind: 'note', revision: 1 });
  initial.edges.push({ id: 'wiki-forward', source: 'fact-1', target: 'task-1', type: 'related', provenance: 'wikilink' }, { id: 'wiki-backlink', source: 'decision-1', target: 'fact-1', type: 'related', provenance: 'wikilink' });
  const { window, document, calls, byProject, errors } = await setup(t, { initial });
  byProject.set('C:\\Other Project', { nodes: [{ id: 'external', title: 'Elsewhere', content: 'Other project only', kind: 'note', revision: 1 }], edges: [], history: [] });
  document.querySelector('[data-memory-row="fact-1"]').click();
  const outgoing = document.querySelector('[data-ik-links="outgoing"]');
  assert.equal(outgoing.querySelector('[data-wiki-target="task-1"]').textContent, 'Proposal alias');
  assert.equal(outgoing.querySelectorAll('[data-wiki-unresolved]').length, 4);
  assert.match([...outgoing.querySelectorAll('[data-wiki-unresolved]')].find(link => link.textContent.includes('Double')).title, /More than one/);
  assert.ok(document.querySelector('[data-backlink-target="decision-1"]'));
  assert.equal(document.querySelectorAll('.ik-edge-wiki').length, 2);
  document.querySelector('[data-ik-editor-mode="reading"]').click();
  const reading = document.querySelector('[data-ik-reading]');
  assert.equal(reading.hidden, false); assert.equal(reading.querySelector('h1').textContent, 'Source heading');
  assert.equal(reading.querySelector('strong').textContent, 'Reviewed');
  assert.match(reading.textContent, /<script>window.bad=2<\/script>/);
  assert.equal(document.querySelector('img[src="x"]'), null); assert.equal(document.querySelector('script'), null); assert.equal(window.bad, undefined);
  reading.querySelector('[data-wiki-target="task-1"]').click();
  assert.equal(document.querySelector('.ik-review-form input:not([type=checkbox])').value, 'Agent proposal');
  assert.ok(calls.every(call => call.method === 'GET')); assert.deepEqual(errors, []);
});

test('local graph depth, hover connections, pan, zoom and keyboard selection never write to the project', async t => {
  const initial = knowledge(); initial.nodes.push({ id: 'isolated', title: 'Isolated note', content: 'No relationships', kind: 'note', revision: 1 });
  const { window, document, calls, errors, engines } = await setup(t, { initial });
  document.querySelector('[data-memory-row="fact-1"]').click();
  document.querySelector('[data-ik-graph-mode="local"]').click();
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 2); assert.equal(document.querySelector('[data-memory-node="decision-1"]'), null);
  document.querySelector('[data-ik-depth="2"]').click();
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 3); assert.equal(document.querySelector('[data-memory-node="isolated"]'), null);
  document.querySelector('[data-ik-graph-mode="all"]').click();
  const first = document.querySelector('[data-memory-node="fact-1"]'); first.dispatchEvent(new window.MouseEvent('mouseenter'));
  assert.ok(document.querySelector('[data-memory-node="isolated"]').classList.contains('ik-muted')); assert.ok(document.querySelector('.ik-edge-highlight'));
  first.dispatchEvent(new window.MouseEvent('mouseleave')); assert.equal(document.querySelectorAll('.ik-muted').length, 0);
  const picture = document.querySelector('.ik-cytoscape'), cy = engines.at(-1), originalPan = { ...cy.pan() };
  picture.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
  assert.equal(cy.pan().x, originalPan.x + 35);
  picture.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })); assert.equal(cy.pan().y, originalPan.y - 35);
  const originalZoom = cy.zoom(); document.querySelector('[data-ik-zoom="in"]').click(); assert.equal(cy.zoom(), originalZoom * 1.25);
  picture.dispatchEvent(new window.KeyboardEvent('keydown', { key: '0', cancelable: true })); assert.notEqual(cy.pan().x, originalPan.x + 35);
  cy.getElementById('node:fact-1').emit('mouseover'); assert.ok(cy.getElementById('node:isolated').hasClass('muted')); cy.getElementById('node:fact-1').emit('mouseout');
  document.querySelector('[data-memory-node="task-1"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(document.querySelector('.ik-review-form input:not([type=checkbox])').value, 'Agent proposal');
  assert.ok(calls.every(call => call.method === 'GET')); assert.deepEqual(errors, []);
});

test('dirty drafts survive filters, refresh, language changes and note navigation while preserving their original expected revision', async t => {
  const { window, document, state, byProject, calls } = await setup(t);
  document.querySelector('[data-memory-row="fact-1"]').click();
  const form = document.querySelector('.ik-review-form'), content = form.querySelector('textarea');
  content.value = 'MY UNSAVED ARCHITECTURE'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('[data-kind-filter="fact"]').click();
  assert.equal(document.querySelector('.ik-review-form'), form); assert.equal(content.value, 'MY UNSAVED ARCHITECTURE');
  const current = byProject.get(state.settings.workspace), old = { ...current.nodes[0] };
  Object.assign(current.nodes[0], { content: 'NEW REMOTE SOURCE', revision: 3 }); current.history.push({ ...old, recordedAt: old.updatedAt });
  await window.ImperiumKnowledge.reload(); await settle();
  assert.equal(document.querySelector('.ik-review-form'), form); assert.equal(content.value, 'MY UNSAVED ARCHITECTURE');
  assert.equal(document.querySelector('.ik-conflict').hidden, false); assert.ok(document.querySelector('[data-memory-revision="2"]'));
  document.documentElement.lang = 'ja'; window.ImperiumKnowledge.render(state);
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'MY UNSAVED ARCHITECTURE'); assert.match(document.querySelector('[data-ik-dirty]').textContent, /未保存/);
  document.querySelector('[data-kind-filter="all"]').click(); document.querySelector('[data-memory-row="task-1"]').click(); document.querySelector('[data-memory-row="fact-1"]').click();
  const restored = document.querySelector('.ik-review-form'); assert.equal(restored.querySelector('textarea').value, 'MY UNSAVED ARCHITECTURE');
  restored.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(calls.find(call => call.method === 'PATCH').body.expectedRevision, 2); assert.equal(current.nodes[0].content, 'NEW REMOTE SOURCE');
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'MY UNSAVED ARCHITECTURE');
});

test('project changes isolate drafts even when different projects reuse the same memory ID', async t => {
  const { window, document, state, byProject } = await setup(t);
  document.querySelector('[data-memory-row="fact-1"]').click();
  const content = document.querySelector('.ik-review-form textarea'); content.value = 'PRIVATE PROJECT A DRAFT'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  byProject.set('C:\\Project B', { nodes: [{ id: 'fact-1', title: 'Project B note', content: 'Project B source', kind: 'note', revision: 1 }], edges: [], history: [] });
  state.settings.workspace = 'C:\\Project B'; window.ImperiumKnowledge.render(state); await settle(); document.querySelector('[data-memory-row="fact-1"]').click();
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'Project B source'); assert.doesNotMatch(document.body.textContent, /PRIVATE PROJECT A DRAFT/);
  state.settings.workspace = 'C:\\Project A'; window.ImperiumKnowledge.render(state); await settle(); document.querySelector('[data-memory-row="fact-1"]').click();
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'PRIVATE PROJECT A DRAFT');
});

test('typing during a pending save preserves newer text as a dirty draft after the saved revision arrives', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const { window, document, state, byProject } = await setup(t, { delayedWrite: () => pending });
  document.querySelector('[data-memory-row="fact-1"]').click();
  const form = document.querySelector('.ik-review-form'), content = form.querySelector('textarea');
  content.value = 'FIRST SAVE'; content.dispatchEvent(new window.Event('input', { bubbles: true })); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  content.value = 'NEWER UNSAVED EDIT'; content.dispatchEvent(new window.Event('input', { bubbles: true })); release(); await settle();
  assert.equal(byProject.get(state.settings.workspace).nodes[0].content, 'FIRST SAVE');
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'NEWER UNSAVED EDIT'); assert.equal(document.querySelector('[data-ik-dirty]').dataset.ikDirty, 'true');
});

test('a 409 refresh preserves newer pending edits and explicit rebase enables a later save without writing by itself', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const { window, document, state, byProject, calls, errors } = await setup(t, { delayedWrite: () => pending });
  document.querySelector('[data-memory-row="fact-1"]').click();
  const form = document.querySelector('.ik-review-form'), content = form.querySelector('textarea');
  content.value = 'FIRST LOCAL VERSION'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  content.value = 'NEWER LOCAL DRAFT'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  const current = byProject.get(state.settings.workspace), previous = { ...current.nodes[0] };
  Object.assign(current.nodes[0], { content: 'LATEST SERVER VERSION', revision: 3 }); current.history.push({ ...previous, recordedAt: previous.updatedAt });
  release(); await settle();
  assert.equal(current.nodes[0].content, 'LATEST SERVER VERSION'); assert.equal(document.querySelector('.ik-review-form textarea').value, 'NEWER LOCAL DRAFT');
  assert.equal(document.querySelector('.ik-conflict').hidden, false); assert.ok(document.querySelector('[data-memory-revision="2"]'));
  const writeIndex = calls.findIndex(call => call.method === 'PATCH'); assert.ok(calls.slice(writeIndex + 1).some(call => call.method === 'GET'), 'a 409 must load the current revision');
  const beforeAction = calls.length; document.querySelector('[data-ik-conflict-action="rebase"]').click();
  assert.equal(calls.length, beforeAction, 'rebasing is local and must not save or query automatically');
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'NEWER LOCAL DRAFT'); assert.equal(document.querySelector('[data-ik-dirty]').dataset.ikDirty, 'true');
  assert.equal(document.querySelector('.ik-conflict').hidden, true); assert.equal(current.nodes[0].content, 'LATEST SERVER VERSION');
  document.querySelector('.ik-review-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const updates = calls.filter(call => call.method === 'PATCH');
  assert.deepEqual(updates.map(call => call.body.expectedRevision), [2, 3]); assert.equal(current.nodes[0].revision, 4); assert.equal(current.nodes[0].content, 'NEWER LOCAL DRAFT');
  assert.equal(document.querySelector('[data-ik-dirty]').dataset.ikDirty, 'false'); assert.deepEqual(errors, []);
});

test('discarding a conflicted draft loads the latest title, content, kind and pin without sending a write', async t => {
  const { window, document, state, byProject, calls } = await setup(t);
  document.querySelector('[data-memory-row="fact-1"]').click();
  const form = document.querySelector('.ik-review-form'); form.querySelector('input:not([type=checkbox])').value = 'LOCAL TITLE';
  form.querySelector('textarea').value = 'LOCAL BODY'; form.querySelector('select').value = 'constraint'; form.querySelector('input[type=checkbox]').checked = true;
  form.querySelector('textarea').dispatchEvent(new window.Event('input', { bubbles: true }));
  const current = byProject.get(state.settings.workspace);
  Object.assign(current.nodes[0], { title: 'LATEST TITLE', content: 'LATEST BODY', kind: 'note', pinned: false, revision: 3 });
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(document.querySelector('.ik-conflict').hidden, false);
  const beforeAction = calls.length; document.querySelector('[data-ik-conflict-action="discard"]').click();
  assert.equal(calls.length, beforeAction); assert.equal(calls.filter(call => call.method === 'PATCH').length, 1);
  const latest = document.querySelector('.ik-review-form');
  assert.equal(latest.querySelector('input:not([type=checkbox])').value, 'LATEST TITLE'); assert.equal(latest.querySelector('textarea').value, 'LATEST BODY');
  assert.equal(latest.querySelector('select').value, 'note'); assert.equal(latest.querySelector('input[type=checkbox]').checked, false);
  assert.equal(document.querySelector('[data-ik-dirty]').dataset.ikDirty, 'false'); assert.equal(document.querySelector('.ik-conflict').hidden, true);
  latest.querySelector('textarea').value = 'EDIT AFTER DISCARD'; latest.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(calls.filter(call => call.method === 'PATCH').at(-1).body.expectedRevision, 3); assert.equal(current.nodes[0].content, 'EDIT AFTER DISCARD');
});

test('revision conflicts display the latest server title, content, kind and pin as safe read-only comparison text', async t => {
  const { window, document, state, byProject } = await setup(t);
  document.querySelector('[data-memory-row="fact-1"]').click();
  const content = document.querySelector('.ik-review-form textarea'); content.value = 'MY LOCAL DRAFT'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  const current = byProject.get(state.settings.workspace);
  Object.assign(current.nodes[0], { title: '<img src=x onerror="window.bad=1">', content: '<script>window.bad=2</script> Latest server source.', kind: 'constraint', pinned: false, revision: 3 });
  await window.ImperiumKnowledge.reload(); await settle();
  const comparison = document.querySelector('[data-ik-latest-source]');
  assert.equal(comparison.open, true); assert.match(comparison.textContent, /<img src=x/); assert.match(comparison.textContent, /Constraints/); assert.match(comparison.textContent, /Not pinned/);
  assert.equal(comparison.querySelector('[data-ik-latest-content]').textContent, '<script>window.bad=2</script> Latest server source.');
  assert.equal(comparison.querySelector('input,textarea,[contenteditable]'), null); assert.equal(document.querySelector('script,img[src="x"]'), null); assert.equal(window.bad, undefined);
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'MY LOCAL DRAFT');
  Object.assign(current.nodes[0], { content: 'NEWEST SERVER SOURCE', revision: 4 }); await window.ImperiumKnowledge.reload(); await settle();
  assert.equal(document.querySelector('[data-ik-latest-content]').textContent, 'NEWEST SERVER SOURCE');
});

for (const archived of [false, true]) test(`a dirty ${archived ? 'archived' : 'deleted'} note remains recoverable from the explorer without invented graph nodes or automatic writes`, async t => {
  const { window, document, state, byProject, calls } = await setup(t);
  document.querySelector('[data-memory-row="fact-1"]').click();
  const form = document.querySelector('.ik-review-form'); form.querySelector('input:not([type=checkbox])').value = 'RECOVERY TITLE';
  const draftText = 'RECOVERY CONTENT <script>window.bad=1</script>';
  form.querySelector('textarea').value = draftText; form.querySelector('textarea').dispatchEvent(new window.Event('input', { bubbles: true }));
  const current = byProject.get(state.settings.workspace);
  if (archived) current.nodes[0].archived = true; else current.nodes.splice(0, 1);
  await window.ImperiumKnowledge.reload(); await settle();
  assert.ok(document.querySelector('[data-ik-recovery="fact-1"]')); assert.ok(document.querySelector('[data-orphan-draft="fact-1"]'));
  assert.equal(document.querySelector('[data-memory-node="fact-1"]'), null); assert.equal(document.querySelector('[data-memory-row="fact-1"]'), null);
  const recovery = document.querySelector('[data-ik-recovery]'); assert.equal(recovery.querySelector('textarea').value, draftText); assert.equal(recovery.querySelector('textarea').readOnly, true); assert.equal(recovery.querySelector('input').readOnly, true);
  assert.equal(window.bad, undefined); assert.ok(calls.every(call => call.method === 'GET'));
  document.querySelector('[data-memory-row="task-1"]').click(); document.querySelector('[data-orphan-draft="fact-1"]').click();
  assert.equal(document.querySelector('[data-ik-recovery] textarea').value, draftText);
  state.settings.workspace = 'C:\\Project B'; byProject.set(state.settings.workspace, { nodes: [], edges: [], history: [] }); window.ImperiumKnowledge.render(state); await settle();
  assert.equal(document.querySelector('[data-orphan-draft]'), null); assert.doesNotMatch(document.body.textContent, /RECOVERY TITLE/);
  state.settings.workspace = 'C:\\Project A'; window.ImperiumKnowledge.render(state); await settle(); document.querySelector('[data-orphan-draft="fact-1"]').click();
  const beforeCreate = calls.length; document.querySelector('[data-ik-recover-create="fact-1"]').click();
  assert.equal(calls.length, beforeCreate, 'opening the recovery creation form never writes');
  const create = document.querySelector('.ik-create-form'); assert.equal(create.querySelector('input:not([type=checkbox])').value, 'RECOVERY TITLE'); assert.equal(create.querySelector('textarea').value, draftText);
  create.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(calls.filter(call => call.method === 'POST').length, 1); assert.equal(current.nodes.find(node => node.id === 'new-memory').content, draftText);
  assert.ok(document.querySelector('[data-orphan-draft="fact-1"]'), 'the original draft stays accessible after an explicit copy is created');
});

test('same-revision 409 responses unlock retry after the refresh and never permit duplicate writes while that refresh is pending', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let reads = 0, writes = 0;
  const { window, document, state, byProject, calls, errors } = await setup(t, {
    delayed: () => ++reads === 2 ? gate : Promise.resolve(),
    writeResponse: () => ++writes === 1 ? { ok: false, status: 409, json: async () => ({ error: 'A non-revision workspace conflict' }) } : undefined,
  });
  document.querySelector('[data-memory-row="fact-1"]').click(); const form = document.querySelector('.ik-review-form'), content = form.querySelector('textarea');
  content.value = 'SAFE LOCAL RETRY'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(reads, 2); assert.equal(writes, 1);
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  content.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })); await settle();
  assert.equal(writes, 1); assert.equal(calls.filter(call => call.method === 'PATCH').length, 1);
  release(); await settle();
  assert.equal(document.querySelector('.ik-conflict').hidden, true); assert.match(document.querySelector('.ik-message').textContent, /Try saving again/);
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'SAFE LOCAL RETRY'); assert.equal(document.querySelector('.ik-review-form button[type=submit]').disabled, false);
  document.querySelector('.ik-review-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(writes, 2); assert.equal(byProject.get(state.settings.workspace).nodes[0].content, 'SAFE LOCAL RETRY');
  assert.deepEqual(calls.filter(call => call.method === 'PATCH').map(call => call.body.expectedRevision), [2, 2]); assert.deepEqual(errors, []);
});

test('a failed 409 follow-up read never labels cached text as latest and a later successful refresh clears the uncertainty', async t => {
  let reads = 0;
  const { window, document } = await setup(t, { delayed: () => { if (++reads === 2) throw new Error('Temporary read failure'); }, writeResponse: () => ({ ok: false, status: 409, json: async () => ({ error: 'Conflict' }) }) });
  document.querySelector('[data-memory-row="fact-1"]').click(); const form = document.querySelector('.ik-review-form');
  form.querySelector('textarea').value = 'PRESERVED LOCAL DRAFT'; form.querySelector('textarea').dispatchEvent(new window.Event('input', { bubbles: true }));
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  assert.equal(document.querySelector('.ik-conflict').hidden, false); assert.equal(document.querySelector('[data-ik-latest-source]'), null);
  assert.equal(document.querySelector('[data-ik-conflict-action="rebase"]').disabled, true);
  await window.ImperiumKnowledge.reload(); await settle();
  assert.equal(document.querySelector('.ik-conflict').hidden, true); assert.equal(document.querySelector('.ik-review-form textarea').value, 'PRESERVED LOCAL DRAFT');
});

test('terminal FIND events search the vault without saving or discarding the selected draft', async t => {
  const { window, document, calls } = await setup(t); document.querySelector('[data-memory-row="fact-1"]').click();
  const content = document.querySelector('.ik-review-form textarea'); content.value = 'STAGED EDIT'; content.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('[data-ik-graph-mode="local"]').click();
  window.dispatchEvent(new window.CustomEvent('imperium:knowledge-search', { detail: { query: 'proposal' } }));
  assert.equal(document.querySelectorAll('[data-memory-row]').length, 1); assert.ok(document.querySelector('[data-memory-row="task-1"]'));
  assert.equal(document.querySelector('[data-ik-graph-mode="all"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 1);
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'STAGED EDIT'); assert.ok(calls.every(call => call.method === 'GET'));
});

test('the graph shows only recorded relationships and distinguishes review, pin, provenance and history', async t => {
  const { document, errors } = await setup(t);
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 3); assert.equal(document.querySelectorAll('[data-memory-edge]').length, 2);
  assert.equal(document.querySelectorAll('.ik-edge-keyword').length, 1); assert.equal(document.querySelectorAll('.ik-edge-manual').length, 1);
  assert.equal(document.querySelectorAll('.ik-node-user').length, 2); assert.equal(document.querySelectorAll('.ik-node-agent').length, 1); assert.equal(document.querySelectorAll('.ik-node-pinned').length, 1);
  document.querySelector('[data-memory-row="fact-1"]').click(); assert.ok(document.querySelector('[data-memory-revision="1"]')); assert.match(document.querySelector('.ik-history').textContent, /Earlier source text/);
  document.querySelector('[data-memory-row="task-1"]').click(); assert.match(document.querySelector('.ik-provenance').textContent, /source-task-123/); assert.match(document.querySelector('.ik-memory-badges').textContent, /Agent unverified/);
  document.querySelector('[data-kind-filter="decision"]').click(); assert.equal(document.querySelectorAll('[data-memory-node]').length, 1); assert.ok(document.querySelector('[data-memory-node="decision-1"]')); assert.deepEqual(errors, []);
});

test('graph rendering is bounded while search covers records outside the recent 150', async t => {
  const nodes = Array.from({ length: 171 }, (_, index) => ({ id: `memory-${index}`, title: `Memory ${index}`, content: index === 0 ? 'A uniquely searchable older record' : 'Another source fact.', kind: 'fact', source: 'user', confidence: 'user', revision: 1, updatedAt: new Date(Date.UTC(2026, 10, 18, 0, index)).toISOString() }));
  const edges = []; for (let source = 0; source < 61; source++) for (let target = 0; target < 61; target++) if (source !== target) edges.push({ id: `edge-${source}-${target}`, source: `memory-${source}`, target: `memory-${target}`, type: 'related', provenance: 'wikilink' });
  const { window, document, engines } = await setup(t, { initial: { nodes, edges, history: [], stats: {} } });
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 150); assert.match(document.querySelector('[data-ik-count="nodes"]').textContent, /150.*171.*171/); assert.equal(document.querySelectorAll('[data-memory-row]').length, 50);
  assert.equal(document.querySelectorAll('[data-memory-edge]').length, 1200); assert.match(document.querySelector('[data-ik-count="edges"]').textContent, /1200.*1560/);
  assert.equal(engines.at(-1).nodes().length, 150); assert.equal(engines.at(-1).edges().length, 1200);
  document.querySelector('.ik-list-footer button:last-child').click(); assert.match(document.querySelector('.ik-list-footer').textContent, /51–100.*171/);
  const search = document.querySelector('.ik-searchbar input'); search.value = 'uniquely searchable'; search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 1); assert.ok(document.querySelector('[data-memory-node="memory-0"]'));
});

test('refresh retains the real Cytoscape instance, dragged positions and viewport without model calls', async t => {
  const { window, document, engines, state, byProject, calls } = await setup(t);
  const cy = engines.at(-1), node = cy.getElementById('node:fact-1');
  window.eval('__graphEngines.at(-1).viewport({ zoom: 1.35, pan: { x: 134, y: -52 } }); __graphEngines.at(-1).getElementById("node:fact-1").position({ x: 410, y: 220 });');
  const current = byProject.get(state.settings.workspace); current.nodes[0].title = '<script>literal title</script>'; current.nodes[0].revision++;
  await window.ImperiumKnowledge.reload();
  assert.equal(engines.length, 1); assert.equal(engines.at(-1), cy); assert.equal(cy.zoom(), 1.35); assert.equal(cy.pan().x, 134); assert.equal(cy.pan().y, -52);
  assert.equal(node.position().x, 410); assert.equal(node.position().y, 220); assert.equal(node.data('label'), '<script>literal title</script>'); assert.equal(document.querySelector('script'), null);
  current.nodes.push({ id: 'new-real-note', title: 'New saved note', kind: 'note', confidence: 'user', revision: 1 }); await window.ImperiumKnowledge.reload();
  assert.equal(cy.nodes().length, 4); assert.equal(cy.zoom(), 1.35); assert.equal(cy.pan().x, 134); assert.equal(cy.pan().y, -52);
  assert.ok(calls.every(call => call.method === 'GET' && call.path === '/api/memory'));
});

test('selecting a different local neighborhood fits its new nodes and seeds CoSE without coincident positions', async t => {
  const nodes = ['a', 'b'].flatMap(group => Array.from({ length: 7 }, (_, index) => ({ id: `${group}-${index}`, title: `${group.toUpperCase()} note ${index}`, content: `Saved ${group} source ${index}`, kind: 'note', confidence: 'user', revision: 1 })));
  const edges = ['a', 'b'].flatMap(group => Array.from({ length: 6 }, (_, index) => ({ id: `${group}-edge-${index}`, source: `${group}-0`, target: `${group}-${index + 1}`, provenance: 'wikilink', type: 'related' })));
  const { window, document, engines, calls } = await setup(t, { initial: { nodes, edges, history: [], stats: {} } });
  const cy = engines.at(-1), layouts = [], originalLayout = cy.layout.bind(cy);
  cy.layout = options => { layouts.push({ name: options.name, randomize: options.randomize }); return originalLayout(options); };
  document.querySelector('[data-memory-row="a-0"]').click(); document.querySelector('[data-ik-graph-mode="local"]').click();
  assert.equal(cy.nodes().length, 7); assert.equal(cy.getElementById('node:b-0').empty(), true);
  window.eval('__graphEngines.at(-1).viewport({ zoom: 3, pan: { x: 100000, y: -100000 } });');
  document.querySelector('[data-memory-row="b-0"]').click();
  assert.equal(cy.getElementById('node:a-0').empty(), true); assert.equal(cy.nodes().length, 7); assert.equal(cy.edges().length, 6);
  assert.equal(layouts.at(-1).name, 'cose'); assert.equal(layouts.at(-1).randomize, true);
  assert.notEqual(cy.zoom(), 3); assert.notEqual(cy.pan().x, 100000); assert.notEqual(cy.pan().y, -100000);
  const positions = cy.nodes().map(node => ({ x: node.position().x, y: node.position().y }));
  assert.ok(positions.every(position => Number.isFinite(position.x) && Number.isFinite(position.y)));
  assert.equal(new Set(positions.map(position => `${position.x.toFixed(3)},${position.y.toFixed(3)}`)).size, 7);
  assert.ok(calls.every(call => call.method === 'GET' && call.path === '/api/memory'));
});

test('project switches destroy the old engine and ignore retained node events even with reused IDs', async t => {
  const { window, document, engines, state, byProject, calls, resizeObservers } = await setup(t);
  const oldEngine = engines.at(-1), oldButton = document.querySelector('[data-memory-node="fact-1"]');
  byProject.set('C:\\Project B', { nodes: [{ id: 'fact-1', title: 'Project B original', content: 'Only B content', confidence: 'user', revision: 1 }], edges: [], history: [] });
  state.settings.workspace = 'C:\\Project B'; window.ImperiumKnowledge.render(state); await settle();
  const newEngine = engines.at(-1); assert.notEqual(newEngine, oldEngine); assert.equal(oldEngine.destroyed(), true);
  assert.equal(resizeObservers[0].disconnected, true);
  oldButton.click(); oldEngine.getElementById('node:fact-1').emit('tap'); assert.equal(document.querySelector('.ik-review-form'), null);
  newEngine.getElementById('node:fact-1').emit('tap'); assert.equal(document.querySelector('.ik-review-form textarea').value, 'Only B content');
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('unmount destroys the engine and a pending read cannot recreate it or change the detached view', async t => {
  let block = false, release; const pending = new Promise(resolve => { release = resolve; });
  const { window, document, engines, byProject, state, calls, resizeObservers } = await setup(t, { delayed: () => block ? pending : undefined });
  const engine = engines.at(-1), oldButton = document.querySelector('[data-memory-node="fact-1"]');
  block = true; const reload = window.ImperiumKnowledge.reload(); window.ImperiumKnowledge.unmount();
  byProject.get(state.settings.workspace).nodes.push({ id: 'late-note', title: 'Late source', revision: 1 }); release(); assert.equal(await reload, false);
  assert.equal(engine.destroyed(), true); assert.equal(engines.length, 1); assert.equal(document.querySelector('[data-memory-node="late-note"]'), null);
  assert.equal(resizeObservers[0].disconnected, true);
  oldButton.click(); assert.equal(document.querySelector('.ik-review-form'), null); assert.doesNotThrow(() => window.ImperiumKnowledge.unmount()); assert.ok(calls.every(call => call.method === 'GET'));
});

test('first fit waits for a visible canvas and later resize events retain the established viewport', async t => {
  const { window, engines, resizeObservers, calls } = await setup(t, { graphWidth: 0 });
  const cy = engines.at(-1); assert.equal(cy.zoom(), 1);
  window.__graphWidth = 920; resizeObservers.at(-1).callback(); assert.notEqual(cy.zoom(), 1);
  window.eval('__graphEngines.at(-1).viewport({ zoom: 1.4, pan: { x: 66, y: -32 } });');
  window.__graphWidth = 0; resizeObservers.at(-1).callback(); window.__graphWidth = 700; resizeObservers.at(-1).callback();
  assert.equal(cy.zoom(), 1.4); assert.equal(cy.pan().x, 66); assert.equal(cy.pan().y, -32); assert.ok(calls.every(call => call.method === 'GET'));
});

test('a missing local engine is disclosed and the semantic graph remains selectable without a fake renderer', async t => {
  const { window, document, calls, errors } = await setup(t, { graphEngine: false });
  const unavailable = document.querySelector('.ik-graph-unavailable'); assert.equal(unavailable.hidden, false); assert.match(unavailable.textContent, /graph engine could not be loaded/);
  assert.equal(document.querySelector('svg,canvas'), null); assert.equal(document.querySelectorAll('.ik-graph-node-list button').length, 3); assert.equal(document.querySelectorAll('.ik-graph-relation-list li').length, 2);
  document.querySelector('[data-memory-node="task-1"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(document.querySelector('.ik-review-form textarea').value, 'An unverified implementation proposal.'); assert.ok(calls.every(call => call.method === 'GET')); assert.deepEqual(errors, []);
});

test('review edits use literal content, a pinned choice, expected revision, CSRF and the captured project', async t => {
  const value = knowledge(); value.nodes[1].title = '<img src=x onerror="window.bad=1">'; value.nodes[1].content = '<script>window.bad=2</script>Unverified source.';
  const { window, document, state, calls } = await setup(t, { initial: value });
  document.querySelector('[data-memory-row="task-1"]').click(); assert.equal(document.querySelector('img[src="x"]'), null); assert.equal(window.bad, undefined);
  const form = document.querySelector('.ik-review-form'); assert.equal(form.querySelector('input:not([type=checkbox])').maxLength, 160); assert.equal(form.querySelector('textarea').maxLength, 24000);
  form.querySelector('textarea').value = 'Reviewed factual correction.'; form.querySelector('input[type="checkbox"]').checked = true;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const update = calls.find(call => call.method === 'PATCH'); assert.equal(update.body.expectedRevision, 1); assert.equal(update.body.pinned, true); assert.equal(update.body.content, 'Reviewed factual correction.'); assert.equal(update.workspace, state.settings.workspace); assert.equal(update.headers['x-hq-token'], 'knowledge-test-csrf');
  assert.match(document.querySelector('.ik-memory-badges').textContent, /User reviewed/); assert.ok(document.querySelector('[data-memory-revision="1"]')); assert.equal(window.bad, undefined);
});

test('memory creation is explicit and language changes update built-in labels', async t => {
  const { window, document, state, calls } = await setup(t);
  document.documentElement.lang = 'ja'; window.ImperiumKnowledge.render(state); assert.match(document.querySelector('.ik-heading').textContent, /プロジェクト知識グラフ/);
  document.documentElement.lang = 'ko'; window.ImperiumKnowledge.render(state); assert.match(document.querySelector('.ik-heading').textContent, /프로젝트 지식 그래프/);
  document.querySelector('[data-ik-action="create"]').click(); const form = document.querySelector('.ik-create-form'); form.querySelector('input:not([type=checkbox])').value = '검증한 결정'; form.querySelector('textarea').value = '사용자가 직접 검토한 프로젝트 결정입니다.'; form.querySelector('select').value = 'decision';
  assert.equal(calls.filter(call => call.method === 'POST').length, 0); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  const create = calls.find(call => call.method === 'POST'); assert.equal(create.body.kind, 'decision'); assert.equal(create.body.workspace, state.settings.workspace); assert.ok(document.querySelector('[data-memory-row="new-memory"]'));
});

test('late responses from a previous project cannot replace the current project graph', async t => {
  let release; const blocked = new Promise(resolve => { release = resolve; });
  const { window, document, state, byProject } = await setup(t, { delayed: workspace => workspace === 'C:\\Project A' ? blocked : Promise.resolve() });
  byProject.set('C:\\Project B', { nodes: [{ id: 'project-b-memory', title: 'Only project B', content: 'Separate project source.', kind: 'note', source: 'user', confidence: 'user', revision: 1 }], edges: [], history: [], stats: {} });
  state.settings.workspace = 'C:\\Project B'; window.ImperiumKnowledge.render(state); await settle(); release(); await settle();
  assert.ok(document.querySelector('[data-memory-node="project-b-memory"]')); assert.equal(document.querySelector('[data-memory-node="fact-1"]'), null);
});
