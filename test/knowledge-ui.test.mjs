import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = await readFile(new URL('../public/knowledge.js', import.meta.url), 'utf8');
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
async function setup(t, { initial = knowledge(), delayed } = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="knowledge"></div></body></html>', { url: 'http://127.0.0.1:4310', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom, state = { settings: { workspace: 'C:\\Project A', language: 'en' }, server: { csrfToken: 'knowledge-test-csrf' } }, calls = [], byProject = new Map([[state.settings.workspace, copy(initial)]]);
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, 'http://127.0.0.1:4310'), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : undefined, workspace = method === 'GET' ? parsed.searchParams.get('workspace') : body.workspace;
    calls.push({ path: parsed.pathname, method, body, workspace, headers: options.headers });
    if (delayed && method === 'GET') await delayed(workspace);
    const current = byProject.get(workspace) || { nodes: [], edges: [], history: [], stats: {} }; let result;
    if (method === 'GET') result = current;
    else if (method === 'PATCH') {
      const id = parsed.pathname.split('/').at(-1), index = current.nodes.findIndex(node => node.id === id), old = current.nodes[index];
      assert.equal(body.expectedRevision, old.revision); current.history.push({ ...old, recordedAt: new Date().toISOString() }); current.nodes[index] = { ...old, ...body, revision: old.revision + 1, source: 'user', confidence: 'user' }; result = { node: current.nodes[index] };
    } else if (method === 'POST') { const node = { ...body, id: 'new-memory', revision: 1, source: 'user', confidence: 'user', updatedAt: new Date().toISOString() }; current.nodes.push(node); byProject.set(workspace, current); result = { node }; }
    else throw new Error(`Unexpected ${method} ${url}`);
    return { ok: true, status: 200, json: async () => copy(result) };
  };
  window.eval(script); window.ImperiumKnowledge.mount(window.document.querySelector('#knowledge'), { getState: () => state }); await settle(); t.after(() => window.close());
  return { window, document: window.document, state, calls, byProject, errors };
}

test('an empty knowledge graph has no invented nodes, edges, or automatic writes', async t => {
  const { document, calls, state, errors } = await setup(t, { initial: { nodes: [], edges: [], history: [], stats: {} } });
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 0); assert.equal(document.querySelectorAll('[data-memory-edge]').length, 0);
  assert.match(document.querySelector('.ik-empty').textContent, /first result or memory/); assert.match(document.querySelector('.ik-explanation').textContent, /model weights are not trained/);
  assert.ok(calls.every(call => call.method === 'GET' && call.path === '/api/memory' && call.workspace === state.settings.workspace)); assert.deepEqual(errors, []);
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
  const { window, document } = await setup(t, { initial: { nodes, edges: [], history: [], stats: {} } });
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 150); assert.match(document.querySelector('[data-ik-count="nodes"]').textContent, /150.*171.*171/); assert.equal(document.querySelectorAll('[data-memory-row]').length, 50);
  document.querySelector('.ik-list-footer button:last-child').click(); assert.match(document.querySelector('.ik-list-footer').textContent, /51–100.*171/);
  const search = document.querySelector('.ik-searchbar input'); search.value = 'uniquely searchable'; search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('[data-memory-node]').length, 1); assert.ok(document.querySelector('[data-memory-node="memory-0"]'));
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
