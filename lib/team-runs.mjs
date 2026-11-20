import { randomUUID } from 'node:crypto';
import { assertTaskPermission } from './access-policy.mjs';
import { EXECUTION_CAPABILITIES, resolveExecutionOptions } from './execution-options.mjs';
import { canonicalMemoryWorkspace } from './memory.mjs';
import { buildTeamPlanningPrompt, parseTeamPlan, normalizeTeamGoal } from './team-plan.mjs';

const MAX_TEAMS_PER_WORKSPACE = 24;
const MAX_TURNS = 10;
const MAX_RESULT = 12000;
const MAX_TASKS = 200;
const MAX_PENDING = 30;
const ACTIVE = new Set(['planning', 'running']);
const TASK_ACTIVE = new Set(['queued', 'running']);
const WRITE_PROVIDERS = new Set(['codex', 'claude']);
const fail = (status, message) => Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();

function clip(value, limit) {
  if (typeof value !== 'string') return '';
  let end = Math.min(value.length, limit);
  if (end && /[\ud800-\udbff]/.test(value[end - 1])) end--;
  return value.slice(0, end);
}

export function interruptTeamRuns(teams) {
  for (const team of teams) {
    for (const turn of team.turns) {
      if (!ACTIVE.has(turn.status)) continue;
      turn.status = 'interrupted';
      turn.finishedAt = now();
      turn.error = '서버 종료로 팀 작업이 중단되었습니다. 이어서 질문하면 새 작업으로 시작합니다.';
    }
  }
}

export function restoreTeamRuns(value) {
  if (!Array.isArray(value)) return [];
  const retained = [];
  const scopeCounts = new Map();
  for (let index = value.length - 1; index >= 0; index--) {
    const team = value[index];
    if (!team || typeof team.id !== 'string' || !Array.isArray(team.turns)) continue;
    let key;
    try { key = canonicalMemoryWorkspace(team.workspace); }
    catch { continue; }
    const count = scopeCounts.get(key) || 0;
    if (count >= MAX_TEAMS_PER_WORKSPACE) continue;
    scopeCounts.set(key, count + 1);
    retained.push({ ...team, turns: team.turns.filter(turn => turn && typeof turn.id === 'string').slice(-MAX_TURNS) });
  }
  const teams = retained.reverse();
  interruptTeamRuns(teams);
  return teams;
}

/** Retain handoff sources until the tasks that read them have finished. */
export function tasksWithAppended(tasks, incoming, isTaskActive = () => false) {
  const combined = [...tasks, ...incoming];
  let overflow = Math.max(0, combined.length - MAX_TASKS);
  if (!overflow) return combined;
  const protectedIds = new Set();
  for (const task of combined) {
    if (!TASK_ACTIVE.has(task.status) && !isTaskActive(task)) continue;
    protectedIds.add(task.id);
    for (const id of task.dependsOn || []) protectedIds.add(id);
    for (const id of task.teamContextTaskIds || []) protectedIds.add(id);
  }
  const retained = combined.filter(task => {
    if (!overflow || protectedIds.has(task.id)) return true;
    overflow--;
    return false;
  });
  if (overflow) throw fail(409, '진행 중인 작업의 전달 기록을 보존하려면 일부 작업이 끝날 때까지 기다려 주세요.');
  return retained;
}

function checkFields(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) {
    throw fail(400, '팀 작업에 지원하지 않는 요청 항목이 있습니다.');
  }
}

function titleFor(prompt) {
  return clip(prompt.split(/\r?\n/, 1)[0].replace(/[\u0000-\u001f]/g, ' ').trim(), 80) || 'AI 팀';
}

function workerPrompt(turn, role, previous) {
  return [
    '현재 사용자의 팀 목표 (최우선):', turn.prompt,
    '이번 역할의 담당 업무. 역할별 계획이 현재 사용자 목표와 충돌하면 사용자 목표에 맞추세요:', role.task,
    ...(previous ? [
      '이전 대화에서 달성하려던 목표 (참고 자료):', clip(previous.prompt, 500),
      '이전 팀의 통합 답변 (참고 자료):', clip(previous.result, 1200),
    ] : []),
  ].join('\n');
}

