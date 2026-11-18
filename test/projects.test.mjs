import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProjectManager, canonicalProjectPath } from '../lib/projects.mjs';

const DEPARTMENTS = [{ id: 'strategy', name: '전략', code: 'STR', provider: 'codex', role: '계획' }];
const hasStatus = status => error => error.status === status;

function fixture(t, extra = {}) {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'imperium-projects-')));
  const workspace = path.join(root, '기존 작업');
  mkdirSync(workspace);
  writeFileSync(path.join(workspace, 'keep.txt'), 'user data');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = { settings: { workspace }, departments: structuredClone(DEPARTMENTS), tasks: [], ...extra };
  const store = { saves: 0, save() { this.saves++; } };
  return { root, workspace, state, store, manager: createProjectManager({ state, store }) };
}

test('existing workspace is lazily registered without touching its contents', t => {
  const { manager, state, workspace, store } = fixture(t);
  assert.equal(state.projects, undefined);
  const before = readdirSync(workspace);
  const result = manager.list();
  assert.equal(result.projects.length, 1);
  const [project] = result.projects;
  assert.equal(result.currentProjectId, project.id);
  assert.equal(project.workspace, workspace);
  assert.equal(project.current, true);
  assert.equal(project.departmentCount, 1);
  assert.equal('departments' in project, false, 'list returns summaries only');
  assert.deepEqual(state.projects[0].departments, DEPARTMENTS);
  assert.deepEqual(readdirSync(workspace), before);
  assert.ok(store.saves >= 1);
  assert.equal(manager.list().projects.length, 1, 'registration is idempotent');
});

test('create makes a real Unicode folder under the default parent without switching', async t => {
  const { manager, state, workspace, root } = fixture(t);
  const project = await manager.create({ name: '한글 プロジェクト 🚀', color: '#12abef' });
  const parent = path.join(root, 'Imperium Projects');
  assert.equal(path.dirname(project.workspace), realpathSync.native(parent));
  assert.ok(statSync(project.workspace).isDirectory());
  assert.ok(path.basename(project.workspace).startsWith('한글 プロジェクト 🚀-'));
  assert.equal(project.color, '#12ABEF');
  assert.equal(project.current, false);
  assert.equal(state.settings.workspace, workspace, 'create never auto-switches');
  assert.deepEqual(state.departments, DEPARTMENTS);
  assert.deepEqual(state.projects.find(item => item.id === project.id).departments, []);
});

test('names, colors and parents are validated strictly', async t => {
  const { manager, root, state } = fixture(t);
  const badNames = ['', '   ', '../x', 'a/b', 'a\\b', 'C:x', 'CON', 'con.txt', 'Lpt1', 'x\u0001y', '.', '..', 'name.', 'a'.repeat(81), 'x‮y', 42];
  for (const name of badNames) await assert.rejects(manager.create({ name, color: '#000000' }), hasStatus(400), `name ${JSON.stringify(name)}`);
  for (const color of ['#fff', 'red', '#GGGGGG', '000000', ' #000000']) await assert.rejects(manager.create({ name: 'ok', color }), hasStatus(400), `color ${color}`);
  const file = path.join(root, 'file.txt'); writeFileSync(file, 'x');
  for (const parentDir of ['relative/dir', path.join(root, 'missing'), file]) await assert.rejects(manager.create({ name: 'ok', color: '#000000', parentDir }), hasStatus(400));
  assert.equal(state.projects.length, 1, 'nothing registered after failures');
  assert.equal(existsSync(path.join(root, 'missing')), false);
  const max = await manager.create({ name: '가'.repeat(80), color: '#000000' });
  assert.equal(max.name.length, 80);
});

test('explicit parent is scoped and existing folders are never overwritten', async t => {
  const { manager, root } = fixture(t);
  const parent = path.join(root, 'chosen');
  mkdirSync(path.join(parent, 'Alpha'), { recursive: true });
  writeFileSync(path.join(parent, 'Alpha', 'mine.txt'), 'original');
  const project = await manager.create({ name: 'Alpha', color: '#ABCDEF', parentDir: parent });
  assert.equal(path.dirname(project.workspace), realpathSync.native(parent));
  assert.notEqual(path.basename(project.workspace), 'Alpha');
  assert.deepEqual(readdirSync(project.workspace), []);
  assert.equal(readFileSync(path.join(parent, 'Alpha', 'mine.txt'), 'utf8'), 'original');
  const relative = path.relative(realpathSync.native(parent), project.workspace);
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative));
});

test('defaultParent option overrides the computed parent', async t => {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'imperium-projects-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'ws'); mkdirSync(workspace);
  const defaultParent = path.join(root, 'custom', 'nested');
  const manager = createProjectManager({ state: { settings: { workspace }, departments: [], tasks: [] }, store: { save() {} }, defaultParent });
  const project = await manager.create({ name: 'Beta' });
  assert.equal(path.dirname(project.workspace), realpathSync.native(defaultParent));
  assert.equal(project.color, '#C48A5A');
});

