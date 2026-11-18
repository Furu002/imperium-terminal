(function () {
  'use strict';
  const TEXT = {
    en: {
      '프로젝트': 'Projects', '프로젝트마다 별도의 작업 폴더, 지식, 캔버스를 사용합니다.': 'Each project uses its own work folder, knowledge, and canvas.',
      '로컬 전용': 'Local only', '새로고침': 'Refresh', '현재 프로젝트': 'Current', '선택': 'Select', '캔버스 열기': 'Open canvas', '편집': 'Edit', '저장': 'Save', '취소': 'Cancel',
      '이름': 'Name', '색상': 'Color', '상위 폴더 (선택)': 'Parent folder (optional)', '비워두면 현재 작업 폴더 옆의 "Imperium Projects"에 만듭니다.': 'Leave empty to create it in "Imperium Projects" next to the current work folder.',
      '새 프로젝트 폴더 만들기': 'Create a project folder', '폴더 만들기': 'Create folder', '새 폴더를 실제로 만듭니다. 기존 폴더는 덮어쓰거나 옮기지 않습니다.': 'A new folder is actually created. Existing folders are never overwritten or moved.',
      '프로젝트 지식': 'Project knowledge', '각 폴더는 별도의 영구 지식(메모리)과 캔버스를 가집니다. 이는 로컬에 저장되는 메모와 그래프이며 모델 가중치를 학습시키지 않습니다.': 'Each folder keeps its own persistent knowledge (memory) and canvas. These are notes and graphs stored locally; no model weights are trained.',
      '역할과 명패': 'Roles and nameplates', '직함, 역할, 에이전트 명패는 캔버스에서 자유롭게 정합니다. 군대식·회사식 직급은 필수가 아닙니다.': 'Titles, roles, and agent nameplates are free labels you set on the canvas. Military or corporate ranks are never required.',
      '연결과 계정은 모든 프로젝트에서 공유됩니다.': 'Connections and accounts are shared across all projects.',
      '아직 프로젝트가 없습니다.': 'No projects yet.', '불러오는 중…': 'Loading…', '부서': 'departments', '생성': 'Created',
      '프로젝트를 만들었습니다. 선택하면 전환됩니다.': 'Project created. Select it to switch.', '프로젝트를 전환했습니다.': 'Switched project.', '프로젝트 정보를 저장했습니다.': 'Project details saved.',
      '요청을 처리하지 못했습니다.': 'The request could not be completed.', '이름을 입력하세요.': 'Enter a name.', '색상 형식이 올바르지 않습니다.': 'Invalid color format.', '상위 폴더는 절대 경로여야 합니다.': 'The parent folder must be an absolute path.',
      '작업 중에는 전환할 수 없습니다.': 'You cannot switch while tasks are active.', '폴더 경로': 'Folder path',
    },
    ja: {
      '프로젝트': 'プロジェクト', '프로젝트마다 별도의 작업 폴더, 지식, 캔버스를 사용합니다.': 'プロジェクトごとに作業フォルダー、ナレッジ、キャンバスを分けて使います。',
      '로컬 전용': 'ローカル専用', '새로고침': '更新', '현재 프로젝트': '現在', '선택': '選択', '캔버스 열기': 'キャンバスを開く', '편집': '編集', '저장': '保存', '취소': 'キャンセル',
      '이름': '名前', '색상': '色', '상위 폴더 (선택)': '親フォルダー（任意）', '비워두면 현재 작업 폴더 옆의 "Imperium Projects"에 만듭니다.': '空欄の場合、現在の作業フォルダーの隣の「Imperium Projects」に作成します。',
      '새 프로젝트 폴더 만들기': 'プロジェクトフォルダーを作成', '폴더 만들기': 'フォルダーを作成', '새 폴더를 실제로 만듭니다. 기존 폴더는 덮어쓰거나 옮기지 않습니다.': '新しいフォルダーを実際に作成します。既存のフォルダーを上書き・移動することはありません。',
      '프로젝트 지식': 'プロジェクトのナレッジ', '각 폴더는 별도의 영구 지식(메모리)과 캔버스를 가집니다. 이는 로컬에 저장되는 메모와 그래프이며 모델 가중치를 학습시키지 않습니다.': '各フォルダーは独立した永続ナレッジ（メモリー）とキャンバスを持ちます。ローカルに保存されるメモとグラフであり、モデルの重みを学習させるものではありません。',
      '역할과 명패': '役割とネームプレート', '직함, 역할, 에이전트 명패는 캔버스에서 자유롭게 정합니다. 군대식·회사식 직급은 필수가 아닙니다.': '肩書き・役割・エージェントのネームプレートはキャンバスで自由に設定できます。軍隊式・会社式の階級は必須ではありません。',
      '연결과 계정은 모든 프로젝트에서 공유됩니다.': '接続とアカウントはすべてのプロジェクトで共有されます。',
      '아직 프로젝트가 없습니다.': 'プロジェクトはまだありません。', '불러오는 중…': '読み込み中…', '부서': '部署', '생성': '作成',
      '프로젝트를 만들었습니다. 선택하면 전환됩니다.': 'プロジェクトを作成しました。選択すると切り替わります。', '프로젝트를 전환했습니다.': 'プロジェクトを切り替えました。', '프로젝트 정보를 저장했습니다.': 'プロジェクト情報を保存しました。',
      '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '이름을 입력하세요.': '名前を入力してください。', '색상 형식이 올바르지 않습니다.': '色の形式が正しくありません。', '상위 폴더는 절대 경로여야 합니다.': '親フォルダーは絶対パスで指定してください。',
      '작업 중에는 전환할 수 없습니다.': 'タスク実行中は切り替えできません。', '폴더 경로': 'フォルダーのパス',
    },
  };
  const COLOR = /^#[0-9A-Fa-f]{6}$/;
  const DEFAULT_COLOR = '#C48A5A';
  const h = (tag, attrs = {}, ...children) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') element.className = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value !== undefined && value !== null && value !== false) element.setAttribute(key, String(value));
    }
    children.flat().forEach(child => { if (child !== undefined && child !== null && child !== false) element.append(child instanceof Node ? child : document.createTextNode(String(child))); });
    return element;
  };
  let container, callbacks = {}, state = {}, projects = [], currentProjectId = null, loaded = false, pending = false, editingId = null, signature = '';
  let generation = 0, mountGeneration = 0, observedWorkspace;
  let grid, message, badge, form, nameInput, colorInput, parentInput, createButton;
  const language = () => document.documentElement.lang || state.settings?.language || 'ko';
  const tr = key => TEXT[language()]?.[key] ?? key;
  const safeColor = value => (typeof value === 'string' && COLOR.test(value) ? value : DEFAULT_COLOR);
  const busyTasks = () => (state.tasks || []).some(task => task && (task.status === 'queued' || task.status === 'running'));
  const workspace = () => typeof state.settings?.workspace === 'string' ? state.settings.workspace : null;
  const pathKey = value => typeof value === 'string' ? (/^[A-Za-z]:[\\/]/.test(value) ? value.replace(/\//g, '\\').replace(/[\\/]+$/, '').toLowerCase() : value.replace(/\/+$/, '')) : null;
  function syncWorkspace() {
    const next = workspace();
    if (next === observedWorkspace) return false;
    observedWorkspace = next; generation++; editingId = null;
    currentProjectId = projects.find(project => pathKey(project.workspace) === pathKey(next))?.id ?? null;
    return true;
  }

  function announce(text, failed = false) { if (message) { message.textContent = text; message.classList.toggle('ip-error', failed); } }
  async function request(path, method = 'GET', body) {
    if (callbacks.api) return callbacks.api(path, method === 'GET' ? {} : { method, body });
    const response = await fetch(path, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || tr('요청을 처리하지 못했습니다.'));
    return result;
  }
  function setPending(value) {
    pending = value;
    container?.querySelectorAll('button, input').forEach(element => { if (!element.dataset.ipKeep) element.disabled = value; });
    container?.setAttribute('aria-busy', value ? 'true' : 'false');
  }
  async function run(task) {
    if (pending) return;
    setPending(true);
    try { await task(); } catch (error) { announce(error?.message || tr('요청을 처리하지 못했습니다.'), true); } finally { setPending(false); }
  }

  async function reload() {
    if (!container) return;
    const requestGeneration = ++generation, ownerGeneration = mountGeneration, requestWorkspace = workspace();
    const isCurrent = () => requestGeneration === generation && ownerGeneration === mountGeneration && requestWorkspace === workspace();
    try {
      const result = await request('/api/projects');
      if (!isCurrent()) return;
      projects = Array.isArray(result.projects) ? result.projects : [];
      currentProjectId = result.currentProjectId ?? null;
      loaded = true;
      renderGrid();
    } catch (error) { if (isCurrent()) announce(error?.message || tr('요청을 처리하지 못했습니다.'), true); }
  }

  function build() {
    if (!container) return;
    const previous = { name: nameInput?.value || '', color: colorInput?.value || DEFAULT_COLOR, parent: parentInput?.value || '' };
    signature = `${language()}|${Boolean(state.settings?.localOnly)}`;
    message = h('p', { class: 'ip-message', role: 'status', 'aria-live': 'polite' });
    badge = state.settings?.localOnly ? h('span', { class: 'ip-badge', title: tr('로컬 전용') }, 'LOCAL ONLY · ', tr('로컬 전용')) : null;
    const refresh = h('button', { type: 'button', onclick: () => run(reload) }, '↻ ', tr('새로고침'));
    const heading = h('div', { class: 'ip-heading' },
      h('div', {}, h('span', { class: 'ip-eyebrow' }, 'PROJECTS / LOCAL FOLDERS'), h('h2', {}, tr('프로젝트'), badge), h('p', {}, tr('프로젝트마다 별도의 작업 폴더, 지식, 캔버스를 사용합니다.'))),
      h('div', { class: 'ip-heading-actions' }, refresh));
    grid = h('div', { class: 'ip-grid', role: 'list', 'aria-label': tr('프로젝트') });
    nameInput = h('input', { maxlength: '80', required: '', value: previous.name, autocomplete: 'off', 'aria-label': tr('이름') });
    colorInput = h('input', { type: 'color', value: safeColor(previous.color), 'aria-label': tr('색상') });
    parentInput = h('input', { value: previous.parent, placeholder: 'C:\\Users\\…\\Projects', spellcheck: 'false', autocomplete: 'off', 'aria-label': tr('상위 폴더 (선택)') });
    createButton = h('button', { type: 'submit', class: 'ip-primary' }, '+ ', tr('폴더 만들기'));
    form = h('form', { class: 'ip-create', 'aria-label': tr('새 프로젝트 폴더 만들기') },
      h('h3', {}, tr('새 프로젝트 폴더 만들기')),
      h('div', { class: 'ip-create-row' }, field('이름', nameInput, 'ip-grow'), field('색상', colorInput)),
      field('상위 폴더 (선택)', parentInput),
      h('p', { class: 'ip-help' }, tr('비워두면 현재 작업 폴더 옆의 "Imperium Projects"에 만듭니다.')),
      h('p', { class: 'ip-help' }, tr('새 폴더를 실제로 만듭니다. 기존 폴더는 덮어쓰거나 옮기지 않습니다.')),
      createButton);
    form.addEventListener('submit', createProject);
    const notes = h('aside', { class: 'ip-notes' },
      h('section', {}, h('h3', {}, tr('프로젝트 지식')), h('p', {}, tr('각 폴더는 별도의 영구 지식(메모리)과 캔버스를 가집니다. 이는 로컬에 저장되는 메모와 그래프이며 모델 가중치를 학습시키지 않습니다.'))),
      h('section', {}, h('h3', {}, tr('역할과 명패')), h('p', {}, tr('직함, 역할, 에이전트 명패는 캔버스에서 자유롭게 정합니다. 군대식·회사식 직급은 필수가 아닙니다.'))),
      h('p', { class: 'ip-help' }, tr('연결과 계정은 모든 프로젝트에서 공유됩니다.')));
    container.classList.add('ip-projects');
    container.replaceChildren(heading, h('div', { class: 'ip-layout' }, h('section', { class: 'ip-main' }, grid), h('div', { class: 'ip-side' }, form, notes)), message);
    renderGrid();
  }
  function field(key, input, extra = '') { return h('label', { class: `ip-field ${extra}`.trim() }, h('span', {}, tr(key)), input); }

  function renderGrid() {
    if (!grid) return;
    if (!loaded) { grid.replaceChildren(h('p', { class: 'ip-empty' }, tr('불러오는 중…'))); return; }
    if (!projects.length) { grid.replaceChildren(h('p', { class: 'ip-empty' }, tr('아직 프로젝트가 없습니다.'))); return; }
    grid.replaceChildren(...projects.map(tile));
    if (pending) setPending(true);
  }

  function tile(project) {
    const active = project.id === currentProjectId;
    const card = h('article', { class: `ip-tile${active ? ' ip-active' : ''}`, role: 'listitem', 'data-project-id': project.id, 'aria-current': active ? 'true' : undefined });
    card.style.setProperty('--ip-color', safeColor(project.color));
    const created = project.createdAt ? new Date(project.createdAt) : null;
    const meta = [`${project.departmentCount ?? 0} ${tr('부서')}`];
    if (created && !Number.isNaN(created.getTime())) meta.push(`${tr('생성')} ${created.toLocaleDateString(language())}`);
    card.append(
      h('div', { class: 'ip-tile-head' }, h('span', { class: 'ip-swatch', 'aria-hidden': 'true' }), h('h4', {}, project.name), active ? h('span', { class: 'ip-tag' }, tr('현재 프로젝트')) : null),
      h('code', { class: 'ip-path', title: tr('폴더 경로') }, project.workspace),
      h('p', { class: 'ip-meta' }, meta.join(' · ')));
    if (editingId === project.id) { card.append(editor(project)); return card; }
    const actions = h('div', { class: 'ip-actions' });
    if (active) actions.append(h('button', { type: 'button', class: 'ip-primary', onclick: () => callbacks.onSelect?.(project) }, tr('캔버스 열기')));
    else actions.append(h('button', { type: 'button', class: 'ip-primary', title: busyTasks() ? tr('작업 중에는 전환할 수 없습니다.') : undefined, onclick: () => selectProject(project) }, tr('선택')));
    actions.append(h('button', { type: 'button', onclick: () => { editingId = project.id; renderGrid(); grid.querySelector('.ip-edit input')?.focus(); } }, tr('편집')));
    card.append(actions);
    return card;
  }

  function editor(project) {
    const name = h('input', { maxlength: '80', required: '', value: project.name, 'aria-label': tr('이름') });
    const color = h('input', { type: 'color', value: safeColor(project.color), 'aria-label': tr('색상') });
    const edit = h('form', { class: 'ip-edit' }, h('div', { class: 'ip-create-row' }, field('이름', name, 'ip-grow'), field('색상', color)),
      h('div', { class: 'ip-actions' }, h('button', { type: 'submit', class: 'ip-primary' }, tr('저장')), h('button', { type: 'button', onclick: () => { editingId = null; renderGrid(); } }, tr('취소'))));
    edit.addEventListener('submit', event => {
      event.preventDefault();
      const value = name.value.trim();
      if (!value) { announce(tr('이름을 입력하세요.'), true); name.focus(); return; }
      if (!COLOR.test(color.value)) { announce(tr('색상 형식이 올바르지 않습니다.'), true); return; }
      run(async () => {
        generation++;
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}`, 'PATCH', { name: value, color: color.value });
        generation++;
        const updated = result.project || {};
        projects = projects.map(item => (item.id === project.id ? { ...item, ...updated } : item));
        editingId = null; renderGrid(); announce(tr('프로젝트 정보를 저장했습니다.'));
        await callbacks.onChanged?.();
      });
    });
    return edit;
  }

  function selectProject(project) {
    if (busyTasks()) { announce(tr('작업 중에는 전환할 수 없습니다.'), true); return; }
    run(async () => {
      generation++;
      const result = await request(`/api/projects/${encodeURIComponent(project.id)}/select`, 'POST', {});
      generation++;
      currentProjectId = result.project?.id || project.id;
      renderGrid(); announce(tr('프로젝트를 전환했습니다.'));
      await callbacks.onChanged?.();
      if (callbacks.getState) state = callbacks.getState() || state;
      syncWorkspace();
      await reload();
      if (currentProjectId === (result.project?.id || project.id)) callbacks.onSelect?.(result.project || project);
    });
  }

  function createProject(event) {
    event.preventDefault();
    const name = nameInput.value.trim(), color = colorInput.value, parentDir = parentInput.value.trim();
    if (!name) { announce(tr('이름을 입력하세요.'), true); nameInput.focus(); return; }
    if (!COLOR.test(color)) { announce(tr('색상 형식이 올바르지 않습니다.'), true); return; }
    if (parentDir && !/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(parentDir)) { announce(tr('상위 폴더는 절대 경로여야 합니다.'), true); parentInput.focus(); return; }
    run(async () => {
      generation++;
      const body = { name, color };
      if (parentDir) body.parentDir = parentDir;
      const result = await request('/api/projects', 'POST', body);
      generation++;
      if (result.project) projects = [...projects.filter(item => item.id !== result.project.id), result.project];
      nameInput.value = ''; renderGrid(); announce(tr('프로젝트를 만들었습니다. 선택하면 전환됩니다.'));
      await callbacks.onChanged?.();
      if (callbacks.getState) state = callbacks.getState() || state;
      syncWorkspace();
      await reload();
    });
  }

  function render(next) {
    if (next && typeof next === 'object') state = next;
    else if (callbacks.getState) state = callbacks.getState() || state;
    if (!container) return;
    const scopeChanged = syncWorkspace();
    if (signature !== `${language()}|${Boolean(state.settings?.localOnly)}` || !grid) build();
    else renderGrid();
    if (scopeChanged) void reload();
  }

  function mount(target, options = {}) {
    container = target; callbacks = options || {};
    state = callbacks.getState?.() || {};
    generation++; mountGeneration++; observedWorkspace = workspace();
    projects = []; currentProjectId = null; loaded = false; pending = false; editingId = null;
    build();
    reload();
  }

  window.ImperiumProjects = { mount, render, reload };
})();
