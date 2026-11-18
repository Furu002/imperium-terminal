import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm, access, copyFile, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { promisify } from 'node:util';
import { reviewWorkspaceChanges } from '../lib/change-review.mjs';

const execute = promisify(execFile);
async function fixture(t, { initial = true } = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'imperium-change-review-')));
  t.after(async () => {
    const relative = path.relative(await realpath(tmpdir()), root);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(root).startsWith('imperium-change-review-'));
    await rm(root, { recursive: true, force: true });
  });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0' });
  const git = (...args) => execute('git', ['--no-pager', '-c', 'core.autocrlf=false', ...args], { cwd: root, env, shell: false, windowsHide: true });
  const put = async (name, text) => { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), text); };
  await git('init', '--initial-branch=main'); await git('config', 'core.autocrlf', 'false');
  const commit = async () => { await git('add', '--', '.'); await git('-c', 'user.name=Change Review Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture'); };
  if (initial) { await put('tracked.txt', 'base value\n'); await commit(); }
  return { root, git, put, commit };
}

test('real staged and unstaged changes remain separate and untracked contents are never included', async t => {
  const f = await fixture(t), calls = [];
  await f.put('tracked.txt', 'staged value\n'); await f.git('add', '--', 'tracked.txt'); await f.put('tracked.txt', 'worktree value\n');
  await f.put('새 비밀.txt', 'UNTRACKED_PRIVATE_CONTENT');
  const beforeIndex = await readFile(path.join(f.root, '.git', 'index'));
  const review = await reviewWorkspaceChanges(f.root, { spawnProcess: (command, args, options) => { calls.push({ command, args, options }); return spawn(command, args, options); } });
  assert.equal(review.available, true); assert.equal(review.workspace, f.root); assert.equal(review.truncated, false); assert.ok(Number.isFinite(Date.parse(review.generatedAt)));
  assert.match(review.diff, /-staged value\n\+worktree value/); assert.match(review.stagedDiff, /-base value\n\+staged value/);
  assert.deepEqual(review.untracked, ['새 비밀.txt']); assert.ok(!JSON.stringify(review).includes('UNTRACKED_PRIVATE_CONTENT'));
  assert.deepEqual(review.files.find(file => file.path === 'tracked.txt'), { path: 'tracked.txt', indexStatus: 'M', worktreeStatus: 'M' });
  assert.match(review.untrackedExplanation, /without reading their contents/); assert.match(review.scopeExplanation, /not attributed to a task or automatically approved/);
  assert.deepEqual(await readFile(path.join(f.root, '.git', 'index')), beforeIndex);
  for (const call of calls) { assert.ok(path.isAbsolute(call.command)); assert.ok(!call.command.toLowerCase().startsWith(f.root.toLowerCase() + path.sep)); assert.equal(call.options.shell, false); assert.equal(call.options.cwd, f.root); assert.equal(call.options.env.GIT_OPTIONAL_LOCKS, '0'); assert.equal(call.options.env.GIT_NO_LAZY_FETCH, '1'); assert.ok(call.args.includes('core.fsmonitor=false')); assert.ok(call.args.includes('--no-pager')); }
  for (const call of calls.filter(call => call.args.includes('diff'))) { for (const flag of ['--no-ext-diff', '--no-textconv', '--ignore-submodules=all']) assert.ok(call.args.includes(flag)); assert.deepEqual(call.args.slice(-2), ['--', '.']); }
});

test('an unborn repository supports empty and staged first-commit review', async t => {
  const f = await fixture(t, { initial: false });
  const empty = await reviewWorkspaceChanges(f.root); assert.equal(empty.available, true); assert.deepEqual(empty.files, []); assert.equal(empty.diff, ''); assert.equal(empty.stagedDiff, '');
  await f.put('first.txt', 'First staged source\n'); await f.git('add', '--', 'first.txt'); await f.put('untracked.txt', 'NOT_READ');
  const review = await reviewWorkspaceChanges(f.root); assert.equal(review.available, true); assert.match(review.stagedDiff, /\+First staged source/); assert.equal(review.diff, ''); assert.deepEqual(review.untracked, ['untracked.txt']);
});

