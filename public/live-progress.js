(function () {
  'use strict';
  const COPY = {
    ko: { heading: '실시간 진행', description: '모델이 공개한 진행 요약과 도구 이벤트입니다. 내부 사고 원문이 아닙니다.', running: '실행 중', queued: '대기 중', publicSummary: '공개 진행 요약', modelEstimate: 'AI 자체 추정', cliStatus: 'CLI 상태', tool: '도구 이벤트', waiting: '공개된 진행 이벤트를 기다리는 중입니다.', queuedWaiting: '대기열에 있습니다. 실행 후 공개 진행이 표시됩니다.', noEvents: '아직 공개된 요약이나 도구 이벤트가 없습니다.', estimateWaiting: 'AI 진행률·완료 예상 미보고', eta: '보고 당시 남은 예상 {n}분', uncertain: '진행률과 예상 시간은 AI 자체 추정입니다. 실제 완료 확인과 다릅니다.', updated: '마지막 공개 이벤트', unreported: '시각 미보고', defaultModel: 'CLI 기본 모델', effort: '추론', speed: '속도', project: '프로젝트', tasks: '개 작업', session: '세션 연결', working: '작업 중', reviewing: '작업 검토 중', denied: '현재 권한으로 허용되지 않은 도구', stopping: '작업 중단 중', starting: '작업 시작', readOnlyStart: '읽기 전용 작업 시작', localStart: '로컬 텍스트 생성 시작' },
    en: { heading: 'Live progress', description: 'Public progress summaries and tool events from the models. Private internal reasoning is not shown.', running: 'Running', queued: 'Queued', publicSummary: 'Public progress summary', modelEstimate: 'AI self estimate', cliStatus: 'CLI status', tool: 'Tool event', waiting: 'Waiting for a public progress event.', queuedWaiting: 'Queued. Public progress will appear after execution starts.', noEvents: 'No public summary or tool events yet.', estimateWaiting: 'AI progress and ETA not reported', eta: 'Reported remaining estimate: {n} min', uncertain: 'Progress and ETA are AI self estimates, separate from confirmed completion.', updated: 'Latest public event', unreported: 'Time not reported', defaultModel: 'CLI default model', effort: 'Reasoning', speed: 'Speed', project: 'Project', tasks: 'tasks', session: 'Session connected', working: 'Working on the task', reviewing: 'Reviewing the task', denied: 'Tool unavailable with current permissions', stopping: 'Stopping the task', starting: 'Task started', readOnlyStart: 'Read-only task started', localStart: 'Local text generation started' },
    ja: { heading: 'リアルタイム進捗', description: 'モデルが公開した進捗の要約とツールイベントです。非公開の内部思考は表示しません。', running: '実行中', queued: '待機中', publicSummary: '公開された進捗の要約', modelEstimate: 'AIの自己推定', cliStatus: 'CLI状態', tool: 'ツールイベント', waiting: '公開された進捗イベントを待っています。', queuedWaiting: '待機列にあります。実行後に公開された進捗を表示します。', noEvents: '公開された要約やツールイベントはまだありません。', estimateWaiting: 'AI進捗率・完了予想は未報告', eta: '報告時点の残り予想 {n}分', uncertain: '進捗率と予想時間はAIの自己推定で、実際の完了確認とは異なります。', updated: '最後の公開イベント', unreported: '時刻は未報告', defaultModel: 'CLIの既定モデル', effort: '推論', speed: '速度', project: 'プロジェクト', tasks: 'タスク', session: 'セッション接続', working: 'タスクを実行中', reviewing: 'タスクを確認中', denied: '現在の権限では使えないツール', stopping: 'タスクを停止中', starting: 'タスク開始', readOnlyStart: '読み取り専用タスク開始', localStart: 'ローカルのテキスト生成開始' },
  };
  const PROVIDERS = { codex: 'ChatGPT / Codex', claude: 'Claude Code', gemini: 'Gemini', copilot: 'GitHub Copilot', ollama: 'Ollama' };
  Object.assign(COPY.ko, { skills: '사용 스킬', skillRead: '스킬 문서 읽기 감지', skillCall: 'CLI 호출 감지', skillReport: '모델 사용 보고', noSkills: '스킬 사용 보고 없음 · 현재 공개 기록에서 확인 불가', skillNote: '문서 읽기·호출·사용 보고이며, 스킬 실행 완료를 확인한 것은 아닙니다.' });
  Object.assign(COPY.en, { skills: 'Skills', skillRead: 'Skill document read detected', skillCall: 'CLI invocation detected', skillReport: 'Model usage report', noSkills: 'No skill usage reported · unverified in current public records', skillNote: 'Document reads, invocations and usage reports do not confirm successful skill completion.' });
  Object.assign(COPY.ja, { skills: '使用スキル', skillRead: 'スキル文書の読み取りを検知', skillCall: 'CLI呼び出しを検知', skillReport: 'モデルによる使用報告', noSkills: 'スキル使用の報告なし・現在の公開記録では未確認', skillNote: '文書の読み取り・呼び出し・使用報告であり、スキルの実行完了を確認したものではありません。' });
  const PUBLIC_SOURCES = new Set(['model-summary', 'model-estimate']);
  const SKILL_SOURCES = { 'cli-skill-read': 'skillRead', 'cli-skill-call': 'skillCall', 'model-reported': 'skillReport' };
  const entries = new Map();
  let root, disclosure, heading, count, projectLabel, description, list, language = 'ko', callbacks = {}, selectedWorkspace = '';
  const h = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = String(value); return node; };
  const tr = key => COPY[language][key];
  const plain = (value, limit = 400) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, limit) : '';
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const timestamp = value => typeof value === 'string' && value && Number.isFinite(Date.parse(value)) ? value : null;
  const locale = () => language === 'en' ? 'en-US' : language === 'ja' ? 'ja-JP' : 'ko-KR';
  const number = value => value.toLocaleString(locale(), { maximumFractionDigits: 20 });
  function workspace(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized;
  }
  function mount() {
    const quotas = document.querySelector('#quotas-section'); if (!quotas) return false;
    root = h('section', 'lp-live-progress'); root.id = 'live-progress-section'; root.hidden = true;
    disclosure = h('details', 'lp-disclosure');
    const summary = h('summary', 'lp-heading'); heading = h('strong'); count = h('span', 'lp-count'); projectLabel = h('span', 'lp-project');
    summary.append(h('span', 'lp-live-dot'), heading, count, projectLabel);
    description = h('p', 'lp-description'); list = h('div', 'lp-task-list');
    disclosure.append(summary, description, list); root.append(disclosure); quotas.after(root); entries.clear(); return true;
  }
  function timeNode(value) {
    const node = h('time', 'lp-time');
    if (value) { node.dateTime = value; node.title = value; node.textContent = new Date(value).toLocaleString(locale(), { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    else node.textContent = tr('unreported');
    return node;
  }
  // Unsourced raw CLI lines are deliberately not promoted into public model summaries.
  function cliStatus(value) {
    const text = plain(value, 300).trim();
    if (['Codex 세션 연결', 'Claude 세션 연결', 'Gemini 세션 연결'].includes(text)) return tr('session');
    if (text === 'Codex가 작업 중입니다.') return tr('working');
    if (text === '작업을 검토하고 있습니다.') return tr('reviewing');
    if (text === '현재 권한으로 허용되지 않은 도구입니다.') return tr('denied');
    if (text === '작업을 중단하고 있습니다.') return tr('stopping');
    if (/^(?:ChatGPT \/ Codex|Codex|Claude Code|Gemini(?: CLI)?|GitHub Copilot|Copilot)(?: 작업을 시작했습니다\.| 읽기 전용 작업 시작)$/.test(text)) return text.endsWith('읽기 전용 작업 시작') ? tr('readOnlyStart') : tr('starting');
    if (/^로컬 Ollama [^\r\n]{1,180} · 텍스트 생성 시작$/.test(text)) return tr('localStart');
    return '';
  }
  function publicEvents(task) {
    return (Array.isArray(task.logs) ? task.logs : []).filter(event => event && (!event.taskId || event.taskId === task.id)).flatMap(event => {
      if (event.type === 'status' && PUBLIC_SOURCES.has(event.source)) {
        const message = plain(event.text); return message.trim() ? [{ type: 'status', source: event.source, text: message, timestamp: timestamp(event.timestamp) }] : [];
      }
      if (event.type === 'status') { const message = cliStatus(event.text); return message ? [{ type: 'status', source: 'cli', text: message, timestamp: timestamp(event.timestamp) }] : []; }
      if (event.type === 'tool') {
        const message = plain(event.text, 700); return message.trim() && !/^[\s]*[\[{]/.test(message) ? [{ type: 'tool', source: 'cli', text: message, timestamp: timestamp(event.timestamp) }] : [];
      }
      return [];
    }).slice(-60);
  }
  function sourceLabel(event) { return event.source === 'model-summary' ? tr('publicSummary') : event.source === 'model-estimate' ? tr('modelEstimate') : event.type === 'tool' ? tr('tool') : tr('cliStatus'); }
  function publicSkills(task) {
    const unique = new Map();
    for (const event of Array.isArray(task.logs) ? task.logs : []) {
      if (!event || event.type !== 'skill' || !Object.hasOwn(SKILL_SOURCES, event.source) || event.taskId && event.taskId !== task.id) continue;
      const name = plain(event.text, 120).trim();
      if (!name || /^[a-z]:[\\/]|^[\\/]/i.test(name)) continue;
      unique.delete(name); unique.set(name, { name, source: event.source, timestamp: timestamp(event.timestamp) });
    }
    return [...unique.values()].slice(-12);
  }
  function createCard(id) {
    const node = h('article', 'lp-task'), header = h('header', 'lp-task-heading'), title = h('button', 'lp-task-title'); title.type = 'button';
    title.addEventListener('click', () => callbacks.onSelectTask?.(id));
    const badge = h('span', 'lp-state'), meta = h('p', 'lp-task-meta'), source = h('span', 'lp-summary-source'), summary = h('p', 'lp-stage'); summary.setAttribute('aria-live', 'polite');
    const estimate = h('div', 'lp-estimate'), skills = h('div', 'lp-skills'), updated = h('div', 'lp-updated'), timeline = h('ol', 'lp-timeline');
    header.append(title, badge); node.append(header, meta, source, summary, estimate, skills, updated, timeline); list.append(node);
    return { node, title, badge, meta, source, summary, estimate, skills, updated, timeline, signature: '', estimateSignature: '', eventSignature: '', skillSignature: '', updatedSignature: '' };
  }
  function render(state = {}, options = {}) {
    callbacks = options;
    if (!root?.isConnected && !mount()) return;
    language = Object.hasOwn(COPY, options.language) ? options.language : Object.hasOwn(COPY, state.settings?.language) ? state.settings.language : 'ko';
    const currentWorkspace = workspace(state.settings?.workspace);
    if (selectedWorkspace !== currentWorkspace) { for (const entry of entries.values()) entry.node.remove(); entries.clear(); selectedWorkspace = currentWorkspace; }
    const tasks = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task && typeof task.id === 'string' && !task.demo && currentWorkspace && workspace(task.workspace) === currentWorkspace && ['running', 'queued'].includes(task.status)).sort((a, b) => Number(a.status === 'queued') - Number(b.status === 'queued'));
    root.hidden = !tasks.length;
    const ids = new Set(tasks.map(task => task.id));
    for (const [id, entry] of entries) if (!ids.has(id)) { entry.node.remove(); entries.delete(id); }
    if (!tasks.length) return;
    setText(heading, tr('heading')); setText(count, `${tasks.length} ${tr('tasks')}`); setText(description, tr('description')); root.setAttribute('aria-label', tr('heading'));
    const project = (Array.isArray(state.projects) ? state.projects : []).find(project => workspace(project.workspace) === currentWorkspace);
    setText(projectLabel, `${tr('project')} · ${plain(project?.name, 80) || plain(state.settings.workspace, 240).split(/[\\/]/).filter(Boolean).at(-1) || currentWorkspace}`); projectLabel.title = plain(state.settings.workspace, 1000);
    tasks.forEach((task, index) => {
      const provider = (Array.isArray(state.providers) ? state.providers : []).find(provider => provider.id === task.provider);
      const department = (Array.isArray(state.departments) ? state.departments : []).find(department => department.id === task.departmentId);
      const providerName = plain(provider?.name, 100) || PROVIDERS[task.provider] || plain(task.provider, 100);
      const meta = `${providerName} · ${plain(department?.name, 100) || plain(task.departmentId, 100)} · ${plain(task.modelId, 120) || tr('defaultModel')} · ${tr('effort')}: ${plain(task.reasoningEffort, 30) || 'default'} · ${tr('speed')}: ${plain(task.speed, 30) || 'default'}`;
      const allEvents = publicEvents(task), events = allEvents.slice(-8), skills = publicSkills(task), p = task.status === 'running' && task.progress?.source === 'model-estimate' ? task.progress : null;
      const percent = typeof p?.percent === 'number' && Number.isFinite(p.percent) && p.percent >= 0 && p.percent <= 99 ? p.percent : null;
      const eta = typeof p?.etaMinutes === 'number' && Number.isFinite(p.etaMinutes) && p.etaMinutes >= 0 && p.etaMinutes <= 1440 ? p.etaMinutes : null;
      const stage = plain(p?.stage), stageEvent = stage.trim() ? { type: 'status', source: 'model-estimate', text: stage, timestamp: timestamp(p.updatedAt) } : null;
      const latestSummary = allEvents.filter(event => PUBLIC_SOURCES.has(event.source)).at(-1);
      const prominent = stageEvent && (!latestSummary || stageEvent.timestamp && latestSummary.timestamp && Date.parse(stageEvent.timestamp) > Date.parse(latestSummary.timestamp)) ? stageEvent : latestSummary || events.at(-1);
      const times = [...events.map(event => event.timestamp), ...skills.map(skill => skill.timestamp), timestamp(p?.updatedAt)].filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b));
      const updatedAt = times.at(-1) || null;
      const signature = JSON.stringify([language, task.title, task.status, meta, prominent, percent, eta, updatedAt, events, skills]);
      let entry = entries.get(task.id); if (!entry) { entry = createCard(task.id); entries.set(task.id, entry); }
      if (entry.signature !== signature) {
        entry.signature = signature; entry.node.dataset.status = task.status;
        setText(entry.title, plain(task.title, 240) || task.id); setText(entry.badge, tr(task.status)); setText(entry.meta, meta);
        setText(entry.source, prominent ? sourceLabel(prominent) : tr(task.status === 'queued' ? 'queued' : 'cliStatus'));
        setText(entry.summary, prominent?.text || tr(task.status === 'queued' ? 'queuedWaiting' : 'waiting'));
        const estimateSignature = JSON.stringify([language, percent, eta]);
        if (entry.estimateSignature !== estimateSignature) {
          entry.estimateSignature = estimateSignature; entry.estimate.replaceChildren();
          if (percent !== null) {
            const label = h('strong', 'lp-percent', `${tr('modelEstimate')} · ${number(percent)}%`), meter = h('progress', 'lp-meter'); meter.max = 100; meter.value = percent; meter.setAttribute('aria-label', tr('modelEstimate'));
            entry.estimate.append(label, meter);
          } else entry.estimate.append(h('span', 'lp-estimate-waiting', tr('estimateWaiting')));
          if (eta !== null) entry.estimate.append(h('span', 'lp-eta', tr('eta').replace('{n}', number(eta))));
          if (percent !== null || eta !== null) entry.estimate.append(h('small', 'lp-uncertain', tr('uncertain')));
        }
        const updatedSignature = JSON.stringify([language, updatedAt]);
        const skillSignature = JSON.stringify([language, skills]);
        if (entry.skillSignature !== skillSignature) {
          entry.skillSignature = skillSignature; entry.skills.replaceChildren();
          if (!skills.length) entry.skills.append(h('p', 'lp-no-skills', tr('noSkills')));
          else {
            entry.skills.append(h('span', 'lp-skills-heading', tr('skills'))); const chips = h('ul', 'lp-skill-chips');
            for (const skill of skills) { const chip = h('li', 'lp-skill-chip'); chip.append(h('strong', '', skill.name), h('span', 'lp-skill-source', tr(SKILL_SOURCES[skill.source])), timeNode(skill.timestamp)); chips.append(chip); }
            entry.skills.append(chips, h('small', 'lp-skill-note', tr('skillNote')));
          }
        }
        if (entry.updatedSignature !== updatedSignature) { entry.updatedSignature = updatedSignature; entry.updated.replaceChildren(h('span', '', tr('updated')), timeNode(updatedAt)); }
        const eventSignature = JSON.stringify([language, events]);
        if (entry.eventSignature !== eventSignature) {
          entry.eventSignature = eventSignature; entry.timeline.replaceChildren();
          if (!events.length) entry.timeline.append(h('li', 'lp-no-events', tr('noEvents')));
          for (const event of events) { const row = h('li', 'lp-event'), copy = h('div', 'lp-event-copy'); copy.append(h('span', 'lp-event-kind', sourceLabel(event)), h('span', 'lp-event-text', event.text)); row.append(timeNode(event.timestamp), copy); entry.timeline.append(row); }
        }
      }
      if (list.children[index] !== entry.node) list.insertBefore(entry.node, list.children[index] || null);
    });
  }
  window.ImperiumLiveProgress = Object.freeze({ render, destroy() { root?.remove(); root = null; entries.clear(); selectedWorkspace = ''; } });
}());
