(function () {
  'use strict';
  const TEXT = {
    en: {
      'AI 연결 관리': 'AI connections', '이 컴퓨터의 공식 CLI 계정으로 연결합니다.': 'Connect through the official CLI accounts on this computer.', '설정 마법사': 'Setup guide', '연결 새로고침': 'Refresh connections', '사용 가능한 제공자': 'Available providers', '등록한 연결': 'Registered connections', '새 연결 등록': 'Register a connection', '제공자': 'Provider', '표시 이름': 'Connection label', '예: 개인 개발 계정': 'Example: Personal development', '모델 선택': 'Choose a model', '모델 목록 확인': 'Load model list', 'CLI 기본 모델': 'CLI default model', '모델 ID 직접 입력': 'Enter a model ID', '자동으로 확인되지 않는 모델은 ID를 직접 입력할 수 있습니다.': 'Enter a model ID when automatic discovery is unavailable.', '모델 ID': 'Model ID', '연결 등록': 'Register connection', '삭제': 'Remove', '아직 등록한 연결이 없습니다.': 'No registered connections yet.',
      '연결됨': 'Connected', '로그인 필요': 'Sign-in needed', '설치 필요': 'Install needed', '확인 필요': 'Attention', '연결 상태 확인 중': 'Checking connection', '설치': 'Install', '로그인': 'Sign in', '복사': 'Copy', '터미널에 준비': 'Prepare in terminal', '복사했습니다.': 'Copied.', '복사할 수 없습니다. 명령을 직접 선택해주세요.': 'Clipboard unavailable. Select the command text directly.',
      '명령은 터미널에 입력만 되며 자동 실행되지 않습니다.': 'Commands are placed in the terminal and are not executed automatically.', '각 사용자는 자신의 컴퓨터와 OS 사용자 계정에서 로그인합니다.': 'Each person signs in on their own computer and OS user account.', '같은 OS 사용자의 연결은 해당 제공자의 CLI 로그인을 공유합니다.': 'Connections under the same OS user share that provider’s CLI login.', '연결 등록은 구독 로그인이나 모델 접근 권한을 대신하지 않습니다.': 'Registering a connection does not grant model access or sign you in.', '연결 목록에서만 제거되며 CLI에서 로그아웃하지 않습니다.': 'Removes the saved connection without signing out of the CLI.',
      '계정에서 확인': 'Account discovery', 'CLI 별칭': 'CLI alias', '로컬 모델': 'Local model', '직접 입력': 'Manual entry', '모델 목록을 자동으로 확인할 수 없습니다.': 'Automatic model discovery is unavailable.', '제공자를 먼저 선택하세요.': 'Choose a provider first.', '모델 ID를 입력하세요.': 'Enter a model ID.', '연결을 등록했습니다.': 'Connection registered.', '연결을 제거했습니다.': 'Connection removed.', '연결 상태를 갱신했습니다.': 'Connection status refreshed.', '요청을 처리하지 못했습니다.': 'The request could not be completed.', '불러오는 중…': 'Loading…',
      'IMPERIUM 시작하기': 'Get started with IMPERIUM', '환경 준비': 'Prerequisites', '계정 로그인': 'Account sign-in', '연결 확인': 'Verify connection', '첫 작업': 'First operation', '다음': 'Next', '이전': 'Back', '나중에': 'Later', '완료': 'Finish', '닫기': 'Close', '공식 CLI 설치 명령을 확인하세요.': 'Review the official CLI installation command.', '이 제공자는 CLI 설치 전에 Node.js가 필요합니다.': 'This provider requires Node.js before installing its CLI.', 'Node.js 설치 안내': 'Get Node.js', '로그인 토큰과 API 키를 IMPERIUM에 입력하지 않습니다.': 'Do not enter login tokens or API keys into IMPERIUM.', '공식 CLI의 로그인 화면에서 구독 계정으로 로그인하세요.': 'Sign in with your subscription account through the official CLI.', '로그인을 마쳤다면 연결 상태를 다시 확인하세요.': 'After signing in, refresh the connection status.', '현재 연결': 'Current connection', '현재 이 제공자를 사용할 수 있습니다.': 'This provider is ready to use.', '아직 연결되지 않았습니다. 설치와 로그인을 확인하세요.': 'Not connected yet. Check installation and sign-in.', '샘플로 조직과 작업 흐름을 살펴보세요.': 'Explore the organization and task flow with sample operations.', '샘플은 모델을 호출하지 않으며 DEMO로 표시됩니다.': 'Samples do not call a model and are marked DEMO.', '샘플 작업 체험': 'Try sample operations', '설정 마치기': 'Finish setup', '설정을 저장했습니다.': 'Setup saved.', '이 연결에서 사용할 모델을 선택하세요.': 'Choose the model for this connection.',
    },
    ja: {
      'AI 연결 관리': 'AI接続管理', '이 컴퓨터의 공식 CLI 계정으로 연결합니다.': 'このコンピューターの公式CLIアカウントで接続します。', '설정 마법사': '設定ガイド', '연결 새로고침': '接続を更新', '사용 가능한 제공자': '利用可能なプロバイダー', '등록한 연결': '登録済みの接続', '새 연결 등록': '接続を登録', '제공자': 'プロバイダー', '표시 이름': '表示名', '예: 개인 개발 계정': '例：個人開発用', '모델 선택': 'モデルを選択', '모델 목록 확인': 'モデル一覧を取得', 'CLI 기본 모델': 'CLIの既定モデル', '모델 ID 직접 입력': 'モデルIDを直接入力', '자동으로 확인되지 않는 모델은 ID를 직접 입력할 수 있습니다.': '自動取得できないモデルはIDを直接入力できます。', '모델 ID': 'モデルID', '연결 등록': '接続を登録', '삭제': '削除', '아직 등록한 연결이 없습니다.': '登録済みの接続はまだありません。',
      '연결됨': '接続済み', '로그인 필요': '要ログイン', '설치 필요': '要インストール', '확인 필요': '要確認', '연결 상태 확인 중': '接続を確認中', '설치': 'インストール', '로그인': 'ログイン', '복사': 'コピー', '터미널에 준비': 'ターミナルに準備', '복사했습니다.': 'コピーしました。', '복사할 수 없습니다. 명령을 직접 선택해주세요.': 'コピーできません。コマンドを直接選択してください。',
      '명령은 터미널에 입력만 되며 자동 실행되지 않습니다.': 'コマンドはターミナルに入力するだけで、自動実行しません。', '각 사용자는 자신의 컴퓨터와 OS 사용자 계정에서 로그인합니다.': '各ユーザーは自分のコンピューターとOSアカウントでログインします。', '같은 OS 사용자의 연결은 해당 제공자의 CLI 로그인을 공유합니다.': '同じOSユーザーの接続は、そのプロバイダーのCLIログインを共有します。', '연결 등록은 구독 로그인이나 모델 접근 권한을 대신하지 않습니다.': '接続の登録はログインやモデル利用権限を付与するものではありません。', '연결 목록에서만 제거되며 CLI에서 로그아웃하지 않습니다.': '接続一覧からのみ削除し、CLIからログアウトしません。',
      '계정에서 확인': 'アカウントから取得', 'CLI 별칭': 'CLIエイリアス', '로컬 모델': 'ローカルモデル', '직접 입력': '直接入力', '모델 목록을 자동으로 확인할 수 없습니다.': 'モデル一覧を自動取得できません。', '제공자를 먼저 선택하세요.': 'プロバイダーを選択してください。', '모델 ID를 입력하세요.': 'モデルIDを入力してください。', '연결을 등록했습니다.': '接続を登録しました。', '연결을 제거했습니다.': '接続を削除しました。', '연결 상태를 갱신했습니다.': '接続状態を更新しました。', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '불러오는 중…': '読み込み中…',
      'IMPERIUM 시작하기': 'IMPERIUMを始める', '환경 준비': '環境の準備', '계정 로그인': 'アカウントのログイン', '연결 확인': '接続の確認', '첫 작업': '最初のタスク', '다음': '次へ', '이전': '戻る', '나중에': '後で', '완료': '完了', '닫기': '閉じる', '공식 CLI 설치 명령을 확인하세요.': '公式CLIのインストールコマンドを確認してください。', '이 제공자는 CLI 설치 전에 Node.js가 필요합니다.': 'このプロバイダーのCLIには、Node.jsの事前インストールが必要です。', 'Node.js 설치 안내': 'Node.jsの入手', '로그인 토큰과 API 키를 IMPERIUM에 입력하지 않습니다.': 'ログイントークンやAPIキーをIMPERIUMに入力しないでください。', '공식 CLI의 로그인 화면에서 구독 계정으로 로그인하세요.': '公式CLIのログイン画面で契約中のアカウントにログインしてください。', '로그인을 마쳤다면 연결 상태를 다시 확인하세요.': 'ログイン後、接続状態を更新してください。', '현재 연결': '現在の接続', '현재 이 제공자를 사용할 수 있습니다.': 'このプロバイダーを利用できます。', '아직 연결되지 않았습니다. 설치와 로그인을 확인하세요.': 'まだ接続されていません。インストールとログインを確認してください。', '샘플로 조직과 작업 흐름을 살펴보세요.': 'サンプルで組織とタスクの流れを確認できます。', '샘플은 모델을 호출하지 않으며 DEMO로 표시됩니다.': 'サンプルはモデルを呼び出さず、DEMOと表示されます。', '샘플 작업 체험': 'サンプルを試す', '설정 마치기': '設定を完了', '설정을 저장했습니다.': '設定を保存しました。', '이 연결에서 사용할 모델을 선택하세요.': 'この接続で使うモデルを選択してください。',
    },
  };
  const h = (tag, attrs = {}, ...children) => { const element = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') element.className = value; else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== undefined && value !== null && value !== false) element.setAttribute(key, String(value)); } children.flat().forEach(child => { if (child !== undefined && child !== null) element.append(child instanceof Node ? child : document.createTextNode(String(child))); }); return element; };
  let container, callbacks = {}, state = {}, catalog = [], connections = [], loaded = false, loading = false, renderedLanguage = '', renderedSignature = '', modelRequest = 0, wizardShown = false, wizardStep = 0, wizardProvider = '', wizard;
  let providersList, connectionList, registerForm, providerSelect, modelSelect, manualInput, labelInput, modelDetail, message, registerButton, removalDialog, removalEpoch = 0, removalWorkspace;
  Object.assign(TEXT.en, { '모델 연결 제거': 'Remove model connection', '제거 확인': 'Confirm removal', '취소': 'Cancel', '먼저 에이전트의 연결을 해제하세요.': 'Unassign this connection from these agents first.', '연결 등록만 제거합니다. 대화·작업·기억은 보존되며 CLI 로그인·설치는 유지됩니다.': 'Removes only the saved connection. Conversations, tasks and memories are retained. CLI sign-in and installation stay in place.' });
  Object.assign(TEXT.ja, { '모델 연결 제거': 'モデル接続を削除', '제거 확인': '削除を確認', '취소': 'キャンセル', '먼저 에이전트의 연결을 해제하세요.': '先に次のエージェントから接続を解除してください。', '연결 등록만 제거합니다. 대화·작업·기억은 보존되며 CLI 로그인·설치는 유지됩니다.': '接続の登録のみを削除します。会話・タスク・記憶、CLIへのログインとインストールは保持します。' });
  const language = () => document.documentElement.lang || state.settings?.language || 'ko';
  const tr = key => TEXT[language()]?.[key] ?? key;
  const sourceLabel = source => tr({ account: '계정에서 확인', alias: 'CLI 별칭', local: '로컬 모델', manual: '직접 입력' }[source] || '직접 입력');
  const providerState = id => state.providers?.find(provider => provider.id === id);
  const statusText = provider => provider?.status === 'disabled' ? ({ ko: '로컬 모드에서 비활성', en: 'Disabled in local mode', ja: 'ローカルモードで無効' }[language()] || 'Disabled') : tr({ ready: '연결됨', login_required: '로그인 필요', missing: '설치 필요', error: '확인 필요' }[provider?.status] || '연결 상태 확인 중');
  function announce(text, failed = false) { if (message) { message.textContent = text; message.classList.toggle('ia-error', failed); } }
  async function request(path, method = 'GET', body) {
    if (callbacks.api) return callbacks.api(path, method === 'GET' ? {} : { method, body });
    const response = await fetch(path, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || tr('요청을 처리하지 못했습니다.')); return result;
  }
  async function copy(command) { try { await navigator.clipboard.writeText(command); announce(tr('복사했습니다.')); } catch { announce(tr('복사할 수 없습니다. 명령을 직접 선택해주세요.'), true); } }
  function prepare(command) { if (!command) return; wizard?.close(); window.dispatchEvent(new CustomEvent('imperium:terminal-command', { detail: { command } })); announce(tr('명령은 터미널에 입력만 되며 자동 실행되지 않습니다.')); }
  function commandBox(command, kind) { return h('div', { class: 'ia-command' }, h('span', { class: 'ia-command-kind' }, tr(kind)), h('code', {}, command), h('div', {}, h('button', { type: 'button', onclick: () => copy(command) }, tr('복사')), h('button', { type: 'button', onclick: () => prepare(command) }, tr('터미널에 준비')))); }
  async function reload() {
    if (loading) return; loading = true;
    try {
      const result = await request('/api/providers/catalog'); catalog = result.catalog || []; connections = result.connections || []; loaded = true;
      if (!wizardProvider) wizardProvider = catalog[0]?.id || '';
      build(); renderProviders(); renderConnections();
      if (state.server?.csrfToken && !state.settings?.onboarded && !wizardShown && catalog.length) { wizardShown = true; openWizard(); }
    } catch (error) { announce(error.message, true); }
    finally { loading = false; }
  }
  function build() {
    if (!container) return;
    renderedLanguage = language();
    const previous = { provider: providerSelect?.value, label: labelInput?.value, manual: manualInput?.value };
    message = h('p', { class: 'ia-message', role: 'status', 'aria-live': 'polite' });
    const refresh = h('button', { type: 'button', onclick: refreshConnections }, '↻ ', tr('연결 새로고침'));
    const heading = h('div', { class: 'ia-heading' }, h('div', {}, h('span', { class: 'ia-eyebrow' }, 'PERSONAL / OFFICIAL CLI'), h('h2', {}, tr('AI 연결 관리')), h('p', {}, tr('이 컴퓨터의 공식 CLI 계정으로 연결합니다.'))), h('div', { class: 'ia-heading-actions' }, h('button', { type: 'button', onclick: openWizard }, tr('설정 마법사')), refresh));
    providersList = h('div', { class: 'ia-providers' }); connectionList = h('div', { class: 'ia-connections' });
    providerSelect = h('select', { 'aria-label': tr('제공자'), required: '' }, ...catalog.map(provider => h('option', { value: provider.id }, provider.name)));
    if (catalog.some(provider => provider.id === previous.provider)) providerSelect.value = previous.provider;
    labelInput = h('input', { maxlength: '80', required: '', placeholder: tr('예: 개인 개발 계정'), value: previous.label || '', 'aria-label': tr('표시 이름') });
    modelSelect = h('select', { 'aria-label': tr('모델 선택') }, h('option', { value: '' }, tr('CLI 기본 모델')), h('option', { value: '__manual__' }, tr('모델 ID 직접 입력')));
    manualInput = h('input', { maxlength: '150', placeholder: tr('모델 ID'), value: previous.manual || '', 'aria-label': tr('모델 ID'), hidden: '' });
    modelDetail = h('p', { class: 'ia-field-help' }, tr('자동으로 확인되지 않는 모델은 ID를 직접 입력할 수 있습니다.'));
    registerButton = h('button', { type: 'submit', class: 'ia-primary' }, '+ ', tr('연결 등록'));
    registerForm = h('form', { class: 'ia-register-form' }, h('h3', {}, tr('새 연결 등록')), field('제공자', providerSelect), field('표시 이름', labelInput), h('div', { class: 'ia-model-heading' }, h('label', {}, tr('모델 선택')), h('button', { type: 'button', onclick: loadModels }, tr('모델 목록 확인'))), modelSelect, manualInput, modelDetail, h('p', { class: 'ia-field-help' }, tr('연결 등록은 구독 로그인이나 모델 접근 권한을 대신하지 않습니다.')), registerButton);
    modelSelect.addEventListener('change', () => { manualInput.hidden = modelSelect.value !== '__manual__'; manualInput.required = !manualInput.hidden; if (!manualInput.hidden) manualInput.focus(); });
    providerSelect.addEventListener('change', () => { modelRequest++; modelSelect.replaceChildren(h('option', { value: '' }, tr('CLI 기본 모델')), h('option', { value: '__manual__' }, tr('모델 ID 직접 입력'))); manualInput.hidden = true; manualInput.required = false; modelDetail.textContent = tr('이 연결에서 사용할 모델을 선택하세요.'); });
    registerForm.addEventListener('submit', registerConnection);
    container.classList.add('ia-accounts');
    container.replaceChildren(heading, h('div', { class: 'ia-layout' }, h('section', { class: 'ia-provider-section' }, h('h3', { class: 'ia-section-title' }, tr('사용 가능한 제공자')), providersList), h('aside', { class: 'ia-account-sidebar' }, registerForm, h('section', { class: 'ia-registered-section' }, h('h3', {}, tr('등록한 연결')), connectionList))), h('div', { class: 'ia-scope-note' }, h('strong', {}, tr('각 사용자는 자신의 컴퓨터와 OS 사용자 계정에서 로그인합니다.')), h('p', {}, tr('같은 OS 사용자의 연결은 해당 제공자의 CLI 로그인을 공유합니다.')), h('p', {}, tr('명령은 터미널에 입력만 되며 자동 실행되지 않습니다.'))), message);
  }
  function field(key, input) { return h('label', { class: 'ia-field' }, h('span', {}, tr(key)), input); }
  function renderProviders() {
    if (!providersList) return;
    providersList.replaceChildren(...catalog.map(provider => {
      const actual = providerState(provider.id), card = h('article', { class: 'ia-provider-card', 'data-provider-id': provider.id, 'data-status': actual?.status || 'unknown' });
      card.append(h('div', { class: 'ia-provider-heading' }, h('div', { class: 'ia-provider-name' }, h('span', { class: 'ia-provider-mark' }, provider.name.slice(0, 1)), h('h4', {}, provider.name)), h('span', { class: 'ia-provider-status', 'data-status': actual?.status || 'unknown' }, statusText(actual))));
      if (provider.description) card.append(h('p', { class: 'ia-provider-description' }, provider.description));
      if (provider.requiresNode) card.append(h('p', { class: 'ia-runtime-note' }, 'Node.js ', h('span', {}, '· ', tr('환경 준비'))));
      if (provider.installCommand) card.append(commandBox(provider.installCommand, '설치'));
      if (provider.loginCommand) card.append(commandBox(provider.loginCommand, '로그인'));
      if (actual?.version) card.append(h('small', { class: 'ia-provider-version' }, `VERSION ${actual.version}`));
      return card;
    }));
  }
  function renderConnections() {
    if (!connectionList) return;
    if (!connections.length) { connectionList.replaceChildren(h('p', { class: 'ia-empty' }, tr('아직 등록한 연결이 없습니다.'))); return; }
    connectionList.replaceChildren(...connections.map(connection => {
      const provider = catalog.find(item => item.id === connection.providerId), actual = providerState(connection.providerId);
      const assignments = assignedAgents(connection.id);
      return h('article', { class: 'ia-connection', 'data-connection-id': connection.id }, h('div', {}, h('strong', {}, connection.label), h('p', {}, `${provider?.name || connection.providerId} · ${connection.modelId || tr('CLI 기본 모델')}`), h('span', { class: 'ia-provider-status', 'data-status': actual?.status || 'unknown' }, statusText(actual)), ...(assignments.length ? [h('p', { class: 'ia-error', 'data-connection-blocked': connection.id }, tr('먼저 에이전트의 연결을 해제하세요.'), ' ', assignments.map(agent => agent.name || agent.id).join(', '))] : [])), h('button', { type: 'button', disabled: assignments.length > 0, 'data-remove-connection': connection.id, title: tr('연결 목록에서만 제거되며 CLI에서 로그아웃하지 않습니다.'), onclick: () => confirmConnectionRemoval(connection) }, tr('모델 연결 제거')));
    }));
  }
  function assignedAgents(id) { return [...(state.departments || []), ...(state.projects || []).flatMap(value => value.departments || [])].filter(agent => agent.connectionId === id); }
  function confirmConnectionRemoval(connection) {
    if (assignedAgents(connection.id).length) return;
    removalDialog?.close(); removalDialog?.remove();
    const key = state.settings?.workspace, epoch = removalEpoch, dialog = h('dialog', { class: 'ia-removal-dialog', 'data-connection-remove-dialog': connection.id }); removalDialog = dialog;
    const current = () => epoch === removalEpoch && key === state.settings?.workspace && key === (callbacks.getState?.() || state).settings?.workspace;
    const error = h('p', { role: 'alert' }), cancel = h('button', { type: 'button', onclick: () => { dialog.close(); dialog.remove(); } }, tr('취소'));
    const confirm = h('button', { type: 'button', 'data-confirm-connection-remove': connection.id, onclick: async () => {
      if (!current() || assignedAgents(connection.id).length) return; confirm.disabled = true; cancel.disabled = true;
      try {
        await request(`/api/providers/connections/${encodeURIComponent(connection.id)}`, 'DELETE');
        if (!current()) return;
        connections = connections.filter(item => item.id !== connection.id); dialog.close(); dialog.remove(); renderConnections(); announce(tr('연결을 제거했습니다.')); await callbacks.onChanged?.();
      } catch (failure) { if (current()) { error.textContent = failure.message; announce(failure.message, true); confirm.disabled = false; cancel.disabled = false; } }
    } }, tr('제거 확인'));
    dialog.append(h('div', { class: 'dialog-body' }, h('h2', {}, tr('모델 연결 제거')), h('strong', {}, connection.label), h('p', {}, tr('연결 등록만 제거합니다. 대화·작업·기억은 보존되며 CLI 로그인·설치는 유지됩니다.')), error, cancel, confirm)); document.body.append(dialog); dialog.showModal();
  }
  async function loadModels() {
    const providerId = providerSelect.value; if (!providerId) { announce(tr('제공자를 먼저 선택하세요.'), true); return; }
    const generation = ++modelRequest; modelDetail.textContent = tr('불러오는 중…');
    try {
      const result = await request(`/api/providers/${encodeURIComponent(providerId)}/models`);
      if (generation !== modelRequest || providerSelect.value !== providerId) return;
      const models = result.models || [];
      modelSelect.replaceChildren(h('option', { value: '' }, tr('CLI 기본 모델')), ...models.map(model => h('option', { value: model.id, 'data-model-source': model.source || 'manual' }, `${model.name || model.id} · ${sourceLabel(model.source)}`)), h('option', { value: '__manual__' }, tr('모델 ID 직접 입력')));
      modelDetail.textContent = result.detail || (models.length ? tr('이 연결에서 사용할 모델을 선택하세요.') : tr('모델 목록을 자동으로 확인할 수 없습니다.'));
      if (!models.length) { modelSelect.value = '__manual__'; manualInput.hidden = false; manualInput.required = true; }
    } catch (error) { if (generation === modelRequest) { modelDetail.textContent = `${tr('모델 목록을 자동으로 확인할 수 없습니다.')} ${error.message}`; modelSelect.value = '__manual__'; manualInput.hidden = false; manualInput.required = true; } }
  }
  async function registerConnection(event) {
    event.preventDefault(); const providerId = providerSelect.value, modelId = modelSelect.value === '__manual__' ? manualInput.value.trim() : modelSelect.value;
    if (modelSelect.value === '__manual__' && !modelId) { announce(tr('모델 ID를 입력하세요.'), true); manualInput.focus(); return; }
    registerButton.disabled = true;
    try { const result = await request('/api/providers/register', 'POST', { providerId, label: labelInput.value.trim(), modelId }); if (result.connection) connections.push(result.connection); else { const refreshed = await request('/api/providers/catalog'); connections = refreshed.connections || []; } renderConnections(); announce(tr('연결을 등록했습니다.')); labelInput.value = ''; callbacks.onChanged?.(); }
    catch (error) { announce(error.message, true); }
    finally { registerButton.disabled = false; }
  }
  async function refreshConnections() {
    announce(tr('불러오는 중…'));
    try { const result = await request('/api/providers/refresh', 'POST', {}); if (result.providers) state = { ...state, providers: result.providers }; await callbacks.onChanged?.(); if (callbacks.getState) state = callbacks.getState() || state; renderProviders(); renderConnections(); if (wizard?.open && wizardStep === 2) renderWizard(); announce(tr('연결 상태를 갱신했습니다.')); }
    catch (error) { announce(error.message, true); }
  }
  function openWizard() {
    if (!catalog.length) return;
    wizardShown = true;
    if (!wizardProvider) wizardProvider = catalog[0].id;
    if (!wizard) { wizard = h('dialog', { class: 'ia-wizard', 'aria-label': tr('IMPERIUM 시작하기') }); document.body.append(wizard); }
    renderWizard(); if (!wizard.open) wizard.showModal();
  }
  function renderWizard() {
    const provider = catalog.find(item => item.id === wizardProvider) || catalog[0]; if (!provider) return;
    const actual = providerState(provider.id), steps = ['환경 준비', '계정 로그인', '연결 확인', '첫 작업'];
    const body = h('div', { class: 'ia-wizard-body' });
    const selector = h('select', { 'aria-label': tr('제공자') }, ...catalog.map(item => h('option', { value: item.id }, item.name))); selector.value = provider.id;
    selector.addEventListener('change', () => { wizardProvider = selector.value; renderWizard(); });
    if (wizardStep < 3) body.append(field('제공자', selector));
    if (wizardStep === 0) {
      const modeCopy = { ko: '로컬 전용 AI · Ollama 모델만 사용', en: 'Local-only AI · use Ollama models', ja: 'ローカル専用AI · Ollamaモデルを使用' }[language()];
      const mode = h('input', { type: 'checkbox' }); mode.checked = state.settings?.localOnly === true;
      mode.addEventListener('change', async () => { mode.disabled = true; try { const result = await request('/api/settings', 'POST', { localOnly: mode.checked }); if (result.settings) state.settings = result.settings; if (mode.checked) wizardProvider = 'ollama'; await callbacks.onChanged?.(); renderWizard(); } catch (error) { mode.checked = !mode.checked; announce(error.message, true); } finally { mode.disabled = false; } });
      body.append(h('label', { class: 'ia-mode-choice' }, mode, modeCopy));
      body.append(h('h3', {}, tr('공식 CLI 설치 명령을 확인하세요.')));
      if (provider.requiresNode) body.append(h('p', {}, tr('이 제공자는 CLI 설치 전에 Node.js가 필요합니다.')), h('a', { href: 'https://nodejs.org/en/download', target: '_blank', rel: 'noreferrer' }, tr('Node.js 설치 안내'), ' ↗'));
      if (provider.installCommand) body.append(commandBox(provider.installCommand, '설치'));
      if (provider.id === 'ollama') {
        body.append(h('p', {}, { ko: 'Ollama 설치 후 사용할 모델을 내려받으세요. 모델 다운로드가 끝나면 인터넷 없이 실행할 수 있습니다. 모델 크기는 Ollama 공식 모델 목록에서 확인하세요.', en: 'After installing Ollama, download a model. Once downloaded, it can run offline. Check model sizes in the official Ollama catalog.', ja: 'Ollamaのインストール後にモデルを取得すると、オフラインで実行できます。サイズは公式モデル一覧で確認してください。' }[language()]), h('a', { href: 'https://ollama.com/library', target: '_blank', rel: 'noreferrer' }, 'Ollama models ↗'), commandBox('ollama pull <model-name>', '설치'));
      }
      body.append(h('p', { class: 'ia-wizard-note' }, tr('명령은 터미널에 입력만 되며 자동 실행되지 않습니다.')));
    } else if (wizardStep === 1) {
      body.append(h('h3', {}, tr('공식 CLI의 로그인 화면에서 구독 계정으로 로그인하세요.')));
      if (provider.loginCommand) body.append(commandBox(provider.loginCommand, '로그인'));
      body.append(h('p', { class: 'ia-wizard-note' }, tr('로그인 토큰과 API 키를 IMPERIUM에 입력하지 않습니다.')), h('p', { class: 'ia-wizard-note' }, tr('각 사용자는 자신의 컴퓨터와 OS 사용자 계정에서 로그인합니다.')));
    } else if (wizardStep === 2) body.append(h('h3', {}, tr('로그인을 마쳤다면 연결 상태를 다시 확인하세요.')), h('div', { class: 'ia-wizard-status', 'data-status': actual?.status || 'unknown' }, h('span', {}, tr('현재 연결')), h('strong', {}, statusText(actual)), h('p', {}, tr(actual?.status === 'ready' ? '현재 이 제공자를 사용할 수 있습니다.' : '아직 연결되지 않았습니다. 설치와 로그인을 확인하세요.'))), h('button', { type: 'button', class: 'ia-primary', onclick: refreshConnections }, '↻ ', tr('연결 확인')));
    else body.append(h('h3', {}, tr('샘플로 조직과 작업 흐름을 살펴보세요.')), h('p', {}, tr('샘플은 모델을 호출하지 않으며 DEMO로 표시됩니다.')), h('button', { type: 'button', class: 'ia-primary', onclick: async event => { const button = event.currentTarget; button.disabled = true; try { await request('/api/demo', 'POST', {}); await finishWizard(); window.dispatchEvent(new CustomEvent('imperium:onboarding-sample')); } catch (error) { announce(error.message, true); button.disabled = false; } } }, tr('샘플 작업 체험')));
    const navigation = h('div', { class: 'ia-wizard-navigation' });
    navigation.append(h('button', { type: 'button', onclick: () => { if (wizardStep > 0) { wizardStep--; renderWizard(); } else wizard.close(); } }, tr(wizardStep ? '이전' : '나중에')));
    navigation.append(h('button', { type: 'button', class: 'ia-primary', onclick: async () => { if (wizardStep < 3) { wizardStep++; renderWizard(); } else await finishWizard(); } }, tr(wizardStep === 3 ? '설정 마치기' : '다음'), wizardStep < 3 ? ' →' : ''));
    wizard.replaceChildren(h('div', { class: 'ia-wizard-heading' }, h('div', {}, h('span', {}, 'IMPERIUM / PERSONAL SETUP'), h('h2', {}, tr('IMPERIUM 시작하기'))), h('button', { type: 'button', 'aria-label': tr('닫기'), onclick: () => wizard.close() }, '×')), h('ol', { class: 'ia-wizard-steps' }, ...steps.map((step, index) => h('li', { class: index === wizardStep ? 'active' : index < wizardStep ? 'complete' : '' }, h('span', {}, String(index + 1).padStart(2, '0')), tr(step)))), body, navigation);
  }
  async function finishWizard() { try { await request('/api/settings', 'POST', { onboarded: true }); state = { ...state, settings: { ...state.settings, onboarded: true } }; wizard.close(); announce(tr('설정을 저장했습니다.')); callbacks.onChanged?.(); } catch (error) { announce(error.message, true); } }
  function mount(target, configuration = {}) { removalEpoch++; removalDialog?.close(); removalDialog?.remove(); container = typeof target === 'string' ? document.querySelector(target) : target; callbacks = configuration; if (!container) return; state = callbacks.getState?.() || state; build(); reload(); }
  function render(incoming) { state = incoming || callbacks.getState?.() || state; if (!container) return; if (renderedLanguage !== language()) { build(); if (wizard?.open) renderWizard(); renderedSignature = ''; } if (removalWorkspace !== state.settings?.workspace) { removalWorkspace = state.settings?.workspace; removalEpoch++; removalDialog?.close(); removalDialog?.remove(); } if (Array.isArray(state.connections)) connections = state.connections; const signature = JSON.stringify([state.providers, connections, state.departments, state.projects, language()]); if (signature !== renderedSignature) { renderedSignature = signature; renderProviders(); renderConnections(); } if (loaded && state.server?.csrfToken && !state.settings?.onboarded && !wizardShown && catalog.length) openWizard(); }
  window.ImperiumAccounts = { mount, render, reload, showOnboarding: openWizard };
})();
