import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../public/organization-nodes.js', import.meta.url), 'utf8');
const workspace = 'C:\\Projects\\Node Organization';
const department = id => ({ id, name: `Role ${id}`, title: 'Engineer', role: 'Build verified artifacts', provider: 'codex', modelId: 'requested-model' });
const initial = extra => ({ settings: { workspace, language: 'en', identity: { name: 'Owner' } }, server: { csrfToken: 'session' }, departments: [department('frontend'), department('backend')], tasks: [], graph: { nodes: [{ id: 'department:frontend', referenceId: 'frontend', type: 'department', x: 111, y: 222 }, { id: 'department:backend', referenceId: 'backend', type: 'department', x: 777, y: 888 }], edges: [{ id: 'actual-handoff', source: 'department:frontend', target: 'department:backend', type: 'handoff' }] }, ...extra });
const saved = (key = workspace, extra = {}) => ({ workspace: key, revision: 4, positions: { owner: { x: 320, y: 20 }, 'agent:frontend': { x: 30, y: 270 }, 'agent:backend': { x: 540, y: 270 } }, viewport: { pan: { x: 12, y: 18 }, zoom: 1 }, ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
// Hydration schedules a browser paint; click only after controls reflect it.
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 20)); };
function fixture(t, { state = initial(), api } = {}) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="source"><div id="owner"><div class="org-commander-card">Actual owner</div></div><ul id="roles"></ul></div><div id="canvas"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://127.0.0.1:4310/' });
  const { window } = dom, document = window.document, container = document.querySelector('#canvas'), owner = document.querySelector('#owner'), list = document.querySelector('#roles'), calls = [], timers = new Map();
  let current = state, sequence = 0, buttonClicks = 0, connectionEdits = 0, clock = 0;
  window.setTimeout = (callback, delay = 0) => { const id = ++sequence; timers.set(id, { callback, delay, due: clock + delay }); return id; }; window.clearTimeout = id => timers.delete(id);
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1100, bottom: 680, width: 1100, height: 680 });
  Object.defineProperty(container, 'clientWidth', { value: 1100 }); Object.defineProperty(container, 'clientHeight', { value: 680 });
  function makeRole(id) {
    const node = document.createElement('li'); node.className = 'org-agent-card'; node.dataset.departmentId = id;
    const heading = document.createElement('div'); heading.className = 'org-agent-heading'; const title = document.createElement('h3'); title.textContent = `Role ${id}`;
    const button = document.createElement('button'); button.textContent = 'Keep existing action'; button.type = 'button'; button.addEventListener('click', () => { buttonClicks++; }); heading.append(title, button);
    const skills = document.createElement('span'); skills.className = 'org-skill-chip'; skills.textContent = 'Bound real skill'; node.append(heading, skills); list.append(node); return node;
  }
  for (const dept of state.departments) makeRole(dept.id);
  window.eval(script);
  const apiCall = async (path, config = {}) => { calls.push({ path, ...config }); if (api) return api(path, config); const key = config.body?.workspace || new URL(path, 'http://localhost').searchParams.get('workspace'); return config.method === 'PUT' ? { ...config.body, revision: config.body.revision + 1 } : saved(key); };
  const engine = window.ImperiumOrganizationNodes.create({ container, owner, list, api: apiCall, getState: () => current, language: 'en', onEditConnections: () => { connectionEdits++; } });
  const update = (next = current, options = {}) => { current = next; engine.update(current, { language: 'en', connected: true, ...options }); for (const stage of container.querySelectorAll('.on-stage')) stage.getBoundingClientRect = container.getBoundingClientRect; };
  update();
  t.after(() => { engine.destroy(); window.close(); });
  const pointer = (target, type, x, y) => { const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event); };
  const flush = async () => { for (let round = 0; round < 6 && timers.size; round++) { const pending = [...timers.values()]; timers.clear(); for (const timer of pending) timer.callback(); await settle(); } await settle(); };
  const advance = async milliseconds => {
    const end = clock + milliseconds;
    for (let count = 0; count < 100; count++) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0]; if (!next) break;
      clock = next[1].due; timers.delete(next[0]); next[1].callback(); await settle();
    }
    clock = end; await settle();
  };
  const drag = (id, dx = 45, dy = 30) => { const handle = container.querySelector(`.on-node[data-node-id="${id}"] .on-node-drag-handle`) || container.querySelector(`.on-node[data-node-id="${id}"].on-node-drag-handle`); assert.ok(handle, `drag handle for ${id}`); pointer(handle, 'pointerdown', 100, 100); pointer(document, 'pointermove', 100 + dx, 100 + dy); pointer(document, 'pointerup', 100 + dx, 100 + dy); };
  return { window, document, container, owner, list, calls, timers, engine, update, makeRole, pointer, drag, flush, advance, get state() { return current; }, get buttonClicks() { return buttonClicks; }, get connectionEdits() { return connectionEdits; }, node(id) { return container.querySelector(`.on-node[data-node-id="${id}"]`); }, action(name) { const button = container.querySelector(`[data-on-action="${name}"]`); assert.ok(button, name); button.click(); }, writes() { return calls.filter(call => call.method === 'PUT'); } };
}

