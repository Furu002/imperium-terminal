'use strict';

/* IMPERIUM desktop auto-update controller (main process).
 *
 * Root usage (desktop/main.cjs):
 *   const { createUpdater, registerUpdateIpc, createStateSender } = require('./updater.cjs');
 *   const updater = createUpdater({
 *     app,
 *     sendState: createStateSender(() => mainWindow),
 *     channel: { owner: '<public-owner>', repo: '<public-repo>' },   // omit => setup_required, no network
 *   });
 *   const removeIpc = registerUpdateIpc({ ipcMain, updater, getMainWindow: () => mainWindow, isTrustedURL: isLocalPage });
 *   // on quit: removeIpc(); updater.dispose();
 *
 * Rules enforced here:
 *  - No network at all in local-only mode, or unless the app is packaged AND a valid public GitHub channel is configured.
 *  - Only GitHub (https://github.com / api.github.com) feeds built from validated owner/repo.
 *    No arbitrary feed URL, no tokens, no private repositories.
 *  - autoDownload=false, autoInstallOnAppQuit=false. Downloads and installs happen only on explicit
 *    user action. electron-updater verifies the downloaded file against the sha512 in the release
 *    metadata (latest*.yml). That is an integrity check, NOT a code signature.
 *  - verifyUpdateCodeSignature is left at the library default. For an unsigned Windows build the
 *    NSIS updater skips signature verification only when no publisherName is configured in
 *    app-update.yml, so do NOT set win.publisherName / signtoolOptions.publisherName in the
 *    electron-builder config until the build is really signed.
 *  - The renderer never supplies versions, URLs or feeds: every public action takes no arguments.
 *  - Errors exposed to the UI are redacted (tokens, credentials, query strings, user paths) and
 *    capped at 300 characters.
 *  - "current" is reported only after the update provider positively said no update exists.
 */

const IPC_CHANNELS = Object.freeze({
  getState: 'imperium:updates:getState',
  check: 'imperium:updates:check',
  download: 'imperium:updates:download',
  install: 'imperium:updates:install',
  state: 'imperium:updates:state',
});

const STATUSES = Object.freeze([
  'setup_required', 'development', 'checking', 'available', 'current',
  'downloading', 'downloaded', 'error', 'unsupported', 'offline',
]);

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MANUAL_COOLDOWN_MS = 60 * 1000;
const MAX_ERROR_LENGTH = 300;
const MAX_NOTES_LENGTH = 6000;
const MAX_NAME_LENGTH = 200;
const PUBLISHER = 'Sato Junichiro';

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const GENERIC_URL_RE = /^https:\/\/github\.com\/([^/?#\s]+)\/([^/?#\s]+)\/releases\/latest\/download\/?$/;
const VERSION_RE = /^v?(\d{1,6}\.\d{1,6}\.\d{1,6}(?:-[0-9A-Za-z.-]{1,40})?(?:\+[0-9A-Za-z.-]{1,40})?)$/;

const UPDATER_EVENTS = Object.freeze([
  'checking-for-update', 'update-available', 'update-not-available',
  'download-progress', 'update-downloaded', 'update-cancelled', 'error',
]);

// ---------------------------------------------------------------- validation helpers

function validOwner(value) {
  return typeof value === 'string' && OWNER_RE.test(value);
}

function validRepo(value) {
  return typeof value === 'string' && REPO_RE.test(value) && value !== '.' && value !== '..';
}

/**
 * Validate a public GitHub release channel and build the electron-updater feed options.
 * Accepts { owner, repo, provider?: 'github'|'generic' } or { url: 'https://github.com/<o>/<r>/releases/latest/download' }.
 * Returns null for null/undefined input. Throws TypeError for anything else that is not safe.
 */
function configureUpdateChannel(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Update channel must be an object.');
  const allowed = new Set(['owner', 'repo', 'provider', 'url']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new TypeError(`Unsupported update channel field: ${String(key).slice(0, 40)}`);
  }
  let { owner, repo, provider = 'github' } = input;
  if (input.url !== undefined) {
    const match = typeof input.url === 'string' ? GENERIC_URL_RE.exec(input.url) : null;
    if (!match) throw new TypeError('Only https://github.com/<owner>/<repo>/releases/latest/download is accepted as a feed URL.');
    if ((owner !== undefined && owner !== match[1]) || (repo !== undefined && repo !== match[2])) {
      throw new TypeError('Feed URL does not match owner/repo.');
    }
    owner = match[1];
    repo = match[2];
    provider = 'generic';
  }
  if (provider !== 'github' && provider !== 'generic') throw new TypeError('Update provider must be "github" or "generic".');
  if (!validOwner(owner)) throw new TypeError('Invalid GitHub owner.');
  if (!validRepo(repo)) throw new TypeError('Invalid GitHub repository name.');
  const feed = provider === 'github'
    ? Object.freeze({ provider: 'github', owner, repo, private: false, protocol: 'https', releaseType: 'release' })
    : Object.freeze({ provider: 'generic', url: `https://github.com/${owner}/${repo}/releases/latest/download`, useMultipleRangeRequest: false });
  return Object.freeze({
    provider,
    owner,
    repo,
    releasesURL: `https://github.com/${owner}/${repo}/releases/latest`,
    feed,
  });
}

function safeVersion(value) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const match = VERSION_RE.exec(value.trim());
  return match ? match[1] : null;
}

function safeDate(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8}|#39);/gi, (whole, name) => {
    const lower = name.toLowerCase();
    if (Object.hasOwn(named, lower)) return named[lower];
    if (lower.startsWith('#')) {
      const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) {
        return String.fromCodePoint(code);
      }
    }
    return whole;
  });
}

