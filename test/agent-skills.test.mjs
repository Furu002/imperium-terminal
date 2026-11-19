import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgentSkills, SKILL_FILE_LIMIT, AGENT_SKILL_BUDGET } from '../lib/agent-skills.mjs';

async function fixture(t, options = {}) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'imperium-agent-skills-'));
  const workspace = path.join(base, 'project'), other = path.join(base, 'other'), dataDir = path.join(base, 'data');
  await Promise.all([workspace, other, dataDir].map(value => mkdir(value)));
  t.after(() => rm(base, { recursive: true, force: true }));
  let active = workspace; const roles = [{ id: 'engineering' }, { id: 'quality' }];
  const create = () => createAgentSkills({ dataDir, getWorkspace: options.getWorkspace || (() => active), getDepartments: () => roles });
  const store = create();
  const file = async (name, content = '---\nname: Code review\ndescription: Review actual source\n---\nCheck the selected project.') => {
    const relative = path.join('skills', name, 'SKILL.md'); await mkdir(path.dirname(path.join(active, relative)), { recursive: true }); await writeFile(path.join(active, relative), content); return relative;
  };
  return { base, workspace, other, dataDir, store, create, file, roles, switch(value) { active = value; }, get active() { return active; } };
}
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);

test('registers local pinned metadata, persists equipment separately and injects only explicitly equipped content', async t => {
  const f = await fixture(t), relative = await f.file('review');
  const result = await f.store.register({ workspace: f.workspace, path: relative, originUrl: 'https://github.com/example/skills/tree/main/review' });
  assert.equal(result.skill.name, 'Code review'); assert.equal(result.skill.source, 'local'); assert.equal(result.skill.license, 'unverified'); assert.equal(result.skill.originVerification, 'user-supplied-unverified'); assert.equal(result.skill.usage, 'not-observed'); assert.match(result.skill.sha256, /^[a-f0-9]{64}$/); assert.equal('content' in result.skill, false);
  const unbound = await f.store.getForAgent({ workspace: f.workspace, departmentId: 'engineering' }); assert.equal(unbound.prompt, ''); assert.deepEqual(unbound.skills, []);
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [result.skill.id] });
  const equipped = await f.create().getForAgent({ workspace: f.workspace, departmentId: 'engineering' });
  assert.match(equipped.prompt, /Check the selected project/); assert.match(equipped.prompt, /실행 권한/); assert.equal(equipped.skills[0].sha256, result.skill.sha256); assert.equal(equipped.bytes, Buffer.byteLength(equipped.prompt)); assert.ok(equipped.bytes <= AGENT_SKILL_BUDGET);
  assert.deepEqual(f.roles, [{ id: 'engineering' }, { id: 'quality' }]);
  const [name] = await readdir(path.join(f.dataDir, 'agent-skills')); const persisted = await readFile(path.join(f.dataDir, 'agent-skills', name), 'utf8'); assert.ok(!persisted.includes('Check the selected project'));
  const preview = await f.store.get({ workspace: f.workspace, id: result.skill.id }); assert.match(preview.skill.content, /Check the selected project/);
});

test('active workspace and identical agent IDs stay isolated across projects', async t => {
  const f = await fixture(t), relative = await f.file('one'), result = await f.store.register({ workspace: f.workspace, path: relative });
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [result.skill.id] });
  f.switch(f.other); await rejects(f.store.list({ workspace: f.workspace }), 409);
  assert.deepEqual((await f.store.list({ workspace: f.other })).skills, []);
  await rejects(f.store.setBindings({ workspace: f.other, departmentId: 'engineering', skillIds: [result.skill.id] }), 400);
  f.switch(f.workspace); assert.equal((await f.store.list({ workspace: f.workspace })).bindings.engineering[0], result.skill.id);
});

