import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  createUpdater, configureUpdateChannel, registerUpdateIpc, createStateSender,
  safeErrorMessage, releaseNotesText, IPC_CHANNELS, STATUSES, CHECK_INTERVAL_MS, PUBLISHER,
} = require('../desktop/updater.cjs');

const CHANNEL = { owner: 'imperium-dist', repo: 'imperium-releases' };
const flush = () => new Promise((resolve) => setImmediate(resolve));

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.feeds = [];
    this.checks = 0;
    this.downloads = 0;
    this.installs = [];
    this.onCheck = null;
    this.onDownload = null;
  }
  setFeedURL(feed) { this.feeds.push(feed); }
  async checkForUpdates(...args) {
    this.checks += 1;
    this.checkArgs = args;
    this.emit('checking-for-update');
    return this.onCheck ? this.onCheck(this) : null;
  }
  async downloadUpdate(...args) {
    this.downloads += 1;
    this.downloadArgs = args;
    return this.onDownload ? this.onDownload(this, ...args) : [];
  }
  quitAndInstall(...args) { this.installs.push(args); }
}

const notAvailable = (version = '1.1.0') => (u) => {
  const info = { version, releaseDate: '2026-11-01T00:00:00.000Z' };
  u.emit('update-not-available', info);
  return { isUpdateAvailable: false, updateInfo: info };
};
const available = (info) => (u) => {
  u.emit('update-available', info);
  return { isUpdateAvailable: true, updateInfo: info };
};

function harness(options = {}) {
  const fake = options.fake || new FakeUpdater();
  if (options.onCheck) fake.onCheck = options.onCheck;
  const timers = { intervals: [], timeouts: [] };
  const sent = [];
  let clock = Date.parse('2026-11-18T09:00:00.000Z');
  let loaderCalls = 0;
  const updater = createUpdater({
    app: { isPackaged: options.packaged ?? true, getVersion: () => options.version || '1.1.0' },
    autoUpdater: 'autoUpdater' in options ? options.autoUpdater : fake,
    sendState: (state) => sent.push(state),
    platform: options.platform || 'win32',
    env: options.env || {},
    channel: 'channel' in options ? options.channel : CHANNEL,
    now: () => clock,
    setIntervalFn: (fn, ms) => { const handle = { fn, ms, unref() { handle.unrefed = true; } }; timers.intervals.push(handle); return handle; },
    clearIntervalFn: (handle) => { handle.cleared = true; },
    setTimeoutFn: (fn, ms) => { timers.timeouts.push({ fn, ms }); },
    loadElectronUpdater: () => { loaderCalls += 1; throw new Error('real electron-updater must never load in tests'); },
    ...options.extra,
  });
  return { updater, fake, sent, timers, advance: (ms) => { clock += ms; }, loaderCalls: () => loaderCalls };
}

// ------------------------------------------------------------------ channel validation

test('configureUpdateChannel accepts only safe public GitHub channels', () => {
  assert.equal(configureUpdateChannel(undefined), null);
  assert.equal(configureUpdateChannel(null), null);
  const github = configureUpdateChannel(CHANNEL);
  assert.deepEqual({ ...github.feed }, { provider: 'github', owner: 'imperium-dist', repo: 'imperium-releases', private: false, protocol: 'https', releaseType: 'release' });
  assert.equal(github.releasesURL, 'https://github.com/imperium-dist/imperium-releases/releases/latest');
  const generic = configureUpdateChannel({ url: 'https://github.com/imperium-dist/imperium-releases/releases/latest/download' });
  assert.deepEqual({ ...generic.feed }, { provider: 'generic', url: 'https://github.com/imperium-dist/imperium-releases/releases/latest/download', useMultipleRangeRequest: false });
  assert.equal(configureUpdateChannel({ ...CHANNEL, provider: 'generic' }).feed.url, 'https://github.com/imperium-dist/imperium-releases/releases/latest/download');

  const bad = [
    'Furu002/imperium-terminal', [], { owner: 'a b', repo: 'r' }, { owner: '-x', repo: 'r' }, { owner: 'x', repo: '..' },
    { owner: 'x', repo: 'r/../../evil' }, { owner: 'x'.repeat(40), repo: 'r' }, { owner: 'x', repo: 'r', token: 'ghp_x' },
    { owner: 'x', repo: 'r', private: true }, { owner: 'x', repo: 'r', host: 'evil.example' }, { owner: 'x', repo: 'r', provider: 's3' },
    { url: 'https://evil.example/latest.yml' }, { url: 'http://github.com/x/r/releases/latest/download' },
    { url: 'https://github.com/x/r/releases/latest/download?x=1' }, { url: 'https://user:pw@github.com/x/r/releases/latest/download' },
    { url: 'https://github.com/x/r/releases/latest/download', owner: 'y' },
  ];
  for (const input of bad) assert.throws(() => configureUpdateChannel(input), TypeError, JSON.stringify(input));
});

// ------------------------------------------------------------------ gating: no network without setup

