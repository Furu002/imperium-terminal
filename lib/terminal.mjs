// IMPERIUM interactive terminal manager.
//
// Each session is an explicit, user-opened interactive shell backed by a real
// pseudo terminal (ConPTY on Windows via @lydell/node-pty). Nothing here runs
// commands on its own: input only arrives through write(), which the server
// wires to the user's keystrokes.
//
// Privacy: raw terminal input/output may contain credentials. It is kept only
// in a bounded in-memory buffer per session, is never written to disk, events,
// exports or state, and is dropped when the session is closed.

import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { statSync } from 'node:fs';
import path from 'node:path';

export const MAX_SESSIONS = 3;
export const MAX_OUTPUT_CHARS = 200_000;
export const MAX_INPUT_CHARS = 32_768;
export const COLS_RANGE = Object.freeze([20, 400]);
export const ROWS_RANGE = Object.freeze([5, 200]);
const MAX_RETAINED_CLOSED = 3;
const ID_PATTERN = /^term_[0-9a-f]{24}$/;

// Exact variable names that must never reach a user shell.
const STRIPPED_ENV_NAMES = ['ELECTRON_RUN_AS_NODE', 'IMPERIUM_MEMORY_TOKEN'];
// Private application session secrets: IMPERIUM_*/HQ_* variables carrying a
// token, secret, password, key or session value. Ordinary user variables
// (PATH, HOME, API keys the user exported themselves, ...) are left untouched.
const PRIVATE_ENV_PATTERN = /^(IMPERIUM|HQ)_[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|KEY|SESSION|CSRF|COOKIE)[A-Z0-9_]*$/i;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Copy of env without Electron/IMPERIUM private variables. Does not mutate the input. */
export function terminalEnvironment(env = process.env, { platform = process.platform, extraStrip = [] } = {}) {
  const strip = new Set([...STRIPPED_ENV_NAMES, ...extraStrip].map(name => name.toUpperCase()));
  const result = {};
  for (const [key, value] of Object.entries(env || {})) {
    if (typeof value !== 'string') continue;
    const upper = key.toUpperCase();
    if (strip.has(upper) || PRIVATE_ENV_PATTERN.test(key)) continue;
    result[key] = value;
  }
  if (platform !== 'win32') {
    if (!result.TERM || result.TERM === 'dumb') result.TERM = 'xterm-256color';
    if (!result.COLORTERM) result.COLORTERM = 'truecolor';
  }
  return result;
}

function windowsSystemBinary(env, name) {
  const root = env.SystemRoot || env.SYSTEMROOT || env.windir || env.WINDIR;
  if (typeof root === 'string' && path.win32.isAbsolute(root)) return path.win32.join(root, 'System32', ...name);
  return name[name.length - 1];
}

/**
 * Resolve a symbolic shell choice to a fixed executable + arguments.
 * Only predefined names are accepted; callers can never supply a path.
 */
export function resolveShell(shell = 'default', { platform = process.platform, env = process.env } = {}) {
  const choice = shell === undefined || shell === null || shell === '' ? 'default' : shell;
  if (typeof choice !== 'string') throw httpError(400, 'Invalid shell');
  if (platform === 'win32') {
    if (choice === 'default' || choice === 'powershell') {
      return { shell: 'powershell', file: windowsSystemBinary(env, ['WindowsPowerShell', 'v1.0', 'powershell.exe']), args: ['-NoLogo', '-NoProfile'] };
    }
    if (choice === 'cmd') return { shell: 'cmd', file: windowsSystemBinary(env, ['cmd.exe']), args: [] };
    throw httpError(400, `Shell not available on this platform: ${choice}`);
  }
  if (platform === 'darwin') {
    if (choice === 'default' || choice === 'zsh') return { shell: 'zsh', file: '/bin/zsh', args: ['-l'] };
    if (choice === 'bash') return { shell: 'bash', file: '/bin/bash', args: ['-l'] };
    throw httpError(400, `Shell not available on this platform: ${choice}`);
  }
  // Linux and other POSIX systems.
  if (choice === 'default') {
    const userShell = env.SHELL;
    // The user's own login shell, if it is a plain absolute path.
    if (typeof userShell === 'string' && userShell.startsWith('/') && !/[\s\0]/.test(userShell)) {
      return { shell: path.posix.basename(userShell) || 'default', file: userShell, args: ['-l'] };
    }
    return { shell: 'bash', file: '/bin/bash', args: ['-l'] };
  }
  if (choice === 'bash') return { shell: 'bash', file: '/bin/bash', args: ['-l'] };
  if (choice === 'zsh') return { shell: 'zsh', file: '/bin/zsh', args: ['-l'] };
  throw httpError(400, `Shell not available on this platform: ${choice}`);
}

