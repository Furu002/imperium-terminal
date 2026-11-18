import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHQServer } from '../server.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check) {
  const deadline = Date.now() + 3500;
  do { const result = await check(); if (result) return result; await delay(15); } while (Date.now() < deadline);
  assert.fail('The expected project state was not reached');
}

async function fixture(t, options = {}) {
  const directory = options.directory ?? await mkdtemp(path.join(tmpdir(), 'imperium-projects-http-'));
  const workspace = path.join(directory, 'initial-project');
  const parentDir = path.join(directory, 'created-projects');
  await Promise.all([mkdir(workspace, { recursive: true }), mkdir(parentDir, { recursive: true })]);
  const calls = [];
  const app = createHQServer({
    dataDir: path.join(directory, 'data'), workspace, port: 0,
    providers: {
      detectProviders: async () => ['codex', 'claude', 'ollama'].map(id => ({ id, name: id, status: 'ready', installed: true, authenticated: true, version: 'no-network-test' })),
      async startProvider(input) {
        let ended = false;
        const finish = (code, { inputTokens = 0, outputTokens = 0 } = {}) => {
          if (ended) return;
          ended = true;
          input.onEvent({ type: 'usage', inputTokens, outputTokens });
          input.onExit(code === 0 ? { code, output: '프로젝트 테스트 완료' } : { code, error: 'Controlled test failure' });
        };
        calls.push({ ...input, complete: usage => finish(0, usage), fail: usage => finish(1, usage) });
        return { cancel() { if (!ended) { ended = true; input.onExit({ code: 130, error: 'Cancelled' }); } } };
      },
    },
    terminalManager: { closeAll() {}, list: () => [] },
    modelDiscovery: async () => ({ models: [], detail: 'No external discovery in project tests' }),
  });
  const { url } = await app.start();
  const get = async route => {
    const response = await fetch(`${url}${route}`);
    const value = await response.json();
    assert.ok(response.ok, `GET ${route}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  };
  const initial = await get('/api/state');
  const request = (route, body, method = 'POST') => fetch(`${url}${route}`, {
    method, headers: { 'content-type': 'application/json', 'x-hq-token': initial.server.csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function successful(route, body, method = 'POST') {
    const response = await request(route, body, method);
    const value = await response.json();
    assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  const createProject = async (name = '새 연구 프로젝트', extra = {}) => (await successful('/api/projects', { name, color: '#2c8a75', parentDir, ...extra })).project;
  const select = id => successful(`/api/projects/${id}/select`, {});
  const department = async (name, extra = {}) => (await successful('/api/departments', { name, provider: 'codex', role: `${name}의 사용자가 정의한 역할`, ...extra })).department;
  const note = async title => (await successful('/api/memory', { title, content: `${title}에만 속하는 자료`, kind: 'note' })).node;
  const task = async (departmentId, extra = {}) => (await successful('/api/tasks', { departmentId, prompt: '실제 모델을 실행하지 않는 프로젝트 통합 검증', permission: 'read-only', ...extra })).task;
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await app.close(); } };
  t.after(async () => { await close(); if (!options.keepData) await rm(directory, { recursive: true, force: true }); });
  return { app, directory, workspace: await realpath(workspace), parentDir: await realpath(parentDir), calls, initial, get, state: () => get('/api/state'), request, successful, createProject, select, department, note, task, close };
}

const departmentNode = id => ({ id: `department:${id}`, type: 'department', referenceId: id, x: 200, y: 200 });
const memoryNode = id => ({ id: `memory:${id}`, type: 'memory', referenceId: id, x: 0, y: 200 });
const contextGraph = (department, memory) => ({
  nodes: [departmentNode(department.id), memoryNode(memory.id)],
  edges: [{ id: `context-${memory.id}`, source: `memory:${memory.id}`, target: `department:${department.id}`, type: 'memory_context' }],
});

test('project HTTP creation makes a real contained folder and exposes editable name/color metadata', async t => {
  const f = await fixture(t);
  const original = await f.get('/api/projects');
  assert.equal(original.projects.length, 1);
  assert.equal(original.projects[0].workspace, f.workspace);
  assert.equal(original.currentProjectId, original.projects[0].id);
  const project = await f.createProject('새 연구실 🧪');
  assert.equal(project.name, '새 연구실 🧪');
  assert.equal(project.color, '#2C8A75');
  assert.equal(project.departmentCount, 0);
  assert.equal(project.current, false);
  assert.equal(path.dirname(project.workspace), f.parentDir);
  assert.equal(await realpath(project.workspace), project.workspace);
  assert.ok((await stat(project.workspace)).isDirectory());
  assert.equal((await f.state()).settings.workspace, f.workspace, 'creation must not silently select a project');
  const changed = (await f.successful(`/api/projects/${project.id}`, { name: '별도 표시 이름', color: '#aabbcc' }, 'PATCH')).project;
  assert.equal(changed.name, '별도 표시 이름');
  assert.equal(changed.color, '#AABBCC');
  assert.equal(changed.workspace, project.workspace, 'editing the label must preserve the real project folder');
  const listed = await f.get('/api/projects');
  assert.equal(listed.projects.find(value => value.id === project.id).name, changed.name);
  assert.ok((await f.state()).projects.some(value => value.id === project.id && value.workspace === project.workspace));
  for (const body of [{ name: '../escape' }, { name: 'valid', color: 'red' }, { name: 'valid', parentDir: 'relative/path' }]) {
    assert.equal((await f.request('/api/projects', { color: '#111111', parentDir: f.parentDir, ...body })).status, 400);
  }
  assert.equal((await f.get('/api/projects')).projects.length, 2, 'invalid requests must not register projects');
});

test('selecting projects restores independent departments while keeping shared model connections', async t => {
  const f = await fixture(t);
  const homeId = (await f.get('/api/projects')).currentProjectId;
  const connection = (await f.successful('/api/providers/register', { providerId: 'claude', modelId: 'sonnet', label: '공유 계정 연결' })).connection;
  const homeDepartment = await f.department('기존 프로젝트 부서', { title: '분석 총괄', connectionId: connection.id });
  const homeDepartments = (await f.state()).departments;
  const other = await f.createProject();
  const selected = (await f.select(other.id)).project;
  assert.equal(selected.current, true);
  let state = await f.state();
  assert.equal(state.settings.workspace, other.workspace);
  assert.deepEqual(state.departments, [], 'a newly selected project has no inherited agents');
  assert.ok(state.connections.some(value => value.id === connection.id));
  const otherDepartment = await f.department('새 프로젝트 전용', { title: '제품 설계 책임자', connectionId: connection.id });
  await f.select(homeId);
  state = await f.state();
  assert.equal(state.settings.workspace, f.workspace);
  assert.deepEqual(state.departments, homeDepartments);
  assert.equal(state.departments.find(value => value.id === homeDepartment.id).title, '분석 총괄');
  assert.ok(!state.departments.some(value => value.id === otherDepartment.id));
  await f.select(other.id);
  state = await f.state();
  assert.deepEqual(state.departments, [otherDepartment]);
  assert.equal(state.connections.find(value => value.id === connection.id).modelId, 'sonnet');
  const summaries = await f.get('/api/projects');
  assert.equal(summaries.currentProjectId, other.id);
  assert.equal(summaries.projects.find(value => value.id === other.id).departmentCount, 1);
  assert.equal(f.calls.length, 0, 'project selection must not launch any model');
});

test('changing the workspace through settings snapshots the current agents and opens an empty project', async t => {
  const f = await fixture(t);
  const alpha = await f.department('Alpha', { title: '프로젝트 A 책임자' });
  const homeDepartments = (await f.state()).departments;
  const existingFolder = path.join(f.directory, 'existing-project-X');
  await mkdir(existingFolder);
  const workspaceX = await realpath(existingFolder);
  await f.successful('/api/settings', { workspace: workspaceX });
  let state = await f.state();
  assert.equal(state.settings.workspace, workspaceX);
  assert.deepEqual(state.departments, [], 'the legacy folder picker must not copy Alpha into a new project');
  const listed = await f.get('/api/projects');
  assert.equal(listed.projects.length, 2);
  assert.equal(listed.projects.find(value => value.id === listed.currentProjectId).workspace, workspaceX);
  const xDepartment = await f.department('프로젝트 X 전용');
  await f.successful('/api/settings', { workspace: f.workspace });
  state = await f.state();
  assert.deepEqual(state.departments, homeDepartments);
  assert.equal(state.departments.find(value => value.id === alpha.id).title, '프로젝트 A 책임자');
  assert.ok(!state.departments.some(value => value.id === xDepartment.id));
  await f.successful('/api/settings', { workspace: workspaceX });
  assert.deepEqual((await f.state()).departments, [xDepartment]);
  assert.equal(f.calls.length, 0);
});

test('stale workspace task and agent mutations return 409 before changing the selected project', async t => {
  const f = await fixture(t);
  const staleWorkspace = f.workspace;
  const other = await f.createProject('현재 화면의 프로젝트');
  await f.select(other.id);
  const currentDepartment = await f.department('현재 프로젝트 에이전트');
  const before = await f.state();
  const rejected = [
    ['/api/tasks', { workspace: staleWorkspace, departmentId: currentDepartment.id, prompt: '이전 화면에서 늦게 도착한 지시', permission: 'read-only' }, 'POST'],
    ['/api/departments', { workspace: staleWorkspace, name: '잘못 생성될 부서', role: '이전 프로젝트 요청', provider: 'codex' }, 'POST'],
    [`/api/departments/${currentDepartment.id}`, { workspace: staleWorkspace, name: '잘못 덮어쓸 이름', title: '잘못 덮어쓸 직함' }, 'PATCH'],
  ];
  for (const [route, body, method] of rejected) {
    const response = await f.request(route, body, method);
    assert.equal(response.status, 409, `${method} ${route}`);
    assert.match((await response.json()).error, /프로젝트/);
  }
  const after = await f.state();
  assert.equal(after.settings.workspace, other.workspace);
  assert.deepEqual(after.departments, before.departments);
  assert.deepEqual(after.tasks, before.tasks);
  assert.equal(f.calls.length, 0);
  const accepted = (await f.successful(`/api/departments/${currentDepartment.id}`, { workspace: other.workspace, title: '현재 프로젝트 직함' }, 'PATCH')).department;
  assert.equal(accepted.title, '현재 프로젝트 직함', 'the guard must allow a matching current workspace');
});

test('project memory and canvas remain isolated during selection and survive a server restart', async t => {
  const f = await fixture(t);
  const homeId = (await f.get('/api/projects')).currentProjectId;
  const firstDepartment = await f.department('첫 프로젝트 전용');
  const firstMemory = await f.note('첫 프로젝트 비공개 기억');
  const firstGraph = contextGraph(firstDepartment, firstMemory);
  await f.successful('/api/graph', firstGraph, 'PUT');
  const other = await f.createProject('두 번째 공간');
  await f.select(other.id);
  assert.deepEqual((await f.get('/api/memory')).nodes, []);
  assert.deepEqual((await f.get('/api/graph')).graph, { nodes: [], edges: [] });
  assert.equal((await f.request(`/api/memory/${firstMemory.id}`, { content: '외부 수정 시도', expectedRevision: 1 }, 'PATCH')).status, 404);
  const secondDepartment = await f.department('두 번째 전용');
  const secondMemory = await f.note('두 번째 프로젝트 기억');
  assert.equal((await f.request('/api/graph', contextGraph(secondDepartment, firstMemory), 'PUT')).status, 400, 'foreign memory cannot be linked into this canvas');
  const secondGraph = contextGraph(secondDepartment, secondMemory);
  await f.successful('/api/graph', secondGraph, 'PUT');
  await f.select(homeId);
  assert.deepEqual((await f.get('/api/memory')).nodes.map(value => value.id), [firstMemory.id]);
  assert.deepEqual((await f.get('/api/graph')).graph, firstGraph);
  await f.close();
  const restored = await fixture(t, { directory: f.directory, keepData: true });
  assert.equal(restored.initial.settings.workspace, f.workspace);
  assert.deepEqual((await restored.get('/api/graph')).graph, firstGraph);
  assert.equal((await restored.get('/api/memory')).nodes[0].content, firstMemory.content);
  await restored.select(other.id);
  assert.deepEqual((await restored.state()).departments, [secondDepartment]);
  assert.deepEqual((await restored.get('/api/memory')).nodes.map(value => value.id), [secondMemory.id]);
  assert.deepEqual((await restored.get('/api/graph')).graph, secondGraph);
  await restored.close();
});

test('project selection returns 409 while a real queue is running and succeeds after it is cleared', async t => {
  const f = await fixture(t);
  const other = await f.createProject('대기 중 전환 목적지');
  const department = await f.department('직렬 작업 부서');
  const running = await f.task(department.id);
  await eventually(() => f.calls.length === 1);
  assert.equal((await f.request(`/api/projects/${other.id}/select`, {})).status, 409);
  const queued = await f.task(department.id);
  assert.equal((await f.state()).tasks.find(value => value.id === queued.id).status, 'queued');
  assert.equal((await f.request(`/api/projects/${other.id}/select`, {})).status, 409);
  let state = await f.state();
  assert.equal(state.settings.workspace, f.workspace);
  assert.ok(state.departments.some(value => value.id === department.id));
  await f.successful(`/api/tasks/${queued.id}/cancel`, {});
  f.calls[0].complete({ inputTokens: 2, outputTokens: 3 });
  await eventually(async () => (await f.state()).tasks.find(value => value.id === running.id)?.status === 'completed');
  await f.select(other.id);
  state = await f.state();
  assert.equal(state.settings.workspace, other.workspace);
  assert.deepEqual(state.departments, []);
  assert.equal(f.calls.length, 1, 'the cancelled pending job must never be dispatched');
});

test('analytics HTTP summaries follow the selected workspace without leaking prior-project task metadata', async t => {
  const f = await fixture(t);
  const homeId = (await f.get('/api/projects')).currentProjectId;
  const firstDepartment = await f.department('이전 프로젝트 분석');
  const previousTask = await f.task(firstDepartment.id, { title: 'PRIOR_PROJECT_PRIVATE_TASK', modelId: 'test-model-a' });
  await eventually(() => f.calls.length === 1);
  f.calls[0].complete({ inputTokens: 100, outputTokens: 20 });
  await eventually(async () => (await f.state()).tasks.find(value => value.id === previousTask.id)?.status === 'completed');
  const other = await f.createProject('분석 분리 공간');
  await f.select(other.id);
  const empty = (await f.get('/api/analytics')).analytics;
  assert.equal(empty.meta.workspace, other.workspace);
  assert.equal(empty.totals.tasks, 0);
  assert.equal(empty.totals.totalTokens, null);
  assert.deepEqual(empty.taskBars, []);
  assert.ok(!JSON.stringify(empty).includes(previousTask.id));
  const secondDepartment = await f.department('현재 프로젝트 분석');
  const currentTask = await f.task(secondDepartment.id, { title: 'CURRENT_PROJECT_TASK', modelId: 'test-model-b' });
  await eventually(() => f.calls.length === 2);
  assert.equal(f.calls[1].cwd, other.workspace);
  f.calls[1].complete({ inputTokens: 7, outputTokens: 3 });
  await eventually(async () => (await f.state()).tasks.find(value => value.id === currentTask.id)?.status === 'completed');
  const current = (await f.get('/api/analytics')).analytics;
  assert.equal(current.totals.tasks, 1);
  assert.equal(current.totals.reportedTasks, 1);
  assert.equal(current.totals.totalTokens, 10);
  assert.equal(current.performance.successRate, 1);
  assert.equal(current.credits.remaining, null);
  assert.deepEqual(current.taskBars.map(value => value.id), [currentTask.id]);
  assert.ok(!JSON.stringify(current).includes('PRIOR_PROJECT_PRIVATE_TASK'));
  await f.select(homeId);
  const previous = (await f.get('/api/analytics')).analytics;
  assert.equal(previous.meta.workspace, f.workspace);
  assert.equal(previous.totals.tasks, 1);
  assert.equal(previous.totals.totalTokens, 120);
  assert.deepEqual(previous.taskBars.map(value => value.id), [previousTask.id]);
  assert.ok(!JSON.stringify(previous).includes(currentTask.id));
});

test('language and free-form identity/agent titles validate types and lengths and persist across restart', async t => {
  const f = await fixture(t);
  const identity = { name: '홍길동 & Sato', title: '연구 설계자 / CTO · 最高責任者' };
  await f.successful('/api/settings', { language: 'ja', identity });
  const department = await f.department('자유 직함 부서', { title: '직함'.repeat(40) });
  assert.equal(department.title.length, 80);
  assert.equal((await f.request('/api/departments', { name: '긴 직함 부서', provider: 'codex', role: '자료 분석', title: 'a'.repeat(81) })).status, 400);
  assert.equal((await f.request(`/api/departments/${department.id}`, { title: 'a'.repeat(81) }, 'PATCH')).status, 400);
  assert.equal((await f.request(`/api/departments/${department.id}`, { title: { text: '잘못된 타입' } }, 'PATCH')).status, 400);
  for (const update of [
    { language: 'unsupported' },
    { identity: { ...identity, title: 'a'.repeat(81) } },
    { identity: { ...identity, name: 'a'.repeat(61) } },
    { identity: { ...identity, name: '  ' } },
    { identity: { ...identity, title: 123 } },
  ]) assert.equal((await f.request('/api/settings', update)).status, 400);
  const before = await f.state();
  assert.deepEqual(before.settings.identity, identity);
  assert.equal(before.settings.language, 'ja');
  assert.equal(before.departments.find(value => value.id === department.id).title, department.title);
  await f.close();
  const restored = await fixture(t, { directory: f.directory, keepData: true });
  assert.deepEqual(restored.initial.settings.identity, identity);
  assert.equal(restored.initial.settings.language, 'ja');
  assert.equal(restored.initial.departments.find(value => value.id === department.id).title, department.title);
  await restored.close();
});