test('development builds never touch the network', async () => {
  const { updater, fake, timers, loaderCalls, sent } = harness({ packaged: false });
  await flush();
  assert.equal(updater.getState().status, 'development');
  assert.equal(fake.checks, 0);
  assert.equal(fake.feeds.length, 0);
  assert.equal(timers.intervals.length, 0);
  assert.equal(loaderCalls(), 0);
  assert.equal(sent.at(-1).status, 'development');
  const result = await updater.check();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'development');
  assert.equal(fake.checks, 0);
});

test('missing channel reports setup_required and never loads the updater', async () => {
  const { updater, fake, timers, loaderCalls } = harness({ channel: undefined, autoUpdater: undefined });
  await flush();
  const state = updater.getState();
  assert.equal(state.status, 'setup_required');
  assert.equal(state.latestVersion, null);
  assert.equal(state.canCheck, false);
  assert.equal(state.channel, null);
  assert.equal((await updater.check()).reason, 'setup_required');
  assert.equal((await updater.download()).ok, false);
  assert.equal((await updater.install()).ok, false);
  assert.equal(fake.checks, 0);
  assert.equal(timers.intervals.length, 0);
  assert.equal(loaderCalls(), 0);
});

test('invalid channel stays in setup_required with a safe error and no network', async () => {
  const { updater, fake } = harness({ channel: { url: 'https://evil.example/feed?token=ghp_abcdefghijklmnopqrstuvwxyz' } });
  await flush();
  const state = updater.getState();
  assert.equal(state.status, 'setup_required');
  assert.equal(state.error.code, 'invalid_channel');
  assert.doesNotMatch(state.error.message, /ghp_|evil\.example/);
  assert.equal(fake.checks, 0);
});

test('unsupported platforms and unloadable updater report unsupported', async () => {
  const other = harness({ platform: 'freebsd' });
  await flush();
  assert.equal(other.updater.getState().status, 'unsupported');
  assert.equal(other.fake.checks, 0);

  const broken = harness({ autoUpdater: undefined });
  await flush();
  const state = broken.updater.getState();
  assert.equal(state.status, 'unsupported');
  assert.equal(state.error.code, 'updater_unavailable');
  assert.equal(broken.loaderCalls(), 1);
});

// ------------------------------------------------------------------ lifecycle

test('startup check configures the updater safely and reports current only on a real answer', async () => {
  const { updater, fake, sent, timers } = harness({ onCheck: notAvailable('1.1.0') });
  await flush();
  assert.equal(fake.autoDownload, false);
  assert.equal(fake.autoInstallOnAppQuit, false);
  assert.equal(fake.allowPrerelease, false);
  assert.equal(fake.allowDowngrade, false);
  assert.equal(fake.disableWebInstaller, true);
  assert.equal(fake.logger, null);
  assert.equal('verifyUpdateCodeSignature' in fake, false, 'signature verification is left at the library default');
  assert.deepEqual(fake.feeds.map((feed) => ({ ...feed })), [configureUpdateChannel(CHANNEL).feed].map((feed) => ({ ...feed })));
  assert.equal(fake.checks, 1);
  assert.deepEqual(sent.map((s) => s.status).filter((s, i, all) => s !== all[i - 1]), ['checking', 'current']);
  const state = updater.getState();
  assert.equal(state.status, 'current');
  assert.equal(state.currentVersion, '1.1.0');
  assert.equal(state.latestVersion, '1.1.0');
  assert.ok(state.checkedAt);
  assert.equal(state.publisher, PUBLISHER);
  assert.equal(state.codeSigned, false);
  assert.equal(state.integrity, 'sha512');
  assert.equal(state.notice, 'windows-unsigned');
  assert.equal(timers.intervals.length, 1);
  assert.equal(timers.intervals[0].ms, CHECK_INTERVAL_MS);
  assert.equal(CHECK_INTERVAL_MS, 30 * 60 * 1000);
  assert.equal(timers.intervals[0].unrefed, true);
  for (const s of sent) assert.ok(STATUSES.includes(s.status));
});

test('a check without a provider answer is an error, never "current"', async () => {
  const silent = harness({ onCheck: () => null });
  await flush();
  assert.equal(silent.updater.getState().status, 'error');
  assert.equal(silent.updater.getState().error.code, 'updater_inactive');

  const empty = harness({ onCheck: () => ({}) });
  await flush();
  assert.equal(empty.updater.getState().status, 'error');
  assert.equal(empty.updater.getState().error.code, 'no_result');

  const noVersion = harness({ onCheck: available({ version: '<script>' }) });
  await flush();
  assert.equal(noVersion.updater.getState().status, 'error');
  assert.equal(noVersion.updater.getState().error.code, 'invalid_metadata');
  assert.equal(noVersion.updater.getState().latestVersion, null);
});

