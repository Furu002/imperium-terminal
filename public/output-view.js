(function () {
  'use strict';
  const FIRST_CHUNK = 40000, MAX_MARKDOWN = 120000, RAW_CHUNK = 60000;
  const COPY = {
    ko: { request: '내 요청', answer: 'AI 답변', reading: '읽기', raw: '원문', copy: '답변 복사', codeCopy: '코드 복사', copied: '복사됨', copyFailed: '복사할 수 없음', expand: '전체 보기', close: '닫기', details: '작업 세부정보', logs: '실행 기록', noLogs: '기록이 없습니다.', more: '이어서 보기', rawRest: '나머지 원문 보기', clipped: '긴 답변을 나누어 표시합니다. 답변 복사는 전체 원문을 복사합니다.', preview: '미리보기 · 전체 답변 불러오는 중…', waiting: '답변을 작성하고 있습니다…', cancelled: '작업이 취소되었습니다.', empty: '아직 답변이 없습니다.', model: '요청 모델', defaultModel: 'CLI 기본 모델', effort: '추론 강도', speed: '처리 속도', permission: '파일 권한', readOnly: '읽기 전용', write: '파일 수정 허용', recentLogs: '최근 100개 기록을 표시합니다.', incompleteCode: '나뉜 코드 · 원문에서 확인', error: '실행 오류' },
    en: { request: 'Your request', answer: 'AI response', reading: 'Read', raw: 'Raw', copy: 'Copy response', codeCopy: 'Copy code', copied: 'Copied', copyFailed: 'Copy unavailable', expand: 'Expand', close: 'Close', details: 'Task details', logs: 'Execution log', noLogs: 'No logs yet.', more: 'Continue reading', rawRest: 'Read the remaining raw text', clipped: 'Long responses are shown in sections. Copy response copies the complete original.', preview: 'Preview · loading the complete response…', waiting: 'Writing a response…', cancelled: 'This task was cancelled.', empty: 'No response yet.', model: 'Requested model', defaultModel: 'CLI default model', effort: 'Reasoning effort', speed: 'Processing speed', permission: 'File permission', readOnly: 'Read only', write: 'File edits allowed', recentLogs: 'Showing the latest 100 log entries.', incompleteCode: 'Partial code · see raw text', error: 'Execution error' },
    ja: { request: 'あなたの依頼', answer: 'AIの回答', reading: '読みやすく', raw: '原文', copy: '回答をコピー', codeCopy: 'コードをコピー', copied: 'コピー済み', copyFailed: 'コピーできません', expand: '全体表示', close: '閉じる', details: 'タスクの詳細', logs: '実行ログ', noLogs: '記録がありません。', more: '続きを読む', rawRest: '残りの原文を見る', clipped: '長い回答を分けて表示しています。回答のコピーは原文全体をコピーします。', preview: 'プレビュー・回答の全文を読み込み中…', waiting: '回答を作成しています…', cancelled: 'タスクがキャンセルされました。', empty: '回答はまだありません。', model: '指定モデル', defaultModel: 'CLIの既定モデル', effort: '推論の強度', speed: '処理速度', permission: 'ファイル権限', readOnly: '読み取り専用', write: 'ファイル編集を許可', recentLogs: '最新100件のログを表示しています。', incompleteCode: 'コードの一部・原文を確認', error: '実行エラー' },
  };
  Object.assign(COPY.ko, { skillRead: '스킬 문서 읽기 감지', skillCall: '스킬 CLI 호출 감지', skillReport: '모델 스킬 사용 보고', publicSummary: '공개 수행 요약', stageReport: 'AI 단계 보고', skillNote: '스킬 문서 읽기·호출은 성공을 보장하지 않습니다. 모델 사용 보고는 검증되지 않은 자기 보고입니다.' });
  Object.assign(COPY.en, { skillRead: 'Skill document read detected', skillCall: 'Skill CLI invocation detected', skillReport: 'Model-reported skill usage', publicSummary: 'Public execution summary', stageReport: 'AI stage report', skillNote: 'Skill document reads and invocations do not guarantee success. Model usage reports are unverified self reports.' });
  Object.assign(COPY.ja, { skillRead: 'スキル文書の読み取りを検知', skillCall: 'スキルのCLI呼び出しを検知', skillReport: 'モデルによるスキル使用報告', publicSummary: '公開された実行要約', stageReport: 'AIの段階報告', skillNote: 'スキル文書の読み取り・呼び出しは成功を保証しません。モデルによる使用報告は未検証の自己報告です。' });
  Object.assign(COPY.ko, { actualModel: 'CLI 보고 모델', requestedModel: '요청 모델', unreportedModel: '실행 모델 미보고' });
  Object.assign(COPY.en, { actualModel: 'CLI reported model', requestedModel: 'Requested model', unreportedModel: 'Execution model not reported' });
  Object.assign(COPY.ja, { actualModel: 'CLI報告モデル', requestedModel: '指定モデル', unreportedModel: '実行モデルは未報告' });
  const h = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = String(value); return node; };
  const text = value => typeof value === 'string' ? value : '';
  const words = language => COPY[language] || COPY.ko;
  function safeLink(value) {
    if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return null;
    if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
    try { const url = new URL(value, window.location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  function inline(parent, source) {
    let index = 0, plain = '', tokens = 0;
    const flush = () => { if (plain) { parent.append(document.createTextNode(plain)); plain = ''; } };
    while (index < source.length) {
      if (++tokens > 3000) { plain += source.slice(index); break; }
      const tail = source.slice(index);
      if (source[index] === '`') {
        const close = source.indexOf('`', index + 1);
        if (close > index + 1 && close - index < 2000) { flush(); parent.append(h('code', '', source.slice(index + 1, close))); index = close + 1; continue; }
      }
      const marker = tail.startsWith('**') ? '**' : tail.startsWith('__') ? '__' : null;
      if (marker) {
        const close = source.indexOf(marker, index + 2);
        if (close > index + 2 && close - index < 3000) { flush(); parent.append(h('strong', '', source.slice(index + 2, close))); index = close + 2; continue; }
      }
      if (source[index] === '[' && source[index - 1] !== '!') {
        const match = /^\[([^\]\n]{1,300})\]\(([^)\s]{1,2048})\)/.exec(tail);
        if (match) {
          const href = safeLink(match[2]);
          if (href) { flush(); const link = h('a', '', match[1]); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link); index += match[0].length; continue; }
        }
      }
      plain += source[index++];
    }
    flush();
  }
  function button(label, className, handler) {
    const control = h('button', className, label); control.type = 'button'; control.addEventListener('click', handler); return control;
  }
  async function copy(buttonNode, value, label, options) {
    try {
      const result = options.onCopy ? await options.onCopy(value) : await navigator.clipboard.writeText(value);
      buttonNode.textContent = result === false ? options.copyFailed : options.copied;
    } catch { buttonNode.textContent = options.copyFailed; }
    if (buttonNode.isConnected) buttonNode.setAttribute('aria-label', `${buttonNode.textContent} · ${label}`);
  }
  function renderMarkdown(source, configuration = {}) {
    const w = words(configuration.language), root = h('div', 'io-markdown');
    const original = text(source), bounded = original.slice(0, MAX_MARKDOWN), lines = bounded.split('\n');
    const truncated = configuration.truncated || original.length > bounded.length;
    const copyOptions = { ...configuration, copied: w.copied, copyFailed: w.copyFailed };
    let index = 0, blocks = 0;
    const fence = line => /^ {0,3}(`{3,}|~{3,})([^\r]*)\r?$/.exec(line);
    const list = line => /^\s{0,12}([-+*]|\d{1,6}[.)])\s+(.+?)\r?$/.exec(line);
    const special = line => !line.trim() || fence(line) || /^ {0,3}#{1,6}\s/.test(line) || /^\s*>/.test(line) || list(line) || /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
    while (index < lines.length) {
      if (++blocks > 350) { const paragraph = h('p', 'io-plain-overflow', lines.slice(index).join('\n')); root.append(paragraph); break; }
      const line = lines[index];
      if (!line.trim()) { index++; continue; }
      const opening = fence(line);
      if (opening) {
        const start = ++index;
        while (index < lines.length) { const closing = fence(lines[index]); if (closing && closing[1][0] === opening[1][0] && closing[1].length >= opening[1].length && !closing[2].trim()) break; index++; }
        const hasClosing = index < lines.length;
        const content = lines.slice(start, index).join('\n') + (hasClosing && index > start ? '\n' : '');
        const section = h('section', 'io-code-block'), toolbar = h('div', 'io-code-toolbar');
        toolbar.append(h('span', '', opening[2].trim().slice(0, 40) || 'CODE'));
        if (hasClosing || !truncated) {
          let control; control = button(w.codeCopy, 'io-code-copy', () => { void copy(control, content, w.codeCopy, copyOptions); }); toolbar.append(control);
        } else toolbar.append(h('span', 'io-partial-code', w.incompleteCode));
        const pre = h('pre'), code = h('code', '', content); pre.append(code); section.append(toolbar, pre); root.append(section);
        if (hasClosing) index++; continue;
      }
      const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\r?$/.exec(line);
      if (heading) { const element = h(`h${Math.min(heading[1].length + 1, 6)}`); inline(element, heading[2]); root.append(element); index++; continue; }
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { root.append(h('hr')); index++; continue; }
      if (/^\s*>/.test(line)) {
        const quote = h('blockquote');
        while (index < lines.length && /^\s*>/.test(lines[index])) { const paragraph = h('p'); inline(paragraph, lines[index++].replace(/^\s*>\s?/, '').replace(/\r$/, '')); quote.append(paragraph); }
        root.append(quote); continue;
      }
      const item = list(line);
      if (item) {
        const ordered = /^\d/.test(item[1]), collection = h(ordered ? 'ol' : 'ul');
        if (ordered) collection.start = Math.max(1, parseInt(item[1], 10));
        while (index < lines.length) {
          const entry = list(lines[index]); if (!entry || /^\d/.test(entry[1]) !== ordered) break;
          const cell = h('li'), task = /^\[([ xX])\]\s+(.*)$/.exec(entry[2]);
          if (task) { const check = h('input'); check.type = 'checkbox'; check.disabled = true; check.checked = task[1] !== ' '; check.setAttribute('aria-label', task[2]); cell.append(check); inline(cell, task[2]); }
          else inline(cell, entry[2]);
          collection.append(cell); index++;
          if (collection.children.length >= 200) break;
        }
        root.append(collection); continue;
      }
      if (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] || '')) {
        const cells = value => value.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').slice(0, 20).map(value => value.trim());
        const wrap = h('div', 'io-table-wrap'), table = h('table'), head = h('thead'), header = h('tr'), body = h('tbody');
        for (const value of cells(line)) { const cell = h('th'); cell.scope = 'col'; inline(cell, value); header.append(cell); }
        head.append(header); index += 2;
        while (index < lines.length && lines[index].includes('|') && lines[index].trim() && body.children.length < 100) {
          const row = h('tr'); for (const value of cells(lines[index++])) { const cell = h('td'); inline(cell, value); row.append(cell); } body.append(row);
        }
        table.append(head, body); wrap.append(table); root.append(wrap); continue;
      }
      const paragraph = h('p'), content = [line.replace(/\r$/, '')]; index++;
      while (index < lines.length && !special(lines[index])) {
        if (lines[index].includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || '')) break;
        content.push(lines[index++].replace(/\r$/, ''));
      }
      inline(paragraph, content.join('\n')); root.append(paragraph);
    }
    return root;
  }
  function create(configuration = {}) {
    const element = h('div', 'io-conversation');
    let current, language = 'ko', provider = '', previous, response, request, metadata, logs, dialog, expandedView, readingLimit = FIRST_CHUNK, rawLimit = RAW_CHUNK, rawSelected = false;
    const copyOptions = () => ({ onCopy: configuration.onCopy, copied: words(language).copied, copyFailed: words(language).copyFailed });
    function closeDialog() {
      if (!dialog) return;
      const previousDialog = dialog; dialog = null; expandedView?.destroy(); expandedView = null;
      if (previousDialog.open && typeof previousDialog.close === 'function') previousDialog.close();
      previousDialog.remove();
    }
    function expand() {
      if (dialog || !current) return;
      const w = words(language); dialog = h('dialog', 'io-dialog'); dialog.setAttribute('aria-label', w.answer);
      const header = h('header', 'io-dialog-heading'); header.append(h('strong', '', current.title || w.answer), button(w.close, 'io-dialog-close', closeDialog));
      expandedView = create({ ...configuration, expanded: true }); expandedView.update({ task: current, language, provider });
      const body = h('div', 'io-dialog-body'); body.append(expandedView.element); dialog.append(header, body); document.body.append(dialog);
      const openedDialog = dialog;
      dialog.addEventListener('close', () => { if (dialog === openedDialog) closeDialog(); });
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      header.querySelector('button').focus();
    }
    function buildResponse() {
      const task = current, w = words(language), output = text(task.output);
      const article = h('article', 'inspector-result io-message io-response'), header = h('header', 'io-message-heading');
      const identity = h('div', 'io-identity'); identity.append(h('span', 'io-avatar io-ai-avatar', 'AI'), h('div', '', undefined));
      identity.lastChild.append(h('strong', '', provider || 'AI'), h('span', 'io-role', w.answer));
      identity.lastChild.append(h('span', 'io-model-label', task.reportedModel ? `${w.actualModel} · ${task.reportedModel}` : `${w.requestedModel} · ${task.modelId || w.defaultModel} · ${w.unreportedModel}`));
      const actions = h('div', 'io-message-actions');
      if (!configuration.expanded) actions.append(button(w.expand, 'io-expand', expand));
      header.append(identity, actions); article.append(header);
      const toolbar = h('div', 'io-output-toolbar'), modes = h('div', 'io-output-modes');
      const read = button(w.reading, 'io-mode active', () => selectMode(false)), raw = button(w.raw, 'io-mode', () => selectMode(true));
      read.setAttribute('aria-pressed', 'true'); raw.setAttribute('aria-pressed', 'false'); modes.append(read, raw);
      let answerCopy; answerCopy = button(w.copy, 'io-answer-copy', () => { void copy(answerCopy, output, w.copy, copyOptions()); }); answerCopy.disabled = !output || Boolean(task.detailsTruncated);
      toolbar.append(modes, answerCopy); article.append(toolbar);
      if (task.detailsTruncated) article.append(h('p', 'io-preview-note', w.preview));
      const reading = h('div', 'io-reading'), rawView = h('div', 'io-raw-view'); rawView.hidden = true;
      let rawBuilt = false;
      function drawReading() {
        reading.replaceChildren();
        if (output) reading.append(renderMarkdown(output.slice(0, readingLimit), { language, onCopy: configuration.onCopy, truncated: output.length > readingLimit || task.detailsTruncated }));
        else reading.append(h('p', 'waiting-output io-waiting', ['running', 'queued'].includes(task.status) ? w.waiting : task.status === 'cancelled' ? w.cancelled : w.empty));
        if (output.length > readingLimit) {
          const note = h('div', 'io-long-note'); note.append(h('p', '', w.clipped));
          note.append(button(readingLimit < MAX_MARKDOWN ? w.more : w.rawRest, 'io-load-more', () => { if (readingLimit < MAX_MARKDOWN) { readingLimit = Math.min(MAX_MARKDOWN, readingLimit + FIRST_CHUNK); drawReading(); } else selectMode(true); })); reading.append(note);
        }
      }
      function drawRaw() {
        const pre = h('pre', 'io-raw', output.slice(0, rawLimit)); rawView.replaceChildren(pre);
        if (output.length > rawLimit) rawView.append(button(w.more, 'io-load-more', () => { const offset = rawLimit; rawLimit += RAW_CHUNK; pre.append(document.createTextNode(output.slice(offset, rawLimit))); if (rawLimit >= output.length) rawView.querySelector('button')?.remove(); }));
        rawBuilt = true;
      }
      function selectMode(showRaw) {
        rawSelected = showRaw;
        reading.hidden = showRaw; rawView.hidden = !showRaw;
        read.classList.toggle('active', !showRaw); raw.classList.toggle('active', showRaw);
        read.setAttribute('aria-pressed', String(!showRaw)); raw.setAttribute('aria-pressed', String(showRaw));
        if (showRaw && !rawBuilt) drawRaw();
      }
      drawReading(); article.append(reading, rawView); if (rawSelected) selectMode(true);
      if (task.error) { const error = h('div', 'inspector-error io-error'); error.append(h('strong', '', w.error), h('p', '', task.error)); article.append(error); }
      return article;
    }
    function buildDetails() {
      const task = current, w = words(language), details = h('details', 'io-details io-task-details'); details.append(h('summary', '', w.details));
      const list = h('dl');
      for (const [label, value] of [[w.requestedModel, task.modelId || w.defaultModel], [w.actualModel, task.reportedModel || w.unreportedModel], [w.effort, task.reasoningEffort || 'default'], [w.speed, task.speed || 'default'], [w.permission, task.permission === 'workspace-write' ? w.write : w.readOnly]]) list.append(h('dt', '', label), h('dd', '', value));
      details.append(list); return details;
    }
    function buildLogs() {
      const records = Array.isArray(current.logs) ? current.logs : [], w = words(language);
      const details = h('details', 'io-details io-execution-logs'); details.append(h('summary', '', `${w.logs} · ${records.length}`));
      let built = false;
      details.addEventListener('toggle', () => {
        if (!details.open || built) return; built = true;
        const body = h('div', 'io-log-body');
        if (!records.length) body.append(h('p', '', w.noLogs));
        if (records.length > 100) body.append(h('p', '', w.recentLogs));
        if (records.some(record => record.type === 'skill' && ['cli-skill-read', 'cli-skill-call', 'model-reported'].includes(record.source))) body.append(h('p', 'io-log-source-note', w.skillNote));
        for (const record of records.slice(-100)) {
          const sourceKeys = record.type === 'skill' ? { 'cli-skill-read': 'skillRead', 'cli-skill-call': 'skillCall', 'model-reported': 'skillReport' } : record.type === 'status' ? { 'model-summary': 'publicSummary', 'model-estimate': 'stageReport' } : null;
          const sourceKey = sourceKeys && Object.hasOwn(sourceKeys, record.source) ? sourceKeys[record.source] : null;
          const sourceLabel = sourceKey ? ` · ${w[sourceKey]}` : '';
          const row = h('div', 'io-log-entry'); row.append(h('span', '', `${text(record.timestamp)} ${text(record.type)}${sourceLabel}`.trim()), h('pre', '', text(record.text).slice(0, 12000))); body.append(row);
        }
        details.append(body);
      }); return details;
    }
    function update(value = {}) {
      const task = value.task || {}, nextLanguage = COPY[value.language] ? value.language : 'ko', nextProvider = text(value.provider);
      const old = previous;
      current = task; language = nextLanguage; provider = nextProvider;
      const languageChanged = !old || old.language !== language;
      if (!request || languageChanged || old.prompt !== task.prompt) {
        request = h('article', 'inspector-prompt io-message io-request');
        const header = h('header', 'io-message-heading'); header.append(h('span', 'io-avatar io-user-avatar', 'YOU'), h('strong', '', words(language).request));
        request.append(header, h('p', 'io-request-text', text(task.prompt)));
      }
      if (!response || languageChanged || old.output !== task.output || old.status !== task.status || old.error !== task.error || old.truncated !== task.detailsTruncated || old.provider !== provider || old.modelId !== task.modelId || old.reportedModel !== task.reportedModel) {
        if (old?.output !== task.output && !text(task.output).startsWith(text(old?.output))) { readingLimit = FIRST_CHUNK; rawLimit = RAW_CHUNK; }
        response = buildResponse();
      }
      const detailsKey = JSON.stringify([task.modelId, task.reportedModel, task.reasoningEffort, task.speed, task.permission]);
      if (!metadata || languageChanged || old.detailsKey !== detailsKey) metadata = buildDetails();
      const records = Array.isArray(task.logs) ? task.logs : [];
      const logsKey = JSON.stringify([records.length, records[0]?.id, records.at(-1)?.id, records.at(-1)?.type, records.at(-1)?.source, text(records.at(-1)?.text).slice(-200)]);
      if (!logs || languageChanged || old.logsKey !== logsKey) { const wasOpen = logs?.open; logs = buildLogs(); logs.open = Boolean(wasOpen); }
      previous = { language, provider, prompt: task.prompt, output: task.output, status: task.status, error: task.error, truncated: task.detailsTruncated, modelId: task.modelId, reportedModel: task.reportedModel, detailsKey, logsKey };
      const desired = [request, response, metadata, logs];
      if (desired.some((node, index) => element.children[index] !== node)) element.replaceChildren(...desired);
      expandedView?.update(value);
      if (dialog) { dialog.setAttribute('aria-label', words(language).answer); dialog.querySelector('.io-dialog-heading strong').textContent = task.title || words(language).answer; dialog.querySelector('.io-dialog-close').textContent = words(language).close; }
    }
    return { element, update, destroy() { closeDialog(); element.remove(); previous = null; } };
  }
  window.ImperiumOutput = Object.freeze({ create, renderMarkdown, safeLink });
}());
