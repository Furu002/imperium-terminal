import { spawn } from 'node:child_process';
import { access, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { devNull } from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

const BASE = ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.quotePath=false'];
const DIFF = ['--no-ext-diff', '--no-textconv', '--ignore-submodules=all', '--no-color', '--relative'];
const clamp = (value, fallback, max) => Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value))) : fallback;

const envValue = (environment, name) => Object.entries(environment).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
function contained(workspace, candidate) {
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const relative = path.relative(normalize(workspace), normalize(candidate));
  if (!relative) return true;
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function trustedExecutable(candidate, workspace) {
  try {
    const resolved = await realpath(candidate);
    if (contained(workspace, resolved) || !(await stat(resolved)).isFile()) return null;
    await access(resolved, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return resolved;
  } catch { return null; }
}
async function resolveGit(workspace, environment) {
  const entries = String(envValue(environment, 'PATH') || '').split(path.delimiter);
  for (let entry of entries) {
    if (entry.startsWith('"') && entry.endsWith('"')) entry = entry.slice(1, -1);
    // Never let Win32's current-directory search, relative PATH entries or a
    // symlink back into the reviewed workspace select the program to execute.
    if (!entry || !path.isAbsolute(entry)) continue;
    try { const directory = await realpath(entry); if (contained(workspace, directory)) continue; } catch { continue; }
    const executable = await trustedExecutable(path.join(entry, process.platform === 'win32' ? 'git.exe' : 'git'), workspace);
    if (executable) return executable;
  }
  return null;
}

function stop(child, spawnProcess, platform, killCommand) {
  if (!child || child.exitCode !== null && child.exitCode !== undefined) return;
  if (platform === 'win32' && killCommand && Number.isInteger(child.pid) && child.pid > 0) {
    try { const killer = spawnProcess(killCommand, ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' }); killer.on('error', () => {}); } catch {}
  }
  try { child.kill('SIGKILL'); } catch {}
}

function capture(args, { cwd, env, spawnProcess, platform, timeoutMs, maxBytes, gitCommand, killCommand }) {
  return new Promise(resolve => {
    let child, timer, settled = false, stopping = false, stopReason, stopTruncated = false, size = 0, stderrSize = 0;
    const chunks = [], errors = [];
    const finish = (code, reason, truncated = false) => {
      if (settled) return; settled = true; clearTimeout(timer);
      const decoder = new StringDecoder('utf8'), buffer = Buffer.concat(chunks);
      resolve({ code, reason, truncated, stdout: decoder.write(buffer) + (truncated ? '' : decoder.end()), stderr: Buffer.concat(errors).toString('utf8') });
    };
    const terminate = (reason, truncated = false) => {
      if (settled || stopping) return; stopping = true; stopReason = reason; stopTruncated = truncated;
      clearTimeout(timer);
      // Wait for the owned Git process to close before releasing its workspace.
      timer = setTimeout(() => finish(truncated ? 0 : null, reason, truncated), 1000);
      stop(child, spawnProcess, platform, killCommand);
    };
    try {
      child = spawnProcess(gitCommand, [...BASE, ...args], { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', value => {
        if (settled || stopping) return;
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value), remaining = maxBytes - size;
        if (remaining > 0) { const part = bytes.subarray(0, remaining); chunks.push(part); size += part.length; }
        if (bytes.length > remaining) terminate(undefined, true);
      });
      child.stderr.on('data', value => { if (settled || stderrSize >= 4096) return; const bytes = Buffer.from(value).subarray(0, 4096 - stderrSize); errors.push(bytes); stderrSize += bytes.length; });
      child.on('error', error => finish(stopping && stopTruncated ? 0 : null, stopping ? stopReason : error.code === 'ENOENT' ? 'git-unavailable' : 'git-error', stopTruncated));
      child.on('close', code => finish(stopping && stopTruncated ? 0 : code, stopReason, stopTruncated));
      timer = setTimeout(() => terminate('timeout'), timeoutMs);
    } catch (error) { finish(null, error.code === 'ENOENT' ? 'git-unavailable' : 'git-error'); }
  });
}

function failure(result) {
  if (result.reason) return result.reason;
  if (result.code === 0) return null;
  return /not a git repository|must be run in a work tree/i.test(result.stderr) ? 'not-repository' : 'git-error';
}

function parseStatus(text, prefix, maxFiles) {
  const records = text.split('\0'), files = [], untracked = [];
  let truncated = Boolean(records.pop());
  const scoped = name => prefix ? name.startsWith(prefix) ? name.slice(prefix.length) : null : name;
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (record.length < 4 || record[2] !== ' ') { truncated = true; continue; }
    const indexStatus = record[0], worktreeStatus = record[1], name = scoped(record.slice(3));
    let originalPath;
    if (/[RC]/.test(indexStatus + worktreeStatus)) { if (index + 1 >= records.length) { truncated = true; break; } originalPath = scoped(records[++index]); }
    if (!name) continue;
    if (files.length >= maxFiles) { truncated = true; break; }
    files.push({ path: name, indexStatus, worktreeStatus, ...(originalPath ? { originalPath } : {}) });
    if (indexStatus === '?' && worktreeStatus === '?') untracked.push(name);
  }
  return { files, untracked, truncated };
}

/** Read-only current-workspace Git review. No task attribution, approval or untracked contents. */
export async function reviewWorkspaceChanges(workspace, {
  timeoutMs = 8000, maxDiffBytes = 524288, maxFiles = 500, spawnProcess = spawn, platform = process.platform,
  environment = process.env,
} = {}) {
  const result = { available: false, workspace: typeof workspace === 'string' ? path.resolve(workspace) : '', generatedAt: new Date().toISOString(), diff: '', stagedDiff: '', untracked: [], files: [], truncated: false,
    untrackedExplanation: 'Untracked paths are listed without reading their contents; directories may be grouped.',
    scopeExplanation: 'Current workspace changes only. Unstaged changes compare against the index; staged changes compare against HEAD (or the empty tree). Changes are not attributed to a task or automatically approved.' };
  if (typeof workspace !== 'string' || !workspace.trim()) return { ...result, reason: 'invalid-workspace' };
  try { result.workspace = await realpath(result.workspace); if (!(await stat(result.workspace)).isDirectory()) return { ...result, reason: 'invalid-workspace' }; } catch { return { ...result, reason: 'invalid-workspace' }; }
  const gitCommand = await resolveGit(result.workspace, environment);
  if (!gitCommand) return { ...result, reason: 'git-unavailable' };
  const systemRoot = envValue(environment, 'SystemRoot');
  const killCommand = process.platform === 'win32' && typeof systemRoot === 'string' && path.isAbsolute(systemRoot) ? await trustedExecutable(path.join(systemRoot, 'System32', 'taskkill.exe'), result.workspace) : null;
  const env = Object.fromEntries(Object.entries(environment).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : devNull, LC_ALL: 'C', LANG: 'C' });
  const options = { cwd: result.workspace, env, spawnProcess, platform, gitCommand, killCommand, timeoutMs: clamp(timeoutMs, 8000, 30000) };
  const probe = await capture(['rev-parse', '--is-inside-work-tree', '--show-prefix'], { ...options, maxBytes: 16384 });
  let reason = failure(probe);
  if (reason) return { ...result, reason };
  const firstBreak = probe.stdout.indexOf('\n');
  if (probe.truncated || firstBreak < 0 || probe.stdout.slice(0, firstBreak).trim() !== 'true') return { ...result, reason: 'not-repository' };
  const prefix = probe.stdout.slice(firstBreak + 1).replace(/\r?\n$/, '');

  // Git clean/process filters can execute commands during status/diff. Disable all
  // configured drivers as well as fsmonitor, external diff and textconv helpers.
  const filters = await capture(['config', '--null', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], { ...options, maxBytes: 65536 });
  if (filters.reason || filters.truncated || ![0, 1].includes(filters.code)) return { ...result, reason: failure(filters) || 'git-error', truncated: filters.truncated };
  const keys = filters.stdout.split('\0').filter(Boolean);
  if (keys.length > 512) return { ...result, reason: 'git-error', truncated: true };
  const overrides = keys.flatMap(key => ['-c', `${key}=${key.endsWith('.required') ? 'false' : ''}`]);
  const diffBytes = clamp(maxDiffBytes, 524288, 524288);
  const commands = [
    ['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=all', '--', '.'],
    ['diff', ...DIFF, '--', '.'],
    ['diff', '--cached', ...DIFF, '--', '.'],
  ];
  const outputs = await Promise.all(commands.map((args, index) => capture([...overrides, ...args], { ...options, maxBytes: index ? diffBytes : 524288 })));
  reason = outputs.map(failure).find(Boolean);
  if (reason) return { ...result, reason, truncated: outputs.some(output => output.truncated) };
  const status = parseStatus(outputs[0].stdout, prefix, clamp(maxFiles, 500, 500));
  return { ...result, available: true, diff: outputs[1].stdout, stagedDiff: outputs[2].stdout, files: status.files, untracked: status.untracked, truncated: status.truncated || outputs.some(output => output.truncated) };
}