test('available -> downloading -> downloaded -> install, only on explicit actions', async () => {
  const info = {
    version: '1.2.0',
    releaseName: '<b>Spring</b> release',
    releaseDate: '2026-11-17T12:00:00Z',
    releaseNotes: '<h2>New</h2><ul><li>Updater &amp; F7 page</li><li><img src=x onerror=alert(1)>safe</li></ul><script>alert(1)</script>',
  };
  const { updater, fake, timers } = harness({ onCheck: available(info) });
  await flush();
  let state = updater.getState();
  assert.equal(state.status, 'available');
  assert.equal(state.latestVersion, '1.2.0');
  assert.equal(state.releaseName, 'Spring release');
  assert.equal(state.releaseDate, '2026-11-17T12:00:00.000Z');
  assert.equal(state.releaseNotes, 'New\n• Updater & F7 page\n• safe');
  assert.equal(state.canDownload, true);
  assert.equal(state.canInstall, false);
  assert.equal(fake.downloads, 0, 'no automatic download');
  assert.equal((await updater.install()).reason, 'not_downloaded');

  fake.onDownload = async (u) => {
    await flush();
    u.emit('download-progress', { percent: 12.34, transferred: 1234, total: 10000, bytesPerSecond: 500 });
    assert.equal(updater.getState().progress.percent, 12.3);
    u.emit('download-progress', { percent: 250, transferred: -1, total: 10000, bytesPerSecond: NaN });
    u.emit('update-downloaded', { version: '1.2.0' });
    return ['C:/cache/imperium-setup.exe'];
  };
  const pending = updater.download();
  assert.equal(updater.getState().status, 'downloading');
  assert.equal(updater.getState().canCheck, false);
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(fake.downloads, 1);
  assert.equal(fake.downloadArgs.length, 1, 'downloads receive a cancellable token, never renderer arguments');
  assert.equal(typeof fake.downloadArgs[0].cancel, 'function');
  state = updater.getState();
  assert.equal(state.status, 'downloaded');
  assert.equal(state.progress.percent, 100);
  assert.equal(state.canInstall, true);
  assert.equal((await updater.check()).reason, 'busy');

  const install = await updater.install();
  assert.equal(install.ok, true);
  assert.equal(fake.installs.length, 0, 'install waits for the IPC reply first');
  assert.equal(timers.timeouts.length, 1);
  timers.timeouts[0].fn();
  assert.deepEqual(fake.installs, [[false, true]]);
  assert.equal(updater.getState().installing, true);
  assert.equal((await updater.install()).reason, 'installing');
});

test('progress clamps and download errors surface safely', async () => {
  const { updater, fake } = harness({ onCheck: available({ version: '1.2.0' }) });
  await flush();
  fake.onDownload = (u) => {
    u.emit('download-progress', { percent: 40, transferred: 400, total: 1000, bytesPerSecond: 10 });
    const error = new Error('sha512 checksum mismatch, expected abc, got def');
    u.emit('error', error);
    throw error;
  };
  const result = await updater.download();
  assert.equal(result.ok, false);
  const state = updater.getState();
  assert.equal(state.status, 'error');
  assert.equal(state.error.code, 'integrity');
  assert.equal(state.progress, null);
});

test('errors are redacted, classified and capped at 300 characters', async () => {
  const secret = 'ghp_' + 'A'.repeat(36);
  const message = `HttpError: 404 Not Found "method: GET url: https://api.github.com/repos/o/r/releases?access_token=${secret}&x=1" `
    + `Authorization: Bearer ${secret} C:\\Users\\chehy\\AppData\\Local\\imperium-updater /home/sato/.cache Headers: {"set-cookie":"session=abc"}`;
  const { updater } = harness({ onCheck: (u) => { const error = new Error(message); u.emit('error', error); throw error; } });
  await flush();
  const { error, status } = updater.getState();
  assert.equal(status, 'error');
  assert.equal(error.code, 'no_release');
  assert.ok(error.message.length <= 300);
  assert.doesNotMatch(error.message, /ghp_|access_token=ghp|chehy|sato|set-cookie|session=abc|x=1/);
  assert.match(error.message, /https:\/\/api\.github\.com\/repos\/o\/r\/releases/);

  assert.equal(safeErrorMessage(new Error('x'.repeat(1000))).length, 300);
  assert.equal(safeErrorMessage(undefined), 'Unknown update error.');
  assert.match(safeErrorMessage(new Error('token=github_pat_' + 'b'.repeat(40))), /\[redacted\]/);
  assert.doesNotMatch(safeErrorMessage(new Error('https://user:hunter2@github.com/x')), /hunter2/);
});

test('error codes cover network and access failures', async () => {
  for (const [text, code] of [
    ['getaddrinfo ENOTFOUND api.github.com', 'network'],
    ['net::ERR_INTERNET_DISCONNECTED', 'network'],
    ['HttpError: 403 Forbidden API rate limit exceeded', 'github_rate_limited'],
    ['HttpError: 401 Unauthorized', 'access_denied'],
    ['Cannot find latest.yml in the latest release artifacts', 'metadata_missing'],
    ['Something odd', 'unknown'],
  ]) {
    const { updater } = harness({ onCheck: () => { throw new Error(text); } });
    await flush();
    assert.equal(updater.getState().error.code, code, text);
  }
});

