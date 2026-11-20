import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOrganizationLayout, ORGANIZATION_LAYOUT_LIMITS } from '../lib/organization-layout.mjs';

const positions = () => ({ owner: { x: 120, y: 20 }, 'agent:engineering': { x: 300.25, y: 400.75 } });
const viewport = () => ({ pan: { x: -100, y: 80 }, zoom: 0.75 });
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);
async function fixture(t, options = {}) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'imperium-organization-layout-'));
  const workspace = path.join(base, 'project 한글'), other = path.join(base, 'other'), dataDir = path.join(base, 'data');
  await Promise.all([workspace, other, dataDir].map(value => mkdir(value))); t.after(() => rm(base, { recursive: true, force: true }));
  let active = workspace; const roles = [{ id: 'engineering' }, { id: 'quality' }];
  const create = () => createOrganizationLayout({ dataDir, getWorkspace: options.getWorkspace || (() => active), getDepartments: () => roles });
  return { base, workspace, other, dataDir, roles, create, store: create(), switch(value) { active = value; } };
}

test('empty layouts remain empty without creating files or changing workspace contents', async t => {
  const f = await fixture(t), result = await f.store.get({ workspace: f.workspace });
  assert.deepEqual(result, { workspace: f.workspace, revision: 0, updatedAt: null, positions: {}, viewport: { pan: { x: 0, y: 0 }, zoom: 1 } });
  assert.deepEqual(await readdir(f.workspace), []); assert.deepEqual(await readdir(f.dataDir), []);
});

test('persists only owner, role positions and viewport in a hash-named sidecar', async t => {
  const f = await fixture(t);
  const result = await f.store.put({ workspace: f.workspace, revision: 0, positions: positions(), viewport: viewport() });
  assert.equal(result.revision, 1); assert.ok(Number.isFinite(Date.parse(result.updatedAt))); assert.deepEqual(result.positions, positions()); assert.deepEqual(result.viewport, viewport());
  assert.deepEqual(await f.create().get({ workspace: f.workspace }), result);
  const names = await readdir(path.join(f.dataDir, 'organization-layout')); assert.equal(names.length, 1); assert.match(names[0], /^[a-f0-9]{64}\.json$/);
  const saved = JSON.parse(await readFile(path.join(f.dataDir, 'organization-layout', names[0]), 'utf8')); assert.deepEqual(Object.keys(saved).sort(), ['positions', 'revision', 'updatedAt', 'version', 'viewport', 'workspace']); assert.deepEqual(f.roles, [{ id: 'engineering' }, { id: 'quality' }]); assert.deepEqual(await readdir(f.workspace), []);
});

