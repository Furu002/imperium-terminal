(function () {
  'use strict';
  const PROVIDERS = { codex: 'ChatGPT / Codex', claude: 'Claude Code', gemini: 'Gemini CLI', copilot: 'GitHub Copilot', ollama: 'Ollama' };
  const TEXT = {
    heading: ['내 AI 조직', 'My AI organization', '自分のAI組織'],
    agentCount: ['에이전트 {count}명', '{count} agents', 'エージェント {count}人'], running: ['실행 중', 'Running', '実行中'], add: ['+ 에이전트 추가', '+ Add agent', '+ エージェントを追加'],
    goal: ['무엇을 만들고 싶으세요?', 'What would you like to build?', '何を作りたいですか？'], placeholder: ['목표와 원하는 결과를 적어주세요.', 'Describe your goal and the result you need.', '目標と必要な成果を入力してください。'], assignGoal: ['업무 배정하기', 'Assign work', '業務を割り当てる'], goalNote: ['업무 화면에서 담당 에이전트를 선택한 뒤 전송하세요.', 'Choose an agent on the work screen before sending.', '業務画面で担当エージェントを選んで送信してください。'],
    owner: ['소유자', 'Owner', 'オーナー'], ownerRole: ['목표 설정 · 최종 결정', 'Goals · Final decisions', '目標設定 · 最終判断'], empty: ['등록된 에이전트가 없습니다.', 'No agents are registered.', '登録済みエージェントはありません。'], emptyNote: ['에이전트를 추가하고 역할과 모델 연결을 지정하세요.', 'Add an agent and choose its responsibility and model connection.', 'エージェントを追加し、役割とモデル接続を設定してください。'],
    edit: ['역할 편집', 'Edit role', '役割を編集'], assign: ['업무 지시', 'Assign work', '業務指示'], skills: ['스킬', 'Skills', 'スキル'], remove: ['에이전트 삭제', 'Remove agent', 'エージェントを削除'],
    idle: ['대기', 'Idle', '待機'], queued: ['작업 대기', 'Queued', '待機中'], offline: ['오프라인', 'Offline', 'オフライン'], unavailable: ['연결 필요', 'Connection required', '接続が必要'], disabled: ['로컬 모드에서 비활성', 'Disabled in local mode', 'ローカルモードで無効'], noWork: ['현재 배정된 업무 없음', 'No current assignment', '現在の担当業務なし'], current: ['현재 업무', 'Current assignment', '現在の業務'], model: ['요청 모델', 'Requested model', '要求モデル'], executionModel: ['실행 모델', 'Execution model', '実行モデル'], defaultModel: ['CLI 기본 모델', 'CLI default model', 'CLI既定モデル'], noRole: ['역할 지침 미설정', 'No role instructions', '役割指示が未設定'],
    skillLoading: ['스킬 연결 확인 중…', 'Loading assigned skills…', '割り当てスキルを確認中…'], skillError: ['스킬 연결을 확인할 수 없습니다.', 'Assigned skills are unavailable.', '割り当てスキルを確認できません。'], skillNone: ['연결한 스킬 없음', 'No assigned skills', '割り当てスキルなし'], unknownSkill: ['찾을 수 없는 스킬', 'Unavailable skill', '見つからないスキル'], refresh: ['스킬 새로고침', 'Refresh skills', 'スキルを再読み込み'],
    unobserved: ['스킬 사용 미관측', 'Skill use not observed', 'スキル使用は未観測'], evidence: ['최근 기록 · 도구 관측 {tools}건 · 모델 보고 {reports}건', 'Recent record · {tools} tool observations · {reports} model reports', '直近の記録 · ツール観測 {tools}件 · モデル報告 {reports}件'], evidenceNote: ['연결은 실행 증거가 아닙니다. 문서 읽기·호출은 성공을 보장하지 않으며 모델 보고는 미검증입니다.', 'Assignment is not execution evidence. Document reads and calls do not prove success; model reports are unverified.', '割り当ては実行の証拠ではありません。文書の読み取り・呼び出しは成功を保証せず、モデル報告は未検証です。'], partial: ['일부 로그만 표시됨', 'Only partial logs are available', '一部のログのみ表示'],
    next: ['다음 전달', 'Next handoff', '次の引き継ぎ'], connectedNext: ['연결된 다음 역할', 'Next connected role', '次に接続された役割'], noNext: ['아직 없음', 'None yet', 'まだありません'],
    create: ['에이전트 등록', 'Register agent', 'エージェントを登録'], name: ['에이전트 이름', 'Agent name', 'エージェント名'], title: ['직함', 'Title', '肩書き'], role: ['역할과 업무 지침', 'Responsibilities and instructions', '役割と業務指示'], provider: ['모델 제공자', 'Model provider', 'モデルプロバイダー'], connection: ['등록된 연결', 'Registered connection', '登録済み接続'], defaultConnection: ['기본 CLI 연결', 'Default CLI connection', '既定のCLI接続'], cancel: ['취소', 'Cancel', 'キャンセル'], close: ['닫기', 'Close', '閉じる'], register: ['등록하기', 'Register', '登録'], saving: ['저장 중…', 'Saving…', '保存中…'], registered: ['에이전트를 등록했습니다.', 'Agent registered.', 'エージェントを登録しました。'], createNote: ['등록은 모델을 실행하거나 캔버스 노드를 자동 생성하지 않습니다.', 'Registration does not run a model or automatically create a canvas node.', '登録してもモデル実行やキャンバスノードの自動追加は行いません。'],
    error: ['요청을 처리하지 못했습니다.', 'The request could not be completed.', 'リクエストを処理できませんでした。'], changed: ['프로젝트가 변경됐습니다. 현재 프로젝트에서 다시 시도하세요.', 'The project changed. Try again in the current project.', 'プロジェクトが変わりました。現在のプロジェクトで再試行してください。'], required: ['이름과 역할을 입력하세요.', 'Enter a name and responsibilities.', '名前と役割を入力してください。'], disconnected: ['서버 연결 후 다시 시도하세요.', 'Try again after the server reconnects.', 'サーバーの再接続後に再試行してください。'],
    importTemplate: ['템플릿 가져오기', 'Import template', 'テンプレートを読み込む'], importTitle: ['조직도 템플릿 가져오기', 'Import organization template', '組織図テンプレートの読み込み'], importNote: ['JSON 템플릿 하나로 에이전트·업무 전달선·카드 배치를 한 번에 등록합니다. 같은 이름의 에이전트는 덮어쓰지 않고 건너뜁니다.', 'Register agents, handoffs and card positions from one JSON template. Agents whose names already exist are skipped, never overwritten.', 'JSONテンプレート1つでエージェント・引き継ぎ線・カード配置をまとめて登録します。同じ名前のエージェントは上書きせずにスキップします。'], importFile: ['JSON 파일 선택', 'Choose a JSON file', 'JSONファイルを選択'], importPaste: ['또는 JSON 붙여넣기', 'Or paste JSON', 'またはJSONを貼り付け'], preview: ['미리보기', 'Preview', 'プレビュー'], previewing: ['미리보기를 확인하는 중…', 'Checking the preview…', 'プレビューを確認中…'], includeHandoffs: ['업무 전달선도 연결', 'Also connect handoffs', '業務の引き継ぎ線も接続'], handoffNote: ['워크플로 실행 시 연결된 하류 에이전트가 연쇄 실행됩니다', 'When a workflow runs, the connected downstream agents run in sequence', 'ワークフロー実行時、接続された下流のエージェントが連続して実行されます'], confirmImport: ['가져오기', 'Import', '読み込む'], importing: ['가져오는 중…', 'Importing…', '読み込み中…'],
    colStatus: ['결과', 'Result', '結果'], colName: ['이름', 'Name', '名前'], colDetail: ['내용', 'Details', '内容'], row_created: ['생성', 'Create', '作成'], row_skipped: ['건너뜀', 'Skip', 'スキップ'], row_error: ['오류', 'Error', 'エラー'], skipExists: ['같은 이름의 에이전트가 이미 있어 그대로 둡니다.', 'An agent with this name already exists and is left unchanged.', '同じ名前のエージェントが既にあるため、そのままにします。'], group: ['그룹', 'Group', 'グループ'], lead: ['리드', 'Lead', 'リード'],
    importSummary: ['생성 {created} · 건너뜀 {skipped} · 오류 {errors}', 'Create {created} · Skip {skipped} · Errors {errors}', '作成 {created} · スキップ {skipped} · エラー {errors}'], handoffSummary: ['업무 전달선 연결 {created} · 건너뜀 {skipped}', 'Handoffs: connect {created} · skip {skipped}', '引き継ぎ線: 接続 {created} · スキップ {skipped}'], handoffOff: ['업무 전달선 {total}개는 연결하지 않음', '{total} handoffs will not be connected', '引き継ぎ線 {total}件は接続しません'], stale: ['내용이 바뀌었습니다. 다시 미리보기 하세요.', 'The template changed. Preview it again.', '内容が変わりました。もう一度プレビューしてください。'],
    importEmpty: ['JSON 파일을 선택하거나 내용을 붙여넣으세요.', 'Choose a JSON file or paste its contents.', 'JSONファイルを選択するか内容を貼り付けてください。'], invalidJSON: ['JSON 형식을 읽을 수 없습니다.', 'The JSON could not be read.', 'JSONを読み取れません。'], fileTooLarge: ['128KB 이하의 템플릿만 가져올 수 있습니다.', 'Templates must be 128 KB or smaller.', '128KB以下のテンプレートのみ読み込めます。'], imported: ['조직도 템플릿을 가져왔습니다: {created}개 생성, {skipped}개 건너뜀', 'Template imported: {created} created, {skipped} skipped.', 'テンプレートを読み込みました: 作成 {created}件、スキップ {skipped}件'], layoutManual: ['배치는 수동 조정 필요', 'The card layout needs manual adjustment.', '配置は手動で調整してください'],
    parent: ['상위 에이전트', 'Reports to', '上位エージェント'], ownerDirect: ['소유자 직속', 'Owner (direct report)', 'オーナー直属'],
    removeTitle: ['이 에이전트를 삭제할까요?', 'Remove this agent?', 'このエージェントを削除しますか？'], removeNote: ['에이전트 설정과 해당 캔버스 노드만 삭제합니다. 기존 작업·대화·기억·연결 계정은 보존합니다.', 'Removes the agent configuration and its canvas nodes. Existing tasks, conversations, memory and account connections are retained.', 'エージェント設定と対応するキャンバスノードを削除します。既存の作業・会話・記憶・アカウント接続は保持します。'], removed: ['에이전트를 삭제했습니다. 기존 기록은 보존됩니다.', 'Agent removed. Existing records are retained.', 'エージェントを削除しました。既存の記録は保持されます。'], busy: ['진행 중인 작업이 끝난 뒤 삭제할 수 있습니다.', 'Wait until this agent’s work finishes before removing it.', 'このエージェントの作業が終了してから削除してください。'],
  };
  let state = {}, options = {}, language = 'ko', host, heading, summary, owner, list, goalInput, goalLabel, goalButton, goalNote, addButton, importButton, refreshButton, dialog, execution;
  let workspace = '', generation = 0, skills = null, skillStatus = 'waiting', skillsStamp = '', pendingSkills = '', skillEvent = 0;
  const cards = new Map();
  let nodeCanvas, goalPanel, goalToggle;
  const tr = (key, values = {}) => (TEXT[key]?.[language === 'en' ? 1 : language === 'ja' ? 2 : 0] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  const h = (tag, attributes = {}, ...children) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'class') element.className = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value !== undefined && value !== false) element.setAttribute(key, String(value));
    }
    element.append(...children); return element;
  };
  const currentWorkspace = () => options.getState?.()?.settings?.workspace ?? state.settings?.workspace ?? '';
  const scopePath = value => /^[A-Za-z]:[\\/]/.test(value || '') ? value.replaceAll('\\', '/').toLowerCase() : value;
  const currentScope = (key, epoch) => workspace === key && currentWorkspace() === key && generation === epoch;
  const tasks = () => (state.tasks || []).filter(task => !task.demo && scopePath(task.workspace) === scopePath(workspace));
  const roleById = id => (state.departments || []).find(item => item.id === id);
  // Agents that may become the parent of `id` (null for a new agent); the server enforces the same rules.
  const parentChoices = id => window.ImperiumOrganizationNodes?.hierarchy?.parentChoices(state.departments || [], id) ?? (state.departments || []).filter(item => item.id !== id);
  function request(path, config = {}) {
    if (typeof options.api !== 'function') return Promise.reject(new Error(tr('error')));
    return options.api(path, config);
  }
  function closeDialog() { if (!dialog) return; const closing = dialog; dialog = null; execution?.destroy(); execution = null; if (closing.open && typeof closing.close === 'function') closing.close(); closing.remove(); }
  function mount() {
    host = document.getElementById('organization-section'); if (!host) return false;
    host.classList.add('org-workbench');
    heading = h('h2', { class: 'org-title', id: 'organization-title' });
    summary = h('span', { class: 'org-count', id: 'org-summary' });
    addButton = h('button', { class: 'button button-primary org-add-agent', type: 'button', onclick: openCreate });
    importButton = h('button', { class: 'button button-quiet org-import-template', type: 'button', onclick: openImport });
    const refresh = () => { skillEvent++; void refreshSkills(); };
    refreshButton = h('button', { class: 'button button-quiet org-skills-refresh', type: 'button', onclick: refresh });
    goalLabel = h('label', { for: 'org-goal-input' }); goalInput = h('textarea', { id: 'org-goal-input', class: 'org-goal-input', rows: '3', maxlength: '12000' });
    goalInput.addEventListener('input', () => { const input = document.getElementById('dispatch-prompt'); if (input) { input.value = goalInput.value; input.dispatchEvent(new Event('input', { bubbles: true })); } });
    goalButton = h('button', { class: 'button button-primary', type: 'button', onclick: () => { options.onNavigate?.('operations'); document.getElementById('dispatch-department')?.focus(); } });
    goalNote = h('p', { class: 'org-goal-note' });
    owner = h('div', { class: 'org-chart-root', id: 'org-chart-root' });
    list = h('ul', { class: 'org-model-branches', id: 'org-model-branches' });
    goalPanel = h('section', { class: 'org-goal', id: 'org-goal-panel', hidden: '' }, goalLabel, goalInput, h('div', { class: 'org-goal-actions' }, goalNote, goalButton));
    goalToggle = h('button', { type: 'button', class: 'button button-quiet org-goal-toggle', 'aria-controls': 'org-goal-panel', 'aria-expanded': 'false', onclick: () => { goalPanel.hidden = !goalPanel.hidden; goalToggle.setAttribute('aria-expanded', String(!goalPanel.hidden)); if (!goalPanel.hidden) goalInput.focus(); } });
    host.replaceChildren(h('div', { class: 'org-toolbar' }, h('div', { class: 'org-heading-copy' }, heading, summary), h('div', { class: 'org-toolbar-actions' }, goalToggle, refreshButton, importButton, addButton)), goalPanel, owner, list);
    if (window.ImperiumOrganizationNodes) {
      const canvasHost = h('div', { class: 'org-nodes-host' }); host.append(canvasHost);
      refreshButton.remove();
      nodeCanvas = window.ImperiumOrganizationNodes.create({ container: canvasHost, owner, list, api: (route, config) => request(route, config), getState: () => options.getState?.() || state,
        onEditConnections: () => options.onNavigate?.('workflow'), onEditAgent: id => { const role = roleById(id); if (role) options.onEditDepartment?.(role); }, onAssignAgent: id => { if (roleById(id)) options.onAssignDepartment?.(id); },
        onSkillsAgent: id => { if (!roleById(id)) return; options.onNavigate?.('skills'); window.dispatchEvent(new CustomEvent('imperium:skills-agent', { detail: { workspace, departmentId: id } })); },
        onRemoveAgent: id => { const role = roleById(id); if (role) openRemove(role); },
        onRefreshSkills: refresh
      });
    }
    document.getElementById('dispatch-prompt')?.addEventListener('input', () => { const input = document.getElementById('dispatch-prompt'); if (input && goalInput.value !== input.value) goalInput.value = input.value; });
    return true;
  }
  async function refreshSkills() {
    if (!workspace || !options.connected || !state.server?.csrfToken) return;
    const stamp = JSON.stringify([workspace, state.server?.skillsRevision ?? 0, skillEvent]);
    if (stamp === skillsStamp || stamp === pendingSkills) return;
    const key = workspace, epoch = generation; pendingSkills = stamp; skillStatus = 'loading'; updateCards();
    try {
      const result = await request(`/api/skills?workspace=${encodeURIComponent(key)}`);
      if (!currentScope(key, epoch) || pendingSkills !== stamp) return;
      if (scopePath(result.workspace) !== scopePath(key) || !Array.isArray(result.skills) || !result.bindings || typeof result.bindings !== 'object' || Array.isArray(result.bindings)) throw new Error(tr('skillError'));
      skills = result; skillStatus = 'ready';
    } catch { if (!currentScope(key, epoch) || pendingSkills !== stamp) return; skills = null; skillStatus = 'error'; }
    if (currentScope(key, epoch) && pendingSkills === stamp) { pendingSkills = ''; skillsStamp = stamp; updateCards(); }
  }
  function providerIcon(provider) {
    if (!Object.hasOwn(PROVIDERS, provider)) return h('span', { class: 'org-provider-icon org-provider-fallback', 'aria-hidden': 'true' }, String(provider || '?')[0].toUpperCase());
    const fallback = h('span', { class: 'org-provider-icon org-provider-fallback', 'aria-hidden': 'true' }, provider[0].toUpperCase());
    const image = h('img', { class: 'org-provider-icon', src: `/model-icons/${provider}.svg`, alt: '', width: '28', height: '28' });
    image.addEventListener('error', () => image.replaceWith(fallback), { once: true }); return image;
  }
  function createCard(id) {
    const parts = { element: h('li', { class: 'org-agent-card', 'data-department-id': id }), name: h('h3', { class: 'org-agent-name' }), title: h('p', { class: 'org-agent-title' }), summary: h('p', { class: 'org-agent-summary' }), status: h('span', { class: 'org-agent-status' }), mark: h('span', { class: 'org-agent-mark' }), role: h('p', { class: 'org-agent-role' }), model: h('p', { class: 'org-agent-model' }), task: h('p', { class: 'org-agent-task' }), skills: h('div', { class: 'org-card-skills' }), evidence: h('p', { class: 'org-skill-evidence' }), next: h('p', { class: 'org-agent-next' }) };
    parts.assign = h('button', { class: 'button button-outline', type: 'button', onclick: () => { if (roleById(id)) options.onAssignDepartment?.(id); } });
    parts.edit = h('button', { class: 'button button-quiet', type: 'button', onclick: () => { const dept = roleById(id); if (dept) options.onEditDepartment?.(dept); } });
    parts.skillButton = h('button', { class: 'button button-quiet', type: 'button', onclick: () => { if (!roleById(id)) return; options.onNavigate?.('skills'); window.dispatchEvent(new CustomEvent('imperium:skills-agent', { detail: { workspace, departmentId: id } })); } });
    parts.remove = h('button', { class: 'button button-quiet org-remove-agent', type: 'button', onclick: () => { const dept = roleById(id); if (dept) openRemove(dept); } });
    parts.element.append(
      h('div', { class: 'org-agent-heading' }, parts.mark, h('div', { class: 'org-agent-identity' }, parts.name, parts.title, parts.summary), parts.status),
      parts.role, parts.model, parts.task, parts.skills, parts.evidence, parts.next,
      h('div', { class: 'org-agent-actions' }, parts.assign, parts.edit, parts.skillButton, parts.remove)
    );
    return parts;
  }
  function nextRoles(dept, latest) {
    const actual = latest ? tasks().filter(task => Array.isArray(task.dependsOn) && task.dependsOn.includes(latest.id)).map(task => roleById(task.departmentId)?.name || task.departmentName || task.departmentId) : [];
    if (actual.length) return { key: 'next', values: [...new Set(actual)] };
    const graph = state.graph || state.graphs?.[workspace], nodes = graph?.nodes || [];
    const departmentId = nodeId => nodes.find(node => node.id === nodeId && (node.type === 'department' || node.kind === 'department'))?.referenceId || (nodeId?.startsWith('department:') ? nodeId.slice(11) : null);
    const values = (graph?.edges || []).filter(edge => edge.type === 'handoff' && departmentId(edge.source) === dept.id).map(edge => roleById(departmentId(edge.target))?.name).filter(Boolean);
    return { key: values.length ? 'connectedNext' : 'next', values: [...new Set(values)] };
  }
  function updateCards() {
    if (!list) return;
    const departments = state.departments || [], scopedTasks = tasks();
    for (const [id, card] of cards) if (!departments.some(dept => dept.id === id)) { card.element.remove(); cards.delete(id); }
    list.querySelector('.org-empty-branch')?.remove();
    if (!departments.length) list.append(h('li', { class: 'org-empty-branch' }, h('strong', {}, tr('empty')), h('span', {}, tr('emptyNote'))));
    departments.forEach((dept, index) => {
      let card = cards.get(dept.id); if (!card) { card = createCard(dept.id); cards.set(dept.id, card); }
      if (list.children[index] !== card.element) list.insertBefore(card.element, list.children[index] || null);
      const assigned = scopedTasks.filter(task => task.departmentId === dept.id).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const active = assigned.find(task => task.status === 'running') || assigned.find(task => task.status === 'queued');
      const latest = active || assigned[0], provider = (state.providers || []).find(item => item.id === dept.provider), localDisabled = state.settings?.localOnly && dept.provider !== 'ollama' && provider?.kind !== 'local';
      const status = !options.connected ? 'offline' : localDisabled ? 'disabled' : active?.status || (provider?.status === 'ready' && provider.authenticated ? 'idle' : 'unavailable');
      card.element.dataset.status = status; card.name.textContent = dept.name || dept.id; card.title.textContent = dept.title || ''; card.title.hidden = !dept.title;
      card.status.textContent = tr(status); card.status.dataset.status = status;
      const shownProvider = active?.provider || dept.provider;
      const shownModel = active ? active.reportedModel || active.modelId : dept.modelId;
      if (card.provider !== shownProvider) { card.provider = shownProvider; card.mark.replaceChildren(providerIcon(shownProvider)); }
      card.role.textContent = dept.role || tr('noRole');
      card.model.textContent = `${PROVIDERS[shownProvider] || shownProvider || '—'} · ${tr(active?.reportedModel ? 'executionModel' : 'model')}: ${shownModel || tr('defaultModel')}`;
      card.summary.textContent = shownModel || PROVIDERS[shownProvider] || shownProvider || tr('defaultModel');
      card.summary.title = card.model.textContent;
      card.task.textContent = active ? `${tr('current')}: ${active.title || active.id}` : tr('noWork');
      card.task.dataset.title = active ? active.title || active.id : tr('noWork');
      card.assign.textContent = tr('assign'); card.assign.disabled = !options.connected || Boolean(localDisabled); card.edit.textContent = tr('edit'); card.skillButton.textContent = tr('skills'); card.remove.textContent = tr('remove'); card.remove.disabled = !options.connected || Boolean(active); card.remove.title = active ? tr('busy') : '';
      const binding = skills?.bindings?.[dept.id], ids = Array.isArray(binding) ? [...new Set(binding.filter(id => typeof id === 'string'))].slice(0, 20) : [];
      const skillSignature = JSON.stringify([language, skillStatus, ids, skills?.revision, (skills?.skills || []).map(skill => [skill.id, skill.name])]);
      if (card.skillSignature !== skillSignature) { card.skillSignature = skillSignature; card.skills.replaceChildren(...(skillStatus === 'ready' ? ids.length ? ids.map(id => { const skill = skills.skills.find(item => item.id === id); return h('span', { class: 'org-skill-chip', 'data-skill-id': id, title: skill?.description || '' }, skill?.name || tr('unknownSkill')); }) : [h('span', {}, tr('skillNone'))] : [h('span', {}, tr(skillStatus === 'error' ? 'skillError' : 'skillLoading'))])); }
      const logs = (latest?.logs || []).filter(log => log.type === 'skill' && ['cli-skill-read', 'cli-skill-call', 'model-reported'].includes(log.source));
      const observed = logs.filter(log => log.source !== 'model-reported').length, reported = logs.length - observed;
      card.evidence.textContent = `${logs.length ? tr('evidence', { tools: observed, reports: reported }) : tr('unobserved')}${latest?.detailsTruncated ? ` · ${tr('partial')}` : ''}`; card.evidence.title = tr('evidenceNote');
      const next = nextRoles(dept, latest); card.next.textContent = `${tr(next.key)}: ${next.values.join(' · ') || tr('noNext')}`;
      card.next.dataset.hasHandoff = String(next.values.length > 0);
    });
    nodeCanvas?.update(state, { language, connected: options.connected });
  }
  function showDialog(value) { closeDialog(); dialog = value; value.addEventListener('close', () => { if (dialog === value) closeDialog(); }); host.append(dialog); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
  function field(key, input) { return h('label', { class: 'settings-label org-agent-field' }, h('span', {}, tr(key)), input); }
  function openCreate() {
    if (!options.connected || !workspace) { options.toast?.(tr('disconnected'), true); return; }
    const key = workspace, epoch = generation;
    const name = h('input', { class: 'text-input', required: '', maxlength: '24', 'data-org-name': '', 'aria-label': tr('name') }), title = h('input', { class: 'text-input', maxlength: '80', 'aria-label': tr('title') }), role = h('textarea', { class: 'text-input', required: '', rows: '4', maxlength: '1500', 'data-org-role': '', 'aria-label': tr('role') });
    const ids = state.settings?.localOnly ? ['ollama'] : Object.keys(PROVIDERS);
    const parent = h('select', { class: 'text-input', 'data-org-parent': '', 'aria-label': tr('parent') }, h('option', { value: '' }, tr('ownerDirect')), ...parentChoices(null).map(item => h('option', { value: item.id }, item.name || item.id)));
    const provider = h('select', { class: 'text-input', 'data-org-provider': '', 'aria-label': tr('provider') }, ...ids.map(id => h('option', { value: id }, PROVIDERS[id]))), connection = h('select', { class: 'text-input', 'data-org-connection': '', 'aria-label': tr('connection') });
    const updateConnections = () => connection.replaceChildren(h('option', { value: '' }, tr('defaultConnection')), ...(state.connections || []).filter(item => item.providerId === provider.value).map(item => h('option', { value: item.id }, item.label || item.id)));
    updateConnections();
    const error = h('p', { class: 'form-error', role: 'alert', hidden: '' }), submit = h('button', { class: 'button button-primary', type: 'submit' }, tr('register'));
    const form = h('form', { class: 'dialog-body org-create-form' }, field('name', name), field('title', title), field('parent', parent), field('role', role), field('provider', provider), field('connection', connection), h('p', { class: 'field-help' }, tr('createNote')), error, h('div', { class: 'settings-actions' }, h('button', { class: 'button button-quiet', type: 'button', onclick: closeDialog }, tr('cancel')), submit));
    const view = h('dialog', { class: 'settings-dialog org-agent-dialog', 'aria-label': tr('create') }, h('div', { class: 'dialog-heading' }, h('h2', {}, tr('create')), h('button', { class: 'icon-button', type: 'button', 'aria-label': tr('close'), onclick: closeDialog }, '×')), form);
    showDialog(view);
    if (window.ImperiumExecution) { execution = window.ImperiumExecution.create({ api: request, provider: provider.value }); form.insertBefore(execution.element, error); }
    provider.addEventListener('change', () => { updateConnections(); execution?.setContext({ provider: provider.value, modelId: '', reasoningEffort: 'default', speed: 'default' }); });
    connection.addEventListener('change', () => { const item = (state.connections || []).find(value => value.id === connection.value); execution?.setContext({ provider: provider.value, modelId: item?.modelId || '', reasoningEffort: 'default', speed: 'default' }); });
    let pending = false;
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (pending) return; error.hidden = true;
      try {
        if (!currentScope(key, epoch)) throw new Error(tr('changed'));
        if (!name.value.trim() || !role.value.trim()) throw new Error(tr('required'));
        const settings = execution?.getValue() || { modelId: (state.connections || []).find(item => item.id === connection.value)?.modelId || '', reasoningEffort: 'default', speed: 'default' };
        pending = true; submit.disabled = true; submit.textContent = tr('saving');
        const result = await request('/api/departments', { method: 'POST', body: { workspace: key, name: name.value.trim(), title: title.value.trim(), role: role.value.trim(), provider: provider.value, connectionId: connection.value || null, parentId: parent.value || null, ...settings } });
        if (!currentScope(key, epoch)) return;
        if (!result.department?.id) throw new Error(tr('error'));
        if (dialog === view) closeDialog(); await options.onChanged?.();
        if (!currentScope(key, epoch)) return;
        options.toast?.(tr('registered')); window.dispatchEvent(new CustomEvent('imperium:departments-changed', { detail: { workspace: key } }));
      } catch (failure) { if (currentScope(key, epoch) && dialog === view) { error.textContent = failure.message; error.hidden = false; } }
      finally { pending = false; submit.disabled = false; submit.textContent = tr('register'); }
    });
    name.focus();
  }
  function openImport() {
    if (!options.connected || !workspace) { options.toast?.(tr('disconnected'), true); return; }
    const key = workspace, epoch = generation, limit = 128 * 1024;
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'org-import-file', 'data-org-import-file': '', 'aria-label': tr('importFile') });
    const text = h('textarea', { class: 'text-input org-import-text', rows: '8', spellcheck: 'false', 'data-org-import-text': '', 'aria-label': tr('importPaste'), placeholder: '{ "template": "…", "agents": [ … ], "handoffs": [ … ] }' });
    const handoffs = h('input', { type: 'checkbox', 'data-org-import-handoffs': '', 'aria-label': tr('includeHandoffs'), 'aria-describedby': 'org-import-handoff-note' });
    const previewButton = h('button', { class: 'button button-outline', type: 'button', 'data-org-import-preview': '' }, tr('preview'));
    const status = h('p', { class: 'org-import-summary', role: 'status', 'aria-live': 'polite' }), table = h('div', { class: 'org-import-preview' });
    const error = h('p', { class: 'form-error', role: 'alert', hidden: '' }), submit = h('button', { class: 'button button-primary', type: 'submit', disabled: '' }, tr('confirmImport'));
    const form = h('form', { class: 'dialog-body org-import-form' },
      h('p', { class: 'settings-description' }, tr('importNote')), field('importFile', file), field('importPaste', text),
      h('div', { class: 'org-import-row' }, previewButton, h('div', { class: 'org-import-option' }, h('label', {}, handoffs, h('span', {}, tr('includeHandoffs'))), h('span', { class: 'org-import-warning', id: 'org-import-handoff-note' }, tr('handoffNote')))),
      status, table, error, h('div', { class: 'settings-actions' }, h('button', { class: 'button button-quiet', type: 'button', onclick: closeDialog }, tr('cancel')), submit));
    const view = h('dialog', { class: 'settings-dialog org-agent-dialog org-import-dialog', 'aria-label': tr('importTitle') }, h('div', { class: 'dialog-heading' }, h('h2', {}, tr('importTitle')), h('button', { class: 'icon-button', type: 'button', 'aria-label': tr('close'), onclick: closeDialog }, '×')), form);
    showDialog(view);
    // A preview is valid only for the exact text and checkbox state it was produced from.
    let preview = null, previewed = '', template = null, pending = false, sequence = 0;
    const stamp = () => JSON.stringify([text.value, handoffs.checked]);
    const showError = message => { error.textContent = message; error.hidden = false; };
    const invalidate = () => { if (preview) status.textContent = tr('stale'); preview = null; submit.disabled = true; table.dataset.stale = 'true'; };
    const validResult = value => Boolean(value) && [value.created, value.skipped, value.errors, value.handoffs?.created, value.handoffs?.skipped].every(Array.isArray);
    function rows(result) {
      table.dataset.stale = 'false';
      if (!validResult(result)) { table.replaceChildren(); status.textContent = ''; return; }
      const detail = item => [item.title, PROVIDERS[item.provider] || item.provider, item.group && `${tr('group')}: ${item.group}${item.lead ? ` · ${tr('lead')}` : ''}`, item.parent && `${tr('parent')}: ${item.parent}`].filter(Boolean).join(' · ');
      const entries = [...result.created.map(item => ['created', item.name, detail(item)]), ...result.skipped.map(item => ['skipped', item.name, tr('skipExists')]), ...result.errors.map(item => ['error', item.name || '—', item.message])];
      table.replaceChildren(h('table', { class: 'org-import-table' },
        h('thead', {}, h('tr', {}, ...['colStatus', 'colName', 'colDetail'].map(column => h('th', { scope: 'col' }, tr(column))))),
        h('tbody', {}, ...entries.map(([kind, name, value]) => h('tr', { 'data-import-row': kind }, h('td', {}, h('span', { class: 'org-import-badge', 'data-kind': kind }, tr(`row_${kind}`))), h('td', {}, name), h('td', {}, value))))));
      const handoffText = result.includeHandoffs ? tr('handoffSummary', { created: result.handoffs.created.length, skipped: result.handoffs.skipped.length }) : tr('handoffOff', { total: result.handoffs.total });
      status.textContent = `${tr('importSummary', { created: result.created.length, skipped: result.skipped.length, errors: result.errors.length })} · ${handoffText}`;
    }
    function parse() {
      const raw = text.value.trim();
      if (!raw) throw new Error(tr('importEmpty'));
      if (new TextEncoder().encode(raw).length > limit) throw new Error(tr('fileTooLarge'));
      let value;
      try { value = JSON.parse(raw); } catch { throw new Error(tr('invalidJSON')); }
      // The server limit applies to the whole request body, not only the template text.
      if (new TextEncoder().encode(JSON.stringify({ workspace: key, dryRun: true, includeHandoffs: true, template: value })).length > limit) throw new Error(tr('fileTooLarge'));
      return value;
    }
    async function runPreview() {
      if (pending) return;
      const current = ++sequence, requested = stamp(); error.hidden = true;
      let parsed;
      try { parsed = parse(); } catch (failure) { previewButton.disabled = false; invalidate(); rows(null); showError(failure.message); return; }
      previewButton.disabled = true; status.textContent = tr('previewing');
      try {
        if (!currentScope(key, epoch)) throw new Error(tr('changed'));
        const result = await request('/api/departments/import', { method: 'POST', body: { workspace: key, dryRun: true, includeHandoffs: handoffs.checked, template: parsed } });
        if (!currentScope(key, epoch) || dialog !== view || current !== sequence) return;
        if (!validResult(result)) throw new Error(tr('error'));
        rows(result);
        if (stamp() !== requested) { invalidate(); return; }
        preview = result; previewed = requested; template = parsed;
        submit.disabled = !(result.ok && (result.created.length || result.includeHandoffs && result.handoffs.created.length));
      } catch (failure) { if (currentScope(key, epoch) && dialog === view && current === sequence) { invalidate(); rows(failure.details || null); showError(failure.message); } }
      finally { if (current === sequence) previewButton.disabled = false; }
    }
    file.addEventListener('change', async () => {
      const chosen = file.files?.[0]; if (!chosen) return;
      error.hidden = true;
      let content;
      try {
        if (chosen.size > limit) { invalidate(); showError(tr('fileTooLarge')); return; }
        try { content = typeof chosen.text === 'function' ? await chosen.text() : await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(chosen); }); }
        catch { showError(tr('invalidJSON')); return; }
      } finally { file.value = ''; } // Choosing the same file again after editing it must fire change again.
      if (dialog !== view) return;
      text.value = content; invalidate(); void runPreview();
    });
    text.addEventListener('input', () => { error.hidden = true; invalidate(); });
    handoffs.addEventListener('change', () => { if (text.value.trim()) void runPreview(); else invalidate(); });
    previewButton.addEventListener('click', () => { void runPreview(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !preview || previewed !== stamp()) return;
      pending = true; submit.disabled = true; previewButton.disabled = true; submit.textContent = tr('importing'); error.hidden = true;
      try {
        if (!currentScope(key, epoch)) throw new Error(tr('changed'));
        const result = await request('/api/departments/import', { method: 'POST', body: { workspace: key, includeHandoffs: handoffs.checked, template } });
        if (!currentScope(key, epoch)) return;
        if (dialog === view) closeDialog();
        // Fit only after the refreshed state has rendered the new cards, or their positions are not part of the fit.
        try { await options.onChanged?.(); }
        finally { if (currentScope(key, epoch) && result.layout?.saved) nodeCanvas?.reloadAndFit?.(); }
        if (!currentScope(key, epoch)) return;
        options.toast?.(tr('imported', { created: result.created?.length ?? 0, skipped: result.skipped?.length ?? 0 }));
        if (result.layout?.required && !result.layout.saved) options.toast?.(tr('layoutManual'), true);
        window.dispatchEvent(new CustomEvent('imperium:departments-changed', { detail: { workspace: key } }));
      } catch (failure) { if (currentScope(key, epoch) && dialog === view) { preview = null; rows(failure.details || null); showError(failure.message); } }
      finally { pending = false; submit.textContent = tr('confirmImport'); previewButton.disabled = false; if (dialog === view) submit.disabled = !preview; }
    });
    text.focus();
  }
  function openRemove(dept) {
    const key = workspace, epoch = generation, error = h('p', { class: 'form-error', role: 'alert', hidden: '' });
    const submit = h('button', { class: 'button button-primary', type: 'button' }, tr('remove'));
    const view = h('dialog', { class: 'settings-dialog org-agent-dialog org-remove-dialog', 'aria-label': tr('removeTitle') }, h('div', { class: 'dialog-heading' }, h('h2', {}, tr('removeTitle'))), h('div', { class: 'dialog-body' }, h('strong', {}, dept.name || dept.id), h('p', { class: 'settings-description' }, tr('removeNote')), error, h('div', { class: 'settings-actions' }, h('button', { class: 'button button-quiet', type: 'button', onclick: closeDialog }, tr('cancel')), submit)));
    showDialog(view); let pending = false;
    submit.addEventListener('click', async () => {
      if (pending) return; pending = true; submit.disabled = true;
      try {
        if (!currentScope(key, epoch)) throw new Error(tr('changed'));
        await request(`/api/departments/${encodeURIComponent(dept.id)}`, { method: 'DELETE', body: { workspace: key } });
        if (!currentScope(key, epoch)) return;
        if (dialog === view) closeDialog(); await options.onChanged?.(); if (currentScope(key, epoch)) options.toast?.(tr('removed'));
      } catch (failure) { if (currentScope(key, epoch) && dialog === view) { error.textContent = failure.message; error.hidden = false; } }
      finally { pending = false; submit.disabled = false; }
    });
  }
  function render(incoming, callbacks = {}) {
    state = incoming || {}; options = { ...options, ...callbacks }; language = options.language || state.settings?.language || 'ko';
    if (!host && !mount()) return;
    const key = state.settings?.workspace || '';
    if (workspace !== key) { workspace = key; generation++; closeDialog(); skills = null; skillStatus = 'waiting'; skillsStamp = ''; pendingSkills = ''; cards.clear(); list.replaceChildren(); goalPanel.hidden = !document.getElementById('dispatch-prompt')?.value?.trim(); }
    heading.textContent = tr('heading'); addButton.textContent = tr('add'); addButton.disabled = !options.connected; importButton.textContent = tr('importTemplate'); importButton.disabled = !options.connected; refreshButton.textContent = tr('refresh'); refreshButton.disabled = !options.connected;
    goalLabel.textContent = tr('goal'); goalInput.placeholder = tr('placeholder'); goalInput.setAttribute('aria-label', tr('goal')); goalButton.textContent = tr('assignGoal'); goalNote.textContent = tr('goalNote');
    goalToggle.textContent = language === 'en' ? 'Enter goal' : language === 'ja' ? '目標を入力' : '목표 입력'; goalToggle.setAttribute('aria-expanded', String(!goalPanel.hidden));
    const dispatch = document.getElementById('dispatch-prompt'); if (dispatch && goalInput.value !== dispatch.value) goalInput.value = dispatch.value;
    summary.textContent = tr('agentCount', { count: (state.departments || []).length });
    const identity = state.settings?.identity || {};
    const ownerKey = JSON.stringify([language, identity.name, identity.title]);
    if (owner.dataset.identity !== ownerKey) {
      const name = identity.name || tr('owner');
      owner.dataset.identity = ownerKey;
      owner.replaceChildren(h('div', { class: 'org-commander-node org-commander-card' },
        h('span', { class: 'org-commander-badge', 'aria-hidden': 'true' }, Array.from(name.trim())[0] || '•'),
        h('div', { class: 'org-commander-content' }, h('strong', { class: 'org-commander-name' }, name),
          h('span', { class: 'org-commander-role' }, identity.title || tr('ownerRole')))));
    }
    updateCards(); void refreshSkills();
  }
  window.addEventListener('imperium:skills-changed', event => { if (event.detail?.workspace && scopePath(event.detail.workspace) !== scopePath(workspace)) return; skillEvent++; void refreshSkills(); });
  window.ImperiumOrganization = { render };
})();
