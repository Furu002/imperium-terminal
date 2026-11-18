(function () {
  'use strict';
  const WORDS = {
    en: { '프로젝트 지식 그래프': 'Project knowledge graph', '저장된 기억과 실제 관계를 탐색하고 검토합니다.': 'Explore and review saved memories and their actual relationships.', '키워드 기반 검색·재사용이며 모델 가중치를 학습하지 않습니다.': 'Keyword retrieval and reuse; model weights are not trained.', '새 기억': 'New memory', '새로고침': 'Refresh', '기억 검색': 'Search memories', '전체': 'All', '결정': 'Decisions', '사실': 'Facts', '작업': 'Task results', '제약': 'Constraints', '노트': 'Notes', '활성 기억': 'Active memories', '실제 관계': 'Recorded relationships', '고정 기억': 'Pinned memories', '사용자 검토': 'User reviewed', '에이전트 미검증': 'Agent unverified', '키워드 관계': 'Keyword relationship', '수동 관계': 'Manual relationship', '고정': 'Pinned', '첫 결과나 기억이 저장되면 그래프가 만들어집니다.': 'The graph appears when the first result or memory is saved.', '표시할 관계나 노드를 임의로 만들지 않습니다.': 'No nodes or relationships are invented for display.', '검색 조건에 맞는 기억이 없습니다.': 'No memories match this search.', '표시 {visible} / 검색 결과 {matches} / 전체 {total}': 'Showing {visible} / matches {matches} / total {total}', '관계 표시 {visible} / 해당 관계 {total}': 'Relationships shown {visible} / matching relationships {total}', '그래프는 최근 검색 결과 최대 150개를 표시합니다. 전체 기록은 검색과 목록에서 탐색할 수 있습니다.': 'The graph shows up to 150 recent matches. Search and the list cover all records.', '이전': 'Previous', '다음': 'Next', '기억 검사기': 'Memory inspector', '기억을 선택하세요': 'Select a memory', '그래프나 목록에서 항목을 선택해 원문과 수정 이력을 확인하세요.': 'Select an item in the graph or list to inspect its text and revision history.', '제목': 'Title', '내용': 'Content', '분류': 'Kind', '수정 번호': 'Revision', '출처': 'Source', '원본 작업': 'Source task', '수정 일시': 'Updated', '검토 후 저장': 'Save reviewed memory', '저장하면 사용자 검토본으로 기록됩니다. 사실 여부는 직접 확인하세요.': 'Saving records a user-reviewed version. Verify the facts yourself.', '저장했습니다.': 'Saved.', '수정 이력': 'Revision history', '이전 수정 이력이 없습니다.': 'No previous revisions retained.', '작업 결과 저장': 'Capture task results', '사용자 검토·고정': 'Review and pin', '후속 작업에서 검색·재사용': 'Retrieve in later tasks', '닫기': 'Close', '생성': 'Create', '불러오는 중…': 'Loading…', '요청을 처리하지 못했습니다.': 'The request could not be completed.', '프로젝트': 'Project', '목록 {start}–{end} / {total}': 'Records {start}–{end} / {total}', '표시 좌표는 시각화용이며 저장된 기억이나 모델을 변경하지 않습니다.': 'Display positions do not change saved memories or models.', '알 수 없는 출처': 'Unknown source', '저장 중…': 'Saving…' },
    ja: { '프로젝트 지식 그래프': 'プロジェクト知識グラフ', '저장된 기억과 실제 관계를 탐색하고 검토합니다.': '保存した記憶と実際の関連を探索・確認します。', '키워드 기반 검색·재사용이며 모델 가중치를 학습하지 않습니다.': 'キーワード検索と再利用であり、モデルの重みを学習しません。', '새 기억': '記憶を作成', '새로고침': '更新', '기억 검색': '記憶を検索', '전체': 'すべて', '결정': '決定', '사실': '事実', '작업': 'タスク結果', '제약': '制約', '노트': 'ノート', '활성 기억': '有効な記憶', '실제 관계': '記録された関係', '고정 기억': '固定した記憶', '사용자 검토': 'ユーザー確認', '에이전트 미검증': 'エージェント・未検証', '키워드 관계': 'キーワード関係', '수동 관계': '手動の関係', '고정': '固定', '첫 결과나 기억이 저장되면 그래프가 만들어집니다.': '最初の結果や記憶が保存されるとグラフが生成されます。', '표시할 관계나 노드를 임의로 만들지 않습니다.': '表示のためにノードや関係を捏造しません。', '검색 조건에 맞는 기억이 없습니다.': '検索条件に合う記憶がありません。', '표시 {visible} / 검색 결과 {matches} / 전체 {total}': '表示 {visible} / 検索結果 {matches} / 全体 {total}', '관계 표시 {visible} / 해당 관계 {total}': '関係の表示 {visible} / 該当関係 {total}', '그래프는 최근 검색 결과 최대 150개를 표시합니다. 전체 기록은 검색과 목록에서 탐색할 수 있습니다.': 'グラフは最近の検索結果を最大150件表示します。検索と一覧では全件を探索できます。', '이전': '前へ', '다음': '次へ', '기억 검사기': '記憶の詳細', '기억을 선택하세요': '記憶を選択', '그래프나 목록에서 항목을 선택해 원문과 수정 이력을 확인하세요.': 'グラフまたは一覧から項目を選ぶと原文と改訂履歴を確認できます。', '제목': 'タイトル', '내용': '内容', '분류': '種類', '수정 번호': '改訂番号', '출처': '出典', '원본 작업': '元のタスク', '수정 일시': '更新日時', '검토 후 저장': '確認して保存', '저장하면 사용자 검토본으로 기록됩니다. 사실 여부는 직접 확인하세요.': '保存するとユーザー確認版として記録されます。事実はご自身で確認してください。', '저장했습니다.': '保存しました。', '수정 이력': '改訂履歴', '이전 수정 이력이 없습니다.': '保存された過去の改訂はありません。', '작업 결과 저장': 'タスク結果を保存', '사용자 검토·고정': '確認して固定', '후속 작업에서 검색·재사용': '後の作業で検索・再利用', '닫기': '閉じる', '생성': '作成', '불러오는 중…': '読み込み中…', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '프로젝트': 'プロジェクト', '목록 {start}–{end} / {total}': '一覧 {start}–{end} / {total}', '표시 좌표는 시각화용이며 저장된 기억이나 모델을 변경하지 않습니다.': '表示位置は可視化用で、保存した記憶やモデルを変更しません。', '알 수 없는 출처': '出典不明', '저장 중…': '保存中…' },
  };
  const KINDS = { decision: '결정', fact: '사실', task: '작업', constraint: '제약', note: '노트' }, PAGE_SIZE = 50, GRAPH_LIMIT = 150, EDGE_LIMIT = 1200;
  const h = (tag, attrs = {}, ...children) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') node.className = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== null && value !== false && value !== undefined) node.setAttribute(key, String(value)); } children.flat().forEach(child => { if (child !== undefined && child !== null) node.append(child instanceof Node ? child : document.createTextNode(String(child))); }); return node; };
  const sv = (tag, attrs = {}, text) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); if (text !== undefined) node.textContent = text; return node; };
  let container, callbacks = {}, state = {}, project = null, generation = 0, data = { nodes: [], edges: [], history: [], stats: {} }, selectedId = null, filter = 'all', query = '', page = 0, language = '', loaded = false, refreshTimer, lastMemoryUpdate;
  let header, metrics, search, filters, graphArea, resultsList, listFooter, inspector, message, dialog;
  const lang = () => document.documentElement.lang || state.settings?.language || 'ko';
  const tr = (key, values = {}) => (WORDS[lang()]?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  const source = node => node.confidence === 'user' ? 'user' : node.source === 'agent' || node.confidence === 'unverified' ? 'agent' : 'unknown';
  const sourceLabel = node => tr(source(node) === 'user' ? '사용자 검토' : source(node) === 'agent' ? '에이전트 미검증' : '알 수 없는 출처');
  const timestamp = value => { if (!value) return '—'; const when = new Date(value); return Number.isFinite(when.getTime()) ? when.toLocaleString(lang() === 'ko' ? 'ko-KR' : lang() === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Seoul', hour12: false }) + ' KST' : '—'; };
  const active = () => data.nodes.filter(node => !node.archived);
  const matches = () => { const needle = query.normalize('NFKC').toLocaleLowerCase(); return active().filter(node => (filter === 'all' || node.kind === filter) && (!needle || `${node.title || ''}\n${node.content || ''}\n${(node.tags || []).join(' ')}`.normalize('NFKC').toLocaleLowerCase().includes(needle))).sort((a, b) => (new Date(b.updatedAt || b.createdAt).getTime() || 0) - (new Date(a.updatedAt || a.createdAt).getTime() || 0) || String(a.id).localeCompare(String(b.id))); };
  async function api(path, method = 'GET', body, key = project) {
    if (method === 'GET') path += `${path.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(key || '')}`;
    else body = { ...body, workspace: key };
    if (callbacks.api) return callbacks.api(path, method === 'GET' ? {} : { method, body });
    const response = await fetch(path, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || tr('요청을 처리하지 못했습니다.')); return result;
  }
  function notice(text, failed = false) { if (!message) return; message.textContent = text; message.classList.toggle('ik-error', failed); }
  async function refresh() {
    if (!container || !project) return;
    clearTimeout(refreshTimer); const key = project, current = ++generation; notice(tr('불러오는 중…'));
    try { const result = await api('/api/memory', 'GET', undefined, key); if (key !== project || current !== generation) return; data = { nodes: Array.isArray(result.nodes) ? result.nodes : [], edges: Array.isArray(result.edges) ? result.edges : [], history: Array.isArray(result.history) ? result.history : [], stats: result.stats || {} }; loaded = true; if (selectedId && !data.nodes.some(node => node.id === selectedId && !node.archived)) selectedId = null; renderData(); notice(''); }
    catch (error) { if (key === project && current === generation) notice(error.message, true); }
  }
  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 70); }
  function build() {
    if (!container) return;
    language = lang();
    header = h('header', { class: 'ik-heading' }, h('div', {}, h('span', { class: 'ik-eyebrow' }, 'KNOWLEDGE / LOCAL KEYWORD RETRIEVAL'), h('h2', {}, tr('프로젝트 지식 그래프')), h('p', {}, tr('저장된 기억과 실제 관계를 탐색하고 검토합니다.'))), h('div', { class: 'ik-heading-actions' }, h('button', { type: 'button', onclick: refresh, 'data-ik-action': 'refresh' }, '↻ ', tr('새로고침')), h('button', { type: 'button', class: 'ik-primary', onclick: openCreate, 'data-ik-action': 'create' }, '+ ', tr('새 기억'))));
    metrics = h('div', { class: 'ik-metrics' });
    search = h('input', { type: 'search', placeholder: tr('기억 검색'), 'aria-label': tr('기억 검색'), value: query }); search.addEventListener('input', () => { query = search.value; page = 0; renderData(); });
    filters = h('div', { class: 'ik-filters', role: 'group', 'aria-label': tr('분류') });
    graphArea = h('div', { class: 'ik-graph-area' }); resultsList = h('div', { class: 'ik-results-list' }); listFooter = h('div', { class: 'ik-list-footer' }); inspector = h('aside', { class: 'ik-inspector', 'aria-label': tr('기억 검사기') });
    message = h('p', { class: 'ik-message', role: 'status', 'aria-live': 'polite' });
    const legend = h('div', { class: 'ik-legend' }, ...[['user', '사용자 검토'], ['agent', '에이전트 미검증'], ['pinned', '고정'], ['keyword', '키워드 관계'], ['manual', '수동 관계']].map(([kind, key]) => h('span', {}, h('i', { class: `ik-legend-${kind}`, 'aria-hidden': 'true' }), tr(key))));
    container.classList.add('ik-knowledge'); container.replaceChildren(header, metrics, h('div', { class: 'ik-explanation' }, h('strong', {}, tr('키워드 기반 검색·재사용이며 모델 가중치를 학습하지 않습니다.')), h('div', { class: 'ik-learning-flow' }, tr('작업 결과 저장'), h('span', { 'aria-hidden': 'true' }, '→'), tr('사용자 검토·고정'), h('span', { 'aria-hidden': 'true' }, '→'), tr('후속 작업에서 검색·재사용'))), h('div', { class: 'ik-searchbar' }, search, filters), h('div', { class: 'ik-body' }, h('section', { class: 'ik-network-panel', 'aria-label': tr('프로젝트 지식 그래프') }, legend, graphArea, h('div', { class: 'ik-graph-disclaimer' }, tr('그래프는 최근 검색 결과 최대 150개를 표시합니다. 전체 기록은 검색과 목록에서 탐색할 수 있습니다.')), resultsList, listFooter), inspector), message);
    renderData();
  }
  function renderData() {
    if (!container || !graphArea) return;
    const nodes = active(), ids = new Set(nodes.map(node => node.id)), edges = data.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    metrics.replaceChildren(...[['활성 기억', nodes.length], ['실제 관계', edges.length], ['고정 기억', nodes.filter(node => node.pinned).length], ['사용자 검토', nodes.filter(node => source(node) === 'user').length]].map(([key, value]) => h('div', {}, h('span', {}, tr(key)), h('strong', {}, String(value)))));
    filters.replaceChildren(...[['all', '전체'], ['decision', '결정'], ['fact', '사실'], ['task', '작업'], ['constraint', '제약'], ['note', '노트']].map(([kind, key]) => h('button', { type: 'button', class: kind === filter ? 'active' : '', 'data-kind-filter': kind, 'aria-pressed': kind === filter ? 'true' : 'false', onclick: () => { filter = kind; page = 0; renderData(); } }, tr(key))));
    drawGraph(); renderList(); renderInspector();
  }
  function layout(nodes, edges) {
    const width = 920, height = 450, points = new Map();
    nodes.forEach((node, index) => { const angle = index * 2.399963, radius = 25 + Math.sqrt(index + 1) * 21; points.set(node.id, { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius * .65, node }); });
    const values = [...points.values()];
    for (let pass = 0; pass < 48; pass++) {
      const forces = values.map(point => ({ x: (width / 2 - point.x) * .003, y: (height / 2 - point.y) * .003 }));
      for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) { const a = values[i], b = values[j], dx = a.x - b.x || .1, dy = a.y - b.y || .1, distance = Math.max(35, dx * dx + dy * dy), push = Math.min(7, 900 / distance); const length = Math.sqrt(distance); forces[i].x += dx / length * push; forces[i].y += dy / length * push; forces[j].x -= dx / length * push; forces[j].y -= dy / length * push; }
      for (const edge of edges) { const a = points.get(edge.source), b = points.get(edge.target); if (!a || !b) continue; const i = values.indexOf(a), j = values.indexOf(b), dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy)), pull = (distance - 85) * .012; forces[i].x += dx / distance * pull; forces[i].y += dy / distance * pull; forces[j].x -= dx / distance * pull; forces[j].y -= dy / distance * pull; }
      values.forEach((point, index) => { point.x = Math.max(48, Math.min(width - 48, point.x + forces[index].x)); point.y = Math.max(38, Math.min(height - 40, point.y + forces[index].y)); });
    }
    return points;
  }
  function drawGraph() {
    const filtered = matches(), shown = filtered.slice(0, GRAPH_LIMIT), ids = new Set(shown.map(node => node.id)), matchingEdges = data.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)), edges = matchingEdges.slice(0, EDGE_LIMIT);
    const counts = h('div', { class: 'ik-graph-counts' }, h('span', { 'data-ik-count': 'nodes' }, tr('표시 {visible} / 검색 결과 {matches} / 전체 {total}', { visible: shown.length, matches: filtered.length, total: active().length })), h('span', { 'data-ik-count': 'edges' }, tr('관계 표시 {visible} / 해당 관계 {total}', { visible: edges.length, total: matchingEdges.length })));
    if (!shown.length) { graphArea.replaceChildren(counts, h('div', { class: 'ik-empty' }, h('span', { 'aria-hidden': 'true' }, '⌘'), h('h3', {}, tr(active().length ? '검색 조건에 맞는 기억이 없습니다.' : '첫 결과나 기억이 저장되면 그래프가 만들어집니다.')), h('p', {}, tr('표시할 관계나 노드를 임의로 만들지 않습니다.')))); return; }
    const positions = layout(shown, edges), picture = sv('svg', { class: `ik-graph${shown.length > 45 ? ' ik-graph-dense' : ''}`, viewBox: '0 0 920 450', role: 'group', 'aria-label': tr('프로젝트 지식 그래프') });
    picture.append(sv('title', {}, tr('프로젝트 지식 그래프')), sv('desc', {}, tr('표시 좌표는 시각화용이며 저장된 기억이나 모델을 변경하지 않습니다.')));
    for (const edge of edges) { const a = positions.get(edge.source), b = positions.get(edge.target), path = sv('path', { d: `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + 10} ${(a.y + b.y) / 2 - 12} ${b.x} ${b.y}`, class: `ik-edge ${edge.provenance === 'keyword' ? 'ik-edge-keyword' : 'ik-edge-manual'}`, 'data-memory-edge': edge.id || `${edge.source}:${edge.target}` }); path.append(sv('title', {}, `${a.node.title} → ${b.node.title} · ${edge.type} · ${edge.provenance || 'user'}`)); picture.append(path); }
    for (const node of shown) {
      const point = positions.get(node.id), item = sv('g', { class: `ik-node ik-node-${source(node)}${node.pinned ? ' ik-node-pinned' : ''}${selectedId === node.id ? ' ik-node-selected' : ''}`, transform: `translate(${point.x} ${point.y})`, tabindex: '0', role: 'button', 'data-memory-node': node.id, 'aria-label': `${node.title} · ${sourceLabel(node)} · r${node.revision || 1}${node.pinned ? ` · ${tr('고정')}` : ''}` });
      item.append(sv('title', {}, `${node.title}\n${sourceLabel(node)}\nr${node.revision || 1}`)); if (node.pinned) item.append(sv('circle', { r: '13', class: 'ik-pin-ring' })); item.append(sv('circle', { r: selectedId === node.id ? '8.5' : '6.5', class: 'ik-node-dot' }), sv('text', { x: '0', y: '25', 'text-anchor': 'middle' }, [...String(node.title || '')].slice(0, 18).join('') + ([...String(node.title || '')].length > 18 ? '…' : '')));
      item.addEventListener('click', () => select(node.id)); item.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(node.id); } }); picture.append(item);
    }
    graphArea.replaceChildren(counts, picture);
  }
  function select(id) { selectedId = id; drawGraph(); renderList(); renderInspector(true); }
  function renderList() {
    const values = matches(); page = Math.min(page, Math.max(0, Math.ceil(values.length / PAGE_SIZE) - 1));
    const shown = values.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    resultsList.replaceChildren(...shown.map(node => h('button', { type: 'button', class: `ik-result${selectedId === node.id ? ' selected' : ''}`, 'data-memory-row': node.id, onclick: () => select(node.id) }, h('span', { class: 'ik-result-source', 'data-source': source(node) }, node.pinned ? '◆' : '●'), h('span', { class: 'ik-result-copy' }, h('strong', {}, node.title), h('small', {}, `${tr(KINDS[node.kind] || '노트')} · ${sourceLabel(node)} · r${node.revision || 1}`)), h('span', { class: 'ik-result-date' }, timestamp(node.updatedAt || node.createdAt).split(',')[0]))));
    listFooter.replaceChildren(h('span', {}, tr('목록 {start}–{end} / {total}', { start: values.length ? page * PAGE_SIZE + 1 : 0, end: Math.min((page + 1) * PAGE_SIZE, values.length), total: values.length })), h('div', {}, h('button', { type: 'button', disabled: page === 0, onclick: () => { page--; renderList(); } }, tr('이전')), h('button', { type: 'button', disabled: (page + 1) * PAGE_SIZE >= values.length, onclick: () => { page++; renderList(); } }, tr('다음'))));
  }
  function field(key, input) { return h('label', { class: 'ik-field' }, h('span', {}, tr(key)), input); }
  function renderInspector(force = false) {
    if (!force && inspector.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const node = active().find(value => value.id === selectedId); inspector.replaceChildren(h('div', { class: 'ik-inspector-heading' }, tr('기억 검사기')));
    if (!node) { inspector.append(h('div', { class: 'ik-inspector-empty' }, h('span', { 'aria-hidden': 'true' }, '⌕'), h('h3', {}, tr('기억을 선택하세요')), h('p', {}, tr('그래프나 목록에서 항목을 선택해 원문과 수정 이력을 확인하세요.')))); return; }
    const body = h('div', { class: 'ik-inspector-body' }, h('div', { class: 'ik-memory-badges' }, h('span', { 'data-source': source(node) }, sourceLabel(node)), ...(node.pinned ? [h('span', { class: 'ik-pinned-badge' }, tr('고정'))] : [])), h('h3', {}, node.title), h('dl', { class: 'ik-provenance' }, h('dt', {}, tr('수정 번호')), h('dd', {}, String(node.revision || 1)), h('dt', {}, tr('출처')), h('dd', {}, node.source || '—'), h('dt', {}, tr('수정 일시')), h('dd', {}, timestamp(node.updatedAt)), ...(node.sourceTaskId ? [h('dt', {}, tr('원본 작업')), h('dd', {}, node.sourceTaskId)] : [])));
    const title = h('input', { value: node.title || '', maxlength: '160', required: '', 'aria-label': tr('제목') }), content = h('textarea', { rows: '10', maxlength: '24000', required: '', 'aria-label': tr('내용') }); content.value = node.content || '';
    const kind = h('select', { 'aria-label': tr('분류') }, ...Object.entries(KINDS).map(([value, key]) => h('option', { value }, tr(key)))); kind.value = node.kind || 'note';
    const pinned = h('input', { type: 'checkbox' }); pinned.checked = Boolean(node.pinned);
    const submit = h('button', { type: 'submit', class: 'ik-primary' }, tr('검토 후 저장')), form = h('form', { class: 'ik-review-form' }, field('제목', title), field('분류', kind), field('내용', content), h('label', { class: 'ik-checkbox' }, pinned, tr('고정')), h('p', { class: 'ik-review-note' }, tr('저장하면 사용자 검토본으로 기록됩니다. 사실 여부는 직접 확인하세요.')), submit), key = project;
    form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; submit.textContent = tr('저장 중…'); try { await api(`/api/memory/${encodeURIComponent(node.id)}`, 'PATCH', { expectedRevision: node.revision, title: title.value.trim(), content: content.value.trim(), kind: kind.value, pinned: pinned.checked }, key); if (key !== project) return; await refresh(); renderInspector(true); notice(tr('저장했습니다.')); window.dispatchEvent(new CustomEvent('imperium:memory-changed')); } catch (error) { if (key === project) notice(error.message, true); } finally { submit.disabled = false; submit.textContent = tr('검토 후 저장'); } });
    const revisions = data.history.filter(entry => entry.id === node.id).sort((a, b) => b.revision - a.revision), history = h('section', { class: 'ik-history' }, h('h4', {}, tr('수정 이력')));
    if (!revisions.length) history.append(h('p', {}, tr('이전 수정 이력이 없습니다.')));
    for (const entry of revisions) history.append(h('details', { 'data-memory-revision': entry.revision }, h('summary', {}, `r${entry.revision} · ${timestamp(entry.recordedAt || entry.updatedAt)} · ${sourceLabel(entry)}`), h('strong', {}, entry.title), h('pre', {}, entry.content || '')));
    body.append(form, history); inspector.append(body);
  }
  function openCreate() {
    dialog?.remove(); const key = project, title = h('input', { required: '', maxlength: '160', 'aria-label': tr('제목') }), content = h('textarea', { rows: '7', required: '', maxlength: '24000', 'aria-label': tr('내용') }), kind = h('select', { 'aria-label': tr('분류') }, ...Object.entries(KINDS).map(([value, label]) => h('option', { value }, tr(label)))); kind.value = 'note';
    const pinned = h('input', { type: 'checkbox' }), submit = h('button', { type: 'submit', class: 'ik-primary' }, tr('생성'));
    const form = h('form', { class: 'ik-create-form' }, field('제목', title), field('분류', kind), field('내용', content), h('label', { class: 'ik-checkbox' }, pinned, tr('고정')), submit);
    form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { const result = await api('/api/memory', 'POST', { title: title.value.trim(), content: content.value.trim(), kind: kind.value, tags: [], pinned: pinned.checked }, key); if (key !== project) return; selectedId = result.node?.id || null; dialog.close(); await refresh(); window.dispatchEvent(new CustomEvent('imperium:memory-changed')); } catch (error) { if (key === project) notice(error.message, true); } finally { submit.disabled = false; } });
    dialog = h('dialog', { class: 'ik-create-dialog', 'aria-label': tr('새 기억') }, h('div', { class: 'ik-create-heading' }, h('h2', {}, tr('새 기억')), h('button', { type: 'button', 'aria-label': tr('닫기'), onclick: () => dialog.close() }, '×')), form); document.body.append(dialog); dialog.showModal();
  }
  function render(incoming) {
    state = incoming || callbacks.getState?.() || state; if (!container) return;
    if (language !== lang()) build(); const key = state.settings?.workspace;
    if (!key) { notice(tr('불러오는 중…')); return; }
    if (project !== key) { project = key; generation++; clearTimeout(refreshTimer); dialog?.close(); data = { nodes: [], edges: [], history: [], stats: {} }; selectedId = null; page = 0; loaded = false; lastMemoryUpdate = state.memoryUpdatedAt; renderData(); refresh(); }
    else if (state.memoryUpdatedAt && state.memoryUpdatedAt !== lastMemoryUpdate) { lastMemoryUpdate = state.memoryUpdatedAt; scheduleRefresh(); }
  }
  function mount(target, configuration = {}) { container = typeof target === 'string' ? document.querySelector(target) : target; callbacks = configuration; if (!container) return; state = callbacks.getState?.() || state; build(); render(state); }
  window.ImperiumKnowledge = { mount, render, reload: refresh };
  window.addEventListener('imperium:memory-changed', () => { if (container && project) scheduleRefresh(); });
})();