test('update changes metadata only and leaves the folder untouched', async t => {
  const { manager } = fixture(t);
  const project = await manager.create({ name: 'Gamma', color: '#111111' });
  writeFileSync(path.join(project.workspace, 'notes.md'), 'x');
  const updated = manager.update(project.id, { name: '감마 Renamed', color: '#222222' });
  assert.equal(updated.name, '감마 Renamed');
  assert.equal(updated.color, '#222222');
  assert.equal(updated.workspace, project.workspace);
  assert.deepEqual(readdirSync(project.workspace), ['notes.md']);
  assert.equal(manager.update(project.id, { color: '#333333' }).name, '감마 Renamed');
  assert.throws(() => manager.update(project.id, {}), hasStatus(400));
  assert.throws(() => manager.update(project.id, { name: '../x' }), hasStatus(400));
  assert.throws(() => manager.update('00000000-0000-4000-8000-000000000000', { name: 'x' }), hasStatus(404));
  assert.throws(() => manager.update('../etc', { name: 'x' }), hasStatus(400));
});

test('select is denied while tasks are queued or running', async t => {
  const { manager, state, workspace } = fixture(t);
  const project = await manager.create({ name: 'Delta', color: '#444444' });
  for (const status of ['queued', 'running']) {
    state.tasks = [{ id: 't', status }];
    await assert.rejects(manager.select(project.id), hasStatus(409));
    assert.equal(state.settings.workspace, workspace);
    assert.deepEqual(state.departments, DEPARTMENTS);
  }
  state.tasks = [{ id: 't', status: 'completed' }];
  assert.equal((await manager.select(project.id)).current, true);
  await assert.rejects(manager.select('ffffffff-ffff-4fff-8fff-ffffffffffff'), hasStatus(404));
});

test('department definitions are snapshotted and restored per project', async t => {
  const { manager, state, workspace } = fixture(t);
  const home = manager.list().currentProjectId;
  const other = await manager.create({ name: 'Epsilon', color: '#555555' });
  await manager.select(other.id);
  assert.equal(state.settings.workspace, other.workspace);
  assert.deepEqual(state.departments, [], 'new project starts with no departments');
  assert.equal(manager.list().currentProjectId, other.id);
  state.departments.push({ id: 'design', name: '디자인', code: 'DSN', provider: 'claude', role: '자유 라벨' });
  await manager.select(home);
  assert.equal(state.settings.workspace, workspace);
  assert.deepEqual(state.departments, DEPARTMENTS);
  state.departments[0].name = 'mutated';
  await manager.select(other.id);
  assert.deepEqual(state.departments.map(item => item.id), ['design']);
  await manager.select(home);
  assert.equal(state.departments[0].name, 'mutated');
  assert.equal((await manager.select(home)).current, true, 'selecting the current project is a no-op');
});

test('registry survives a persisted restart and legacy state without projects', async t => {
  const { manager, state, store } = fixture(t);
  const other = await manager.create({ name: 'Zeta', color: '#666666' });
  await manager.select(other.id);
  const restored = JSON.parse(JSON.stringify(state));
  const again = createProjectManager({ state: restored, store });
  const listed = again.list();
  assert.equal(listed.currentProjectId, other.id);
  assert.equal(listed.projects.length, 2);
  assert.deepEqual(restored.departments, []);
  const legacy = { settings: { workspace: state.projects[0].workspace }, departments: DEPARTMENTS, tasks: [], projects: [null, { id: 'bad id', workspace: 'relative' }] };
  const legacyManager = createProjectManager({ state: legacy, store: {} });
  assert.equal(legacyManager.list().projects.length, 1);
});

test('canonical workspace comparison is case-insensitive on Windows', { skip: process.platform !== 'win32' }, t => {
  const { manager, state, workspace } = fixture(t);
  const id = manager.list().currentProjectId;
  state.settings.workspace = workspace.toUpperCase();
  assert.equal(canonicalProjectPath(workspace), canonicalProjectPath(workspace.toUpperCase()));
  assert.equal(manager.list().currentProjectId, id);
  assert.equal(state.projects.length, 1);
});

test('frontend module avoids innerHTML, external resources and model/installer actions', () => {
  const script = readFileSync(new URL('../public/projects.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/projects.css', import.meta.url), 'utf8');
  assert.match(script, /window\.ImperiumProjects\s*=\s*\{\s*mount,\s*render,\s*reload\s*\}/);
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
  assert.doesNotMatch(script + css, /https?:\/\//);
  assert.doesNotMatch(script, /\/api\/(providers|tasks|install|run)/);
  for (const route of ["'/api/projects'", '/select`', "'PATCH'"]) assert.ok(script.includes(route), route);
  for (const key of ['en:', 'ja:', 'LOCAL ONLY', '모델 가중치를 학습시키지 않습니다']) assert.ok(script.includes(key), key);
});