test('rejects traversal, outside absolute files, non-SKILL names and symlink escapes', async t => {
  const f = await fixture(t); await writeFile(path.join(f.other, 'SKILL.md'), 'Outside secret'); await writeFile(path.join(f.workspace, 'note.md'), 'Not a skill');
  await rejects(f.store.register({ workspace: f.workspace, path: '../other/SKILL.md' }), 400);
  await rejects(f.store.register({ workspace: f.workspace, path: path.join(f.other, 'SKILL.md') }), 400);
  await rejects(f.store.register({ workspace: f.workspace, path: 'note.md' }), 400);
  await symlink(f.other, path.join(f.workspace, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await rejects(f.store.register({ workspace: f.workspace, path: 'escape/SKILL.md' }), 403);
  assert.deepEqual((await f.store.list({ workspace: f.workspace })).skills, []);
});

test('enforces 32 KiB byte cap and rejects invalid UTF-8 and binary content', async t => {
  const f = await fixture(t);
  await rejects(f.store.register({ workspace: f.workspace, path: await f.file('large', 'a'.repeat(SKILL_FILE_LIMIT + 1)) }), 413);
  await rejects(f.store.register({ workspace: f.workspace, path: await f.file('utf8', Buffer.from([0xc3, 0x28])) }), 400);
  await rejects(f.store.register({ workspace: f.workspace, path: await f.file('binary', 'text\0binary') }), 400);
  const exact = await f.store.register({ workspace: f.workspace, path: await f.file('exact', 'a'.repeat(SKILL_FILE_LIMIT)) }); assert.equal(exact.skill.bytes, SKILL_FILE_LIMIT);
  await rejects(f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [exact.skill.id] }), 413);
});

test('combined instruction budget includes Unicode bytes and prompt metadata without silent truncation', async t => {
  const f = await fixture(t), a = await f.store.register({ workspace: f.workspace, path: await f.file('one', '한'.repeat(2200)) }), b = await f.store.register({ workspace: f.workspace, path: await f.file('two', '일'.repeat(3500)) });
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [a.skill.id] });
  await rejects(f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [a.skill.id, b.skill.id] }), 413);
  assert.deepEqual((await f.store.list({ workspace: f.workspace })).bindings.engineering, [a.skill.id]);
});

test('changed, deleted or redirected equipped files fail closed at preview and execution', async t => {
  const f = await fixture(t), relative = await f.file('review'), registration = await f.store.register({ workspace: f.workspace, path: relative });
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [registration.skill.id] });
  await writeFile(path.join(f.workspace, relative), 'Changed instructions');
  await rejects(f.store.get({ workspace: f.workspace, id: registration.skill.id }), 409);
  await rejects(f.store.getForAgent({ workspace: f.workspace, departmentId: 'engineering' }), 409);
  await rejects(f.store.register({ workspace: f.workspace, path: relative }), 409);
  await rm(path.join(f.workspace, relative)); await rejects(f.store.getForAgent({ workspace: f.workspace, departmentId: 'engineering' }), 404);
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [] }); assert.equal((await f.store.getForAgent({ workspace: f.workspace, departmentId: 'engineering' })).prompt, '');
});

test('deleting a registration unequips every role and retains the original file', async t => {
  const f = await fixture(t), relative = await f.file('review'), { skill } = await f.store.register({ workspace: f.workspace, path: relative });
  for (const departmentId of ['engineering', 'quality']) await f.store.setBindings({ workspace: f.workspace, departmentId, skillIds: [skill.id] });
  const result = await f.store.remove({ workspace: f.workspace, id: skill.id }); assert.deepEqual(result.skills, []); assert.deepEqual(result.bindings, {}); assert.match(await readFile(path.join(f.workspace, relative), 'utf8'), /Check the selected project/);
});

test('validates current agent ownership, registered skill IDs and duplicate bindings', async t => {
  const f = await fixture(t), { skill } = await f.store.register({ workspace: f.workspace, path: await f.file('one') });
  await rejects(f.store.setBindings({ workspace: f.workspace, departmentId: 'foreign-agent', skillIds: [skill.id] }), 404);
  await rejects(f.store.getForAgent({ workspace: f.workspace, departmentId: 'foreign-agent' }), 404);
  await rejects(f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: ['foreign-id'] }), 400);
  await rejects(f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [skill.id, skill.id] }), 400);
});

test('serializes simultaneous registrations and never overwrites a corrupt catalog', async t => {
  const f = await fixture(t), a = await f.file('one'), b = await f.file('two');
  const registrations = await Promise.all([a, b, a].map(input => f.store.register({ workspace: f.workspace, path: input })));
  assert.equal(registrations[0].skill.id, registrations[2].skill.id); assert.equal((await f.store.list({ workspace: f.workspace })).skills.length, 2);
  const [name] = await readdir(path.join(f.dataDir, 'agent-skills')), target = path.join(f.dataDir, 'agent-skills', name); await writeFile(target, '{broken');
  await rejects(f.store.list({ workspace: f.workspace }), 503); await rejects(f.store.register({ workspace: f.workspace, path: a }), 503); assert.equal(await readFile(target, 'utf8'), '{broken');
});

