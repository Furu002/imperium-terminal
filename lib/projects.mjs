import { mkdir, realpath, stat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEFAULT_PROJECT_COLOR = '#C48A5A';
export const PROJECT_NAME_MAX = 80;
const COLOR = /^#[0-9A-Fa-f]{6}$/;
const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
// Control, bidi-override and line separators are rejected; ZWJ/variation selectors stay allowed for emoji names.
const FORBIDDEN = /[<>:"\/\\|?*\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/u;
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)$/i;
const ACTIVE = new Set(['queued', 'running']);

function fail(status, message) { const error = new Error(message); error.status = status; return error; }

/** realpath when the folder exists; lower-cased on Windows so drive/case variants compare equal. */
export function canonicalProjectPath(value) {
  let result = path.resolve(value);
  try { result = realpathSync.native(result); } catch { /* not created yet */ }
  return process.platform === 'win32' ? result.toLowerCase() : result;
}

export function validateProjectName(value) {
  if (typeof value !== 'string') throw fail(400, '프로젝트 이름이 필요합니다.');
  const name = value.normalize('NFC').trim();
  const length = [...name].length;
  if (!length) throw fail(400, '프로젝트 이름이 필요합니다.');
  if (length > PROJECT_NAME_MAX) throw fail(400, `프로젝트 이름은 ${PROJECT_NAME_MAX}자 이하여야 합니다.`);
  if (FORBIDDEN.test(name)) throw fail(400, '프로젝트 이름에 경로 구분자, 제어 문자 또는 < > : " | ? * 를 쓸 수 없습니다.');
  if (/^\.+$/.test(name) || /[. ]$/.test(name)) throw fail(400, '프로젝트 이름은 점이나 공백으로 끝날 수 없습니다.');
  if (RESERVED.test(name.split('.')[0].trim())) throw fail(400, 'Windows 예약 이름은 프로젝트 이름으로 쓸 수 없습니다.');
  return name;
}

export function validateProjectColor(value, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !COLOR.test(value)) throw fail(400, '색상은 #RRGGBB 형식이어야 합니다.');
  return value.toUpperCase();
}

function validateId(id) {
  if (typeof id !== 'string' || !PROJECT_ID.test(id)) throw fail(400, '올바르지 않은 프로젝트 ID입니다.');
  return id;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative) && !relative.includes(path.sep);
}

async function directoryExists(target) {
  try { return (await stat(target)).isDirectory(); } catch { return false; }
}

function fallbackName(workspace) {
  const base = path.basename(path.resolve(workspace)) || 'Workspace';
  try { return validateProjectName([...base].slice(0, PROJECT_NAME_MAX).join('')); } catch { return 'Workspace'; }
}

