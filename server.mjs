import http from 'node:http';
import { readFile, realpath, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createStore } from './lib/store.mjs';
import * as defaultProviders from './lib/providers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const PRIORITY = { high: 0, normal: 1, low: 2 };
const MAX_PROMPT = 12000;
const MAX_OUTPUT = 200000;
const MAX_LOGS = 300;
const json = (res, code, value) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
const fail = (status, message) => Object.assign(new Error(message), { status });

async function bodyJSON(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON 형식으로 요청해 주세요.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw fail(413, '요청이 너무 큽니다. 지시를 짧게 나눠 주세요.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw fail(400, '올바른 JSON 요청이 아닙니다.'); }
}

export function createHQServer({
  dataDir = path.join(HERE, '.hq'), workspace = path.join(HERE, 'workspace'),
  port = 4310, providers = defaultProviders,
} = {}) {
  const store = createStore({ dataDir, workspace: path.resolve(workspace) });
  const { state } = store;
  state.server.csrfToken = randomBytes(32).toString('hex');
  const active = new Map();
  const clients = new Set();
  const demoTimers = new Set();
  let actualPort, closing = false, scheduled = false, dirty = false;
  let lastDetection = 0;

  function notify() { dirty = true; }
  function record(type, text, extra = {}) { store.event(type, text, extra); notify(); }
  function taskEvent(task, event) {
    if (TERMINAL_STATES.has(task.status)) return;
    const text = String(event.text ?? '').slice(0, 4000);
    const entry = { id: randomUUID(), timestamp: new Date().toISOString(), taskId: task.id, type: event.type, text };
    task.logs.push(entry);
    if (task.logs.length > MAX_LOGS) task.logs.splice(0, task.logs.length - MAX_LOGS);
    if (event.type === 'text') {
      const remaining = MAX_OUTPUT - task.output.length;
      if (remaining > 0) task.output += String(event.text ?? '').slice(0, remaining);
    } else if (['tool', 'status', 'error'].includes(event.type)) {
      record(event.type, text, { taskId: task.id, provider: task.provider, departmentId: task.departmentId, demo: task.demo });
    }
    if (event.type === 'usage') task.usage = {
      inputTokens: Number(event.inputTokens) || 0,
      outputTokens: Number(event.outputTokens) || 0,
    };
    store.persist(); notify();
  }
  function endTask(task, result = {}) {
    const run = active.get(task.id);
    if (!run) return;
    active.delete(task.id);
    if (!TERMINAL_STATES.has(task.status)) {
      task.status = result.code === 0 && !result.error ? 'completed' : 'failed';
      task.finishedAt = new Date().toISOString();
      if (result.output && !task.output) task.output = String(result.output).slice(0, MAX_OUTPUT);
      if (result.usage) task.usage = result.usage;
      if (task.status === 'failed') task.error = String(result.error || `CLI가 종료 코드 ${result.code ?? 'unknown'}로 종료됐습니다.`).slice(0, 4000);
      record(task.status, `${task.demo ? '[DEMO] ' : ''}${task.title} · ${task.status === 'completed' ? '작업 완료' : '작업 실패'}`, { taskId: task.id, departmentId: task.departmentId, provider: task.provider, demo: task.demo });
      store.save(); notify();
    }
    queue();
  }
  async function runTask(task) {
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    const run = { cancel: null, cancelRequested: false };
    active.set(task.id, run);
    record('running', `${task.demo ? '[DEMO] ' : ''}${task.title} · 작업 시작`, { taskId: task.id, departmentId: task.departmentId, provider: task.provider, demo: task.demo });
    store.save(); notify();
    if (task.demo) {
      let step = 0;
      const lines = ['[DEMO] 부서에 지시를 전달했습니다. 실제 모델은 호출하지 않습니다.\n', '[DEMO] 작업 이벤트가 이 콘솔에 실시간으로 표시됩니다.\n', '[DEMO] 결과 보고 완료. 실제 작업은 아래 지시창에서 실행할 수 있습니다.\n'];
      const timer = setInterval(() => {
        if (!active.has(task.id)) { clearInterval(timer); demoTimers.delete(timer); return; }
        taskEvent(task, { type: 'text', text: lines[step++] });
        if (step === lines.length) { clearInterval(timer); demoTimers.delete(timer); endTask(task, { code: 0 }); }
      }, 900);
      demoTimers.add(timer);
      run.cancel = () => { clearInterval(timer); demoTimers.delete(timer); };
      return;
    }
    const department = state.departments.find(d => d.id === task.departmentId);
    const prompt = [
      `당신은 IMPERIUM 조직의 ${department.name} 담당 에이전트입니다.`,
      `부서 역할: ${department.role}`,
      '사용자가 본부장이며, 아래 지시를 수행하고 한국어로 결과를 보고하세요. 사실과 추측을 구분하세요.',
      task.permission === 'read-only' ? '이 작업은 읽기 전용입니다. 파일과 시스템 상태를 변경하지 마세요. 실행 결과가 없으면 실행했다고 말하지 마세요.' : '선택된 작업 폴더 안에서 필요한 파일만 수정하세요. 파괴적인 작업이나 외부 발송은 수행하지 마세요.',
      '', '본부 지시:', task.prompt,
    ].join('\n');
    try {
      const handle = await providers.startProvider({
        provider: task.provider, prompt, cwd: state.settings.workspace, permission: task.permission,
        onEvent: event => taskEvent(task, event),
        onExit: result => endTask(task, result),
      });
      run.cancel = handle?.cancel;
      if (run.cancelRequested) run.cancel?.();
    } catch (error) { endTask(task, { code: 1, error: error.message }); }
  }
  function queue() {
    if (closing || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (closing) return;
      const pending = state.tasks.filter(t => t.status === 'queued').sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || a.createdAt.localeCompare(b.createdAt));
      for (const task of pending) {
        if (active.size >= state.settings.maxConcurrent) break;
        // A cancellation is visible immediately, but the process can still be
        // shutting down. Keep its provider and workspace locked until onExit.
        const running = state.tasks.filter(t => active.has(t.id));
        if (running.some(t => t.permission === 'workspace-write')) break;
        if (task.permission === 'workspace-write' && running.length) continue;
        if (running.some(t => t.provider === task.provider || t.departmentId === task.departmentId)) continue;
        void runTask(task);
      }
    });
  }
  function addTask(input, demo = false) {
    if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw fail(400, '부서에 전달할 지시를 입력해 주세요.');
    if (input.prompt.length > MAX_PROMPT) throw fail(400, `지시는 ${MAX_PROMPT.toLocaleString()}자 이내로 입력해 주세요.`);
    const department = state.departments.find(d => d.id === input.departmentId);
    if (!department) throw fail(400, '존재하지 않는 부서입니다.');
    const provider = input.provider || department.provider;
    if (!['codex', 'claude'].includes(provider)) throw fail(400, '지원하지 않는 모델 연결입니다.');
    const priority = input.priority ?? 'normal';
    const permission = input.permission ?? 'read-only';
    if (!['low', 'normal', 'high'].includes(priority)) throw fail(400, '올바른 우선순위를 선택해 주세요.');
    if (!['read-only', 'workspace-write'].includes(permission)) throw fail(400, '올바른 작업 권한을 선택해 주세요.');
    if (!demo && !state.providers.some(p => p.id === provider && p.status === 'ready' && p.authenticated === true)) throw fail(409, `${provider === 'codex' ? 'Codex' : 'Claude Code'} 연결이 필요합니다. 연결 설정에서 설치·로그인 상태를 확인해 주세요.`);
    if (state.tasks.filter(t => ['queued', 'running'].includes(t.status)).length >= 30) throw fail(409, '대기 작업이 많습니다. 현재 작업이 끝난 뒤 다시 지시해 주세요.');
    if (state.tasks.length >= 200) {
      const removable = state.tasks.findIndex(t => TERMINAL_STATES.has(t.status));
      if (removable >= 0) state.tasks.splice(removable, 1);
    }
    const task = {
      id: randomUUID(), title: String(input.title || input.prompt.trim().split('\n')[0]).replace(/[\x00-\x1f]/g, ' ').slice(0, 90),
      prompt: input.prompt.trim(), departmentId: department.id, provider, priority, permission,
      status: 'queued', createdAt: new Date().toISOString(), startedAt: null, finishedAt: null,
      output: '', error: null, logs: [], usage: { inputTokens: 0, outputTokens: 0 }, demo,
    };
    state.tasks.push(task);
    record('queued', `${demo ? '[DEMO] ' : ''}${task.title} · ${department.name} 지시 접수`, { taskId: task.id, departmentId: department.id, provider, demo });
    store.save(); queue();
    return task;
  }
  function cancelTask(task) {
    if (TERMINAL_STATES.has(task.status)) return task;
    task.status = 'cancelled';
    task.finishedAt = new Date().toISOString();
    const run = active.get(task.id);
    if (run) {
      run.cancelRequested = true;
      run.cancel?.();
      if (task.demo) { active.delete(task.id); queue(); }
    }
    record('cancelled', `${task.demo ? '[DEMO] ' : ''}${task.title} · 사용자 취소`, { taskId: task.id, provider: task.provider, demo: task.demo });
    store.save(); notify(); queue();
    return task;
  }
  async function refreshProviders() {
    state.providers = await providers.detectProviders();
    lastDetection = Date.now();
    notify();
    return state.providers;
  }
  function validRequest(req) {
    const hosts = new Set([`127.0.0.1:${actualPort}`, `localhost:${actualPort}`]);
    if (!hosts.has(req.headers.host)) throw fail(403, '로컬 주소로 접속해 주세요.');
    if (req.headers.origin && !new Set([`http://127.0.0.1:${actualPort}`, `http://localhost:${actualPort}`]).has(req.headers.origin)) throw fail(403, '다른 사이트에서 보낸 요청은 허용되지 않습니다.');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const supplied = Buffer.from(String(req.headers['x-hq-token'] || ''));
      const expected = Buffer.from(state.server.csrfToken);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw fail(403, '화면을 새로고침한 뒤 다시 시도해 주세요.');
    }
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
    try {
      validRequest(req);
      const url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
      const route = url.pathname;
      if (route === '/api/state' && req.method === 'GET') return json(res, 200, state);
      if (route === '/api/export' && req.method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="headquarters-export.json"');
        const snapshot = structuredClone(state);
        delete snapshot.server.csrfToken;
        return json(res, 200, snapshot);
      }
      if (route === '/api/events' && req.method === 'GET') {
        if (clients.size >= 20) throw fail(429, '열린 화면이 너무 많습니다.');
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (route === '/api/tasks' && req.method === 'POST') return json(res, 201, { task: addTask(await bodyJSON(req)) });
      const cancelMatch = /^\/api\/tasks\/([\w-]+)\/cancel$/.exec(route);
      if (cancelMatch && req.method === 'POST') {
        const task = state.tasks.find(t => t.id === cancelMatch[1]);
        if (!task) throw fail(404, '작업을 찾을 수 없습니다.');
        return json(res, 200, { task: cancelTask(task) });
      }
      const departmentMatch = /^\/api\/departments\/([\w-]+)$/.exec(route);
      if (departmentMatch && req.method === 'PATCH') {
        const department = state.departments.find(d => d.id === departmentMatch[1]);
        if (!department) throw fail(404, '부서를 찾을 수 없습니다.');
        if (state.tasks.some(t => t.departmentId === department.id && ['queued', 'running'].includes(t.status))) throw fail(409, '해당 부서의 작업이 끝난 뒤 편집해 주세요.');
        const input = await bodyJSON(req);
        if (input.provider !== undefined && !['codex', 'claude'].includes(input.provider)) throw fail(400, '지원하지 않는 모델입니다.');
        for (const [key, max] of [['name', 24], ['role', 1500]]) {
          if (input[key] !== undefined && (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max)) throw fail(400, `${key === 'name' ? '부서 이름' : '부서 역할'}을 올바르게 입력해 주세요.`);
        }
        for (const key of ['name', 'role', 'provider']) if (input[key] !== undefined) department[key] = input[key].trim();
        store.save(); record('settings', `${department.name} 부서 설정 변경`);
        return json(res, 200, { department });
      }
      if (route === '/api/settings' && req.method === 'POST') {
        const input = await bodyJSON(req);
        if ((input.workspace !== undefined || input.maxConcurrent !== undefined) && (active.size || state.tasks.some(t => t.status === 'queued'))) throw fail(409, '모든 작업이 끝난 뒤 작업 환경을 변경해 주세요.');
        const next = { ...state.settings };
        if (input.language !== undefined) {
          if (!['ko', 'en', 'ja'].includes(input.language)) throw fail(400, '지원하지 않는 언어입니다.');
          next.language = input.language;
        }
        if (input.maxConcurrent !== undefined) {
          if (!Number.isInteger(input.maxConcurrent) || input.maxConcurrent < 1 || input.maxConcurrent > 2) throw fail(400, '동시 작업 수는 1 또는 2를 선택해 주세요.');
          next.maxConcurrent = input.maxConcurrent;
        }
        if (input.workspace !== undefined) {
          if (typeof input.workspace !== 'string' || !path.isAbsolute(input.workspace) || input.workspace.length > 1000) throw fail(400, '작업 폴더의 절대 경로를 입력해 주세요.');
          try {
            const resolved = await realpath(input.workspace);
            if (!(await stat(resolved)).isDirectory()) throw new Error();
            next.workspace = resolved;
          } catch { throw fail(400, '존재하는 작업 폴더를 지정해 주세요.'); }
        }
        state.settings = next;
        store.save(); record('settings', '본부 작업 환경 변경');
        return json(res, 200, { settings: next });
      }
      if (route === '/api/providers/refresh' && req.method === 'POST') {
        if (Date.now() - lastDetection < 2000) return json(res, 200, { providers: state.providers });
        return json(res, 200, { providers: await refreshProviders() });
      }
      if (route === '/api/demo' && req.method === 'POST') {
        if (state.tasks.some(t => t.demo && ['running', 'queued'].includes(t.status))) throw fail(409, '진행 중인 데모를 먼저 확인해 주세요.');
        const tasks = [
          addTask({ prompt: '신규 서비스의 실행 계획과 부서별 역할을 정리해 주세요.', departmentId: 'strategy', provider: 'codex' }, true),
          addTask({ prompt: '본부 지시에 따라 개발 요구사항을 검토해 주세요.', departmentId: 'engineering', provider: 'claude' }, true),
        ];
        return json(res, 201, { tasks });
      }
      if (route === '/api/demo' && req.method === 'DELETE') {
        for (const task of state.tasks.filter(t => t.demo)) cancelTask(task);
        state.tasks = state.tasks.filter(t => !t.demo);
        state.events = state.events.filter(e => !e.demo);
        store.save(); notify();
        return json(res, 200, { ok: true });
      }
      if (route.startsWith('/api/')) throw fail(404, '요청한 기능을 찾을 수 없습니다.');
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, '지원하지 않는 요청입니다.');
      const files = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/app.css': ['app.css', 'text/css; charset=utf-8'],
        '/organization.css': ['organization.css', 'text/css; charset=utf-8'],
        '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
        '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
        '/fonts/pretendard-variable.woff2': ['fonts/pretendard-variable.woff2', 'font/woff2'],
        '/fonts/pretendard-jp-variable.woff2': ['fonts/pretendard-jp-variable.woff2', 'font/woff2'],
        '/fonts/jetbrains-mono-variable.woff2': ['fonts/jetbrains-mono-variable.woff2', 'font/woff2'],
      };
      const asset = files[route];
      if (!asset) throw fail(404, '페이지를 찾을 수 없습니다.');
      const content = await readFile(path.join(HERE, 'public', asset[0]));
      res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : '요청 처리 중 문제가 생겼습니다. 서버 콘솔을 확인해 주세요.' });
      else res.end();
      if (!error.status) console.error('[HQ]', error.message);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  let updates, heartbeat;
  async function start() {
    await mkdir(state.settings.workspace, { recursive: true });
    await refreshProviders();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    actualPort = server.address().port;
    record('system', 'IMPERIUM 온라인 · 구독 CLI 연결 모드');
    updates = setInterval(() => {
      if (!dirty || !clients.size) return;
      dirty = false;
      const message = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
      for (const client of clients) if (!client.destroyed) client.write(message);
    }, 120);
    heartbeat = setInterval(() => { for (const client of clients) client.write(': heartbeat\n\n'); }, 20000);
    updates.unref(); heartbeat.unref();
    return { url: `http://127.0.0.1:${actualPort}`, port: actualPort };
  }
  async function close() {
    if (closing) return;
    closing = true;
    clearInterval(updates); clearInterval(heartbeat);
    for (const timer of demoTimers) clearInterval(timer);
    for (const task of state.tasks.filter(t => ['running', 'queued'].includes(t.status))) {
      task.status = 'interrupted';
      task.finishedAt = new Date().toISOString();
      task.error = '서버 종료로 작업이 중단됐습니다.';
    }
    for (const run of active.values()) { run.cancelRequested = true; run.cancel?.(); }
    active.clear();
    for (const client of clients) client.end();
    clients.clear(); store.save();
    if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  }
  return { server, store, start, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const app = createHQServer({ port: Number(process.env.HQ_PORT) || 4310 });
  try {
    const { url } = await app.start();
    console.log(`\n  IMPERIUM  /  AI COMMAND TERMINAL\n  ${url}\n  Subscription CLI · Ctrl+C to stop\n`);
    for (const provider of app.store.state.providers) console.log(`  ${provider.id.padEnd(8)} ${provider.status}  ${provider.detail || ''}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? '\n포트 4310이 사용 중입니다. 기존 HQ 화면을 열거나 HQ_PORT로 다른 포트를 지정하세요.' : error.message);
    process.exitCode = 1;
  }
}