test('NUL status parsing preserves staged renames, spaces and Unicode file names', async t => {
  const f = await fixture(t); await f.put('old 한글 name.txt', 'Keep original contents\n'); await f.commit();
  await f.git('mv', '--', 'old 한글 name.txt', 'renamed 日本語 file.txt');
  const review = await reviewWorkspaceChanges(f.root);
  assert.equal(review.available, true); assert.deepEqual(review.files, [{ path: 'renamed 日本語 file.txt', originalPath: 'old 한글 name.txt', indexStatus: 'R', worktreeStatus: ' ' }]);
  assert.ok(review.stagedDiff.includes('renamed 日本語 file.txt')); assert.ok(!review.stagedDiff.includes('\\346'));
});

test('nested workspace review excludes sibling changes and returns workspace-relative file names', async t => {
  const f = await fixture(t); await f.put('nested/in.txt', 'inside base\n'); await f.put('outside.txt', 'outside base\n'); await f.commit();
  await f.put('nested/in.txt', 'INSIDE_CHANGE\n'); await f.put('outside.txt', 'OUTSIDE_PRIVATE_CHANGE\n'); await f.put('nested/new.txt', 'NOT_READ'); await f.put('outside-new.txt', 'OUTSIDE_UNTRACKED_PRIVATE');
  const review = await reviewWorkspaceChanges(path.join(f.root, 'nested'));
  assert.equal(review.available, true); assert.deepEqual(review.files.map(file => file.path).sort(), ['in.txt', 'new.txt']); assert.deepEqual(review.untracked, ['new.txt']);
  assert.match(review.diff, /INSIDE_CHANGE/); assert.ok(review.diff.includes('a/in.txt')); assert.ok(!JSON.stringify(review).includes('OUTSIDE_')); assert.ok(!JSON.stringify(review.files).includes('nested/'));
});

test('hostile external diff, textconv, fsmonitor and clean/process filters never execute', async t => {
  const f = await fixture(t), helper = path.join(f.root, 'hostile.cjs'), sentinel = path.join(f.root, 'EXECUTED');
  await writeFile(helper, `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'UNSAFE'); process.stdout.write('UNSAFE_EXTERNAL_RESULT');`);
  const command = `"${process.execPath.replaceAll('\\', '/')}" "${helper.replaceAll('\\', '/')}"`;
  for (const key of ['diff.external', 'diff.hostile.command', 'diff.hostile.textconv', 'core.fsmonitor', 'filter.hostile.clean', 'filter.hostile.process']) await f.git('config', key, command);
  await f.git('config', 'filter.hostile.required', 'true');
  await f.put('.gitattributes', 'tracked.txt diff=hostile filter=hostile\n'); await f.put('tracked.txt', 'safe changed value\n');
  const review = await reviewWorkspaceChanges(f.root);
  assert.equal(review.available, true); assert.match(review.diff, /safe changed value/); assert.ok(!JSON.stringify(review).includes('UNSAFE_EXTERNAL_RESULT'));
  await assert.rejects(access(sentinel), { code: 'ENOENT' });
});

test('patch bytes and listed files are bounded, with truncation disclosed and complete Unicode retained', async t => {
  const f = await fixture(t); await f.put('tracked.txt', `${'🙂 한글 source line\n'.repeat(5000)}`);
  for (let index = 0; index < 5; index++) await f.put(`untracked-${index}.txt`, `PRIVATE_${index}`);
  const review = await reviewWorkspaceChanges(f.root, { maxDiffBytes: 139, maxFiles: 2 });
  assert.equal(review.available, true); assert.equal(review.truncated, true); assert.ok(Buffer.byteLength(review.diff) <= 139); assert.ok(!review.diff.includes('\ufffd')); assert.equal(review.files.length, 2); assert.ok(review.untracked.length <= 2); assert.ok(!JSON.stringify(review).includes('PRIVATE_'));
});

test('a directory without Git and an invalid workspace are disclosed honestly', async t => {
  const f = await fixture(t); await mkdir(path.join(f.root, 'nonrepo'));
  // A sibling directory, rather than a child of this repository, is needed here.
  const sibling = await realpath(await mkdtemp(path.join(tmpdir(), 'imperium-change-review-')));
  t.after(async () => { const relative = path.relative(await realpath(tmpdir()), sibling); assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative)); await rm(sibling, { recursive: true, force: true }); });
  assert.equal((await reviewWorkspaceChanges(sibling)).reason, 'not-repository'); assert.equal((await reviewWorkspaceChanges(path.join(sibling, 'missing'))).reason, 'invalid-workspace'); assert.equal((await reviewWorkspaceChanges('')).available, false);
});

function fakeChild() { const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.pid = 12345; child.exitCode = null; child.kills = []; child.kill = signal => { child.kills.push(signal); return true; }; return child; }

