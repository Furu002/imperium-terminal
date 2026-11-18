import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
  createTerminalManager, terminalEnvironment, resolveShell,
  MAX_OUTPUT_CHARS, MAX_INPUT_CHARS,
} from '../lib/terminal.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CWD = path.resolve(tmpdir());

// Fake node-pty: records spawns, lets tests push output and exits.
function createFakePty() {
  const spawned = [];
  return {
    spawned,
    spawn(file, args, options) {
      const dataListeners = new Set();
      const exitListeners = new Set();
      const proc = {
        file, args, options,
        written: [], resizes: [], killed: 0,
        onData(listener) { dataListeners.add(listener); return { dispose: () => dataListeners.delete(listener) }; },
        onExit(listener) { exitListeners.add(listener); return { dispose: () => exitListeners.delete(listener) }; },
        write(data) { proc.written.push(data); },
        resize(cols, rows) { proc.resizes.push([cols, rows]); },
        kill(signal) { proc.killed += 1; proc.killSignal = signal; },
        emitData(data) { for (const listener of [...dataListeners]) listener(data); },
        emitExit(event) { for (const listener of [...exitListeners]) listener(event); },
        listenerCount: () => dataListeners.size + exitListeners.size,
      };
      spawned.push(proc);
      return proc;
    },
  };
}

