import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const APP_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY', 'EEXIST', 'ETXTBSY']);
const pauseSync = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

/** Antivirus/indexers can briefly lock a Windows target. Never unlink the previous state. */
export function renameWithRetry(source, target, { rename = renameSync, pause = pauseSync } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { rename(source, target); return; }
    catch (error) {
      if (!TRANSIENT_RENAME_CODES.has(error?.code) || attempt === 4) throw error;
      pause(20);
    }
  }
}

function storageError(error) {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,39}$/.test(error.code) ? error.code : 'ESTORAGE';
  return { code, message: '작업 기록을 저장하지 못했습니다. 다음 저장 시 다시 시도합니다.' };
}

export const DEFAULT_DEPARTMENTS = [
  { id: 'strategy', name: '전략기획실', code: 'STR', provider: 'codex', role: '목표를 구체화하고 실행 계획, 우선순위와 의사결정 근거를 정리합니다.' },
  { id: 'engineering', name: '개발본부', code: 'ENG', provider: 'claude', role: '요구사항을 분석하고 설계, 코드 구현과 개선을 담당합니다.' },
  { id: 'research', name: '리서치센터', code: 'RES', provider: 'codex', role: '자료와 프로젝트를 조사하고 출처, 사실, 추론을 구분해 보고합니다.' },
  { id: 'quality', name: '품질관리실', code: 'QAT', provider: 'claude', role: '결과를 검토하고 오류, 위험과 누락된 요구사항을 검증합니다.' },
];

export function createStore({ dataDir, workspace, onStorageChange }, { rename = renameSync, pause = pauseSync, setTimer = setTimeout, clearTimer = clearTimeout, warn = console.warn } = {}) {
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
    departments: Array.isArray(previous.departments) ? previous.departments : structuredClone(DEFAULT_DEPARTMENTS),
    tasks: Array.isArray(previous.tasks) ? previous.tasks.slice(-200) : [],
    events: Array.isArray(previous.events) ? previous.events.slice(-400) : [],
    settings: { workspace, maxConcurrent: 2, language: 'ko', onboarded: false, localOnly: false, identity: { name: '나', title: '워크스페이스 소유자' }, ...previous.settings },
    projects: Array.isArray(previous.projects) ? previous.projects : [],
    connections: Array.isArray(previous.connections) ? previous.connections : [
      { id: 'default-codex', providerId: 'codex', label: 'ChatGPT / Codex', modelId: '' },
      { id: 'default-claude', providerId: 'claude', label: 'Claude Code', modelId: '' },
    ],
    graphs: previous.graphs && typeof previous.graphs === 'object' && !Array.isArray(previous.graphs) ? previous.graphs : {},
    providers: [],
    server: { startedAt: new Date().toISOString(), version: APP_VERSION, mode: 'subscription-cli' },
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
    if (pending !== undefined) { clearTimer(pending); pending = undefined; }
    try {
      const { providers, server, ...persistent } = state;
      const temp = `${file}.tmp`;
      writeFileSync(temp, JSON.stringify(persistent), 'utf8');
      renameWithRetry(temp, file, { rename, pause });
      const recovered = Boolean(state.server.storageError);
      delete state.server.storageError;
      if (recovered) { try { onStorageChange?.(null); } catch {} }
    } catch (error) {
      const previousCode = state.server.storageError?.code;
      state.server.storageError = storageError(error);
      if (previousCode !== state.server.storageError.code) { try { onStorageChange?.(state.server.storageError); } catch {} }
      throw error;
    }
  }
  function persist() {
    if (pending !== undefined) return;
    pending = setTimer(() => {
      pending = undefined;
      try { save(); }
      catch {
        try { warn('[IMPERIUM storage]', state.server.storageError.code); } catch { /* Logging must not terminate the app either. */ }
      }
    }, 1000);
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