/** Convert remote release notes (often HTML from GitHub) to bounded plain text. */
function plainText(value, limit) {
  if (typeof value !== 'string') return null;
  const text = decodeEntities(value.slice(0, 200000)
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|li|h[1-6]|tr|pre|blockquote|ul|ol)\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, ''))
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function releaseNotesText(notes) {
  if (typeof notes === 'string') return plainText(notes, MAX_NOTES_LENGTH);
  if (Array.isArray(notes)) {
    const joined = notes.slice(0, 20).map((entry) => {
      const version = safeVersion(entry && entry.version);
      const note = entry && typeof entry.note === 'string' ? entry.note : '';
      return `${version ? `${version}\n` : ''}${note}`;
    }).join('\n\n');
    return plainText(joined, MAX_NOTES_LENGTH);
  }
  return null;
}

function singleLine(value, limit) {
  const text = plainText(value, limit);
  return text ? text.replace(/\s+/g, ' ') : null;
}

// ---------------------------------------------------------------- error handling

function redact(text) {
  return String(text)
    .split(/\bHeaders?:/i)[0]
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[redacted]')
    .replace(/\b(Bearer|token|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [redacted]')
    .replace(/\b(authorization|access_token|token|sig|signature|password|secret|x-amz-[a-z-]+)(["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi, '$1$2[redacted]')
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[redacted]@')
    .replace(/(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi, '$1')
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s"']+/gi, (match) => `${match.slice(0, match.indexOf('\\Users\\') + 7)}[user]`)
    .replace(/\/(Users|home)\/[^/\s"']+/g, '/$1/[user]')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeErrorMessage(error) {
  let raw = '';
  if (error && typeof error === 'object' && typeof error.message === 'string') raw = error.message;
  else if (typeof error === 'string') raw = error;
  const text = redact(raw) || 'Unknown update error.';
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1)}…` : text;
}

function errorCode(error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  const message = error && typeof error.message === 'string' ? error.message : String(error || '');
  const haystack = `${code} ${message}`;
  if (/sha512 checksum mismatch|checksum mismatch|ERR_CHECKSUM/i.test(haystack)) return 'integrity';
  if (/code signature|not signed|ERR_UPDATER_INVALID_SIGNATURE|signature verification/i.test(haystack)) return 'signature';
  if (/rate limit/i.test(haystack)) return 'github_rate_limited';
  if (/ERR_UPDATER_LATEST_VERSION_NOT_FOUND|Unable to find latest version|No published versions|\b404\b/i.test(haystack)) return 'no_release';
  if (/ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|Cannot find (?:channel|latest)|latest[-\w]*\.yml/i.test(haystack)) return 'metadata_missing';
  if (/\b40[13]\b/.test(haystack)) return 'access_denied';
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|net::ERR_|socket hang up|timeout/i.test(haystack)) return 'network';
  if (/ENOSPC/i.test(haystack)) return 'disk_full';
  return 'unknown';
}

// ---------------------------------------------------------------- platform support

function platformSupport(platform, env, options) {
  if (platform === 'win32') {
    // electron-updater cannot replace a portable .exe in place.
    if (env.PORTABLE_EXECUTABLE_DIR) return { mode: 'manual', notice: 'windows-portable' };
    return { mode: 'auto', notice: options.codeSigned ? null : 'windows-unsigned' };
  }
  if (platform === 'darwin') {
    // Squirrel.Mac refuses to install into an app that has no valid Developer ID signature, so
    // until the macOS build is signed we offer the release page instead of a doomed auto-install.
    if (options.macAutoInstall) return { mode: 'auto', notice: options.codeSigned ? null : 'mac-unsigned' };
    return { mode: 'manual', notice: 'mac-unsigned' };
  }
  if (platform === 'linux') {
    // Only an AppImage can update itself; .deb (and unpacked builds) use the release page.
    if (env.APPIMAGE) return { mode: 'auto', notice: null };
    return { mode: 'manual', notice: 'linux-package' };
  }
  return { mode: 'none', notice: 'platform-unsupported' };
}

// ---------------------------------------------------------------- controller

function createUpdater(options = {}) {
  const {
    app,
    sendState,
    platform = process.platform,
    env = process.env,
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    manualCooldownMs = MANUAL_COOLDOWN_MS,
    codeSigned = false,
    macAutoInstall = false,
    loadElectronUpdater = () => require('electron-updater'),
    createCancellationToken = parent => new (require('builder-util-runtime').CancellationToken)(parent),
  } = options;
  if (!app || typeof app.getVersion !== 'function') throw new TypeError('createUpdater requires the Electron app object.');
  const intervalMs = Math.max(MIN_CHECK_INTERVAL_MS, Number.isFinite(options.intervalMs) ? options.intervalMs : CHECK_INTERVAL_MS);
  const support = platformSupport(platform, env || {}, { codeSigned, macAutoInstall });
  const packaged = app.isPackaged === true;

  let channel = null;
  let channelError = null;
  try {
    channel = configureUpdateChannel(options.channel);
  } catch (error) {
    channelError = { code: 'invalid_channel', message: safeErrorMessage(error) };
  }

  let updater = null;
  let updaterFailed = false;
  let listeners = [];
  let inFlight = null;
  let downloading = null;
  let installing = false;
  let disposed = false;
  let interval = null;
  let lastManualCheckAt = -Infinity;
  let lastProgressSent = -1;
  let offline = options.offline === true;
  let generation = 0;
  let resumeRequested = false;
  let checkCancellation = null;
  let downloadCancellation = null;
  let checkRequest = null;
  let restoreRequest = null;

  const state = {
    status: 'setup_required',
    currentVersion: safeVersion(app.getVersion()),
    latestVersion: null,
    releaseName: null,
    releaseDate: null,
    releaseNotes: null,
    progress: null,
    error: channelError,
    platform: typeof platform === 'string' ? platform : 'unknown',
    mode: support.mode,
    notice: support.notice,
    channel: channel ? { owner: channel.owner, repo: channel.repo, provider: channel.provider } : null,
    releasesURL: channel ? channel.releasesURL : null,
    checkedAt: null,
    nextCheckAt: null,
    manualCheckAvailableAt: null,
    installing: false,
    publisher: PUBLISHER,
    codeSigned: Boolean(codeSigned),
    integrity: 'sha512',
    offline,
  };

  function eligible() {
    return !disposed && !offline && packaged && channel !== null && support.mode !== 'none' && !updaterFailed;
  }

  function baseStatus() {
    if (offline) return 'offline';
    if (support.mode === 'none') return 'unsupported';
    if (!packaged) return 'development';
    if (!channel) return 'setup_required';
    if (updaterFailed) return 'unsupported';
    return null;
  }

  function snapshot() {
    const busy = state.status === 'checking' || state.status === 'downloading' || state.status === 'downloaded' || installing;
    return JSON.parse(JSON.stringify({
      ...state,
      installing,
      canCheck: eligible() && !busy,
      canDownload: eligible() && support.mode === 'auto' && state.status === 'available' && !installing,
      canInstall: eligible() && support.mode === 'auto' && state.status === 'downloaded' && !installing,
      manualDownload: !offline && support.mode === 'manual' && state.releasesURL !== null,
    }));
  }

  function emit() {
    if (typeof sendState !== 'function' || disposed) return;
    try { sendState(snapshot()); } catch { /* a closed window must not break the updater */ }
  }

  function update(patch) {
    Object.assign(state, patch);
    emit();
  }

  function applyError(error, fallbackCode) {
    const code = fallbackCode || errorCode(error);
    update({ status: 'error', progress: null, error: { code, message: safeErrorMessage(error) } });
  }

  function applyAvailable(info) {
    const version = safeVersion(info && info.version);
    if (!version) {
      applyError(new Error('Update metadata did not contain a valid version.'), 'invalid_metadata');
      return;
    }
    update({
      status: 'available',
      latestVersion: version,
      releaseName: singleLine(info.releaseName, MAX_NAME_LENGTH),
      releaseDate: safeDate(info.releaseDate),
      releaseNotes: releaseNotesText(info.releaseNotes),
      progress: null,
      error: null,
    });
  }

  function applyCurrent(info) {
    update({
      status: 'current',
      latestVersion: safeVersion(info && info.version),
      releaseName: null,
      releaseDate: safeDate(info && info.releaseDate),
      releaseNotes: null,
      progress: null,
      error: null,
    });
  }

  function applyProgress(progress) {
    if (state.status !== 'downloading' && state.status !== 'available') return;
    const number = (value) => (Number.isFinite(value) && value >= 0 ? value : 0);
    const percent = Math.min(100, number(progress && progress.percent));
    const next = {
      percent: Math.round(percent * 10) / 10,
      transferred: number(progress && progress.transferred),
      total: number(progress && progress.total),
      bytesPerSecond: number(progress && progress.bytesPerSecond),
    };
    state.status = 'downloading';
    state.progress = next;
    const whole = Math.floor(next.percent);
    if (whole !== lastProgressSent) {
      lastProgressSent = whole;
      emit();
    }
  }

  function applyDownloaded(info) {
    const version = safeVersion(info && info.version) || state.latestVersion;
    update({
      status: 'downloaded',
      latestVersion: version,
      progress: state.progress ? { ...state.progress, percent: 100 } : { percent: 100, transferred: 0, total: 0, bytesPerSecond: 0 },
      error: null,
    });
  }

  function attach(candidate) {
    for (const [name, handler] of listeners) candidate.removeListener(name, handler);
    listeners = [];
    const epoch = generation;
    const handlers = {
      'checking-for-update': () => { if (state.status !== 'downloading') update({ status: 'checking', error: null }); },
      'update-available': (info) => applyAvailable(info),
      'update-not-available': (info) => applyCurrent(info),
      'download-progress': (progress) => applyProgress(progress),
      'update-downloaded': (info) => applyDownloaded(info),
      'update-cancelled': () => { if (state.status === 'downloading') update({ status: 'available', progress: null }); },
      error: (error) => applyError(error),
    };
    for (const name of UPDATER_EVENTS) {
      const handler = (...args) => { if (!disposed && !offline && generation === epoch) handlers[name](...args); };
      candidate.on(name, handler);
      listeners.push([name, handler]);
    }
  }

  function cancelRequests() {
    for (const token of new Set([checkCancellation, downloadCancellation])) {
      try { token?.cancel(); } catch { /* Cancellation must never re-enable traffic. */ }
    }
    try {
      if (typeof checkRequest?.abort === 'function') checkRequest.abort();
      else if (typeof checkRequest?.cancel === 'function') checkRequest.cancel();
    } catch {}
  }

  function guardMetadataRequests(candidate) {
    // checkForUpdates() has no cancellation argument. Its public HTTP executor
    // does, so give metadata requests a token tied to the current check as well.
    const executor = candidate.httpExecutor;
    if (typeof executor?.request !== 'function') return;
    const original = executor.request;
    const guarded = function (requestOptions, parentToken, data) {
      if (offline || disposed) return Promise.reject(new Error('Update networking is disabled in local-only mode.'));
      const owner = checkCancellation || downloadCancellation;
      if (!owner) return original.call(this, requestOptions, parentToken, data);
      const token = createCancellationToken(parentToken);
      const cancel = () => token.cancel();
      owner.once('cancel', cancel);
      if (owner.cancelled) cancel();
      const release = () => { owner.removeListener('cancel', cancel); token.dispose?.(); };
      try { return Promise.resolve(original.call(this, requestOptions, token, data)).finally(release); }
      catch (error) { release(); throw error; }
    };
    executor.request = guarded;
    restoreRequest = () => { if (executor.request === guarded) executor.request = original; };
  }

  function loadUpdater() {
    if (updater) return updater;
    if (updaterFailed || !eligible()) return null;
    try {
      let candidate = options.autoUpdater;
      if (typeof candidate === 'function') candidate = candidate();
      if (candidate === undefined) candidate = loadElectronUpdater().autoUpdater;
      if (!candidate || typeof candidate.on !== 'function' || typeof candidate.checkForUpdates !== 'function') {
        throw new Error('electron-updater is not available.');
      }
      candidate.autoDownload = false;
      candidate.autoInstallOnAppQuit = false;
      candidate.allowPrerelease = false;
      candidate.allowDowngrade = false;
      candidate.fullChangelog = false;
      if (platform === 'win32') candidate.disableWebInstaller = true;
      candidate.logger = null;
      guardMetadataRequests(candidate);
      candidate.setFeedURL(channel.feed);
      attach(candidate);
      updater = candidate;
      return updater;
    } catch (error) {
      updaterFailed = true;
      update({ status: 'unsupported', error: { code: 'updater_unavailable', message: safeErrorMessage(error) } });
      return null;
    }
  }

  function refusal(reason) {
    return { ok: false, reason, state: snapshot() };
  }

  function runCheck() {
    if (offline) return Promise.resolve(refusal('offline'));
    if (inFlight) return inFlight;
    const instance = loadUpdater();
    if (!instance) return Promise.resolve(refusal(baseStatus() || 'unavailable'));
    update({ status: 'checking', error: null, progress: null });
    const epoch = generation;
    const token = createCancellationToken();
    checkCancellation = token;
    let operation;
    operation = (async () => {
      // Set the in-flight handle before a synchronous library error can settle it.
      await Promise.resolve();
      try {
        if (offline || epoch !== generation) return refusal('offline');
        checkRequest = instance.checkForUpdates();
        const result = await checkRequest;
        if (disposed) return refusal('disposed');
        if (offline || epoch !== generation) { result?.cancellationToken?.cancel(); return refusal('offline'); }
        downloadCancellation = result?.cancellationToken || null;
        if (state.status === 'checking') {
          // Events normally settle the state; fall back to the resolved result, never to a guess.
          if (!result) applyError(new Error('The update service is not active for this build.'), 'updater_inactive');
          else if (result.isUpdateAvailable === true) applyAvailable(result.updateInfo);
          else if (result.isUpdateAvailable === false) applyCurrent(result.updateInfo);
          else applyError(new Error('The update service returned no result.'), 'no_result');
        }
      } catch (error) {
        // The 'error' event may already have reported this failure.
        if (disposed) return refusal('disposed');
        if (offline || epoch !== generation) return refusal('offline');
        if (!disposed && state.status !== 'error') applyError(error);
      } finally {
        if (inFlight === operation) inFlight = null;
        if (checkCancellation === token) { checkCancellation = null; checkRequest = null; }
        token.dispose?.();
        if (!disposed && !offline && epoch === generation) update({ checkedAt: new Date(now()).toISOString() });
        resumeIfIdle();
      }
      return { ok: state.status !== 'error', reason: state.status === 'error' ? state.error && state.error.code : null, state: snapshot() };
    })();
    inFlight = operation;
    return inFlight;
  }

  function scheduledCheck() {
    if (!eligible() || installing || inFlight) return;
    if (state.status === 'downloading' || state.status === 'downloaded') return;
    state.nextCheckAt = new Date(now() + intervalMs).toISOString();
    void runCheck();
  }

  async function check() {
    if (disposed) return refusal('disposed');
    const blocked = baseStatus();
    if (blocked) return refusal(blocked);
    if (resumeRequested && inFlight) return refusal('busy');
    if (inFlight) return inFlight;
    if (installing || state.status === 'downloading' || state.status === 'downloaded') return refusal('busy');
    const current = now();
    if (current - lastManualCheckAt < manualCooldownMs) {
      state.manualCheckAvailableAt = new Date(lastManualCheckAt + manualCooldownMs).toISOString();
      return refusal('rate_limited');
    }
    lastManualCheckAt = current;
    state.manualCheckAvailableAt = new Date(current + manualCooldownMs).toISOString();
    return runCheck();
  }

  async function download() {
    if (disposed) return refusal('disposed');
    if (offline) return refusal('offline');
    if (support.mode !== 'auto') return refusal('manual_download');
    if (!eligible() || !updater) return refusal(baseStatus() || 'unavailable');
    if (downloading) return downloading;
    if (state.status !== 'available') return refusal('not_available');
    lastProgressSent = -1;
    update({ status: 'downloading', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }, error: null });
    const epoch = generation;
    const token = downloadCancellation && !downloadCancellation.cancelled ? downloadCancellation : createCancellationToken();
    downloadCancellation = token;
    let operation;
    operation = (async () => {
      await Promise.resolve();
      try {
        if (disposed) return refusal('disposed');
        if (offline || epoch !== generation) return refusal('offline');
        await updater.downloadUpdate(token);
        if (disposed) return refusal('disposed');
        if (offline || epoch !== generation) return refusal('offline');
        // downloadUpdate resolves only after the file was written and its sha512 verified.
        if (!disposed && state.status === 'downloading') applyDownloaded({ version: state.latestVersion });
      } catch (error) {
        if (offline || epoch !== generation) return refusal('offline');
        if (!disposed && state.status !== 'error') applyError(error);
      } finally {
        if (downloading === operation) downloading = null;
        if (downloadCancellation === token) downloadCancellation = null;
        token.dispose?.();
        resumeIfIdle();
      }
      return { ok: state.status === 'downloaded', reason: state.status === 'downloaded' ? null : (state.error && state.error.code) || 'download_failed', state: snapshot() };
    })();
    downloading = operation;
    return downloading;
  }

  async function install() {
    if (disposed) return refusal('disposed');
    if (offline) return refusal('offline');
    if (support.mode !== 'auto') return refusal('manual_download');
    if (!eligible() || !updater) return refusal(baseStatus() || 'unavailable');
    if (installing) return refusal('installing');
    if (state.status !== 'downloaded') return refusal('not_downloaded');
    installing = true;
    const epoch = generation;
    emit();
    // Let the IPC reply reach the renderer before the app starts quitting.
    setTimeoutFn(() => {
      if (disposed || offline || epoch !== generation) return;
      try {
        // isSilent=false shows the NSIS installer UI; isForceRunAfter=true relaunches IMPERIUM.
        updater.quitAndInstall(false, true);
      } catch (error) {
        installing = false;
        applyError(error);
      }
    }, 0);
    return { ok: true, reason: null, state: snapshot() };
  }

  function configureChannel(next) {
    if (disposed) return refusal('disposed');
    if (inFlight || downloading || installing) return refusal('busy');
    let parsed;
    try {
      parsed = configureUpdateChannel(next);
    } catch (error) {
      update({ error: { code: 'invalid_channel', message: safeErrorMessage(error) } });
      return refusal('invalid_channel');
    }
    channel = parsed;
    if (updater && channel && !offline) updater.setFeedURL(channel.feed);
    update({
      channel: channel ? { owner: channel.owner, repo: channel.repo, provider: channel.provider } : null,
      releasesURL: channel ? channel.releasesURL : null,
      status: baseStatus() || 'checking',
      latestVersion: null, releaseName: null, releaseDate: null, releaseNotes: null, progress: null, error: null,
    });
    if (eligible()) {
      startSchedule();
      void runCheck();
    }
    return { ok: true, reason: null, state: snapshot() };
  }

  function startSchedule() {
    if (interval || !eligible()) return;
    interval = setIntervalFn(scheduledCheck, intervalMs);
    if (interval && typeof interval.unref === 'function') interval.unref();
    state.nextCheckAt = new Date(now() + intervalMs).toISOString();
  }

  function resumeIfIdle() {
    if (!resumeRequested || offline || disposed || inFlight || downloading || installing) return;
    resumeRequested = false;
    if (!eligible()) return;
    if (updater) { updater.setFeedURL(channel.feed); attach(updater); }
    startSchedule();
    void runCheck();
  }

  function setOffline(value) {
    if (disposed) return refusal('disposed');
    if (typeof value !== 'boolean') return refusal('invalid_offline');
    if (offline === value) return { ok: true, reason: null, state: snapshot() };
    offline = value;
    generation++;
    if (interval) clearIntervalFn(interval);
    interval = null;
    if (offline) {
      resumeRequested = false;
      installing = false;
      update({ status: 'offline', offline: true, notice: 'local-only', progress: null, error: null, nextCheckAt: null, manualCheckAvailableAt: null });
      cancelRequests();
    } else {
      lastManualCheckAt = -Infinity;
      resumeRequested = true;
      update({ status: baseStatus() || 'checking', offline: false, notice: support.notice, progress: null, error: channelError });
      resumeIfIdle();
    }
    return { ok: true, reason: null, state: snapshot() };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    resumeRequested = false;
    cancelRequests();
    if (interval) clearIntervalFn(interval);
    interval = null;
    if (updater && typeof updater.removeListener === 'function') {
      for (const [name, handler] of listeners) updater.removeListener(name, handler);
    }
    listeners = [];
    restoreRequest?.();
  }

  // Initial state: never claim "current" before the provider has answered.
  state.status = baseStatus() || 'checking';
  if (offline) state.notice = 'local-only';
  if (eligible()) {
    startSchedule();
    void runCheck(); // startup check; later checks every 30 minutes
  } else {
    emit();
  }

  return {
    getState: snapshot,
    check,
    download,
    install,
    configureChannel,
    setOffline,
    dispose,
  };
}

// ---------------------------------------------------------------- IPC wiring helpers (optional for root)

function isTopLevelSender(event, contents) {
  if (!event || !contents || event.sender !== contents) return false;
  const frame = event.senderFrame;
  const main = contents.mainFrame;
  if (!frame || !main) return false;
  if (frame === main) return true;
  return frame.parent === null && frame.processId === main.processId && frame.routingId === main.routingId;
}

/** Register ipcMain handlers that only answer the main window's top-level frame. Returns an unregister function. */
function registerUpdateIpc({ ipcMain, updater, getMainWindow, isTrustedURL }) {
  const guard = (event) => {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!win || (typeof win.isDestroyed === 'function' && win.isDestroyed())) return false;
    if (!isTopLevelSender(event, win.webContents)) return false;
    if (typeof isTrustedURL === 'function' && !isTrustedURL(event.senderFrame.url)) return false;
    return true;
  };
  const actions = {
    [IPC_CHANNELS.getState]: () => updater.getState(),
    [IPC_CHANNELS.check]: () => updater.check(),
    [IPC_CHANNELS.download]: () => updater.download(),
    [IPC_CHANNELS.install]: () => updater.install(),
  };
  for (const [channelName, action] of Object.entries(actions)) {
    // Renderer arguments are deliberately ignored: versions/URLs never come from the page.
    ipcMain.handle(channelName, (event) => {
      if (!guard(event)) throw new Error('IMPERIUM updater: request rejected.');
      return action();
    });
  }
  return () => {
    for (const channelName of Object.keys(actions)) ipcMain.removeHandler(channelName);
  };
}

/** sendState implementation that pushes to the main window only. */
function createStateSender(getMainWindow) {
  return (state) => {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(IPC_CHANNELS.state, state);
  };
}

module.exports = {
  IPC_CHANNELS,
  STATUSES,
  CHECK_INTERVAL_MS,
  MANUAL_COOLDOWN_MS,
  PUBLISHER,
  createUpdater,
  configureUpdateChannel,
  registerUpdateIpc,
  createStateSender,
  safeErrorMessage,
  releaseNotesText,
  platformSupport,
};
