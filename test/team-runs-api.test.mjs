import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createHQServer } from '../server.mjs';
import { tasksWithAppended } from '../lib/team-runs.mjs';

const plan = {
  roles: [
    { id: 'answer', name: '통합 담당', provider: 'codex', role: '사용자에게 전달할 최종 결과를 작성합니다.', task: '사실과 위험을 통합합니다.', dependsOn: ['facts', 'risk'] },
    { id: 'facts', name: '근거 조사', provider: 'codex', role: '사실을 조사합니다.', task: '프로젝트의 사실을 조사하세요.', dependsOn: [] },
    { id: 'risk', name: '위험 검토', provider: 'claude', role: '위험을 검토합니다.', task: '위험과 검증 방법을 찾으세요.', dependsOn: [] },
  ],
  finalRoleId: 'answer',
};

async function poll(read, label) {
  const deadline = Date.now() + 6000;
  do {
    const result = await read();
    if (result) return result;
    await delay(15);
  } while (Date.now() < deadline);
  assert.fail(`Timed out: ${label}`);
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'imperium-team-run-'));
  const workspace = path.join(root, 'project');
  const sibling = path.join(root, 'sibling');
  await Promise.all([mkdir(workspace), mkdir(sibling)]);
  const calls = [];
  const providers = {
    detectProviders: async () => ['codex', 'claude', 'ollama', 'gemini'].map(id => ({ id, installed: true, authenticated: true, status: 'ready' })),
    startProvider: async options => {
      const call = { ...options, cancelled: false };
      calls.push(call);
      return { cancel() { call.cancelled = true; } };
    },
  };
  let app, url, token;
  async function restart() {
    await app?.close();
    app = createHQServer({ dataDir: path.join(root, 'data'), workspace, port: 0, quotaReaders: {}, providers });
    ({ url } = await app.start());
    token = (await fetch(url + '/api/state').then(response => response.json())).server.csrfToken;
    assert.ok(token);
  }
  t.after(async () => {
    try { await app?.close(); }
    finally {
      assert.ok(root.startsWith(path.join(tmpdir(), 'imperium-team-run-')));
      await rm(root, { recursive: true, force: true });
    }
  });
  await restart();
  async function request(route, body, status = body ? 201 : 200) {
    const response = await fetch(url + route, body ? {
      method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-hq-token': token },
    } : {});
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    return value;
  }
  function start(input = {}, status) { return request('/api/teams', { workspace, prompt: '코드 구조를 검토하고 한 번에 보고해 주세요.', ...input }, status); }
  function followup(id, input = {}, status) { return request(`/api/teams/${id}/turns`, { workspace, prompt: '앞선 결과 중 중요한 위험을 자세히 설명하세요.', ...input }, status); }
  function cancel(id, input = {}, status = 200) { return request(`/api/teams/${id}/cancel`, { workspace, ...input }, status); }
  function waitCall(index) { return poll(() => calls[index], `model call ${index}`); }
  function state() { return request('/api/state'); }
  function waitTeam(id, status) {
    return poll(async () => {
      const team = (await state()).teamRuns.find(item => item.id === id);
      if (team?.turns.at(-1)?.status === status) return team;
    }, `team ${status}`);
  }
  async function waitSSE(id, status) {
    const response = await fetch(url + '/api/events', { signal: AbortSignal.timeout(6000) });
    assert.equal(response.status, 200);
    const decoder = new TextDecoder();
    let data = '';
    for await (const chunk of response.body) {
      data += decoder.decode(chunk, { stream: true });
      while (data.includes('\n\n')) {
        const end = data.indexOf('\n\n');
        const lines = data.slice(0, end).split('\n');
        data = data.slice(end + 2);
        const snapshot = lines.find(line => line.startsWith('data: '));
        if (!snapshot) continue;
        const team = JSON.parse(snapshot.slice(6)).teamRuns.find(item => item.id === id);
        if (team?.turns.at(-1)?.status === status) return team;
      }
    }
    assert.fail(`Team ${status} was not published on the event stream`);
  }
  return { workspace, sibling, calls, request, start, followup, cancel, state, waitCall, waitTeam, waitSSE, restart };
}

