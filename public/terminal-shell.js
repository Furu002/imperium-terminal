(function () {
  'use strict';
  const VIEWS = [
    ['overview', 'NODES', 'F1', '조직도', 'Organization', '組織図'], ['operations', 'TASK', 'F2', '작업', 'Tasks', 'タスク'],
    ['chat', 'CHAT', '', '대화', 'Conversations', '会話'],
    ['skills', 'SKILLS', '', '스킬', 'Skills', 'スキル'], ['workflow', 'FLOW', '', '워크플로', 'Workflow', 'ワークフロー'],
    ['collaboration', 'TEAM', '', '협업 보드', 'Collaboration', 'コラボレーション'],
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
  const HELP_WORDS = {
    ko: ['명령 또는 화면 검색', '일치하는 명령이 없습니다.'],
    en: ['Search commands or views', 'No matching commands.'],
    ja: ['コマンドや画面を検索', '一致するコマンドがありません。'],
  };
  const SHELL_WORDS = {
    ko: { palette: '명령', status: '현황', project: '프로젝트 전환', empty: '프로젝트' },
    en: { palette: 'Commands', status: 'Status', project: 'Switch project', empty: 'Project' },
    ja: { palette: 'コマンド', status: '状況', project: 'プロジェクトを切り替え', empty: 'プロジェクト' },
  };
  let host, form, input, message, status, statusDisclosure, statusSummary, statusLabel, statusCount;
  let projectButton, projectName, projectColor, palette, paletteButton, paletteLabel, help, helpButton, helpSearch, noMatches;
  let callbacks = {}, state = {}, language = 'ko', view = 'overview', history = [], cursor = 0, lastLanguage, messageTimer;
  const tr = key => (TEXT[language] || TEXT.ko)[key];
  const label = row => row[language === 'en' ? 4 : language === 'ja' ? 5 : 3];
  const h = (tag, attrs = {}, ...children) => { const el = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') el.className = value; else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value); else el.setAttribute(key, String(value)); } el.append(...children); return el; };
  function navigate(next) { callbacks.onNavigate?.(next); }
  function togglePalette(open, restoreFocus = true) {
    if (open && statusDisclosure) statusDisclosure.open = false;
    const restore = !open && restoreFocus && palette.contains(document.activeElement);
    palette.hidden = !open;
    paletteButton.setAttribute('aria-expanded', String(open));
    if (open) {
      if (message.parentElement !== palette) form.after(message);
      input.focus({ preventScroll: true });
    }
    else {
      toggleHelp(false, false);
      if (message.parentElement !== host) host.append(message);
      if (restore) paletteButton.focus({ preventScroll: true });
    }
  }
  function filterHelp() {
    const query = helpSearch.value.trim().toLowerCase().split(/\s+/);
    const matches = [];
    for (const action of help.querySelectorAll('[data-help-command]')) {
      const searchable = action.textContent.toLowerCase();
      action.hidden = !query.every(term => searchable.includes(term));
      if (!action.hidden) matches.push(action);
    }
    noMatches.hidden = matches.length > 0;
    return matches;
  }
  function toggleHelp(force, restoreFocus = true) {
    if (!help) return;
    const open = force ?? help.hidden;
    if (open && palette.hidden) togglePalette(true);
    if (!open && restoreFocus && help.contains(document.activeElement)) helpButton.focus();
    help.hidden = !open;
    helpButton.setAttribute('aria-expanded', String(open));
    if (open) {
      helpSearch.value = '';
      filterHelp();
    }
    if (open) helpSearch.focus({ preventScroll: true });
  }
  function announce(text) { clearTimeout(messageTimer); message.textContent = text; if (text) messageTimer = setTimeout(() => { message.textContent = ''; }, 8000); }
  function execute(raw) {
    const text = raw.trim(); if (!text) return;
    history = [...history.filter(item => item !== text), text].slice(-30); cursor = history.length;
    const match = /^\/?([^\s]+)(?:\s+([\s\S]*))?$/.exec(text), command = match[1].toUpperCase(), argument = match[2] || '';
    announce(''); input.value = '';
    if (command === 'HELP' || command === '?') { toggleHelp(true); return; }
    if (command === 'SETTINGS' || command === 'F8') { togglePalette(false); callbacks.onSettings?.(); return; }
    if (command === 'FIND' && argument) { togglePalette(false); navigate('knowledge'); window.dispatchEvent(new CustomEvent('imperium:knowledge-search', { detail: { query: argument.slice(0, 2000) } })); return; }
    if (command === 'TASK' && argument) {
      toggleHelp(false); navigate('operations');
      if (callbacks.onPrepareTask?.(argument.slice(0, 12000)) === false) {
        input.value = text; announce(tr('existing'));
      } else { togglePalette(false); announce(tr('prepared')); }
      return;
    }
    const row = VIEWS.find(item => [item[0].toUpperCase(), item[1], item[2]].includes(command));
    if (row) { togglePalette(false); navigate(row[0]); return; }
    announce(tr('unknown')); input.value = text;
  }
  function mount() {
    const app = document.querySelector('.app-shell'), topbar = app?.querySelector('.topbar'); if (!app || !topbar) return false;
    const right = topbar.querySelector('.topbar-right') || topbar;
    app.classList.add('im-compact-shell');
    projectName = h('span', { class: 'terminal-project-name' });
    projectColor = h('span', { class: 'terminal-project-color', 'aria-hidden': 'true' });
    projectButton = h('button', { type: 'button', class: 'terminal-project', onclick: () => navigate('projects') },
      projectColor, projectName, h('span', { class: 'terminal-project-arrow', 'aria-hidden': 'true' }, '⌄'));
    if (right === topbar) topbar.append(projectButton); else topbar.insertBefore(projectButton, right);
    host = h('section', { class: 'terminal-shell', id: 'function-command' });
    paletteLabel = h('span', { class: 'terminal-command-label' });
    paletteButton = h('button', { type: 'button', class: 'terminal-command-toggle', 'aria-controls': 'terminal-command-palette', 'aria-expanded': 'false', onclick: () => togglePalette(palette.hidden) },
      h('span', { class: 'terminal-command-glyph', 'aria-hidden': 'true' }, '⌕'), paletteLabel, h('kbd', { class: 'terminal-command-shortcut', 'aria-hidden': 'true' }, navigator.platform.startsWith('Mac') ? '⌘ K' : 'Ctrl K'));
    palette = h('div', { class: 'terminal-command-palette', id: 'terminal-command-palette', hidden: '' });
    input = h('input', { type: 'text', maxlength: '12000', autocomplete: 'off', spellcheck: 'false', 'data-terminal-command': '' });
    const go = h('button', { type: 'submit', class: 'terminal-go' });
    helpButton = h('button', { type: 'button', class: 'terminal-help-button', 'aria-expanded': 'false', 'aria-controls': 'terminal-command-help', onclick: () => toggleHelp() }, 'HELP');
    form = h('form', { class: 'terminal-commandbar' }, input, go, helpButton);
    form.addEventListener('submit', event => { event.preventDefault(); execute(input.value); });
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (['ArrowUp', 'ArrowDown'].includes(event.key) && history.length) {
        event.preventDefault();
        cursor = Math.max(0, Math.min(history.length, cursor + (event.key === 'ArrowUp' ? -1 : 1)));
        input.value = history[cursor] || '';
      }
    });
    status = h('p', { class: 'terminal-session-status' });
    statusLabel = h('span', { class: 'terminal-status-label' });
    statusCount = h('span', { class: 'terminal-status-count', hidden: '', 'aria-hidden': 'true' });
    statusSummary = h('summary', { class: 'terminal-status-toggle' }, h('span', { class: 'terminal-status-dot', 'aria-hidden': 'true' }), statusLabel, statusCount);
    const statusMeta = h('div', { class: 'terminal-status-meta' }, status);
    for (const value of [right.querySelector('.clock'), app.querySelector('.sidebar-version')]) {
      if (value) statusMeta.append(value);
    }
    const statusBody = h('div', { class: 'terminal-status-body', id: 'terminal-status-body' }, statusMeta);
    statusDisclosure = h('details', { class: 'terminal-status' }, statusSummary, statusBody);
    statusDisclosure.addEventListener('toggle', () => { if (statusDisclosure.open) togglePalette(false, false); });
    message = h('span', { class: 'terminal-command-message', role: 'status', 'aria-live': 'polite' });
    help = h('section', { class: 'terminal-command-help', id: 'terminal-command-help', hidden: '', 'aria-label': tr('help') });
    helpSearch = h('input', { class: 'terminal-help-search', type: 'search', autocomplete: 'off', maxlength: '120' });
    noMatches = h('p', { class: 'terminal-help-empty', hidden: '' });
    helpSearch.addEventListener('input', filterHelp);
    helpSearch.addEventListener('keydown', event => {
      if (event.isComposing || !['ArrowDown', 'Enter'].includes(event.key)) return;
      const matches = filterHelp();
      event.preventDefault();
      if (event.key === 'ArrowDown') matches[0]?.focus();
      else if (matches.length === 1) matches[0].click();
    });
    palette.append(form, help); host.append(paletteButton, palette, message);
    right.prepend(statusDisclosure, host);
    host.addEventListener('focusout', event => {
      if (event.relatedTarget && !host.contains(event.relatedTarget)) togglePalette(false, false);
    });
    document.addEventListener('click', event => {
      if (!palette.hidden && !host.contains(event.target)) togglePalette(false);
      if (statusDisclosure.open && !statusDisclosure.contains(event.target)) statusDisclosure.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.isComposing || document.querySelector('dialog[open]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggleHelp(false);
        togglePalette(true);
        input.select();
      } else if (event.key === 'Escape' && !palette.hidden && host.contains(document.activeElement)) {
        event.preventDefault();
        if (!help.hidden) toggleHelp(false);
        else togglePalette(false);
      } else if (event.key === 'Escape' && statusDisclosure.open && statusDisclosure.contains(document.activeElement)) {
        event.preventDefault();
        statusDisclosure.open = false;
        statusSummary.focus({ preventScroll: true });
      }
    });
    return true;
  }
  function render(incoming, options = {}) {
    state = incoming || {}; callbacks = { ...callbacks, ...options }; language = options.language || document.documentElement.lang || 'ko'; view = options.view || view;
    if (!host && !mount()) return;
    if (lastLanguage !== language) {
      lastLanguage = language;
      const copy = SHELL_WORDS[language] || SHELL_WORDS.ko;
      paletteLabel.textContent = copy.palette;
      paletteButton.title = `${copy.palette} · ${paletteButton.querySelector('kbd').textContent}`;
      statusLabel.textContent = copy.status;
      host.setAttribute('aria-label', tr('command'));
      input.setAttribute('aria-label', tr('command'));
      input.placeholder = tr('placeholder');
      form.querySelector('.terminal-go').textContent = `${tr('go')} ↵`;
      helpButton.title = tr('help');
      help.setAttribute('aria-label', tr('help'));
      const [searchLabel, emptyLabel] = HELP_WORDS[language] || HELP_WORDS.ko;
      helpSearch.placeholder = searchLabel;
      helpSearch.setAttribute('aria-label', searchLabel);
      noMatches.textContent = emptyLabel;
      help.replaceChildren(
        h('div', { class: 'terminal-help-heading' }, h('strong', {}, tr('help')), h('button', { type: 'button', onclick: () => toggleHelp(false), 'aria-label': tr('close') }, '×')),
        helpSearch,
        ...VIEWS.map(row => h('button', { type: 'button', 'data-help-command': '', 'data-command-view': row[0], onclick: () => { togglePalette(false); navigate(row[0]); } }, h('code', {}, row[1]), [row[2], label(row)].filter(Boolean).join(' · '))),
        h('button', { type: 'button', 'data-help-command': '', onclick: () => { togglePalette(false); callbacks.onSettings?.(); } }, h('code', {}, 'SETTINGS'), `F8 · ${tr('settings')}`),
        noMatches, h('p', {}, tr('find')), h('p', {}, tr('task')), h('p', { class: 'terminal-help-note' }, tr('notice'))
      );
      filterHelp();
    }
    help.querySelectorAll('[data-command-view]').forEach(el => {
      if (el.dataset.commandView === view) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    const running = (state.tasks || []).filter(task => task.status === 'running' && !task.demo).length, queued = (state.tasks || []).filter(task => task.status === 'queued' && !task.demo).length;
    const online = options.connected === true;
    status.dataset.state = !online ? 'offline' : state.settings?.localOnly ? 'local' : 'online';
    status.textContent = `${online ? state.settings?.localOnly ? tr('local') : tr('online') : tr('offline')} · ${tr('running')} ${running} · ${tr('queued')} ${queued}`;
    statusDisclosure.dataset.state = status.dataset.state;
    statusSummary.title = status.textContent;
    statusSummary.setAttribute('aria-label', `${statusLabel.textContent} · ${status.textContent}`);
    statusCount.hidden = running + queued === 0;
    statusCount.textContent = running + queued;
    const workspace = state.settings?.workspace || '';
    const project = state.projects?.find(item => item.current) || state.projects?.find(item => item.workspace === workspace);
    const copy = SHELL_WORDS[language] || SHELL_WORDS.ko;
    projectName.textContent = project?.name || workspace.split(/[\\/]/).filter(Boolean).pop() || copy.empty;
    projectButton.setAttribute('aria-label', `${copy.project} · ${projectName.textContent}`);
    projectButton.title = workspace ? `${copy.project}\n${workspace}` : copy.project;
    projectColor.style.backgroundColor = /^#[\da-f]{6}$/i.test(project?.color || '') ? project.color : '';
  }
  window.ImperiumTerminalShell = { render };
})();
