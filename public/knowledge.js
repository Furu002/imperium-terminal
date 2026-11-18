(function () {
  'use strict';
  const WORDS = {
    en: { '프로젝트 지식 그래프': 'Project knowledge graph', '저장된 기억과 실제 관계를 탐색하고 검토합니다.': 'Explore and review saved memories and their actual relationships.', '키워드 기반 검색·재사용이며 모델 가중치를 학습하지 않습니다.': 'Keyword retrieval and reuse; model weights are not trained.', '새 기억': 'New memory', '새로고침': 'Refresh', '기억 검색': 'Search memories', '전체': 'All', '결정': 'Decisions', '사실': 'Facts', '작업': 'Task results', '제약': 'Constraints', '노트': 'Notes', '활성 기억': 'Active memories', '실제 관계': 'Recorded relationships', '고정 기억': 'Pinned memories', '사용자 검토': 'User reviewed', '에이전트 미검증': 'Agent unverified', '키워드 관계': 'Keyword relationship', '수동 관계': 'Manual relationship', '고정': 'Pinned', '첫 결과나 기억이 저장되면 그래프가 만들어집니다.': 'The graph appears when the first result or memory is saved.', '표시할 관계나 노드를 임의로 만들지 않습니다.': 'No nodes or relationships are invented for display.', '검색 조건에 맞는 기억이 없습니다.': 'No memories match this search.', '표시 {visible} / 검색 결과 {matches} / 전체 {total}': 'Showing {visible} / matches {matches} / total {total}', '관계 표시 {visible} / 해당 관계 {total}': 'Relationships shown {visible} / matching relationships {total}', '그래프는 최근 검색 결과 최대 150개를 표시합니다. 전체 기록은 검색과 목록에서 탐색할 수 있습니다.': 'The graph shows up to 150 recent matches. Search and the list cover all records.', '이전': 'Previous', '다음': 'Next', '기억 검사기': 'Memory inspector', '기억을 선택하세요': 'Select a memory', '그래프나 목록에서 항목을 선택해 원문과 수정 이력을 확인하세요.': 'Select an item in the graph or list to inspect its text and revision history.', '제목': 'Title', '내용': 'Content', '분류': 'Kind', '수정 번호': 'Revision', '출처': 'Source', '원본 작업': 'Source task', '수정 일시': 'Updated', '검토 후 저장': 'Save reviewed memory', '저장하면 사용자 검토본으로 기록됩니다. 사실 여부는 직접 확인하세요.': 'Saving records a user-reviewed version. Verify the facts yourself.', '저장했습니다.': 'Saved.', '수정 이력': 'Revision history', '이전 수정 이력이 없습니다.': 'No previous revisions retained.', '작업 결과 저장': 'Capture task results', '사용자 검토·고정': 'Review and pin', '후속 작업에서 검색·재사용': 'Retrieve in later tasks', '닫기': 'Close', '생성': 'Create', '불러오는 중…': 'Loading…', '요청을 처리하지 못했습니다.': 'The request could not be completed.', '프로젝트': 'Project', '목록 {start}–{end} / {total}': 'Records {start}–{end} / {total}', '표시 좌표는 시각화용이며 저장된 기억이나 모델을 변경하지 않습니다.': 'Display positions do not change saved memories or models.', '알 수 없는 출처': 'Unknown source', '저장 중…': 'Saving…' },
    ja: { '프로젝트 지식 그래프': 'プロジェクト知識グラフ', '저장된 기억과 실제 관계를 탐색하고 검토합니다.': '保存した記憶と実際の関連を探索・確認します。', '키워드 기반 검색·재사용이며 모델 가중치를 학습하지 않습니다.': 'キーワード検索と再利用であり、モデルの重みを学習しません。', '새 기억': '記憶を作成', '새로고침': '更新', '기억 검색': '記憶を検索', '전체': 'すべて', '결정': '決定', '사실': '事実', '작업': 'タスク結果', '제약': '制約', '노트': 'ノート', '활성 기억': '有効な記憶', '실제 관계': '記録された関係', '고정 기억': '固定した記憶', '사용자 검토': 'ユーザー確認', '에이전트 미검증': 'エージェント・未検証', '키워드 관계': 'キーワード関係', '수동 관계': '手動の関係', '고정': '固定', '첫 결과나 기억이 저장되면 그래프가 만들어집니다.': '最初の結果や記憶が保存されるとグラフが生成されます。', '표시할 관계나 노드를 임의로 만들지 않습니다.': '表示のためにノードや関係を捏造しません。', '검색 조건에 맞는 기억이 없습니다.': '検索条件に合う記憶がありません。', '표시 {visible} / 검색 결과 {matches} / 전체 {total}': '表示 {visible} / 検索結果 {matches} / 全体 {total}', '관계 표시 {visible} / 해당 관계 {total}': '関係の表示 {visible} / 該当関係 {total}', '그래프는 최근 검색 결과 최대 150개를 표시합니다. 전체 기록은 검색과 목록에서 탐색할 수 있습니다.': 'グラフは最近の検索結果を最大150件表示します。検索と一覧では全件を探索できます。', '이전': '前へ', '다음': '次へ', '기억 검사기': '記憶の詳細', '기억을 선택하세요': '記憶を選択', '그래프나 목록에서 항목을 선택해 원문과 수정 이력을 확인하세요.': 'グラフまたは一覧から項目を選ぶと原文と改訂履歴を確認できます。', '제목': 'タイトル', '내용': '内容', '분류': '種類', '수정 번호': '改訂番号', '출처': '出典', '원본 작업': '元のタスク', '수정 일시': '更新日時', '검토 후 저장': '確認して保存', '저장하면 사용자 검토본으로 기록됩니다. 사실 여부는 직접 확인하세요.': '保存するとユーザー確認版として記録されます。事実はご自身で確認してください。', '저장했습니다.': '保存しました。', '수정 이력': '改訂履歴', '이전 수정 이력이 없습니다.': '保存された過去の改訂はありません。', '작업 결과 저장': 'タスク結果を保存', '사용자 검토·고정': '確認して固定', '후속 작업에서 검색·재사용': '後の作業で検索・再利用', '닫기': '閉じる', '생성': '作成', '불러오는 중…': '読み込み中…', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '프로젝트': 'プロジェクト', '목록 {start}–{end} / {total}': '一覧 {start}–{end} / {total}', '표시 좌표는 시각화용이며 저장된 기억이나 모델을 변경하지 않습니다.': '表示位置は可視化用で、保存した記憶やモデルを変更しません。', '알 수 없는 출처': '出典不明', '저장 중…': '保存中…' },
  };
  Object.assign(WORDS.en, { '노트 탐색기': 'Note explorer', '전체 그래프': 'Global graph', '로컬 그래프': 'Local graph', '연결 깊이': 'Link depth', '화면 맞춤': 'Fit graph', '확대': 'Zoom in', '축소': 'Zoom out', '원문': 'Source', '읽기': 'Reading', '저장하지 않은 변경': 'Unsaved changes', '연결된 노트': 'Outgoing links', '역링크': 'Backlinks', '연결 없음': 'No links', '해결되지 않은 링크': 'Unresolved link', '같은 제목의 노트가 여러 개입니다.': 'More than one note has this title.', '일치하는 노트가 없습니다.': 'No matching note exists.', '위키 링크': 'Wiki link', '기록된 관계': 'Recorded relationships', '원본이 변경되었습니다. 초안을 보존했습니다. 저장 전에 최신 수정 이력을 확인하세요.': 'The source changed. Your draft is preserved. Check the latest revision before saving.', '노트에 [[제목]] 또는 [[제목|별칭]]을 입력해 연결하세요.': 'Connect notes with [[Title]] or [[Title|Alias]].', '노트를 선택하면 주변 연결을 표시합니다.': 'Select a note to explore its neighbors.', '드래그로 이동 · 휠로 확대 · 방향키로 이동 · 0으로 화면 맞춤': 'Drag to pan · wheel to zoom · arrow keys to pan · 0 to fit', '제목 없는 노트': 'Untitled note', '변경 없음': 'No changes', '파일': 'Files' });
  Object.assign(WORDS.ja, { '노트 탐색기': 'ノート一覧', '전체 그래프': '全体グラフ', '로컬 그래프': 'ローカルグラフ', '연결 깊이': 'リンクの深さ', '화면 맞춤': '全体表示', '확대': '拡大', '축소': '縮小', '원문': '原文', '읽기': '閲覧', '저장하지 않은 변경': '未保存の変更', '연결된 노트': '発リンク', '역링크': 'バックリンク', '연결 없음': 'リンクなし', '해결되지 않은 링크': '未解決のリンク', '같은 제목의 노트가 여러 개입니다.': '同じタイトルのノートが複数あります。', '일치하는 노트가 없습니다.': '一致するノートがありません。', '위키 링크': 'Wikiリンク', '기록된 관계': '記録された関係', '원본이 변경되었습니다. 초안을 보존했습니다. 저장 전에 최신 수정 이력을 확인하세요.': '原文が変更されました。下書きを保持しています。保存前に最新の改訂を確認してください。', '노트에 [[제목]] 또는 [[제목|별칭]]을 입력해 연결하세요.': '[[タイトル]] または [[タイトル|別名]] でノートをつなぎます。', '노트를 선택하면 주변 연결을 표시합니다.': 'ノートを選ぶと周囲のリンクを表示します。', '드래그로 이동 · 휠로 확대 · 방향키로 이동 · 0으로 화면 맞춤': 'ドラッグで移動 · ホイールで拡縮 · 矢印で移動 · 0で全体表示', '제목 없는 노트': '無題のノート', '변경 없음': '変更なし', '파일': 'ファイル' });
  Object.assign(WORDS.en, { '최신 기록 불러오기 (내 초안 취소)': 'Reload latest (discard my draft)', '최신 수정본 기준으로 내 초안 유지': 'Keep my draft on the latest revision', '초안을 최신 수정 번호에 맞췄습니다. 검토 후 저장해야 적용됩니다.': 'Your draft now uses the latest revision. Review and save to apply it.', '최신 기록을 불러왔습니다.': 'Latest saved note loaded.' });
  Object.assign(WORDS.ja, { '최신 기록 불러오기 (내 초안 취소)': '最新を読み込む（下書きを破棄）', '최신 수정본 기준으로 내 초안 유지': '最新の改訂を基に下書きを保持', '초안을 최신 수정 번호에 맞췄습니다. 검토 후 저장해야 적용됩니다.': '下書きの改訂番号を更新しました。反映するには確認して保存してください。', '최신 기록을 불러왔습니다.': '最新の保存済みノートを読み込みました。' });
  Object.assign(WORDS.en, { '최신 저장본 보기': 'Compare latest saved note', '복구 가능한 초안': 'Recoverable drafts', '원본 노트가 삭제되거나 보관되었습니다. 초안은 유지했습니다.': 'The original note was deleted or archived. Your draft is preserved.', '초안 내용을 선택해 복사하거나 새 노트로 작성할 수 있습니다.': 'Select and copy this draft, or create a new note from it.', '이 초안으로 새 노트 작성': 'Create a new note from this draft', '고정 안 함': 'Not pinned', '요청이 충돌했습니다. 초안을 유지했습니다. 잠시 후 다시 저장하세요.': 'The request conflicted. Your draft is preserved. Try saving again shortly.' });
  Object.assign(WORDS.ja, { '최신 저장본 보기': '最新の保存内容と比較', '복구 가능한 초안': '復元できる下書き', '원본 노트가 삭제되거나 보관되었습니다. 초안은 유지했습니다.': '元のノートが削除または保管されました。下書きは保持しています。', '초안 내용을 선택해 복사하거나 새 노트로 작성할 수 있습니다.': '下書きを選択してコピーするか、新しいノートを作成できます。', '이 초안으로 새 노트 작성': 'この下書きから新規ノートを作成', '고정 안 함': '固定なし', '요청이 충돌했습니다. 초안을 유지했습니다. 잠시 후 다시 저장하세요.': 'リクエストが競合しました。下書きは保持しています。少し待ってから再度保存してください。' });
  Object.assign(WORDS.en, { '최신 저장본을 확인하지 못했습니다. 새로고침 후 비교하세요.': 'The latest saved note could not be checked. Refresh before comparing.' });
  Object.assign(WORDS.ja, { '최신 저장본을 확인하지 못했습니다. 새로고침 후 비교하세요.': '最新の保存内容を確認できませんでした。更新してから比較してください。' });
  Object.assign(WORDS.en, { '노드와 관계 목록': 'Nodes and relationships', '그래프 엔진을 불러오지 못했습니다. 아래 노드와 관계 목록을 이용하세요.': 'The graph engine could not be loaded. Use the nodes and relationships list below.' });
  Object.assign(WORDS.ja, { '노드와 관계 목록': 'ノードと関係の一覧', '그래프 엔진을 불러오지 못했습니다. 아래 노드와 관계 목록을 이용하세요.': 'グラフエンジンを読み込めませんでした。下のノードと関係の一覧を利用してください。' });
  Object.assign(WORDS.en, { '자연 배열': 'Natural layout', '배열 엔진을 사용할 수 없습니다. 앱을 새로고침한 뒤 다시 시도하세요.': 'The layout engine is unavailable. Reload the app and try again.', '기억 보관': 'Archive memory', '기억 복원': 'Restore memory', '보관함': 'Archive', '보관됨': 'Archived', '취소': 'Cancel', '기억을 보관했습니다.': 'Memory archived.', '기억을 복원했습니다.': 'Memory restored.', '보관한 기억은 그래프와 AI 검색에서 제외되며 보관함에서 복원할 수 있습니다.': 'Archived memories leave the graph and AI retrieval. Restore them from Archive.', '저장하지 않은 초안은 복구 가능한 초안에 그대로 보존됩니다.': 'Unsaved edits stay in Recoverable drafts.', '보관한 기억을 복원하면 그래프와 AI 검색에 다시 포함됩니다.': 'Restoring includes this memory in the graph and AI retrieval again.', '현재 저장본만 변경합니다.': 'This action changes only the saved note.', '변경 요청을 처리하지 못했습니다. 최신 기록을 확인하고 다시 시도하세요.': 'The change could not be applied. Check the latest record and try again.', '관계 해제': 'Unlink', '수동 관계를 해제합니다. 두 기억과 원문은 보존됩니다.': 'Remove this manual relationship. Both notes and their text are kept.', '수동 관계를 해제했습니다.': 'Manual relationship removed.', '위키 링크는 원문의 [[링크]]를 수정해 해제하세요.': 'Remove wiki links by editing [[links]] in the note text.', '키워드 관계는 내용에서 자동으로 계산됩니다.': 'Keyword relationships are derived automatically from note content.' });
  Object.assign(WORDS.ja, { '자연 배열': '自然に配置', '배열 엔진을 사용할 수 없습니다. 앱을 새로고침한 뒤 다시 시도하세요.': '配置エンジンを利用できません。アプリを再読み込みしてください。', '기억 보관': '記憶を保管', '기억 복원': '記憶を復元', '보관함': '保管庫', '보관됨': '保管済み', '취소': 'キャンセル', '기억을 보관했습니다.': '記憶を保管しました。', '기억을 복원했습니다.': '記憶を復元しました。', '보관한 기억은 그래프와 AI 검색에서 제외되며 보관함에서 복원할 수 있습니다.': '保管した記憶はグラフとAI検索から除外され、保管庫から復元できます。', '저장하지 않은 초안은 복구 가능한 초안에 그대로 보존됩니다.': '未保存の編集は復旧できる下書きに保持されます。', '보관한 기억을 복원하면 그래프와 AI 검색에 다시 포함됩니다.': '復元した記憶はグラフとAI検索に再び含まれます。', '현재 저장본만 변경합니다.': '現在の保存済みノートのみを変更します。', '변경 요청을 처리하지 못했습니다. 최신 기록을 확인하고 다시 시도하세요.': '変更できませんでした。最新の記録を確認してください。', '관계 해제': '関係を解除', '수동 관계를 해제합니다. 두 기억과 원문은 보존됩니다.': '手動の関係を解除します。両方の記憶と本文は保持されます。', '수동 관계를 해제했습니다.': '手動の関係を解除しました。', '위키 링크는 원문의 [[링크]]를 수정해 해제하세요.': 'ウィキリンクは本文の[[リンク]]を編集して解除してください。', '키워드 관계는 내용에서 자동으로 계산됩니다.': 'キーワードの関係は本文から自動的に計算されます。' });
  const KINDS = { decision: '결정', fact: '사실', task: '작업', constraint: '제약', note: '노트' }, PAGE_SIZE = 50, GRAPH_LIMIT = 150, EDGE_LIMIT = 1200;
  const h = (tag, attrs = {}, ...children) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') node.className = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== null && value !== false && value !== undefined) node.setAttribute(key, String(value)); } children.flat().forEach(child => { if (child !== undefined && child !== null) node.append(child instanceof Node ? child : document.createTextNode(String(child))); }); return node; };
  let container, callbacks = {}, state = {}, project = null, generation = 0, data = { nodes: [], edges: [], history: [], stats: {} }, selectedId = null, filter = 'all', query = '', page = 0, language = '', refreshTimer, lastMemoryUpdate;
  let metrics, search, filters, graphArea, graphControls, resultsList, orphanList, listFooter, inspector, message, dialog, editorFields, actionDialog;
  const pendingActions = new Set();
  let graphMode = 'all', depth = 1, editorMode = 'source', graphRenderer, graphView, graphEpoch = 0;
  const drafts = new Map();
  let indexedNodes, titleIndex;
  const lang = () => document.documentElement.lang || state.settings?.language || 'ko';
  const tr = (key, values = {}) => (WORDS[lang()]?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  const source = node => node.confidence === 'user' ? 'user' : node.source === 'agent' || node.confidence === 'unverified' ? 'agent' : 'unknown';
  const sourceLabel = node => tr(source(node) === 'user' ? '사용자 검토' : source(node) === 'agent' ? '에이전트 미검증' : '알 수 없는 출처');
  const titleKey = value => String(value || '').trim().normalize('NFKC').toLowerCase();
  const timestamp = value => { if (!value) return '—'; const when = new Date(value); return Number.isFinite(when.getTime()) ? when.toLocaleString(lang() === 'ko' ? 'ko-KR' : lang() === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Seoul', hour12: false }) + ' KST' : '—'; };
  const active = () => data.nodes.filter(node => !node.archived);
  const orphanDrafts = () => { const ids = new Set(active().map(node => node.id)); return [...(drafts.get(project) || [])].filter(([id, draft]) => !ids.has(id) && (draft.dirty || draft.saving)); };
  const actualEdges = () => { const ids = new Set(active().map(node => node.id)); return data.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)); };
  const matches = () => { const needle = titleKey(query); return data.nodes.filter(node => (filter === 'archived' ? node.archived : !node.archived && (filter === 'all' || node.kind === filter)) && (!needle || titleKey(`${node.title || ''}\n${node.content || ''}\n${(node.tags || []).join(' ')}`).includes(needle))).sort((a, b) => (new Date(b.updatedAt || b.createdAt).getTime() || 0) - (new Date(a.updatedAt || a.createdAt).getTime() || 0) || String(a.id).localeCompare(String(b.id))); };
  function values(node) { return { title: node.title || '', content: node.content || '', kind: node.kind || 'note', pinned: Boolean(node.pinned) }; }
  function draftFor(node) {
    if (!drafts.has(project)) drafts.set(project, new Map());
    const projectDrafts = drafts.get(project); let draft = projectDrafts.get(node.id);
    if (!draft || !draft.dirty && !draft.saving && draft.revision !== node.revision) { const baseline = values(node); draft = { ...baseline, baseline, revision: node.revision, dirty: false, saving: false, version: 0 }; projectDrafts.set(node.id, draft); }
    return draft;
  }
  function captureDraft() {
    if (!editorFields || editorFields.project !== project) return;
    const { draft, title, content, kind, pinned } = editorFields;
    const next = { title: title.value, content: content.value, kind: kind.value, pinned: pinned.checked };
    if (JSON.stringify(next) !== JSON.stringify(values(draft))) draft.version++;
    Object.assign(draft, next); draft.dirty = JSON.stringify(next) !== JSON.stringify(draft.baseline);
  }
  async function api(path, method = 'GET', body, key = project) {
    if (method === 'GET') path += `${path.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(key || '')}`; else body = { ...body, workspace: key };
    if (callbacks.api) return callbacks.api(path, method === 'GET' ? {} : { method, body });
    const response = await fetch(path, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw Object.assign(new Error(result.error || tr('요청을 처리하지 못했습니다.')), { status: response.status }); return result;
  }
  function notice(text, failed = false) { if (!message) return; message.textContent = text; message.classList.toggle('ik-error', failed); }
  async function refresh() {
    if (!container || !project) return false;
    captureDraft(); clearTimeout(refreshTimer); const key = project, current = ++generation; notice(tr('불러오는 중…'));
    try { const result = await api('/api/memory', 'GET', undefined, key); if (key !== project || current !== generation) return false; captureDraft(); data = { nodes: Array.isArray(result.nodes) ? result.nodes : [], edges: Array.isArray(result.edges) ? result.edges : [], history: Array.isArray(result.history) ? result.history : [], stats: result.stats || {} }; for (const node of active()) { const draft = drafts.get(project)?.get(node.id); if (draft?.conflict && draft.revision === node.revision) draft.conflict = false; } if (selectedId && !data.nodes.some(node => node.id === selectedId) && !orphanDrafts().some(([id]) => id === selectedId)) { selectedId = null; editorFields = null; } renderData(); notice(''); return true; }
    catch (error) { if (key === project && current === generation) notice(error.message, true); return false; }
  }
  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 70); }
  const button = (label, action, attrs = {}) => h('button', { type: 'button', ...attrs, onclick: action }, tr(label));
  function closeActionDialog() { actionDialog?.close(); actionDialog?.remove(); actionDialog = null; }
  function confirmAction(title, name, explanation, commit) {
    closeActionDialog(); const key = project;
    const error = h('p', { class: 'ik-action-error', role: 'alert' });
    const modal = h('dialog', { class: 'ik-action-dialog', 'aria-label': tr(title) }, h('h2', {}, tr(title)), h('strong', { class: 'ik-action-name' }, name), h('p', {}, tr(explanation)), h('p', {}, tr('현재 저장본만 변경합니다.')), error);
    const submit = button(title, async () => {
      if (project !== key || !modal.isConnected || !modal.open || submit.disabled) return;
      submit.disabled = true; cancel.disabled = true;
      try { await commit(key); if (project === key && actionDialog === modal) closeActionDialog(); }
      catch (failure) { if (project === key && actionDialog === modal) error.textContent = failure.message || tr('변경 요청을 처리하지 못했습니다. 최신 기록을 확인하고 다시 시도하세요.'); }
      finally { submit.disabled = false; cancel.disabled = false; }
    }, { class: 'ik-primary', 'data-ik-confirm': '' });
    const cancel = button('취소', closeActionDialog, { 'data-ik-cancel': '' });
    modal.append(h('div', { class: 'ik-action-buttons' }, cancel, submit));
    actionDialog = modal; document.body.append(modal); modal.showModal(); cancel.focus();
  }
  function archiveNote(node, archived) {
    captureDraft(); const draft = drafts.get(project)?.get(node.id);
    if (draft?.saving || pendingActions.has(node.id)) return;
    const explanation = archived ? '보관한 기억은 그래프와 AI 검색에서 제외되며 보관함에서 복원할 수 있습니다.' : '보관한 기억을 복원하면 그래프와 AI 검색에 다시 포함됩니다.';
    confirmAction(archived ? '기억 보관' : '기억 복원', node.title, explanation, async key => {
      pendingActions.add(node.id);
      try {
        const result = await api(`/api/memory/${encodeURIComponent(node.id)}`, 'PATCH', { expectedRevision: node.revision, archived }, key);
        if (project !== key) return;
        if (result.node?.archived !== archived) throw new Error(tr('변경 요청을 처리하지 못했습니다. 최신 기록을 확인하고 다시 시도하세요.'));
        graphRenderer?.cancelLayout(); if (!archived) filter = 'all';
        await refresh(); if (project !== key) return;
        notice(tr(archived ? '기억을 보관했습니다.' : '기억을 복원했습니다.'));
        window.dispatchEvent(new CustomEvent('imperium:memory-changed'));
      } finally { pendingActions.delete(node.id); }
    });
    if (draft?.dirty) actionDialog?.querySelector('.ik-action-buttons')?.before(h('p', { class: 'ik-action-draft-note' }, tr('저장하지 않은 초안은 복구 가능한 초안에 그대로 보존됩니다.')));
  }
  function unlink(edge) {
    captureDraft(); const source = active().find(node => node.id === edge.source), target = active().find(node => node.id === edge.target);
    if (!source || !target || edge.provenance && edge.provenance !== 'user') return;
    confirmAction('관계 해제', `${source.title} → ${target.title}`, '수동 관계를 해제합니다. 두 기억과 원문은 보존됩니다.', async key => {
      await api(`/api/memory/links/${encodeURIComponent(edge.id)}`, 'DELETE', { expectedSourceRevision: source.revision, expectedTargetRevision: target.revision }, key);
      if (project !== key) return; graphRenderer?.cancelLayout(); await refresh();
      if (project === key) { notice(tr('수동 관계를 해제했습니다.')); window.dispatchEvent(new CustomEvent('imperium:memory-changed')); }
    });
  }
  function build() {
    if (!container) return;
    captureDraft(); closeActionDialog(); destroyGraph(); editorFields = null; language = lang();
    const heading = h('header', { class: 'ik-heading' }, h('div', {}, h('span', { class: 'ik-eyebrow' }, 'PROJECT / KNOWLEDGE VAULT'), h('h2', {}, tr('프로젝트 지식 그래프'))), h('div', { class: 'ik-heading-actions' }, button('새로고침', refresh, { 'data-ik-action': 'refresh' }), button('새 기억', openCreate, { class: 'ik-primary', 'data-ik-action': 'create' })));
    search = h('input', { type: 'search', placeholder: tr('기억 검색'), 'aria-label': tr('기억 검색'), value: query }); search.addEventListener('input', () => { captureDraft(); query = search.value; page = 0; renderData(); });
    filters = h('div', { class: 'ik-filters', role: 'group', 'aria-label': tr('분류') }); resultsList = h('div', { class: 'ik-results-list' }); orphanList = h('section', { class: 'ik-orphan-drafts', style: 'max-height:180px;overflow:auto;flex-shrink:0', 'aria-label': tr('복구 가능한 초안') }); listFooter = h('div', { class: 'ik-list-footer' });
    const explorer = h('aside', { class: 'ik-explorer', 'aria-label': tr('노트 탐색기') }, h('div', { class: 'ik-panel-label' }, '▱ ', tr('노트 탐색기')), h('div', { class: 'ik-project-label', title: project || state.settings?.workspace || '' }, String(project || state.settings?.workspace || '').split(/[\\/]/).filter(Boolean).at(-1) || tr('프로젝트')), h('div', { class: 'ik-searchbar' }, search), filters, h('div', { class: 'ik-files-label' }, tr('파일')), resultsList, orphanList, listFooter);
    graphControls = h('div', { class: 'ik-graph-controls' }); graphArea = h('div', { class: 'ik-graph-area' });
    const legend = h('div', { class: 'ik-legend' }, ...[['user', '사용자 검토'], ['agent', '에이전트 미검증'], ['pinned', '고정'], ['wiki', '위키 링크'], ['keyword', '키워드 관계'], ['manual', '수동 관계']].map(([kind, key]) => h('span', {}, h('i', { class: `ik-legend-${kind}`, 'aria-hidden': 'true' }), tr(key))));
    const network = h('section', { class: 'ik-network-panel', 'aria-label': tr('프로젝트 지식 그래프') }, graphControls, graphArea, legend, h('p', { class: 'ik-graph-disclaimer' }, tr('그래프는 최근 검색 결과 최대 150개를 표시합니다. 전체 기록은 검색과 목록에서 탐색할 수 있습니다.')));
    inspector = h('aside', { class: 'ik-inspector', 'aria-label': tr('기억 검사기') }); metrics = h('div', { class: 'ik-metrics' }); message = h('p', { class: 'ik-message', role: 'status', 'aria-live': 'polite' });
    container.classList.add('ik-knowledge'); container.replaceChildren(heading, h('div', { class: 'ik-explanation' }, tr('키워드 기반 검색·재사용이며 모델 가중치를 학습하지 않습니다.')), h('div', { class: 'ik-body' }, explorer, network, inspector), h('footer', { class: 'ik-statusbar' }, metrics, message)); renderData();
  }
  function renderData() {
    if (!container || !graphArea) return;
    captureDraft(); const nodes = active(), edges = actualEdges();
    metrics.replaceChildren(...[['활성 기억', nodes.length], ['실제 관계', edges.length], ['고정 기억', nodes.filter(node => node.pinned).length], ['사용자 검토', nodes.filter(node => source(node) === 'user').length]].map(([key, value]) => h('span', {}, tr(key), ' ', h('strong', {}, String(value)))));
    filters.replaceChildren(...[['all', '전체'], ...Object.entries(KINDS), ['archived', '보관함']].map(([kind, key]) => button(key, () => { captureDraft(); filter = kind; page = 0; renderData(); }, { class: kind === filter ? 'active' : '', 'data-kind-filter': kind, 'aria-pressed': String(kind === filter) })));
    renderGraphControls(); drawGraph(); renderList(); renderInspector();
  }
  function renderGraphControls() {
    graphControls.replaceChildren(h('div', { class: 'ik-view-tabs' }, ...[['all', '전체 그래프'], ['local', '로컬 그래프']].map(([mode, label]) => button(label, () => { graphMode = mode; renderGraphControls(); drawGraph(true); }, { class: graphMode === mode ? 'active' : '', 'data-ik-graph-mode': mode, 'aria-pressed': String(graphMode === mode) }))), h('div', { class: 'ik-graph-tools' }, h('span', {}, tr('연결 깊이')), ...[1, 2].map(value => button(String(value), () => { depth = value; renderGraphControls(); drawGraph(true); }, { class: depth === value ? 'active' : '', disabled: graphMode !== 'local', 'data-ik-depth': value, 'aria-label': `${tr('연결 깊이')} ${value}` })), button('축소', () => graphRenderer?.zoomBy(.8), { 'data-ik-zoom': 'out', title: tr('축소') }), button('확대', () => graphRenderer?.zoomBy(1.25), { 'data-ik-zoom': 'in', title: tr('확대') }), button('화면 맞춤', () => graphRenderer?.fit(), { 'data-ik-zoom': 'fit' }), button('자연 배열', () => { try { if (!graphRenderer) throw new Error('No graph engine'); graphRenderer.arrange(); } catch { notice(tr('배열 엔진을 사용할 수 없습니다. 앱을 새로고침한 뒤 다시 시도하세요.'), true); } }, { 'data-ik-action': 'arrange', disabled: !graphNodes().length })));
  }
  function graphNodes() {
    if (filter === 'archived') return [];
    if (graphMode !== 'local') return matches();
    const nodes = active(), ids = new Set(nodes.map(node => node.id)); if (!ids.has(selectedId)) return [];
    const adjacency = new Map(); for (const edge of actualEdges()) { if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set()); if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set()); adjacency.get(edge.source).add(edge.target); adjacency.get(edge.target).add(edge.source); }
    const included = new Set([selectedId]); let frontier = [selectedId];
    for (let level = 0; level < depth; level++) { const next = []; for (const id of frontier) for (const other of adjacency.get(id) || []) if (!included.has(other)) { included.add(other); next.push(other); } frontier = next; }
    return [nodes.find(node => node.id === selectedId), ...nodes.filter(node => node.id !== selectedId && included.has(node.id))];
  }
  function destroyGraph() { graphRenderer?.destroy(); graphRenderer = null; graphView = null; graphEpoch++; }
  function drawGraph(fit = false) {
    const filtered = graphNodes(), shown = filtered.slice(0, GRAPH_LIMIT), ids = new Set(shown.map(node => node.id)), matchingEdges = actualEdges().filter(edge => ids.has(edge.source) && ids.has(edge.target)), edges = matchingEdges.slice(0, EDGE_LIMIT);
    if (!graphView) {
      const counts = h('div', { class: 'ik-graph-counts' }), host = h('div', { class: 'ik-cytoscape', tabindex: '0', role: 'group', 'aria-label': tr('프로젝트 지식 그래프') });
      const surface = h('div', { class: 'ik-graph-surface' }, host), status = h('p', { class: 'ik-graph-unavailable', role: 'status', hidden: true });
      const list = h('ul', { class: 'ik-graph-node-list' }), relations = h('ul', { class: 'ik-graph-relation-list' });
      const accessible = h('details', { class: 'ik-graph-accessibility' }, h('summary', {}, tr('노드와 관계 목록')), list, relations);
      const empty = h('div', { class: 'ik-empty' }), hint = h('span', { class: 'ik-graph-hint' }, tr('드래그로 이동 · 휠로 확대 · 방향키로 이동 · 0으로 화면 맞춤'));
      graphView = { counts, host, surface, status, list, relations, accessible, empty };
      graphArea.replaceChildren(counts, surface, status, accessible, empty, hint);
    }
    const view = graphView;
    view.counts.replaceChildren(h('span', { 'data-ik-count': 'nodes' }, tr('표시 {visible} / 검색 결과 {matches} / 전체 {total}', { visible: shown.length, matches: filtered.length, total: active().length })), h('span', { 'data-ik-count': 'edges' }, tr('관계 표시 {visible} / 해당 관계 {total}', { visible: edges.length, total: matchingEdges.length })));
    view.empty.hidden = Boolean(shown.length); view.surface.hidden = !shown.length; view.accessible.hidden = !shown.length;
    if (!shown.length) {
      graphRenderer?.update({ nodes: [], edges: [] }); view.list.replaceChildren(); view.relations.replaceChildren(); view.status.hidden = true;
      view.empty.replaceChildren(h('span', { 'aria-hidden': 'true' }, '◇'), h('h3', {}, tr(filter === 'archived' ? '보관한 기억은 그래프와 AI 검색에서 제외되며 보관함에서 복원할 수 있습니다.' : graphMode === 'local' ? '노트를 선택하면 주변 연결을 표시합니다.' : active().length ? '검색 조건에 맞는 기억이 없습니다.' : '첫 결과나 기억이 저장되면 그래프가 만들어집니다.')), h('p', {}, tr('표시할 관계나 노드를 임의로 만들지 않습니다.'))); return;
    }
    if (!graphRenderer) {
      const key = project, epoch = graphEpoch;
      try {
        if (!window.ImperiumKnowledgeGraph) throw new Error('Cytoscape.js is unavailable');
        graphRenderer = window.ImperiumKnowledgeGraph.create(view.host, { cytoscapeFactory: callbacks.cytoscapeFactory, onSelect: id => { if (container?.isConnected && project === key && graphEpoch === epoch) select(id); } });
        view.status.hidden = true;
      } catch { view.status.hidden = false; view.status.textContent = tr('그래프 엔진을 불러오지 못했습니다. 아래 노드와 관계 목록을 이용하세요.'); }
    }
    graphRenderer?.update({ nodes: shown, edges, selectedId, fit });
    const key = project, epoch = graphEpoch, nodeElements = new Map(), edgeElements = [], titles = new Map(shown.map(node => [node.id, node.title]));
    const highlight = id => {
      if (project !== key || graphEpoch !== epoch) return;
      graphRenderer?.highlight(id);
      const neighbors = new Set([id]); for (const { edge } of edgeElements) if (edge.source === id || edge.target === id) { neighbors.add(edge.source); neighbors.add(edge.target); }
      for (const [nodeId, element] of nodeElements) element.classList.toggle('ik-muted', Boolean(id) && !neighbors.has(nodeId));
      for (const { edge, item } of edgeElements) { const connected = edge.source === id || edge.target === id; item.classList.toggle('ik-muted', Boolean(id) && !connected); item.classList.toggle('ik-edge-highlight', Boolean(id) && connected); }
    };
    view.list.replaceChildren(...shown.map(node => {
      const item = h('button', { type: 'button', onclick: () => { if (project === key && graphEpoch === epoch) select(node.id); }, class: `ik-node ik-node-${source(node)}${node.pinned ? ' ik-node-pinned' : ''}${selectedId === node.id ? ' ik-node-selected' : ''}`, 'data-memory-node': node.id, 'aria-pressed': String(selectedId === node.id), 'aria-label': `${node.title} · ${sourceLabel(node)} · r${node.revision || 1}${node.pinned ? ` · ${tr('고정')}` : ''}` }, node.title || tr('제목 없는 노트'));
      item.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); item.click(); } });
      item.addEventListener('mouseenter', () => highlight(node.id)); item.addEventListener('mouseleave', () => highlight(null)); item.addEventListener('focus', () => highlight(node.id)); item.addEventListener('blur', () => highlight(null)); nodeElements.set(node.id, item); return h('li', {}, item);
    }));
    view.relations.replaceChildren(...edges.map(edge => {
      const provenance = edge.provenance === 'keyword' ? 'keyword' : edge.provenance === 'wikilink' ? 'wiki' : 'manual';
      const item = h('li', { class: `ik-edge ik-edge-${provenance}`, 'data-memory-edge': edge.id || `${edge.source}:${edge.target}`, 'data-edge-provenance': edge.provenance || 'user' }, `${titles.get(edge.source)} → ${titles.get(edge.target)} · ${edge.type || ''} · ${tr(provenance === 'wiki' ? '위키 링크' : provenance === 'keyword' ? '키워드 관계' : '수동 관계')}`); edgeElements.push({ edge, item }); return item;
    }));
  }
  function select(id) { if (!data.nodes.some(node => node.id === id) && !orphanDrafts().some(([orphanId]) => orphanId === id)) return; captureDraft(); selectedId = id; editorFields = null; drawGraph(graphMode === 'local'); renderList(); renderInspector(true); }
  function renderList() {
    const records = matches(); page = Math.min(page, Math.max(0, Math.ceil(records.length / PAGE_SIZE) - 1)); const shown = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    resultsList.replaceChildren(...shown.map(node => h('button', { type: 'button', class: `ik-result${selectedId === node.id ? ' selected' : ''}`, 'data-memory-row': node.id, 'aria-pressed': String(selectedId === node.id), onclick: () => select(node.id) }, h('span', { class: 'ik-result-source', 'data-source': source(node) }, node.pinned ? '◆' : '◌'), h('span', { class: 'ik-result-copy' }, h('strong', {}, node.title || tr('제목 없는 노트')), h('small', {}, `${tr(KINDS[node.kind] || '노트')} · r${node.revision || 1}`)))));
    const orphans = orphanDrafts(); orphanList.hidden = !orphans.length;
    orphanList.replaceChildren(...(orphans.length ? [h('div', { class: 'ik-files-label' }, tr('복구 가능한 초안')), ...orphans.map(([id, draft]) => h('button', { type: 'button', class: `ik-result${selectedId === id ? ' selected' : ''}`, 'data-orphan-draft': id, onclick: () => select(id) }, h('span', { class: 'ik-result-copy' }, h('strong', {}, draft.title || tr('제목 없는 노트')), h('small', {}, tr('저장하지 않은 변경')))))] : []));
    listFooter.replaceChildren(h('span', {}, tr('목록 {start}–{end} / {total}', { start: records.length ? page * PAGE_SIZE + 1 : 0, end: Math.min((page + 1) * PAGE_SIZE, records.length), total: records.length })), h('div', {}, button('이전', () => { page--; renderList(); }, { disabled: page === 0 }), button('다음', () => { page++; renderList(); }, { disabled: (page + 1) * PAGE_SIZE >= records.length })));
  }
  function wikiReferences(text) {
    if (indexedNodes !== data.nodes) { indexedNodes = data.nodes; titleIndex = new Map(); for (const node of active()) { const key = titleKey(node.title); if (!titleIndex.has(key)) titleIndex.set(key, []); titleIndex.get(key).push(node); } }
    const refs = []; let count = 0;
    for (const match of String(text || '').matchAll(/\[\[([^\[\]\r\n]+)\]\]/g)) { if (++count > 128) break; const [rawTitle, ...alias] = match[1].split('|'), title = rawTitle.trim(); if (!title || title.length > 160) continue; const targets = titleIndex.get(titleKey(title)) || []; refs.push({ index: match.index, raw: match[0], title, label: alias.join('|').trim() || title, target: targets.length === 1 ? targets[0] : null, ambiguous: targets.length > 1 }); }
    return refs;
  }
  function wikiButton(ref) { return h('button', { type: 'button', class: `ik-wiki-link${ref.target ? '' : ' ik-unresolved'}`, 'data-wiki-target': ref.target?.id || '', 'data-wiki-unresolved': ref.target ? undefined : 'true', title: ref.target ? ref.title : `${tr('해결되지 않은 링크')} · ${tr(ref.ambiguous ? '같은 제목의 노트가 여러 개입니다.' : '일치하는 노트가 없습니다.')}`, disabled: !ref.target, onclick: () => { if (ref.target) select(ref.target.id); } }, ref.label, ...(ref.target ? [] : [h('span', { 'aria-hidden': 'true' }, ' ?')])); }
  function inlineMarkdown(target, text) {
    const refs = wikiReferences(text); let position = 0;
    const appendPlain = value => { let cursor = 0; const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g; for (const match of value.matchAll(pattern)) { target.append(document.createTextNode(value.slice(cursor, match.index))); target.append(h(match[0].startsWith('`') ? 'code' : 'strong', {}, match[0].slice(match[0].startsWith('`') ? 1 : 2, match[0].startsWith('`') ? -1 : -2))); cursor = match.index + match[0].length; } target.append(document.createTextNode(value.slice(cursor))); };
    for (const ref of refs) { appendPlain(text.slice(position, ref.index)); target.append(wikiButton(ref)); position = ref.index + ref.raw.length; } appendPlain(text.slice(position));
  }
  function markdown(text) {
    const view = h('article', { class: 'ik-markdown', 'data-ik-reading': '' }); let code = null;
    for (const line of String(text || '').split('\n')) { if (/^\s*```/.test(line)) { if (code) code = null; else { code = h('code'); view.append(h('pre', {}, code)); } continue; } if (code) { code.append(document.createTextNode(`${line}\n`)); continue; } const heading = line.match(/^(#{1,6})\s+(.+)$/), bullet = line.match(/^\s*[-*]\s+(.+)$/), quote = line.match(/^>\s?(.*)$/), element = h(heading ? `h${heading[1].length}` : quote ? 'blockquote' : 'p', { class: bullet ? 'ik-markdown-bullet' : '' }); inlineMarkdown(element, heading ? heading[2] : bullet ? `• ${bullet[1]}` : quote ? quote[1] : line || ' '); view.append(element); } return view;
  }
  function connections(node, draft) {
    const outgoing = h('section', { class: 'ik-note-links', 'data-ik-links': 'outgoing' }, h('h4', {}, tr('연결된 노트'))), refs = wikiReferences(draft.content), unique = new Set();
    for (const ref of refs) { const key = titleKey(ref.title); if (unique.has(key)) continue; unique.add(key); outgoing.append(wikiButton(ref)); }
    if (!unique.size) outgoing.append(h('p', {}, tr('연결 없음')));
    const neighborIds = new Set(); for (const edge of actualEdges()) { if (edge.source === node.id) neighborIds.add(edge.target); if (edge.target === node.id) neighborIds.add(edge.source); }
    const incoming = h('section', { class: 'ik-note-links', 'data-ik-links': 'backlinks' }, h('h4', {}, tr('역링크'))), backlinks = active().filter(other => other.id !== node.id && neighborIds.has(other.id) && wikiReferences(other.content).some(ref => ref.target?.id === node.id));
    backlinks.slice(0, 150).forEach(other => incoming.append(h('button', { type: 'button', onclick: () => select(other.id), 'data-backlink-target': other.id }, other.title)));
    if (!backlinks.length) incoming.append(h('p', {}, tr('연결 없음')));
    const recorded = h('details', { class: 'ik-recorded-links' }, h('summary', {}, tr('기록된 관계')));
    actualEdges().filter(edge => edge.source === node.id || edge.target === node.id).slice(0, 150).forEach(edge => { const other = active().find(value => value.id === (edge.source === node.id ? edge.target : edge.source)); if (other) recorded.append(h('div', {}, h('button', { type: 'button', onclick: () => select(other.id) }, other.title), h('small', {}, `${edge.type} · ${tr(edge.provenance === 'wikilink' ? '위키 링크' : edge.provenance === 'keyword' ? '키워드 관계' : '수동 관계')}`), ...(!edge.provenance || edge.provenance === 'user' ? [button('관계 해제', () => unlink(edge), { class: 'ik-unlink', 'data-ik-unlink': edge.id })] : []))); });
    recorded.append(h('p', { class: 'ik-review-note' }, tr('위키 링크는 원문의 [[링크]]를 수정해 해제하세요.'), ' ', tr('키워드 관계는 내용에서 자동으로 계산됩니다.')));
    return h('div', { class: 'ik-link-panels' }, outgoing, incoming, recorded);
  }
  function field(key, input) { return h('label', { class: 'ik-field' }, h('span', {}, tr(key)), input); }
  function revisionHistory(node) {
    const revisions = data.history.filter(entry => entry.id === node.id).sort((a, b) => b.revision - a.revision), history = h('section', { class: 'ik-history' }, h('h4', {}, tr('수정 이력')));
    if (!revisions.length) history.append(h('p', {}, tr('이전 수정 이력이 없습니다.')));
    for (const entry of revisions) history.append(h('details', { 'data-memory-revision': entry.revision }, h('summary', {}, `r${entry.revision} · ${timestamp(entry.recordedAt || entry.updatedAt)} · ${sourceLabel(entry)}`), h('strong', {}, entry.title), h('pre', {}, entry.content || '')));
    return history;
  }
  function conflictPanel(node, draft) {
    const key = project, id = node.id, waitingForLatest = draft.conflict && draft.revision === node.revision;
    const panel = h('div', { class: 'ik-conflict' }, h('p', {}, tr('원본이 변경되었습니다. 초안을 보존했습니다. 저장 전에 최신 수정 이력을 확인하세요.')));
    panel.hidden = !(draft.dirty && (draft.revision !== node.revision || draft.conflict));
    panel.append(h('details', { open: '', 'data-ik-latest-source': '' }, h('summary', {}, tr('최신 저장본 보기')), h('dl', { class: 'ik-provenance' }, h('dt', {}, tr('제목')), h('dd', {}, node.title || ''), h('dt', {}, tr('수정 번호')), h('dd', {}, String(node.revision || 1)), h('dt', {}, tr('분류')), h('dd', {}, tr(KINDS[node.kind] || '노트')), h('dt', {}, tr('고정')), h('dd', {}, tr(node.pinned ? '고정' : '고정 안 함'))), h('pre', { style: 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto', 'data-ik-latest-content': '' }, node.content || '')));
    if (waitingForLatest) panel.querySelector('details').replaceWith(h('p', {}, tr('최신 저장본을 확인하지 못했습니다. 새로고침 후 비교하세요.')));
    const latest = () => key === project && selectedId === id && !draft.saving && drafts.get(key)?.get(id) === draft ? active().find(value => value.id === id) : null;
    const discard = button('최신 기록 불러오기 (내 초안 취소)', () => {
      if (!latest()) return;
      drafts.get(key).delete(id); editorFields = null; renderInspector(true); notice(tr('최신 기록을 불러왔습니다.'));
    }, { 'data-ik-conflict-action': 'discard', disabled: draft.saving || waitingForLatest });
    const rebase = button('최신 수정본 기준으로 내 초안 유지', () => {
      const current = latest(); if (!current) return;
      captureDraft(); draft.baseline = values(current); draft.revision = current.revision; draft.conflict = false; draft.dirty = true; draft.version++;
      renderInspector(true); notice(tr('초안을 최신 수정 번호에 맞췄습니다. 검토 후 저장해야 적용됩니다.'));
    }, { 'data-ik-conflict-action': 'rebase', disabled: draft.saving || waitingForLatest });
    panel.append(h('div', {}, discard), h('div', {}, rebase)); return panel;
  }
  function recoveryView(id, draft) {
    const title = h('input', { value: draft.title, readonly: '', 'aria-label': tr('제목') }), content = h('textarea', { rows: '15', readonly: '', 'aria-label': tr('내용') }); content.value = draft.content;
    return h('section', { class: 'ik-inspector-body', 'data-ik-recovery': id }, h('h3', {}, tr('복구 가능한 초안')), h('p', { class: 'ik-review-note' }, tr('원본 노트가 삭제되거나 보관되었습니다. 초안은 유지했습니다.')), field('제목', title), field('내용', content), h('p', { class: 'ik-review-note' }, `${tr(KINDS[draft.kind] || '노트')} · ${tr(draft.pinned ? '고정' : '고정 안 함')}`), h('p', { class: 'ik-review-note' }, tr('초안 내용을 선택해 복사하거나 새 노트로 작성할 수 있습니다.')), button('이 초안으로 새 노트 작성', () => openCreate(values(draft)), { 'data-ik-recover-create': id }));
  }
  function renderInspector(force = false) {
    const node = active().find(value => value.id === selectedId);
    if (node && !force && editorFields?.project === project && editorFields.id === node.id) { const draft = editorFields.draft; if (draft.dirty || draft.saving || draft.revision === node.revision) { inspector.querySelector('.ik-conflict')?.replaceWith(conflictPanel(node, draft)); const links = inspector.querySelector('.ik-link-panels'); if (links) links.replaceWith(connections(node, draft)); inspector.querySelector('.ik-history')?.replaceWith(revisionHistory(node)); return; } }
    editorFields = null; inspector.replaceChildren(h('div', { class: 'ik-inspector-heading' }, tr('기억 검사기')));
    const archived = data.nodes.find(value => value.id === selectedId && value.archived);
    if (archived) {
      const draft = drafts.get(project)?.get(archived.id);
      inspector.append(h('section', { class: 'ik-archived-record' }, h('div', { class: 'ik-note-actions' }, h('strong', {}, tr('보관됨')), button('기억 복원', () => archiveNote(archived, false), { 'data-ik-restore': archived.id })), h('p', { class: 'ik-review-note' }, tr('보관한 기억은 그래프와 AI 검색에서 제외되며 보관함에서 복원할 수 있습니다.')), h('h3', {}, archived.title), markdown(archived.content), ...(draft?.dirty || draft?.saving ? [recoveryView(archived.id, draft)] : []), revisionHistory(archived))); return;
    }
    if (!node && selectedId) { const draft = drafts.get(project)?.get(selectedId); if (draft && (draft.dirty || draft.saving)) { inspector.append(recoveryView(selectedId, draft)); return; } }
    if (!node) { inspector.append(h('div', { class: 'ik-inspector-empty' }, h('span', { 'aria-hidden': 'true' }, '▱'), h('h3', {}, tr('기억을 선택하세요')), h('p', {}, tr('그래프나 목록에서 항목을 선택해 원문과 수정 이력을 확인하세요.')), h('p', {}, tr('노트에 [[제목]] 또는 [[제목|별칭]]을 입력해 연결하세요.')))); return; }
    const draft = draftFor(node), key = project, title = h('input', { value: draft.title, maxlength: '160', required: '', 'aria-label': tr('제목') }), content = h('textarea', { rows: '15', maxlength: '24000', required: '', spellcheck: 'false', 'aria-label': tr('내용') }); content.value = draft.content;
    const kind = h('select', { 'aria-label': tr('분류') }, ...Object.entries(KINDS).map(([value, label]) => h('option', { value }, tr(label)))); kind.value = draft.kind; const pinned = h('input', { type: 'checkbox' }); pinned.checked = draft.pinned;
    const dirtyStatus = h('span', { class: 'ik-draft-state', 'data-ik-dirty': String(draft.dirty) }, tr(draft.dirty ? '저장하지 않은 변경' : '변경 없음')), submit = h('button', { type: 'submit', class: 'ik-primary', title: `${tr('검토 후 저장')} · Ctrl/Cmd+Enter` }, tr('검토 후 저장'));
    const tabs = h('div', { class: 'ik-editor-tabs' }, ...[['source', '원문'], ['reading', '읽기']].map(([mode, label]) => button(label, () => { captureDraft(); editorMode = mode; renderInspector(true); }, { class: editorMode === mode ? 'active' : '', 'data-ik-editor-mode': mode, 'aria-pressed': String(editorMode === mode) })), dirtyStatus);
    tabs.append(button('기억 보관', () => archiveNote(node, true), { class: 'ik-archive-button', 'data-ik-archive': node.id, disabled: draft.saving || pendingActions.has(node.id) }));
    const form = h('form', { class: 'ik-review-form' }, field('제목', title), h('div', { class: 'ik-editor-properties' }, field('분류', kind), h('label', { class: 'ik-checkbox' }, pinned, tr('고정'))), field('내용', content), h('p', { class: 'ik-review-note' }, tr('노트에 [[제목]] 또는 [[제목|별칭]]을 입력해 연결하세요.')), h('p', { class: 'ik-review-note' }, tr('저장하면 사용자 검토본으로 기록됩니다. 사실 여부는 직접 확인하세요.')), submit);
    form.hidden = editorMode !== 'source'; const reading = markdown(draft.content); reading.hidden = editorMode !== 'reading';
    editorFields = { project: key, id: node.id, draft, title, content, kind, pinned };
    const changed = () => { captureDraft(); dirtyStatus.dataset.ikDirty = String(draft.dirty); dirtyStatus.textContent = tr(draft.dirty ? '저장하지 않은 변경' : '변경 없음'); };
    for (const input of [title, content, kind, pinned]) { input.addEventListener('input', changed); input.addEventListener('change', changed); }
    form.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', async event => {
      event.preventDefault(); captureDraft(); if (draft.saving) return;
      const version = draft.version, sent = values(draft), expectedRevision = draft.revision; draft.saving = true; submit.disabled = true; submit.textContent = tr('저장 중…');
      try {
        const result = await api(`/api/memory/${encodeURIComponent(node.id)}`, 'PATCH', { expectedRevision, ...sent, title: sent.title.trim(), content: sent.content.trim() }, key);
        captureDraft(); draft.revision = result.node?.revision ?? draft.revision + 1; draft.baseline = values(result.node || { ...sent }); draft.conflict = false;
        if (version === draft.version) { Object.assign(draft, draft.baseline); draft.dirty = false; } else draft.dirty = true;
        draft.saving = false; if (key !== project) return;
        if (editorFields?.draft === draft && !draft.dirty) { title.value = draft.title; content.value = draft.content; kind.value = draft.kind; pinned.checked = draft.pinned; }
        await refresh(); if (key !== project) return; renderInspector(true); notice(tr('저장했습니다.')); window.dispatchEvent(new CustomEvent('imperium:memory-changed'));
      } catch (error) {
        if (key === project) {
          if (error.status === 409) {
            const refreshed = await refresh();
            if (key !== project) return;
            const latest = active().find(value => value.id === node.id);
            draft.conflict = !refreshed || Boolean(latest && latest.revision !== expectedRevision);
            notice(tr(draft.conflict ? '원본이 변경되었습니다. 초안을 보존했습니다. 저장 전에 최신 수정 이력을 확인하세요.' : '요청이 충돌했습니다. 초안을 유지했습니다. 잠시 후 다시 저장하세요.'), true);
          } else notice(error.message, true);
        }
      } finally { draft.saving = false; submit.disabled = false; submit.textContent = tr('검토 후 저장'); if (key === project && selectedId === node.id && drafts.get(key)?.get(node.id) === draft) { renderList(); renderInspector(); } }
    });
    const history = revisionHistory(node);
    const conflict = conflictPanel(node, draft);
    inspector.append(tabs, h('div', { class: 'ik-inspector-body' }, h('div', { class: 'ik-memory-badges' }, h('span', { 'data-source': source(node) }, sourceLabel(node)), ...(node.pinned ? [h('span', { class: 'ik-pinned-badge' }, tr('고정'))] : [])), h('dl', { class: 'ik-provenance' }, h('dt', {}, tr('수정 번호')), h('dd', {}, String(node.revision || 1)), h('dt', {}, tr('출처')), h('dd', {}, node.source || '—'), h('dt', {}, tr('수정 일시')), h('dd', {}, timestamp(node.updatedAt)), ...(node.sourceTaskId ? [h('dt', {}, tr('원본 작업')), h('dd', {}, node.sourceTaskId)] : [])), conflict, form, reading, connections(node, draft), history));
  }
  function openCreate(prefill = {}) {
    const seed = typeof prefill?.content === 'string' ? prefill : {};
    dialog?.remove(); const key = project, title = h('input', { value: seed.title || '', required: '', maxlength: '160', 'aria-label': tr('제목') }), content = h('textarea', { rows: '8', required: '', maxlength: '24000', 'aria-label': tr('내용') }), kind = h('select', { 'aria-label': tr('분류') }, ...Object.entries(KINDS).map(([value, label]) => h('option', { value }, tr(label)))); kind.value = Object.hasOwn(KINDS, seed.kind) ? seed.kind : 'note'; content.value = seed.content || '';
    const pinned = h('input', { type: 'checkbox' }), submit = h('button', { type: 'submit', class: 'ik-primary' }, tr('생성')), form = h('form', { class: 'ik-create-form' }, field('제목', title), field('분류', kind), field('내용', content), h('label', { class: 'ik-checkbox' }, pinned, tr('고정')), h('p', { class: 'ik-review-note' }, tr('노트에 [[제목]] 또는 [[제목|별칭]]을 입력해 연결하세요.')), submit);
    pinned.checked = Boolean(seed.pinned);
    form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { const result = await api('/api/memory', 'POST', { title: title.value.trim(), content: content.value.trim(), kind: kind.value, tags: [], pinned: pinned.checked }, key); if (key !== project) return; selectedId = result.node?.id || null; editorFields = null; dialog.close(); await refresh(); window.dispatchEvent(new CustomEvent('imperium:memory-changed')); } catch (error) { if (key === project) notice(error.message, true); } finally { submit.disabled = false; } });
    dialog = h('dialog', { class: 'ik-create-dialog', 'aria-label': tr('새 기억') }, h('div', { class: 'ik-create-heading' }, h('h2', {}, tr('새 기억')), button('닫기', () => dialog.close())), form); document.body.append(dialog); dialog.showModal();
  }
  function render(incoming) {
    state = incoming || callbacks.getState?.() || state; if (!container) return;
    const key = state.settings?.workspace;
    if (!key) { notice(tr('불러오는 중…')); return; }
    if (project !== key) { captureDraft(); project = key; generation++; clearTimeout(refreshTimer); dialog?.close(); data = { nodes: [], edges: [], history: [], stats: {} }; selectedId = null; editorFields = null; query = ''; filter = 'all'; page = 0; lastMemoryUpdate = state.memoryUpdatedAt; build(); refresh(); }
    else { if (language !== lang()) build(); if (state.memoryUpdatedAt && state.memoryUpdatedAt !== lastMemoryUpdate) { lastMemoryUpdate = state.memoryUpdatedAt; scheduleRefresh(); } }
  }
  function unmount() { captureDraft(); closeActionDialog(); destroyGraph(); generation++; clearTimeout(refreshTimer); dialog?.close(); editorFields = null; project = null; container = null; }
  function mount(target, configuration = {}) { unmount(); container = typeof target === 'string' ? document.querySelector(target) : target; callbacks = configuration; if (!container) return; state = callbacks.getState?.() || state; build(); render(state); }
  window.ImperiumKnowledge = { mount, unmount, render, reload: refresh };
  window.addEventListener('pagehide', unmount);
  window.addEventListener('imperium:memory-changed', () => { if (container && project) scheduleRefresh(); });
  window.addEventListener('imperium:knowledge-search', event => { if (!container) return; captureDraft(); query = String(event.detail?.query || '').slice(0, 1000); filter = 'all'; graphMode = 'all'; page = 0; if (search) search.value = query; renderData(); search?.focus(); });
})();