export function createProjectManager({ state, store, defaultParent } = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('state is required');
  if (!state.settings || typeof state.settings !== 'object') state.settings = {};
  let switching = false;

  function commit() {
    if (typeof store?.save === 'function') store.save();
    else if (typeof store?.persist === 'function') store.persist();
  }

  function registry() {
    if (!Array.isArray(state.projects)) state.projects = [];
    const valid = state.projects.filter(project => project && typeof project === 'object' && typeof project.id === 'string' && PROJECT_ID.test(project.id) && typeof project.workspace === 'string' && path.isAbsolute(project.workspace));
    if (valid.length !== state.projects.length) state.projects = valid;
    return state.projects;
  }

  /** Lazily registers the pre-existing workspace without touching its contents. */
  function current() {
    const projects = registry();
    const workspace = state.settings.workspace;
    if (typeof workspace !== 'string' || !path.isAbsolute(workspace)) return undefined;
    const key = canonicalProjectPath(workspace);
    let project = projects.find(item => canonicalProjectPath(item.workspace) === key);
    if (!project) {
      project = {
        id: randomUUID(),
        name: fallbackName(workspace),
        color: DEFAULT_PROJECT_COLOR,
        workspace,
        createdAt: new Date().toISOString(),
        departments: structuredClone(Array.isArray(state.departments) ? state.departments : []),
      };
      projects.unshift(project);
      commit();
    }
    return project;
  }

  function summary(project, active) {
    const departments = active ? state.departments : project.departments;
    return {
      id: project.id,
      name: project.name,
      color: COLOR.test(project.color) ? project.color : DEFAULT_PROJECT_COLOR,
      workspace: project.workspace,
      createdAt: project.createdAt,
      departmentCount: Array.isArray(departments) ? departments.length : 0,
      current: Boolean(active),
    };
  }

  function find(id) {
    validateId(id);
    current();
    const project = registry().find(item => item.id === id);
    if (!project) throw fail(404, '프로젝트를 찾을 수 없습니다.');
    return project;
  }

  function list() {
    const active = current();
    return {
      projects: registry().map(project => summary(project, project === active)),
      currentProjectId: active?.id ?? null,
    };
  }

  async function resolveParent(parentDir) {
    if (parentDir !== undefined && parentDir !== null && parentDir !== '') {
      if (typeof parentDir !== 'string' || parentDir.length > 4096 || /\p{Cc}/u.test(parentDir) || !path.isAbsolute(parentDir)) throw fail(400, '상위 폴더는 절대 경로여야 합니다.');
      if (!await directoryExists(parentDir)) throw fail(400, '상위 폴더가 존재하지 않습니다.');
      return realpath(path.resolve(parentDir));
    }
    let base = defaultParent;
    if (!base) {
      const workspace = state.settings.workspace;
      if (typeof workspace !== 'string' || !path.isAbsolute(workspace)) throw fail(400, '기본 상위 폴더를 정할 수 없습니다. 상위 폴더를 지정해 주세요.');
      base = path.join(path.dirname(path.resolve(workspace)), 'Imperium Projects');
    }
    if (!path.isAbsolute(base)) throw fail(400, '기본 상위 폴더는 절대 경로여야 합니다.');
    await mkdir(base, { recursive: true });
    if (!await directoryExists(base)) throw fail(400, '기본 상위 폴더를 사용할 수 없습니다.');
    return realpath(path.resolve(base));
  }

  async function create(input = {}) {
    const name = validateProjectName(input?.name);
    const color = validateProjectColor(input?.color, DEFAULT_PROJECT_COLOR);
    current();
    const parent = await resolveParent(input?.parentDir);
    const id = randomUUID();
    const folder = `${name}-${id.slice(0, 8)}`;
    const target = path.join(parent, folder);
    if (!isInside(parent, target) || path.basename(target) !== folder) throw fail(400, '프로젝트 폴더가 상위 폴더 밖을 가리킵니다.');
    try { await mkdir(target); } catch (error) {
      if (error.code === 'EEXIST') throw fail(409, '같은 이름의 폴더가 이미 있습니다. 기존 폴더는 덮어쓰지 않습니다.');
      throw fail(500, `프로젝트 폴더를 만들 수 없습니다: ${error.code || error.message}`);
    }
    const workspace = await realpath(target);
    if (!isInside(parent, workspace)) throw fail(400, '프로젝트 폴더가 상위 폴더 밖을 가리킵니다.');
    const project = { id, name, color, workspace, createdAt: new Date().toISOString(), departments: [] };
    registry().push(project);
    commit();
    return summary(project, false);
  }

  async function select(id) {
    const target = find(id);
    const active = current();
    if (target === active) { state.settings.workspace = target.workspace; return summary(target, true); }
    if (switching) throw fail(409, '다른 프로젝트로 전환하는 중입니다.');
    if ((state.tasks || []).some(task => ACTIVE.has(task?.status))) throw fail(409, '대기 중이거나 실행 중인 작업이 끝난 뒤 프로젝트를 전환해 주세요.');
    switching = true;
    try {
      if (!await directoryExists(target.workspace)) throw fail(409, '프로젝트 폴더를 찾을 수 없습니다. 폴더가 이동되었거나 삭제되었습니다.');
      if ((state.tasks || []).some(task => ACTIVE.has(task?.status))) throw fail(409, '대기 중이거나 실행 중인 작업이 끝난 뒤 프로젝트를 전환해 주세요.');
      if (active) active.departments = structuredClone(Array.isArray(state.departments) ? state.departments : []);
      state.departments = structuredClone(Array.isArray(target.departments) ? target.departments : []);
      state.settings.workspace = target.workspace;
      commit();
      return summary(target, true);
    } finally { switching = false; }
  }

  function update(id, input = {}) {
    const project = find(id);
    if (input?.name === undefined && input?.color === undefined) throw fail(400, '변경할 이름이나 색상이 필요합니다.');
    const name = input.name === undefined ? project.name : validateProjectName(input.name);
    const color = input.color === undefined ? project.color : validateProjectColor(input.color);
    project.name = name;
    project.color = color;
    commit();
    return summary(project, project === current());
  }

  async function switchWorkspace(workspace) {
    if (typeof workspace !== 'string' || !path.isAbsolute(workspace) || !await directoryExists(workspace)) throw fail(400, '존재하는 프로젝트 폴더를 선택해 주세요.');
    const resolved = await realpath(workspace);
    current();
    let target = registry().find(project => canonicalProjectPath(project.workspace) === canonicalProjectPath(resolved));
    if (!target) {
      target = { id: randomUUID(), name: fallbackName(resolved), color: DEFAULT_PROJECT_COLOR, workspace: resolved, createdAt: new Date().toISOString(), departments: [] };
      registry().push(target);
    }
    return select(target.id);
  }
  return { list, create, select, update, switchWorkspace };
}
