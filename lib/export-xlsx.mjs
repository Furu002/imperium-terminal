import ExcelJS from 'exceljs';

const COPY = {
  ko: {
    sheets: ['요약', '작업', '작업 결과', '부서', '이벤트', '기억', '모델 연결'],
    summary: ['항목', '값'], tasks: ['작업 ID', '작업 제목', '담당 부서', '제공자', '모델 ID', '상태', '우선순위', '파일 권한', '데모 여부', '생성 일시 (UTC)', '시작 일시 (UTC)', '종료 일시 (UTC)', '입력 토큰 (보고값)', '출력 토큰 (보고값)', '결과 문자 수', '오류', '워크플로 ID', '작업 지시', '추론 강도 (요청)', '처리 속도 (요청)'],
    output: ['작업 ID', '작업 제목', '조각 번호', '전체 조각 수', '결과 원문'], departments: ['부서 ID', '코드', '부서 이름', '담당 제공자', '역할'],
    events: ['이벤트 ID', '발생 일시 (UTC)', '유형', '제공자', '부서 ID', '작업 ID', '내용', '데모 여부'],
    memories: ['기억 ID', '제목', '분류', '태그', '고정 여부', '수정 번호', '생성 일시 (UTC)', '수정 일시 (UTC)', '내용'],
    connections: ['연결 ID', '제공자', '표시 이름', '모델 ID', '생성 일시 (UTC)', '수정 일시 (UTC)'],
    labels: ['내보낸 일시 (UTC)', '프로젝트 폴더', '저장된 작업 수', '실제 작업 수', '데모 작업 수', '실행 중인 실제 작업 수', '완료된 실제 작업 수', '실패한 실제 작업 수', '구성된 부서 역할 수', '연결된 제공자 수', '보고된 입력 토큰 합계', '보고된 출력 토큰 합계', '저장된 기억 수', '등록된 연결 수', '사용량 기준', '결과 보존 방식', '제외 항목'],
    usageNote: 'CLI가 실제로 보고한 사용량만 합산합니다. 보고되지 않은 사용량은 빈칸입니다.', outputNote: '긴 결과는 UTF-16 기준 최대 32,000자씩 나누며 조각 번호 순서대로 연결하면 원문이 복원됩니다.', excluded: '인증 토큰, API 키, 터미널 출력과 원본 서버 상태는 포함하지 않습니다.',
  },
  en: {
    sheets: ['Summary', 'Tasks', 'Task Output', 'Departments', 'Events', 'Memory', 'Connections'],
    summary: ['Metric', 'Value'], tasks: ['Task ID', 'Title', 'Department', 'Provider', 'Model ID', 'Status', 'Priority', 'Permission', 'Demo', 'Created (UTC)', 'Started (UTC)', 'Finished (UTC)', 'Input tokens (reported)', 'Output tokens (reported)', 'Output characters', 'Error', 'Workflow ID', 'Task instruction', 'Requested reasoning effort', 'Requested processing speed'],
    output: ['Task ID', 'Title', 'Part', 'Total parts', 'Output text'], departments: ['Department ID', 'Code', 'Name', 'Assigned provider', 'Role'],
    events: ['Event ID', 'Timestamp (UTC)', 'Type', 'Provider', 'Department ID', 'Task ID', 'Text', 'Demo'],
    memories: ['Memory ID', 'Title', 'Kind', 'Tags', 'Pinned', 'Revision', 'Created (UTC)', 'Updated (UTC)', 'Content'],
    connections: ['Connection ID', 'Provider', 'Label', 'Model ID', 'Created (UTC)', 'Updated (UTC)'],
    labels: ['Exported (UTC)', 'Project directory', 'Saved tasks', 'Real tasks', 'Demo tasks', 'Running real tasks', 'Completed real tasks', 'Failed real tasks', 'Configured department roles', 'Connected providers', 'Reported input tokens', 'Reported output tokens', 'Saved memories', 'Registered connections', 'Usage basis', 'Output preservation', 'Excluded data'],
    usageNote: 'Only usage reported by a CLI is summed. Unreported usage is left blank.', outputNote: 'Long output is split into parts of at most 32,000 UTF-16 code units. Joining parts in order restores the original text.', excluded: 'Authentication tokens, API keys, terminal output and raw server state are omitted.',
  },
  ja: {
    sheets: ['概要', 'タスク', '実行結果', '部署', 'イベント', '記憶', '接続'],
    summary: ['項目', '値'], tasks: ['タスクID', 'タイトル', '担当部署', 'プロバイダー', 'モデルID', '状態', '優先度', '権限', 'デモ', '作成日時 (UTC)', '開始日時 (UTC)', '終了日時 (UTC)', '入力トークン（報告値）', '出力トークン（報告値）', '結果の文字数', 'エラー', 'ワークフローID', '作業指示', '推論強度（要求）', '処理速度（要求）'],
    output: ['タスクID', 'タイトル', '分割番号', '総分割数', '結果の原文'], departments: ['部署ID', 'コード', '部署名', '担当プロバイダー', '役割'],
    events: ['イベントID', '日時 (UTC)', '種類', 'プロバイダー', '部署ID', 'タスクID', '内容', 'デモ'],
    memories: ['記憶ID', 'タイトル', '分類', 'タグ', '固定', '改訂番号', '作成日時 (UTC)', '更新日時 (UTC)', '内容'],
    connections: ['接続ID', 'プロバイダー', '表示名', 'モデルID', '作成日時 (UTC)', '更新日時 (UTC)'],
    labels: ['書き出し日時 (UTC)', 'プロジェクトフォルダー', '保存タスク数', '実タスク数', 'デモタスク数', '実行中の実タスク', '完了した実タスク', '失敗した実タスク', '設定された部署の役割', '接続プロバイダー数', '報告済み入力トークン合計', '報告済み出力トークン合計', '保存された記憶', '登録済みの接続', '使用量の基準', '結果の保持方法', '除外データ'],
    usageNote: 'CLIが実際に報告した使用量のみ集計します。未報告の使用量は空欄です。', outputNote: '長い結果はUTF-16で最大32,000文字に分割します。分割番号順に結合すると原文を復元できます。', excluded: '認証トークン、APIキー、ターミナル出力、生のサーバー状態は含みません。',
  },
};