test('manual checks are rate limited and de-duplicated; renderer arguments are ignored', async () => {
  let release;
  const { updater, fake, advance } = harness({ onCheck: notAvailable() });
  await flush();
  assert.equal(fake.checks, 1);

  fake.onCheck = (u) => new Promise((resolve) => { release = () => resolve(notAvailable('1.1.0')(u)); });
  const first = updater.check('9.9.9', 'https://evil.example/feed');
  const second = updater.check();
  await flush();
  assert.equal(fake.checks, 2, 'concurrent checks share one request');
  assert.deepEqual(fake.checkArgs, []);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.state.status, 'current');
  assert.equal(b.state.status, 'current');
  assert.equal(fake.feeds.length, 1, 'feed never changes from renderer input');

  const limited = await updater.check();
  assert.equal(limited.ok, false);
  assert.equal(limited.reason, 'rate_limited');
  assert.ok(limited.state.manualCheckAvailableAt);
  assert.equal(fake.checks, 2);

  advance(60 * 1000);
  fake.onCheck = notAvailable();
  assert.equal((await updater.check()).ok, true);
  assert.equal(fake.checks, 3);

  await updater.download('https://evil.example/payload.exe');
  assert.equal(fake.downloads, 0);
});

test('the 30-minute schedule checks again and pauses while an update is downloaded', async () => {
  const { updater, fake, timers } = harness({ onCheck: available({ version: '1.2.0' }) });
  await flush();
  assert.equal(fake.checks, 1);
  timers.intervals[0].fn();
  await flush();
  assert.equal(fake.checks, 2);
  fake.onDownload = (u) => { u.emit('update-downloaded', { version: '1.2.0' }); };
  await updater.download();
  assert.equal(updater.getState().status, 'downloaded');
  timers.intervals[0].fn();
  await flush();
  assert.equal(fake.checks, 2);
});

test('platform modes: Linux deb, macOS unsigned and Windows portable offer the download page', async () => {
  const cases = [
    { platform: 'linux', env: {}, mode: 'manual', notice: 'linux-package' },
    { platform: 'linux', env: { APPIMAGE: '/opt/Imperium.AppImage' }, mode: 'auto', notice: null },
    { platform: 'darwin', env: {}, mode: 'manual', notice: 'mac-unsigned' },
    { platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: 'D:\\apps' }, mode: 'manual', notice: 'windows-portable' },
    { platform: 'win32', env: {}, mode: 'auto', notice: 'windows-unsigned' },
  ];
  for (const item of cases) {
    const { updater, fake } = harness({ platform: item.platform, env: item.env, onCheck: available({ version: '2.0.0' }) });
    await flush();
    const state = updater.getState();
    assert.equal(state.mode, item.mode, item.platform);
    assert.equal(state.notice, item.notice, item.platform);
    assert.equal(state.status, 'available', 'manual installs can still learn about new versions');
    if (item.mode === 'manual') {
      assert.equal(state.canDownload, false);
      assert.equal(state.manualDownload, true);
      assert.equal(state.releasesURL, 'https://github.com/imperium-dist/imperium-releases/releases/latest');
      assert.equal((await updater.download()).reason, 'manual_download');
      assert.equal(fake.downloads, 0);
    } else {
      assert.equal(state.canDownload, true);
      assert.equal(state.manualDownload, false);
    }
    if (item.platform !== 'win32') assert.equal('disableWebInstaller' in fake, false);
  }
});

test('configureChannel enables a later-chosen public repository', async () => {
  const { updater, fake } = harness({ channel: undefined, onCheck: notAvailable() });
  await flush();
  assert.equal(updater.getState().status, 'setup_required');
  assert.equal(updater.configureChannel({ url: 'https://evil.example/x' }).reason, 'invalid_channel');
  assert.equal(fake.checks, 0);
  const result = updater.configureChannel(CHANNEL);
  assert.equal(result.ok, true);
  await flush();
  assert.equal(fake.checks, 1);
  assert.equal(updater.getState().status, 'current');
  assert.deepEqual(updater.getState().channel, { owner: 'imperium-dist', repo: 'imperium-releases', provider: 'github' });
});

test('dispose stops timers and ignores late updater events', async () => {
  const { updater, fake, timers, sent } = harness({ onCheck: notAvailable() });
  await flush();
  updater.dispose();
  assert.equal(timers.intervals[0].cleared, true);
  assert.equal(fake.listenerCount('update-available'), 0);
  const before = sent.length;
  fake.emit('update-available', { version: '9.0.0' });
  assert.equal(sent.length, before);
  assert.equal((await updater.check()).reason, 'disposed');
  updater.dispose();
});

test('initial local-only mode never loads an updater, configures a feed, schedules or calls the network', async () => {
  const { updater, fake, timers, loaderCalls, sent } = harness({ autoUpdater: undefined, extra: { offline: true } });
  await flush();
  const state = updater.getState();
  assert.equal(state.status, 'offline');
  assert.equal(state.offline, true);
  assert.equal(state.notice, 'local-only');
  assert.equal(state.canCheck, false); assert.equal(state.canDownload, false); assert.equal(state.canInstall, false);
  assert.equal(state.manualDownload, false);
  assert.equal(state.nextCheckAt, null);
  for (const action of ['check', 'download', 'install']) assert.equal((await updater[action]()).reason, 'offline');
  assert.equal(loaderCalls(), 0); assert.equal(fake.feeds.length, 0); assert.equal(fake.checks, 0); assert.equal(fake.downloads, 0);
  assert.equal(timers.intervals.length, 0); assert.equal(timers.timeouts.length, 0);
  assert.equal(sent.at(-1).status, 'offline');
});

