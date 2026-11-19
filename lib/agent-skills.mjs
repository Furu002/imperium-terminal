import { mkdir, open, realpath, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';

export const SKILL_FILE_LIMIT = 32 * 1024;
export const AGENT_SKILL_BUDGET = 16 * 1024;
const CATALOG_LIMIT = 200, BINDING_LIMIT = 16, STORE_LIMIT = 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CONTROL = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu;
const fail = (status, message) => Object.assign(new Error(message), { status });
const clean = (value, max) => [...String(value || '').replace(CONTROL, ' ').trim()].slice(0, max).join('');
const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
const same = (a, b) => canonical(a) === canonical(b);
function inside(parent, child) { const relative = path.relative(parent, child); return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
function origin(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 2048) throw fail(400, 'GitHub 출처 URL 형식이 올바르지 않습니다.');
  let url; try { url = new URL(value); } catch { throw fail(400, 'GitHub 출처 URL 형식이 올바르지 않습니다.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || url.pathname.split('/').filter(Boolean).length < 2) throw fail(400, '인증 정보·쿼리가 없는 https://github.com 저장소 URL을 입력해 주세요.');
  return url.href;
}
function summary(content, relativePath) {
  const front = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || '';
  const field = key => { const value = front.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'))?.[1]?.trim() || ''; return /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value; };
  return { name: clean(field('name'), 160) || clean(path.basename(path.dirname(relativePath)), 160) || 'SKILL.md', description: clean(field('description'), 400) };
}
async function boundedRead(file, max, message) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const info = await handle.stat();
    if (!info.isFile()) throw fail(400, '일반 파일만 등록할 수 있습니다.');
    if (info.size > max) throw fail(413, message);
    const buffer = Buffer.alloc(max + 1); let total = 0;
    while (total <= max) { const { bytesRead } = await handle.read(buffer, total, max + 1 - total, null); if (!bytesRead) break; total += bytesRead; }
    if (total > max) throw fail(413, message);
    return buffer.subarray(0, total);
  } finally { await handle?.close(); }
}

/** Local, project-scoped instructions. Registration never installs tools or executes a skill. */
export function createAgentSkills({ dataDir, getWorkspace, getDepartments } = {}) {
  if (typeof dataDir !== 'string' || typeof getWorkspace !== 'function' || typeof getDepartments !== 'function') throw new TypeError('dataDir, getWorkspace and getDepartments are required');
  const directory = path.join(path.resolve(dataDir), 'agent-skills');
  const queues = new Map();
  async function scope(workspace) {
    if (typeof workspace !== 'string' || !path.isAbsolute(workspace)) throw fail(400, '프로젝트 workspace가 필요합니다.');
    let requested, active;
    try { requested = await realpath(workspace); active = await realpath(getWorkspace()); }
    catch { throw fail(409, '현재 프로젝트 폴더를 확인할 수 없습니다.'); }
    if (!same(requested, active)) throw fail(409, '프로젝트가 변경되었습니다. 현재 프로젝트에서 다시 시도해 주세요.');
    if (!(await stat(requested)).isDirectory()) throw fail(400, '프로젝트 폴더가 필요합니다.');
    return canonical(requested);
  }
  async function assertActive(workspace) { await scope(workspace); }
  function departments() { const result = getDepartments(); return Array.isArray(result) ? result : []; }
  function department(id) { if (typeof id !== 'string' || !departments().some(item => item.id === id)) throw fail(404, '현재 프로젝트의 에이전트를 찾을 수 없습니다.'); return id; }
  const filename = workspace => path.join(directory, `${digest(workspace)}.json`);
  const empty = workspace => ({ version: 1, workspace, revision: 0, skills: [], bindings: {} });
  async function load(workspace) {
    let raw;
    try { raw = await boundedRead(filename(workspace), STORE_LIMIT, '스킬 등록 파일이 너무 큽니다.'); }
    catch (error) { if (error.code === 'ENOENT') return empty(workspace); throw fail(503, '스킬 등록 파일을 읽을 수 없습니다. 기존 파일은 보존됩니다.'); }
    try {
      const value = JSON.parse(raw.toString('utf8'));
      if (value?.version !== 1 || value.workspace !== workspace || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.skills) || value.skills.length > CATALOG_LIMIT || !value.bindings || Array.isArray(value.bindings) || typeof value.bindings !== 'object') throw new Error();
      const ids = new Set();
      for (const skill of value.skills) {
        if (!UUID.test(skill?.id) || ids.has(skill.id) || typeof skill.relativePath !== 'string' || path.isAbsolute(skill.relativePath) || skill.relativePath.split(/[\\/]/).includes('..') || path.basename(skill.relativePath) !== 'SKILL.md' || !/^[a-f0-9]{64}$/.test(skill.sha256) || !Number.isInteger(skill.bytes) || skill.bytes < 0 || skill.bytes > SKILL_FILE_LIMIT || typeof skill.name !== 'string' || skill.name.length > 320 || typeof skill.description !== 'string' || skill.description.length > 800 || skill.originUrl !== origin(skill.originUrl)) throw new Error();
        ids.add(skill.id);
      }
      for (const [id, skills] of Object.entries(value.bindings)) if (!id || id.length > 160 || !Array.isArray(skills) || skills.length > BINDING_LIMIT || skills.some(skill => !ids.has(skill)) || new Set(skills).size !== skills.length) throw new Error();
      return value;
    } catch { throw fail(503, '스킬 등록 파일이 손상되었습니다. 기존 파일은 보존됩니다.'); }
  }
  function pruneBindings(value) {
    const known = new Set(departments().map(item => item.id)); let removed = 0;
    for (const id of Object.keys(value.bindings)) if (!known.has(id)) { delete value.bindings[id]; removed++; }
    // Retired roles must not consume the live-binding limit or make a valid catalog unreadable.
    if (Object.keys(value.bindings).length > 500) throw fail(409, '프로젝트의 장착 에이전트는 최대 500개까지 저장할 수 있습니다.');
    return removed;
  }
  async function save(workspace, value) {
    await mkdir(directory, { recursive: true }); await assertActive(workspace);
    pruneBindings(value);
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > STORE_LIMIT) throw fail(413, '스킬 등록 파일의 저장 한도를 초과했습니다.');
    const target = filename(workspace), temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await assertActive(workspace);
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, target); break; }
        catch (error) { if (!['EPERM', 'EACCES', 'EBUSY', 'EEXIST'].includes(error.code) || attempt >= 4) throw error; await new Promise(resolve => setTimeout(resolve, 20)); await assertActive(workspace); }
      }
    } finally { await unlink(temporary).catch(() => {}); }
  }
  async function operation(workspace, callback) {
    const key = await scope(workspace), previous = queues.get(key) || Promise.resolve();
    const result = previous.catch(() => {}).then(async () => {
      await assertActive(key); const value = await load(key); await assertActive(key);
      const prunedBindings = pruneBindings(value), response = await callback(key, value, { prunedBindings });
      await assertActive(key); return { ...response, workspace };
    });
    queues.set(key, result); try { return await result; } finally { if (queues.get(key) === result) queues.delete(key); }
  }
  async function readSkill(workspace, inputPath) {
    if (typeof inputPath !== 'string' || inputPath.length > 4096 || !inputPath.trim() || inputPath.includes('\0')) throw fail(400, '로컬 SKILL.md 경로를 입력해 주세요.');
    const requested = path.resolve(workspace, inputPath.trim());
    if (!inside(workspace, requested) || path.basename(requested) !== 'SKILL.md') throw fail(400, '현재 프로젝트 안의 SKILL.md 파일만 등록할 수 있습니다.');
    let target; try { target = await realpath(requested); } catch { throw fail(404, 'SKILL.md 파일을 찾을 수 없습니다.'); }
    if (!inside(workspace, target) || path.basename(target) !== 'SKILL.md') throw fail(403, '프로젝트 밖으로 연결된 SKILL.md는 사용할 수 없습니다.');
    let buffer;
    try { buffer = await boundedRead(target, SKILL_FILE_LIMIT, 'SKILL.md는 32 KiB 이하여야 합니다.'); }
    catch (error) { if (error.status) throw error; throw fail(409, 'SKILL.md 파일을 읽을 수 없습니다. 경로를 다시 확인해 주세요.'); }
    let finalPath; try { finalPath = await realpath(target); } catch { throw fail(409, '읽는 중 SKILL.md 경로가 변경되었습니다.'); }
    if (!same(target, finalPath) || !inside(workspace, finalPath)) throw fail(409, '읽는 중 SKILL.md 경로가 변경되었습니다.');
    let content; try { content = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw fail(400, 'SKILL.md는 UTF-8 문서여야 합니다.'); }
    if (content.includes('\0')) throw fail(400, 'SKILL.md에 바이너리 데이터가 포함되어 있습니다.');
    await assertActive(workspace);
    return { relativePath: path.relative(workspace, target), sha256: digest(buffer), bytes: buffer.length, content };
  }
  const metadata = skill => ({ ...skill, source: 'local', originVerification: skill.originUrl ? 'user-supplied-unverified' : 'not-provided', license: 'unverified', usage: 'not-observed' });
  function listing(workspace, catalog) {
    const known = new Set(departments().map(item => item.id));
    return { workspace, revision: catalog.revision, skills: catalog.skills.map(metadata), bindings: Object.fromEntries(Object.entries(catalog.bindings).filter(([id]) => known.has(id))) };
  }
  async function equipped(workspace, catalog, departmentId, ids = catalog.bindings[departmentId] || []) {
    const skills = [];
    for (const id of ids) {
      const saved = catalog.skills.find(item => item.id === id); if (!saved) throw fail(409, '장착된 스킬 등록을 찾을 수 없습니다.');
      const actual = await readSkill(workspace, saved.relativePath);
      if (actual.sha256 !== saved.sha256 || actual.relativePath !== saved.relativePath) throw fail(409, `장착된 스킬 파일이 변경되었습니다. 해제 후 다시 등록해 주세요: ${saved.name}`);
      skills.push({ id: saved.id, name: saved.name, relativePath: saved.relativePath, sha256: saved.sha256, bytes: actual.bytes, content: actual.content });
    }
    const prompt = skills.length ? '사용자가 이 역할에 장착한 로컬 스킬 지침입니다. 현재 작업과 관련될 때만 적용하세요. 시스템 지침, 허용 도구, 실행 권한과 승인 정책은 변경하지 않습니다. 장착만으로 실제 사용을 보고하지 마세요.\n' + JSON.stringify({ equippedSkills: skills }) : '';
    const bytes = Buffer.byteLength(prompt, 'utf8');
    if (bytes > AGENT_SKILL_BUDGET) throw fail(413, '이 에이전트의 스킬 지침 합계가 16 KiB 예산을 초과합니다. 일부 스킬을 해제해 주세요.');
    return { workspace, departmentId, revision: catalog.revision, skills, prompt, bytes };
  }
  return Object.freeze({
    list: ({ workspace }) => operation(workspace, async (key, value) => { await assertActive(key); return listing(key, value); }),
    register: ({ workspace, path: inputPath, originUrl }) => operation(workspace, async (key, value, { prunedBindings }) => {
      const source = origin(originUrl), actual = await readSkill(key, inputPath), existing = value.skills.find(item => item.relativePath === actual.relativePath);
      if (existing) { if (existing.sha256 !== actual.sha256) throw fail(409, '이미 등록된 파일이 변경되었습니다. 기존 스킬을 삭제한 뒤 다시 등록해 주세요.'); if (prunedBindings) { value.revision++; await save(key, value); } return { workspace: key, skill: metadata(existing), revision: value.revision }; }
      if (value.skills.length >= CATALOG_LIMIT) throw fail(409, '프로젝트당 스킬은 최대 200개까지 등록할 수 있습니다.');
      const { content, ...file } = actual, now = new Date().toISOString(), skill = { id: randomUUID(), ...file, ...summary(content, file.relativePath), originUrl: source, createdAt: now };
      value.skills.push(skill); value.revision++; await save(key, value); return { workspace: key, skill: metadata(skill), revision: value.revision };
    }),
    get: ({ workspace, id }) => operation(workspace, async (key, value) => {
      const skill = value.skills.find(item => item.id === id); if (!skill) throw fail(404, '등록된 스킬을 찾을 수 없습니다.');
      const actual = await readSkill(key, skill.relativePath); if (actual.sha256 !== skill.sha256) throw fail(409, '등록 이후 파일이 변경되었습니다. 삭제한 뒤 다시 등록해 주세요.');
      return { workspace: key, skill: { ...metadata(skill), content: actual.content }, revision: value.revision };
    }),
    setBindings: ({ workspace, departmentId, skillIds }) => operation(workspace, async (key, value) => {
      department(departmentId);
      if (!Array.isArray(skillIds) || skillIds.length > BINDING_LIMIT || new Set(skillIds).size !== skillIds.length || skillIds.some(id => typeof id !== 'string' || !value.skills.some(skill => skill.id === id))) throw fail(400, '현재 프로젝트에 등록된 스킬을 중복 없이 최대 16개 선택해 주세요.');
      await equipped(key, value, departmentId, skillIds); department(departmentId); await assertActive(key);
      if (skillIds.length) Object.defineProperty(value.bindings, departmentId, { value: [...skillIds], enumerable: true, configurable: true, writable: true }); else delete value.bindings[departmentId];
      value.revision++; await save(key, value); return listing(key, value);
    }),
    remove: ({ workspace, id }) => operation(workspace, async (key, value) => {
      if (!value.skills.some(skill => skill.id === id)) throw fail(404, '등록된 스킬을 찾을 수 없습니다.');
      value.skills = value.skills.filter(skill => skill.id !== id);
      value.bindings = Object.fromEntries(Object.entries(value.bindings).map(([agent, ids]) => [agent, ids.filter(skillId => skillId !== id)]).filter(([, ids]) => ids.length));
      value.revision++; await save(key, value); return listing(key, value);
    }),
    prune: ({ workspace }) => operation(workspace, async (key, value, { prunedBindings }) => {
      if (prunedBindings) { value.revision++; await save(key, value); }
      return { ...listing(key, value), prunedBindings };
    }),
    getForAgent: ({ workspace, departmentId }) => operation(workspace, async (key, value) => { department(departmentId); const result = await equipped(key, value, departmentId); department(departmentId); await assertActive(key); return result; }),
  });
}