test('a team plans once, runs dependency-gated roles, publishes to SSE and continues with the same roles and bounded context', async t => {
  const f = await fixture(t);
  const initial = await f.state();
  const { team } = await f.start({ provider: 'claude' });
  const original = team.turns[0];
  assert.equal(original.status, 'planning');
  assert.equal(team.plan, null);
  assert.ok(original.plannerTaskId);
  const events = f.waitSSE(team.id, 'completed');
  const planner = await f.waitCall(0);
  assert.equal(planner.provider, 'claude');
  assert.equal(planner.permission, 'read-only');
  assert.equal(planner.memory, undefined);
  assert.equal(planner.resumeSessionId, undefined);
  assert.match(planner.prompt, /User goal \(JSON string\)/);
  const serialized = JSON.stringify(plan);
  planner.onEvent({ type: 'text', text: serialized.slice(0, 200) });
  planner.onEvent({ type: 'text', text: serialized.slice(200) });
  assert.equal((await f.request(`/api/tasks/${original.plannerTaskId}`)).task.output, '');
  planner.onExit({ code: 0 });

  const researchers = [await f.waitCall(1), await f.waitCall(2)];
  assert.deepEqual(researchers.map(call => call.provider), ['codex', 'claude']);
  const running = await f.waitTeam(team.id, 'running');
  const turn = running.turns[0];
  assert.deepEqual(Object.keys(turn.taskIds), ['facts', 'risk', 'answer']);
  assert.equal(turn.finalTaskId, turn.taskIds.answer);
  assert.match(researchers[0].prompt, /프로젝트의 사실을 조사하세요/);
  assert.doesNotMatch(researchers[0].prompt, /이전 팀의 통합 답변/);
  await f.followup(team.id, {}, 409);
  researchers[0].onExit({ code: 0, output: `관찰한 프로젝트 사실${'.'.repeat(9000)}조사 결론`, reportedModel: 'codex-reported-test' });
  await delay(20);
  assert.equal(f.calls.length, 3, 'the final agent waits for both branches');
  researchers[1].onExit({ code: 0, output: '별도 위험 및 검증 절차' });
  const final = await f.waitCall(3);
  assert.match(final.prompt, /관찰한 프로젝트 사실/);
  assert.match(final.prompt, /\[중간 내용 생략\]/);
  assert.match(final.prompt, /조사 결론/);
  assert.match(final.prompt, /별도 위험 및 검증 절차/);
  final.onExit({ code: 0, output: '통합 결과: 실험을 먼저 하세요.' });
  const completed = await events;
  assert.equal(completed.turns[0].result, '통합 결과: 실험을 먼저 하세요.');
  assert.equal(completed.turns[0].resultTruncated, false);
  const snapshot = await f.state();
  assert.deepEqual(snapshot.departments, initial.departments);
  assert.deepEqual(snapshot.graphs, initial.graphs);
  assert.deepEqual(snapshot.conversations, initial.conversations);
  assert.equal(snapshot.tasks.find(task => task.id === original.plannerTaskId).output, '');
  assert.equal(snapshot.tasks.find(task => task.id === turn.taskIds.facts).reportedModel, 'codex-reported-test');
  const notes = await f.request('/api/memory');
  assert.ok(notes.nodes.some(note => note.sourceTaskId === turn.finalTaskId));
  assert.ok(!notes.nodes.some(note => note.sourceTaskId === turn.taskIds.facts || note.sourceTaskId === original.plannerTaskId));

  const { team: continued } = await f.followup(team.id);
  assert.equal(continued.id, team.id);
  assert.deepEqual(continued.plan, completed.plan);
  assert.equal(continued.turns.length, 2);
  assert.equal(continued.turns[1].plannerTaskId, undefined);
  for (const call of [await f.waitCall(4), await f.waitCall(5)]) {
    assert.match(call.prompt, /앞선 결과 중 중요한 위험/);
    assert.match(call.prompt, /이전 팀의 통합 답변/);
    assert.match(call.prompt, /통합 결과: 실험을 먼저 하세요/);
    assert.doesNotMatch(call.prompt, /Return only one JSON object/);
    call.onExit({ code: 0, output: '후속 검토 결과' });
  }
  (await f.waitCall(6)).onExit({ code: 0, output: '후속 통합 답변' });
  assert.equal((await f.waitTeam(team.id, 'completed')).turns[1].result, '후속 통합 답변');
  await f.request('/api/settings', { workspace: f.sibling }, 200);
  assert.deepEqual((await f.state()).teamRuns, []);
  await f.followup(team.id, { workspace: f.sibling }, 404);
  await f.cancel(team.id, { workspace: f.sibling }, 404);
  await f.request(`/api/tasks/${turn.finalTaskId}`, undefined, 404);
  await f.request(`/api/tasks/${turn.finalTaskId}/cancel`, {}, 404);
});

