/* Original model activity avatars. Read-only; no provider requests or task inference. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const NAMES = Object.freeze({ codex: 'Codex', claude: 'Claude', gemini: 'Gemini', copilot: 'Copilot', ollama: 'Ollama' });
  const WORDS = {
    ko: { heading: '모델 활동', description: '오리지널 모델 활동 캐릭터 · 현재 프로젝트의 실제 작업만 표시', running: '작업 중', queued: '대기열', idle: '연결됨 · 대기', auth: '로그인 필요', missing: '설치 필요', offline: '오프라인', error: '연결 오류', unknown: '연결 상태 미확인', disabled: '로컬 전용 · 사용 안 함', connections: '등록 연결', models: '요청 모델', defaultModel: '기본 모델', local: '로컬' },
    en: { heading: 'MODEL ACTIVITY', description: 'Original model activity avatars · actual tasks in the current project only', running: 'Working', queued: 'Queued', idle: 'Connected · idle', auth: 'Sign-in needed', missing: 'Install needed', offline: 'Offline', error: 'Connection error', unknown: 'Connection unverified', disabled: 'Disabled · local only', connections: 'Registered connections', models: 'Requested models', defaultModel: 'Default model', local: 'Local' },
    ja: { heading: 'モデル稼働', description: 'オリジナル稼働キャラクター・現在のプロジェクトの実タスクのみ表示', running: '作業中', queued: '待機列', idle: '接続済み・待機', auth: 'ログインが必要', missing: 'インストールが必要', offline: 'オフライン', error: '接続エラー', unknown: '接続状態は未確認', disabled: 'ローカル専用・無効', connections: '登録した接続', models: '指定モデル', defaultModel: '既定のモデル', local: 'ローカル' },
  };
  let host, list, heading, app, language = 'ko', displayedLanguage = '';
  const entries = new Map();
  const text = key => WORDS[language][key];
  const element = (tag, className, value) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value); return node;
  };
  const svg = (tag, attrs = {}, ...children) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    node.append(...children); return node;
  };
  const path = (d, className = '') => svg('path', { d, class: className });
  const circle = (cx, cy, r, className = '') => svg('circle', { cx, cy, r, class: className });
  function avatar(providerId) {
    const picture = svg('svg', { viewBox: '0 0 40 40', width: 32, height: 32, class: 'im-avatar', 'aria-hidden': 'true', focusable: 'false' });
    const body = svg('g', { class: 'im-avatar-motion' });
    const eyes = () => svg('g', { class: 'im-avatar-eyes' }, path('M15 15h2m6 0h2'));
    if (providerId === 'codex') {
      body.append(path('M11 8h18l4 5v12l-5 5H12l-5-5V13z', 'im-avatar-shell'), path('M12 12h16v10H12z', 'im-avatar-visor'), eyes(), path('M16 26h8m-9 4-2 5m12-5 2 5'));
      body.append(svg('g', { class: 'im-avatar-tool' }, path('m7 21-4 5 5 3m25-8 4 5-5 3'), path('M11 35h18', 'im-avatar-desk')));
      picture.dataset.avatar = 'helper-bot';
    } else if (providerId === 'claude') {
      body.append(path('m12 24-7 3-2 5m11-4-5 6m19-10 7 3 2 5m-11-4 5 6'), path('M12 12h16l4 6-3 10H11L8 18z', 'im-avatar-shell'));
      body.append(path('m20 14 0 10m-5-8 10 6m-10 0 10-6', 'im-avatar-star'), circle(13, 13, 1, 'im-avatar-eye-dot'), circle(27, 13, 1, 'im-avatar-eye-dot'));
      body.append(svg('g', { class: 'im-avatar-tool' }, path('M10 18 5 15 4 9m0 0-2 3m2-3 3 2M30 18l5-3 1-6m0 0 2 3m-2-3-3 2')));
      picture.dataset.avatar = 'aster-crab';
    } else if (providerId === 'gemini') {
      body.append(path('M20 3 25 14 37 20 25 25 20 37 15 25 3 20 15 14z', 'im-avatar-shell'), path('M13 16h14v8H13z', 'im-avatar-visor'), path('M16 20h2m4 0h2', 'im-avatar-eyes'));
      body.append(svg('g', { class: 'im-avatar-tool' }, path('m29 7 2-3m2 7 3-1M7 29l-2 3m6 1-1 3')));
      picture.dataset.avatar = 'spark-helper';
    } else if (providerId === 'copilot') {
      body.append(path('M9 10h22l4 6-3 13H8L5 16z', 'im-avatar-shell'), path('M10 14h20v9H10z', 'im-avatar-visor'), path('M14 18h4m4 0h4', 'im-avatar-eyes'), path('M15 29v5m10-5v5M20 9V5m-4 0h8'));
      body.append(svg('g', { class: 'im-avatar-tool' }, path('m8 25-4 5m28-5 4 5M11 35h18', 'im-avatar-desk')));
      picture.dataset.avatar = 'visor-helper';
    } else if (providerId === 'ollama') {
      body.append(path('m13 16-1-11 4-2 3 11m4 1 1-12 4 1 1 13', 'im-avatar-shell'), path('M11 16q9-5 18 0l2 7-5 7H14l-5-7z', 'im-avatar-shell'), path('M13 30v5m14-5v5'), path('M14 23h12l-2 5h-8z', 'im-avatar-visor'), circle(14, 19, 1, 'im-avatar-eye-dot'), circle(26, 19, 1, 'im-avatar-eye-dot'));
      body.append(svg('g', { class: 'im-avatar-tool' }, path('m10 27-5 3m25-3 5 3M11 36h18', 'im-avatar-desk')));
      picture.dataset.avatar = 'llama-helper';
    } else {
      body.append(path('m20 5 13 8v15l-13 7-13-7V13z', 'im-avatar-shell'), path('m7 13 13 8 13-8m-13 8v14'), path('m12 18 4 2m8 0 4-2', 'im-avatar-eyes'));
      body.append(svg('g', { class: 'im-avatar-tool' }, path('m5 23-3 5m33-5 3 5')));
      picture.dataset.avatar = 'module-helper';
    }
    picture.append(body, svg('g', { class: 'im-avatar-signal' }, circle(32, 4, 1), circle(36, 7, 1)));
    return picture;
  }
  function pause() { if (host && host.dataset.paused !== String(document.hidden === true)) host.dataset.paused = String(document.hidden === true); }
  document.addEventListener('visibilitychange', pause);
  function mount() {
    app = document.querySelector('.app-shell'); const terminal = app?.querySelector('.terminal-shell');
    if (!terminal) return false;
    host = element('section', 'im-model-activity'); host.setAttribute('role', 'region');
    heading = element('span', 'im-model-heading'); list = element('ul', 'im-model-list');
    host.append(heading, list); terminal.after(host); displayedLanguage = ''; pause(); return true;
  }
  function normalizeWorkspace(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
  }
  function render(state = {}, options = {}) {
    if (!host?.isConnected) { entries.clear(); if (!mount()) return; }
    language = Object.hasOwn(WORDS, options.language) ? options.language : Object.hasOwn(WORDS, state.settings?.language) ? state.settings.language : 'ko';
    const groups = new Map(), providers = new Map((Array.isArray(state.providers) ? state.providers : []).map(provider => [provider.id, provider]));
    for (const connection of Array.isArray(state.connections) ? state.connections : []) {
      if (!connection || typeof connection.providerId !== 'string' || !connection.providerId) continue;
      if (!groups.has(connection.providerId)) groups.set(connection.providerId, []);
      groups.get(connection.providerId).push(connection);
    }
    if (host.hidden !== !groups.size) host.hidden = !groups.size;
    app.classList.toggle('im-has-model-activity', Boolean(groups.size));
    if (displayedLanguage !== language) {
      displayedLanguage = language; heading.textContent = text('heading');
      host.setAttribute('aria-label', text('description')); host.title = text('description');
    }
    const workspace = normalizeWorkspace(state.settings?.workspace);
    const tasks = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task && !task.demo && workspace && normalizeWorkspace(task.workspace) === workspace);
    for (const [id, entry] of entries) if (!groups.has(id)) { entry.node.remove(); entries.delete(id); }
    for (const [providerId, connections] of groups) {
      const provider = providers.get(providerId), local = providerId === 'ollama' || provider?.kind === 'local';
      const disabled = state.settings?.localOnly === true && !local;
      const running = disabled ? [] : tasks.filter(task => task.provider === providerId && task.status === 'running');
      const queued = disabled ? 0 : tasks.filter(task => task.provider === providerId && task.status === 'queued').length;
      const status = disabled ? 'disabled' : running.length ? 'running' : queued ? 'queued' : ({ ready: 'idle', login_required: 'auth', missing: 'missing', offline: 'offline', error: 'error' })[provider?.status] || 'unknown';
      const name = NAMES[providerId] || provider?.name || providerId;
      const caption = status === 'running' ? `${text('running')} ${running.length}${queued ? ` · ${text('queued')} ${queued}` : ''}` : status === 'queued' ? `${text('queued')} ${queued}` : text(status);
      const connectionText = connections.map(connection => `${connection.label || connection.id || name} / ${connection.modelId || text('defaultModel')}`).join('; ');
      const modelText = [...new Set(running.map(task => task.modelId || text('defaultModel')))].join(', ');
      const description = `${name} · ${caption}${local ? ` · ${text('local')}` : ''}\n${text('connections')}: ${connectionText}${modelText ? `\n${text('models')}: ${modelText}` : ''}`;
      const signature = JSON.stringify([language, name, status, caption, description]);
      let entry = entries.get(providerId);
      if (!entry) {
        const node = element('li', 'im-model-avatar'), copy = element('span', 'im-model-copy'), label = element('strong', 'im-model-name'), detail = element('span', 'im-model-status');
        node.dataset.provider = providerId; copy.append(label, detail); node.append(avatar(providerId), copy); list.append(node);
        entry = { node, label, detail, signature: '' }; entries.set(providerId, entry);
      }
      if (entry.signature !== signature) {
        entry.signature = signature; entry.node.dataset.status = status; entry.node.title = description;
        entry.node.setAttribute('aria-label', description.replace(/\n/g, '. ')); entry.label.textContent = name; entry.detail.textContent = caption;
      }
    }
    pause();
  }
  window.ImperiumMascots = Object.freeze({ render });
})();