export function createTeamRuns({ state, store, queue, notify, stopTask, isTaskActive, record }) {
  const pendingPlans = new Map();
  const scope = () => canonicalMemoryWorkspace(state.settings.workspace);

  function verifyWorkspace(workspace) {
    if (typeof workspace !== 'string' || canonicalMemoryWorkspace(workspace) !== scope()) {
      throw fail(409, '프로젝트가 변경되었습니다. 현재 프로젝트에서 팀 작업을 다시 요청해 주세요.');
    }
  }

  function verifyProvider(provider, permission) {
    if (!Object.hasOwn(EXECUTION_CAPABILITIES, provider)) throw fail(400, '지원되는 팀 모델을 선택해 주세요.');
    if (state.settings.localOnly && provider !== 'ollama') throw fail(403, '로컬 전용 모드에서는 Ollama를 선택해 주세요.');
    if (permission === 'workspace-write' && !WRITE_PROVIDERS.has(provider)) {
      throw fail(400, '파일 수정 팀에는 Codex 또는 Claude만 배정할 수 있습니다.');
    }
    if (!state.providers.some(item => item.id === provider && item.status === 'ready' && item.authenticated === true)) {
      throw fail(409, '팀에 배정된 모델의 연결 상태를 확인해 주세요.');
    }
  }

  function allowedProviders(permission) {
    return state.providers.filter(item => item.status === 'ready' && item.authenticated === true
      && Object.hasOwn(EXECUTION_CAPABILITIES, item.id)
      && (!state.settings.localOnly || item.id === 'ollama')
      && (permission !== 'workspace-write' || WRITE_PROVIDERS.has(item.id))).map(item => item.id);
  }

  function makeTurn(input) {
    verifyWorkspace(input.workspace);
    const prompt = normalizeTeamGoal(input.prompt);
    const permission = input.permission === undefined ? 'read-only' : input.permission;
    if (permission !== 'read-only' && permission !== 'workspace-write') throw fail(400, '올바른 팀 작업 권한을 선택해 주세요.');
    assertTaskPermission(state.settings, permission);
    return { id: randomUUID(), prompt, permission, status: 'planning', taskIds: {}, createdAt: now() };
  }

  function makeTask(team, turn, { role, prompt, provider, phase }) {
    return {
      id: randomUUID(), title: phase === 'plan' ? `팀 구성 · ${clip(team.title, 72)}` : `${role.name} · ${clip(team.title, 37)}`,
      prompt, departmentId: `team-${team.id}-${role?.id || 'planner'}`, departmentName: role?.name || '팀 계획',
      provider, modelId: '', connectionId: null, ...resolveExecutionOptions(provider), priority: 'normal',
      permission: phase === 'plan' ? 'read-only' : turn.permission, workspace: team.workspace, demo: false,
      status: 'queued', createdAt: now(), startedAt: null, finishedAt: null, output: '', error: null, logs: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      teamId: team.id, teamTurnId: turn.id, teamPhase: phase,
      ...(role ? { teamRole: { id: role.id, name: role.name, role: role.role, provider: role.provider }, workflowId: turn.id } : {}),
    };
  }

  function commit(team, tasks) {
    const pending = state.tasks.filter(task => TASK_ACTIVE.has(task.status)).length;
    if (pending + tasks.length > MAX_PENDING) throw fail(409, '팀 작업을 담을 대기열이 부족합니다. 진행 중인 작업이 끝나면 다시 요청해 주세요.');
    const previousTasks = state.tasks;
    const previousTeams = state.teamRuns;
    const teams = [...previousTeams];
    const index = teams.findIndex(item => item.id === team.id);
    if (index !== -1) teams[index] = team;
    else {
      const workspace = canonicalMemoryWorkspace(team.workspace);
      const sameWorkspace = item => canonicalMemoryWorkspace(item.workspace) === workspace;
      if (teams.filter(sameWorkspace).length >= MAX_TEAMS_PER_WORKSPACE) {
        const oldest = teams.findIndex(item => sameWorkspace(item) && !item.turns.some(turn => ACTIVE.has(turn.status)));
        if (oldest < 0) throw fail(409, '동시에 열린 팀이 많습니다. 진행 중인 팀이 끝난 뒤 다시 요청해 주세요.');
        teams.splice(oldest, 1);
      }
      teams.push(team);
    }
    state.tasks = tasksWithAppended(previousTasks, tasks, isTaskActive);
    state.teamRuns = teams;
    try { store.save(); }
    catch (error) { state.tasks = previousTasks; state.teamRuns = previousTeams; throw error; }
    for (const task of tasks) {
      record('queued', `${task.title} · 지시 접수`, { taskId: task.id, departmentId: task.departmentId, provider: task.provider });
    }
    notify();
    queue();
    return team;
  }

  function start(input) {
    checkFields(input, ['workspace', 'prompt', 'provider', 'permission']);
    const turn = makeTurn(input);
    const available = allowedProviders(turn.permission);
    if (!available.length) throw fail(409, '이 권한으로 팀을 실행할 수 있는 연결된 모델이 없습니다.');
    const provider = input.provider === undefined ? available[0] : input.provider;
    if (typeof provider !== 'string') throw fail(400, '올바른 팀 계획 모델을 선택해 주세요.');
    verifyProvider(provider, 'read-only');
    const team = {
      id: randomUUID(), workspace: state.settings.workspace, title: titleFor(turn.prompt), plannerProvider: provider,
      plan: null, turns: [turn],
    };
    const task = makeTask(team, turn, { prompt: '사용자 목표에 맞는 팀 구조를 준비합니다.', provider, phase: 'plan' });
    turn.plannerTaskId = task.id;
    pendingPlans.set(turn.id, {
      allowed: available,
      prompt: buildTeamPlanningPrompt(turn.prompt, available, { permission: turn.permission, language: state.settings.language }),
    });
    try { return commit(team, [task]); }
    catch (error) { pendingPlans.delete(turn.id); throw error; }
  }

  function lookup(id, workspace) {
    verifyWorkspace(workspace);
    const team = state.teamRuns.find(item => item.id === id);
    if (!team || canonicalMemoryWorkspace(team.workspace) !== scope()) throw fail(404, '현재 프로젝트에서 팀을 찾을 수 없습니다.');
    return team;
  }

  function currentTaskTurn(task) {
    const team = state.teamRuns.find(item => item.id === task.teamId);
    const turn = team?.turns.find(item => item.id === task.teamTurnId);
    return { team, turn };
  }

  function authorize(task) {
    const { team, turn } = currentTaskTurn(task);
    if (!team || !turn || !ACTIVE.has(turn.status)) throw fail(409, '팀 작업이 종료되었습니다.');
    verifyWorkspace(task.workspace);
    assertTaskPermission(state.settings, task.permission);
    verifyProvider(task.provider, task.permission);
    if (task.teamPhase === 'plan') {
      const planRequest = pendingPlans.get(turn.id);
      if (!planRequest || turn.plannerTaskId !== task.id) throw fail(409, '활성 팀 구성 요청을 찾을 수 없습니다.');
      return planRequest.prompt;
    }
    if (turn.taskIds[task.teamRole?.id] !== task.id) throw fail(409, '팀 배정 내역과 작업이 일치하지 않습니다.');
  }

  function materialize(team, turn, plan, previous) {
    assertTaskPermission(state.settings, turn.permission);
    verifyWorkspace(team.workspace);
    for (const role of plan.roles) verifyProvider(role.provider, turn.permission);
    const taskIds = {};
    const tasks = plan.roles.map(role => {
      const task = makeTask(team, turn, { role, prompt: workerPrompt(turn, role, previous), provider: role.provider, phase: 'role' });
      task.dependsOn = role.dependsOn.map(id => taskIds[id]);
      if (role.id === plan.finalRoleId) task.teamContextTaskIds = Object.values(taskIds);
      taskIds[role.id] = task.id;
      return task;
    });
    const assigned = { ...turn, status: 'running', taskIds, finalTaskId: taskIds[plan.finalRoleId] };
    const turns = team.turns.filter(item => item.id !== turn.id).concat(assigned).slice(-MAX_TURNS);
    return commit({ ...team, plan, turns }, tasks);
  }

  function acceptPlan(task, output) {
    const { team, turn } = currentTaskTurn(task);
    const planRequest = pendingPlans.get(task.teamTurnId);
    if (!team || turn?.status !== 'planning' || !planRequest || turn.plannerTaskId !== task.id) {
      throw fail(409, '활성 팀 구성 요청을 찾을 수 없습니다.');
    }
    const plan = parseTeamPlan(output, planRequest.allowed);
    materialize(team, turn, plan);
  }

  function followup(id, input) {
    checkFields(input, ['workspace', 'prompt', 'permission']);
    const team = lookup(id, input.workspace);
    if (team.turns.some(turn => ACTIVE.has(turn.status)) || state.tasks.some(task => task.teamId === id && isTaskActive(task))) {
      throw fail(409, '현재 팀 작업이 끝난 뒤 이어서 질문해 주세요.');
    }
    if (!team.plan) throw fail(409, '구성된 팀이 없습니다. 새 팀을 시작해 주세요.');
    const turn = makeTurn(input);
    const plan = parseTeamPlan(JSON.stringify(team.plan), allowedProviders(turn.permission));
    const previous = [...team.turns].reverse().find(item => item.status === 'completed');
    return materialize(team, turn, plan, previous);
  }

  function finishTurn(turn, status, error) {
    turn.status = status;
    turn.finishedAt = now();
    if (error) turn.error = error;
    pendingPlans.delete(turn.id);
  }

  function abandon(team, turn, status, error, excluding) {
    finishTurn(turn, status, error);
    const stopping = [];
    for (const task of state.tasks) {
      if (task.id === excluding || task.teamId !== team.id || task.teamTurnId !== turn.id || !TASK_ACTIVE.has(task.status)) continue;
      task.status = 'cancelled';
      task.finishedAt = turn.finishedAt;
      task.error = error;
      stopping.push(task);
    }
    for (const task of stopping) {
      record('cancelled', `${task.title} · 팀 작업 종료로 중단`, { taskId: task.id, departmentId: task.departmentId, provider: task.provider, workspace: task.workspace });
      stopTask(task);
    }
  }

  function settle(task) {
    const { team, turn } = currentTaskTurn(task);
    if (task.teamPhase === 'plan') pendingPlans.delete(task.teamTurnId);
    if (!turn || !ACTIVE.has(turn.status)) return;
    if (task.status !== 'completed') {
      abandon(team, turn, task.status, clip(task.error, 400) || '팀 작업이 중단되었습니다.', task.id);
    } else if (task.id === turn.finalTaskId) {
      finishTurn(turn, 'completed');
      turn.result = clip(task.output, MAX_RESULT);
      turn.resultTruncated = turn.result.length < task.output.length;
    }
  }

  function cancel(id, input) {
    checkFields(input, ['workspace']);
    const team = lookup(id, input.workspace);
    const turn = team.turns.find(item => ACTIVE.has(item.status));
    if (turn) {
      abandon(team, turn, 'cancelled', '사용자가 팀 작업을 취소했습니다.');
      store.save();
      notify();
      queue();
    }
    return team;
  }

  return { start, followup, cancel, authorize, acceptPlan, settle };
}
