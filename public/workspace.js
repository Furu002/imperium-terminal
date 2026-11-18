(function () {
  'use strict';
  const WORDS = {
    en: {
      '노드 워크스페이스': 'Node workspace', '조직 · 기억 · 실행 흐름': 'ORGANIZATION / MEMORY / WORKFLOW', '화면 맞춤': 'Fit view', '자동 배치': 'Auto arrange', '기억 추가': 'Add memory', '선택 부서 지시': 'Assign selected', '저장됨': 'Saved', '저장 중…': 'Saving…', '불러오는 중…': 'Loading…', '저장 실패': 'Save failed', '연결 대기': 'Awaiting connection',
      '휠: 이동 · Ctrl+휠: 확대 · 빈 공간 드래그: 이동': 'Wheel: pan · Ctrl+wheel: zoom · Drag background: pan', '모델': 'models', '부서 역할': 'department roles', '연결': 'connections', '본부장': 'Commander', '지휘 · 최종 의사결정': 'Direction · Final decisions', '부서 에이전트': 'Department agent', '기억': 'Memory', '연결됨': 'Connected', '로그인 필요': 'Sign-in needed', '설치 필요': 'Install needed', '확인 필요': 'Attention', '오프라인': 'Offline', '실행 중': 'Running', '대기 중': 'Queued', '지시 대기': 'Standing by', '연결 필요': 'Connect model',
      '노드 검사기': 'Node inspector', '노드를 선택하세요': 'Select a node', '노드의 연결, 역할과 기억을 편집할 수 있습니다.': 'Inspect roles, memory and connections.', '역할': 'Role', '담당 모델': 'Assigned model', '업무 지시': 'Assign work', '부서 편집': 'Edit department', '연결 관리': 'Manage connection', '구성된 역할입니다. 업무를 지시할 때 모델이 실행됩니다.': 'A configured role. The model runs when you assign work.', '모델은 각 운영체제 사용자 계정의 공식 CLI 로그인을 사용합니다.': 'Models use the official CLI login of the current OS user.',
      '기억 연결': 'Memory context', '업무 전달': 'Workflow handoff', '연결 삭제': 'Delete connection', '연결하면 기억이 대상 부서의 작업 문맥에 포함됩니다.': 'Connected memory is included in the department’s task context.', '워크플로를 실행하면 이 연결을 따라 다음 부서로 업무가 전달됩니다.': 'Running a workflow passes work to the next department along this connection.', '연결만으로 작업이 실행되지는 않습니다.': 'Connecting nodes does not execute work.', '연결할 대상 부서의 왼쪽 포트를 선택하세요.': 'Choose the input port on the target department.', '기억→부서 또는 부서→부서 연결만 가능합니다.': 'Connect memory to a department, or one department to another.', '같은 연결이 이미 있습니다.': 'This connection already exists.', '순환하는 업무 전달은 만들 수 없습니다.': 'Workflow handoffs cannot contain a cycle.', '연결을 저장했습니다.': 'Connection saved.', '연결을 삭제했습니다.': 'Connection removed.',
      '제목': 'Title', '기억 내용': 'Memory content', '고정 기억': 'Pinned memory', '수정 이력': 'Revision', '기억 저장': 'Save memory', '캔버스에서 제거': 'Remove from canvas', '기억 자체는 삭제되지 않습니다.': 'The underlying memory is retained.', '기억 선택': 'Choose memory', '기억을 선택하거나 새로 작성하세요.': 'Choose an existing memory or create one.', '아직 저장한 기억이 없습니다.': 'No saved memories yet.', '새 기억 만들기': 'Create memory', '추가': 'Add', '닫기': 'Close', '기억을 추가했습니다.': 'Memory added.', '기억을 저장했습니다.': 'Memory saved.', '이 기억은 이미 캔버스에 있습니다.': 'This memory is already on the canvas.',
      '워크플로 지시': 'Workflow command', '연결된 흐름 실행': 'Run connected workflow', '파일 수정 허용': 'Allow file edits', '연결된 부서에 순서대로 전달할 목표를 작성하세요.': 'Describe the goal to pass through the connected departments.', '업무 내용을 입력하세요.': 'Enter a workflow command.', '워크플로를 시작했습니다.': 'Workflow started.', '요청을 처리하지 못했습니다.': 'The request could not be completed.', '선택한 부서가 없습니다.': 'Select a department first.', '프로젝트별로 노드 위치와 연결을 저장합니다.': 'Node positions and connections are saved per project.', '기억을 문맥으로 전달': 'Send memory as context', '다음 부서로 업무 전달': 'Hand off to another department', '부서 입력 포트': 'Department input port', '현재 업무': 'Current assignment', '구독 로그인': 'Subscription login',
    },
    ja: {
      '노드 워크스페이스': 'ノードワークスペース', '조직 · 기억 · 실행 흐름': '組織 / 記憶 / ワークフロー', '화면 맞춤': '全体表示', '자동 배치': '自動配置', '기억 추가': '記憶を追加', '선택 부서 지시': '選択部署に指示', '저장됨': '保存済み', '저장 중…': '保存中…', '불러오는 중…': '読み込み中…', '저장 실패': '保存失敗', '연결 대기': '接続待ち',
      '휠: 이동 · Ctrl+휠: 확대 · 빈 공간 드래그: 이동': 'ホイール：移動 · Ctrl+ホイール：拡大 · 背景をドラッグ：移動', '모델': 'モデル', '부서 역할': '部署の役割', '연결': '接続', '본부장': '本部長', '지휘 · 최종 의사결정': '指揮 · 最終意思決定', '부서 에이전트': '部署エージェント', '기억': '記憶', '연결됨': '接続済み', '로그인 필요': '要ログイン', '설치 필요': '要インストール', '확인 필요': '要確認', '오프라인': 'オフライン', '실행 중': '実行中', '대기 중': '実行待ち', '지시 대기': '指示待ち', '연결 필요': '接続が必要',
      '노드 검사기': 'ノードの詳細', '노드를 선택하세요': 'ノードを選択', '노드의 연결, 역할과 기억을 편집할 수 있습니다.': '役割、記憶、接続を確認・編集できます。', '역할': '役割', '담당 모델': '担当モデル', '업무 지시': '業務を指示', '부서 편집': '部署を編集', '연결 관리': '接続を管理', '구성된 역할입니다. 업무를 지시할 때 모델이 실행됩니다.': '設定された役割です。業務を指示した際にモデルが実行されます。', '모델은 각 운영체제 사용자 계정의 공식 CLI 로그인을 사용합니다.': '各OSユーザーの公式CLIログインを使用します。',
      '기억 연결': '記憶の文脈', '업무 전달': '業務の引き継ぎ', '연결 삭제': '接続を削除', '연결하면 기억이 대상 부서의 작업 문맥에 포함됩니다.': '接続した記憶は対象部署の作業文脈に含まれます。', '워크플로를 실행하면 이 연결을 따라 다음 부서로 업무가 전달됩니다.': 'ワークフローを実行すると、接続先の部署に業務を引き継ぎます。', '연결만으로 작업이 실행되지는 않습니다.': '接続するだけでは業務は実行されません。', '연결할 대상 부서의 왼쪽 포트를 선택하세요.': '接続先部署の左側入力ポートを選択してください。', '기억→부서 또는 부서→부서 연결만 가능합니다.': '記憶→部署、または部署→部署を接続できます。', '같은 연결이 이미 있습니다.': '同じ接続がすでにあります。', '순환하는 업무 전달은 만들 수 없습니다.': '循環するワークフローは作成できません。', '연결을 저장했습니다.': '接続を保存しました。', '연결을 삭제했습니다.': '接続を削除しました。',
      '제목': 'タイトル', '기억 내용': '記憶の内容', '고정 기억': '記憶を固定', '수정 이력': '改訂', '기억 저장': '記憶を保存', '캔버스에서 제거': 'キャンバスから除外', '기억 자체는 삭제되지 않습니다.': '記憶自体は削除されません。', '기억 선택': '記憶を選択', '기억을 선택하거나 새로 작성하세요.': '既存の記憶を選ぶか、新しく作成してください。', '아직 저장한 기억이 없습니다.': '保存された記憶はまだありません。', '새 기억 만들기': '記憶を作成', '추가': '追加', '닫기': '閉じる', '기억을 추가했습니다.': '記憶を追加しました。', '기억을 저장했습니다.': '記憶を保存しました。', '이 기억은 이미 캔버스에 있습니다.': 'この記憶はすでにキャンバスにあります。',
      '워크플로 지시': 'ワークフローへの指示', '연결된 흐름 실행': '接続したフローを実行', '파일 수정 허용': 'ファイル編集を許可', '연결된 부서에 순서대로 전달할 목표를 작성하세요.': '接続した部署に順番に引き継ぐ目標を記入してください。', '업무 내용을 입력하세요.': '業務内容を入力してください。', '워크플로를 시작했습니다.': 'ワークフローを開始しました。', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '선택한 부서가 없습니다.': '部署を選択してください。', '프로젝트별로 노드 위치와 연결을 저장합니다.': 'ノードの位置と接続はプロジェクトごとに保存されます。', '기억을 문맥으로 전달': '記憶を文脈として渡す', '다음 부서로 업무 전달': '次の部署に引き継ぐ', '부서 입력 포트': '部署の入力ポート', '현재 업무': '現在の業務', '구독 로그인': 'サブスクリプションログイン',
    },
  };
  Object.assign(WORDS.en, { '노드 추가': 'Add nodes', '빈 워크스페이스': 'Empty workspace', '필요한 에이전트와 기억을 직접 추가하세요.': 'Add only the agents and memories you need.', '노드를 클릭하거나 캔버스로 끌어 추가합니다.': 'Click a node or drag it onto the canvas.', '회사 조직도 템플릿 불러오기': 'Load organization template', '사용자 노드': 'Your identity', '모델 제공자': 'Model providers', '에이전트/역할': 'Agents / roles', '새 에이전트 등록': 'Create an agent', '에이전트 이름': 'Agent name', '직함': 'Title', '이름': 'Name', '역할과 지침': 'Role and instructions', '등록하고 노드 추가': 'Create and add node', '기본 연결': 'Default connection', '등록된 연결': 'Registered connection', '로컬 전용 모드': 'Local-only mode', '클라우드 제공자를 숨겼습니다.': 'Cloud providers are hidden.', '로컬 전용 모드에서 비활성화됨': 'Disabled in local-only mode', '노드만 제거하며 실제 에이전트·연결·기억은 삭제하지 않습니다.': 'Removes only the node. Agents, connections, and memories are retained.', '이 제공자는 AI 연결 화면에서 먼저 설치하거나 등록하세요.': 'Install or register this provider in AI connections first.', '추가할 항목이 없습니다.': 'No items available.', '캔버스에 있음': 'On canvas', '나': 'Me', '워크스페이스 소유자': 'Workspace owner', '이름표 저장': 'Save identity', '이름표를 저장했습니다.': 'Identity saved.', '제공자 변경은 에이전트 편집에서 설정합니다.': 'Change the assigned provider in the agent editor.', '에이전트를 등록했습니다.': 'Agent created.', '역할을 입력하세요.': 'Describe the role.', '제공자': 'Provider', '템플릿은 현재 캔버스에 없는 조직 노드만 추가합니다.': 'The template adds organization nodes that are not already on the canvas.' });
  Object.assign(WORDS.ja, { '노드 추가': 'ノードを追加', '빈 워크스페이스': '空のワークスペース', '필요한 에이전트와 기억을 직접 추가하세요.': '必要なエージェントと記憶だけを追加してください。', '노드를 클릭하거나 캔버스로 끌어 추가합니다.': 'クリック、またはキャンバスにドラッグして追加します。', '회사 조직도 템플릿 불러오기': '組織図テンプレートを読み込む', '사용자 노드': '自分のノード', '모델 제공자': 'モデルプロバイダー', '에이전트/역할': 'エージェント / 役割', '새 에이전트 등록': 'エージェントを登録', '에이전트 이름': 'エージェント名', '직함': '役職', '이름': '名前', '역할과 지침': '役割と指示', '등록하고 노드 추가': '登録してノードを追加', '기본 연결': '既定の接続', '등록된 연결': '登録済み接続', '로컬 전용 모드': 'ローカル専用モード', '클라우드 제공자를 숨겼습니다.': 'クラウドプロバイダーを非表示にしています。', '로컬 전용 모드에서 비활성화됨': 'ローカル専用モードでは無効', '노드만 제거하며 실제 에이전트·연결·기억은 삭제하지 않습니다.': 'ノードのみを除外し、エージェント・接続・記憶自体は削除しません。', '이 제공자는 AI 연결 화면에서 먼저 설치하거나 등록하세요.': '先にAI接続画面でインストールまたは登録してください。', '추가할 항목이 없습니다.': '追加できる項目がありません。', '캔버스에 있음': '追加済み', '나': '自分', '워크스페이스 소유자': 'ワークスペース所有者', '이름표 저장': '名前・役職を保存', '이름표를 저장했습니다.': '名前・役職を保存しました。', '제공자 변경은 에이전트 편집에서 설정합니다.': '担当モデルはエージェント編集で変更します。', '에이전트를 등록했습니다.': 'エージェントを登録しました。', '역할을 입력하세요.': '役割を記入してください。', '제공자': 'プロバイダー', '템플릿은 현재 캔버스에 없는 조직 노드만 추가합니다.': 'テンプレートは未追加の組織ノードのみ追加します。' });
  Object.assign(WORDS.en, { 'AI 자체 추정': 'AI self-estimate', 'AI 추정 대기': 'Awaiting AI estimate', '실제 완료': 'Process completed', '진행률 보고 없음': 'No progress report', 'AI 예상 약 {minutes}분': 'AI ETA ~{minutes} min', '예상범위 초과·재추정 대기': 'Estimate exceeded · awaiting update', '과거 {samples}건 기준 약 {minutes}분 (p90 {p90}분)': 'History {samples} runs: ~{minutes} min (p90 {p90} min)', '과거 {samples}건 기준·재추정 대기 (p90 {p90}분)': 'History {samples} runs: awaiting update (p90 {p90} min)', 'AI 보고 작업 단계': 'AI-reported work stage', '최근 작업': 'Latest operation', '실패': 'Failed', '취소됨': 'Cancelled', '중단됨': 'Interrupted' });
  Object.assign(WORDS.ja, { 'AI 자체 추정': 'AI自身の推定', 'AI 추정 대기': 'AI推定待ち', '실제 완료': '実際に完了', '진행률 보고 없음': '進捗報告なし', 'AI 예상 약 {minutes}분': 'AI予測 約{minutes}分', '예상범위 초과·재추정 대기': '予測時間超過・再推定待ち', '과거 {samples}건 기준 약 {minutes}분 (p90 {p90}분)': '過去{samples}件基準 約{minutes}分（p90 {p90}分）', '과거 {samples}건 기준·재추정 대기 (p90 {p90}분)': '過去{samples}件基準・再推定待ち（p90 {p90}分）', 'AI 보고 작업 단계': 'AI報告の作業段階', '최근 작업': '最近のタスク', '실패': '失敗', '취소됨': '中止', '중단됨': '中断' });
  const h = (tag, attrs = {}, ...children) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') element.className = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value !== undefined && value !== false && value !== null) element.setAttribute(key, String(value));
    }
    children.flat().forEach(child => { if (child !== undefined && child !== null) element.append(child instanceof Node ? child : document.createTextNode(String(child))); });
    return element;
  };
  const svg = (tag, attrs = {}) => { const element = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value)); return element; };
  const uid = prefix => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const dimensions = type => type === 'memory' ? { width: 236, height: 160 } : type === 'department' ? { width: 230, height: 162 } : { width: 230, height: 112 };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let state = {}, options = {}, host, stage, world, edgesLayer, inspector, label, toolbar, footer, memoryDialog, emptyOverlay, libraryPanel;
  let graph = { nodes: [], edges: [] }, memories = [], memoryLoaded = false, project = null, loaded = false, loading = false, dirty = false, saving = false, errorMessage = '';
  let selected = null, pendingSource = null, drag = null, zoom = 1, pan = { x: 0, y: 0 }, saveTimer, progressTimer, requestGeneration = 0, inspectorSignature = '', loadedGraphHash = '', savingPromise = Promise.resolve(true);
  let agentExecutionControls, removalDialog;
  const workflowDrafts = new Map();
  Object.assign(WORDS.en, { '협업 보드': 'Collaboration board', '연결 에이전트 실행': 'Run connected agents', '실행 대상': 'Agents to run', '시작 에이전트': 'Starting agent', '파일 수정은 접근 설정과 모든 대상 모델이 허용할 때만 선택할 수 있습니다.': 'File edits can be enabled only when the access policy and every target provider allow them.', '실행 불가': 'Not ready', '그래프 저장이 끝난 뒤 다시 실행하세요.': 'Wait for graph changes to be saved, then run again.' });
  Object.assign(WORDS.ja, { '협업 보드': '共同作業ボード', '연결 에이전트 실행': '接続したエージェントを実行', '실행 대상': '実行対象', '시작 에이전트': '開始エージェント', '파일 수정은 접근 설정과 모든 대상 모델이 허용할 때만 선택할 수 있습니다.': 'アクセス設定とすべての対象モデルが許可する場合のみ、ファイル編集を有効にできます。', '실행 불가': '実行不可', '그래프 저장이 끝난 뒤 다시 실행하세요.': 'グラフの保存が完了してから再実行してください。' });
  Object.assign(WORDS.en, { '에이전트 제거': 'Remove agent', '에이전트 등록과 캔버스 노드가 제거됩니다. 대화·작업·기억은 보존되며 계정에서 로그아웃하지 않습니다.': 'Removes the registered agent and its canvas nodes. Conversations, tasks and memories are retained. The account stays signed in.', '실행·대기 중인 작업이 끝난 뒤 에이전트를 제거할 수 있습니다.': 'Wait for this agent’s running and queued tasks to finish before removing it.', '취소': 'Cancel', '제거 확인': 'Confirm removal', '에이전트를 제거했습니다.': 'Agent removed.', '모델 연결 등록을 제거하려면 AI 계정 화면을 여세요.': 'Open AI accounts to remove a registered model connection.' });
  Object.assign(WORDS.ja, { '에이전트 제거': 'エージェントを削除', '에이전트 등록과 캔버스 노드가 제거됩니다. 대화·작업·기억은 보존되며 계정에서 로그아웃하지 않습니다.': 'エージェント登録とキャンバスのノードを削除します。会話・タスク・記憶は保持し、アカウントからログアウトしません。', '실행·대기 중인 작업이 끝난 뒤 에이전트를 제거할 수 있습니다.': '実行中・待機中のタスクが終了してから削除できます。', '취소': 'キャンセル', '제거 확인': '削除を確認', '에이전트를 제거했습니다.': 'エージェントを削除しました。', '모델 연결 등록을 제거하려면 AI 계정 화면을 여세요.': 'モデル接続の登録を削除するにはAIアカウント画面を開いてください。' });
  const tr = key => WORDS[options.language]?.[key] ?? key;
  const common = key => options.t?.(key) ?? tr(key);
  const online = () => options.connected !== false;
  const providerLabel = id => state.providers?.find(provider => provider.id === id)?.name || (id === 'codex' ? 'ChatGPT / Codex' : id === 'claude' ? 'Claude Code' : String(id || '—'));
  const deptFor = item => state.departments?.find(dept => dept.id === item.referenceId);
  const memoryFor = item => memories.find(memory => memory.id === item.referenceId);
  const defaultNames = { strategy: '전략기획실', engineering: '개발본부', research: '리서치센터', quality: '품질관리실' };
  const deptName = dept => dept?.name === defaultNames[dept?.id] ? common(dept.name) : dept?.name || '—';
  const allProviders = () => [...new Set([...(state.providers || []).filter(provider => provider.installed || provider.status === 'ready').map(provider => provider.id), ...(state.departments || []).map(dept => dept.provider), ...(state.connections || []).map(connection => connection.providerId)])];
  const identity = () => ({ name: state.settings?.identity?.name || tr('나'), title: state.settings?.identity?.title || tr('워크스페이스 소유자') });
  const isLocalProvider = id => id === 'ollama' || state.providers?.find(provider => provider.id === id)?.kind === 'local';
  const isDisabled = item => Boolean(state.settings?.localOnly && (item.type === 'provider' && !isLocalProvider(item.referenceId) || item.type === 'department' && !isLocalProvider(deptFor(item)?.provider)));
  const availableProviders = () => [...new Set([...(state.providers || []).filter(provider => provider.installed || provider.status === 'ready').map(provider => provider.id), ...(state.connections || []).map(connection => connection.providerId)])].filter(id => !state.settings?.localOnly || isLocalProvider(id));
  const visibleDepartments = () => (state.departments || []).filter(dept => !state.settings?.localOnly || isLocalProvider(dept.provider));
  const currentTask = deptId => (state.tasks || []).find(task => task.departmentId === deptId && task.status === 'running') || (state.tasks || []).find(task => task.departmentId === deptId && task.status === 'queued');
  const progressTask = deptId => currentTask(deptId) || [...(state.tasks || [])].filter(task => task.departmentId === deptId).sort((a, b) => new Date(b.finishedAt || b.startedAt || b.createdAt) - new Date(a.finishedAt || a.startedAt || a.createdAt))[0];
  const progressText = (key, values = {}) => tr(key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  function renderTaskProgress(task, compact = false) {
    const completed = task.status === 'completed';
    const modelReport = task.progress?.source === 'model-estimate' && typeof task.progress.percent === 'number' && Number.isFinite(task.progress.percent) && task.progress.percent >= 0;
    const percent = completed ? 100 : modelReport ? Math.min(99, Math.max(0, Math.round(task.progress.percent))) : null;
    const source = completed ? 'process' : modelReport ? 'model-estimate' : 'none';
    const terminal = ['failed', 'cancelled', 'interrupted'].includes(task.status), statusLabel = { failed: '실패', cancelled: '취소됨', interrupted: '중단됨' }[task.status];
    const labelText = `${terminal ? `${tr(statusLabel)} · ` : ''}${tr(completed ? '실제 완료' : modelReport ? 'AI 자체 추정' : terminal ? '진행률 보고 없음' : 'AI 추정 대기')}`;
    const wrapper = h('div', { class: compact ? 'iw-node-progress' : 'iw-task-progress', 'data-progress-task-id': task.id, 'data-progress-source': source, 'data-task-status': task.status, 'data-compact': compact ? 'true' : 'false' });
    wrapper.append(h('div', { class: 'iw-progress-line' }, h('span', { class: 'iw-progress-label', title: labelText }, labelText), ...(percent === null ? [] : [h('strong', { class: 'iw-progress-percent' }, `${percent}%`)])));
    if (percent !== null) {
      const fill = h('span', { class: 'iw-progress-fill' }); fill.style.width = `${percent}%`;
      wrapper.append(h('div', { class: 'iw-progress-track', role: 'progressbar', 'aria-label': labelText, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': percent }, fill));
    }
    if (!completed && !terminal && modelReport && typeof task.progress.etaMinutes === 'number' && Number.isFinite(task.progress.etaMinutes) && task.progress.etaMinutes >= 0 && task.progress.etaMinutes <= 1440) {
      const reportedAt = new Date(task.progress.updatedAt).getTime();
      if (Number.isFinite(reportedAt)) {
        const remaining = task.progress.etaMinutes - Math.max(0, Date.now() - reportedAt) / 60000;
        const eta = remaining > 0 ? progressText('AI 예상 약 {minutes}분', { minutes: Math.ceil(remaining) }) : tr('예상범위 초과·재추정 대기');
        wrapper.append(h('div', { class: 'iw-progress-eta', title: eta }, eta));
      }
    }
    const history = task.historicalETA;
    if (!completed && !terminal && history?.source === 'history' && Number.isInteger(history.sampleCount) && history.sampleCount > 0 && Number.isFinite(history.remainingSeconds) && history.remainingSeconds >= 0 && Number.isFinite(history.p90Seconds) && history.p90Seconds >= 0) {
      const text = progressText(history.remainingSeconds > 0 ? '과거 {samples}건 기준 약 {minutes}분 (p90 {p90}분)' : '과거 {samples}건 기준·재추정 대기 (p90 {p90}분)', { samples: history.sampleCount, minutes: Math.ceil(history.remainingSeconds / 60), p90: Math.ceil(history.p90Seconds / 60) });
      wrapper.append(h('div', { class: 'iw-progress-history', 'data-estimate-source': 'history', title: text }, text));
    }
    if (!compact && task.progress?.source === 'model-estimate' && typeof task.progress.stage === 'string' && task.progress.stage.trim()) wrapper.append(h('p', { class: 'iw-progress-stage' }, h('span', {}, tr('AI 보고 작업 단계')), h('strong', {}, task.progress.stage.trim().slice(0, 160))));
    return wrapper;
  }
  function updateProgressDisplays() {
    if (!host) return;
    host.querySelectorAll('[data-progress-task-id]').forEach(element => { const task = (state.tasks || []).find(item => item.id === element.dataset.progressTaskId); if (task) element.replaceWith(renderTaskProgress(task, element.dataset.compact === 'true')); });
  }
  function statusFor(item) {
    if (isDisabled(item)) return { key: 'disabled', text: tr('로컬 전용 모드에서 비활성화됨') };
    if (!online()) return { key: 'offline', text: tr('오프라인') };
    if (item.type === 'provider') {
      const provider = state.providers?.find(value => value.id === item.referenceId);
      const key = provider?.status || 'error';
      return { key, text: tr({ ready: '연결됨', login_required: '로그인 필요', missing: '설치 필요', error: '확인 필요' }[key] || '확인 필요') };
    }
    if (item.type === 'department') {
      const dept = deptFor(item), task = currentTask(item.referenceId);
      if (task) return { key: task.status, text: `${task.demo ? 'DEMO · ' : ''}${tr(task.status === 'running' ? '실행 중' : '대기 중')}` };
      return state.providers?.some(provider => provider.id === dept?.provider && provider.status === 'ready') ? { key: 'idle', text: tr('지시 대기') } : { key: 'unavailable', text: tr('연결 필요') };
    }
    return { key: item.type === 'memory' ? 'memory' : 'commander', text: item.type === 'memory' ? `${memoryFor(item)?.pinned ? 'PINNED · ' : ''}r${memoryFor(item)?.revision || 1}` : 'WORKSPACE IDENTITY' };
  }
  async function request(url, method = 'GET', body, workspaceKey = project) {
    const scoped = url === '/api/graph' || url === '/api/memory' || url.startsWith('/api/memory/') || url === '/api/workflows/run';
    if (scoped && method === 'GET') url += `${url.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(workspaceKey || '')}`;
    if (scoped && method !== 'GET') body = { ...body, workspace: workspaceKey };
    const response = await fetch(url, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || tr('요청을 처리하지 못했습니다.'));
    return result;
  }
  function announce(text, failed = false) {
    if (!label) return;
    label.textContent = text;
    label.classList.toggle('iw-error', failed);
    errorMessage = failed ? text : '';
  }
  function findNode(type, referenceId) { return graph.nodes.find(item => item.type === type && (referenceId === undefined || item.referenceId === referenceId)); }
  function ensureOrganization() {
    // A saved empty graph is intentional. Only prune references; never seed nodes.
    const providerIds = new Set([...(state.providers || []).map(provider => provider.id), ...allProviders()]);
    const departmentIds = new Set((state.departments || []).map(dept => dept.id));
    graph.nodes = graph.nodes.filter(item => item.type === 'commander' || item.type === 'provider' && providerIds.has(item.referenceId) || item.type === 'department' && departmentIds.has(item.referenceId) || item.type === 'memory' && (!memoryLoaded || memories.some(memory => memory.id === item.referenceId && !memory.archived)));
    const nodeIds = new Set(graph.nodes.map(item => item.id));
    graph.edges = graph.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target) && ['memory_context', 'handoff'].includes(edge.type));
    if (selected?.kind === 'node' && !nodeIds.has(selected.id)) selected = null;
  }
  function sanitize(incoming) {
    return {
      nodes: (incoming?.nodes || []).filter(item => typeof item.id === 'string' && ['commander', 'provider', 'department', 'memory'].includes(item.type)).map(item => ({ id: item.id, type: item.type, referenceId: String(item.referenceId || ''), x: clamp(Number(item.x) || 0, -2000, 6000), y: clamp(Number(item.y) || 0, -2000, 6000) })),
      edges: (incoming?.edges || []).filter(edge => ['memory_context', 'handoff'].includes(edge.type)).map(edge => ({ id: String(edge.id), source: String(edge.source), target: String(edge.target), type: edge.type })),
    };
  }
  async function load() {
    if (loading) return;
    loading = true; const generation = ++requestGeneration;
    announce(tr('불러오는 중…'));
    const results = await Promise.allSettled([request('/api/graph'), request('/api/memory')]);
    if (generation !== requestGeneration) return;
    loading = false;
    if (results[0].status === 'fulfilled') { graph = sanitize(results[0].value.graph || results[0].value); loadedGraphHash = JSON.stringify(graph); }
    if (results[1].status === 'fulfilled') { memories = results[1].value.nodes || results[1].value.memory?.nodes || []; memoryLoaded = true; }
    ensureOrganization(); loaded = true;
    if (results.some(result => result.status === 'rejected')) announce(results.filter(result => result.status === 'rejected').map(result => result.reason.message).join(' · '), true);
    else announce(tr('저장됨'));
    renderScene(); fit();
  }
  function scheduleSave() { dirty = true; announce(tr('저장 중…')); clearTimeout(saveTimer); saveTimer = setTimeout(persist, 350); }
  async function persist() {
    if (saving) { const result = await savingPromise; return result && dirty ? persist() : result; }
    if (!loaded) return false;
    if (!dirty) return true;
    saving = true; dirty = false;
    let release, successful = false; savingPromise = new Promise(resolve => { release = resolve; });
    const payload = sanitize(graph), payloadHash = JSON.stringify(payload), key = project;
    try {
      const result = await request('/api/graph', 'PUT', payload, key);
      if (key === project) { loadedGraphHash = JSON.stringify(sanitize(result.graph || payload)); announce(tr('저장됨')); successful = true; }
    } catch (error) { if (key === project) { dirty = true; announce(`${tr('저장 실패')}: ${error.message}`, true); } }
    finally { saving = false; release(successful); if (dirty && !errorMessage && payloadHash !== JSON.stringify(sanitize(graph))) scheduleSave(); }
    return successful;
  }
  function mount() {
    host = document.getElementById('node-workspace');
    if (!host) return false;
    host.classList.add('iw-workspace');
    host.closest('.app-shell')?.classList.add('iw-enabled');
    toolbar = h('div', { class: 'iw-toolbar' });
    stage = h('div', { class: 'iw-stage', tabindex: '0', 'aria-label': tr('노드 워크스페이스') });
    world = h('div', { class: 'iw-world' });
    edgesLayer = svg('svg', { class: 'iw-edges', width: '8000', height: '8000', 'aria-hidden': 'true' });
    emptyOverlay = h('div', { class: 'iw-empty-canvas' });
    world.append(edgesLayer); stage.append(world, emptyOverlay);
    inspector = h('aside', { class: 'iw-inspector', 'aria-label': tr('노드 검사기') });
    label = h('span', { class: 'iw-save-status', role: 'status', 'aria-live': 'polite' });
    footer = h('div', { class: 'iw-footer' });
    host.replaceChildren(toolbar, h('div', { class: 'iw-body' }, stage, inspector), footer);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerdown', beginPan);
    stage.addEventListener('keydown', event => {
      if (event.key === 'Escape') { pendingSource = null; drawEdges(); announce(tr('저장됨')); }
      if (['Delete', 'Backspace'].includes(event.key) && selected && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) { event.preventDefault(); if (selected.kind === 'edge') removeEdge(selected.id); else removeNode(selected.id); }
      if ((event.ctrlKey || event.metaKey) && event.key === '0') { event.preventDefault(); fit(); }
    });
    window.addEventListener('pointermove', movePointer);
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    stage.addEventListener('dragover', event => { if (event.dataTransfer?.types?.includes('application/x-imperium-node')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
    stage.addEventListener('drop', event => { event.preventDefault(); try { const value = JSON.parse(event.dataTransfer.getData('application/x-imperium-node')); addLibraryNode(value.type, value.referenceId, toWorld(event.clientX, event.clientY)); } catch { /* Ignore unrelated external drag data. */ } });
    window.addEventListener('resize', () => { if (loaded && !drag) renderScene(); });
    if (!progressTimer) progressTimer = setInterval(updateProgressDisplays, 15000);
    inspector.addEventListener('focusout', () => setTimeout(() => { if (!inspector.contains(document.activeElement)) renderInspector(true); }, 0));
    return true;
  }
  function renderToolbar() {
    toolbar.replaceChildren(h('div', { class: 'iw-toolbar-brand' }, h('strong', {}, tr('노드 워크스페이스')), h('span', {}, tr('조직 · 기억 · 실행 흐름'))),
      h('div', { class: 'iw-toolbar-actions' },
        h('button', { type: 'button', 'data-iw-action': 'fit', onclick: fit }, '⊡ ', tr('화면 맞춤')),
        h('button', { type: 'button', 'data-iw-action': 'zoom-out', 'aria-label': 'Zoom out', onclick: () => setZoom(zoom / 1.18) }, '−'),
        h('span', { class: 'iw-zoom-value' }, `${Math.round(zoom * 100)}%`),
        h('button', { type: 'button', 'data-iw-action': 'zoom-in', 'aria-label': 'Zoom in', onclick: () => setZoom(zoom * 1.18) }, '+'),
        h('button', { type: 'button', 'data-iw-action': 'arrange', onclick: arrangeCurrent }, tr('자동 배치')),
        h('button', { type: 'button', 'data-iw-action': 'add-node', class: 'iw-accent-button', onclick: openNodeLibrary }, '+ ', tr('노드 추가')),
        h('button', { type: 'button', 'data-iw-action': 'add-memory', class: 'iw-accent-button', onclick: openMemoryDialog }, '+ ', tr('기억 추가')),
        h('button', { type: 'button', 'data-iw-action': 'collaboration', onclick: () => options.onOpenCollaboration?.() }, tr('협업 보드')),
        h('button', { type: 'button', 'data-iw-action': 'assign', onclick: () => { const item = graph.nodes.find(value => value.id === selected?.id); if (item?.type === 'department' && !isDisabled(item)) options.onAssignDepartment?.(item.referenceId); else announce(tr(item && isDisabled(item) ? '로컬 전용 모드에서 비활성화됨' : '선택한 부서가 없습니다.'), true); } }, tr('선택 부서 지시'))));
    const ready = online() ? (state.providers || []).filter(provider => provider.status === 'ready').length : 0;
    footer.replaceChildren(h('span', { class: 'iw-hint' }, tr('휠: 이동 · Ctrl+휠: 확대 · 빈 공간 드래그: 이동')), h('span', { class: 'iw-counts' }, `${ready}/${allProviders().length} ${tr('모델')} · ${(state.departments || []).length} ${tr('부서 역할')} · ${graph.edges.length} ${tr('연결')}`), label);
    if (!errorMessage && !saving && !dirty && loaded) announce(tr('저장됨'));
  }
  function renderScene() {
    if (!host) return;
    renderToolbar();
    emptyOverlay.hidden = graph.nodes.length > 0 || !loaded;
    emptyOverlay.replaceChildren(h('span', { class: 'iw-empty-symbol', 'aria-hidden': 'true' }, '⌘'), h('h3', {}, tr('빈 워크스페이스')), h('p', {}, tr('필요한 에이전트와 기억을 직접 추가하세요.')), h('div', {}, h('button', { type: 'button', 'data-iw-action': 'empty-add', class: 'iw-accent-button', onclick: openNodeLibrary }, '+ ', tr('노드 추가')), h('button', { type: 'button', 'data-iw-action': 'template', onclick: loadTemplate }, tr('회사 조직도 템플릿 불러오기'))));
    if (!drag) {
      world.querySelectorAll('.iw-node').forEach(item => item.remove());
      for (const item of graph.nodes) world.append(renderNode(item));
      drawEdges(); transform();
    }
    renderInspector();
    updateProgressDisplays();
  }
  function renderNode(item) {
    const status = statusFor(item), dept = deptFor(item), memory = memoryFor(item), size = dimensions(item.type);
    let title, subtitle, description;
    if (item.type === 'commander') { title = identity().name; subtitle = 'IDENTITY / YOU'; description = identity().title; }
    else if (item.type === 'provider') { title = providerLabel(item.referenceId); subtitle = 'PROVIDER / CLI'; description = tr('구독 로그인'); }
    else if (item.type === 'department') { title = deptName(dept); subtitle = dept?.title || `AGENT / ${providerLabel(dept?.provider)}`; description = common(dept?.role || ''); }
    else { title = memory?.title || tr('기억'); subtitle = `MEMORY / ${memory?.kind || 'note'}`; description = memory?.content || '—'; }
    const card = h('article', { class: `iw-node iw-node-${item.type}${selected?.kind === 'node' && selected.id === item.id ? ' iw-selected' : ''}`, 'data-node-id': item.id, 'data-node-type': item.type, 'data-status': status.key, tabindex: '0', 'aria-label': `${title} · ${status.text}` });
    card.style.left = `${item.x}px`; card.style.top = `${item.y}px`; card.style.width = `${size.width}px`; card.style.height = `${size.height}px`;
    const head = h('div', { class: 'iw-node-heading', 'data-drag-node': item.id }, h('span', { class: 'iw-node-kind' }, subtitle), h('span', { class: 'iw-drag-grip', 'aria-hidden': 'true' }, '⠿'));
    card.append(head, h('h3', { class: 'iw-node-title', title }, title), h('p', { class: 'iw-node-description', title: description }, description), h('span', { class: 'iw-node-status', 'data-status': status.key }, status.text));
    const task = item.type === 'department' && progressTask(item.referenceId);
    if (task) { card.classList.add('iw-node-has-progress'); card.append(renderTaskProgress(task, true), h('p', { class: 'iw-node-task', title: task.title }, `${task.demo ? '[DEMO] ' : ''}${currentTask(item.referenceId) ? '' : `${tr('최근 작업')} · `}${task.title}`)); }
    if (item.type === 'department') card.append(h('button', { class: 'iw-port iw-port-in', type: 'button', 'data-input-node': item.id, 'aria-label': `${title} · ${tr('부서 입력 포트')}`, title: tr('부서 입력 포트'), onclick: event => { event.stopPropagation(); if (pendingSource) connectNodes(pendingSource, item.id); } }));
    if (['department', 'memory'].includes(item.type)) {
      const port = h('button', { class: 'iw-port iw-port-out', type: 'button', 'data-output-node': item.id, 'aria-label': item.type === 'memory' ? tr('기억을 문맥으로 전달') : tr('다음 부서로 업무 전달'), title: item.type === 'memory' ? tr('기억을 문맥으로 전달') : tr('다음 부서로 업무 전달') });
      port.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); pendingSource = item.id; drag = { type: 'connect', pointerId: event.pointerId, pointer: toWorld(event.clientX, event.clientY) }; announce(tr('연결할 대상 부서의 왼쪽 포트를 선택하세요.')); drawEdges(); });
      port.addEventListener('click', event => { event.stopPropagation(); if (event.detail === 0) { pendingSource = item.id; announce(tr('연결할 대상 부서의 왼쪽 포트를 선택하세요.')); } });
      card.append(port);
    }
    card.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      event.preventDefault(); event.stopPropagation(); selectNode(item.id);
      drag = { type: 'node', id: item.id, pointerId: event.pointerId, initial: { x: item.x, y: item.y }, start: { x: event.clientX, y: event.clientY }, moved: false };
      stage.classList.add('iw-dragging');
    });
    card.addEventListener('click', event => { if (!event.target.closest('button')) selectNode(item.id); });
    card.addEventListener('keydown', event => { if (event.target === card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectNode(item.id); } });
    return card;
  }
  function selectNode(id) { selected = { kind: 'node', id }; inspectorSignature = ''; world.querySelectorAll('.iw-node').forEach(item => item.classList.toggle('iw-selected', item.dataset.nodeId === id)); drawEdges(); renderInspector(true); }
  function selectEdge(id) { selected = { kind: 'edge', id }; inspectorSignature = ''; world.querySelectorAll('.iw-node').forEach(item => item.classList.remove('iw-selected')); drawEdges(); renderInspector(true); }
  function transform() { world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`; const value = toolbar.querySelector('.iw-zoom-value'); if (value) value.textContent = `${Math.round(zoom * 100)}%`; }
  function toWorld(clientX, clientY) { const bounds = stage.getBoundingClientRect(); return { x: (clientX - bounds.left - pan.x) / zoom, y: (clientY - bounds.top - pan.y) / zoom }; }
  function setZoom(value, origin) {
    const next = clamp(value, .35, 1.8), bounds = stage.getBoundingClientRect(), point = origin || { x: bounds.width / 2, y: bounds.height / 2 };
    const before = { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom };
    zoom = next; pan = { x: point.x - before.x * zoom, y: point.y - before.y * zoom }; transform();
  }
  function fit() {
    if (!graph.nodes.length || !stage) return;
    const bounds = stage.getBoundingClientRect(), width = bounds.width || 900, height = bounds.height || 600;
    const left = Math.min(...graph.nodes.map(item => item.x)), top = Math.min(...graph.nodes.map(item => item.y));
    const right = Math.max(...graph.nodes.map(item => item.x + dimensions(item.type).width)), bottom = Math.max(...graph.nodes.map(item => item.y + dimensions(item.type).height));
    zoom = clamp(Math.min((width - 66) / (right - left), (height - 70) / (bottom - top)), .35, 1.05);
    pan = { x: (width - (right - left) * zoom) / 2 - left * zoom, y: (height - (bottom - top) * zoom) / 2 - top * zoom }; transform();
  }
  function onWheel(event) { event.preventDefault(); if (event.ctrlKey || event.metaKey) { const bounds = stage.getBoundingClientRect(); setZoom(zoom * Math.exp(-event.deltaY * .003), { x: event.clientX - bounds.left, y: event.clientY - bounds.top }); } else { pan.x -= event.deltaX; pan.y -= event.deltaY; transform(); } }
  function beginPan(event) {
    if (event.button !== 0 || event.target.closest('.iw-node') || event.target.closest('.iw-edge-hit') || event.target.closest('button,input,textarea,select,.iw-empty-canvas')) return;
    if (pendingSource) { pendingSource = null; drawEdges(); }
    drag = { type: 'pan', pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, initial: { ...pan } };
    stage.classList.add('iw-panning'); event.preventDefault();
  }
  function movePointer(event) {
    if (!drag || (drag.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    if (drag.type === 'pan') { pan = { x: drag.initial.x + event.clientX - drag.start.x, y: drag.initial.y + event.clientY - drag.start.y }; transform(); }
    else if (drag.type === 'node') {
      const item = graph.nodes.find(value => value.id === drag.id); if (!item) return;
      item.x = clamp(drag.initial.x + (event.clientX - drag.start.x) / zoom, -2000, 6000); item.y = clamp(drag.initial.y + (event.clientY - drag.start.y) / zoom, -2000, 6000); drag.moved = true;
      const element = [...world.querySelectorAll('.iw-node')].find(value => value.dataset.nodeId === item.id); if (element) { element.style.left = `${item.x}px`; element.style.top = `${item.y}px`; } drawEdges();
    } else if (drag.type === 'connect') { drag.pointer = toWorld(event.clientX, event.clientY); drawEdges(); }
  }
  function endPointer(event) {
    if (!drag || (drag.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const completed = drag; drag = null; stage.classList.remove('iw-dragging', 'iw-panning');
    if (completed.type === 'node' && completed.moved) scheduleSave();
    if (completed.type === 'connect') { const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest('[data-input-node]'); if (target && pendingSource) connectNodes(pendingSource, target.dataset.inputNode); }
    drawEdges();
  }
  function pathBetween(source, target, organization = false) {
    if (organization) { const a = { x: source.x + dimensions(source.type).width / 2, y: source.y + dimensions(source.type).height }, b = { x: target.x + dimensions(target.type).width / 2, y: target.y }; const mid = (a.y + b.y) / 2; return `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`; }
    const a = { x: source.x + dimensions(source.type).width, y: source.y + dimensions(source.type).height / 2 }, b = target.type ? { x: target.x, y: target.y + dimensions(target.type).height / 2 } : target;
    const bend = Math.max(65, Math.abs(b.x - a.x) * .45); return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
  }
  function drawEdges() {
    if (!edgesLayer) return;
    const paths = [], commander = findNode('commander');
    for (const item of graph.nodes) {
      const source = item.type === 'provider' ? commander : item.type === 'department' ? findNode('provider', deptFor(item)?.provider) : null;
      if (source) paths.push(svg('path', { d: pathBetween(source, item, true), class: 'iw-edge iw-edge-organization' }));
    }
    for (const edge of graph.edges) {
      const source = graph.nodes.find(item => item.id === edge.source), target = graph.nodes.find(item => item.id === edge.target); if (!source || !target) continue;
      const d = pathBetween(source, target), chosen = selected?.kind === 'edge' && selected.id === edge.id;
      paths.push(svg('path', { d, class: `iw-edge iw-edge-${edge.type}${chosen ? ' iw-edge-selected' : ''}`, 'data-edge-id': edge.id }));
      const hit = svg('path', { d, class: 'iw-edge-hit', 'data-edge-id': edge.id, tabindex: '0', role: 'button', 'aria-label': tr(edge.type === 'memory_context' ? '기억 연결' : '업무 전달') });
      hit.addEventListener('click', event => { event.stopPropagation(); selectEdge(edge.id); });
      hit.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); selectEdge(edge.id); } else if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); removeEdge(edge.id); } });
      paths.push(hit);
    }
    if (drag?.type === 'connect' && pendingSource) { const source = graph.nodes.find(item => item.id === pendingSource); if (source) paths.push(svg('path', { d: pathBetween(source, drag.pointer), class: 'iw-edge iw-edge-preview' })); }
    edgesLayer.replaceChildren(...paths);
  }
  function hasHandoffPath(from, to) { const seen = new Set(), pending = [from]; while (pending.length) { const current = pending.pop(); if (current === to) return true; if (seen.has(current)) continue; seen.add(current); graph.edges.filter(edge => edge.type === 'handoff' && edge.source === current).forEach(edge => pending.push(edge.target)); } return false; }
  function connectNodes(sourceId, targetId) {
    const source = graph.nodes.find(item => item.id === sourceId), target = graph.nodes.find(item => item.id === targetId);
    pendingSource = null;
    if (!source || target?.type !== 'department' || !['department', 'memory'].includes(source.type) || sourceId === targetId) { announce(tr('기억→부서 또는 부서→부서 연결만 가능합니다.'), true); drawEdges(); return; }
    const type = source.type === 'memory' ? 'memory_context' : 'handoff';
    if (graph.edges.some(edge => edge.source === sourceId && edge.target === targetId && edge.type === type)) { announce(tr('같은 연결이 이미 있습니다.'), true); return; }
    if (type === 'handoff' && hasHandoffPath(targetId, sourceId)) { announce(tr('순환하는 업무 전달은 만들 수 없습니다.'), true); return; }
    const edge = { id: uid('edge'), source: sourceId, target: targetId, type }; graph.edges.push(edge); selected = { kind: 'edge', id: edge.id }; inspectorSignature = ''; renderScene(); scheduleSave();
  }
  function removeEdge(id) { graph.edges = graph.edges.filter(edge => edge.id !== id); selected = null; inspectorSignature = ''; renderScene(); scheduleSave(); }
  function removeNode(id) {
    graph.nodes = graph.nodes.filter(item => item.id !== id);
    graph.edges = graph.edges.filter(edge => edge.source !== id && edge.target !== id);
    if (pendingSource === id) pendingSource = null;
    selected = null; inspectorSignature = ''; renderScene(); scheduleSave();
  }
  function confirmAgentRemoval(dept) {
    if (currentTask(dept.id)) return;
    removalDialog?.close(); removalDialog?.remove();
    const key = project, generation = requestGeneration, dialog = h('dialog', { class: 'iw-removal-dialog', 'data-iw-remove-dialog': dept.id }); removalDialog = dialog;
    const error = h('p', { role: 'alert' }), cancel = h('button', { type: 'button', onclick: () => { dialog.close(); dialog.remove(); } }, tr('취소'));
    const confirm = h('button', { type: 'button', class: 'iw-danger-button', 'data-iw-confirm-remove': dept.id, onclick: async () => {
      if (project !== key || requestGeneration !== generation || currentTask(dept.id)) { error.textContent = tr('실행·대기 중인 작업이 끝난 뒤 에이전트를 제거할 수 있습니다.'); return; }
      confirm.disabled = true; cancel.disabled = true;
      try {
        if (!await persist()) throw new Error(errorMessage || tr('저장 실패'));
        if (project !== key || requestGeneration !== generation) return;
        await request(`/api/departments/${encodeURIComponent(dept.id)}`, 'DELETE', { workspace: key });
        if (project !== key || requestGeneration !== generation) return;
        dialog.close(); dialog.remove(); await options.onChanged?.();
        const latest = await request('/api/state');
        if (project !== key || requestGeneration !== generation || latest.settings?.workspace !== key) return;
        state = latest; dirty = false; clearTimeout(saveTimer); loading = false; await load();
        if (project === key) announce(tr('에이전트를 제거했습니다.'));
      } catch (failure) { if (project === key && requestGeneration === generation) { error.textContent = failure.message; announce(failure.message, true); confirm.disabled = Boolean(currentTask(dept.id)); cancel.disabled = false; } }
    } }, tr('제거 확인'));
    dialog.append(h('div', { class: 'dialog-body' }, h('h2', {}, tr('에이전트 제거')), h('strong', {}, deptName(dept)), h('p', {}, tr('에이전트 등록과 캔버스 노드가 제거됩니다. 대화·작업·기억은 보존되며 계정에서 로그아웃하지 않습니다.')), error, cancel, confirm));
    document.body.append(dialog); dialog.showModal();
  }
  function arrangeCurrent(save = true) {
    const providers = graph.nodes.filter(item => item.type === 'provider');
    providers.forEach((item, index) => { item.x = index * 560 + 150; item.y = 210; });
    let independent = 0;
    for (const item of graph.nodes.filter(value => value.type === 'department')) {
      const providerIndex = providers.findIndex(provider => provider.referenceId === deptFor(item)?.provider);
      const peers = graph.nodes.filter(value => value.type === 'department' && deptFor(value)?.provider === deptFor(item)?.provider);
      const index = peers.indexOf(item);
      item.x = providerIndex >= 0 ? providerIndex * 560 + index % 2 * 270 : independent++ % 3 * 270;
      item.y = providerIndex >= 0 ? 420 + Math.floor(index / 2) * 205 : 210 + Math.floor((independent - 1) / 3) * 205;
    }
    for (const item of graph.nodes.filter(value => value.type === 'commander')) { item.x = providers.length ? (providers.length - 1) * 280 + 150 : 150; item.y = 25; }
    const right = Math.max(400, ...graph.nodes.filter(item => item.type !== 'memory').map(item => item.x + dimensions(item.type).width));
    graph.nodes.filter(item => item.type === 'memory').forEach((item, index) => { item.x = right + 100 + index % 2 * 270; item.y = 40 + Math.floor(index / 2) * 205; });
    renderScene(); fit(); if (save && graph.nodes.length) scheduleSave();
  }
  function addLibraryNode(type, referenceId, position, save = true) {
    if (!loaded) { announce(tr('불러오는 중…')); return; }
    if (type === 'provider' && !availableProviders().includes(referenceId) || type === 'department' && !visibleDepartments().some(dept => dept.id === referenceId) || type === 'memory' && !memories.some(memory => memory.id === referenceId && !memory.archived) || !['commander', 'provider', 'department', 'memory'].includes(type)) return;
    let item = findNode(type, type === 'commander' ? undefined : referenceId);
    if (!item) {
      const bounds = stage.getBoundingClientRect(), center = toWorld(bounds.left + (bounds.width || 900) / 2 - 90, bounds.top + (bounds.height || 600) / 2 - 60);
      item = { id: type === 'commander' ? 'commander' : `${type}:${referenceId}`, type, referenceId: type === 'commander' ? 'commander' : referenceId, x: position?.x ?? center.x + graph.nodes.length % 4 * 20, y: position?.y ?? center.y + graph.nodes.length % 4 * 20 };
      graph.nodes.push(item);
    } else if (position) { item.x = position.x; item.y = position.y; }
    selected = { kind: 'node', id: item.id }; inspectorSignature = ''; renderScene();
    if (save) scheduleSave();
    return item;
  }
  function loadTemplate() {
    if (!loaded) return;
    const existing = new Set(graph.nodes.map(item => item.id)), positions = new Map(graph.nodes.map(item => [item.id, { x: item.x, y: item.y }]));
    addLibraryNode('commander', 'commander', undefined, false);
    availableProviders().forEach(id => addLibraryNode('provider', id, undefined, false));
    visibleDepartments().forEach(dept => addLibraryNode('department', dept.id, undefined, false));
    arrangeCurrent(false);
    for (const item of graph.nodes) if (existing.has(item.id)) Object.assign(item, positions.get(item.id));
    libraryPanel?.remove(); libraryPanel = null; renderScene(); fit(); scheduleSave();
  }
  function libraryEntry(type, referenceId, name, detail) {
    const exists = findNode(type, type === 'commander' ? undefined : referenceId);
    const entry = h('button', { type: 'button', class: 'iw-library-entry', draggable: 'true', 'data-library-type': type, 'data-library-reference': referenceId, onclick: () => addLibraryNode(type, referenceId) }, h('span', { class: 'iw-library-entry-copy' }, h('strong', {}, name), h('small', {}, detail || '')), h('span', { class: 'iw-library-entry-action' }, exists ? '✓' : '+'));
    if (exists) entry.title = tr('캔버스에 있음');
    entry.addEventListener('dragstart', event => { event.dataTransfer?.setData('application/x-imperium-node', JSON.stringify({ type, referenceId })); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'; });
    return entry;
  }
  async function openNodeLibrary() {
    libraryPanel?.remove(); libraryPanel = h('section', { class: 'iw-node-library', role: 'dialog', 'aria-label': tr('노드 추가') }); host.append(libraryPanel); renderNodeLibrary();
    const key = project;
    try { const result = await request('/api/memory'); if (key !== project || !libraryPanel) return; memories = result.nodes || result.memory?.nodes || []; memoryLoaded = true; renderNodeLibrary(); } catch (error) { announce(error.message, true); }
  }
  function renderNodeLibrary() {
    if (!libraryPanel) return;
    const heading = h('div', { class: 'iw-library-heading' }, h('div', {}, h('h2', {}, tr('노드 추가')), h('p', {}, tr('노드를 클릭하거나 캔버스로 끌어 추가합니다.'))), h('button', { type: 'button', 'aria-label': tr('닫기'), onclick: () => { libraryPanel.remove(); libraryPanel = null; } }, '×'));
    const body = h('div', { class: 'iw-library-body' });
    if (state.settings?.localOnly) body.append(h('p', { class: 'iw-local-notice' }, tr('로컬 전용 모드'), ' · ', tr('클라우드 제공자를 숨겼습니다.')));
    const group = (title, entries) => h('section', { class: 'iw-library-group' }, h('h3', {}, tr(title)), ...(entries.length ? entries : [h('p', {}, tr('추가할 항목이 없습니다.'))]));
    body.append(group('사용자 노드', [libraryEntry('commander', 'commander', identity().name, identity().title)]));
    body.append(group('모델 제공자', availableProviders().map(id => libraryEntry('provider', id, providerLabel(id), statusFor({ type: 'provider', referenceId: id }).text))));
    body.append(group('에이전트/역할', visibleDepartments().map(dept => libraryEntry('department', dept.id, deptName(dept), dept.title || providerLabel(dept.provider)))));
    body.append(group('기억', memories.filter(memory => !memory.archived).map(memory => libraryEntry('memory', memory.id, memory.title, (memory.content || '').slice(0, 100)))));
    body.append(h('button', { type: 'button', class: 'iw-library-memory-create', onclick: openMemoryDialog }, '+ ', tr('새 기억 만들기')));
    body.append(createAgentForm());
    body.append(h('div', { class: 'iw-library-template' }, h('button', { type: 'button', 'data-iw-action': 'template', onclick: loadTemplate }, tr('회사 조직도 템플릿 불러오기')), h('p', {}, tr('템플릿은 현재 캔버스에 없는 조직 노드만 추가합니다.'))));
    libraryPanel.replaceChildren(heading, body);
  }
  function createAgentForm() {
    agentExecutionControls?.destroy(); agentExecutionControls = null;
    const name = h('input', { required: '', maxlength: '24', 'aria-label': tr('에이전트 이름') });
    const title = h('input', { maxlength: '80', 'aria-label': tr('직함') });
    const role = h('textarea', { required: '', rows: '3', maxlength: '1500', placeholder: tr('역할을 입력하세요.'), 'aria-label': tr('역할과 지침') });
    const provider = h('select', { required: '', 'aria-label': tr('제공자') }, ...availableProviders().map(id => h('option', { value: id }, providerLabel(id))));
    const connection = h('select', { 'aria-label': tr('등록된 연결') });
    const updateConnections = () => connection.replaceChildren(h('option', { value: '' }, tr('기본 연결')), ...(state.connections || []).filter(item => item.providerId === provider.value).map(item => h('option', { value: item.id }, item.label)));
    updateConnections(); provider.addEventListener('change', updateConnections);
    const submit = h('button', { class: 'iw-accent-button', type: 'submit', disabled: !availableProviders().length }, tr('등록하고 노드 추가'));
    if (window.ImperiumExecution) {
      agentExecutionControls = window.ImperiumExecution.create({ api: (route, value = {}) => request(route, value.method || 'GET', value.body), provider: provider.value || 'codex' });
      provider.addEventListener('change', () => agentExecutionControls?.setContext({ provider: provider.value, modelId: '', reasoningEffort: 'default', speed: 'default' }));
      connection.addEventListener('change', () => { const item = state.connections?.find(value => value.id === connection.value); agentExecutionControls?.setContext({ provider: provider.value, modelId: item?.modelId || '', reasoningEffort: 'default', speed: 'default' }); });
    }
    const form = h('form', { class: 'iw-agent-create-form' }, h('h3', {}, tr('새 에이전트 등록')), field(tr('에이전트 이름'), name), field(tr('직함'), title), field(tr('역할과 지침'), role), field(tr('제공자'), provider), field(tr('등록된 연결'), connection), submit);
    if (agentExecutionControls) form.insertBefore(agentExecutionControls.element, submit);
    if (!availableProviders().length) form.append(h('p', {}, tr('이 제공자는 AI 연결 화면에서 먼저 설치하거나 등록하세요.')));
    const key = project;
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        const result = await request('/api/departments', 'POST', { workspace: key, name: name.value.trim(), title: title.value.trim(), role: role.value.trim(), provider: provider.value, ...(connection.value ? { connectionId: connection.value } : {}), ...(agentExecutionControls?.getValue() || {}) });
        if (key !== project) return;
        const dept = result.department;
        if (!dept?.id) throw new Error(tr('요청을 처리하지 못했습니다.'));
        if (!(state.departments || []).some(item => item.id === dept.id)) state.departments = [...(state.departments || []), dept];
        addLibraryNode('department', dept.id); renderNodeLibrary(); announce(tr('에이전트를 등록했습니다.'));
        window.dispatchEvent(new CustomEvent('imperium:departments-changed'));
      } catch (error) { announce(error.message, true); }
      finally { submit.disabled = false; }
    });
    return form;
  }
  function field(labelText, input) { return h('label', { class: 'iw-field' }, h('span', {}, labelText), input); }
  function workflowTargets(item) {
    const included = new Set([item.id]), pending = [item.id];
    while (pending.length) { const source = pending.shift(); for (const edge of graph.edges) if (edge.type === 'handoff' && edge.source === source && !included.has(edge.target)) { included.add(edge.target); pending.push(edge.target); } }
    return [...included].map(id => graph.nodes.find(node => node.id === id)).filter(node => node?.type === 'department').map(node => ({ node, department: deptFor(node) })).filter(value => value.department);
  }
  const workflowProvider = department => state.connections?.find(connection => connection.id === department.connectionId)?.providerId || department.provider;
  function workflowBlocked(targets) { return !targets.length || !online() || targets.some(({ node, department }) => isDisabled(node) || department.connectionId && !state.connections?.some(connection => connection.id === department.connectionId) || !state.providers?.some(provider => provider.id === workflowProvider(department) && provider.status === 'ready' && provider.authenticated !== false)); }
  function renderInspector(force = false) {
    if (!inspector) return;
    if (!force && inspector.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const item = selected?.kind === 'node' ? graph.nodes.find(value => value.id === selected.id) : null;
    const edge = selected?.kind === 'edge' ? graph.edges.find(value => value.id === selected.id) : null;
    const signature = JSON.stringify([selected, options.language, item && statusFor(item), item?.type === 'commander' && identity(), item?.type === 'department' && [deptFor(item), progressTask(item.referenceId), graph.edges, state.providers, state.settings?.accessPolicy], item?.type === 'memory' && memoryFor(item), edge]);
    if (!force && signature === inspectorSignature) return;
    inspectorSignature = signature;
    inspector.replaceChildren(h('div', { class: 'iw-inspector-heading' }, tr('노드 검사기')));
    if (edge) {
      const source = graph.nodes.find(value => value.id === edge.source), target = graph.nodes.find(value => value.id === edge.target);
      const name = value => value?.type === 'department' ? deptName(deptFor(value)) : value?.type === 'memory' ? memoryFor(value)?.title || tr('기억') : value?.id || '—';
      inspector.append(h('div', { class: 'iw-inspector-content' }, h('span', { class: 'iw-inspector-kind' }, edge.type.toUpperCase()), h('h3', {}, tr(edge.type === 'memory_context' ? '기억 연결' : '업무 전달')), h('p', { class: 'iw-edge-description' }, name(source), ' → ', name(target)), h('p', {}, tr(edge.type === 'memory_context' ? '연결하면 기억이 대상 부서의 작업 문맥에 포함됩니다.' : '워크플로를 실행하면 이 연결을 따라 다음 부서로 업무가 전달됩니다.')), h('p', { class: 'iw-inspector-note' }, tr('연결만으로 작업이 실행되지는 않습니다.')), h('button', { type: 'button', class: 'iw-danger-button', onclick: () => removeEdge(edge.id) }, tr('연결 삭제')))); return;
    }
    if (!item) { inspector.append(h('div', { class: 'iw-inspector-empty' }, h('span', { 'aria-hidden': 'true' }, '⌘'), h('strong', {}, tr('노드를 선택하세요')), h('p', {}, tr('노드의 연결, 역할과 기억을 편집할 수 있습니다.')), h('small', {}, tr('프로젝트별로 노드 위치와 연결을 저장합니다.')))); return; }
    const body = h('div', { class: 'iw-inspector-content' }); inspector.append(body);
    if (item.type === 'department') {
      const dept = deptFor(item); if (!dept) return;
      body.append(h('span', { class: 'iw-inspector-kind' }, `AGENT / ${dept.code || dept.id}`), h('h3', {}, deptName(dept)), ...(dept.title ? [h('span', { class: 'iw-role-badge' }, dept.title)] : []), h('span', { class: 'iw-inspector-status', 'data-status': statusFor(item).key }, statusFor(item).text), h('p', {}, common(dept.role)), h('p', { class: 'iw-inspector-note' }, tr('제공자 변경은 에이전트 편집에서 설정합니다.')), h('div', { class: 'iw-inspector-buttons' }, h('button', { class: 'iw-accent-button', type: 'button', disabled: isDisabled(item), onclick: () => options.onAssignDepartment?.(dept.id) }, tr('업무 지시'), ' ↗'), h('button', { type: 'button', onclick: () => options.onEditDepartment?.(dept) }, tr('부서 편집'))));
      const task = progressTask(item.referenceId); if (task) body.append(renderTaskProgress(task, false));
      const busy = Boolean(currentTask(dept.id));
      body.append(h('button', { type: 'button', class: 'iw-danger-button', 'data-iw-action': 'remove-agent', disabled: busy, onclick: () => confirmAgentRemoval(dept) }, tr('에이전트 제거')));
      if (busy) body.append(h('p', { class: 'iw-inspector-note', 'data-iw-removal-blocked': dept.id }, tr('실행·대기 중인 작업이 끝난 뒤 에이전트를 제거할 수 있습니다.')));
      const formWorkspace = project;
      const targets = workflowTargets(item), blocked = workflowBlocked(targets), draftKey = `${project}\n${dept.id}`, canWrite = state.settings?.accessPolicy !== 'read-only' && targets.every(value => ['codex', 'claude'].includes(workflowProvider(value.department)));
      const form = h('form', { class: 'iw-workflow-form' }), prompt = h('textarea', { rows: '4', maxlength: '12000', placeholder: tr('연결된 부서에 순서대로 전달할 목표를 작성하세요.'), required: '', 'aria-label': tr('워크플로 지시') }), permission = h('input', { type: 'checkbox', disabled: !canWrite }), submit = h('button', { type: 'submit', class: 'iw-workflow-run', disabled: blocked }, tr('연결 에이전트 실행'));
      prompt.value = workflowDrafts.get(draftKey) || ''; prompt.addEventListener('input', () => workflowDrafts.set(draftKey, prompt.value));
      form.append(h('p', { class: 'iw-inspector-note' }, tr('시작 에이전트'), ': ', deptName(dept)), h('strong', {}, tr('실행 대상'), ` · ${targets.length}`), h('ul', { class: 'iw-workflow-targets' }, ...targets.map(({ node, department }) => h('li', { 'data-workflow-agent': department.id }, `${deptName(department)} · ${providerLabel(workflowProvider(department))} · ${statusFor(node).text}`, ...(department.role ? [h('small', {}, ' — ', common(department.role))] : [])))), field(tr('워크플로 지시'), prompt), h('label', { class: 'iw-checkbox' }, permission, tr('파일 수정 허용')), h('p', { class: 'iw-inspector-note' }, tr('파일 수정은 접근 설정과 모든 대상 모델이 허용할 때만 선택할 수 있습니다.')), h('p', { class: 'iw-inspector-note' }, tr('연결만으로 작업이 실행되지는 않습니다.')), ...(blocked ? [h('p', { class: 'iw-error', 'data-workflow-blocked': '' }, tr('실행 불가'), ': ', targets.filter(value => workflowBlocked([value])).map(value => deptName(value.department)).join(', ') || tr('오프라인'))] : []), submit);
      form.addEventListener('submit', async event => {
        event.preventDefault(); const command = prompt.value.trim(); if (!command || workflowBlocked(workflowTargets(item))) return; workflowDrafts.set(draftKey, prompt.value); submit.disabled = true;
        try {
          for (let attempt = 0; attempt < 3; attempt++) { if (!await persist()) throw new Error(errorMessage || tr('저장 실패')); if (!dirty && !saving) break; }
          if (formWorkspace !== project) return;
          if (dirty || saving) throw new Error(tr('그래프 저장이 끝난 뒤 다시 실행하세요.'));
          const current = workflowTargets(item); if (workflowBlocked(current)) throw new Error(tr('실행 불가'));
          const editAllowed = state.settings?.accessPolicy !== 'read-only' && current.every(value => ['codex', 'claude'].includes(workflowProvider(value.department)));
          await request('/api/workflows/run', 'POST', { departmentId: dept.id, prompt: command, permission: permission.checked && editAllowed ? 'workspace-write' : 'read-only', priority: 'normal' }, formWorkspace);
          if (formWorkspace !== project) return;
          if (prompt.value.trim() === command) { prompt.value = ''; workflowDrafts.delete(draftKey); } announce(tr('워크플로를 시작했습니다.'));
        } catch (error) { if (formWorkspace === project) announce(error.message, true); }
        finally { if (formWorkspace === project) submit.disabled = workflowBlocked(workflowTargets(item)); }
      });
      body.append(form);
    } else if (item.type === 'provider') body.append(h('span', { class: 'iw-inspector-kind' }, 'PROVIDER / OFFICIAL CLI'), h('h3', {}, providerLabel(item.referenceId)), h('span', { class: 'iw-inspector-status', 'data-status': statusFor(item).key }, statusFor(item).text), h('p', {}, tr('모델은 각 운영체제 사용자 계정의 공식 CLI 로그인을 사용합니다.')), h('button', { type: 'button', class: 'iw-accent-button', onclick: () => options.onOpenSettings?.() }, tr('연결 관리')), h('p', { class: 'iw-inspector-note' }, tr('모델 연결 등록을 제거하려면 AI 계정 화면을 여세요.')));
    else if (item.type === 'commander') {
      const current = identity(), name = h('input', { value: current.name, maxlength: '60', required: '', 'aria-label': tr('이름') }), title = h('input', { value: current.title, maxlength: '80', required: '', 'aria-label': tr('직함') }), submit = h('button', { type: 'submit', class: 'iw-accent-button' }, tr('이름표 저장'));
      const form = h('form', { class: 'iw-identity-form' }, field(tr('이름'), name), field(tr('직함'), title), submit);
      form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { const result = await request('/api/settings', 'POST', { identity: { name: name.value.trim(), title: title.value.trim() } }); state.settings = result.settings || { ...state.settings, identity: { name: name.value.trim(), title: title.value.trim() } }; inspectorSignature = ''; renderScene(); renderInspector(true); announce(tr('이름표를 저장했습니다.')); } catch (error) { announce(error.message, true); } finally { submit.disabled = false; } });
      body.append(h('span', { class: 'iw-inspector-kind' }, 'WORKSPACE / IDENTITY'), h('h3', {}, current.name), h('span', { class: 'iw-role-badge' }, current.title), form);
    }
    else renderMemoryInspector(body, item);
    body.append(h('button', { type: 'button', class: 'iw-danger-button', 'data-iw-action': 'remove-node', onclick: () => removeNode(item.id) }, tr('캔버스에서 제거')), h('p', { class: 'iw-inspector-note' }, tr('노드만 제거하며 실제 에이전트·연결·기억은 삭제하지 않습니다.')));
  }
  function renderMemoryInspector(body, item) {
    const memory = memoryFor(item);
    if (!memory) { body.append(h('h3', {}, tr('기억')), h('p', {}, '—')); return; }
    const title = h('input', { value: memory.title || '', maxlength: '160', required: '' }), content = h('textarea', { rows: '9', maxlength: '24000', required: '' }); content.value = memory.content || '';
    const pinned = h('input', { type: 'checkbox' }); pinned.checked = Boolean(memory.pinned);
    const submit = h('button', { type: 'submit', class: 'iw-accent-button' }, tr('기억 저장'));
    const form = h('form', { class: 'iw-memory-form' }, field(tr('제목'), title), field(tr('기억 내용'), content), h('label', { class: 'iw-checkbox' }, pinned, tr('고정 기억')), h('small', { class: 'iw-inspector-note' }, `${tr('수정 이력')} ${memory.revision || 1}`), submit);
    const memoryWorkspace = project;
    form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { const result = await request(`/api/memory/${encodeURIComponent(memory.id)}`, 'PATCH', { title: title.value.trim(), content: content.value.trim(), pinned: pinned.checked, expectedRevision: memory.revision }, memoryWorkspace); if (memoryWorkspace !== project) return; const updated = result.node || result.memory || { ...memory, title: title.value.trim(), content: content.value.trim(), pinned: pinned.checked, revision: (memory.revision || 1) + 1 }; memories = memories.map(value => value.id === memory.id ? updated : value); inspectorSignature = ''; renderScene(); announce(tr('기억을 저장했습니다.')); window.dispatchEvent(new CustomEvent('imperium:memory-changed')); } catch (error) { announce(error.message, true); } finally { submit.disabled = false; } });
    body.append(h('span', { class: 'iw-inspector-kind' }, 'MEMORY / CONTEXT'), h('h3', {}, memory.title), form);
  }
  function addMemory(memory) {
    const existing = findNode('memory', memory.id); if (existing) { selectNode(existing.id); announce(tr('이 기억은 이미 캔버스에 있습니다.')); memoryDialog?.close(); return; }
    const position = toWorld((stage.getBoundingClientRect().left || 0) + 80, (stage.getBoundingClientRect().top || 0) + 130);
    const item = { id: `memory:${memory.id}`, type: 'memory', referenceId: memory.id, x: position.x, y: position.y };
    graph.nodes.push(item); selected = { kind: 'node', id: item.id }; inspectorSignature = ''; memoryDialog?.close(); renderScene(); scheduleSave();
  }
  async function openMemoryDialog() {
    const key = project;
    try { const result = await request('/api/memory'); if (key !== project) return; memories = result.nodes || result.memory?.nodes || []; memoryLoaded = true; } catch (error) { announce(error.message, true); return; }
    memoryDialog?.remove();
    memoryDialog = h('dialog', { class: 'iw-memory-dialog' });
    const close = h('button', { type: 'button', 'aria-label': tr('닫기'), onclick: () => memoryDialog.close() }, '×');
    const list = h('div', { class: 'iw-memory-list' });
    if (!memories.length) list.append(h('p', {}, tr('아직 저장한 기억이 없습니다.')));
    for (const memory of memories) list.append(h('button', { type: 'button', onclick: () => addMemory(memory) }, h('strong', {}, memory.title), h('span', {}, (memory.content || '').slice(0, 95)), h('small', {}, `${memory.pinned ? 'PINNED · ' : ''}r${memory.revision || 1} +`)));
    const title = h('input', { maxlength: '160', required: '', placeholder: tr('제목'), 'aria-label': tr('제목') }), content = h('textarea', { rows: '4', maxlength: '24000', required: '', placeholder: tr('기억 내용'), 'aria-label': tr('기억 내용') }), create = h('button', { type: 'submit', class: 'iw-accent-button' }, tr('새 기억 만들기'));
    const form = h('form', { class: 'iw-new-memory' }, title, content, create);
    form.addEventListener('submit', async event => { event.preventDefault(); create.disabled = true; try { const result = await request('/api/memory', 'POST', { title: title.value.trim(), content: content.value.trim(), kind: 'note', tags: [], pinned: false }, key); if (key !== project) return; const memory = result.node || result.memory; if (!memory?.id) throw new Error(tr('요청을 처리하지 못했습니다.')); memories.push(memory); addMemory(memory); window.dispatchEvent(new CustomEvent('imperium:memory-changed')); } catch (error) { announce(error.message, true); } finally { create.disabled = false; } });
    memoryDialog.append(h('div', { class: 'iw-memory-dialog-heading' }, h('div', {}, h('h2', {}, tr('기억 선택')), h('p', {}, tr('기억을 선택하거나 새로 작성하세요.'))), close), list, form); document.body.append(memoryDialog); memoryDialog.showModal();
  }
  function render(incoming, callbacks = {}) {
    state = incoming || {}; options = { ...options, ...callbacks };
    if (!host && !mount()) return;
    const key = state.settings?.workspace;
    if (!key) { renderScene(); announce(tr('불러오는 중…')); return; }
    if (project !== key) { project = key; removalDialog?.close(); removalDialog?.remove(); memoryDialog?.close(); libraryPanel?.remove(); libraryPanel = null; graph = { nodes: [], edges: [] }; loaded = false; loading = false; dirty = false; selected = null; inspectorSignature = ''; requestGeneration++; clearTimeout(saveTimer); memories = []; memoryLoaded = false; ensureOrganization(); renderScene(); load(); return; }
    ensureOrganization();
    if (state.graph && loaded && !dirty && !saving && !drag) { const hash = JSON.stringify(sanitize(state.graph)); if (hash !== loadedGraphHash) { graph = sanitize(state.graph); loadedGraphHash = hash; ensureOrganization(); } }
    renderScene();
  }
  window.ImperiumWorkspace = { render, reload: async () => { if (!host || !project) return; loading = false; await load(); }, fit, getGraph: () => JSON.parse(JSON.stringify(graph)) };
  window.addEventListener('imperium:memory-changed', () => { const key = project; request('/api/memory').then(result => { if (key !== project) return; memories = result.nodes || result.memory?.nodes || []; memoryLoaded = true; ensureOrganization(); inspectorSignature = ''; renderScene(); }).catch(error => announce(error.message, true)); });
})();