test('channels configured while local-only remain inactive until an explicit online transition', async () => {
  const { updater, fake, timers } = harness({ channel: undefined, onCheck: notAvailable(), extra: { offline: true } });
  assert.equal(updater.configureChannel(CHANNEL).ok, true);
  await flush();
  assert.equal(updater.getState().status, 'offline');
  assert.equal(fake.feeds.length, 0); assert.equal(fake.checks, 0); assert.equal(timers.intervals.length, 0);
  assert.equal(updater.setOffline(false).ok, true);
  await flush();
  assert.equal(fake.feeds.length, 1); assert.equal(fake.checks, 1); assert.equal(timers.intervals.length, 1);
  assert.equal(updater.getState().status, 'current');
  updater.setOffline(false);
  await flush();
  assert.equal(fake.checks, 1, 'the one-second settings poll must not create repeated startup checks');
  assert.equal(updater.setOffline('false').reason, 'invalid_offline');
});

test('enabling local-only stops the schedule and ignores late native events', async () => {
  const { updater, fake, timers } = harness({ onCheck: notAvailable() });
  await flush();
  updater.setOffline(true);
  assert.equal(timers.intervals[0].cleared, true);
  assert.equal(updater.getState().nextCheckAt, null);
  timers.intervals[0].fn();
  for (const name of ['checking-for-update', 'update-available', 'update-not-available', 'update-downloaded']) fake.emit(name, { version: '9.0.0' });
  fake.emit('download-progress', { percent: 90 });
  fake.emit('error', new Error('late request failure'));
  await flush();
  assert.equal(updater.getState().status, 'offline');
  assert.equal(updater.getState().error, null);
  assert.equal(fake.checks, 1);
  for (const action of ['check', 'download', 'install']) assert.equal((await updater[action]()).reason, 'offline');
});

test('a pending pre-offline check cannot overwrite state after online checks resume', async () => {
  let finishFirst;
  const { updater, fake } = harness({ onCheck: () => new Promise(resolve => { finishFirst = resolve; }) });
  await flush();
  const pending = updater.check();
  const oldAvailable = fake.listeners('update-available')[0];
  updater.setOffline(true);
  fake.onCheck = notAvailable('1.1.0');
  updater.setOffline(false);
  await flush();
  assert.equal(fake.checks, 1, 'fresh checks wait until an uncancellable old operation settles');
  oldAvailable({ version: '9.0.0' });
  assert.notEqual(updater.getState().latestVersion, '9.0.0');
  finishFirst({ isUpdateAvailable: true, updateInfo: { version: '9.0.0' } });
  assert.equal((await pending).reason, 'offline');
  await flush();
  assert.equal(fake.checks, 2);
  assert.equal(updater.getState().status, 'current');
  assert.equal(updater.getState().latestVersion, '1.1.0');
  oldAvailable({ version: '8.0.0' });
  assert.equal(updater.getState().latestVersion, '1.1.0', 'handlers retained by an old request are generation-bound');
});

test('local-only cancels metadata HTTP requests through the executor cancellation token', async () => {
  const fake = new FakeUpdater();
  let networkCalls = 0, networkToken;
  fake.httpExecutor = {
    request(_options, token) {
      networkCalls++;
      networkToken = token;
      return token.createPromise(() => {});
    },
  };
  const originalRequest = fake.httpExecutor.request;
  fake.onCheck = async u => {
    await u.httpExecutor.request({ hostname: 'api.github.com' });
    return { isUpdateAvailable: false, updateInfo: { version: '1.1.0' } };
  };
  const { updater } = harness({ fake });
  await flush();
  assert.equal(networkCalls, 1);
  const pending = updater.check();
  updater.setOffline(true);
  assert.equal(networkToken.cancelled, true);
  assert.equal((await pending).reason, 'offline');
  await assert.rejects(fake.httpExecutor.request({ hostname: 'api.github.com' }), /local-only/);
  assert.equal(networkCalls, 1, 'new metadata requests are rejected before reaching the native executor');
  assert.equal(updater.getState().checkedAt, null, 'a cancelled check is not recorded as a completed check');
  updater.dispose();
  assert.equal(fake.httpExecutor.request, originalRequest);
});

test('local-only cancels an active file download and rejects its late completion', async () => {
  const { updater, fake } = harness({ onCheck: available({ version: '1.2.0' }) });
  await flush();
  fake.onDownload = (_updater, token) => token.createPromise(() => {});
  const pending = updater.download();
  await flush();
  assert.equal(fake.downloads, 1);
  const token = fake.downloadArgs[0];
  updater.setOffline(true);
  assert.equal(token.cancelled, true);
  assert.equal((await pending).reason, 'offline');
  fake.emit('update-downloaded', { version: '1.2.0' });
  assert.equal(updater.getState().status, 'offline');
  assert.equal(updater.getState().canInstall, false);
  assert.equal((await updater.install()).reason, 'offline');
});