test('revision CAS rejects stale and simultaneous writes without losing the successful layout', async t => {
  const f = await fixture(t), otherInstance = f.create();
  const inputs = [{ ...positions(), owner: { x: 1, y: 2 } }, { ...positions(), owner: { x: 9, y: 10 } }];
  const results = await Promise.allSettled([f.store, otherInstance].map((store, index) => store.put({ workspace: f.workspace, revision: 0, positions: inputs[index], viewport: viewport() })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); const rejected = results.find(result => result.status === 'rejected'); assert.equal(rejected.reason.status, 409); assert.equal(rejected.reason.actualRevision, 1);
  const current = await f.store.get({ workspace: f.workspace }); assert.equal(current.revision, 1); assert.deepEqual(current.positions, results.find(result => result.status === 'fulfilled').value.positions);
  await rejects(f.store.put({ workspace: f.workspace, revision: 0, positions: {}, viewport: viewport() }), 409); assert.deepEqual(await f.store.get({ workspace: f.workspace }), current);
  assert.equal((await f.store.put({ workspace: f.workspace, revision: 1, positions: {}, viewport: viewport() })).revision, 2);
});

test('active project scope isolates identical role IDs and rejects access to inactive projects', async t => {
  const f = await fixture(t); await f.store.put({ workspace: f.workspace, revision: 0, positions: positions(), viewport: viewport() });
  f.switch(f.other); await rejects(f.store.get({ workspace: f.workspace }), 409); await rejects(f.store.put({ workspace: f.workspace, revision: 1, positions: {}, viewport: viewport() }), 409);
  assert.deepEqual((await f.store.get({ workspace: f.other })).positions, {});
  await f.store.put({ workspace: f.other, revision: 0, positions: { 'agent:engineering': { x: 900, y: 1000 } }, viewport: viewport() });
  f.switch(f.workspace); assert.deepEqual((await f.store.get({ workspace: f.workspace })).positions, positions());
});

test('rejects workflow content, unsupported node kinds and roles not owned by the project', async t => {
  const f = await fixture(t), input = { workspace: f.workspace, revision: 0, positions: positions(), viewport: viewport() };
  for (const extra of [{ edges: [] }, { nodes: [] }, { provider: 'codex' }, { graph: { nodes: [], edges: [] } }]) await rejects(f.store.put({ ...input, ...extra }), 400);
  for (const id of ['provider:codex', 'commander', 'memory:note', 'agent:other-project-agent']) await rejects(f.store.put({ ...input, positions: { [id]: { x: 0, y: 0 } } }), 400);
  await rejects(f.store.put({ ...input, positions: JSON.parse('{"__proto__":{"x":0,"y":0}}') }), 400);
  assert.equal((await f.store.get({ workspace: f.workspace })).revision, 0);
});

test('validates finite bounded coordinates, zoom, required revision and narrow geometry fields', async t => {
  const f = await fixture(t), input = { workspace: f.workspace, revision: 0, positions: positions(), viewport: viewport() };
  for (const x of [Infinity, -Infinity, NaN, '1', 100001, -100001]) await rejects(f.store.put({ ...input, positions: { owner: { x, y: 0 } } }), 400);
  for (const zoom of [0.149, 3.001, NaN, '1']) await rejects(f.store.put({ ...input, viewport: { pan: { x: 0, y: 0 }, zoom } }), 400);
  for (const revision of [undefined, -1, 0.1, '0']) await rejects(f.store.put({ ...input, revision }), 400);
  await rejects(f.store.put({ ...input, positions: { owner: { x: 0, y: 0, title: 'Not position data' } } }), 400);
  await rejects(f.store.put({ ...input, viewport: { ...viewport(), taskId: 'No task data' } }), 400);
  const result = await f.store.put({ ...input, positions: { owner: { x: -100000, y: 100000 } }, viewport: { pan: { x: -100000, y: 100000 }, zoom: 0.15 } }); assert.equal(result.viewport.zoom, ORGANIZATION_LAYOUT_LIMITS.minZoom);
});

test('deleted roles are filtered from reads and later full replacement keeps live roles and owner', async t => {
  const f = await fixture(t), initial = { ...positions(), 'agent:quality': { x: 600, y: 400 } };
  await f.store.put({ workspace: f.workspace, revision: 0, positions: initial, viewport: viewport() }); f.roles.splice(0, 1);
  const loaded = await f.store.get({ workspace: f.workspace }); assert.equal('agent:engineering' in loaded.positions, false); assert.deepEqual(loaded.positions.owner, initial.owner); assert.deepEqual(loaded.positions['agent:quality'], initial['agent:quality']);
  const result = await f.store.put({ workspace: f.workspace, revision: loaded.revision, positions: loaded.positions, viewport: loaded.viewport }); assert.equal(result.revision, 2);
  const [name] = await readdir(path.join(f.dataDir, 'organization-layout')); assert.ok(!(await readFile(path.join(f.dataDir, 'organization-layout', name), 'utf8')).includes('agent:engineering'));
});

test('corrupt and oversized sidecars fail explicitly and remain unchanged', async t => {
  const f = await fixture(t); await f.store.put({ workspace: f.workspace, revision: 0, positions: positions(), viewport: viewport() });
  const [name] = await readdir(path.join(f.dataDir, 'organization-layout')), target = path.join(f.dataDir, 'organization-layout', name);
  for (const bad of ['{broken', 'x'.repeat(ORGANIZATION_LAYOUT_LIMITS.bytes + 1)]) {
    await writeFile(target, bad); await rejects(f.store.get({ workspace: f.workspace }), 503); await rejects(f.store.put({ workspace: f.workspace, revision: 1, positions: {}, viewport: viewport() }), 503); assert.equal(await readFile(target, 'utf8'), bad);
  }
});

test('a project switch during an asynchronous operation prevents publication of a new sidecar', async t => {
  let active, other, calls = 0;
  const f = await fixture(t, { getWorkspace: () => { const result = active; if (++calls === 2) active = other; return result; } }); active = f.workspace; other = f.other;
  await rejects(f.store.put({ workspace: f.workspace, revision: 0, positions: positions(), viewport: viewport() }), 409); assert.deepEqual(await readdir(f.dataDir), []);
});

test('an approved workspace alias shares the canonical sidecar while preserving public response scope', async t => {
  const f = await fixture(t), alias = path.join(f.base, 'alias'); await symlink(f.workspace, alias, process.platform === 'win32' ? 'junction' : 'dir'); f.switch(alias);
  const first = await f.store.put({ workspace: alias, revision: 0, positions: positions(), viewport: viewport() }); assert.equal(first.workspace, alias);
  f.switch(f.workspace); const actual = await f.store.get({ workspace: f.workspace }); assert.equal(actual.revision, 1); assert.deepEqual(actual.positions, positions()); assert.equal((await readdir(path.join(f.dataDir, 'organization-layout'))).length, 1);
});

test('limits presentation nodes to owner plus 500 agents and cleans temporary files after saves', async t => {
  const f = await fixture(t), many = { owner: { x: 0, y: 0 } }; f.roles.length = 0;
  for (let index = 0; index < 500; index++) { const id = `role-${index}`; f.roles.push({ id }); many[`agent:${id}`] = { x: index, y: index }; }
  await f.store.put({ workspace: f.workspace, revision: 0, positions: many, viewport: viewport() }); f.roles.push({ id: 'extra' });
  await rejects(f.store.put({ workspace: f.workspace, revision: 1, positions: { ...many, 'agent:extra': { x: 0, y: 0 } }, viewport: viewport() }), 400);
  const withoutOwner = { ...many, 'agent:extra': { x: 0, y: 0 } }; delete withoutOwner.owner;
  await rejects(f.store.put({ workspace: f.workspace, revision: 1, positions: withoutOwner, viewport: viewport() }), 400);
  assert.ok((await readdir(path.join(f.dataDir, 'organization-layout'))).every(name => name.endsWith('.json')));
});
