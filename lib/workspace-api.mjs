import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createMemoryStore, canonicalMemoryWorkspace } from './memory.mjs';
import { validateGraph, downstreamDepartments } from './graph.mjs';
import { PROVIDER_CATALOG, discoverModels } from './provider-catalog.mjs';
import { createTerminalManager } from './terminal.mjs';
import { buildExportWorkbook } from './export-xlsx.mjs';
import { createProjectManager } from './projects.mjs';
import { summarizeAnalytics } from './analytics.mjs';
import { createQuotaManager } from './quotas.mjs';
import { EXECUTION_CAPABILITIES } from './execution-options.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const modelValid = value => typeof value === 'string' && (value === '' || /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value));
const equal = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); };

/** Local-user features. Shell bytes and task-scoped capability tokens never enter state. */
export function createWorkspaceAPI({ dataDir, state, store, notify, bodyJSON, json, addTask, validateTask, getURL, terminalManager, modelDiscovery = discoverModels, projectParent, quotaReaders }) {
  const memory = createMemoryStore({ dataDir });
  const terminal = terminalManager || createTerminalManager();
  const projects = createProjectManager({ state, store, defaultParent: projectParent });
  const quotas = createQuotaManager({ getState: () => state, readers: quotaReaders, onChanged: () => { state.server.quotaUpdatedAt = Date.now(); notify(); } });
  const capabilities = new Map(), terminalClients = new Set();
  const scope = () => canonicalMemoryWorkspace(state.settings.workspace);
  const graph = () => state.graphs[scope()] || { nodes: [], edges: [] };
  const scopedNote = id => {
    const note = memory.get(id);
    if (!note || note.workspace !== scope()) throw fail(404, '현재 프로젝트에서 기억을 찾을 수 없습니다.');
    return note;
  };
  const persist = () => { store.save(); notify(); };
  const memoryChanged = () => { state.memoryUpdatedAt = Date.now(); notify(); };
  function taskMemory(task) {
    const retrieved = memory.search({ workspace: task.workspace, query: task.prompt.slice(0, 2000), limit: 8, maxChars: 6000 });
    const saved = state.graphs[canonicalMemoryWorkspace(task.workspace)] || { nodes: [], edges: [] };
    const linked = saved.edges.filter(e => e.type === 'memory_context' && e.target === `department:${task.departmentId}`).map(e => saved.nodes.find(n => n.id === e.source)?.referenceId).filter(Boolean);
    let context = retrieved.context, selected = retrieved.memories;
    if (linked.length) {
      const nodes = memory.snapshot({ workspace: task.workspace }).nodes.filter(n => !n.archived);
      const required = nodes.filter(n => n.pinned && n.kind === 'constraint');
      selected = [...new Map([...required, ...linked.map(id => nodes.find(n => n.id === id)).filter(Boolean)].map(n => [n.id, n])).values()];
      context = ''; const included = [];
      for (const note of selected) {
        const label = `\n[${note.id} | ${note.kind} | ${note.confidence}${note.pinned ? ' | pinned' : ''}] ${note.title}\n`;
        const available = Math.min(1800, 6000 - context.length - label.length);
        if (available < 24) break;
        context += label + note.content.slice(0, available); included.push(note);
      }
      selected = included;
    }
    task.memoryUsage = { selectedIds: selected.map(n => n.id), contextChars: context.length, totalMemoryChars: retrieved.stats.totalChars, estimatedTokens: Math.ceil(context.length / 3), retrievals: 0, method: 'local-keyword', continuous: ['codex', 'claude'].includes(task.provider) };
    const token = randomBytes(32).toString('hex');
    capabilities.set(token, { task, workspace: canonicalMemoryWorkspace(task.workspace) });
    return { context, memory: { url: getURL(), token }, revoke: () => capabilities.delete(token) };
  }
  function capture(task) {
    try { memory.captureTask(task, { workspace: task.workspace || state.settings.workspace }); } catch (error) { console.error('[memory]', error.message); }
    memoryChanged();
  }
  async function handleAgent(req, res, route, url) {
    const capability = capabilities.get(String(req.headers['x-imperium-memory-token'] || ''));
    if (!capability || !equal(req.headers['x-imperium-memory-token'], [...capabilities.keys()].find(key => equal(key, req.headers['x-imperium-memory-token'])))) throw fail(403, '유효한 작업 기억 권한이 필요합니다.');
    const { task, workspace } = capability;
    if (task.status !== 'running') throw fail(403, '종료된 작업의 기억 권한입니다.');
    let value;
    if (route === '/api/agent-memory/search' && req.method === 'POST') {
      const input = await bodyJSON(req);
      value = memory.search({ workspace, query: input.query, limit: input.limit || 6, maxChars: 6000 });
    } else if (route === '/api/agent-memory/list' && req.method === 'GET') value = { nodes: memory.list({ workspace, query: url.searchParams.get('query') || '', limit: Number(url.searchParams.get('limit') || 20) }) };
    else {
      const match = /^\/api\/agent-memory\/get\/([\w-]+)$/.exec(route);
      if (!match || req.method !== 'GET') throw fail(404, '읽기 전용 기억 도구만 사용할 수 있습니다.');
      const note = memory.get(match[1]);
      if (!note || note.workspace !== workspace || note.archived) throw fail(404, '기억을 찾을 수 없습니다.');
      value = { node: note };
    }
    if (task.memoryUsage) task.memoryUsage.retrievals += 1;
    if (task.memoryUsage) task.memoryUsage.retrievedChars = (task.memoryUsage.retrievedChars || 0) + JSON.stringify(value).length;
    store.persist(); notify(); json(res, 200, value);
  }
  async function handle(req, res, route, url) {
    if (route === '/api/execution/capabilities' && req.method === 'GET') { json(res, 200, { providers: EXECUTION_CAPABILITIES }); return true; }
    if (route === '/api/quotas' && req.method === 'GET') { json(res, 200, await quotas.get()); return true; }
    if (route === '/api/quotas/refresh' && req.method === 'POST') { await bodyJSON(req); json(res, 200, await quotas.get({ force: true })); return true; }
    const requestScope = scope();
    const ensureScope = input => {
      if (scope() !== requestScope || input.workspace !== undefined && canonicalMemoryWorkspace(input.workspace) !== requestScope) throw fail(409, '프로젝트가 변경됐습니다. 현재 화면을 새로고침해 주세요.');
    };
    if (url.searchParams.has('workspace')) ensureScope({ workspace: url.searchParams.get('workspace') });
    if (route === '/api/projects' && req.method === 'GET') { json(res, 200, projects.list()); return true; }
    if (route === '/api/projects' && req.method === 'POST') { const project = await projects.create(await bodyJSON(req)); notify(); json(res, 201, { project }); return true; }
    const projectMatch = /^\/api\/projects\/([\w-]+)(\/select)?$/.exec(route);
    if (projectMatch && req.method === 'POST' && projectMatch[2]) {
      if (state.tasks.some(t => ['running', 'queued'].includes(t.status))) throw fail(409, '모든 작업이 끝난 뒤 프로젝트를 변경해 주세요.');
      const project = await projects.select(projectMatch[1]); notify(); json(res, 200, { project }); return true;
    }
    if (projectMatch && req.method === 'PATCH' && !projectMatch[2]) { const project = projects.update(projectMatch[1], await bodyJSON(req)); notify(); json(res, 200, { project }); return true; }
    if (route === '/api/analytics' && req.method === 'GET') { json(res, 200, { analytics: summarizeAnalytics(state) }); return true; }
    if (route === '/api/memory' && req.method === 'GET') { json(res, 200, memory.snapshot({ workspace: scope() })); return true; }
    if (route === '/api/memory' && req.method === 'POST') {
      const input = await bodyJSON(req);
      ensureScope(input);
      const node = memory.upsert({ title: input.title, content: input.content, kind: input.kind || 'note', tags: input.tags || [], pinned: input.pinned === true, workspace: scope(), source: 'user' });
      memoryChanged(); json(res, 201, { node }); return true;
    }
    const memoryMatch = /^\/api\/memory\/([\w-]+)$/.exec(route);
    if (memoryMatch && ['PATCH', 'DELETE'].includes(req.method)) {
      const input = req.method === 'DELETE' && !req.headers['content-length'] && !req.headers['transfer-encoding'] ? {} : await bodyJSON(req); ensureScope(input);
      const old = scopedNote(memoryMatch[1]);
      if (req.method === 'DELETE') { memory.remove(old.id); memoryChanged(); json(res, 200, { ok: true }); }
      else {
        const allowed = {};
        const expectedRevision = input.expectedRevision ?? input.revision;
        if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw fail(400, '수정할 기억의 버전이 필요합니다. 다시 불러온 뒤 저장해 주세요.');
        for (const key of ['title', 'content', 'kind', 'tags', 'pinned']) if (Object.hasOwn(input, key)) allowed[key] = input[key];
        const node = memory.upsert({ ...old, ...allowed, workspace: scope(), source: 'user', confidence: 'user' }, { expectedRevision });
        memoryChanged(); json(res, 200, { node });
      }
      return true;
    }
    if (route === '/api/graph' && req.method === 'GET') { json(res, 200, { graph: graph() }); return true; }
    if (route === '/api/graph' && req.method === 'PUT') {
      const input = await bodyJSON(req, 512 * 1024); ensureScope(input);
      const validated = validateGraph(input, { departments: state.departments, memoryNodes: memory.snapshot({ workspace: scope() }).nodes.filter(n => !n.archived), providerIds: state.providers.map(p => p.id) });
      state.graphs[scope()] = validated; persist(); json(res, 200, { graph: validated }); return true;
    }
    if (route === '/api/workflows/run' && req.method === 'POST') {
      const input = await bodyJSON(req), saved = graph();
      ensureScope(input);
      if (!state.departments.some(d => d.id === input.departmentId)) throw fail(400, '부서를 선택해 주세요.');
      const ordered = [input.departmentId, ...downstreamDepartments(input.departmentId, saved.edges)];
      if (state.tasks.filter(t => ['running', 'queued'].includes(t.status)).length + ordered.length > 30) throw fail(409, '작업 대기열이 가득 찼습니다.');
      // Use the same complete provider/model/permission checks as direct dispatch.
      // This loop has no side effects: a rejected downstream assignment cannot
      // accidentally start an earlier writable job.
      for (const id of ordered) validateTask({ ...input, departmentId: id });
      const workflowId = randomUUID(), tasks = [], byDepartment = new Map();
      for (const id of ordered) {
        const task = addTask({ ...input, departmentId: id });
        task.workflowId = workflowId;
        task.dependsOn = saved.edges.filter(e => e.type === 'handoff' && e.target === `department:${id}`).map(e => byDepartment.get(e.source.slice('department:'.length))?.id).filter(Boolean);
        byDepartment.set(id, task); tasks.push(task);
      }
      persist(); json(res, 201, { workflowId, tasks }); return true;
    }
    if (route === '/api/providers/catalog' && req.method === 'GET') { json(res, 200, { catalog: PROVIDER_CATALOG, connections: state.connections }); return true; }
    const modelsMatch = /^\/api\/providers\/([\w-]+)\/models$/.exec(route);
    if (modelsMatch && req.method === 'GET') {
      if (state.settings.localOnly && modelsMatch[1] !== 'ollama') throw fail(403, '로컬 전용 모드에서는 클라우드 모델 목록에 연결하지 않습니다.');
      json(res, 200, await modelDiscovery(modelsMatch[1])); return true;
    }
    if (route === '/api/providers/register' && req.method === 'POST') {
      const input = await bodyJSON(req);
      if (!PROVIDER_CATALOG.some(p => p.id === input.providerId) || !modelValid(input.modelId ?? '') || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 80) throw fail(400, '제공자, 이름과 모델 ID를 확인해 주세요.');
      if (state.connections.length >= 40) throw fail(409, '연결은 최대 40개까지 등록할 수 있습니다.');
      const connection = { id: randomUUID(), providerId: input.providerId, modelId: input.modelId || '', label: input.label.trim(), createdAt: new Date().toISOString() };
      state.connections.push(connection); persist(); json(res, 201, { connection, connections: state.connections }); return true;
    }
    const connectionMatch = /^\/api\/providers\/connections\/([\w-]+)$/.exec(route);
    if (connectionMatch && req.method === 'DELETE') {
      if (state.tasks.some(t => t.connectionId === connectionMatch[1] && ['queued', 'running'].includes(t.status))) throw fail(409, '이 연결의 작업이 끝난 뒤 삭제해 주세요.');
      if (state.departments.some(d => d.connectionId === connectionMatch[1])) throw fail(409, '부서에 할당된 연결입니다. 부서 모델을 먼저 변경해 주세요.');
      state.connections = state.connections.filter(c => c.id !== connectionMatch[1]); persist(); json(res, 200, { ok: true }); return true;
    }
    if (route === '/api/export.xlsx' && req.method === 'GET') {
      const buffer = await buildExportWorkbook(state, { memory: memory.snapshot({ workspace: scope() }), language: state.settings.language });
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="imperium-records.xlsx"', 'Cache-Control': 'no-store' }); res.end(buffer); return true;
    }
    if (route === '/api/terminal' && req.method === 'GET') { json(res, 200, { sessions: terminal.list() }); return true; }
    if (route === '/api/terminal' && req.method === 'POST') {
      const input = await bodyJSON(req);
      const session = await terminal.start({ cwd: state.settings.workspace, shell: input.shell || 'default', cols: input.cols, rows: input.rows });
      json(res, 201, { session }); return true;
    }
    const terminalMatch = /^\/api\/terminal\/(term_[0-9a-f]{24})\/(input|resize|close|events)$/.exec(route);
    if (terminalMatch) {
      const [, id, action] = terminalMatch;
      if (action === 'events' && req.method === 'GET') {
        if (terminalClients.size >= 12) throw fail(429, '열린 터미널 화면이 너무 많습니다.');
        const session = terminal.get(id);
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        const send = event => { if (!res.destroyed) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); };
        send({ type: 'data', data: session.output });
        const unsubscribe = terminal.subscribe(id, send);
        if (session.status === 'closed') send({ type: 'exit', exitCode: session.exitCode });
        terminalClients.add(res);
        const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); }, 20000); heartbeat.unref();
        req.on('close', () => { clearInterval(heartbeat); unsubscribe(); terminalClients.delete(res); });
        return true;
      }
      if (req.method === 'POST' && action !== 'events') {
        const input = await bodyJSON(req);
        if (action === 'input') terminal.write(id, input.data);
        else if (action === 'resize') terminal.resize(id, input.cols, input.rows);
        else terminal.close(id);
        json(res, 200, { ok: true }); return true;
      }
    }
    return false;
  }
  return { handle, handleAgent, taskMemory, capture, observeQuota: (provider, value) => quotas.observe(provider, value), quotaSettingsChanged: () => quotas.setOffline(state.settings.localOnly === true), invalidateQuotas: () => quotas.invalidate(), prepare: () => projects.list(), switchWorkspace: workspace => projects.switchWorkspace(workspace), snapshot: () => memory.snapshot({ workspace: scope() }), close() { quotas.close(); capabilities.clear(); terminal.closeAll(); for (const client of terminalClients) client.end(); terminalClients.clear(); } };
}
