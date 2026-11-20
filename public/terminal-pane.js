/* IMPERIUM interactive terminal pane.
 *
 * Requires browser globals loaded before this file:
 *   /vendor/xterm.js            -> window.Terminal
 *   /vendor/xterm-addon-fit.js  -> window.FitAddon.FitAddon
 * and the stylesheet /vendor/xterm.css.
 *
 * Safety rules:
 *  - Shells start only when the user clicks "New session" (or root passes
 *    autoStart:true after an explicit user navigation). Never on app startup.
 *  - Commands arriving via 'imperium:terminal-command' or paste() are only
 *    staged in a draft field. Inserting them sends the text WITHOUT Enter;
 *    the user decides whether to run it.
 *  - Terminal output goes to xterm only (xterm.write handles ANSI). No
 *    innerHTML, no link/clipboard add-ons, no storage of terminal data.
 */
(function () {
  'use strict';

  var MAX_INPUT_CHUNK = 32000;
  var COLS_MIN = 20, COLS_MAX = 400, ROWS_MIN = 5, ROWS_MAX = 200;
  var FONT_FALLBACK = '"JetBrains Mono", "Cascadia Code", Consolas, "D2Coding", "Malgun Gothic", monospace';

  var LABELS = {
    en: {
      title: 'Terminal', newSession: 'New session', clear: 'Clear', close: 'Close session',
      session: 'Session', shell: 'Shell', cwd: 'Folder', status: 'Status',
      running: 'Running', closed: 'Exited', starting: 'Starting…', none: 'No session',
      empty: 'No terminal session. Click "New session" to open a shell in the current workspace.',
      draft: 'Command draft — not executed', insert: 'Insert into terminal (no Enter)', dismiss: 'Dismiss',
      needSession: 'Start a session first, then insert.', exited: 'process exited', error: 'Error',
      shellDefault: 'Default', missingLib: 'Terminal library failed to load.',
    },
    ko: {
      title: '터미널', newSession: '새 세션', clear: '지우기', close: '세션 닫기',
      session: '세션', shell: '셸', cwd: '폴더', status: '상태',
      running: '실행 중', closed: '종료됨', starting: '시작 중…', none: '세션 없음',
      empty: '터미널 세션이 없습니다. "새 세션"을 눌러 현재 작업공간에서 셸을 여세요.',
      draft: '명령 초안 — 실행되지 않음', insert: '터미널에 입력 (Enter 없음)', dismiss: '닫기',
      needSession: '먼저 세션을 시작한 뒤 입력하세요.', exited: '프로세스 종료', error: '오류',
      shellDefault: '기본', missingLib: '터미널 라이브러리를 불러오지 못했습니다.',
    },
    ja: {
      title: 'ターミナル', newSession: '新しいセッション', clear: 'クリア', close: 'セッションを閉じる',
      session: 'セッション', shell: 'シェル', cwd: 'フォルダー', status: '状態',
      running: '実行中', closed: '終了', starting: '起動中…', none: 'セッションなし',
      empty: 'ターミナルセッションがありません。「新しいセッション」を押して現在のワークスペースでシェルを開きます。',
      draft: 'コマンド下書き — 未実行', insert: 'ターミナルに入力 (Enter なし)', dismiss: '閉じる',
      needSession: '先にセッションを開始してください。', exited: 'プロセス終了', error: 'エラー',
      shellDefault: '既定', missingLib: 'ターミナルライブラリを読み込めませんでした。',
    },
  };

  var THEME = {
    background: '#0a0c0e', foreground: '#d6dce1', cursor: '#ff7b35', cursorAccent: '#0a0c0e',
    selectionBackground: 'rgba(255, 123, 53, 0.32)',
    black: '#14181c', red: '#f17b7b', green: '#75d5a0', yellow: '#f2c46d', blue: '#6aa7ff', magenta: '#c49bf0', cyan: '#68c6df', white: '#d6dce1',
    brightBlack: '#5c6873', brightRed: '#ff9a9a', brightGreen: '#93e6b8', brightYellow: '#ffd98a', brightBlue: '#8fbfff', brightMagenta: '#d8b8ff', brightCyan: '#8ad8ec', brightWhite: '#f3f6f8',
  };

  var ctx = null;          // mounted pane state
  var pendingDraft = null; // command received before mount

  function normalizeLanguage(value) {
    var lang = String(value || '').toLowerCase().slice(0, 2);
    return LABELS[lang] ? lang : 'en';
  }
  function readTerminalFont() {
    return window.getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || FONT_FALLBACK;
  }
  function syncTerminalFont(mounted) {
    function update() {
      if (ctx !== mounted || !mounted.term) return;
      var fontFamily = readTerminalFont();
      if (mounted.term.options.fontFamily !== fontFamily) {
        mounted.term.options.fontFamily = fontFamily;
        scheduleFit();
      }
    }
    if (document.fonts?.status === 'loading') {
      // xterm measures the cell using its current font. Switching from the
      // initial face after the web font loads triggers a fresh measurement.
      document.fonts.ready.then(update).catch(function () { /* keep fallback */ });
    } else update();
  }
  function t(key) {
    var lang = ctx ? ctx.language : 'en';
    return (LABELS[lang] && LABELS[lang][key]) || LABELS.en[key] || key;
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function sessionPath(id, suffix) {
    return '/api/terminal/' + encodeURIComponent(id) + (suffix ? '/' + suffix : '');
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value | 0)); }
  function detectPlatform() {
    var ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
    if (/win/i.test(ua)) return 'win32';
    if (/mac/i.test(ua)) return 'darwin';
    return 'linux';
  }
  function shellChoices() {
    var platform = detectPlatform();
    if (platform === 'win32') return ['default', 'powershell', 'cmd'];
    if (platform === 'darwin') return ['default', 'zsh', 'bash'];
    return ['default', 'bash', 'zsh'];
  }
  // Text staged from outside may not contain line breaks or control
  // characters: those would submit or alter the command line.
  function sanitizeCommand(command) {
    return String(command == null ? '' : command)
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u0080-\u009f]/g, '')
      .slice(0, MAX_INPUT_CHUNK);
  }

  function activeSession() {
    if (!ctx || !ctx.activeId) return null;
    for (var i = 0; i < ctx.sessions.length; i++) if (ctx.sessions[i].id === ctx.activeId) return ctx.sessions[i];
    return null;
  }
  function isActiveRunning() {
    var session = activeSession();
    return !!(session && session.status === 'running');
  }

  function showError(error) {
    if (!ctx) return;
    var message = (error && error.message) ? error.message : String(error || '');
    ctx.ui.error.textContent = message ? t('error') + ': ' + message : '';
    ctx.ui.error.hidden = !message;
  }
  function clearError() { if (ctx) { ctx.ui.error.textContent = ''; ctx.ui.error.hidden = true; } }

  // ---------- labels / chrome ----------

  function applyLabels() {
    var ui = ctx.ui;
    ui.title.textContent = t('title');
    ui.newButton.textContent = t('newSession');
    ui.clearButton.textContent = t('clear');
    ui.closeButton.textContent = t('close');
    ui.sessionSelect.setAttribute('aria-label', t('session'));
    ui.shellSelect.setAttribute('aria-label', t('shell'));
    for (var i = 0; i < ui.shellSelect.options.length; i++) {
      var option = ui.shellSelect.options[i];
      option.textContent = option.value === 'default' ? t('shellDefault') : option.value;
    }
    ui.empty.textContent = t('empty');
    ui.draftLabel.textContent = t('draft');
    ui.insertButton.textContent = t('insert');
    ui.dismissButton.textContent = t('dismiss');
    ui.draftHint.textContent = t('needSession');
    updateChrome();
  }

  function updateChrome() {
    if (!ctx) return;
    var ui = ctx.ui;
    var select = ui.sessionSelect;
    while (select.firstChild) select.removeChild(select.firstChild);
    if (!ctx.sessions.length) {
      var placeholder = el('option', '', t('none'));
      placeholder.value = '';
      select.appendChild(placeholder);
    }
    ctx.sessions.forEach(function (session, index) {
      var option = el('option', '', (index + 1) + ' · ' + session.shell + ' · ' + (session.status === 'running' ? t('running') : t('closed')));
      option.value = session.id;
      if (session.id === ctx.activeId) option.selected = true;
      select.appendChild(option);
    });
    select.disabled = !ctx.sessions.length;

    var session = activeSession();
    ui.shellValue.textContent = session ? session.shell : '—';
    ui.cwdValue.textContent = session ? session.cwd : '—';
    ui.cwdValue.title = session ? session.cwd : '';
    ui.statusValue.textContent = ctx.starting ? t('starting') : session ? (session.status === 'running' ? t('running') : t('closed')) : t('none');
    ui.statusDot.className = 'imperium-terminal__dot' + (session && session.status === 'running' ? ' is-running' : session ? ' is-closed' : '');
    ui.shellLabel.textContent = t('shell');
    ui.cwdLabel.textContent = t('cwd');
    ui.statusLabel.textContent = t('status');
    ui.closeButton.disabled = !session;
    ui.clearButton.disabled = !session;
    ui.newButton.disabled = ctx.starting;
    ui.empty.hidden = !!session;
    ui.insertButton.disabled = !isActiveRunning() || !ui.draftInput.value;
    ui.draftHint.hidden = isActiveRunning();
  }

  // ---------- server sync ----------

  function refreshSessions() {
    if (!ctx) return Promise.resolve();
    var mounted = ctx;
    return mounted.api('/api/terminal').then(function (result) {
      if (ctx !== mounted) return;
      mounted.sessions = Array.isArray(result && result.sessions) ? result.sessions : [];
      if (mounted.activeId && !activeSession()) mounted.activeId = null;
      updateChrome();
    });
  }

  function openStream(id) {
    closeStream();
    if (!ctx || !id || typeof EventSource !== 'function') return;
    var mounted = ctx;
    var source = new EventSource(sessionPath(id, 'events'));
    mounted.stream = source;
    mounted.streamId = id;
    source.addEventListener('open', function () {
      // The server replays its RAM buffer on every (re)connect; reset first
      // so a reconnect does not duplicate the screen.
      if (ctx === mounted && mounted.stream === source) mounted.term.reset();
    });
    source.addEventListener('data', function (event) {
      if (ctx !== mounted || mounted.stream !== source) return;
      try {
        var payload = JSON.parse(event.data);
        if (payload && typeof payload.data === 'string') mounted.term.write(payload.data);
      } catch (_) { /* ignore malformed frame */ }
    });
    source.addEventListener('exit', function (event) {
      if (ctx !== mounted || mounted.stream !== source) return;
      var code = null;
      try { code = JSON.parse(event.data).exitCode; } catch (_) { /* ignore */ }
      mounted.term.write('\r\n\x1b[2m[' + t('exited') + (code === null || code === undefined ? '' : ' ' + Number(code)) + ']\x1b[0m\r\n');
      mounted.sessions.forEach(function (session) { if (session.id === id) session.status = 'closed'; });
      closeStream();
      updateChrome();
    });
    source.onerror = function () {
      // EventSource retries on its own. If the session is gone, stop retrying.
      if (ctx !== mounted || mounted.stream !== source) return;
      refreshSessions().then(function () {
        if (ctx === mounted && mounted.stream === source && !isActiveRunning()) closeStream();
      }).catch(function () { /* server unavailable; EventSource keeps retrying */ });
    };
  }

  function closeStream() {
    if (!ctx || !ctx.stream) return;
    try { ctx.stream.close(); } catch (_) { /* ignore */ }
    ctx.stream = null;
    ctx.streamId = null;
  }

  function selectSession(id) {
    if (!ctx) return;
    flushInput();
    ctx.activeId = id || null;
    ctx.lastSize = null;
    ctx.term.reset();
    updateChrome();
    if (id) {
      openStream(id);
      scheduleFit();
      ctx.term.focus();
    } else {
      closeStream();
    }
  }

  function newSession() {
    if (!ctx || ctx.starting) return Promise.resolve();
    var mounted = ctx;
    clearError();
    fitNow();
    mounted.starting = true;
    updateChrome();
    var body = {
      shell: mounted.ui.shellSelect.value || 'default',
      cols: clamp(mounted.term.cols, COLS_MIN, COLS_MAX),
      rows: clamp(mounted.term.rows, ROWS_MIN, ROWS_MAX),
    };
    return mounted.api('/api/terminal', { method: 'POST', body: body }).then(function (result) {
      if (ctx !== mounted) return;
      var session = result && result.session;
      if (!session || !session.id) throw new Error('No session returned');
      return refreshSessions().then(function () {
        if (!mounted.sessions.some(function (s) { return s.id === session.id; })) mounted.sessions.push(session);
        selectSession(session.id);
      });
    }).catch(showError).then(function () {
      if (ctx === mounted) { mounted.starting = false; updateChrome(); }
    });
  }

  function closeActive() {
    if (!ctx || !ctx.activeId) return Promise.resolve();
    var mounted = ctx;
    var id = mounted.activeId;
    flushInput();
    closeStream();
    return mounted.api(sessionPath(id, 'close'), { method: 'POST', body: {} }).catch(function (error) {
      if (!error || error.status !== 404) showError(error);
    }).then(function () { return refreshSessions(); }).then(function () {
      if (ctx !== mounted) return;
      var next = mounted.sessions.filter(function (s) { return s.status === 'running'; })[0] || mounted.sessions[0];
      selectSession(next ? next.id : null);
    }).catch(showError);
  }

  // ---------- input ----------

  function queueInput(data) {
    if (!ctx || !isActiveRunning() || typeof data !== 'string' || !data) return;
    ctx.inputBuffer += data;
    if (!ctx.inputTimer) ctx.inputTimer = setTimeout(flushInput, 8);
  }

  function flushInput() {
    if (!ctx) return;
    if (ctx.inputTimer) { clearTimeout(ctx.inputTimer); ctx.inputTimer = null; }
    var data = ctx.inputBuffer;
    ctx.inputBuffer = '';
    var id = ctx.activeId;
    if (!data || !id) return;
    var mounted = ctx;
    while (data) {
      var size = Math.min(MAX_INPUT_CHUNK, data.length);
      // Do not split a UTF-16 surrogate pair across requests.
      var code = data.charCodeAt(size - 1);
      if (size < data.length && code >= 0xd800 && code <= 0xdbff) size -= 1;
      var chunk = data.slice(0, size);
      data = data.slice(size);
      mounted.sendChain = mounted.sendChain.then(sendChunk(mounted, id, chunk));
    }
  }

  function sendChunk(mounted, id, chunk) {
    return function () {
      return mounted.api(sessionPath(id, 'input'), { method: 'POST', body: { data: chunk } }).catch(function (error) {
        if (ctx === mounted) {
          if (error && error.status === 409) refreshSessions().catch(function () {});
          else showError(error);
        }
      });
    };
  }

  // ---------- sizing ----------

  function fitNow() {
    if (!ctx || !ctx.fit) return;
    var host = ctx.ui.host;
    if (!host.isConnected || host.clientWidth < 20 || host.clientHeight < 20) return; // hidden view
    try { ctx.fit.fit(); } catch (_) { return; }
    var cols = clamp(ctx.term.cols, COLS_MIN, COLS_MAX);
    var rows = clamp(ctx.term.rows, ROWS_MIN, ROWS_MAX);
    if (!isActiveRunning()) return;
    var key = ctx.activeId + ':' + cols + 'x' + rows;
    if (ctx.lastSize === key) return;
    ctx.lastSize = key;
    if (ctx.resizeTimer) clearTimeout(ctx.resizeTimer);
    var mounted = ctx;
    var id = ctx.activeId;
    ctx.resizeTimer = setTimeout(function () {
      mounted.resizeTimer = null;
      mounted.api(sessionPath(id, 'resize'), { method: 'POST', body: { cols: cols, rows: rows } }).then(function () {
        mounted.sessions.forEach(function (s) { if (s.id === id) { s.cols = cols; s.rows = rows; } });
      }).catch(function (error) { if (error && error.status !== 409 && error.status !== 404 && ctx === mounted) showError(error); });
    }, 120);
  }

  function scheduleFit() {
    if (!ctx || ctx.fitFrame) return;
    var mounted = ctx;
    ctx.fitFrame = requestAnimationFrame(function () { mounted.fitFrame = null; if (ctx === mounted) fitNow(); });
  }

  // ---------- command draft ----------

  function showDraft(command) {
    if (!ctx) return;
    var text = sanitizeCommand(command);
    ctx.ui.draftInput.value = text;
    ctx.ui.draft.hidden = !text;
    updateChrome();
    if (text) ctx.ui.draftInput.focus();
  }

  function insertDraft() {
    if (!ctx) return;
    var text = sanitizeCommand(ctx.ui.draftInput.value);
    if (!text || !isActiveRunning()) { updateChrome(); return; }
    queueInput(text); // no carriage return: the user presses Enter themselves
    flushInput();
    ctx.ui.draftInput.value = '';
    ctx.ui.draft.hidden = true;
    updateChrome();
    ctx.term.focus();
  }

  function requestOpenView() {
    try { window.dispatchEvent(new CustomEvent('imperium:open-terminal')); } catch (_) { /* ignore */ }
  }

  function paste(command) {
    var text = sanitizeCommand(command);
    if (!text) return;
    requestOpenView();
    if (ctx) showDraft(text);
    else pendingDraft = text;
  }

  window.addEventListener('imperium:terminal-command', function (event) {
    var detail = event && event.detail;
    paste(detail && typeof detail.command === 'string' ? detail.command : '');
  });

  // ---------- lifecycle ----------

  function buildDom(container) {
    var ui = {};
    ui.root = el('section', 'imperium-terminal');
    var toolbar = el('div', 'imperium-terminal__toolbar');
    ui.title = el('strong', 'imperium-terminal__title');
    ui.sessionSelect = el('select', 'imperium-terminal__select');
    ui.shellSelect = el('select', 'imperium-terminal__select imperium-terminal__shell-select');
    shellChoices().forEach(function (choice) {
      var option = el('option', '', choice);
      option.value = choice;
      ui.shellSelect.appendChild(option);
    });
    ui.newButton = el('button', 'imperium-terminal__button is-primary');
    ui.clearButton = el('button', 'imperium-terminal__button');
    ui.closeButton = el('button', 'imperium-terminal__button is-danger');
    [ui.newButton, ui.clearButton, ui.closeButton].forEach(function (b) { b.type = 'button'; });
    var spacer = el('span', 'imperium-terminal__spacer');
    toolbar.appendChild(ui.title);
    toolbar.appendChild(ui.sessionSelect);
    toolbar.appendChild(spacer);
    toolbar.appendChild(ui.shellSelect);
    toolbar.appendChild(ui.newButton);
    toolbar.appendChild(ui.clearButton);
    toolbar.appendChild(ui.closeButton);

    var meta = el('div', 'imperium-terminal__meta');
    ui.statusDot = el('span', 'imperium-terminal__dot');
    ui.statusLabel = el('span', 'imperium-terminal__meta-label');
    ui.statusValue = el('span', 'imperium-terminal__meta-value');
    ui.shellLabel = el('span', 'imperium-terminal__meta-label');
    ui.shellValue = el('span', 'imperium-terminal__meta-value');
    ui.cwdLabel = el('span', 'imperium-terminal__meta-label');
    ui.cwdValue = el('span', 'imperium-terminal__meta-value imperium-terminal__cwd');
    [ui.statusDot, ui.statusLabel, ui.statusValue, ui.shellLabel, ui.shellValue, ui.cwdLabel, ui.cwdValue].forEach(function (n) { meta.appendChild(n); });

    ui.draft = el('div', 'imperium-terminal__draft');
    ui.draft.hidden = true;
    ui.draftLabel = el('label', 'imperium-terminal__draft-label');
    ui.draftInput = el('input', 'imperium-terminal__draft-input');
    ui.draftInput.type = 'text';
    ui.draftInput.spellcheck = false;
    ui.draftInput.autocomplete = 'off';
    ui.draftInput.id = 'imperium-terminal-draft-' + Math.random().toString(36).slice(2);
    ui.draftLabel.htmlFor = ui.draftInput.id;
    ui.insertButton = el('button', 'imperium-terminal__button is-primary');
    ui.dismissButton = el('button', 'imperium-terminal__button');
    ui.insertButton.type = 'button';
    ui.dismissButton.type = 'button';
    ui.draftHint = el('span', 'imperium-terminal__draft-hint');
    [ui.draftLabel, ui.draftInput, ui.insertButton, ui.dismissButton, ui.draftHint].forEach(function (n) { ui.draft.appendChild(n); });

    ui.error = el('div', 'imperium-terminal__error');
    ui.error.hidden = true;
    ui.error.setAttribute('role', 'alert');

    ui.stage = el('div', 'imperium-terminal__stage');
    ui.host = el('div', 'imperium-terminal__host');
    ui.empty = el('div', 'imperium-terminal__empty');
    ui.stage.appendChild(ui.host);
    ui.stage.appendChild(ui.empty);

    [toolbar, meta, ui.draft, ui.error, ui.stage].forEach(function (n) { ui.root.appendChild(n); });
    container.appendChild(ui.root);
    return ui;
  }

  function mount(container, options) {
    options = options || {};
    if (!container || typeof container.appendChild !== 'function') throw new Error('ImperiumTerminal.mount requires a container element');
    if (typeof options.api !== 'function') throw new Error('ImperiumTerminal.mount requires an api function');
    if (ctx) destroy();

    var TerminalCtor = window.Terminal && (window.Terminal.Terminal || window.Terminal);
    var FitCtor = window.FitAddon && (window.FitAddon.FitAddon || window.FitAddon);
    var state = typeof options.getState === 'function' ? options.getState() : null;
    var language = normalizeLanguage(options.language || (state && state.settings && state.settings.language) || document.documentElement.lang);

    ctx = {
      api: options.api, getState: options.getState, language: language,
      sessions: [], activeId: null, starting: false,
      stream: null, streamId: null, inputBuffer: '', inputTimer: null, sendChain: Promise.resolve(),
      lastSize: null, resizeTimer: null, fitFrame: null, observer: null, disposables: [], listeners: [],
    };
    ctx.ui = buildDom(container);

    if (typeof TerminalCtor !== 'function') {
      ctx.ui.empty.hidden = false;
      applyLabels();
      ctx.ui.empty.textContent = t('missingLib');
      return window.ImperiumTerminal;
    }

    ctx.term = new TerminalCtor({
      fontFamily: document.fonts?.status === 'loading' ? FONT_FALLBACK : readTerminalFont(),
      fontSize: 13, lineHeight: 1.2, cursorBlink: true, scrollback: 5000,
      theme: THEME, allowProposedApi: false, convertEol: false, macOptionIsMeta: true,
      minimumContrastRatio: 4.5,
    });
    if (typeof FitCtor === 'function') {
      ctx.fit = new FitCtor();
      ctx.term.loadAddon(ctx.fit);
    }
    ctx.term.open(ctx.ui.host);
    syncTerminalFont(ctx);
    ctx.disposables.push(ctx.term.onData(queueInput));
    ctx.disposables.push(ctx.term.onBinary(queueInput));

    function listen(target, type, handler) {
      target.addEventListener(type, handler);
      ctx.listeners.push([target, type, handler]);
    }
    listen(ctx.ui.newButton, 'click', function () { newSession(); });
    listen(ctx.ui.clearButton, 'click', function () { if (ctx) { ctx.term.clear(); ctx.term.focus(); } });
    listen(ctx.ui.closeButton, 'click', function () { closeActive(); });
    listen(ctx.ui.sessionSelect, 'change', function () { selectSession(ctx.ui.sessionSelect.value || null); });
    listen(ctx.ui.insertButton, 'click', insertDraft);
    listen(ctx.ui.dismissButton, 'click', function () { ctx.ui.draftInput.value = ''; ctx.ui.draft.hidden = true; updateChrome(); });
    listen(ctx.ui.draftInput, 'input', updateChrome);
    listen(ctx.ui.draftInput, 'keydown', function (event) {
      // Enter in the draft never runs anything; it only stays in the field.
      if (event.key === 'Enter') event.preventDefault();
    });
    listen(window, 'resize', scheduleFit);

    if (typeof ResizeObserver === 'function') {
      ctx.observer = new ResizeObserver(scheduleFit);
      ctx.observer.observe(ctx.ui.host);
    }

    applyLabels();
    scheduleFit();

    if (pendingDraft) { showDraft(pendingDraft); pendingDraft = null; }

    var mounted = ctx;
    refreshSessions().then(function () {
      if (ctx !== mounted) return;
      var running = mounted.sessions.filter(function (s) { return s.status === 'running'; })[0];
      if (running) selectSession(running.id);
      else if (options.autoStart === true) return newSession(); // only after explicit user navigation
    }).catch(showError);

    return window.ImperiumTerminal;
  }

  function render(state) {
    if (!ctx) return;
    var next = normalizeLanguage((state && state.settings && state.settings.language) || ctx.language);
    if (next !== ctx.language) { ctx.language = next; applyLabels(); syncTerminalFont(ctx); }
    scheduleFit();
  }

  function destroy() {
    if (!ctx) return;
    var mounted = ctx;
    flushInput();
    closeStream();
    if (mounted.resizeTimer) clearTimeout(mounted.resizeTimer);
    if (mounted.fitFrame) cancelAnimationFrame(mounted.fitFrame);
    if (mounted.observer) mounted.observer.disconnect();
    mounted.listeners.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); });
    mounted.disposables.forEach(function (d) { try { d.dispose(); } catch (_) { /* ignore */ } });
    if (mounted.term) { try { mounted.term.dispose(); } catch (_) { /* ignore */ } }
    if (mounted.ui.root.parentNode) mounted.ui.root.parentNode.removeChild(mounted.ui.root);
    ctx = null; // server sessions intentionally keep running
  }

  window.ImperiumTerminal = {
    mount: mount,
    render: render,
    paste: paste,
    destroy: destroy,
    newSession: function () { return newSession(); },
    refresh: function () { return refreshSessions(); },
    fit: function () { scheduleFit(); },
    isMounted: function () { return !!ctx; },
  };
})();