test('entering local-only cancels an installation queued before its IPC reply was delivered', async () => {
  const { updater, fake, timers } = harness({ onCheck: available({ version: '1.2.0' }) });
  await flush();
  fake.onDownload = u => { u.emit('update-downloaded', { version: '1.2.0' }); };
  await updater.download();
  assert.equal((await updater.install()).ok, true);
  updater.setOffline(true);
  timers.timeouts[0].fn();
  assert.deepEqual(fake.installs, []);
  assert.equal(updater.getState().installing, false);
  assert.equal(updater.getState().status, 'offline');
});

test('leaving local-only still respects development and missing-channel network gates', async () => {
  for (const options of [{ packaged: false }, { channel: undefined }]) {
    const { updater, fake, timers, loaderCalls } = harness({ ...options, extra: { offline: true } });
    updater.setOffline(false);
    await flush();
    assert.equal(updater.getState().status, options.packaged === false ? 'development' : 'setup_required');
    assert.equal(fake.feeds.length, 0); assert.equal(fake.checks, 0); assert.equal(loaderCalls(), 0);
    assert.equal(timers.intervals.length, 0);
  }
});

test('release notes become bounded plain text', () => {
  assert.equal(releaseNotesText([{ version: '1.2.0', note: '<p>A &lt;b&gt;</p>' }, { version: 'bad', note: 'B' }]), '1.2.0\nA <b>\n\nB');
  assert.equal(releaseNotesText({ evil: true }), null);
  assert.ok(releaseNotesText('x'.repeat(20000)).length <= 6000);
  assert.equal(releaseNotesText('a\u202Eb&#0;&#x110000;'), 'ab&#0;&#x110000;');
});

// ------------------------------------------------------------------ IPC wiring

function fakeWindow() {
  const mainFrame = { url: 'http://127.0.0.1:5000/', parent: null, processId: 1, routingId: 1 };
  const webContents = { mainFrame, sent: [], isDestroyed: () => false, send(channel, payload) { this.sent.push([channel, payload]); } };
  return { webContents, isDestroyed: () => false };
}

test('registerUpdateIpc answers only the main window top-level local frame', async () => {
  const handlers = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn), removeHandler: (name) => handlers.delete(name) };
  const win = fakeWindow();
  const calls = [];
  const updater = {
    getState: () => ({ status: 'current' }),
    check: (...args) => { calls.push(['check', args]); return { ok: true }; },
    download: (...args) => { calls.push(['download', args]); return { ok: true }; },
    install: (...args) => { calls.push(['install', args]); return { ok: true }; },
  };
  const remove = registerUpdateIpc({ ipcMain, updater, getMainWindow: () => win, isTrustedURL: (url) => url.startsWith('http://127.0.0.1:5000/') });
  assert.deepEqual([...handlers.keys()].sort(), [IPC_CHANNELS.check, IPC_CHANNELS.download, IPC_CHANNELS.getState, IPC_CHANNELS.install].sort());

  const ok = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  assert.deepEqual(handlers.get(IPC_CHANNELS.getState)(ok), { status: 'current' });
  handlers.get(IPC_CHANNELS.check)(ok, '9.9.9', 'https://evil.example');
  handlers.get(IPC_CHANNELS.download)(ok, 'https://evil.example/x.exe');
  assert.deepEqual(calls, [['check', []], ['download', []]]);

  const subframe = { url: 'http://127.0.0.1:5000/', parent: win.webContents.mainFrame, processId: 1, routingId: 2 };
  const rejected = [
    { sender: {}, senderFrame: win.webContents.mainFrame },
    { sender: win.webContents, senderFrame: subframe },
    { sender: win.webContents, senderFrame: null },
    { sender: win.webContents, senderFrame: { ...win.webContents.mainFrame, url: 'https://evil.example/' } },
  ];
  for (const event of rejected) assert.throws(() => handlers.get(IPC_CHANNELS.install)(event), /rejected/);
  assert.equal(calls.length, 2);

  remove();
  assert.equal(handlers.size, 0);
});

test('createStateSender pushes state to the main window only', () => {
  const win = fakeWindow();
  let current = win;
  const send = createStateSender(() => current);
  send({ status: 'checking' });
  assert.deepEqual(win.webContents.sent, [[IPC_CHANNELS.state, { status: 'checking' }]]);
  current = null;
  send({ status: 'current' });
  assert.equal(win.webContents.sent.length, 1);
});

// ------------------------------------------------------------------ preload

