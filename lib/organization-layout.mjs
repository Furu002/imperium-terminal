import { mkdir, open, realpath, rename, stat, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const ORGANIZATION_LAYOUT_LIMITS = Object.freeze({ agents: 500, coordinate: 100000, minZoom: 0.15, maxZoom: 3, bytes: 128 * 1024 });
const queues = new Map();
const fail = (status, message) => Object.assign(new Error(message), { status });
const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function fields(value, keys, message) { if (!object(value) || Object.keys(value).some(key => !keys.includes(key))) throw fail(400, message); }
function point(value) {
  fields(value, ['x', 'y'], '위치는 x와 y 좌표만 포함해야 합니다.');
  if (typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.abs(value.x) > ORGANIZATION_LAYOUT_LIMITS.coordinate || Math.abs(value.y) > ORGANIZATION_LAYOUT_LIMITS.coordinate) throw fail(400, '조직도 좌표는 -100000부터 100000까지의 유한한 숫자여야 합니다.');
  return { x: value.x, y: value.y };
}
function viewport(value) {
  fields(value, ['pan', 'zoom'], '화면 위치는 pan과 zoom만 포함해야 합니다.');
  if (typeof value.zoom !== 'number' || !Number.isFinite(value.zoom) || value.zoom < ORGANIZATION_LAYOUT_LIMITS.minZoom || value.zoom > ORGANIZATION_LAYOUT_LIMITS.maxZoom) throw fail(400, '조직도 배율은 0.15부터 3까지여야 합니다.');
  return { pan: point(value.pan), zoom: value.zoom };
}
function positions(value, known) {
  if (!object(value) || Object.keys(value).length > ORGANIZATION_LAYOUT_LIMITS.agents + 1 || Object.keys(value).filter(id => id !== 'owner').length > ORGANIZATION_LAYOUT_LIMITS.agents) throw fail(400, '조직도는 소유자와 최대 500개의 역할 위치만 저장할 수 있습니다.');
  const result = {};
  for (const [id, position] of Object.entries(value)) {
    if (id !== 'owner' && (!/^agent:[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(id) || known && !known.has(id.slice(6)))) throw fail(400, '현재 프로젝트의 소유자·에이전트 위치만 저장할 수 있습니다.');
    result[id] = point(position);
  }
  return result;
}
async function readBounded(file) {
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const info = await handle.stat(); if (!info.isFile() || info.size > ORGANIZATION_LAYOUT_LIMITS.bytes) throw new Error('Invalid layout file');
    const buffer = Buffer.alloc(ORGANIZATION_LAYOUT_LIMITS.bytes + 1); let size = 0;
    while (size < buffer.length) { const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null); if (!bytesRead) break; size += bytesRead; }
    if (size > ORGANIZATION_LAYOUT_LIMITS.bytes) throw new Error('Layout file too large');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size));
  } finally { await handle.close(); }
}

