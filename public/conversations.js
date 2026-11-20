(function () {
  'use strict';
  const COPY = {
    ko: { heading: '대화', new: '새 대화', emptyList: '아직 대화가 없습니다.', empty: '에이전트를 선택하고 첫 메시지를 보내세요.', missing: '선택한 대화를 불러오는 중입니다.', agent: '새 대화 에이전트', noAgent: '먼저 에이전트를 등록하세요.', write: '이 대화의 파일 수정 허용', strict: '현재 정책은 읽기 전용입니다.', blocked: '이 대화는 파일 수정 권한으로 시작했습니다. 현재 읽기 전용 정책에서는 보낼 수 없습니다. 새 읽기 전용 대화를 만드세요.', defaults: '모델·추론·속도 기본값은 부서 설정에서 변경합니다.', requested: '요청 모델', defaultModel: 'CLI 기본 모델', mismatch: 'CLI 보고 모델이 요청 모델과 다릅니다.', actual: 'CLI 보고 모델', native: 'CLI 세션 이어가기', history: '이전 대화 문맥 전달', unknownTransport: '연속 대화 방식 확인 대기', send: '보내기', queue: '대기열에 보내기', sending: '전송 중…', queueHelp: '실행 중인 응답을 중단하지 않고 같은 대화에서 순서대로 이어갑니다.', placeholder: '같은 대화에서 이어서 질문하세요. Ctrl+Enter로 보내기', error: '메시지를 보내지 못했습니다.', queued: '메시지가 대기열에 추가됐습니다.', sent: '메시지를 보냈습니다.', older: '이전 20개', latest: '최신 대화', turns: '개 메시지', loading: '전체 응답 불러오는 중…', loadFailed: '전체 응답을 불러오지 못했습니다.', retry: '다시 불러오기', running: '실행 중', completed: '완료', failed: '실패', cancelled: '취소', interrupted: '중단', queuedStatus: '대기', copied: '복사됨', copyFailed: '복사할 수 없습니다.', same: '이 대화의 에이전트·모델·파일 권한을 유지합니다.', effort: '추론', speed: '속도', projectChanged: '프로젝트가 변경됐습니다. 현재 대화에서 다시 보내세요.' },
    en: { heading: 'Conversations', new: 'New conversation', emptyList: 'No conversations yet.', empty: 'Choose an agent and send your first message.', missing: 'Loading the selected conversation.', agent: 'Agent for a new conversation', noAgent: 'Register an agent first.', write: 'Allow file edits in this conversation', strict: 'The current policy is read-only.', blocked: 'This conversation started with file-edit permission. It cannot continue under the current read-only policy. Start a new read-only conversation.', defaults: 'Change model, reasoning and speed defaults in department settings.', requested: 'Requested model', defaultModel: 'CLI default model', mismatch: 'The CLI-reported model differs from the requested model.', actual: 'CLI-reported model', native: 'Continue CLI session', history: 'Previous conversation context', unknownTransport: 'Continuity method not reported', send: 'Send', queue: 'Add to queue', sending: 'Sending…', queueHelp: 'Follow-ups run in order in the same conversation without interrupting the active response.', placeholder: 'Continue this conversation. Ctrl+Enter to send', error: 'The message could not be sent.', queued: 'Message added to the queue.', sent: 'Message sent.', older: 'Previous 20', latest: 'Latest messages', turns: 'messages', loading: 'Loading complete response…', loadFailed: 'The complete response could not be loaded.', retry: 'Retry loading', running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', queuedStatus: 'Queued', copied: 'Copied', copyFailed: 'Copy unavailable.', same: 'This conversation keeps its agent, model and file permission.', effort: 'Reasoning', speed: 'Speed', projectChanged: 'The project changed. Send again from the current conversation.' },
    ja: { heading: '会話', new: '新しい会話', emptyList: '会話はまだありません。', empty: 'エージェントを選び、最初のメッセージを送信してください。', missing: '選択した会話を読み込み中です。', agent: '新しい会話のエージェント', noAgent: '先にエージェントを登録してください。', write: 'この会話のファイル編集を許可', strict: '現在の方針は読み取り専用です。', blocked: 'この会話はファイル編集権限で開始しました。現在の読み取り専用方針では送信できません。新しい読み取り専用の会話を開始してください。', defaults: 'モデル・推論・速度の既定値は部署設定で変更します。', requested: '指定モデル', defaultModel: 'CLIの既定モデル', mismatch: 'CLIが報告したモデルは指定モデルと異なります。', actual: 'CLI報告モデル', native: 'CLIセッションを継続', history: '以前の会話文脈を引き継ぐ', unknownTransport: '会話継続の方式は未報告', send: '送信', queue: '待機列に追加', sending: '送信中…', queueHelp: '実行中の回答を中断せず、同じ会話の中で順番に続けます。', placeholder: 'この会話を続けてください。Ctrl+Enterで送信', error: 'メッセージを送信できませんでした。', queued: '待機列に追加しました。', sent: '送信しました。', older: '前の20件', latest: '最新の会話', turns: 'メッセージ', loading: '回答の全文を読み込み中…', loadFailed: '回答の全文を読み込めませんでした。', retry: '再取得', running: '実行中', completed: '完了', failed: '失敗', cancelled: 'キャンセル', interrupted: '中断', queuedStatus: '待機', copied: 'コピー済み', copyFailed: 'コピーできません。', same: 'この会話のエージェント・モデル・ファイル権限を維持します。', effort: '推論', speed: '速度', projectChanged: 'プロジェクトが変わりました。現在の会話から再送してください。' },
  };
  Object.assign(COPY.ko, { refreshFailed: '메시지는 접수됐습니다. 대화 상태를 다시 확인하세요.' });
  Object.assign(COPY.en, { refreshFailed: 'The message was accepted. Check the conversation status again.' });
  Object.assign(COPY.ja, { refreshFailed: 'メッセージは受け付けました。会話の状態を再確認してください。' });
  Object.assign(COPY.ko, { removedAgent: '에이전트가 제거되어 이 대화는 읽기 전용입니다. 새 에이전트로 새 대화를 시작하세요.', removedConnection: '등록된 연결이 제거되어 이 대화는 읽기 전용입니다. 사용할 연결을 지정한 에이전트로 새 대화를 시작하세요.' });
  Object.assign(COPY.en, { removedAgent: 'The agent was removed, so this conversation is read-only. Start a new conversation with a new agent.', removedConnection: 'The registered connection was removed, so this conversation is read-only. Start a new conversation with an agent assigned to an available connection.' });
  Object.assign(COPY.ja, { removedAgent: 'エージェントが削除されたため、この会話は読み取り専用です。新しいエージェントで新しい会話を開始してください。', removedConnection: '登録された接続が削除されたため、この会話は読み取り専用です。利用できる接続を設定したエージェントで新しい会話を開始してください。' });
  const h = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = String(value); return node; };
  const text = value => typeof value === 'string' ? value : '';
  const scope = value => { const path = text(value).replace(/\\/g, '/').replace(/\/+$/, ''); return /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path; };
  const set = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const drafts = new Map(), selections = new Map(), turns = new Map(), detailCache = new Map(), requests = new Map(), failedDetails = new Set(), notices = new Map();
  let root, options = {}, state = {}, language = 'ko', selected = null, project = '', activeDraftKey = '', generation = 0, lifetime = 0, disposed = true, offset = 0, pending = false;
  let heading, newButton, conversationList, title, context, timeline, older, latest, counter, form, agentLabel, agents, writeLabel, write, writeText, defaults, composerBrand, composerContext, prompt, send, help, message, listSignature = '', agentSignature = '';
  const tr = key => COPY[language][key] || key;
  const key = (id = selected, workspace = project) => `${workspace}\n${id || '@new'}`;
  const draft = () => { const id = key(); if (!drafts.has(id)) drafts.set(id, { text: '', departmentId: '', write: false }); return drafts.get(id); };
  const currentConversations = () => (Array.isArray(state.conversations) ? state.conversations : []).filter(value => value && typeof value.id === 'string' && project && scope(value.workspace) === project).sort((a, b) => text(b.updatedAt || b.createdAt).localeCompare(text(a.updatedAt || a.createdAt)));
  const current = () => currentConversations().find(value => value.id === selected);
  const tasksFor = id => (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task && !task.demo && task.conversationId === id && scope(task.workspace) === project).sort((a, b) => text(a.createdAt).localeCompare(text(b.createdAt)) || text(a.id).localeCompare(text(b.id)));
  const taskKey = task => `${project}\n${task.id}\n${task.status}\n${task.finishedAt || ''}\n${task.outputChars ?? text(task.output).length}`;
  const providerName = provider => state.providers?.find(item => item.id === provider)?.name || ({ codex: 'ChatGPT / Codex', claude: 'Claude Code', gemini: 'Gemini', copilot: 'GitHub Copilot', ollama: 'Ollama' })[provider] || provider || 'AI';
  function updateComposerBrand(provider) {
    const id = text(provider);
    if (composerBrand.dataset.provider === id) return;
    const mark = id && window.ImperiumMascots?.createMark?.(id, { size: 17 });
    composerBrand.dataset.provider = id;
    composerBrand.replaceChildren(...(mark ? [mark] : []));
  }
  const department = id => state.departments?.find(item => item.id === id);
  function config() {
    const conversation = current(), d = department(conversation?.departmentId || draft().departmentId), connection = state.connections?.find(item => item.id === (conversation ? conversation.connectionId : d?.connectionId));
    return { conversation, department: d, departmentId: conversation?.departmentId || d?.id, provider: conversation?.provider || connection?.providerId || d?.provider, connectionId: conversation ? conversation.connectionId || null : connection?.id || null, modelId: conversation ? conversation.modelId || '' : d?.modelId ?? connection?.modelId ?? '', permission: conversation ? conversation.permission : draft().write ? 'workspace-write' : 'read-only', reasoningEffort: d?.reasoningEffort || 'default', speed: d?.speed || 'default' };
  }
  function changedSelection(id) { selected = id; selections.set(project, id); activeDraftKey = ''; offset = 0; generation++; failedDetails.clear(); render(state); }
  function clearTurns() { for (const entry of turns.values()) { entry.view?.destroy(); entry.node.remove(); } turns.clear(); }
  async function copy(value) { try { await navigator.clipboard.writeText(value); return true; } catch { return false; } }
  function button(label, className, action) { const node = h('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  function renderList(conversations) {
    const signature = JSON.stringify([language, selected, conversations.map(conversation => [conversation.id, conversation.updatedAt, conversation.departmentId, conversation.provider, tasksFor(conversation.id)[0]?.title])]);
    if (signature === listSignature) return; listSignature = signature; conversationList.replaceChildren();
    if (!conversations.length) conversationList.append(h('p', 'ic-list-empty', tr('emptyList')));
    for (const conversation of conversations) {
      const node = button('', 'ic-conversation', () => changedSelection(conversation.id)); node.classList.toggle('selected', selected === conversation.id); node.setAttribute('aria-current', String(selected === conversation.id));
      const profile = h('span', 'ic-profile-label');
      const mark = window.ImperiumMascots?.createMark?.(conversation.provider, { size: 16 });
      if (mark) profile.append(mark);
      profile.append(h('span', '', `${providerName(conversation.provider)} · ${conversation.modelId || tr('defaultModel')}`));
      node.append(h('strong', '', tasksFor(conversation.id)[0]?.title || department(conversation.departmentId)?.name || conversation.id), profile);
      conversationList.append(node);
    }
  }
  async function hydrate(task) {
    const cacheKey = taskKey(task); if (requests.has(cacheKey) || detailCache.has(cacheKey) || failedDetails.has(cacheKey)) return;
    const owner = generation, requestedProject = project, requestedConversation = selected, token = {}; requests.set(cacheKey, token);
    try {
      const result = await options.api(`/api/tasks/${encodeURIComponent(task.id)}`);
      if (disposed || owner !== generation || project !== requestedProject || selected !== requestedConversation) return;
      const incoming = result?.task;
      if (!incoming || incoming.id !== task.id || incoming.conversationId !== requestedConversation || scope(incoming.workspace) !== project) throw new Error('task detail');
      detailCache.set(cacheKey, incoming); while (detailCache.size > 60) detailCache.delete(detailCache.keys().next().value);
    } catch { if (!disposed && owner === generation && project === requestedProject && selected === requestedConversation) failedDetails.add(cacheKey); }
    finally { if (requests.get(cacheKey) === token) requests.delete(cacheKey); if (!disposed) render(state); }
  }
  function renderTimeline(tasks) {
    const wasBottom = timeline.scrollTop + timeline.clientHeight >= timeline.scrollHeight - 70, oldScroll = timeline.scrollTop;
    const end = Math.max(0, tasks.length - offset), visible = tasks.slice(Math.max(0, end - 20), end), ids = new Set(visible.map(task => task.id));
    for (const [id, entry] of turns) if (!ids.has(id)) { entry.view?.destroy(); entry.node.remove(); turns.delete(id); }
    timeline.querySelector('.ic-empty')?.remove();
    if (!visible.length) timeline.append(h('p', 'ic-empty', tr(selected ? 'missing' : 'empty')));
    visible.forEach((task, index) => {
      const cacheKey = taskKey(task), cached = detailCache.get(cacheKey), full = cached ? { ...task, output: cached.output, logs: cached.logs, reportedModel: task.reportedModel || cached.reportedModel, detailsTruncated: false } : task;
      let entry = turns.get(task.id);
      if (!entry) {
        const node = h('section', 'ic-turn'), status = h('div', 'ic-turn-status'), model = h('p', 'ic-model-notice'), loading = h('p', 'ic-detail-note');
        const view = window.ImperiumOutput?.create({ expanded: true, displayControls: true, onCopy: copy }); const fallback = view ? null : h('pre', 'ic-fallback');
        node.append(status, model, view?.element || fallback, loading); entry = { node, status, model, view, fallback, loading }; turns.set(task.id, entry); timeline.append(node);
      }
      set(entry.status, `${tr(task.status === 'queued' ? 'queuedStatus' : task.status)} · ${providerName(task.provider)}`);
      entry.model.hidden = !(task.reportedModel && task.modelId && task.reportedModel !== task.modelId);
      set(entry.model, `${tr('mismatch')} ${tr('requested')}: ${task.modelId || tr('defaultModel')} · ${tr('actual')}: ${task.reportedModel || '—'}`);
      if (entry.view) entry.view.update({ task: full, language, provider: providerName(task.provider) }); else set(entry.fallback, `${task.prompt || ''}\n\n${full.output || ''}${task.error ? `\n${task.error}` : ''}`);
      const requiresDetail = task.detailsTruncated && !cached && !['running', 'queued'].includes(task.status);
      entry.loading.replaceChildren(); entry.loading.hidden = !requiresDetail;
      if (requiresDetail) {
        if (failedDetails.has(cacheKey)) entry.loading.append(h('span', '', tr('loadFailed')), button(tr('retry'), 'ic-retry', () => { failedDetails.delete(cacheKey); void hydrate(task); }));
        else { entry.loading.append(h('span', '', tr('loading'))); void hydrate(task); }
      }
      if (timeline.children[index] !== entry.node) timeline.insertBefore(entry.node, timeline.children[index] || null);
    });
    older.disabled = end <= 20; latest.disabled = offset === 0; set(counter, `${tasks.length} ${tr('turns')}`);
    timeline.scrollTop = wasBottom && offset === 0 ? timeline.scrollHeight : oldScroll;
  }
  function renderComposer() {
    const currentDraft = draft(), departments = Array.isArray(state.departments) ? state.departments : [];
    if (!currentDraft.departmentId || !department(currentDraft.departmentId)) currentDraft.departmentId = departments[0]?.id || '';
    const signature = JSON.stringify([language, departments.map(value => [value.id, value.name])]);
    if (signature !== agentSignature) { agentSignature = signature; agents.replaceChildren(); for (const value of departments) { const option = h('option', '', value.name || value.id); option.value = value.id; agents.append(option); } }
    const c = config(), hardReadOnly = state.settings?.accessPolicy === 'read-only', canWrite = ['codex', 'claude'].includes(c.provider);
    if (!selected && (hardReadOnly || !canWrite)) currentDraft.write = false;
    const blocked = Boolean(selected && c.conversation?.permission === 'workspace-write' && hardReadOnly);
    const removedAgent = Boolean(selected && c.conversation && !c.department);
    const removedConnection = Boolean(selected && c.conversation?.connectionId && !(Array.isArray(state.connections) && state.connections.some(connection => connection.id === c.conversation.connectionId)));
    agents.value = c.departmentId || ''; agents.disabled = Boolean(selected); write.checked = selected ? c.permission === 'workspace-write' : currentDraft.write; write.disabled = Boolean(selected) || hardReadOnly || !canWrite;
    const draftKey = key(); if (activeDraftKey !== draftKey) { activeDraftKey = draftKey; prompt.value = currentDraft.text; }
    const busy = Boolean(selected && tasksFor(selected).some(task => ['running', 'queued'].includes(task.status)));
    set(title, c.conversation ? c.department?.name || tasksFor(selected).at(-1)?.departmentName || c.conversation.departmentId || tr('heading') : tr('new'));
    set(context, c.conversation ? tr(c.conversation.transport === 'native-cli' ? 'native' : c.conversation.transport === 'history-context' ? 'history' : 'unknownTransport') : tr('defaults'));
    updateComposerBrand(c.provider);
    set(composerContext, `${c.provider ? providerName(c.provider) : tr('noAgent')} · ${tr('requested')}: ${c.modelId || tr('defaultModel')} · ${tr('effort')}: ${c.reasoningEffort} · ${tr('speed')}: ${c.speed}`);
    set(defaults, removedAgent ? tr('removedAgent') : removedConnection ? tr('removedConnection') : blocked ? tr('blocked') : hardReadOnly ? tr('strict') : selected ? tr('same') : tr('defaults')); defaults.classList.toggle('ic-blocked', blocked || removedAgent || removedConnection);
    set(send, tr(pending ? 'sending' : busy ? 'queue' : 'send')); send.disabled = pending || blocked || removedAgent || removedConnection || !project || !c.departmentId || !c.provider || Boolean(selected && !c.conversation);
    prompt.placeholder = tr('placeholder'); prompt.setAttribute('aria-label', tr('placeholder'));
    const notice = notices.get(draftKey); set(message, notice?.text || ''); message.hidden = !notice; message.classList.toggle('ic-error', Boolean(notice?.error));
  }
  async function submit(event) {
    event.preventDefault(); if (pending || send.disabled || !prompt.value.trim()) return;
    const sent = prompt.value, requestedKey = key(), requestedProject = project, requestedSelection = selected, requestedLifetime = lifetime, c = config();
    const body = { prompt: sent.trim(), workspace: state.settings.workspace, departmentId: c.departmentId, provider: c.provider, connectionId: c.connectionId, modelId: c.modelId, permission: c.permission, reasoningEffort: c.reasoningEffort, speed: c.speed, priority: 'normal', ...(selected ? { conversationId: selected } : { newConversation: true }) };
    pending = true; notices.delete(requestedKey); renderComposer(); let accepted = false, noticeKey = requestedKey;
    try {
      const result = await options.api('/api/tasks', { method: 'POST', body });
      if (disposed || lifetime !== requestedLifetime) return;
      if (!result?.task || typeof result.task.id !== 'string') throw new Error('Invalid task response');
      accepted = true;
      const record = drafts.get(requestedKey); if (record?.text === sent) record.text = '';
      const id = result?.task?.conversationId || result?.conversation?.id;
      if (project === requestedProject && selected === requestedSelection) {
        if (!requestedSelection && id) { const remaining = drafts.get(requestedKey)?.text || ''; drafts.set(key(id), { text: remaining, departmentId: c.departmentId, write: c.permission === 'workspace-write' }); if (record) record.text = ''; selected = id; selections.set(project, id); activeDraftKey = ''; generation++; }
        else if (record?.text === '') prompt.value = '';
        offset = 0; noticeKey = key(); notices.set(noticeKey, { text: tr(result?.task?.status === 'queued' ? 'queued' : 'sent') });
      }
      await options.onChanged?.(result);
    } catch (error) { if (!disposed && lifetime === requestedLifetime) notices.set(noticeKey, { text: accepted ? tr('refreshFailed') : `${tr('error')} ${text(error?.message)}`, error: true }); }
    finally { if (!disposed && lifetime === requestedLifetime) { pending = false; render(state); } }
  }
  function render(incoming) {
    if (!root || disposed) return; state = incoming || options.getState?.() || state;
    language = Object.hasOwn(COPY, state.settings?.language) ? state.settings.language : 'ko';
    const nextProject = scope(state.settings?.workspace);
    if (project !== nextProject) { project = nextProject; selected = selections.get(project) ?? null; activeDraftKey = ''; generation++; offset = 0; clearTurns(); }
    const conversations = currentConversations();
    if (!selections.has(project)) { selected = conversations[0]?.id || null; selections.set(project, selected); }
    set(heading, tr('heading')); set(newButton, tr('new')); set(agentLabel, tr('agent')); set(writeText, tr('write')); set(help, tr('queueHelp')); set(older, tr('older')); set(latest, tr('latest'));
    renderList(conversations); renderComposer(); renderTimeline(selected ? tasksFor(selected) : []);
  }
  function mount(container, configuration = {}) {
    if (!container?.replaceChildren) throw new TypeError('A conversation container is required');
    clearTurns(); generation++; lifetime++; root = container; options = configuration; disposed = false; project = ''; selected = null; activeDraftKey = ''; listSignature = ''; agentSignature = ''; pending = false; root.classList.add('ic-chat');
    const sidebar = h('aside', 'ic-sidebar'), sidebarHeading = h('header', 'ic-sidebar-heading'); heading = h('h2'); newButton = button('', 'ic-new', () => changedSelection(null)); conversationList = h('div', 'ic-conversation-list'); sidebarHeading.append(heading, newButton); sidebar.append(sidebarHeading, conversationList);
    const main = h('section', 'ic-main'), top = h('header', 'ic-main-heading'); title = h('h2'); context = h('p'); const page = h('div', 'ic-pages'); older = button('', 'ic-page', () => { offset += 20; generation++; render(state); }); latest = button('', 'ic-page', () => { offset = 0; generation++; render(state); }); counter = h('span'); page.append(older, latest, counter); top.append(title, context, page); timeline = h('div', 'ic-timeline');
    form = h('form', 'ic-composer'); form.addEventListener('submit', event => { void submit(event); }); const controls = h('div', 'ic-compose-controls'); agentLabel = h('label'); agentLabel.htmlFor = 'ic-agent'; agents = h('select'); agents.id = 'ic-agent'; agents.addEventListener('change', () => { draft().departmentId = agents.value; draft().write = false; renderComposer(); }); writeLabel = h('label', 'ic-write-label'); write = h('input'); write.type = 'checkbox'; write.addEventListener('change', () => { draft().write = write.checked; renderComposer(); }); writeText = h('span'); writeLabel.append(write, writeText); controls.append(agentLabel, agents, writeLabel);
    defaults = h('p', 'ic-defaults');
    composerBrand = h('span', 'ic-compose-brand');
    composerContext = h('span');
    const composerProfile = h('p', 'ic-compose-context');
    composerProfile.append(composerBrand, composerContext);
    prompt = h('textarea', 'ic-prompt'); prompt.rows = 3; prompt.maxLength = 12000; prompt.addEventListener('input', () => { draft().text = prompt.value; }); prompt.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); } });
    const footer = h('div', 'ic-composer-footer'); help = h('p'); send = h('button', 'ic-send'); send.type = 'submit'; footer.append(help, send); message = h('p', 'ic-message'); message.setAttribute('role', 'status'); form.append(controls, defaults, composerProfile, prompt, footer, message); main.append(top, timeline, form); root.replaceChildren(sidebar, main); render(options.getState?.() || {});
    return { render, destroy() { disposed = true; generation++; lifetime++; clearTurns(); root?.replaceChildren(); root = null; } };
  }
  window.ImperiumConversations = Object.freeze({ mount, render });
}());
