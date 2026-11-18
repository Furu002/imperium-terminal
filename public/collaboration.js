/* Project-scoped public collaboration telemetry. No model dispatch or polling. */
(function () {
  'use strict';
  const WORDS = {
    ko: { heading: '협업 보드', description: '실제 작업, 공유 산출물과 읽기·게시 기록을 확인합니다.', refresh: '새로고침', search: '공유 자료 검색', find: '검색', tasks: '에이전트 작업', artifacts: '공유 산출물', trace: '실제 협업 기록', emptyTasks: '이 프로젝트에 기록된 작업이 없습니다.', emptyArtifacts: '게시된 공유 산출물이 없습니다. 에이전트가 게시하면 여기에 표시됩니다.', emptyTrace: '읽기·게시 기록이 없습니다.', unverified: '에이전트 작성 · 검증 안 됨', noSummary: '공개 수행 요약이 아직 보고되지 않았습니다.', detail: '산출물 원문', select: '산출물을 선택하면 원문과 출처를 볼 수 있습니다.', loading: '불러오는 중…', error: '협업 자료를 불러오지 못했습니다.', time: '기록 시각', source: '수행 작업', target: '대상 작업', action: '동작', size: '읽은 문자', limited: '표시 한도에 도달했습니다. 검색으로 다른 자료를 찾아보세요.', requested: '요청 모델', actual: 'CLI 보고 모델', defaultModel: 'CLI 기본 모델', privacy: '공유 자료는 참고 정보입니다. 게시나 열람만으로 검토 완료·업무 완료를 뜻하지 않습니다.', running: '실행 중', queued: '대기 중', completed: '완료', failed: '실패', cancelled: '취소됨', interrupted: '중단됨', unknown: '미확인', peer_tasks_list: '다른 작업 목록 조회', peer_task_get: '다른 작업 결과 읽기', artifact_list: '공유 산출물 목록 조회', artifact_get: '공유 산출물 읽기', artifact_publish: '공유 산출물 게시', note: '노트', finding: '조사 결과', handoff: '전달 자료', result: '결과', observed: '마지막 갱신' },
    en: { heading: 'Collaboration board', description: 'Inspect actual tasks, shared artifacts and read/publish records.', refresh: 'Refresh', search: 'Search shared material', find: 'Search', tasks: 'Agent tasks', artifacts: 'Shared artifacts', trace: 'Observed collaboration', emptyTasks: 'No tasks recorded in this project.', emptyArtifacts: 'No shared artifacts have been published. Agent publications appear here.', emptyTrace: 'No read or publish records.', unverified: 'Agent authored · unverified', noSummary: 'No public activity summary has been reported.', detail: 'Artifact source', select: 'Select an artifact to read its content and provenance.', loading: 'Loading…', error: 'Collaboration material could not be loaded.', time: 'Timestamp', source: 'Acting task', target: 'Target task', action: 'Action', size: 'Characters read', limited: 'The display limit was reached. Search to find other material.', requested: 'Requested model', actual: 'CLI-reported model', defaultModel: 'CLI default model', privacy: 'Shared material is reference information. Publishing or reading does not mean review or task completion.', running: 'Running', queued: 'Queued', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', unknown: 'Unknown', peer_tasks_list: 'List peer tasks', peer_task_get: 'Read peer result', artifact_list: 'List shared artifacts', artifact_get: 'Read shared artifact', artifact_publish: 'Publish shared artifact', note: 'Note', finding: 'Finding', handoff: 'Handoff', result: 'Result', observed: 'Last refreshed' },
    ja: { heading: '共同作業ボード', description: '実際のタスク、共有成果物と閲覧・公開記録を確認します。', refresh: '更新', search: '共有資料を検索', find: '検索', tasks: 'エージェントのタスク', artifacts: '共有成果物', trace: '実際の共同作業記録', emptyTasks: 'このプロジェクトのタスクはまだありません。', emptyArtifacts: '共有成果物はまだありません。エージェントが公開すると表示されます。', emptyTrace: '閲覧・公開記録はありません。', unverified: 'エージェント作成・未検証', noSummary: '公開可能な作業要約はまだ報告されていません。', detail: '成果物の原文', select: '成果物を選ぶと原文と出典を確認できます。', loading: '読み込み中…', error: '共同作業の資料を読み込めませんでした。', time: '記録時刻', source: '実行したタスク', target: '対象タスク', action: '操作', size: '閲覧文字数', limited: '表示上限に達しました。検索で他の資料を探してください。', requested: '指定モデル', actual: 'CLI報告モデル', defaultModel: 'CLIの既定モデル', privacy: '共有資料は参考情報です。公開や閲覧は、検証やタスクの完了を意味しません。', running: '実行中', queued: '待機中', completed: '完了', failed: '失敗', cancelled: 'キャンセル', interrupted: '中断', unknown: '未確認', peer_tasks_list: '他のタスク一覧を取得', peer_task_get: '他のタスク結果を閲覧', artifact_list: '共有成果物の一覧を取得', artifact_get: '共有成果物を閲覧', artifact_publish: '共有成果物を公開', note: 'ノート', finding: '調査結果', handoff: '引き継ぎ', result: '結果', observed: '最終更新' },
  };
  const h = (tag, attrs = {}, ...children) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') node.className = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== undefined && value !== false) node.setAttribute(key, String(value)); } children.flat().forEach(child => { if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child))); }); return node; };
  const scope = value => { const text = typeof value === 'string' ? value.replace(/\\/g, '/').replace(/\/+$/, '') : ''; return /^[A-Za-z]:\//.test(text) ? text.toLowerCase() : text; };
  let host, callbacks = {}, state = {}, project = '', language = 'ko', epoch = 0, requestId = 0, detailId = 0, selected = null, observedStamp, loaded = false, visibility = true;
  let data = { tasks: [], artifacts: [], events: [] }, query = '', pending = false, search, taskList, artifactList, trace, detail, message, limited, refreshed;
  const summaries = new Map();
  const tr = key => WORDS[language]?.[key] || key;
  const visible = () => Boolean(host?.isConnected && visibility && !host.hidden && !host.closest('[hidden]') && (callbacks.isVisible?.() ?? true));
  const when = value => { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toLocaleString(language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-GB', { hour12: false }) : '—'; };
  const announce = (text, failed = false) => { if (message) { message.textContent = text; message.classList.toggle('ib-error', failed); } };
  const localTasks = () => Array.isArray(state.tasks) ? state.tasks.filter(task => task && !task.demo && scope(task.workspace) === project) : [];
  const taskName = id => { const task = [...localTasks(), ...data.tasks].find(item => item.id === id); return task ? `${task.departmentName || state.departments?.find(department => department.id === task.departmentId)?.name || task.departmentId} · ${task.title || task.id}` : id || '—'; };
  function auditTargets(event) {
    const ids = [...new Set((Array.isArray(event.targetTaskIds) ? event.targetTaskIds : [event.targetTaskId]).filter(id => typeof id === 'string' && id))].slice(0, 20);
    if (!ids.length) return '—';
    if (ids.length === 1) return taskName(ids[0]);
    return h('details', { class: 'ib-trace-targets', 'data-audit-target-count': ids.length }, h('summary', {}, taskName(ids[0]), ` +${ids.length - 1}`), h('ul', {}, ...ids.map(id => h('li', { 'data-audit-target': id }, taskName(id)))));
  }
  async function api(path, key) {
    path += `${path.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(key)}`;
    if (callbacks.api) return callbacks.api(path, {});
    const response = await fetch(path, { headers: { accept: 'application/json' } }), result = await response.json();
    if (!response.ok) throw new Error(result.error || tr('error')); return result;
  }
  function build() {
    search = h('input', { type: 'search', maxlength: 2000, value: query, placeholder: tr('search'), 'aria-label': tr('search') });
    const form = h('form', { class: 'ib-search', onsubmit: event => { event.preventDefault(); query = search.value.slice(0, 2000); selected = null; detailId++; detail.replaceChildren(h('p', { class: 'ib-empty' }, tr('select'))); void reload(); } }, search, h('button', { type: 'submit' }, tr('find')));
    taskList = h('div', { class: 'ib-task-list' }); artifactList = h('div', { class: 'ib-artifact-list' }); trace = h('div', { class: 'ib-trace-scroll' }); detail = h('article', { class: 'ib-artifact-detail', 'aria-label': tr('detail') }, h('p', { class: 'ib-empty' }, tr('select')));
    message = h('p', { class: 'ib-message', role: 'status', 'aria-live': 'polite' }); limited = h('p', { class: 'ib-limit', hidden: true }, tr('limited')); refreshed = h('span', { class: 'ib-refreshed' });
    host.classList.add('ib-collaboration');
    host.replaceChildren(h('header', { class: 'ib-heading' }, h('div', {}, h('span', { class: 'ib-eyebrow' }, 'TEAM / SHARED WORK'), h('h2', {}, tr('heading')), h('p', {}, tr('description'))), h('button', { type: 'button', 'data-collaboration-refresh': '', onclick: () => { query = search.value.slice(0, 2000); void reload(); } }, tr('refresh'))), form,
      h('div', { class: 'ib-grid' }, h('section', { class: 'ib-panel' }, h('h3', {}, tr('tasks')), taskList), h('section', { class: 'ib-panel' }, h('h3', {}, tr('artifacts')), artifactList, limited), h('section', { class: 'ib-panel ib-reader' }, h('h3', {}, tr('detail')), detail)),
      h('section', { class: 'ib-panel ib-trace' }, h('h3', {}, tr('trace')), trace), h('footer', { class: 'ib-footer' }, h('p', {}, tr('privacy')), refreshed, message));
    draw();
  }
  function draw() {
    if (!taskList) return;
    const needle = query.toLowerCase();
    const rows = [...new Map([...data.tasks, ...localTasks()].map(task => [task.id, { ...data.tasks.find(value => value.id === task.id), ...task }])).values()].filter(task => !needle || `${task.title} ${task.departmentName} ${task.departmentId} ${task.provider}`.toLowerCase().includes(needle)).sort((a, b) => Number(['running', 'queued'].includes(b.status)) - Number(['running', 'queued'].includes(a.status)) || String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || ''))).slice(0, 20);
    taskList.replaceChildren(...(rows.length ? rows.map(task => {
      const liveSummary = [...(task.logs || [])].reverse().find(log => log.type === 'status' && ['model-summary', 'model-estimate'].includes(log.source));
      const summary = [liveSummary, task.publicSummary, summaries.get(task.id)].filter(value => value && ['model-summary', 'model-estimate'].includes(value.source)).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))[0];
      if (summary) { summaries.set(task.id, { ...summary }); if (summaries.size > 200) summaries.delete(summaries.keys().next().value); }
      const name = task.departmentName || state.departments?.find(department => department.id === task.departmentId)?.name || task.departmentId;
      return h('article', { class: 'ib-task', 'data-collaboration-task': task.id, 'data-status': task.status }, h('button', { type: 'button', onclick: () => callbacks.onSelectTask?.(task.id) }, h('strong', {}, name), h('span', {}, task.title || task.id)), h('div', { class: 'ib-task-meta' }, h('span', { class: 'ib-status' }, tr(task.status || 'unknown')), h('span', {}, task.provider || '—'), h('span', {}, `${tr('requested')}: ${task.modelId || tr('defaultModel')}`), ...(task.reportedModel ? [h('span', {}, `${tr('actual')}: ${task.reportedModel}`)] : [])), h('p', { class: 'ib-summary' }, summary?.text || tr('noSummary')), h('time', {}, when(summary?.timestamp || task.startedAt || task.createdAt)));
    }) : [h('p', { class: 'ib-empty' }, tr('emptyTasks'))]));
    artifactList.replaceChildren(...(data.artifacts.length ? data.artifacts.slice(0, 20).map(artifact => h('button', { type: 'button', class: `ib-artifact${selected === artifact.id ? ' selected' : ''}`, 'data-artifact-id': artifact.id, onclick: () => { void readArtifact(artifact.id); } }, h('strong', {}, artifact.title), h('span', { class: 'ib-unverified' }, tr('unverified')), h('span', {}, `${artifact.departmentId} · ${artifact.provider} · ${tr(artifact.kind)}`), h('time', {}, when(artifact.createdAt)), h('p', {}, artifact.snippet || ''))) : [h('p', { class: 'ib-empty' }, tr('emptyArtifacts'))]));
    limited.hidden = !data.truncated;
    if (!data.events.length) trace.replaceChildren(h('p', { class: 'ib-empty' }, tr('emptyTrace')));
    else {
      const headings = h('thead', {}, h('tr', {}, ...['time', 'source', 'action', 'target', 'size'].map(key => h('th', { scope: 'col' }, tr(key)))));
      const records = data.events.slice(-100).reverse().map(event => h('tr', { 'data-collaboration-event': event.id }, h('td', {}, when(event.timestamp)), h('td', {}, taskName(event.sourceTaskId)), h('td', {}, tr(event.action)), h('td', {}, auditTargets(event)), h('td', {}, Number.isFinite(event.chars) ? event.chars : '—')));
      trace.replaceChildren(h('table', {}, headings, h('tbody', {}, ...records)));
    }
  }
  async function reload() {
    if (!project || !visible()) return false;
    const key = project, owner = epoch, serial = ++requestId, stamp = state.collaborationUpdatedAt; observedStamp = stamp; pending = true; announce(tr('loading'));
    try {
      const result = await api(`/api/collaboration?query=${encodeURIComponent(query)}&afterSequence=0&limit=20`, key);
      if (owner !== epoch || serial !== requestId || key !== project || !host?.isConnected) return false;
      if (scope(result.workspace) !== key) throw new Error(tr('error'));
      data = { tasks: Array.isArray(result.tasks) ? result.tasks.slice(0, 20) : [], artifacts: (result.artifacts || []).filter(item => scope(item.workspace) === key).slice(0, 20), events: (result.events || []).filter(item => scope(item.workspace) === key).slice(-100), truncated: result.truncated === true };
      loaded = true; pending = false; draw(); refreshed.textContent = `${tr('observed')}: ${when(new Date().toISOString())}`; announce('');
      if (stamp !== state.collaborationUpdatedAt && visible()) void reload(); return true;
    } catch (error) { if (owner === epoch && serial === requestId && key === project) { pending = false; loaded = true; announce(error.message || tr('error'), true); } return false; }
  }
  async function readArtifact(id) {
    const key = project, owner = epoch, serial = ++detailId; selected = id; draw(); detail.replaceChildren(h('p', {}, tr('loading')));
    try {
      const result = await api(`/api/collaboration/artifacts/${encodeURIComponent(id)}`, key);
      if (owner !== epoch || serial !== detailId || key !== project || selected !== id || !host?.isConnected) return;
      if (scope(result.workspace) !== key || scope(result.artifact?.workspace) !== key || result.artifact.id !== id) throw new Error(tr('error'));
      const artifact = result.artifact;
      detail.replaceChildren(h('h4', {}, artifact.title), h('p', { class: 'ib-unverified' }, tr('unverified')), h('p', { class: 'ib-provenance' }, `${artifact.departmentId} · ${artifact.provider} · ${when(artifact.createdAt)}`), h('pre', { 'data-artifact-content': id }, String(artifact.content || '').slice(0, 8000)), ...(artifact.truncated ? [h('p', {}, tr('limited'))] : []));
    } catch (error) { if (owner === epoch && serial === detailId && key === project) detail.replaceChildren(h('p', { class: 'ib-error', role: 'alert' }, error.message || tr('error'))); }
  }
  function render(incoming, options = {}) {
    state = incoming || callbacks.getState?.() || state; if (!host) return;
    if (Object.hasOwn(options, 'visible')) visibility = options.visible !== false;
    const next = scope(state.settings?.workspace), nextLanguage = Object.hasOwn(WORDS, state.settings?.language) ? state.settings.language : 'ko';
    if (next !== project || !taskList || !host.contains(taskList)) { project = next; epoch++; requestId++; detailId++; summaries.clear(); data = { tasks: [], artifacts: [], events: [] }; selected = null; query = ''; loaded = false; pending = false; observedStamp = undefined; language = nextLanguage; build(); }
    else if (language !== nextLanguage) { language = nextLanguage; selected = null; detailId++; build(); }
    else draw();
    if (visible() && (!loaded && !pending || observedStamp !== state.collaborationUpdatedAt)) { observedStamp = state.collaborationUpdatedAt; void reload(); }
  }
  function unmount() { epoch++; requestId++; detailId++; host = null; loaded = false; pending = false; }
  function mount(target, configuration = {}) { unmount(); host = typeof target === 'string' ? document.querySelector(target) : target; callbacks = configuration; project = ''; visibility = true; render(callbacks.getState?.() || {}); return { render, reload, destroy: unmount }; }
  window.ImperiumCollaboration = Object.freeze({ mount, render, reload, unmount });
})();