const text = (value, max = 32000) => typeof value === 'string' ? value.slice(0, max) : ['number', 'boolean'].includes(typeof value) ? String(value).slice(0, max) : '';
const list = value => Array.isArray(value) ? value : [];
const date = value => { if (!value) return null; const result = new Date(value); return Number.isFinite(result.getTime()) ? result : null; };
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const usage = task => {
  const input = number(task.usage?.inputTokens), output = number(task.usage?.outputTokens);
  // Queued records initialize usage to zero; those defaults are not a report.
  if (task.demo || !(input > 0 || output > 0)) return { input: null, output: null };
  return { input, output };
};

export function splitOutput(value, size = 32000) {
  if (typeof value !== 'string' || !value.length) return [];
  if (!Number.isInteger(size) || size < 2 || size > 32000) throw new RangeError('Output chunk size must be an integer from 2 to 32000.');
  const chunks = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + size, value.length);
    if (end < value.length && value.charCodeAt(end - 1) >= 0xd800 && value.charCodeAt(end - 1) <= 0xdbff && value.charCodeAt(end) >= 0xdc00 && value.charCodeAt(end) <= 0xdfff) end--;
    chunks.push(value.slice(start, end)); start = end;
  }
  return chunks;
}

function addSheet(workbook, name, headers, rows, widths, { longColumns = [] } = {}) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }], properties: { defaultRowHeight: 20 }, pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = headers.map((header, index) => ({ header, key: `c${index}`, width: widths[index] || 22 }));
  const header = sheet.getRow(1); header.height = 27;
  header.eachCell(cell => { cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFF2E8DA' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18232D' } }; cell.border = { bottom: { style: 'medium', color: { argb: 'FFD68A4D' } } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
  for (const values of rows) {
    const row = sheet.addRow(values);
    if (longColumns.length && values.some((value, index) => longColumns.includes(index + 1) && typeof value === 'string' && (value.length > 120 || value.includes('\n')))) row.height = 75;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Aptos', size: 11, color: { argb: 'FF263746' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      if (row.number % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F7' } };
      // ExcelJS string values create string cells, never formula objects. Keep
      // their exact contents, including leading =, +, -, @ and URLs.
      if (typeof cell.value === 'string') cell.numFmt = '@';
      else if (cell.value instanceof Date) cell.numFmt = 'yyyy-mm-dd hh:mm:ss "UTC"';
      else if (typeof cell.value === 'number') cell.numFmt = '#,##0';
    });
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
  return sheet;
}