test('malformed and cyclical plans fail without exposing raw planner text or launching workers', async t => {
  const f = await fixture(t);
  const invalid = structuredClone(plan);
  invalid.roles.find(item => item.id === 'facts').dependsOn = ['answer'];
  for (const [index, output] of ['PRIVATE RAW TEXT', JSON.stringify(invalid)].entries()) {
    const { team } = await f.start();
    const planner = await f.waitCall(index);
    planner.onExit({ code: 0, output });
    const failed = await f.waitTeam(team.id, 'failed');
    assert.equal(failed.plan, null);
    assert.deepEqual(failed.turns[0].taskIds, {});
    assert.doesNotMatch(failed.turns[0].error, /PRIVATE RAW TEXT/);
    assert.equal(f.calls.length, index + 1);
    assert.equal((await f.request(`/api/tasks/${failed.turns[0].plannerTaskId}`)).task.output, '');
  }
});

test('worker failure cancels queued and live siblings before a final answer can be generated', async t => {
  const f = await fixture(t);
  const { team } = await f.start();
  (await f.waitCall(0)).onExit({ code: 0, output: JSON.stringify(plan) });
  const worker = await f.waitCall(1);
  const sibling = await f.waitCall(2);
  worker.onExit({ code: 0, output: '  ' });
  const failed = await f.waitTeam(team.id, 'failed');
  assert.match(failed.turns[0].error, /결과를 반환하지 않았습니다/);
  assert.equal(sibling.cancelled, true);
  assert.equal((await f.request(`/api/tasks/${failed.turns[0].finalTaskId}`)).task.status, 'cancelled');
  sibling.onExit({ code: 0, output: '뒤늦게 도착한 답변' });
  assert.equal((await f.waitTeam(team.id, 'failed')).turns[0].result, undefined);
  assert.equal(f.calls.length, 3);
});

test('cancel and server restart never launch a late plan or interrupted team', async t => {
  const f = await fixture(t);
  const { team } = await f.start();
  const planner = await f.waitCall(0);
  const { team: cancelled } = await f.cancel(team.id);
  assert.equal(cancelled.turns[0].status, 'cancelled');
  assert.equal(planner.cancelled, true);
  planner.onExit({ code: 0, output: JSON.stringify(plan) });
  assert.equal((await f.waitTeam(team.id, 'cancelled')).plan, null);
  assert.equal(f.calls.length, 1);

  const { team: interrupted } = await f.start();
  const stale = await f.waitCall(1);
  await f.restart();
  assert.equal(stale.cancelled, true);
  stale.onExit({ code: 0, output: JSON.stringify(plan) });
  const snapshot = await f.state();
  assert.equal(snapshot.teamRuns.find(item => item.id === interrupted.id).turns[0].status, 'interrupted');
  assert.equal(snapshot.tasks.find(task => task.id === interrupted.turns[0].plannerTaskId).status, 'interrupted');
  assert.equal(f.calls.length, 2);
});