function manager(overrides = {}) {
  const pty = createFakePty();
  const env = { PATH: 'C:\\Windows', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\u', ...overrides.env };
  const terminals = createTerminalManager({ ptyModule: pty, platform: 'win32', closeOnProcessExit: false, ...overrides, env });
  return { pty, terminals };
}

function expectStatus(fn, status) {
  assert.throws(fn, error => error.status === status, `expected status ${status}`);
}

test('start spawns default PowerShell with -NoLogo -NoProfile and returns metadata', () => {
  const { pty, terminals } = manager();
  const session = terminals.start({ cwd: CWD });
  assert.match(session.id, /^term_[0-9a-f]{24}$/);
  assert.equal(session.status, 'running');
  assert.equal(session.shell, 'powershell');
  assert.equal(session.cwd, CWD);
  assert.equal(session.cols, 100);
  assert.equal(session.rows, 28);
  assert.ok(!Number.isNaN(Date.parse(session.createdAt)));
  assert.equal(pty.spawned.length, 1);
  const [proc] = pty.spawned;
  assert.match(proc.file, /powershell\.exe$/i);
  assert.equal(proc.file, path.win32.join('C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
  assert.deepEqual(proc.args, ['-NoLogo', '-NoProfile']);
  assert.equal(proc.options.cwd, CWD);
  assert.equal(proc.options.cols, 100);
  assert.equal(proc.options.rows, 28);
  assert.deepEqual(terminals.list(), [session]);
});

test('shell resolution is OS-specific and never accepts paths', () => {
  assert.deepEqual(resolveShell('cmd', { platform: 'win32', env: { SystemRoot: 'C:\\Windows' } }), { shell: 'cmd', file: 'C:\\Windows\\System32\\cmd.exe', args: [] });
  assert.deepEqual(resolveShell('default', { platform: 'darwin', env: {} }), { shell: 'zsh', file: '/bin/zsh', args: ['-l'] });
  assert.deepEqual(resolveShell('bash', { platform: 'darwin', env: {} }), { shell: 'bash', file: '/bin/bash', args: ['-l'] });
  assert.deepEqual(resolveShell('default', { platform: 'linux', env: { SHELL: '/usr/bin/fish' } }), { shell: 'fish', file: '/usr/bin/fish', args: ['-l'] });
  assert.deepEqual(resolveShell('default', { platform: 'linux', env: {} }), { shell: 'bash', file: '/bin/bash', args: ['-l'] });
  assert.deepEqual(resolveShell('default', { platform: 'linux', env: { SHELL: 'relative/sh' } }), { shell: 'bash', file: '/bin/bash', args: ['-l'] });
  for (const bad of ['bash', 'zsh', 'C:\\evil.exe', 'powershell.exe -c calc', '../x']) {
    expectStatus(() => resolveShell(bad, { platform: 'win32', env: {} }), 400);
  }
  for (const bad of ['powershell', 'cmd', '/bin/sh', 'zsh; rm -rf /']) {
    expectStatus(() => resolveShell(bad, { platform: 'linux', env: {} }), 400);
  }
  expectStatus(() => resolveShell({}, { platform: 'linux', env: {} }), 400);
  const { terminals, pty } = manager();
  expectStatus(() => terminals.start({ cwd: CWD, shell: 'C:\\Windows\\System32\\calc.exe' }), 400);
  assert.equal(pty.spawned.length, 0);
});

test('cwd must be an existing absolute directory', () => {
  const { terminals, pty } = manager();
  expectStatus(() => terminals.start({}), 400);
  expectStatus(() => terminals.start({ cwd: 'relative/dir' }), 400);
  expectStatus(() => terminals.start({ cwd: path.join(CWD, 'imperium-terminal-does-not-exist-' + Date.now()) }), 400);
  expectStatus(() => terminals.start({ cwd: fileURLToPath(import.meta.url) }), 400);
  assert.equal(pty.spawned.length, 0);
});

test('cols, rows and session count are bounded', () => {
  const { terminals, pty } = manager();
  for (const [cols, rows] of [[19, 28], [401, 28], [100, 4], [100, 201], [100.5, 28], ['abc', 28], [100, null]]) {
    expectStatus(() => terminals.start({ cwd: CWD, cols, rows }), 400);
  }
  assert.equal(terminals.start({ cwd: CWD, cols: 20, rows: 5 }).cols, 20);
  terminals.start({ cwd: CWD, cols: 400, rows: 200 });
  const third = terminals.start({ cwd: CWD });
  expectStatus(() => terminals.start({ cwd: CWD }), 409);
  assert.equal(pty.spawned.length, 3);
  // Closing frees a slot.
  terminals.close(third.id);
  terminals.start({ cwd: CWD });
  assert.equal(terminals.list().length, 3);
});

test('data events reach subscribers, output buffer is bounded and replayable', () => {
  const { pty, terminals } = manager();
  const { id } = terminals.start({ cwd: CWD });
  const proc = pty.spawned[0];
  const events = [];
  const unsubscribe = terminals.subscribe(id, event => events.push(event));
  proc.emitData('PS C:\\> ');
  proc.emitData('\u001b[32mgreen\u001b[0m');
  assert.deepEqual(events, [{ type: 'data', data: 'PS C:\\> ' }, { type: 'data', data: '\u001b[32mgreen\u001b[0m' }]);
  assert.equal(terminals.get(id).output, 'PS C:\\> \u001b[32mgreen\u001b[0m');

  unsubscribe();
  unsubscribe(); // idempotent
  proc.emitData('after');
  assert.equal(events.length, 2);

  proc.emitData('x'.repeat(MAX_OUTPUT_CHARS + 500) + 'TAIL');
  const { output } = terminals.get(id);
  assert.equal(output.length, MAX_OUTPUT_CHARS);
  assert.ok(output.endsWith('TAIL'));
});

test('a throwing subscriber does not break other subscribers', () => {
  const { pty, terminals } = manager();
  const { id } = terminals.start({ cwd: CWD });
  const seen = [];
  terminals.subscribe(id, () => { throw new Error('boom'); });
  terminals.subscribe(id, event => seen.push(event.data));
  pty.spawned[0].emitData('ok');
  assert.deepEqual(seen, ['ok']);
});

test('write forwards input verbatim, validates size and type, never appends a newline', () => {
  const { pty, terminals } = manager();
  const { id } = terminals.start({ cwd: CWD });
  const proc = pty.spawned[0];
  terminals.write(id, 'echo hi');
  terminals.write(id, '');
  terminals.write(id, 'y'.repeat(MAX_INPUT_CHARS));
  assert.deepEqual(proc.written, ['echo hi', 'y'.repeat(MAX_INPUT_CHARS)]);
  expectStatus(() => terminals.write(id, 'z'.repeat(MAX_INPUT_CHARS + 1)), 400);
  expectStatus(() => terminals.write(id, 42), 400);
  expectStatus(() => terminals.write(id, null), 400);
  // Manager never writes on its own (no automatic commands at start).
  assert.equal(proc.written.length, 2);
});

test('session ids are validated and unknown ids are 404', () => {
  const { terminals } = manager();
  for (const bad of [undefined, '', '../../etc', 'term_xyz', '__proto__', { id: 1 }]) {
    expectStatus(() => terminals.get(bad), 400);
    expectStatus(() => terminals.write(bad, 'x'), 400);
    expectStatus(() => terminals.close(bad), 400);
    expectStatus(() => terminals.subscribe(bad, () => {}), 400);
  }
  const missing = 'term_' + '0'.repeat(24);
  expectStatus(() => terminals.get(missing), 404);
  expectStatus(() => terminals.resize(missing, 80, 24), 404);
  expectStatus(() => terminals.close(missing), 404);
});

test('resize validates bounds and updates metadata', () => {
  const { pty, terminals } = manager();
  const { id } = terminals.start({ cwd: CWD });
  const result = terminals.resize(id, 132, 40);
  assert.equal(result.cols, 132);
  assert.equal(result.rows, 40);
  assert.deepEqual(pty.spawned[0].resizes, [[132, 40]]);
  expectStatus(() => terminals.resize(id, 10, 40), 400);
  expectStatus(() => terminals.resize(id, 132, 500), 400);
  assert.equal(terminals.get(id).cols, 132);
});

test('natural exit marks the session closed, notifies, and rejects further input', () => {
  const { pty, terminals } = manager();
  const { id } = terminals.start({ cwd: CWD });
  const proc = pty.spawned[0];
  const events = [];
  terminals.subscribe(id, event => events.push(event));
  proc.emitData('bye');
  proc.emitExit({ exitCode: 0 });
  assert.deepEqual(events.at(-1), { type: 'exit', exitCode: 0 });
  const info = terminals.get(id);
  assert.equal(info.status, 'closed');
  assert.equal(info.output, 'bye');
  assert.equal(proc.listenerCount(), 0);
  expectStatus(() => terminals.write(id, 'x'), 409);
  expectStatus(() => terminals.resize(id, 80, 24), 409);
  // Exited sessions do not count against the concurrency limit.
  terminals.start({ cwd: CWD });
  terminals.start({ cwd: CWD });
  terminals.start({ cwd: CWD });
});

test('close kills only the owned PTY, emits exit, clears output and forgets the session', () => {
  const { pty, terminals } = manager();
  const a = terminals.start({ cwd: CWD });
  const b = terminals.start({ cwd: CWD });
  const [procA, procB] = pty.spawned;
  procA.emitData('secret-token-123');
  const events = [];
  terminals.subscribe(a.id, event => events.push(event));
  assert.deepEqual(terminals.close(a.id), { ok: true });
  assert.equal(procA.killed, 1);
  assert.equal(procA.killSignal, undefined, 'Windows node-pty rejects explicit signals');
  assert.equal(procB.killed, 0);
  assert.deepEqual(events, [{ type: 'exit', exitCode: null }]);
  assert.equal(procA.listenerCount(), 0);
  expectStatus(() => terminals.get(a.id), 404);
  assert.deepEqual(terminals.list().map(s => s.id), [b.id]);
  // Late PTY events after close are ignored.
  procA.emitData('late');
  procA.emitExit({ exitCode: 1 });
  assert.equal(events.length, 1);
});

test('closeAll terminates every owned session', () => {
  const { pty, terminals } = manager();
  terminals.start({ cwd: CWD });
  terminals.start({ cwd: CWD });
  terminals.closeAll();
  assert.deepEqual(terminals.list(), []);
  assert.deepEqual(pty.spawned.map(p => p.killed), [1, 1]);
  terminals.closeAll(); // idempotent
});

test('process exit hook is installed only while sessions run', () => {
  const pty = createFakePty();
  const before = process.listenerCount('exit');
  const terminals = createTerminalManager({ ptyModule: pty, platform: 'win32', env: { SystemRoot: 'C:\\Windows' } });
  const { id } = terminals.start({ cwd: CWD });
  assert.equal(process.listenerCount('exit'), before + 1);
  terminals.close(id);
  assert.equal(process.listenerCount('exit'), before);
});

test('shell environment strips Electron and IMPERIUM secrets but keeps user variables', () => {
  const env = {
    PATH: 'C:\\bin', USERPROFILE: 'C:\\Users\\u', OPENAI_API_KEY: 'user-owned', GITHUB_TOKEN: 'user-owned', LANG: 'ko_KR.UTF-8',
    ELECTRON_RUN_AS_NODE: '1', IMPERIUM_MEMORY_TOKEN: 'mem', imperium_memory_token: 'mem2', IMPERIUM_SESSION_SECRET: 's', HQ_CSRF_TOKEN: 'c', IMPERIUM_THEME: 'dark',
  };
  const { pty, terminals } = manager({ env, stripEnv: ['MY_APP_PRIVATE'] });
  terminals.start({ cwd: CWD });
  const shellEnv = pty.spawned[0].options.env;
  for (const key of ['ELECTRON_RUN_AS_NODE', 'IMPERIUM_MEMORY_TOKEN', 'imperium_memory_token', 'IMPERIUM_SESSION_SECRET', 'HQ_CSRF_TOKEN']) {
    assert.equal(shellEnv[key], undefined, key);
  }
  for (const key of ['PATH', 'USERPROFILE', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'LANG', 'IMPERIUM_THEME']) {
    assert.equal(shellEnv[key], env[key], key);
  }
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1', 'parent environment is not mutated');
  const extra = terminalEnvironment({ MY_APP_PRIVATE: 'x', KEEP: 'y' }, { platform: 'linux', extraStrip: ['MY_APP_PRIVATE'] });
  assert.equal(extra.MY_APP_PRIVATE, undefined);
  assert.equal(extra.KEEP, 'y');
  assert.equal(extra.TERM, 'xterm-256color');
});

test('terminal module does not persist data: no fs writes, no timers, no network', () => {
  const source = readFileSync(path.join(here, '..', 'lib', 'terminal.mjs'), 'utf8');
  assert.doesNotMatch(source, /writeFile|appendFile|createWriteStream|mkdir|fetch\(|https?:\/\/|localStorage/);
  assert.doesNotMatch(source, /child_process|exec\(|execSync|spawnSync/);
  const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map(match => match[1]).sort();
  assert.deepEqual(imports, ['node:crypto', 'node:fs', 'node:module', 'node:path']);
});

test('metadata and list never expose raw output', () => {
  const { pty, terminals } = manager();
  const { id } = terminals.start({ cwd: CWD });
  pty.spawned[0].emitData('password: hunter2');
  assert.equal(JSON.stringify(terminals.list()).includes('hunter2'), false);
  const started = terminals.start({ cwd: CWD });
  assert.equal('output' in started, false);
  assert.equal(terminals.get(id).output, 'password: hunter2');
});

test('frontend pane avoids innerHTML and never sends a carriage return for pasted commands', () => {
  const source = readFileSync(path.join(here, '..', 'public', 'terminal-pane.js'), 'utf8');
  // Match actual property/method use (".innerHTML", "insertAdjacentHTML(") so the
  // safety comment at the top of the file that names innerHTML is not a false positive.
  assert.doesNotMatch(source, /\.\s*(?:innerHTML|outerHTML)\b|\binsertAdjacentHTML\s*\(|\bdocument\s*\.\s*write(?:ln)?\s*\(|\[\s*['"](?:innerHTML|outerHTML)['"]\s*\]/);
  assert.doesNotMatch(source, /https?:\/\/(?!localhost)/);
  assert.match(source, /imperium:terminal-command/);
  assert.match(source, /imperium:open-terminal/);
  assert.match(source, /window\.ImperiumTerminal\s*=/);
});