export async function buildExportWorkbook(state = {}, { memory, language = state.settings?.language || 'ko' } = {}) {
  const copy = COPY[language] || COPY.ko;
  const workbook = new ExcelJS.Workbook();
  // ExcelJS 4.4 passes shared-string XML to JSZip as UTF-16 text. JSZip
  // 3.10 can split a surrogate pair at its 16 KiB string boundary (PR #963).
  // Encode this workbook's complete XML before compression, without changing
  // a dependency prototype or any cell's value/formula handling.
  workbook.xlsx.addSharedStrings = async (zip, model) => {
    if (model.sharedStrings?.count) zip.append(Buffer.from(model.sharedStrings.xml, 'utf8'), { name: 'xl/sharedStrings.xml' });
  };
  workbook.creator = 'IMPERIUM'; workbook.title = 'IMPERIUM Workspace Export'; workbook.subject = 'AI organization operations'; workbook.created = new Date(); workbook.modified = workbook.created;
  const tasks = list(state.tasks), departments = list(state.departments), events = list(state.events), providers = list(state.providers);
  const memoryNodes = Array.isArray(memory) ? memory : list(memory?.nodes || state.memory?.nodes);
  const connections = list(state.connections || state.providerConnections);
  const realTasks = tasks.filter(task => !task.demo), reports = realTasks.map(usage).filter(report => report.input !== null || report.output !== null);
  const summaryValues = [
    new Date(), text(state.settings?.workspace), tasks.length, realTasks.length, tasks.filter(task => task.demo).length,
    realTasks.filter(task => task.status === 'running').length, realTasks.filter(task => task.status === 'completed').length, realTasks.filter(task => task.status === 'failed').length,
    departments.length, providers.filter(provider => provider.status === 'ready' && provider.authenticated !== false).length,
    reports.length ? reports.reduce((sum, report) => sum + (report.input || 0), 0) : null,
    reports.length ? reports.reduce((sum, report) => sum + (report.output || 0), 0) : null,
    memoryNodes.length, connections.length, copy.usageNote, copy.outputNote, copy.excluded,
  ];
  addSheet(workbook, copy.sheets[0], copy.summary, copy.labels.map((label, index) => [label, summaryValues[index]]), [34, 110], { longColumns: [2] });
  addSheet(workbook, copy.sheets[1], copy.tasks, tasks.map(task => {
    const reported = usage(task), department = departments.find(item => item.id === task.departmentId);
    return [text(task.id), text(task.title), text(department?.name || task.departmentId), text(task.provider), text(task.modelId), text(task.status), text(task.priority), text(task.permission), Boolean(task.demo), date(task.createdAt), date(task.startedAt), date(task.finishedAt), reported.input, reported.output, typeof task.output === 'string' ? task.output.length : 0, text(task.error), text(task.workflowId), text(task.prompt), text(task.reasoningEffort || 'default'), text(task.speed || 'default')];
  }), [38, 48, 22, 22, 26, 18, 14, 22, 10, 25, 25, 25, 23, 23, 20, 65, 38, 95], { longColumns: [2, 16, 18] });
  const outputRows = [];
  for (const task of tasks) { const chunks = splitOutput(task.output); chunks.forEach((chunk, index) => outputRows.push([text(task.id), text(task.title), index + 1, chunks.length, chunk])); }
  addSheet(workbook, copy.sheets[2], copy.output, outputRows, [38, 45, 14, 16, 115], { longColumns: [5] });
  addSheet(workbook, copy.sheets[3], copy.departments, departments.map(department => [text(department.id), text(department.code), text(department.name), text(department.provider), text(department.role)]), [30, 12, 28, 24, 105], { longColumns: [5] });
  addSheet(workbook, copy.sheets[4], copy.events, events.map(event => [text(event.id), date(event.timestamp), text(event.type), text(event.provider), text(event.departmentId), text(event.taskId), text(event.text), Boolean(event.demo)]), [38, 25, 18, 22, 28, 38, 115, 10], { longColumns: [7] });
  addSheet(workbook, copy.sheets[5], copy.memories, memoryNodes.map(item => [text(item.id), text(item.title), text(item.kind), list(item.tags).map(tag => text(tag, 200)).join(', '), Boolean(item.pinned), number(item.revision), date(item.createdAt), date(item.updatedAt), text(item.content)]), [38, 45, 20, 35, 11, 13, 25, 25, 115], { longColumns: [9] });
  addSheet(workbook, copy.sheets[6], copy.connections, connections.map(item => [text(item.id), text(item.providerId), text(item.label), text(item.modelId), date(item.createdAt), date(item.updatedAt)]), [38, 25, 35, 40, 25, 25]);
  return Buffer.from(await workbook.xlsx.writeBuffer({ useSharedStrings: true }));
}
