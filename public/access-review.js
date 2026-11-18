(function () {
  'use strict';
  const COPY = {
    ko: { heading: '권한과 파일 변경 검토', policy: 'AI 파일 접근 정책', taskConfirm: '작업별 파일 수정 선택 (기본)', readOnly: '모든 AI 작업 읽기 전용', policyHelp: '기본 정책은 새 작업의 파일 수정 선택을 따릅니다. 선택하지 않으면 읽기 전용입니다.', terminal: '내장 터미널 허용', terminalHelp: '터미널은 로그인한 OS 사용자 권한으로 실행되며 AI 파일 접근 정책과 별개입니다.', save: '권한 설정 저장', saving: '저장 중…', saved: '권한 설정을 저장했습니다.', dirty: '저장하지 않은 선택이 있습니다.', conflict: 'AI 작업이 실행 중이거나 대기 중입니다. 작업이 끝난 뒤 권한 설정을 다시 저장하세요. (409)', saveFailed: '권한 설정을 저장하지 못했습니다.', refreshNeeded: '설정은 저장됐습니다. 화면을 새로고침해 현재 상태를 확인하세요.', matrix: '제공자별 실제 적용 범위', provider: '제공자', enforcement: '적용 방식', limits: '범위와 제한', codex: 'CLI sandbox · read-only / workspace-write', codexLimit: '쓰기 선택은 해당 작업의 작업공간 쓰기 범위에 적용됩니다. CLI와 OS 정책이 함께 적용됩니다.', claude: 'Read · Glob · Grep / 쓰기 허용 시 Edit · Write 추가', claudeLimit: 'Bash는 허용하지 않습니다. 도구 허용 목록이며 OS 수준의 격리를 보장하지 않습니다.', others: 'Gemini · Copilot · Ollama', othersPolicy: '현재 연결은 읽기 전용', othersLimit: '파일 수정 작업은 이 연결에서 지원하지 않습니다.', terminalName: '내장 터미널', terminalPolicy: 'OS 사용자 셸', terminalLimit: '위 터미널 허용 설정으로 제어합니다. AI 도구 정책과 별도입니다.', review: 'Git 변경 검토', reviewHelp: '현재 프로젝트의 작업트리와 스테이징 변경을 조회합니다.', close: '닫기', refresh: '새로 조회', loading: 'Git 변경을 조회하고 있습니다…', notice: '현재 Git 작업트리 전체의 변경입니다. 특정 AI 작업의 변경으로 분리한 결과가 아니며, 이 화면에서 보는 것은 변경 승인이 아닙니다.', worktree: '작업트리', staged: '스테이징', untracked: '추적 안 된 파일', files: '변경 파일 목록', noDiff: '이 영역에 보고된 변경이 없습니다.', noUntracked: '추적 안 된 파일이 없습니다.', truncated: '변경 내용이 길어 일부만 표시합니다. 전체 내용은 프로젝트의 Git 도구에서 확인하세요.', generated: '조회 시각', unknownTime: '시각 미제공', failed: 'Git 변경을 조회하지 못했습니다.', invalid: '서버 응답을 확인할 수 없습니다.', projectChanged: '프로젝트가 바뀌었습니다. 현재 프로젝트에서 다시 조회하세요.', unavailable: '변경 검토를 사용할 수 없습니다.', 'git-unavailable': 'Git 실행 파일을 사용할 수 없습니다.', 'not-repository': '현재 프로젝트는 Git 저장소가 아닙니다.', timeout: 'Git 조회 시간이 초과됐습니다. 다시 조회하세요.', 'git-error': 'Git이 변경 내용을 반환하지 못했습니다.' },
    en: { heading: 'Permissions and file review', policy: 'AI file access policy', taskConfirm: 'Choose file edits per task (default)', readOnly: 'Read-only for every AI task', policyHelp: 'The default follows the file-edit choice for each new task. Without that selection, the task is read-only.', terminal: 'Allow the built-in terminal', terminalHelp: 'The terminal runs as your OS user, separately from the AI file access policy.', save: 'Save permissions', saving: 'Saving…', saved: 'Permissions saved.', dirty: 'You have unsaved selections.', conflict: 'AI tasks are running or queued. Save permissions again after they finish. (409)', saveFailed: 'Permissions could not be saved.', refreshNeeded: 'Settings were saved. Refresh the screen to check the current state.', matrix: 'Actual provider enforcement', provider: 'Provider', enforcement: 'Enforcement', limits: 'Scope and limits', codex: 'CLI sandbox · read-only / workspace-write', codexLimit: 'A write selection applies to that task’s workspace-write scope. CLI and OS policies also apply.', claude: 'Read · Glob · Grep / Edit · Write added when permitted', claudeLimit: 'Bash is not allowed. This is a tool allowlist, not a guarantee of OS isolation.', others: 'Gemini · Copilot · Ollama', othersPolicy: 'Current adapters are read-only', othersLimit: 'File-edit tasks are not supported by these connections.', terminalName: 'Built-in terminal', terminalPolicy: 'OS user shell', terminalLimit: 'Controlled by the terminal setting above, separately from AI tool policies.', review: 'Review Git changes', reviewHelp: 'Inspect working-tree and staged changes in the current project.', close: 'Close', refresh: 'Refresh review', loading: 'Loading Git changes…', notice: 'These are changes across the current Git working tree, not changes attributed to a specific AI task. Viewing this review does not approve changes.', worktree: 'Working tree', staged: 'Staged', untracked: 'Untracked files', files: 'Changed files', noDiff: 'No changes reported in this area.', noUntracked: 'No untracked files.', truncated: 'Only part of the changes is displayed. Use your project’s Git tools to inspect the complete changes.', generated: 'Checked at', unknownTime: 'Time not reported', failed: 'Git changes could not be loaded.', invalid: 'The server response could not be verified.', projectChanged: 'The project changed. Refresh the review in the current project.', unavailable: 'Change review is unavailable.', 'git-unavailable': 'The Git executable is unavailable.', 'not-repository': 'The current project is not a Git repository.', timeout: 'The Git request timed out. Refresh to try again.', 'git-error': 'Git could not return the changes.' },
    ja: { heading: '権限とファイル変更の確認', policy: 'AIのファイルアクセス方針', taskConfirm: 'タスクごとに編集を選択（既定）', readOnly: 'すべてのAIタスクを読み取り専用', policyHelp: '既定では新しいタスクごとのファイル編集の選択に従います。選択しないタスクは読み取り専用です。', terminal: '内蔵ターミナルを許可', terminalHelp: 'ターミナルはOSユーザー権限で実行され、AIのファイルアクセス方針とは別に扱います。', save: '権限設定を保存', saving: '保存中…', saved: '権限設定を保存しました。', dirty: '未保存の選択があります。', conflict: '実行中または待機中のAIタスクがあります。完了後に権限設定を保存してください。（409）', saveFailed: '権限設定を保存できませんでした。', refreshNeeded: '設定は保存しました。画面を更新して現在の状態を確認してください。', matrix: 'プロバイダーごとの実際の適用範囲', provider: 'プロバイダー', enforcement: '適用方法', limits: '範囲と制限', codex: 'CLI sandbox · read-only / workspace-write', codexLimit: '編集の選択はそのタスクのワークスペース書き込み範囲に適用されます。CLIとOSの方針も適用されます。', claude: 'Read・Glob・Grep / 編集許可時にEdit・Writeを追加', claudeLimit: 'Bashは許可しません。ツールの許可リストであり、OSレベルの隔離を保証するものではありません。', others: 'Gemini・Copilot・Ollama', othersPolicy: '現在の接続は読み取り専用', othersLimit: 'これらの接続はファイル編集タスクをサポートしていません。', terminalName: '内蔵ターミナル', terminalPolicy: 'OSユーザーのシェル', terminalLimit: '上のターミナル設定で制御し、AIツールの方針とは別に扱います。', review: 'Gitの変更を確認', reviewHelp: '現在のプロジェクトの作業ツリーとステージ済みの変更を確認します。', close: '閉じる', refresh: '再取得', loading: 'Gitの変更を取得中…', notice: '現在のGit作業ツリー全体の変更です。特定のAIタスクによる変更を分離した結果ではなく、この画面での確認は変更の承認を意味しません。', worktree: '作業ツリー', staged: 'ステージ済み', untracked: '未追跡ファイル', files: '変更ファイル一覧', noDiff: 'この範囲に報告された変更はありません。', noUntracked: '未追跡ファイルはありません。', truncated: '変更の一部のみ表示しています。全体はプロジェクトのGitツールで確認してください。', generated: '確認時刻', unknownTime: '時刻は未報告', failed: 'Gitの変更を取得できませんでした。', invalid: 'サーバーの応答を確認できません。', projectChanged: 'プロジェクトが変わりました。現在のプロジェクトで再取得してください。', unavailable: '変更の確認を利用できません。', 'git-unavailable': 'Gitの実行ファイルを利用できません。', 'not-repository': '現在のプロジェクトはGitリポジトリーではありません。', timeout: 'Gitの取得がタイムアウトしました。再取得してください。', 'git-error': 'Gitが変更内容を返せませんでした。' },
  };
  const h = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = String(value); return node; };
  const text = value => typeof value === 'string' ? value : '';
  const normalized = value => { const path = text(value).replace(/\\/g, '/').replace(/\/+$/, '') || ''; return /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path; };
  const valueOf = settings => ({ accessPolicy: settings?.accessPolicy === 'read-only' ? 'read-only' : 'task-confirm', terminalEnabled: settings?.terminalEnabled !== false });
  const same = (a, b) => a.accessPolicy === b.accessPolicy && a.terminalEnabled === b.terminalEnabled;
  let root, form, policy, terminal, save, message, matrix, reviewButton, latestState = {}, callbacks = {}, language = 'ko', draft, baseline, dirty = false, pending = false, statusKey = '', statusDetail = '', errorStatus = false, saveGeneration = 0, mountGeneration = 0;
  let dialog, reviewBody, reviewTitle, reviewRefresh, reviewClose, reviewNotice, reviewMeta, tabs, patchBody, fileBody, reviewMessage, reviewTruncated, review = null, reviewPending = false, reviewError = '', selectedTab = 'worktree', reviewGeneration = 0, workspace = '';
  const tr = key => COPY[language][key] || key;
  const control = (label, className, action) => { const node = h('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; };
  const labels = new Map();
  function labelled(node, key) { labels.set(node, key); return node; }
  function refreshLabels() { for (const [node, key] of labels) node.textContent = tr(key); }
  function request(path, options = {}) {
    if (typeof callbacks.api !== 'function') return Promise.reject(new Error(tr('invalid')));
    return callbacks.api(path, options);
  }
  function updateForm() {
    if (!form) return;
    policy.value = draft.accessPolicy; terminal.checked = draft.terminalEnabled;
    policy.disabled = pending; terminal.disabled = pending; save.disabled = pending || !dirty;
    save.textContent = tr(pending ? 'saving' : 'save');
    message.textContent = statusKey ? `${tr(statusKey)}${statusDetail ? ` ${statusDetail}` : ''}` : dirty ? tr('dirty') : '';
    message.hidden = !message.textContent; message.classList.toggle('ar-error', errorStatus); message.setAttribute('role', errorStatus ? 'alert' : 'status');
  }
  function changed() { draft = { accessPolicy: policy.value, terminalEnabled: terminal.checked }; dirty = !same(draft, baseline); statusKey = ''; statusDetail = ''; errorStatus = false; updateForm(); }
  async function savePolicy(event) {
    event.preventDefault(); if (pending || !dirty) return;
    const version = ++saveGeneration, owner = mountGeneration, requestedWorkspace = normalized(latestState.settings?.workspace), requested = { ...draft };
    pending = true; statusKey = ''; statusDetail = ''; errorStatus = false; updateForm(); let applied = false;
    try {
      const result = await request('/api/settings', { method: 'POST', body: requested });
      if (owner !== mountGeneration || version !== saveGeneration) return;
      if (!result?.settings || typeof result.settings !== 'object') throw new Error(tr('invalid'));
      applied = true; baseline = valueOf(result.settings); draft = { ...baseline }; dirty = false;
      statusKey = requestedWorkspace === normalized(latestState.settings?.workspace) ? 'saved' : ''; statusDetail = '';
      await callbacks.onSettingsChanged?.(result);
    } catch (error) {
      if (owner !== mountGeneration || version !== saveGeneration) return;
      errorStatus = true;
      statusKey = applied ? 'refreshNeeded' : error?.status === 409 ? 'conflict' : 'saveFailed';
      statusDetail = !applied && error?.status !== 409 ? text(error?.message).slice(0, 500) : '';
    } finally { if (owner === mountGeneration && version === saveGeneration) { pending = false; updateForm(); } }
  }
  function buildMatrix() {
    matrix.replaceChildren(labelled(h('summary'), 'matrix'));
    const table = h('table', 'ar-matrix'), header = h('tr');
    for (const key of ['provider', 'enforcement', 'limits']) { const cell = labelled(h('th'), key); cell.scope = 'col'; header.append(cell); }
    const head = h('thead'), body = h('tbody'); head.append(header);
    for (const [name, enforcement, limits] of [['Codex', 'codex', 'codexLimit'], ['Claude Code', 'claude', 'claudeLimit'], ['others', 'othersPolicy', 'othersLimit'], ['terminalName', 'terminalPolicy', 'terminalLimit']]) {
      const row = h('tr'), provider = h('th', '', COPY.ko[name] ? '' : name); provider.scope = 'row'; if (COPY.ko[name]) labelled(provider, name);
      row.append(provider, labelled(h('td'), enforcement), labelled(h('td'), limits)); body.append(row);
    }
    table.append(head, body); const wrap = h('div', 'ar-matrix-wrap'); wrap.append(table); matrix.append(wrap);
  }
  function mount() {
    const settingsForm = document.querySelector('#settings-dialog #settings-form'); if (!settingsForm) return false;
    mountGeneration++; labels.clear(); root = h('section', 'ar-panel'); root.id = 'access-review-section';
    root.append(labelled(h('h3'), 'heading')); form = h('form', 'ar-policy-form'); form.addEventListener('submit', event => { void savePolicy(event); });
    const policyLabel = labelled(h('label', 'ar-label'), 'policy'); policyLabel.htmlFor = 'ar-access-policy'; policy = h('select', 'ar-select'); policy.id = 'ar-access-policy';
    for (const [value, key] of [['task-confirm', 'taskConfirm'], ['read-only', 'readOnly']]) { const option = labelled(h('option'), key); option.value = value; policy.append(option); }
    policy.addEventListener('change', changed); form.append(policyLabel, policy, labelled(h('p', 'ar-help'), 'policyHelp'));
    const terminalLabel = h('label', 'ar-terminal-label'); terminal = h('input'); terminal.type = 'checkbox'; terminal.id = 'ar-terminal-enabled'; terminal.addEventListener('change', changed); terminalLabel.append(terminal, labelled(h('span'), 'terminal'));
    form.append(terminalLabel, labelled(h('p', 'ar-help'), 'terminalHelp')); save = h('button', 'ar-primary'); save.type = 'submit'; message = h('p', 'ar-message'); message.hidden = true;
    form.append(save, message); matrix = h('details', 'ar-enforcement'); buildMatrix();
    reviewButton = labelled(control('', 'ar-review-button', openReview), 'review'); root.append(form, matrix, reviewButton, labelled(h('p', 'ar-help'), 'reviewHelp')); settingsForm.before(root);
    baseline = valueOf(latestState.settings); draft = { ...baseline }; dirty = false; pending = false; statusKey = ''; statusDetail = ''; return true;
  }
  function closeReview() {
    reviewGeneration++; reviewPending = false; review = null; reviewError = '';
    const previous = dialog; dialog = null;
    if (previous?.open && typeof previous.close === 'function') previous.close(); previous?.remove();
  }
  function openReview() {
    if (dialog?.isConnected) return;
    dialog = h('dialog', 'ar-review-dialog'); dialog.setAttribute('aria-label', tr('review'));
    const heading = h('header', 'ar-review-heading'); reviewTitle = h('h2'); reviewRefresh = control('', 'ar-secondary', () => { void loadReview(); }); reviewClose = control('', 'ar-secondary', closeReview);
    const actions = h('div', 'ar-review-actions'); actions.append(reviewRefresh, reviewClose); heading.append(reviewTitle, actions);
    reviewBody = h('div', 'ar-review-body'); reviewNotice = h('p', 'ar-review-notice'); reviewMeta = h('div', 'ar-review-meta'); reviewMessage = h('p', 'ar-review-message'); reviewMessage.setAttribute('role', 'status');
    tabs = h('div', 'ar-review-tabs'); tabs.setAttribute('role', 'group');
    for (const key of ['worktree', 'staged', 'untracked']) { const tab = control('', 'ar-tab', () => { selectedTab = key; paintReview(); }); tab.dataset.tab = key; tabs.append(tab); }
    reviewTruncated = h('p', 'ar-truncated'); patchBody = h('div', 'ar-patch-body'); fileBody = h('details', 'ar-files');
    reviewBody.append(reviewNotice, reviewMeta, reviewMessage, tabs, reviewTruncated, patchBody, fileBody); dialog.append(heading, reviewBody); document.body.append(dialog);
    const opened = dialog; dialog.addEventListener('close', () => { if (dialog === opened) closeReview(); });
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); reviewClose.focus();
    selectedTab = 'worktree'; void loadReview();
  }
  async function loadReview() {
    if (!dialog) return;
    const version = ++reviewGeneration, owner = mountGeneration, requestedWorkspace = normalized(latestState.settings?.workspace);
    reviewPending = true; review = null; reviewError = ''; paintReview();
    try {
      const result = await request('/api/changes');
      if (!dialog || owner !== mountGeneration || version !== reviewGeneration || requestedWorkspace !== normalized(latestState.settings?.workspace)) return;
      const incoming = result?.review;
      if (!incoming || typeof incoming.available !== 'boolean') throw new Error(tr('invalid'));
      if (normalized(incoming.workspace) !== requestedWorkspace) { reviewError = 'projectChanged'; return; }
      review = incoming;
    } catch (error) {
      if (!dialog || owner !== mountGeneration || version !== reviewGeneration) return;
      reviewError = text(error?.message).slice(0, 600) || tr('failed');
    } finally {
      if (dialog && owner === mountGeneration && version === reviewGeneration) { reviewPending = false; paintReview(); }
    }
  }
  function paintPatch(value) {
    const source = text(value), bounded = source.slice(0, 180000), lines = bounded.split('\n'), clipped = source.length > bounded.length || lines.length > 3000;
    if (!source) { patchBody.append(h('p', 'ar-empty', tr('noDiff'))); return clipped; }
    const pre = h('pre', 'ar-patch'); pre.setAttribute('aria-label', tr(selectedTab));
    lines.slice(0, 3000).forEach((line, index, displayed) => { const kind = line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('diff ') ? 'ar-diff-heading' : line.startsWith('+') ? 'ar-added' : line.startsWith('-') ? 'ar-deleted' : ''; pre.append(h('span', kind, line + (index < displayed.length - 1 ? '\n' : ''))); });
    patchBody.append(pre); return clipped;
  }
  function paintReview() {
    if (!dialog) return;
    reviewTitle.textContent = tr('review'); reviewRefresh.textContent = tr(reviewPending ? 'loading' : 'refresh'); reviewRefresh.disabled = reviewPending; reviewClose.textContent = tr('close'); reviewNotice.textContent = tr('notice'); dialog.setAttribute('aria-label', tr('review'));
    reviewMeta.replaceChildren(); patchBody.replaceChildren(); fileBody.replaceChildren();
    reviewMessage.hidden = false; reviewTruncated.hidden = true; tabs.hidden = true; fileBody.hidden = true;
    const path = h('span', 'ar-review-workspace', text(review?.workspace || latestState.settings?.workspace)); reviewMeta.append(path);
    if (reviewPending) { reviewMessage.textContent = tr('loading'); return; }
    if (reviewError) { reviewMessage.textContent = reviewError === 'projectChanged' ? tr('projectChanged') : `${tr('failed')} ${reviewError}`; return; }
    if (!review) { reviewMessage.textContent = tr('unavailable'); return; }
    const date = typeof review.generatedAt === 'string' && Number.isFinite(Date.parse(review.generatedAt)) ? review.generatedAt : null;
    const checked = h('span', 'ar-review-checked', `${tr('generated')} · `), time = h('time', '', date ? new Date(date).toLocaleString(language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'ko-KR', { hour12: false }) : tr('unknownTime')); if (date) time.dateTime = date; checked.append(time); reviewMeta.append(checked);
    if (!review.available) { reviewMessage.textContent = Object.hasOwn(COPY[language], review.reason) ? COPY[language][review.reason] : `${tr('unavailable')} ${text(review.reason).slice(0, 500)}`; return; }
    reviewMessage.hidden = true; tabs.hidden = false;
    const untracked = Array.isArray(review.untracked) ? review.untracked.filter(value => typeof value === 'string') : [];
    for (const tab of tabs.children) { tab.textContent = `${tr(tab.dataset.tab)}${tab.dataset.tab === 'untracked' ? ` (${untracked.length})` : ''}`; tab.classList.toggle('active', tab.dataset.tab === selectedTab); tab.setAttribute('aria-pressed', String(tab.dataset.tab === selectedTab)); }
    let clipped = false;
    if (selectedTab === 'untracked') {
      const list = h('ul', 'ar-untracked'); for (const path of untracked.slice(0, 2000)) list.append(h('li', '', path));
      if (untracked.length) patchBody.append(list); else patchBody.append(h('p', 'ar-empty', tr('noUntracked'))); clipped = untracked.length > 2000;
    } else clipped = paintPatch(selectedTab === 'staged' ? review.stagedDiff : review.diff);
    reviewTruncated.textContent = tr('truncated'); reviewTruncated.hidden = !(review.truncated || clipped);
    const files = Array.isArray(review.files) ? review.files : [];
    if (files.length) {
      fileBody.hidden = false; fileBody.append(h('summary', '', `${tr('files')} · ${files.length}`));
      const list = h('ul', 'ar-file-list'); for (const file of files.slice(0, 2000)) { if (!file || typeof file.path !== 'string') continue; list.append(h('li', '', `${text(file.indexStatus)}${text(file.worktreeStatus)}  ${file.path}${file.originalPath ? ` ← ${text(file.originalPath)}` : ''}`)); } fileBody.append(list);
    }
  }
  function render(state = {}, options = {}) {
    latestState = state || {}; callbacks = options;
    const previousLanguage = language;
    language = Object.hasOwn(COPY, options.language) ? options.language : Object.hasOwn(COPY, state.settings?.language) ? state.settings.language : 'ko';
    if (!root?.isConnected && !mount()) return;
    const nextWorkspace = normalized(state.settings?.workspace);
    if (workspace !== nextWorkspace) { workspace = nextWorkspace; closeReview(); }
    if (!dirty && !pending) { baseline = valueOf(state.settings); draft = { ...baseline }; }
    refreshLabels(); updateForm(); if (dialog && previousLanguage !== language) paintReview();
  }
  window.ImperiumAccessReview = Object.freeze({ render, destroy() { mountGeneration++; saveGeneration++; closeReview(); root?.remove(); root = null; labels.clear(); pending = false; dirty = false; } });
}());
