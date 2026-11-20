(() => {
  'use strict';

  const PROVIDERS = { codex: 'Codex', claude: 'Claude', gemini: 'Gemini', copilot: 'GitHub Copilot', ollama: 'Ollama' };
  const ACTIVE = new Set(['planning', 'running', 'queued']);
  const WRITABLE = new Set(['codex', 'claude']);
  const COPY = {
    ko: {
      mode: '팀 대화', back: '개인 대화', history: '팀 대화', fresh: '새 팀', noHistory: '저장된 팀 대화가 없습니다.',
      title: '팀에게 목표 지시', intro: '목표에 맞춰 팀을 구성하고, 역할별로 실행한 뒤 결과를 합칩니다.',
      scope: '첫 지시는 최대 5회 모델을 실행합니다. 다음 지시는 구성된 역할을 사용합니다.',
      planner: '팀 구성 모델', auto: '자동 선택', write: '이번 지시에 파일 수정 허용', readOnly: '이번 지시는 읽기 전용입니다.',
      writeNotice: '팀 구성은 읽기 전용입니다. 파일 수정은 지원하는 모델의 역할 실행에만 허용됩니다.',
      placeholder: '팀이 달성할 목표를 입력하세요.', followPlaceholder: '이 팀에게 이어서 할 일을 지시하세요.',
      start: '팀 구성 및 시작', send: '팀에 보내기', sending: '전송 중…', cancel: '팀 중지',
      offline: '연결된 뒤 팀에 지시할 수 있습니다.', noProvider: '사용 가능한 모델을 먼저 연결하세요.',
      noTeam: '팀을 구성하지 못했습니다. 새 팀으로 다시 시작하세요.', pending: '작업이 끝나면 같은 팀에 다음 지시를 보낼 수 있습니다.',
      teamUnavailable: '팀의 모델 연결 상태나 접근 정책을 확인하세요.', err: '요청을 처리하지 못했습니다.',
      refreshFailed: '요청을 접수했습니다. 팀 상태가 갱신되면 확인할 수 있습니다.',
      chart: '팀 구조도', stage: '단계', depends: '선행 업무', independent: '독립 실행', finalRole: '결과 통합',
      request: '지시', result: '팀 결과', waiting: '역할별 결과를 기다리는 중입니다.', noResult: '표시할 결과가 없습니다.',
      turn: '지시 기록', open: '작업 열기', openResult: '전체 결과 열기', preview: '결과 일부를 표시하고 있습니다.',
      review: '파일 변경 검토', plannedBy: '구성 모델',
      planning: '팀 구성 중', running: '실행 중', completed: '완료', failed: '실패',
      cancelled: '취소', interrupted: '중단', queued: '대기', idle: '배정 대기',
    },
    en: {
      mode: 'Team chat', back: 'Individual chat', history: 'Team chats', fresh: 'New team', noHistory: 'No team chats yet.',
      title: 'Give a team a goal', intro: 'IMPERIUM builds a team for the goal, runs each role, and combines the results.',
      scope: 'The first request uses up to five model runs. Follow-up requests use the same roles.',
      planner: 'Planning model', auto: 'Select automatically', write: 'Allow file edits for this request', readOnly: 'This request is read-only.',
      writeNotice: 'Planning is read-only. File edits are allowed only for roles using a model that supports them.',
      placeholder: 'Describe the team’s goal.', followPlaceholder: 'Tell this team what to do next.',
      start: 'Build and start team', send: 'Send to team', sending: 'Sending…', cancel: 'Stop team',
      offline: 'Reconnect before sending a team request.', noProvider: 'Connect an available model first.',
      noTeam: 'The team was not formed. Start a new team to try again.', pending: 'Send the next request once this team finishes.',
      teamUnavailable: 'Check the team’s model connections and access policy.', err: 'The request could not be completed.',
      refreshFailed: 'Request accepted. The team status will appear when it refreshes.',
      chart: 'Team structure', stage: 'Stage', depends: 'Receives work from', independent: 'Runs independently', finalRole: 'Combines results',
      request: 'Request', result: 'Team result', waiting: 'Waiting for the roles to finish.', noResult: 'No result to display.',
      turn: 'Request history', open: 'Open task', openResult: 'Open full result', preview: 'Showing a result preview.',
      review: 'Review file changes', plannedBy: 'Planner',
      planning: 'Planning', running: 'Running', completed: 'Completed', failed: 'Failed',
      cancelled: 'Cancelled', interrupted: 'Interrupted', queued: 'Queued', idle: 'Awaiting assignment',
    },
    ja: {
      mode: 'チームの会話', back: '個別の会話', history: 'チームの会話', fresh: '新しいチーム', noHistory: 'チームの会話はまだありません。',
      title: 'チームに目標を指示', intro: '目標に合わせてチームを編成し、役割ごとに実行して結果をまとめます。',
      scope: '最初の指示では最大5回モデルを実行します。次の指示では同じ役割を使用します。',
      planner: '編成モデル', auto: '自動選択', write: '今回の指示でファイル編集を許可', readOnly: '今回の指示は読み取り専用です。',
      writeNotice: '編成は読み取り専用です。編集は対応モデルによる役割の実行時のみ許可されます。',
      placeholder: 'チームが達成する目標を入力してください。', followPlaceholder: 'このチームに次の作業を指示してください。',
      start: 'チームを編成して実行', send: 'チームに送信', sending: '送信中…', cancel: 'チームを停止',
      offline: '接続してからチームに指示してください。', noProvider: '利用可能なモデルを先に接続してください。',
      noTeam: 'チームを編成できませんでした。新しいチームでやり直してください。', pending: '完了した後に同じチームへ次の指示を送れます。',
      teamUnavailable: 'チームのモデル接続とアクセスポリシーを確認してください。', err: 'リクエストを処理できませんでした。',
      refreshFailed: 'リクエストを受け付けました。更新されるとチームの状態が表示されます。',
      chart: 'チーム構成', stage: '段階', depends: '先行作業', independent: '独立して実行', finalRole: '結果を統合',
      request: '指示', result: 'チームの結果', waiting: '各役割の完了を待っています。', noResult: '表示できる結果がありません。',
      turn: '指示の履歴', open: 'タスクを開く', openResult: '結果の全文を開く', preview: '結果の一部を表示しています。',
      review: 'ファイル変更を確認', plannedBy: '編成モデル',
      planning: '編成中', running: '実行中', completed: '完了', failed: '失敗',
      cancelled: 'キャンセル', interrupted: '中断', queued: '待機', idle: '割り当て待ち',
    },
  };

  const text = value => typeof value === 'string' ? value : '';
  const array = value => Array.isArray(value) ? value : [];
  const scope = value => {
    const path = text(value).replace(/\\/g, '/');
    const normalized = path === '/' ? path : path.replace(/\/+$/, '');
    return /^[a-z]:/i.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized;
  };
  const element = (tag, className = '') => {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  };
  const set = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const status = value => ['planning', 'running', 'completed', 'failed', 'cancelled', 'interrupted', 'queued'].includes(value) ? value : 'idle';
  function button(className, action) {
    const node = element('button', className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function modelMark(provider) {
    return window.ImperiumMascots?.createMark?.(provider, { size: 20 });
  }

  function mount(container, { api, onChanged, onSelectTask, onReview } = {}) {
    const originalHeader = container.querySelector('.ic-sidebar-heading');
    if (!originalHeader) throw new Error('Mount the conversation pane before mounting team mode.');
    let mode = false, disposed = false, connected = false, visible = true, state = {}, language = 'ko';
    let project = '', selected = null, editorKey = '', roleSignature = '', optionSignature = '', turnSignature = '';
    const drafts = new Map(), teamSelections = new Map(), turnSelections = new Map(), notices = new Map();
    const pending = new Set(), historyItems = new Map(), roleItems = new Map(), accepted = new Map();
    const tr = key => COPY[language][key] || key;
    const nameOf = provider => state.providers?.find(item => item.id === provider)?.name || PROVIDERS[provider] || provider || '—';
    const key = (team = selected, workspace = project) => JSON.stringify([workspace, team]);
    const draft = () => {
      const id = key();
      if (!drafts.has(id)) {
        drafts.set(id, { prompt: '', provider: '', write: false });
        if (drafts.size > 160) drafts.delete(drafts.keys().next().value);
      }
      return drafts.get(id);
    };
    const teams = () => {
      const current = new Map();
      for (const team of array(state.teamRuns)) {
        if (!project || typeof team?.id !== 'string' || scope(team.workspace) !== project) continue;
        current.set(team.id, team);
      }
      for (const [id, team] of accepted) {
        if (scope(team.workspace) !== project) continue;
        const existing = current.get(team.id);
        const latest = array(team.turns).at(-1);
        if (existing && (!latest || array(existing.turns).some(turn => turn.id === latest.id))) accepted.delete(id);
        else current.set(team.id, team);
      }
      return [...current.values()].sort((a, b) => text(b.createdAt || b.turns?.[0]?.createdAt).localeCompare(text(a.createdAt || a.turns?.[0]?.createdAt)) || a.id.localeCompare(b.id));
    };

    const entry = button('ic-new team-mode-toggle', () => show(true));
    const back = button('ic-new', () => show(false));
    const fresh = button('ic-new', () => select(null));
    const page = element('section', 'team-page');
    page.hidden = true;
    const sidebar = element('aside', 'team-sidebar');
    const historyHeader = element('header', 'team-sidebar-heading');
    const historyTitle = element('h2');
    const historyActions = element('div', 'team-actions');
    historyActions.append(back, fresh);
    historyHeader.append(historyTitle, historyActions);
    const history = element('div', 'team-history');
    const noHistory = element('p', 'team-empty');
    sidebar.append(historyHeader, history, noHistory);

    const desk = element('div', 'team-desk');
    const heading = element('header', 'team-heading');
    const title = element('h2');
    const badge = element('span', 'team-status');
    const plannerName = element('span', 'team-planner-name');
    const cancel = button('ic-new team-stop', () => { void stop(); });
    heading.append(title, badge, plannerName, cancel);
    const body = element('div', 'team-body');
    const empty = element('div', 'team-intro');
    const intro = element('p'), scopeHint = element('p');
    empty.append(intro, scopeHint);
    const teamContent = element('div', 'team-active-content');
    const graphHeading = element('header', 'team-graph-heading');
    const graphTitle = element('h3');
    const permission = element('span', 'team-permission');
    graphHeading.append(graphTitle, permission);
    const graph = element('div', 'team-graph');
    const turnsLabel = element('label', 'team-turns');
    const turnsText = element('span'), turnSelector = element('select');
    turnsLabel.append(turnsText, turnSelector);
    turnSelector.addEventListener('change', () => { turnSelections.set(key(), turnSelector.value); draw(); });
    const request = element('details', 'team-request');
    const requestLabel = element('summary'), requestText = element('p');
    request.append(requestLabel, requestText);
    const result = element('section', 'team-result');
    const resultHeading = element('header', 'team-result-heading');
    const resultTitle = element('h3');
    const fullResult = button('ic-new', () => {
      if (!fullResult.hidden && fullResult.dataset.taskId) onSelectTask?.(fullResult.dataset.taskId);
    });
    const review = button('ic-new', () => { if (!review.hidden) onReview?.(); });
    resultHeading.append(resultTitle, fullResult, review);
    const error = element('p', 'team-error'), resultText = element('p', 'team-result-text'), resultHint = element('p', 'team-muted');
    result.append(resultHeading, error, resultText, resultHint);
    teamContent.append(turnsLabel, graphHeading, graph, request, result);
    body.append(empty, teamContent);

    const composer = element('form', 'team-composer');
    const controls = element('div', 'team-compose-controls');
    const plannerLabel = element('label'), plannerText = element('span'), planner = element('select');
    plannerLabel.append(plannerText, planner);
    const writeLabel = element('label', 'team-write');
    const write = element('input'), writeText = element('span');
    write.type = 'checkbox';
    writeLabel.append(write, writeText);
    controls.append(plannerLabel, writeLabel);
    const prompt = element('textarea');
    prompt.maxLength = 12000;
    prompt.rows = 3;
    prompt.required = true;
    const footer = element('div', 'team-compose-footer');
    const hint = element('p', 'team-muted'), send = element('button', 'ic-send');
    send.type = 'submit';
    footer.append(hint, send);
    const notice = element('p', 'team-notice');
    notice.setAttribute('role', 'status');
    composer.append(controls, prompt, footer, notice);
    desk.append(heading, body, composer);
    page.append(sidebar, desk);
    originalHeader.append(entry);
    container.append(page);

    function show(next) {
      mode = next;
      page.hidden = !mode;
      if (mode) container.dataset.chatMode = 'team';
      else delete container.dataset.chatMode;
      draw();
      if (!visible) return;
      if (mode) (prompt.disabled ? back : prompt).focus();
      else entry.focus();
    }
    function select(id) {
      selected = id;
      teamSelections.set(project, id);
      draw();
    }
    fresh.addEventListener('click', () => prompt.focus());

    function drawHistory(list) {
      const ids = new Set(list.map(item => item.id));
      for (const [id, row] of historyItems) {
        if (!ids.has(id)) { row.node.remove(); historyItems.delete(id); }
      }
      list.forEach((team, index) => {
        let row = historyItems.get(team.id);
        if (!row) {
          const node = button('ic-conversation', () => select(team.id));
          const label = element('strong'), detail = element('span');
          node.append(label, detail);
          row = { node, label, detail };
          historyItems.set(team.id, row);
        }
        const latest = array(team.turns).at(-1);
        set(row.label, team.title || latest?.prompt || team.id);
        set(row.detail, `${nameOf(team.plannerProvider)} · ${tr(status(latest?.status))}`);
        row.node.classList.toggle('selected', selected === team.id);
        if (selected === team.id) row.node.setAttribute('aria-current', 'true');
        else row.node.removeAttribute('aria-current');
        if (history.children[index] !== row.node) history.insertBefore(row.node, history.children[index] || null);
      });
      noHistory.hidden = list.length > 0;
    }

    function drawGraph(team, turn, taskById) {
      const roles = array(team?.plan?.roles);
      const signature = JSON.stringify([project, team?.id, team?.plan, language]);
      if (signature !== roleSignature) {
        roleSignature = signature;
        graph.replaceChildren();
        roleItems.clear();
        const byId = new Map(roles.map(role => [role.id, role]));
        const levels = new Map();
        function level(id, visiting = new Set()) {
          if (levels.has(id)) return levels.get(id);
          const role = byId.get(id);
          if (!role || visiting.has(id)) return 0;
          visiting.add(id);
          const depth = Math.max(0, ...array(role.dependsOn).filter(parent => byId.has(parent)).map(parent => level(parent, visiting) + 1));
          visiting.delete(id);
          levels.set(id, depth);
          return depth;
        }
        const groups = new Map();
        for (const role of roles) {
          const depth = level(role.id);
          if (!groups.has(depth)) groups.set(depth, []);
          groups.get(depth).push(role);
        }
        for (const [depth, members] of [...groups].sort(([a], [b]) => a - b)) {
          const stage = element('section', 'team-stage'), stageTitle = element('p', 'team-muted');
          set(stageTitle, `${tr('stage')} ${depth + 1}`);
          stage.append(stageTitle);
          for (const role of members) {
            const card = element('article', 'team-role');
            const row = element('div', 'team-role-heading'), mark = modelMark(role.provider), name = element('h4');
            set(name, role.name);
            if (mark) row.append(mark);
            row.append(name);
            const provider = element('p', 'team-role-provider'), description = element('p', 'team-role-summary');
            const dependencies = element('p', 'team-role-dependencies');
            const parents = array(role.dependsOn).map(parent => byId.get(parent)?.name).filter(Boolean);
            set(description, role.role);
            set(dependencies, parents.length ? `${tr('depends')} · ${parents.join(', ')}` : tr('independent'));
            const footer = element('div', 'team-role-footer'), progress = element('span', 'team-status');
            const open = button('ic-new', () => { if (open.dataset.taskId) onSelectTask?.(open.dataset.taskId); });
            set(open, tr('open'));
            footer.append(progress, open);
            card.append(row, provider, description, dependencies, footer);
            if (role.id === team.plan.finalRoleId) card.dataset.final = 'true';
            roleItems.set(role.id, { provider, progress, open });
            stage.append(card);
          }
          graph.append(stage);
        }
      }
      for (const role of roles) {
        const view = roleItems.get(role.id);
        if (!view) continue;
        const task = taskById.get(turn?.taskIds?.[role.id]);
        const model = task?.reportedModel || task?.modelId;
        set(view.provider, [nameOf(role.provider), model, role.id === team.plan.finalRoleId ? tr('finalRole') : ''].filter(Boolean).join(' · '));
        view.progress.dataset.status = status(task?.status);
        set(view.progress, tr(status(task?.status)));
        view.open.dataset.taskId = task?.id || '';
        view.open.hidden = !task || !onSelectTask;
      }
      graphHeading.hidden = graph.hidden = roles.length === 0;
    }

    const ready = () => array(state.providers).filter(item => Object.hasOwn(PROVIDERS, item?.id) && item.status === 'ready' && item.authenticated === true
      && (!state.settings?.localOnly || item.id === 'ollama'));
    function selection() {
      const team = teams().find(team => team.id === selected);
      const current = draft();
      const available = ready();
      const canWrite = !state.settings?.localOnly && (state.settings?.accessPolicy === undefined || state.settings.accessPolicy === 'task-confirm')
        && (team?.plan ? array(team.plan.roles).every(role => WRITABLE.has(role.provider)) : available.some(item => WRITABLE.has(item.id)));
      if (!canWrite) current.write = false;
      const candidates = current.write ? available.filter(item => WRITABLE.has(item.id)) : available;
      if (!candidates.some(item => item.id === current.provider)) current.provider = '';
      const latest = array(team?.turns).at(-1);
      const busy = ACTIVE.has(latest?.status);
      const teamReady = team?.plan && array(team.plan.roles).every(role => available.some(item => item.id === role.provider));
      const blocked = !connected || !project ? 'offline' : busy ? 'pending' : selected && !team?.plan ? 'noTeam'
        : selected && !teamReady ? 'teamUnavailable' : !candidates.length ? 'noProvider' : null;
      return { team, current, candidates, canWrite, latest, busy, blocked };
    }
    function drawComposer(config) {
      const { current, candidates, canWrite, blocked } = config;
      const id = key();
      if (editorKey !== id) { editorKey = id; prompt.value = current.prompt; }
      const signature = JSON.stringify([language, candidates.map(item => [item.id, item.name])]);
      if (signature !== optionSignature) {
        optionSignature = signature;
        planner.replaceChildren();
        for (const [id, label] of [['', tr('auto')], ...candidates.map(item => [item.id, nameOf(item.id)])]) {
          const option = element('option');
          option.value = id; set(option, label); planner.append(option);
        }
      }
      plannerLabel.hidden = Boolean(selected);
      planner.value = current.provider;
      write.checked = current.write;
      write.disabled = !canWrite || config.busy || pending.has(project);
      planner.disabled = Boolean(selected) || pending.has(project);
      prompt.placeholder = tr(selected ? 'followPlaceholder' : 'placeholder');
      prompt.setAttribute('aria-label', prompt.placeholder);
      set(send, tr(pending.has(project) ? 'sending' : selected ? 'send' : 'start'));
      send.disabled = Boolean(blocked) || pending.has(project) || !prompt.value.trim();
      set(hint, tr(blocked || (current.write ? 'writeNotice' : 'readOnly')));
      set(notice, notices.get(id) || '');
      notice.hidden = !notice.textContent;
    }
    function draw() {
      if (disposed) return;
      set(entry, tr('mode'));
      if (!visible || !mode) return;
      const config = selection(), { team, latest } = config;
      const turns = array(team?.turns);
      const picked = turns.find(turn => turn.id === turnSelections.get(key())) || latest;
      const taskById = new Map(array(state.tasks).filter(task => scope(task?.workspace) === project).map(task => [task.id, task]));
      const signature = JSON.stringify([key(), turns.map(turn => turn.id)]);
      if (signature !== turnSignature) {
        turnSignature = signature;
        turnSelector.replaceChildren();
        turns.forEach(turn => {
          const option = element('option');
          option.value = turn.id;
          turnSelector.append(option);
        });
      }
      turns.forEach((turn, index) => set(turnSelector.options[index], `${index + 1} · ${tr(status(turn.status))}`));
      turnSelector.value = picked?.id || '';
      turnsLabel.hidden = turns.length <= 1;
      empty.hidden = Boolean(team);
      teamContent.hidden = !team;
      set(back, tr('back')); set(fresh, tr('fresh')); set(historyTitle, tr('history')); set(noHistory, tr('noHistory'));
      set(intro, tr('intro')); set(scopeHint, tr('scope'));
      set(title, team?.title || tr('title'));
      badge.dataset.status = status(latest?.status);
      set(badge, latest ? tr(status(latest.status)) : '');
      badge.hidden = !latest;
      set(plannerName, team?.plannerProvider ? `${tr('plannedBy')} · ${nameOf(team.plannerProvider)}` : '');
      set(cancel, tr('cancel'));
      cancel.hidden = !config.busy;
      cancel.disabled = !connected || pending.has(project);
      set(graphTitle, tr('chart')); set(turnsText, tr('turn')); set(requestLabel, tr('request'));
      permission.dataset.write = String(picked?.permission === 'workspace-write');
      set(permission, tr(picked?.permission === 'workspace-write' ? 'write' : 'readOnly'));
      set(requestText, picked?.prompt || '');
      set(error, picked?.error || '');
      error.hidden = !error.textContent;
      set(resultTitle, tr('result')); set(fullResult, tr('openResult')); set(review, tr('review'));
      const final = taskById.get(picked?.finalTaskId);
      const resultValue = text(picked?.result) || text(final?.output);
      const preview = resultValue.slice(0, 12000).replace(/[\uD800-\uDBFF]$/, '');
      set(resultText, preview || tr(ACTIVE.has(picked?.status) ? 'waiting' : 'noResult'));
      resultText.classList.toggle('team-muted', !resultValue);
      set(resultHint, tr('preview'));
      resultHint.hidden = !resultValue || !(preview.length < resultValue.length || picked?.resultTruncated || (!picked?.result && (final?.detailsTruncated || final?.outputTruncated)));
      fullResult.dataset.taskId = final?.id || '';
      fullResult.hidden = !final || !onSelectTask;
      review.hidden = !onReview || picked?.permission !== 'workspace-write' || ACTIVE.has(picked?.status);
      // Keep the structure first during execution and make the finished answer reachable without scrolling past it.
      const resultAnchor = picked?.status === 'completed' || error.textContent ? turnsLabel : request;
      if (resultAnchor.nextElementSibling !== result) {
        const focused = result.contains(document.activeElement) ? document.activeElement : null;
        resultAnchor.after(result);
        focused?.focus({ preventScroll: true });
      }
      set(plannerText, tr('planner')); set(writeText, tr('write'));
      drawHistory(teams());
      drawGraph(team, picked, taskById);
      drawComposer(config);
    }

    async function requestTeam(route, fields, { create = false, sent } = {}) {
      const workspace = state.settings?.workspace;
      const owner = project, selectedBefore = selected, draftKey = key(), saved = draft();
      if (!workspace || !connected || pending.has(owner) || typeof api !== 'function') return;
      pending.add(owner);
      notices.delete(draftKey);
      draw();
      let submitted = false;
      let noticeKey = draftKey;
      try {
        const reply = await api(route, { method: 'POST', body: { workspace, ...fields } });
        if (disposed) return;
        const team = reply?.team;
        if (typeof team?.id !== 'string' || scope(team.workspace) !== owner || (!create && team.id !== selectedBefore)) throw new Error();
        submitted = true;
        if (accepted.size > 40) accepted.delete(accepted.keys().next().value);
        accepted.set(key(team.id, owner), team);
        if (sent !== undefined) {
          const unchanged = saved.prompt === sent;
          if (unchanged) saved.prompt = '';
          saved.write = false;
          turnSelections.delete(key(team.id, owner));
          if (project === owner && selected === selectedBefore) {
            if (create) {
              if (!unchanged) drafts.set(key(team.id, owner), { prompt: saved.prompt, provider: '', write: false });
              saved.prompt = '';
              select(team.id);
              noticeKey = key();
            } else if (unchanged) prompt.value = '';
          }
        }
        await onChanged?.(reply);
      } catch (problem) {
        if (!disposed) notices.set(noticeKey, submitted ? tr('refreshFailed') : [tr('err'), text(problem?.message)].filter(Boolean).join(' '));
      } finally {
        pending.delete(owner);
        draw();
      }
    }
    async function submit(event) {
      event.preventDefault();
      const config = selection(), entered = prompt.value;
      if (!mode || !visible || config.blocked || pending.has(project) || !entered.trim()) return;
      config.current.prompt = entered;
      const permission = config.current.write && config.canWrite ? 'workspace-write' : 'read-only';
      const route = selected ? `/api/teams/${encodeURIComponent(selected)}/turns` : '/api/teams';
      const fields = { prompt: entered.trim(), permission };
      if (!selected && config.current.provider) fields.provider = config.current.provider;
      await requestTeam(route, fields, { create: !selected, sent: entered });
    }
    async function stop() {
      if (!mode || !visible || !selected || !selection().busy) return;
      await requestTeam(`/api/teams/${encodeURIComponent(selected)}/cancel`, {});
    }
    planner.addEventListener('change', () => { draft().provider = planner.value; draw(); });
    write.addEventListener('change', () => { draft().write = write.checked; draw(); });
    prompt.addEventListener('input', () => { draft().prompt = prompt.value; drawComposer(selection()); });
    prompt.addEventListener('keydown', event => {
      if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!send.disabled) composer.requestSubmit();
      }
    });
    composer.addEventListener('submit', event => { void submit(event); });

    return {
      render(incoming, options = {}) {
        if (disposed) return;
        state = incoming || {};
        language = Object.hasOwn(COPY, options.language) ? options.language : Object.hasOwn(COPY, state.settings?.language) ? state.settings.language : 'ko';
        connected = options.connected === true;
        visible = options.visible !== false;
        const next = scope(state.settings?.workspace);
        if (next !== project) { project = next; selected = teamSelections.get(project) ?? null; editorKey = ''; }
        draw();
      },
      destroy() {
        disposed = true;
        entry.remove();
        page.remove();
        delete container.dataset.chatMode;
      },
    };
  }

  window.ImperiumTeam = Object.freeze({ mount });
})();
