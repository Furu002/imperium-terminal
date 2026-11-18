(function () {
  'use strict';
  const VIEWS = [
    ['overview', 'NODES', 'F1', '조직도', 'Nodes', 'ノード'], ['operations', 'TASK', 'F2', '작업', 'Tasks', 'タスク'],
    ['departments', 'AGENT', 'F3', '에이전트', 'Agents', 'エージェント'], ['logs', 'LOG', 'F4', '활동', 'Activity', 'ログ'],
    ['accounts', 'ACCOUNT', 'F5', 'AI 계정', 'Accounts', 'AIアカウント'], ['terminal', 'TERM', 'F6', '터미널', 'Terminal', 'ターミナル'],
    ['updates', 'UPDATE', 'F7', '업데이트', 'Updates', '更新'], ['projects', 'PROJECT', 'F9', '프로젝트', 'Projects', 'プロジェクト'],
    ['analytics', 'USE', 'F10', '사용량', 'Usage', '使用量'], ['knowledge', 'MEMORY', 'F11', '지식', 'Knowledge', '知識'],
  ];
  const TEXT = {
    ko: { command: '터미널 기능 명령', placeholder: 'NODES / TASK / MEMORY / TERM / HELP', go: '실행', existing: '기존 작업 초안을 보존했습니다. 새 지시는 명령줄에 남아 있습니다.', help: '명령 도움말', close: '닫기', settings: '설정', unknown: '알 수 없는 기능입니다. HELP로 명령을 확인하세요.', prepared: '작업 지시를 준비했습니다. 담당 에이전트를 선택한 뒤 지시 보내기를 누르세요.', navigate: '화면 이동', find: 'FIND 검색어 · 프로젝트 기억 검색', task: 'TASK 지시문 · 실행 전 작업 입력란에 준비', running: '실행', queued: '대기', online: '연결됨', offline: '연결 중단', local: '로컬 전용', idle: '작업 없음', project: '프로젝트', notice: '기능 명령은 화면 이동과 입력 준비에만 사용됩니다. 셸 명령과 AI 실행은 해당 화면에서 시작하세요.' },
    en: { command: 'Terminal function command', placeholder: 'NODES / TASK / MEMORY / TERM / HELP', go: 'GO', existing: 'Your existing operation draft was kept. The new instructions remain in the command line.', help: 'Command help', close: 'Close', settings: 'Settings', unknown: 'Unknown function. Enter HELP to see commands.', prepared: 'Command prepared. Choose an agent, then dispatch it.', navigate: 'Navigate', find: 'FIND query · Search project knowledge', task: 'TASK instructions · Prepare an operation for review', running: 'RUN', queued: 'QUEUE', online: 'CONNECTED', offline: 'DISCONNECTED', local: 'LOCAL ONLY', idle: 'NO OPERATIONS', project: 'PROJECT', notice: 'Function commands navigate and prepare input. Start shell commands and AI operations in their respective views.' },
    ja: { command: 'ターミナル機能コマンド', placeholder: 'NODES / TASK / MEMORY / TERM / HELP', go: '実行', existing: '既存の指示案を保持しました。新しい指示はコマンド欄に残っています。', help: 'コマンド一覧', close: '閉じる', settings: '設定', unknown: '不明な機能です。HELPでコマンドを確認してください。', prepared: '指示を準備しました。担当エージェントを選び、送信してください。', navigate: '画面を移動', find: 'FIND 検索語 · プロジェクトの記憶を検索', task: 'TASK 指示文 · 実行前の入力欄に準備', running: '実行', queued: '待機', online: '接続済み', offline: '切断', local: 'ローカル専用', idle: 'タスクなし', project: 'プロジェクト', notice: '機能コマンドは画面移動と入力の準備を行います。シェルとAIの実行は各画面で開始してください。' },
  };
  let host, keys, tabs, form, input, message, status, projectName, help, callbacks = {}, state = {}, language = 'ko', view = 'overview', history = [], cursor = 0, lastLanguage, messageTimer;
  const tr = key => (TEXT[language] || TEXT.ko)[key];
  const label = row => row[language === 'en' ? 4 : language === 'ja' ? 5 : 3];
  const h = (tag, attrs = {}, ...children) => { const el = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') el.className = value; else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value); else el.setAttribute(key, String(value)); } el.append(...children); return el; };
  function navigate(next) { callbacks.onNavigate?.(next); }
  function toggleHelp(force) { if (!help) return; help.hidden = force === undefined ? !help.hidden : !force; }
  function announce(text) { clearTimeout(messageTimer); message.textContent = text; if (text) messageTimer = setTimeout(() => { message.textContent = ''; }, 8000); }
  function execute(raw) {
    const text = raw.trim(); if (!text) return;
    history = [...history.filter(item => item !== text), text].slice(-30); cursor = history.length;
    const match = /^\/?([^\s]+)(?:\s+([\s\S]*))?$/.exec(text), command = match[1].toUpperCase(), argument = match[2] || '';
    announce(''); input.value = '';
    if (command === 'HELP' || command === '?') { toggleHelp(true); return; }
    if (command === 'SETTINGS' || command === 'F8') { toggleHelp(false); callbacks.onSettings?.(); return; }
    if (command === 'FIND' && argument) { toggleHelp(false); navigate('knowledge'); window.dispatchEvent(new CustomEvent('imperium:knowledge-search', { detail: { query: argument.slice(0, 2000) } })); return; }
    if (command === 'CHAT') { toggleHelp(false); navigate('chat'); return; }
    if (command === 'TASK' && argument) { toggleHelp(false); navigate('operations'); if (callbacks.onPrepareTask?.(argument.slice(0, 12000)) === false) { input.value = text; announce(tr('existing')); } else announce(tr('prepared')); return; }
    const row = VIEWS.find(item => [item[0].toUpperCase(), item[1], item[2]].includes(command));
    if (row) { toggleHelp(false); navigate(row[0]); return; }
    announce(tr('unknown')); input.value = text;
  }
  function mount() {
    const app = document.querySelector('.app-shell'), topbar = app?.querySelector('.topbar'); if (!app || !topbar) return false;
    host = h('section', { class: 'terminal-shell', 'aria-label': 'IMPERIUM FUNCTIONS' });
    keys = h('nav', { class: 'terminal-functionbar', 'aria-label': 'FUNCTION KEYS' });
    input = h('input', { type: 'text', maxlength: '12000', autocomplete: 'off', spellcheck: 'false', 'data-terminal-command': '' });
    const go = h('button', { type: 'submit', class: 'terminal-go' });
    const helpButton = h('button', { type: 'button', class: 'terminal-help-button', onclick: () => toggleHelp() }, 'HELP');
    form = h('form', { class: 'terminal-commandbar' }, h('span', { class: 'terminal-command-prompt', 'aria-hidden': 'true' }, 'IMPERIUM ›'), input, go, helpButton);
    form.addEventListener('submit', event => { event.preventDefault(); execute(input.value); });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { input.value = ''; message.textContent = ''; toggleHelp(false); } if (['ArrowUp', 'ArrowDown'].includes(event.key) && history.length) { event.preventDefault(); cursor = Math.max(0, Math.min(history.length, cursor + (event.key === 'ArrowUp' ? -1 : 1))); input.value = history[cursor] || ''; } });
    tabs = h('nav', { class: 'terminal-tabs', 'aria-label': 'WORKSPACE VIEWS' });
    status = h('span', { class: 'terminal-session-status' }); projectName = h('span', { class: 'terminal-project-name' });
    message = h('span', { class: 'terminal-command-message', role: 'status', 'aria-live': 'polite' });
    help = h('section', { class: 'terminal-command-help', hidden: '', 'aria-label': tr('help') }); help.hidden = true;
    host.append(keys, form, h('div', { class: 'terminal-workspace-strip' }, tabs, projectName, status), message, help); topbar.after(host);
    document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) { event.preventDefault(); input.focus(); input.select(); } });
    return true;
  }
  function render(incoming, options = {}) {
    state = incoming || {}; callbacks = { ...callbacks, ...options }; language = options.language || document.documentElement.lang || 'ko'; view = options.view || view;
    if (!host && !mount()) return;
    if (lastLanguage !== language) {
      lastLanguage = language; input.setAttribute('aria-label', tr('command')); input.placeholder = tr('placeholder'); form.querySelector('.terminal-go').textContent = `${tr('go')} ↵`; form.querySelector('.terminal-help-button').title = tr('help');
      keys.replaceChildren(...VIEWS.map(row => h('button', { type: 'button', 'data-function-view': row[0], onclick: () => navigate(row[0]) }, h('kbd', {}, row[2]), label(row))), h('button', { type: 'button', onclick: () => callbacks.onSettings?.() }, h('kbd', {}, 'F8'), tr('settings')));
      tabs.replaceChildren(h('button', { type: 'button', 'data-terminal-view': 'chat', onclick: () => navigate('chat') }, 'CHAT'), ...VIEWS.filter(row => ['overview', 'operations', 'knowledge', 'terminal', 'analytics', 'projects'].includes(row[0])).map(row => h('button', { type: 'button', 'data-terminal-view': row[0], onclick: () => navigate(row[0]) }, row[1])));
      help.setAttribute('aria-label', tr('help')); help.replaceChildren(h('div', { class: 'terminal-help-heading' }, h('strong', {}, tr('help')), h('button', { type: 'button', onclick: () => toggleHelp(false), 'aria-label': tr('close') }, '×')), ...VIEWS.map(row => h('button', { type: 'button', onclick: () => { toggleHelp(false); navigate(row[0]); } }, h('code', {}, row[1]), `${row[2]} · ${label(row)}`)), h('p', {}, tr('find')), h('p', {}, tr('task')), h('p', { class: 'terminal-help-note' }, tr('notice')));
    }
    host.querySelectorAll('[data-terminal-view],[data-function-view]').forEach(el => { const active = (el.dataset.terminalView || el.dataset.functionView) === view; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    const running = (state.tasks || []).filter(task => task.status === 'running' && !task.demo).length, queued = (state.tasks || []).filter(task => task.status === 'queued' && !task.demo).length;
    const online = options.connected === true;
    status.dataset.state = !online ? 'offline' : state.settings?.localOnly ? 'local' : 'online';
    status.textContent = `${online ? state.settings?.localOnly ? tr('local') : tr('online') : tr('offline')} · ${tr('running')} ${running} · ${tr('queued')} ${queued}`;
    const workspace = state.settings?.workspace || ''; projectName.textContent = `${tr('project')} / ${workspace.split(/[\\/]/).filter(Boolean).pop() || '—'}`; projectName.title = workspace;
  }
  window.ImperiumTerminalShell = { render };
})();