/** Presentation-only positions. Workflow nodes, handoff edges and role definitions are never stored here. */
export function createOrganizationLayout({ dataDir, getWorkspace, getDepartments } = {}) {
  if (typeof dataDir !== 'string' || typeof getWorkspace !== 'function' || typeof getDepartments !== 'function') throw new TypeError('dataDir, getWorkspace and getDepartments are required');
  const directory = path.join(path.resolve(dataDir), 'organization-layout');
  const knownDepartments = () => new Set((getDepartments() || []).map(role => role.id));
  const filename = workspace => path.join(directory, `${createHash('sha256').update(workspace).digest('hex')}.json`);
  const empty = workspace => ({ version: 1, workspace, revision: 0, updatedAt: null, positions: {}, viewport: { pan: { x: 0, y: 0 }, zoom: 1 } });
  async function scope(workspace) {
    if (typeof workspace !== 'string' || !path.isAbsolute(workspace)) throw fail(400, '현재 프로젝트의 workspace가 필요합니다.');
    let requested, active;
    try { requested = await realpath(workspace); active = await realpath(getWorkspace()); }
    catch { throw fail(409, '현재 프로젝트 폴더를 확인할 수 없습니다.'); }
    if (canonical(requested) !== canonical(active)) throw fail(409, '프로젝트가 변경되었습니다. 조직도를 다시 불러와 주세요.');
    if (!(await stat(requested)).isDirectory()) throw fail(400, '프로젝트 폴더가 필요합니다.');
    return canonical(requested);
  }
  const assertActive = async key => { await scope(key); };
  async function load(key) {
    let serialized;
    try { serialized = await readBounded(filename(key)); }
    catch (error) { if (error.code === 'ENOENT') return empty(key); throw fail(503, '조직도 배치를 읽을 수 없습니다. 기존 배치는 보존됩니다.'); }
    try {
      const value = JSON.parse(serialized);
      fields(value, ['version', 'workspace', 'revision', 'updatedAt', 'positions', 'viewport'], 'Invalid stored layout');
      if (value.version !== 1 || value.workspace !== key || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error('Invalid stored metadata');
      return { version: 1, workspace: key, revision: value.revision, updatedAt: value.updatedAt, positions: positions(value.positions), viewport: viewport(value.viewport) };
    } catch { throw fail(503, '조직도 배치 파일이 손상되었습니다. 기존 배치는 보존됩니다.'); }
  }
  function snapshot(value, workspace) {
    const known = knownDepartments();
    return { workspace, revision: value.revision, updatedAt: value.updatedAt, positions: Object.fromEntries(Object.entries(value.positions).filter(([id]) => id === 'owner' || known.has(id.slice(6)))), viewport: structuredClone(value.viewport) };
  }
  async function save(key, value) {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > ORGANIZATION_LAYOUT_LIMITS.bytes) throw fail(413, '조직도 배치 파일의 저장 한도를 초과했습니다.');
    await assertActive(key); await mkdir(directory, { recursive: true }); await assertActive(key);
    const target = filename(key), temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await assertActive(key);
      // Recheck role ownership after asynchronous writes, before publishing the new file.
      positions(value.positions, knownDepartments());
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, target); break; }
        catch (error) { if (!['EPERM', 'EACCES', 'EBUSY', 'EEXIST'].includes(error.code) || attempt >= 4) throw error; await new Promise(resolve => setTimeout(resolve, 20)); await assertActive(key); positions(value.positions, knownDepartments()); }
      }
    } finally { await unlink(temporary).catch(() => {}); }
  }
  async function operation(workspace, callback) {
    const key = await scope(workspace), lock = filename(key), previous = queues.get(lock) || Promise.resolve();
    const result = previous.catch(() => {}).then(async () => { await assertActive(key); const value = await load(key); await assertActive(key); const response = await callback(key, value); await assertActive(key); return snapshot(response, workspace); });
    queues.set(lock, result); try { return await result; } finally { if (queues.get(lock) === result) queues.delete(lock); }
  }
  return Object.freeze({
    get: ({ workspace }) => operation(workspace, async (key, value) => value),
    put: input => {
      try { fields(input, ['workspace', 'revision', 'positions', 'viewport'], '조직도 위치·화면 배치만 저장할 수 있습니다.'); }
      catch (error) { return Promise.reject(error); }
      return operation(input.workspace, async (key, current) => {
        if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw fail(400, '불러온 조직도 revision이 필요합니다.');
        if (input.revision !== current.revision) throw Object.assign(fail(409, '다른 변경으로 조직도 배치가 갱신되었습니다. 다시 불러온 뒤 저장해 주세요.'), { actualRevision: current.revision });
        if (current.revision >= Number.MAX_SAFE_INTEGER) throw fail(409, '조직도 revision 저장 한도에 도달했습니다.');
        const next = { version: 1, workspace: key, revision: current.revision + 1, updatedAt: new Date().toISOString(), positions: positions(input.positions, knownDepartments()), viewport: viewport(input.viewport) };
        await save(key, next); return next;
      });
    },
  });
}