test('preload exposes exactly the narrow update bridge', async () => {
  const source = readFileSync(path.join(here, '..', 'desktop', 'preload.cjs'), 'utf8');
  const requires = [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(requires, ['electron']);
  for (const value of Object.values(IPC_CHANNELS)) assert.ok(source.includes(`'${value}'`), value);

  const exposed = [];
  const invoked = [];
  const listeners = new EventEmitter();
  const electron = {
    contextBridge: { exposeInMainWorld: (name, api) => exposed.push([name, api]) },
    ipcRenderer: {
      invoke: (...args) => { invoked.push(args); return Promise.resolve({ status: 'current' }); },
      on: (channel, fn) => listeners.on(channel, fn),
      removeListener: (channel, fn) => listeners.removeListener(channel, fn),
    },
  };
  const sandbox = { require: (name) => { if (name !== 'electron') throw new Error(`blocked ${name}`); return electron; } };
  vm.runInNewContext(source, sandbox, { filename: 'preload.cjs' });

  assert.equal(exposed.length, 1);
  const [name, api] = exposed[0];
  assert.equal(name, 'ImperiumDesktopUpdates');
  assert.deepEqual(Object.keys(api).sort(), ['check', 'download', 'getState', 'install', 'onState']);
  assert.ok(Object.isFrozen(api));

  await api.getState();
  await api.check('9.9.9');
  await api.download('https://evil.example');
  await api.install({ force: true });
  assert.deepEqual(invoked, [[IPC_CHANNELS.getState], [IPC_CHANNELS.check], [IPC_CHANNELS.download], [IPC_CHANNELS.install]]);

  const received = [];
  const unsubscribe = api.onState((...args) => received.push(args));
  listeners.emit(IPC_CHANNELS.state, { sender: 'secret-event' }, { status: 'checking' });
  assert.deepEqual(received, [[{ status: 'checking' }]], 'the IPC event object is never handed to the page');
  unsubscribe();
  unsubscribe();
  listeners.emit(IPC_CHANNELS.state, {}, { status: 'current' });
  assert.equal(received.length, 1);
  assert.equal(listeners.listenerCount(IPC_CHANNELS.state), 0);
  assert.throws(() => api.onState('nope'), { name: 'TypeError' }); // thrown from the vm realm
});

// ------------------------------------------------------------------ static safety

test('updater sources avoid unsafe patterns', () => {
  const updaterSource = readFileSync(path.join(here, '..', 'desktop', 'updater.cjs'), 'utf8');
  assert.doesNotMatch(updaterSource, /require\(\s*['"]electron['"]\s*\)/, 'updater.cjs stays testable outside Electron');
  assert.doesNotMatch(updaterSource, /autoInstallOnAppQuit\s*=\s*true|autoDownload\s*=\s*true/);
  assert.doesNotMatch(updaterSource, /verifyUpdateCodeSignature\s*=/);
  assert.doesNotMatch(updaterSource, /http:\/\//);
  const ui = readFileSync(path.join(here, '..', 'public', 'updates.js'), 'utf8');
  assert.doesNotMatch(ui, /\.\s*(?:innerHTML|outerHTML)\b|\binsertAdjacentHTML\s*\(|\bdocument\s*\.\s*write\s*\(|\beval\s*\(|new Function/);
  assert.match(ui, /window\.ImperiumUpdates\s*=/);
});

// ------------------------------------------------------------------ renderer UI

function loadUI(bridge, lang = 'ko') {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body><main id="root"></main></body></html>`, {
    url: 'http://127.0.0.1:4310/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
  });
  const { window } = dom;
  if (bridge) window.ImperiumDesktopUpdates = bridge;
  window.eval(readFileSync(path.join(here, '..', 'public', 'updates.js'), 'utf8'));
  return window;
}

function fakeBridge(initial) {
  let listener = null;
  const calls = [];
  return {
    calls,
    push: (state) => listener && listener(state),
    getState: () => Promise.resolve(initial),
    check: () => { calls.push('check'); return Promise.resolve({ ok: false, reason: 'rate_limited', state: initial }); },
    download: () => { calls.push('download'); return Promise.resolve({ ok: true, reason: null, state: { ...initial, status: 'downloading', canDownload: false } }); },
    install: () => { calls.push('install'); return Promise.resolve({ ok: true, reason: null, state: { ...initial, installing: true } }); },
    onState: (fn) => { listener = fn; return () => { listener = null; }; },
    get listening() { return listener !== null; },
  };
}

const baseState = {
  status: 'available', currentVersion: '1.1.0', latestVersion: '1.2.0', releaseName: 'Spring', releaseDate: '2026-11-17T12:00:00.000Z',
  releaseNotes: '<img src=x onerror="window.pwned=1"> notes', progress: null, error: null, platform: 'win32', mode: 'auto',
  notice: 'windows-unsigned', channel: { owner: 'imperium-dist', repo: 'imperium-releases', provider: 'github' },
  releasesURL: 'https://github.com/imperium-dist/imperium-releases/releases/latest', checkedAt: '2026-11-18T09:00:00.000Z',
  publisher: 'Sato Junichiro', codeSigned: false, integrity: 'sha512', installing: false,
  canCheck: true, canDownload: true, canInstall: false, manualDownload: false,
};

test('updates screen shows a desktop-only notice in a plain browser', () => {
  const window = loadUI(null, 'en');
  const root = window.document.getElementById('root');
  window.ImperiumUpdates.mount(root);
  const text = root.textContent;
  assert.match(text, /only in the IMPERIUM desktop app/);
  assert.equal(root.querySelector('.imp-updates__actions').hidden, true);
  assert.equal(root.querySelector('[role="status"]').hidden, true);
  assert.equal(root.querySelector('.imp-updates').getAttribute('data-status'), 'browser');
});

test('updates screen renders state as plain text, follows the document language and drives actions', async () => {
  const bridge = fakeBridge(baseState);
  const window = loadUI(bridge, 'ko');
  const { document } = window;
  const root = document.getElementById('root');
  window.ImperiumUpdates.mount(root);
  await flush();

  const section = root.querySelector('.imp-updates');
  assert.equal(section.getAttribute('data-status'), 'available');
  assert.equal(root.querySelector('h2').textContent, '업데이트');
  assert.equal(root.querySelector('[role="status"]').getAttribute('aria-live'), 'polite');
  assert.match(root.querySelector('.imp-updates__status-text').textContent, /새 버전/);
  assert.match(root.textContent, /1\.2\.0/);
  assert.match(root.textContent, /Sato Junichiro \(코드 서명 없음\)/);
  assert.equal(root.querySelector('.imp-updates__notes-body').textContent, baseState.releaseNotes);
  assert.equal(root.querySelectorAll('img').length, 0, 'remote notes never become markup');
  assert.equal(window.pwned, undefined);

  document.documentElement.lang = 'ja';
  await flush();
  assert.equal(root.querySelector('h2').textContent, 'アップデート');
  document.documentElement.lang = 'en';
  await flush();
  assert.equal(root.querySelector('h2').textContent, 'Updates');

  const buttons = () => [...root.querySelectorAll('button')].filter((b) => !b.hidden);
  const byText = (label) => buttons().find((b) => b.textContent === label);
  byText('Check now').click();
  await flush();
  assert.deepEqual(bridge.calls, ['check']);
  assert.match(root.querySelector('.imp-updates__message').textContent, /Checked just now/);

  byText('Download').click();
  await flush();
  assert.deepEqual(bridge.calls, ['check', 'download']);

  bridge.push({ ...baseState, status: 'downloading', canDownload: false, canCheck: false, progress: { percent: 42.4, transferred: 4 * 1024 * 1024, total: 10 * 1024 * 1024, bytesPerSecond: 1 } });
  const progress = root.querySelector('progress');
  assert.equal(progress.closest('[hidden]'), null);
  assert.equal(Number(progress.value), 42.4);
  assert.match(root.querySelector('.imp-updates__progress-text').textContent, /42% \(4\.0 MB \/ 10\.0 MB\)/);
  assert.equal(document.querySelector(`label[for="${progress.id}"]`).textContent, 'Download progress');

  bridge.push({ ...baseState, status: 'downloaded', canCheck: false, canDownload: false, canInstall: true, progress: { percent: 100, transferred: 10, total: 10, bytesPerSecond: 0 } });
  byText('Restart and install').click();
  assert.equal(bridge.calls.includes('install'), false, 'install needs a confirmation step');
  assert.equal(root.querySelector('.imp-updates__confirm').hidden, false);
  byText('Quit and install').click();
  await flush();
  assert.deepEqual(bridge.calls, ['check', 'download', 'install']);

  window.ImperiumUpdates.unmount();
  assert.equal(bridge.listening, false);
  assert.equal(root.children.length, 0);
});

test('updates screen shows safe errors, manual download link and setup state honestly', async () => {
  const errorState = { ...baseState, status: 'error', error: { code: 'no_release', message: 'HttpError: 404' }, canDownload: false };
  const bridge = fakeBridge(errorState);
  const window = loadUI(bridge, 'en');
  const root = window.document.getElementById('root');
  window.ImperiumUpdates.mount(root);
  await flush();
  const alert = root.querySelector('[role="alert"]');
  assert.equal(alert.hidden, false);
  assert.match(alert.textContent, /No published release/);
  assert.match(alert.textContent, /HttpError: 404/);
  assert.equal(root.querySelector('.imp-updates__notes').hidden, true);

  bridge.push({ ...baseState, mode: 'manual', notice: 'linux-package', manualDownload: true, canDownload: false });
  const link = root.querySelector('a.imp-updates__link');
  assert.equal(link.hidden, false);
  assert.equal(link.getAttribute('href'), baseState.releasesURL);
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.match(root.querySelector('.imp-updates__notice').textContent, /\.deb/);
  assert.equal([...root.querySelectorAll('button')].find((b) => b.textContent === 'Download').hidden, true);

  bridge.push({ ...baseState, mode: 'manual', manualDownload: true, releasesURL: 'https://evil.example/releases/latest' });
  assert.equal(link.hidden, true);
  assert.equal(link.hasAttribute('href'), false);

  bridge.push({ ...baseState, status: 'setup_required', latestVersion: null, channel: null, releasesURL: null, canCheck: false, canDownload: false, notice: null });
  assert.match(root.querySelector('.imp-updates__status-text').textContent, /No update channel is configured/);
  assert.match(root.textContent, /Not configured/);
  assert.equal([...root.querySelectorAll('button')].find((b) => b.textContent === 'Check now').disabled, true);
  assert.doesNotMatch(root.querySelector('.imp-updates__status-text').textContent, /latest version/i);
});
