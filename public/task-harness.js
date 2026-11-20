(function () {
  'use strict';

  const MAX_CRITERIA = 1200;
  const MAX_TITLE = 160;
  const TEXT = {
    ko: {
      editor: '완료 검사 설정', enabled: '사용 중', enable: '이 작업에서 완료 검사 사용',
      note: '실행이 정상 종료되면 IMPERIUM이 답변과 지정한 산출물을 검사합니다.',
      workflow: '시작 에이전트에 적용됩니다. 검사에 실패하면 연결된 후속 작업이 중단됩니다.',
      criteria: '완료 기준 (선택)', criteriaHint: '예: 변경 파일과 테스트 결과를 근거와 함께 정리',
      artifact: '필수 공유 산출물 제목 (선택)', artifactHint: '예: API 변경 검토 결과',
      artifactNote: 'Codex 또는 Claude가 이 작업에서 협업 보드에 정확히 이 제목으로 결과를 게시해야 합니다.',
      invalid: '완료 기준은 1,200자, 공유 산출물 제목은 160자 이내로 입력해 주세요.',
      report: '완료 검사', pending: '대기 중', passed: '자동 검사 통과', failed: '자동 검사 실패',
      skipped: '검사 미실행', output: '답변 본문 있음', shared: '이 작업의 공유 결과 게시',
      pass: '통과', fail: '미충족', waiting: '대기', notRun: '미실행', artifactId: '산출물 ID',
      owner: '소유자가 검토할 완료 기준',
      scope: '자동 검사는 답변과 산출물의 존재를 확인합니다. 작업 품질과 완료 기준은 결과를 보고 판단하세요.',
    },
    en: {
      editor: 'Completion checks', enabled: 'Enabled', enable: 'Enable completion checks for this task',
      note: 'After a successful process exit, IMPERIUM checks for a response and the requested artifact.',
      workflow: 'Applies to the starting agent. A failed check stops dependent tasks.',
      criteria: 'Acceptance criteria (optional)', criteriaHint: 'Example: Summarize changed files and provide test evidence',
      artifact: 'Required shared artifact title (optional)', artifactHint: 'Example: API change review',
      artifactNote: 'Codex or Claude must publish a result with this exact title to the collaboration board during this task.',
      invalid: 'Use up to 1,200 characters for criteria and 160 for the artifact title.',
      report: 'Completion checks', pending: 'Pending', passed: 'Automated checks passed', failed: 'Automated checks failed',
      skipped: 'Checks not run', output: 'Response text present', shared: 'Result published by this task',
      pass: 'Passed', fail: 'Not met', waiting: 'Pending', notRun: 'Not run', artifactId: 'Artifact ID',
      owner: 'Acceptance criteria for owner review',
      scope: 'Automated checks confirm that the response and requested artifact exist. Review the result against your acceptance criteria.',
    },
    ja: {
      editor: '完了チェックの設定', enabled: '有効', enable: 'このタスクで完了チェックを使う',
      note: 'プロセスが正常終了すると、IMPERIUMが回答と指定した成果物を確認します。',
      workflow: '開始エージェントに適用されます。チェックに失敗すると後続タスクが停止します。',
      criteria: '受け入れ基準（任意）', criteriaHint: '例：変更したファイルとテスト結果を根拠とともにまとめる',
      artifact: '必須の共有成果物のタイトル（任意）', artifactHint: '例：API変更レビュー',
      artifactNote: 'CodexまたはClaudeがこのタスクの実行中に、同じタイトルの結果を協業ボードへ投稿してください。',
      invalid: '受け入れ基準は1,200文字、共有成果物のタイトルは160文字以内で入力してください。',
      report: '完了チェック', pending: '待機中', passed: '自動チェック合格', failed: '自動チェック不合格',
      skipped: 'チェック未実施', output: '回答本文あり', shared: 'このタスクによる結果投稿',
      pass: '確認済み', fail: '未達', waiting: '待機中', notRun: '未実施', artifactId: '成果物ID',
      owner: 'オーナーが確認する受け入れ基準',
      scope: '自動チェックは回答と成果物の有無を確認します。作業の品質と受け入れ基準は結果を見て判断してください。',
    },
  };

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function words(language) {
    return Object.hasOwn(TEXT, language) ? TEXT[language] : TEXT.ko;
  }

  function createEditor({ language = 'ko', workflow = false, onChange } = {}) {
    const element = make('details', 'ith-editor');
    const heading = make('summary');
    const title = make('span');
    const badge = make('span', 'ith-enabled');
    heading.append(title, badge);

    const body = make('div', 'ith-form');
    const enabled = make('input');
    enabled.type = 'checkbox';
    const enableText = make('span');
    const enableLabel = make('label', 'ith-enable');
    enableLabel.append(enabled, enableText);

    const note = make('p', 'ith-note');
    const workflowNote = make('p', 'ith-note');
    const fields = make('fieldset', 'ith-fields');
    const criteria = make('textarea');
    criteria.maxLength = MAX_CRITERIA;
    criteria.rows = 3;
    const criteriaText = make('span');
    const criteriaLabel = make('label');
    criteriaLabel.append(criteriaText, criteria);

    const artifact = make('input');
    artifact.type = 'text';
    artifact.maxLength = MAX_TITLE;
    artifact.autocomplete = 'off';
    const artifactText = make('span');
    const artifactLabel = make('label');
    artifactLabel.append(artifactText, artifact);
    const artifactNote = make('p', 'ith-note');
    fields.append(criteriaLabel, artifactLabel, artifactNote);
    body.append(enableLabel, note);
    if (workflow) body.append(workflowNote);
    body.append(fields);
    element.append(heading, body);

    let copy, lastDraft;
    function sync() {
      badge.hidden = !enabled.checked;
      fields.disabled = !enabled.checked;
      fields.hidden = !enabled.checked;
    }
    function update({ language: nextLanguage = language } = {}) {
      if (copy && nextLanguage === language) return;
      language = nextLanguage;
      copy = words(language);
      title.textContent = copy.editor;
      badge.textContent = copy.enabled;
      enableText.textContent = copy.enable;
      note.textContent = copy.note;
      workflowNote.textContent = copy.workflow;
      criteriaText.textContent = copy.criteria;
      criteria.placeholder = copy.criteriaHint;
      artifactText.textContent = copy.artifact;
      artifact.placeholder = copy.artifactHint;
      artifactNote.textContent = copy.artifactNote;
    }
    function getDraft() {
      return { enabled: enabled.checked, open: element.open, criteria: criteria.value, artifactTitle: artifact.value };
    }
    function setValue(value) {
      enabled.checked = Boolean(value && value.enabled !== false);
      element.open = value?.open ?? enabled.checked;
      criteria.value = typeof value?.criteria === 'string' ? value.criteria.slice(0, MAX_CRITERIA) : '';
      artifact.value = typeof value?.artifactTitle === 'string' ? value.artifactTitle.slice(0, MAX_TITLE) : '';
      sync();
      lastDraft = JSON.stringify(getDraft());
    }
    function getValue() {
      if (!enabled.checked) return undefined;
      if (criteria.value.length > MAX_CRITERIA || artifact.value.length > MAX_TITLE) throw new Error(copy.invalid);
      return { criteria: criteria.value.trim(), artifactTitle: artifact.value.trim() };
    }
    function change() {
      if (!onChange) return;
      const draft = getDraft();
      const signature = JSON.stringify(draft);
      if (signature === lastDraft) return;
      lastDraft = signature;
      onChange(draft);
    }
    enabled.addEventListener('change', () => { sync(); change(); });
    criteria.addEventListener('input', change);
    artifact.addEventListener('input', change);
    element.addEventListener('toggle', change);
    sync();
    update();
    return { element, update, getValue, setValue, getDraft };
  }

  function createReport({ task, language = 'ko' } = {}) {
    const harness = task?.harness;
    if (!harness) return null;
    const copy = words(language);
    const result = harness.result;
    const decision = ['passed', 'failed', 'skipped'].includes(result?.status)
      ? result.status : ['queued', 'running'].includes(task.status) ? 'pending' : 'skipped';
    const element = make('details', 'ith-report');
    element.dataset.harnessStatus = decision;
    const heading = make('summary');
    heading.append(make('span', '', copy.report), make('span', 'ith-verdict', copy[decision]));
    const body = make('div', 'ith-report-body');
    const list = make('ul', 'ith-checks');
    const checks = Array.isArray(result?.checks) ? result.checks : [];
    function addCheck(id, label, expected) {
      const check = checks.find(item => item?.id === id);
      const state = typeof check?.passed === 'boolean' ? (check.passed ? 'pass' : 'fail') : decision === 'pending' ? 'waiting' : 'notRun';
      const row = make('li');
      const details = make('div', 'ith-check-desc', label);
      if (expected) details.append(make('span', 'ith-expected', expected));
      if (check?.passed && check.artifactId) {
        const link = make('code', 'ith-artifact-id', check.artifactId);
        const evidence = make('span', 'ith-evidence', copy.artifactId + ' ');
        evidence.append(link);
        details.append(evidence);
      }
      const status = make('span', 'ith-check-status', copy[state]);
      status.dataset.checkStatus = state;
      row.append(details, status);
      list.append(row);
    }
    addCheck('output', copy.output);
    if (harness.artifactTitle) addCheck('artifact', copy.shared, harness.artifactTitle);
    body.append(list);
    if (harness.criteria) {
      body.append(make('h4', 'ith-owner-title', copy.owner), make('p', 'ith-owner-criteria', harness.criteria));
    }
    body.append(make('p', 'ith-note', copy.scope));
    element.append(heading, body);
    return element;
  }

  window.ImperiumTaskHarness = Object.freeze({ createEditor, createReport });
})();