test('model and workspace limits are enforced for locally scoped and writable turns', async t => {
  const f = await fixture(t);
  await f.start({ workspace: f.sibling }, 409);
  await f.start({ teamId: 'injected' }, 400);
  await f.start({ permission: 'full-access' }, 400);
  await f.request('/api/settings', { localOnly: true }, 200);
  await f.start({ provider: 'codex' }, 403);
  await f.start({ provider: 'ollama', permission: 'workspace-write' }, 409);
  assert.equal(f.calls.length, 0);
  const { team: local } = await f.start({ provider: 'ollama' });
  (await f.waitCall(0)).onExit({ code: 0, output: JSON.stringify(plan) });
  await f.waitTeam(local.id, 'failed');
  assert.equal(f.calls.length, 1);
  await f.request('/api/settings', { localOnly: false, accessPolicy: 'read-only' }, 200);
  await f.start({ provider: 'codex', permission: 'workspace-write' }, 403);
  await f.request('/api/settings', { accessPolicy: 'task-confirm' }, 200);
  const { team: writable } = await f.start({ provider: 'codex', permission: 'workspace-write' });
  const planner = await f.waitCall(1);
  assert.equal(planner.permission, 'read-only');
  assert.match(planner.prompt, /only from \["codex","claude"\]/);
  planner.onExit({ code: 0, output: JSON.stringify(plan) });
  const writer = await f.waitCall(2);
  assert.equal(writer.permission, 'workspace-write');
  assert.equal(f.calls.length, 3, 'write locks still serialize workers');
  assert.equal((await f.waitTeam(writable.id, 'running')).turns[0].permission, 'workspace-write');
});

test('task history pruning keeps all results needed by pending roles and final synthesis', () => {
  const tasks = Array.from({ length: 200 }, (_, i) => ({ id: `task-${i}`, status: 'completed' }));
  tasks[199] = { id: 'running-worker', status: 'running', dependsOn: ['task-0'], teamContextTaskIds: ['task-1', 'task-2'] };
  const next = tasksWithAppended(tasks, [{ id: 'new-task', status: 'queued' }]);
  assert.equal(next.length, 200);
  assert.deepEqual(next.slice(0, 4).map(task => task.id), ['task-0', 'task-1', 'task-2', 'task-4']);
  assert.ok(tasks.some(task => task.id === 'task-3'));
});

test('each workspace retains its own 24 teams across eviction and restart', async t => {
  const f = await fixture(t);
  const { team: original } = await f.start();
  (await f.waitCall(0)).onExit({ code: 0, output: 'invalid JSON' });
  await f.waitTeam(original.id, 'failed');
  await f.request('/api/settings', { workspace: f.sibling }, 200);
  const siblingIds = [];
  for (let index = 0; index < 25; index++) {
    const { team } = await f.start({ workspace: f.sibling });
    siblingIds.push(team.id);
    (await f.waitCall(index + 1)).onExit({ code: 0, output: 'invalid JSON' });
    await f.waitTeam(team.id, 'failed');
  }
  const retainedIds = async () => (await f.state()).teamRuns.map(team => team.id);
  assert.deepEqual(await retainedIds(), siblingIds.slice(1));
  await f.restart();
  assert.deepEqual(await retainedIds(), siblingIds.slice(1));
  await f.request('/api/settings', { workspace: f.workspace }, 200);
  assert.deepEqual(await retainedIds(), [original.id]);
});

test('an explicit writable follow-up uses the existing roster and cancelling one task blocks the next turn until process exit', async t => {
  const f = await fixture(t);
  const { team } = await f.start();
  (await f.waitCall(0)).onExit({ code: 0, output: JSON.stringify(plan) });
  for (const index of [1, 2, 3]) {
    const worker = await f.waitCall(index);
    assert.equal(worker.permission, 'read-only');
    worker.onExit({ code: 0, output: '팀 확인 결과' });
  }
  const completed = await f.waitTeam(team.id, 'completed');
  const { team: writing } = await f.followup(team.id, { permission: 'workspace-write' });
  assert.deepEqual(writing.plan, completed.plan);
  const writer = await f.waitCall(4);
  assert.equal(writer.permission, 'workspace-write');
  assert.doesNotMatch(writer.prompt, /Return only one JSON object/);
  const activeTaskId = writing.turns[1].taskIds.facts;
  const { task } = await f.request(`/api/tasks/${activeTaskId}/cancel`, {}, 200);
  assert.equal(task.status, 'cancelled');
  assert.equal(writer.cancelled, true);
  assert.equal((await f.waitTeam(team.id, 'cancelled')).turns[1].result, undefined);
  await f.followup(team.id, {}, 409);
  assert.equal(f.calls.length, 5);
  writer.onExit({ code: 130 });
  await f.followup(team.id);
  assert.equal((await f.waitCall(5)).permission, 'read-only');
});
