import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEFAULT_DEPARTMENTS = [
  { id: 'strategy', name: '전략기획실', code: 'STR', provider: 'codex', role: '목표를 구체화하고 실행 계획, 우선순위와 의사결정 근거를 정리합니다.' },
  { id: 'engineering', name: '개발본부', code: 'ENG', provider: 'claude', role: '요구사항을 분석하고 설계, 코드 구현과 개선을 담당합니다.' },
  { id: 'research', name: '리서치센터', code: 'RES', provider: 'codex', role: '자료와 프로젝트를 조사하고 출처, 사실, 추론을 구분해 보고합니다.' },
  { id: 'quality', name: '품질관리실', code: 'QAT', provider: 'claude', role: '결과를 검토하고 오류, 위험과 누락된 요구사항을 검증합니다.' },
];

export function createStore({ dataDir, workspace }) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'state.json');
  let previous = {};
  if (existsSync(file)) {
    try {
      previous = JSON.parse(readFileSync(file, 'utf8'));
      if (!previous || typeof previous !== 'object') throw new Error('Invalid state');
    } catch {
      copyFileSync(file, join(dataDir, `state.unreadable-${Date.now()}.json`));
      previous = {};
    }
  }
  const state = {
    departments: Array.isArray(previous.departments) && previous.departments.length ? previous.departments : structuredClone(DEFAULT_DEPARTMENTS),
    tasks: Array.isArray(previous.tasks) ? previous.tasks.slice(-200) : [],
    events: Array.isArray(previous.events) ? previous.events.slice(-400) : [],
    settings: { workspace, maxConcurrent: 2, language: 'ko', ...previous.settings },
    providers: [],
    server: { startedAt: new Date().toISOString(), version: '1.0.0', mode: 'subscription-cli' },
  };
  for (const task of state.tasks) {
    if (['running', 'queued'].includes(task.status)) {
      task.status = 'interrupted';
      task.finishedAt = new Date().toISOString();
      task.error = '서버가 종료되어 중단된 작업입니다. 다시 지시하면 새 작업으로 실행됩니다.';
    }
  }
  let pending;
  function save() {
    clearTimeout(pending);
    const { providers, server, ...persistent } = state;
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify(persistent, null, 2), 'utf8');
    renameSync(temp, file);
  }
  function persist() {
    if (!pending || pending._destroyed) pending = setTimeout(save, 100);
  }
  function event(type, text, extra = {}) {
    const entry = { id: randomUUID(), timestamp: new Date().toISOString(), type, text, ...extra };
    state.events.push(entry);
    if (state.events.length > 400) state.events.splice(0, state.events.length - 400);
    persist();
    return entry;
  }
  save();
  return { state, save, persist, event };
}