test('hydrated organization nodes retain original role DOM, explicit saved positions and workflow graph without initial writes', async t => {
  const state = initial(), originalGraph = structuredClone(state.graph), ui = fixture(t, { state }); await settle();
  assert.ok(ui.container.querySelector('.on-stage .on-world')); assert.ok(ui.node('owner')); assert.ok(ui.node('agent:frontend')); assert.ok(ui.node('agent:backend'));
  assert.equal(ui.container.contains(ui.owner), true); assert.equal(ui.container.contains(ui.list), true); assert.match(ui.node('agent:frontend').textContent, /Bound real skill/);
  assert.equal(ui.container.querySelectorAll('[data-edge-type=membership]').length, 2); const handoff = ui.container.querySelector('[data-edge-type=handoff]'); assert.ok(handoff); assert.equal(handoff.dataset.source, 'agent:frontend'); assert.equal(handoff.dataset.target, 'agent:backend'); assert.match(handoff.getAttribute('marker-end'), /url\(#/); assert.equal(ui.container.querySelector('[data-edge-type=membership]').hasAttribute('marker-end'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.engine.getLayout().positions)), saved().positions); assert.equal(ui.engine.getLayout().revision, 4); assert.equal(ui.writes().length, 0);
  assert.deepEqual(state.graph, originalGraph); ui.engine.fit(); await ui.flush(); assert.equal(ui.calls.some(call => call.path.startsWith('/api/graph')), false);
});

test('an empty saved layout yields a display-only default, not automatic canvas seeding or saving', async t => {
  const graph = { nodes: [], edges: [] }, ui = fixture(t, { state: initial({ graph }), api: async path => saved(new URL(path, 'http://localhost').searchParams.get('workspace'), { revision: 0, positions: {}, viewport: { pan: { x: 0, y: 0 }, zoom: 1 } }) }); await settle(); await ui.flush();
  const positions = ui.engine.getLayout().positions; assert.ok(positions.owner); assert.ok(positions['agent:frontend']); assert.ok(positions['agent:backend']); assert.equal(ui.writes().length, 0); assert.deepEqual(graph, { nodes: [], edges: [] });
});

test('dragging an agent saves only organization coordinates with captured workspace and CAS revision', async t => {
  const ui = fixture(t); await settle(); const before = ui.engine.getLayout().positions['agent:frontend']; ui.drag('agent:frontend'); await ui.flush();
  assert.equal(ui.writes().length, 1); const write = ui.writes()[0]; assert.equal(write.path.split('?')[0], '/api/organization-layout'); assert.equal(write.body.workspace, workspace); assert.equal(write.body.revision, 4);
  assert.notDeepEqual(write.body.positions['agent:frontend'], before); assert.equal(write.body.positions['agent:backend'].x, saved().positions['agent:backend'].x); assert.equal(ui.engine.getLayout().revision, 5);
  assert.equal(ui.calls.some(call => /api\/(graph|tasks|workflows)/.test(call.path)), false); assert.deepEqual(ui.state.graph, initial().graph);
});

test('continuous output-only SSE updates cannot postpone an already scheduled organization layout save', async t => {
  const ui = fixture(t); await settle(); const graph = structuredClone(ui.state.graph); ui.drag('agent:frontend');
  const moved = JSON.stringify(ui.engine.getLayout().positions);
  for (let step = 0; step < 10; step++) {
    ui.update({ ...ui.state, tasks: [{ id: 'streaming-task', workspace, departmentId: 'frontend', status: 'running', output: `Public output ${step}` }] });
    await ui.advance(100);
    if (step === 3) assert.equal(ui.writes().length, 1, 'the original 350ms deadline must run despite 100ms SSE updates');
  }
  assert.equal(ui.writes().length, 1); assert.equal(ui.engine.getLayout().revision, 5); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(JSON.stringify(ui.engine.getLayout().positions), moved); assert.deepEqual(ui.state.graph, graph);
});

test('offline edits save once after reconnect despite continued updates and a project switch cancels queued old-project writes', async t => {
  const ui = fixture(t); await settle(); ui.update(ui.state, { connected: false }); ui.drag('agent:frontend'); await ui.advance(1000);
  assert.equal(ui.writes().length, 0); assert.equal(ui.engine.getLayout().dirty, true);
  for (let step = 0; step < 5; step++) { ui.update(ui.state, { connected: true }); await ui.advance(100); }
  assert.equal(ui.writes().length, 1); assert.equal(ui.writes()[0].body.workspace, workspace); assert.equal(ui.engine.getLayout().dirty, false);
  ui.drag('agent:frontend'); await ui.advance(200); const other = 'C:\\Scheduled other project'; ui.update(initial({ settings: { workspace: other } })); await settle(); await ui.advance(1000);
  assert.equal(ui.writes().length, 1); assert.equal(ui.engine.getLayout().workspace, other); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(ui.engine.getLayout().revision, 4);
});

test('new user geometry edits still debounce from the latest edit rather than the first scheduled deadline', async t => {
  const ui = fixture(t); await settle(); ui.drag('agent:frontend'); await ui.advance(200); ui.drag('agent:frontend', 90, 60);
  const latest = JSON.stringify(ui.engine.getLayout().positions); await ui.advance(200); assert.equal(ui.writes().length, 0); await ui.advance(150);
  assert.equal(ui.writes().length, 1); assert.equal(JSON.stringify(ui.writes()[0].body.positions), latest); assert.equal(ui.engine.getLayout().dirty, false);
});

test('child buttons keep their original actions and never begin a node drag; unchanged rerenders retain nodes and focus', async t => {
  const ui = fixture(t); await settle(); const node = ui.node('agent:frontend'), button = node.querySelector('button'), before = JSON.stringify(ui.engine.getLayout().positions); button.focus();
  ui.pointer(button, 'pointerdown', 100, 100); ui.pointer(ui.document, 'pointermove', 190, 180); ui.pointer(ui.document, 'pointerup', 190, 180); button.click(); await ui.flush();
  assert.equal(ui.buttonClicks, 1); assert.equal(JSON.stringify(ui.engine.getLayout().positions), before); assert.equal(ui.writes().length, 0);
  ui.update({ ...ui.state, tasks: [{ id: 'work', workspace, departmentId: 'frontend', status: 'running' }] }, { language: 'ja' }); assert.equal(ui.node('agent:frontend'), node); assert.equal(ui.document.activeElement, button);
});

test('node details preserve their own action focus through SSE changes and respect an unrelated open dialog', async t => {
  const ui = fixture(t); await settle();
  const node = ui.node('agent:frontend'), assignment = ui.document.createElement('p'); assignment.className = 'org-agent-task'; assignment.textContent = 'Current task: implement frontend'; node.append(assignment);
  node.querySelector('.org-agent-heading').click();
  const inspector = ui.container.querySelector('aside.on-inspector'); assert.equal(inspector.hidden, false);
  const original = inspector.querySelector('.on-inspector-actions button'); assert.ok(original, inspector.textContent); original.focus();
  ui.update({ ...ui.state, server: { ...ui.state.server, streamedAt: 1 } });
  assert.equal(inspector.querySelector('.on-inspector-actions button'), original); assert.equal(original.isConnected, true); assert.equal(ui.document.activeElement, original);
  assignment.textContent = 'Current task: verify the finished frontend'; ui.update({ ...ui.state, tasks: [{ id: 'new-task', workspace, departmentId: 'frontend', status: 'running', title: 'Verify frontend' }] });
  const equivalent = inspector.querySelector('.on-inspector-actions button'); assert.equal(ui.document.activeElement, equivalent); assert.equal(equivalent.isConnected, true); assert.equal(equivalent.textContent, original.textContent); assert.match(inspector.textContent, /verify the finished frontend/);
  const modal = ui.document.createElement('dialog'), input = ui.document.createElement('input'); modal.setAttribute('open', ''); modal.append(input); ui.document.body.append(modal); input.focus();
  assignment.textContent = 'Current task: another streamed update'; ui.update({ ...ui.state, server: { ...ui.state.server, streamedAt: 2 } });
  assert.equal(ui.document.activeElement, input); assert.equal(modal.open, true); assert.equal(ui.writes().length, 0);
});

test('zoom and explicit auto-arrange save layout without rewriting execution edges or node positions in the workflow', async t => {
  const ui = fixture(t); await settle(); const originalGraph = structuredClone(ui.state.graph), before = JSON.stringify(ui.engine.getLayout().positions), zoom = ui.engine.getLayout().viewport.zoom;
  ui.action('zoom-in'); await ui.flush(); assert.ok(ui.engine.getLayout().viewport.zoom > zoom); assert.equal(JSON.stringify(ui.engine.getLayout().positions), before);
  ui.engine.arrange(); await ui.flush(); assert.equal(ui.writes().length, 2); assert.deepEqual(ui.state.graph, originalGraph); assert.equal(ui.writes().every(call => call.path.startsWith('/api/organization-layout')), true);
  ui.action('connections'); assert.equal(ui.connectionEdits, 1); assert.equal(ui.calls.some(call => call.path.startsWith('/api/workflows/run')), false);
});

test('a late GET from another project cannot move nodes or change the current project revision', async t => {
  const first = deferred(), other = 'C:\\Other project'; const ui = fixture(t, { api: async path => new URL(path, 'http://localhost').searchParams.get('workspace') === workspace ? first.promise : saved(other, { revision: 12, positions: { owner: { x: 900, y: 40 }, 'agent:frontend': { x: 980, y: 500 }, 'agent:backend': { x: 1400, y: 500 } } }) });
  const unloaded = JSON.stringify(ui.engine.getLayout().positions); ui.drag('agent:frontend'); ui.engine.arrange(); ui.action('zoom-in'); await ui.flush(); assert.equal(JSON.stringify(ui.engine.getLayout().positions), unloaded, 'editing waits for initial hydration'); assert.equal(ui.writes().length, 0);
  ui.update(initial({ settings: { workspace: other, language: 'en' } })); await settle(); first.resolve(saved(workspace)); await settle();
  assert.equal(ui.engine.getLayout().workspace, other); assert.equal(ui.engine.getLayout().revision, 12); assert.equal(ui.engine.getLayout().positions.owner.x, 900); assert.equal(ui.writes().length, 0);
});

test('a late save acknowledgement from the old project cannot overwrite the new layout', async t => {
  const pending = deferred(), other = 'C:\\New project'; const ui = fixture(t, { api: async (path, config) => config.method === 'PUT' ? pending.promise : saved(new URL(path, 'http://localhost').searchParams.get('workspace'), new URL(path, 'http://localhost').searchParams.get('workspace') === other ? { revision: 20 } : {}) });
  await settle(); ui.drag('agent:frontend'); await ui.flush(); assert.equal(ui.writes().length, 1);
  ui.update(initial({ settings: { workspace: other } })); await settle(); pending.resolve(saved(workspace, { revision: 5 })); await settle();
  assert.equal(ui.engine.getLayout().workspace, other); assert.equal(ui.engine.getLayout().revision, 20); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(ui.writes().length, 1);
});

test('a CAS conflict keeps unsaved coordinates, blocks automatic overwrite and requires explicit reload', async t => {
  let gets = 0; const ui = fixture(t, { api: async (path, config) => { if (config.method === 'PUT') { const failure = new Error('Layout revision conflict'); failure.status = 409; throw failure; } gets++; return saved(workspace, gets > 1 ? { revision: 8, positions: { owner: { x: 100, y: 20 }, 'agent:frontend': { x: 1500, y: 700 }, 'agent:backend': { x: 2200, y: 700 } } } : {}); } });
  await settle(); ui.drag('agent:frontend'); const moved = JSON.stringify(ui.engine.getLayout().positions); await ui.flush(); assert.equal(ui.engine.getLayout().dirty, true); assert.equal(ui.engine.getLayout().blocked, true); assert.equal(JSON.stringify(ui.engine.getLayout().positions), moved); assert.ok(ui.container.querySelector('[role=status]').textContent);
  ui.update(); await ui.flush(); assert.equal(ui.writes().length, 1); assert.equal(gets, 1, 'no automatic reload or stale-write retry');
  ui.action('reload'); await settle(); assert.equal(gets, 2); assert.equal(ui.engine.getLayout().revision, 8); assert.equal(ui.engine.getLayout().positions['agent:frontend'].x, 1500); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(ui.engine.getLayout().blocked, false);
});

test('network and server save errors offer an explicit retry of the retained layout without reloading or duplicate writes', async t => {
  for (const status of [undefined, 503]) {
    let gets = 0, puts = 0; const pendingRetry = deferred();
    const ui = fixture(t, { api: async (path, config) => {
      if (config.method !== 'PUT') { gets++; return saved(workspace); }
      puts++; if (puts === 1) { const failure = new Error(status ? 'Temporary server error' : 'Network connection was lost'); if (status) failure.status = status; throw failure; }
      return pendingRetry.promise;
    } });
    await settle(); ui.drag('agent:frontend'); await ui.flush();
    const arrangement = JSON.stringify(ui.engine.getLayout().positions), viewport = JSON.stringify(ui.engine.getLayout().viewport), first = ui.writes()[0];
    assert.equal(ui.engine.getLayout().dirty, true); assert.equal(ui.engine.getLayout().revision, 4); assert.equal(puts, 1); assert.equal(gets, 1);
    const retry = ui.container.querySelector('[data-on-action=retry]'); assert.ok(retry); assert.equal(retry.hidden, false); assert.equal(retry.disabled, false);
    ui.update(); await ui.flush(); assert.equal(puts, 1, 'failed saves never retry in the background'); assert.equal(gets, 1);
    retry.click(); retry.click(); await settle(); assert.equal(puts, 2, 'only one retry may be in flight'); assert.equal(gets, 1);
    const second = ui.writes()[1]; assert.deepEqual(second.body, first.body, 'retry sends the retained local coordinates and original CAS revision');
    pendingRetry.resolve({ ...second.body, revision: second.body.revision + 1 }); await ui.flush();
    assert.equal(ui.engine.getLayout().revision, 5); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(ui.engine.getLayout().blocked, false); assert.equal(JSON.stringify(ui.engine.getLayout().positions), arrangement); assert.equal(JSON.stringify(ui.engine.getLayout().viewport), viewport);
    assert.equal(gets, 1); assert.equal(ui.calls.every(call => call.path.startsWith('/api/organization-layout')), true);
  }
});

test('an uncertain network failure followed by a CAS conflict retains dirty geometry and disables further retry', async t => {
  let gets = 0, puts = 0; const ui = fixture(t, { api: async (path, config) => {
    if (config.method !== 'PUT') { gets++; return saved(workspace); }
    puts++; if (puts === 1) throw new Error('The response was lost after the server may have committed');
    const conflict = new Error('Revision 4 is stale because the first write committed'); conflict.status = 409; throw conflict;
  } });
  await settle(); ui.drag('agent:frontend'); await ui.flush(); const arrangement = JSON.stringify(ui.engine.getLayout().positions);
  ui.action('retry'); await ui.flush(); assert.equal(puts, 2); assert.equal(gets, 1); assert.equal(ui.writes()[1].body.revision, 4, 'an uncertain response must not invent a successful revision');
  assert.equal(JSON.stringify(ui.engine.getLayout().positions), arrangement); assert.equal(ui.engine.getLayout().revision, 4); assert.equal(ui.engine.getLayout().dirty, true); assert.equal(ui.engine.getLayout().blocked, true);
  const retry = ui.container.querySelector('[data-on-action=retry]'); assert.ok(!retry || retry.hidden || retry.disabled); retry?.click(); ui.update(); await ui.flush();
  assert.equal(puts, 2, '409 requires explicit conflict resolution rather than another write'); assert.equal(gets, 1); assert.match(ui.container.querySelector('[role=status]').textContent, /reload/i); assert.equal(ui.calls.every(call => call.path.startsWith('/api/organization-layout')), true);
});

test('a conflict followed by a failed reload stays blocked until an explicit successful reload, with no stale retry PUT', async t => {
  let gets = 0, puts = 0; const ui = fixture(t, { api: async (path, config) => {
    if (config.method === 'PUT') { puts++; const failure = new Error('CAS conflict'); failure.status = 409; throw failure; }
    gets++; if (gets === 2) { const failure = new Error('Reload temporarily unavailable'); failure.status = 503; throw failure; }
    return saved(workspace, gets >= 3 ? { revision: 9, positions: { owner: { x: 300, y: 20 }, 'agent:frontend': { x: 1200, y: 800 }, 'agent:backend': { x: 1600, y: 800 } } } : {});
  } });
  await settle(); ui.drag('agent:frontend'); await ui.flush(); const local = JSON.stringify(ui.engine.getLayout().positions);
  ui.action('reload'); await settle(); assert.equal(gets, 2); assert.equal(puts, 1); assert.equal(ui.engine.getLayout().dirty, true); assert.equal(ui.engine.getLayout().blocked, true); assert.equal(JSON.stringify(ui.engine.getLayout().positions), local);
  const retry = ui.container.querySelector('[data-on-action=retry]'); assert.ok(!retry || retry.hidden || retry.disabled); retry?.dispatchEvent(new ui.window.MouseEvent('click', { bubbles: true })); ui.update(); await ui.flush();
  assert.equal(puts, 1, 'a failed reload cannot turn conflict recovery into a stale write'); assert.equal(gets, 2);
  ui.action('reload'); await settle(); assert.equal(gets, 3); assert.equal(puts, 1); assert.equal(ui.engine.getLayout().revision, 9); assert.equal(ui.engine.getLayout().positions['agent:frontend'].x, 1200); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(ui.engine.getLayout().blocked, false);
});

test('retry after a clean-layout reload failure performs only GET and keeps the error until that GET succeeds', async t => {
  let gets = 0, puts = 0; const recovery = deferred(); const ui = fixture(t, { api: async (path, config) => {
    if (config.method === 'PUT') { puts++; throw new Error('A clean layout must never be saved as load recovery'); }
    gets++; if (gets === 2) { const failure = new Error('Reload failed'); failure.status = 503; throw failure; }
    return gets === 3 ? recovery.promise : saved(workspace);
  } });
  await settle(); ui.action('reload'); await settle(); assert.equal(gets, 2); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(ui.engine.getLayout().blocked, true);
  const retry = ui.container.querySelector('[data-on-action=retry]'); assert.ok(retry); assert.equal(retry.hidden, false); retry.click(); await settle();
  assert.equal(gets, 3); assert.equal(puts, 0); assert.equal(ui.engine.getLayout().blocked, true, 'starting a load must not pretend the error is already resolved'); assert.equal(ui.engine.getLayout().revision, 4);
  recovery.resolve(saved(workspace, { revision: 7 })); await settle(); assert.equal(ui.engine.getLayout().revision, 7); assert.equal(ui.engine.getLayout().blocked, false); assert.equal(ui.engine.getLayout().dirty, false); assert.equal(puts, 0); assert.equal(ui.calls.every(call => call.path.startsWith('/api/organization-layout')), true);
});

test('save retry guards disconnected and active-pointer states before clearing the retained error', async t => {
  let puts = 0; const ui = fixture(t, { api: async (path, config) => {
    if (config.method !== 'PUT') return saved(workspace);
    puts++; if (puts === 1) throw new Error('Temporary network failure'); return { ...config.body, revision: config.body.revision + 1 };
  } });
  await settle(); ui.drag('agent:frontend'); await ui.flush(); const arrangement = JSON.stringify(ui.engine.getLayout().positions);
  ui.update(ui.state, { connected: false }); await settle(); let retry = ui.container.querySelector('[data-on-action=retry]'); retry.dispatchEvent(new ui.window.MouseEvent('click', { bubbles: true })); await ui.flush();
  assert.equal(puts, 1); assert.equal(ui.engine.getLayout().blocked, true); assert.equal(JSON.stringify(ui.engine.getLayout().positions), arrangement);
  ui.update(ui.state, { connected: true }); await settle(); const handle = ui.node('agent:frontend').querySelector('.on-node-drag-handle'); ui.pointer(handle, 'pointerdown', 100, 100);
  retry = ui.container.querySelector('[data-on-action=retry]'); retry.dispatchEvent(new ui.window.MouseEvent('click', { bubbles: true })); await ui.flush(); assert.equal(puts, 1); assert.equal(ui.engine.getLayout().blocked, true);
  ui.pointer(ui.document, 'pointercancel', 100, 100); await settle(); ui.action('retry'); await ui.flush(); assert.equal(puts, 2); assert.equal(ui.engine.getLayout().blocked, false); assert.equal(ui.engine.getLayout().dirty, false);
});

test('only current role nodes survive roster changes and stale task/provided graph labels cannot create organization roles', async t => {
  const ui = fixture(t); await settle(); const owner = ui.node('owner'), retained = ui.node('agent:frontend'); ui.list.querySelector('[data-department-id=backend]').remove(); ui.makeRole('qa');
  ui.update(initial({ departments: [department('frontend'), department('qa')], tasks: [{ id: 'old', workspace, departmentId: 'removed', status: 'running' }] }));
  assert.equal(ui.node('owner'), owner); assert.equal(ui.node('agent:frontend'), retained); assert.equal(ui.node('agent:backend'), null); assert.ok(ui.node('agent:qa')); assert.equal(ui.node('agent:removed'), null); assert.equal(ui.writes().length, 0);
});

test('destroy cancels pending geometry persistence without touching workflow data', async t => {
  const ui = fixture(t); await settle(); const graph = structuredClone(ui.state.graph); ui.drag('agent:frontend'); ui.engine.destroy();
  ui.pointer(ui.document, 'pointermove', 400, 400); ui.pointer(ui.document, 'pointerup', 400, 400); ui.window.dispatchEvent(new ui.window.Event('resize')); await ui.flush();
  assert.equal(ui.writes().length, 0); assert.deepEqual(ui.state.graph, graph); assert.equal(ui.calls.some(call => call.path.startsWith('/api/graph')), false);
});
