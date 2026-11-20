/* Locally bundled provider marks. Read-only; no provider requests or task inference. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const NAMES = Object.freeze({ codex: 'Codex', claude: 'Claude', gemini: 'Gemini', copilot: 'Copilot', ollama: 'Ollama' });
  const WORDS = {
    ko: { heading: '모델 활동', description: '모델·제공자 로고 · 현재 프로젝트의 실제 작업만 표시', running: '작업 중', queued: '대기열', idle: '연결됨 · 대기', auth: '로그인 필요', missing: '설치 필요', offline: '오프라인', error: '연결 오류', unknown: '연결 상태 미확인', disabled: '로컬 전용 · 사용 안 함', connections: '등록 연결', models: '요청 모델', defaultModel: '기본 모델', local: '로컬' },
    en: { heading: 'MODEL ACTIVITY', description: 'Model and provider logos · actual tasks in the current project only', running: 'Working', queued: 'Queued', idle: 'Connected · idle', auth: 'Sign-in needed', missing: 'Install needed', offline: 'Offline', error: 'Connection error', unknown: 'Connection unverified', disabled: 'Disabled · local only', connections: 'Registered connections', models: 'Requested models', defaultModel: 'Default model', local: 'Local' },
    ja: { heading: 'モデル稼働', description: 'モデル・プロバイダーのロゴ・現在のプロジェクトの実タスクのみ表示', running: '作業中', queued: '待機列', idle: '接続済み・待機', auth: 'ログインが必要', missing: 'インストールが必要', offline: 'オフライン', error: '接続エラー', unknown: '接続状態は未確認', disabled: 'ローカル専用・無効', connections: '登録した接続', models: '指定モデル', defaultModel: '既定のモデル', local: 'ローカル' },
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
  function createMark(providerId, { className = '', size = 20 } = {}) {
    if (Object.hasOwn(NAMES, providerId)) {
      const picture = element('img', `im-provider-icon im-brand-logo ${className}`.trim());
      picture.src = `/model-icons/${providerId}.svg`;
      picture.alt = '';
      picture.width = size;
      picture.height = size;
      picture.dataset.brand = providerId;
      return picture;
    }
    const picture = svg('svg', { viewBox: '0 0 40 40', width: size, height: size, class: `im-provider-icon im-generic-logo ${className}`.trim(), 'aria-hidden': 'true', focusable: 'false', 'data-avatar': 'generic-module' });
    picture.append(path('m20 5 13 8v15l-13 7-13-7V13z'), path('m7 13 13 8 13-8m-13 8v14'));
    return picture;
  }
  function avatar(providerId) {
    const frame = element('span', 'im-avatar-frame');
    frame.setAttribute('aria-hidden', 'true');
    frame.append(createMark(providerId, { className: 'im-avatar', size: 26 }), element('span', 'im-work-indicator'));
    return frame;
  }
  function pause() { if (host && host.dataset.paused !== String(document.hidden === true)) host.dataset.paused = String(document.hidden === true); }
  document.addEventListener('visibilitychange', pause);
  function mount() {
    app = document.querySelector('.app-shell'); const terminal = app?.querySelector('.terminal-shell');
    if (!terminal) return false;
    host = element('section', 'im-model-activity'); host.setAttribute('role', 'region');
    heading = element('span', 'im-model-heading'); list = element('ul', 'im-model-list');
    host.append(heading, list);
    const status = app.querySelector('#terminal-status-body');
    if (status) status.append(host); else terminal.after(host);
    displayedLanguage = ''; pause(); return true;
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
  window.ImperiumMascots = Object.freeze({ render, createMark });
})();