function checkDimension(value, [min, max], label) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(number) || number < min || number > max) throw httpError(400, `${label} must be an integer between ${min} and ${max}`);
  return number;
}

function checkCwd(cwd, stat) {
  if (typeof cwd !== 'string' || !cwd || cwd.includes('\0') || !path.isAbsolute(cwd)) throw httpError(400, 'Terminal working directory must be an absolute path');
  let info;
  try { info = stat(cwd); } catch { throw httpError(400, 'Terminal working directory does not exist'); }
  if (!info || typeof info.isDirectory !== 'function' || !info.isDirectory()) throw httpError(400, 'Terminal working directory is not a directory');
  return path.resolve(cwd);
}

function loadPty() {
  const require = createRequire(import.meta.url);
  try {
    return require('@lydell/node-pty');
  } catch (cause) {
    const error = httpError(500, 'Terminal backend (@lydell/node-pty) is not available');
    error.cause = cause;
    throw error;
  }
}

export function createTerminalManager({
  ptyModule,
  platform = process.platform,
  env = process.env,
  maxSessions = MAX_SESSIONS,
  maxOutputChars = MAX_OUTPUT_CHARS,
  stripEnv = [],
  stat = statSync,
  closeOnProcessExit = true,
  now = () => new Date(),
} = {}) {
  let pty = ptyModule || null;
  const sessions = new Map();
  let exitHookInstalled = false;
  const onProcessExit = () => closeAll();

  function backend() {
    if (!pty) pty = loadPty();
    if (!pty || typeof pty.spawn !== 'function') throw httpError(500, 'Terminal backend is invalid');
    return pty;
  }

  function syncExitHook() {
    if (!closeOnProcessExit) return;
    const anyRunning = [...sessions.values()].some(session => session.status === 'running');
    if (anyRunning && !exitHookInstalled) { process.once('exit', onProcessExit); exitHookInstalled = true; }
    else if (!anyRunning && exitHookInstalled) { process.removeListener('exit', onProcessExit); exitHookInstalled = false; }
  }

  function metadata(session) {
    return { id: session.id, cwd: session.cwd, shell: session.shell, cols: session.cols, rows: session.rows, status: session.status, createdAt: session.createdAt, ...(session.status === 'closed' && session.exitCode !== undefined ? { exitCode: session.exitCode } : {}) };
  }

  function lookup(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw httpError(400, 'Invalid terminal session id');
    const session = sessions.get(id);
    if (!session) throw httpError(404, 'Terminal session not found');
    return session;
  }

  function emit(session, event) {
    for (const listener of [...session.listeners]) {
      try { listener(event); } catch { /* a broken subscriber must not break the terminal */ }
    }
  }

  function append(session, data) {
    session.output += data;
    if (session.output.length > maxOutputChars) session.output = session.output.slice(session.output.length - maxOutputChars);
  }

  function detach(session) {
    for (const disposable of session.disposables) { try { disposable?.dispose?.(); } catch { /* ignore */ } }
    session.disposables = [];
  }

  function pruneClosed() {
    const closed = [...sessions.values()].filter(session => session.status === 'closed');
    while (closed.length > MAX_RETAINED_CLOSED) {
      const oldest = closed.shift();
      oldest.output = '';
      oldest.listeners.clear();
      sessions.delete(oldest.id);
    }
  }

  function markExited(session, exitCode, signal) {
    if (session.status === 'closed') return;
    session.status = 'closed';
    session.exitCode = Number.isInteger(exitCode) ? exitCode : null;
    detach(session);
    session.process = null;
    emit(session, { type: 'exit', exitCode: session.exitCode, ...(signal ? { signal } : {}) });
    pruneClosed();
    syncExitHook();
  }

  function start({ cwd, cols = 100, rows = 28, shell = 'default' } = {}) {
    const resolvedCwd = checkCwd(cwd, stat);
    const width = checkDimension(cols, COLS_RANGE, 'cols');
    const height = checkDimension(rows, ROWS_RANGE, 'rows');
    const resolved = resolveShell(shell, { platform, env });
    const running = [...sessions.values()].filter(session => session.status === 'running').length;
    if (running >= maxSessions) throw httpError(409, `At most ${maxSessions} terminal sessions can run at once`);
    const module = backend();
    const options = { name: 'xterm-256color', cols: width, rows: height, cwd: resolvedCwd, env: terminalEnvironment(env, { platform, extraStrip: stripEnv }) };
    let child;
    try {
      child = module.spawn(resolved.file, resolved.args, options);
    } catch (cause) {
      const error = httpError(500, `Could not start ${resolved.shell} terminal`);
      error.cause = cause;
      throw error;
    }
    const id = `term_${randomBytes(12).toString('hex')}`;
    const session = { id, cwd: resolvedCwd, shell: resolved.shell, cols: width, rows: height, status: 'running', createdAt: now().toISOString(), output: '', listeners: new Set(), disposables: [], process: child };
    sessions.set(id, session);
    session.disposables.push(child.onData(data => {
      if (session.status !== 'running') return;
      const text = typeof data === 'string' ? data : String(data);
      append(session, text);
      emit(session, { type: 'data', data: text });
    }));
    session.disposables.push(child.onExit(event => markExited(session, event?.exitCode, event?.signal)));
    syncExitHook();
    return metadata(session);
  }

  function list() {
    return [...sessions.values()].map(metadata);
  }

  function get(id) {
    const session = lookup(id);
    return { ...metadata(session), output: session.output };
  }

  function write(id, data) {
    const session = lookup(id);
    if (typeof data !== 'string') throw httpError(400, 'Terminal input must be a string');
    if (data.length > MAX_INPUT_CHARS) throw httpError(400, `Terminal input is limited to ${MAX_INPUT_CHARS} characters`);
    if (session.status !== 'running' || !session.process) throw httpError(409, 'Terminal session is not running');
    if (!data) return;
    session.process.write(data);
  }

  function resize(id, cols, rows) {
    const session = lookup(id);
    const width = checkDimension(cols, COLS_RANGE, 'cols');
    const height = checkDimension(rows, ROWS_RANGE, 'rows');
    if (session.status !== 'running' || !session.process) throw httpError(409, 'Terminal session is not running');
    session.process.resize(width, height);
    session.cols = width;
    session.rows = height;
    return metadata(session);
  }

  function close(id) {
    const session = lookup(id);
    const child = session.process;
    const wasRunning = session.status === 'running';
    session.status = 'closed';
    detach(session);
    session.process = null;
    if (child) {
      // Only the PTY this manager spawned is terminated. On Windows node-pty
      // rejects explicit signals, so kill() is called without one.
      try { child.kill(); } catch { /* already gone */ }
    }
    if (wasRunning) emit(session, { type: 'exit', exitCode: null });
    session.output = '';
    session.listeners.clear();
    sessions.delete(id);
    syncExitHook();
    return { ok: true };
  }

  function closeAll() {
    for (const id of [...sessions.keys()]) {
      try { close(id); } catch { /* keep closing the rest */ }
    }
  }

  function subscribe(id, callback) {
    const session = lookup(id);
    if (typeof callback !== 'function') throw httpError(400, 'Subscriber must be a function');
    session.listeners.add(callback);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      session.listeners.delete(callback);
    };
  }

  return { start, list, get, write, resize, close, closeAll, subscribe };
}