test('source URL stays unverified metadata and rejects credentials, query secrets and non-GitHub URLs', async t => {
  const f = await fixture(t), relative = await f.file('one');
  for (const originUrl of ['https://user:secret@github.com/owner/repo', 'https://github.com/owner/repo?token=secret', 'https://example.com/owner/repo', 'file:///etc/passwd', 'https://github.com/']) await rejects(f.store.register({ workspace: f.workspace, path: relative, originUrl }), 400);
  assert.equal((await f.store.register({ workspace: f.workspace, path: relative })).skill.originVerification, 'not-provided');
});

test('a project switch during asynchronous registration prevents sidecar mutation', async t => {
  let active, other, calls = 0;
  const f = await fixture(t, { getWorkspace: () => { const result = active; if (++calls === 2) active = other; return result; } }); active = f.workspace; other = f.other;
  const relative = await f.file('one'); await rejects(f.store.register({ workspace: f.workspace, path: relative }), 409);
  const files = await readdir(f.dataDir); assert.deepEqual(files, []);
});

test('an approved workspace symlink alias remains the public response scope', async t => {
  const f = await fixture(t), alias = path.join(f.base, 'alias'); await symlink(f.workspace, alias, process.platform === 'win32' ? 'junction' : 'dir'); f.switch(alias);
  const result = await f.store.register({ workspace: alias, path: await f.file('one') }); assert.equal(result.workspace, alias);
  assert.equal((await f.store.list({ workspace: alias })).workspace, alias);
});

test('prunes more than 500 retired agent bindings before capacity checks and preserves catalog and live equipment', async t => {
  const f = await fixture(t), relative = await f.file('one'), { skill } = await f.store.register({ workspace: f.workspace, path: relative });
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [skill.id] });
  const [name] = await readdir(path.join(f.dataDir, 'agent-skills')), target = path.join(f.dataDir, 'agent-skills', name);
  const persisted = JSON.parse(await readFile(target, 'utf8')), skillsBefore = structuredClone(persisted.skills);
  for (let index = 0; index < 600; index++) persisted.bindings[`retired-${index}`] = [skill.id];
  await writeFile(target, JSON.stringify(persisted));
  const visible = await f.store.list({ workspace: f.workspace }); assert.deepEqual(visible.bindings, { engineering: [skill.id] }); assert.equal(visible.skills.length, 1);
  assert.equal((await f.store.getForAgent({ workspace: f.workspace, departmentId: 'engineering' })).skills[0].sha256, skill.sha256);
  await rejects(f.store.getForAgent({ workspace: f.workspace, departmentId: 'retired-0' }), 404);
  const pruned = await f.store.prune({ workspace: f.workspace }); assert.equal(pruned.prunedBindings, 600); assert.equal(pruned.revision, persisted.revision + 1);
  const after = JSON.parse(await readFile(target, 'utf8')); assert.deepEqual(after.bindings, { engineering: [skill.id] }); assert.deepEqual(after.skills, skillsBefore); assert.match(await readFile(path.join(f.workspace, relative), 'utf8'), /Check the selected project/);
  const again = await f.store.prune({ workspace: f.workspace }); assert.equal(again.prunedBindings, 0); assert.equal(again.revision, pruned.revision);
});

test('repeated agent equipment and removal cannot accumulate orphan bindings in later mutations', async t => {
  const f = await fixture(t), { skill } = await f.store.register({ workspace: f.workspace, path: await f.file('one') });
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'engineering', skillIds: [skill.id] });
  const [name] = await readdir(path.join(f.dataDir, 'agent-skills')), target = path.join(f.dataDir, 'agent-skills', name);
  for (let index = 0; index < 20; index++) {
    const id = `temporary-${index}`; f.roles.push({ id });
    await f.store.setBindings({ workspace: f.workspace, departmentId: id, skillIds: [skill.id] });
    const persisted = JSON.parse(await readFile(target, 'utf8')); assert.equal(Object.keys(persisted.bindings).length, 2); assert.deepEqual(persisted.bindings.engineering, [skill.id]);
    f.roles.pop();
  }
  await f.store.setBindings({ workspace: f.workspace, departmentId: 'quality', skillIds: [skill.id] });
  const persisted = JSON.parse(await readFile(target, 'utf8')); assert.deepEqual(persisted.bindings, { engineering: [skill.id], quality: [skill.id] }); assert.equal(persisted.skills[0].sha256, skill.sha256);
});