test('Git launch errors and command failures return classified, bounded failure results', async t => {
  const f = await fixture(t);
  const missing = await reviewWorkspaceChanges(f.root, { spawnProcess: () => { throw Object.assign(new Error('Missing executable'), { code: 'ENOENT' }); } });
  assert.equal(missing.available, false); assert.equal(missing.reason, 'git-unavailable'); assert.equal(missing.diff, '');
  const failure = await reviewWorkspaceChanges(f.root, { spawnProcess: () => { const child = fakeChild(); queueMicrotask(() => { child.stderr.write('fatal: dubious ownership PRIVATE_ERROR'); child.emit('close', 128); }); return child; } });
  assert.equal(failure.reason, 'git-error'); assert.ok(!JSON.stringify(failure).includes('PRIVATE_ERROR'));
});

test('timeouts stop only the spawned process and Windows tree cleanup uses a numeric PID without a shell', async t => {
  const f = await fixture(t), child = fakeChild(), calls = [];
  const review = await reviewWorkspaceChanges(f.root, { timeoutMs: 10, platform: 'win32', spawnProcess: (command, args, options) => { calls.push({ command, args, options }); return calls.length === 1 ? child : new EventEmitter(); } });
  assert.equal(review.available, false); assert.equal(review.reason, 'timeout'); assert.deepEqual(child.kills, ['SIGKILL']);
  if (process.platform === 'win32') { assert.ok(path.isAbsolute(calls[1].command)); assert.match(calls[1].command.toLowerCase(), /[\\/]system32[\\/]taskkill\.exe$/); assert.deepEqual(calls[1].args, ['/PID', '12345', '/T', '/F']); assert.equal(calls[1].options.shell, false); assert.equal(calls[1].options.windowsHide, true); }
  else assert.equal(calls.length, 1, 'a missing trusted Windows system utility must not fall back to a bare executable');
  child.emit('error', new Error('late failure')); child.emit('close', null);
});

const withPath = value => ({ ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path')), PATH: value });
const actualPath = () => Object.entries(process.env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
async function workspaceGit(directory) {
  const executable = path.join(directory, process.platform === 'win32' ? 'git.exe' : 'git');
  if (process.platform === 'win32') await copyFile(process.execPath, executable);
  else { await writeFile(executable, '#!/bin/sh\necho WORKSPACE_EXECUTABLE_HIJACK\nexit 42\n'); await chmod(executable, 0o755); }
  return executable;
}

test('a real workspace git.exe and relative PATH entries cannot hijack review executable resolution', async t => {
  const f = await fixture(t), malicious = await workspaceGit(f.root), calls = [];
  await f.put('tracked.txt', 'review the real change\n');
  const environment = withPath([f.root, '.', 'relative-bin', '', actualPath()].join(path.delimiter));
  const review = await reviewWorkspaceChanges(f.root, { environment, spawnProcess: (command, args, options) => { calls.push(command); return spawn(command, args, options); } });
  assert.equal(review.available, true); assert.match(review.diff, /review the real change/); assert.ok(!JSON.stringify(review).includes('WORKSPACE_EXECUTABLE_HIJACK'));
  assert.ok(calls.length > 0); assert.ok(calls.every(command => path.isAbsolute(command) && command.toLowerCase() !== malicious.toLowerCase()));
});

test('only a workspace executable or relative PATH means Git is unavailable without launching any process', async t => {
  const f = await fixture(t); await workspaceGit(f.root); let called = false;
  const review = await reviewWorkspaceChanges(f.root, { environment: withPath([f.root, '.', 'relative-bin', ''].join(path.delimiter)), spawnProcess: () => { called = true; throw new Error('must not launch'); } });
  assert.equal(review.available, false); assert.equal(review.reason, 'git-unavailable'); assert.equal(called, false);
});

test('an absolute PATH alias resolving back into the workspace is also excluded', async t => {
  const f = await fixture(t), nested = path.join(f.root, 'reviewed'), alias = path.join(f.root, 'outside-alias');
  await mkdir(nested); await workspaceGit(nested);
  try { await symlink(nested, alias, process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip('Directory symlinks unavailable on this host'); return; } throw error; }
  let called = false; const review = await reviewWorkspaceChanges(nested, { environment: withPath(alias), spawnProcess: () => { called = true; throw new Error('must not launch alias'); } });
  assert.equal(review.reason, 'git-unavailable'); assert.equal(called, false);
});
