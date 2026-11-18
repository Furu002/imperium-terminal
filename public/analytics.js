(function () {
  'use strict';
  const COPY = {
    en: {
      '사용량과 운영 성능': 'Usage and operational performance', '저장된 실제 작업 기준 · DEMO 제외': 'Retained real tasks · DEMO excluded', '새로고침': 'Refresh',
      '불러오는 중…': 'Loading…', '분석 데이터를 불러오지 못했습니다.': 'Analytics could not be loaded.', '실제 작업': 'Real tasks', '보고된 토큰': 'Reported tokens', '완료 비율': 'Completion rate', '실행 시간 P50': 'Duration P50', '실행 시간 P95': 'Duration P95', '구독 잔량': 'Subscription balance',
      '화면 상단의 계정별 잔여 한도를 확인하세요.': 'See the per-account allowance panel above.', '완료 + 실패 작업 기준': 'Completed + failed tasks', '보고 작업 {reported}/{total}': 'Reported jobs {reported}/{total}',
      '일별 보고 토큰': 'Reported tokens by day', '입력': 'Input', '출력': 'Output', '누적 보고 이력': 'Cumulative reported usage', '저장된 보고값의 누적 합계': 'Cumulative sum of retained reports', '실행 시간 · 최근 관측 작업': 'Duration · recent measured tasks', '관측된 실행 시간 기록이 없습니다.': 'No measured execution durations yet.', '보고된 토큰 기록이 없습니다.': 'No reported token usage yet.',
      '작업 기록이 없습니다.': 'No task history yet.', '완료': 'Completed', '실패': 'Failed', '실행 중': 'Running', '대기': 'Queued', '보고 없음': 'Not reported',
      '첫 출력 지연 P50': 'First-output latency P50', '관측 {count}건': '{count} observations', '장기 기억 문맥': 'Long-term memory context', '초기 전달 문맥': 'Initial context', '작업별 전체 기억 합계': 'Sum of per-task memory pools', '추가 조회 문자': 'Additional retrieved characters', '추가 조회': 'Additional lookups', '문자 수 기준이며 문맥 레이블을 포함합니다. 토큰·요금 절감량이 아닙니다.': 'Character counts include context labels. These are not token or billing savings.',
      '추가 조회 문자 미보고 작업 {count}건': 'Additional retrieval size unreported for {count} jobs', '기억 사용 기록이 없습니다.': 'No memory-context telemetry yet.',
      '관측된 사용량 변화': 'Observed usage change', '같은 제공자·모델 ID·부서·권한의 완료 작업만 비교합니다.': 'Completed jobs with the same provider, model ID, department and permission are compared.', '시간순 이전 절반과 최근 절반을 같은 수로 비교합니다. 홀수 중간 표본은 제외합니다. 각 군 최소 3개가 필요합니다.': 'Equal-sized chronological older and newer halves; the middle observation is omitted when odd. Each cohort needs at least 3 jobs.',
      '난이도 미통제 · 청구 절감 아님 · 결과 품질 평가 아님': 'Task difficulty uncontrolled · not billing savings · not a quality score', '구성': 'Configuration', '각 군 표본': 'Jobs / cohort', '이전 평균': 'Older average', '최근 평균': 'Newer average', '변화': 'Change', '데이터 부족': 'Insufficient data', '비교 가능한 보고 표본이 아직 없습니다.': 'No comparable reported samples yet.', '모델 ID 미지정 등 비교 제외 {count}건': '{count} jobs excluded for unspecified configuration',
      'UTC 날짜 기준 · 저장된 기록의 범위이며 계정 전체 사용량이 아닙니다.': 'UTC dates · retained records, not total account usage.', '작업 폴더가 없는 이전 기록 {count}건을 현재 프로젝트에 포함했습니다.': '{count} older records without a workspace are included in the current project.', '운영 지표이며 모델 응답의 정확도나 품질을 측정하지 않습니다.': 'Operational telemetry does not measure answer accuracy or quality.',
    },
    ja: {
      '사용량과 운영 성능': '使用量と稼働状況', '저장된 실제 작업 기준 · DEMO 제외': '保存された実タスクのみ・DEMOを除外', '새로고침': '更新', '불러오는 중…': '読み込み中…', '분석 데이터를 불러오지 못했습니다.': '分析データを取得できませんでした。',
      '실제 작업': '実タスク', '보고된 토큰': '報告トークン', '완료 비율': '完了率', '실행 시간 P50': '実行時間 P50', '실행 시간 P95': '実行時間 P95', '구독 잔량': 'プラン残量', '화면 상단의 계정별 잔여 한도를 확인하세요.': '上部のアカウント別残量パネルを確認してください。', '완료 + 실패 작업 기준': '完了＋失敗タスクが対象', '보고 작업 {reported}/{total}': '報告タスク {reported}/{total}',
      '일별 보고 토큰': '日別の報告トークン', '입력': '入力', '출력': '出力', '누적 보고 이력': '累積報告履歴', '저장된 보고값의 누적 합계': '保存された報告値の累積合計', '실행 시간 · 최근 관측 작업': '実行時間・直近の観測タスク', '관측된 실행 시간 기록이 없습니다.': '観測された実行時間がありません。', '보고된 토큰 기록이 없습니다.': '報告トークンの記録がありません。', '작업 기록이 없습니다.': 'タスク履歴がありません。', '완료': '完了', '실패': '失敗', '실행 중': '実行中', '대기': '待機', '보고 없음': '未報告',
      '첫 출력 지연 P50': '初回出力待ち時間 P50', '관측 {count}건': '観測 {count}件', '장기 기억 문맥': '長期記憶のコンテキスト', '초기 전달 문맥': '初期コンテキスト', '작업별 전체 기억 합계': 'タスク別の全記憶量合計', '추가 조회 문자': '追加取得文字数', '추가 조회': '追加取得回数', '문자 수 기준이며 문맥 레이블을 포함합니다. 토큰·요금 절감량이 아닙니다.': '文字数にはラベルを含みます。トークンや料金の節約量ではありません。', '추가 조회 문자 미보고 작업 {count}건': '追加取得サイズが未報告のタスク {count}件', '기억 사용 기록이 없습니다.': '記憶の使用記録がありません。',
      '관측된 사용량 변화': '観測された使用量の変化', '같은 제공자·모델 ID·부서·권한의 완료 작업만 비교합니다.': '同じプロバイダー・モデルID・部署・権限の完了タスクを比較します。', '시간순 이전 절반과 최근 절반을 같은 수로 비교합니다. 홀수 중간 표본은 제외합니다. 각 군 최소 3개가 필요합니다.': '時系列の前半と後半を同数で比較し、奇数の中央標本は除外します。各群に最低3件が必要です。', '난이도 미통제 · 청구 절감 아님 · 결과 품질 평가 아님': '難易度は未調整・請求額の節約ではありません・品質評価ではありません', '구성': '構成', '각 군 표본': '各群の標本', '이전 평균': '前半の平均', '최근 평균': '後半の平均', '변화': '変化', '데이터 부족': 'データ不足', '비교 가능한 보고 표본이 아직 없습니다.': '比較できる報告標本がまだありません。', '모델 ID 미지정 등 비교 제외 {count}건': 'モデルID未指定などで {count}件を比較対象から除外',
      'UTC 날짜 기준 · 저장된 기록의 범위이며 계정 전체 사용량이 아닙니다.': 'UTC日付・保存履歴の範囲のみで、アカウント全体の使用量ではありません。', '작업 폴더가 없는 이전 기록 {count}건을 현재 프로젝트에 포함했습니다.': '作業フォルダーのない旧記録 {count}件を現在のプロジェクトに含めました。', '운영 지표이며 모델 응답의 정확도나 품질을 측정하지 않습니다.': '稼働指標であり、回答の正確性や品質は測定しません。',
    },
  };
  const h = (tag, className, value) => { const element = document.createElement(tag); if (className) element.className = className; if (value !== undefined) element.textContent = String(value); return element; };
  Object.assign(COPY.en, { '데이터 표 보기': 'Show data table', '차트를 사용할 수 없습니다. 데이터 표를 확인하세요.': 'Chart unavailable. See the data table.', '날짜': 'Date', '합계': 'Total', '작업': 'Task', '상태': 'Status', '실행 시간': 'Duration', '문자': 'Characters', '작업 상태 분포': 'Task status distribution', '취소': 'Cancelled', '중단': 'Interrupted', '누적': 'Cumulative', '평균 보고 토큰': 'Average reported tokens' });
  Object.assign(COPY.ja, { '데이터 표 보기': 'データ表を表示', '차트를 사용할 수 없습니다. 데이터 표를 확인하세요.': 'チャートを表示できません。データ表を確認してください。', '날짜': '日付', '합계': '合計', '작업': 'タスク', '상태': '状態', '실행 시간': '実行時間', '문자': '文字数', '작업 상태 분포': 'タスク状態の分布', '취소': 'キャンセル', '중단': '中断', '누적': '累積', '평균 보고 토큰': '平均報告トークン' });
  const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  let root, options, latestState = {}, language = 'ko', data, signature = '', paintedSignature = '', generation = 0, timer, disposed = false, charts, pendingCharts = [];
  const t = (key, values = {}) => (COPY[language]?.[key] || key).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  const locale = () => language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'ko-KR';
  const n = value => known(value) ? value.toLocaleString(locale(), { maximumFractionDigits: 1 }) : '—';
  const duration = value => !known(value) ? '—' : value < 1000 ? `${n(value)} ms` : value < 60000 ? `${n(value / 1000)} s` : `${n(value / 60000)} min`;
  const percentage = value => typeof value === 'number' && Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%` : '—';
  const empty = message => h('div', 'ia-empty', t(message));
  const colors = { amber: '#FF9F00', cyan: '#00B7EB', green: '#00D77A', red: '#FF4D4F', muted: '#A0A0A0', white: '#F2F2F2' };
  const statusLabel = status => t(({ completed: '완료', failed: '실패', running: '실행 중', queued: '대기', cancelled: '취소', interrupted: '중단' })[status] || status || '보고 없음');
  function panel(title, label) {
    const card = h('section', 'ia-panel'), header = h('header', 'ia-panel-heading');
    header.append(h('h3', '', t(title))); if (label) header.append(h('span', 'ia-panel-label', label));
    card.append(header); return card;
  }
  function dataTable(title, headers, rows) {
    const details = h('details', 'ia-chart-table'), summary = h('summary', '', t('데이터 표 보기'));
    const wrap = h('div', 'ia-table-wrap'), table = h('table', 'ia-comparison-table'), head = h('thead'), header = h('tr'), body = h('tbody');
    table.append(h('caption', '', t(title)));
    for (const label of headers) { const cell = h('th', '', t(label)); cell.scope = 'col'; header.append(cell); }
    head.append(header); table.append(head);
    for (const values of rows) { const row = h('tr'); values.forEach(value => row.append(h('td', '', value))); body.append(row); }
    table.append(body); wrap.append(table); details.append(summary, wrap); return details;
  }
  function chart(card, label, specification, headers, rows, height = 220) {
    const stage = h('div', 'ia-chart-stage'), canvas = h('canvas', 'ia-chart-canvas');
    stage.style.height = `${height}px`; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', t(label));
    canvas.textContent = t('데이터 표 보기'); stage.append(canvas);
    const table = dataTable(label, headers, rows);
    const unavailable = () => {
      stage.hidden = true; table.open = true;
      const message = h('p', 'ia-chart-unavailable ia-caption', t('차트를 사용할 수 없습니다. 데이터 표를 확인하세요.'));
      message.setAttribute('role', 'status'); stage.after(message);
    };
    card.append(stage, table); pendingCharts.push({ canvas, specification: { ...specification, locale: locale() }, unavailable });
  }
  const tooltip = unit => ({ callbacks: { label: context => {
    const number = context.dataset.data[context.dataIndex];
    return `${context.dataset.label || context.label}: ${known(number) ? n(number) : t('보고 없음')}${known(number) && unit ? ` ${unit}` : ''}`;
  } } });
  function dailyChart(rows) {
    const card = panel('일별 보고 토큰', 'UTC / TOKENS');
    const values = rows.slice(-14);
    if (!values.some(row => known(row.totalTokens))) { card.append(empty('보고된 토큰 기록이 없습니다.')); return card; }
    chart(card, '일별 보고 토큰', { type: 'bar', data: { labels: values.map(row => row.day), datasets: [
      { label: t('입력'), data: values.map(row => known(row.inputTokens) ? row.inputTokens : null), backgroundColor: colors.amber, maxBarThickness: 30 },
      { label: t('출력'), data: values.map(row => known(row.outputTokens) ? row.outputTokens : null), backgroundColor: colors.cyan, maxBarThickness: 30 },
    ] }, options: { scales: { x: { stacked: true, grid: { display: false }, ticks: { callback(value) { return String(this.getLabelForValue(value)).slice(5); } } }, y: { stacked: true } }, plugins: { tooltip: tooltip('tokens') } } }, ['날짜', '입력', '출력', '합계'], values.map(row => [row.day, n(row.inputTokens), n(row.outputTokens), n(row.totalTokens)]));
    return card;
  }
  function historyChart(rows) {
    const card = panel('누적 보고 이력', 'OBSERVED / TOKENS');
    card.append(h('p', 'ia-caption', t('저장된 보고값의 누적 합계')));
    const values = rows.slice(-60);
    if (!values.some(row => known(row.cumulativeTokens))) { card.append(empty('보고된 토큰 기록이 없습니다.')); return card; }
    chart(card, '누적 보고 이력', { type: 'line', data: { labels: values.map(row => row.day), datasets: [{ label: t('누적'), data: values.map(row => known(row.cumulativeTokens) ? row.cumulativeTokens : null), borderColor: colors.amber, backgroundColor: '#FF9F0018', pointBackgroundColor: colors.amber, pointRadius: values.length > 30 ? 1 : 2, pointHoverRadius: 4, borderWidth: 1.5, tension: 0, fill: true, spanGaps: false }] }, options: { scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } }, plugins: { legend: { display: false }, tooltip: tooltip('tokens') } } }, ['날짜', '합계', '누적'], values.map(row => [row.day, n(row.tokens), n(row.cumulativeTokens)]));
    return card;
  }
  function durationChart(rows, latency) {
    const card = panel('실행 시간 · 최근 관측 작업', 'DURATION / SECONDS');
    const values = rows.filter(row => known(row.durationMs)).slice(-12);
    if (!values.length) card.append(empty('관측된 실행 시간 기록이 없습니다.'));
    else {
      chart(card, '실행 시간 · 최근 관측 작업', { type: 'bar', data: { labels: values.map(row => row.title || row.id), datasets: [{ label: t('실행 시간'), data: values.map(row => row.durationMs / 1000), backgroundColor: values.map(row => row.status === 'failed' ? colors.red : colors.green), maxBarThickness: 14 }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { grid: { display: false }, ticks: { maxTicksLimit: 12, callback(value) { const label = String(this.getLabelForValue(value)); return label.length > 22 ? `${label.slice(0, 22)}…` : label; } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${duration(values[context.dataIndex].durationMs)} · ${values[context.dataIndex].provider} · ${statusLabel(values[context.dataIndex].status)}` } } } } }, ['작업', '상태', '실행 시간'], values.map(row => [row.title || row.id, statusLabel(row.status), duration(row.durationMs)]), Math.max(200, 46 + values.length * 24));
    }
    const note = h('div', 'ia-panel-foot'); note.append(h('span', '', t('첫 출력 지연 P50')), h('strong', '', duration(latency?.p50)), h('span', '', t('관측 {count}건', { count: n(latency?.samples) }))); card.append(note); return card;
  }
  function memoryPanel(value) {
    const card = panel('장기 기억 문맥', 'MEMORY / CHARACTERS');
    if (!value?.measuredTasks) { card.append(empty('기억 사용 기록이 없습니다.')); return card; }
    const values = [['초기 전달 문맥', value.initialContextChars], ['작업별 전체 기억 합계', value.totalMemoryChars], ['추가 조회 문자', value.retrievedChars]];
    chart(card, '장기 기억 문맥', { type: 'bar', data: { labels: values.map(([label]) => t(label)), datasets: [{ label: t('문자'), data: values.map(([, number]) => known(number) ? number : null), backgroundColor: [colors.cyan, colors.muted, colors.amber], maxBarThickness: 16 }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: tooltip(t('문자')) } } }, ['구성', '문자'], values.map(([label, number]) => [t(label), n(number)]), 190);
    card.append(h('p', 'ia-caption', `${t('추가 조회')} ${n(value.additionalRetrievals)} · ${t('관측 {count}건', { count: n(value.measuredTasks) })}`), h('p', 'ia-disclaimer', t('문자 수 기준이며 문맥 레이블을 포함합니다. 토큰·요금 절감량이 아닙니다.')));
    if (value.unknownRetrievedCharTasks) card.append(h('p', 'ia-disclaimer', t('추가 조회 문자 미보고 작업 {count}건', { count: n(value.unknownRetrievedCharTasks) })));
    return card;
  }
  function statusChart(total) {
    const card = panel('작업 상태 분포', 'RETAINED / TASKS');
    const values = [['completed', colors.green], ['failed', colors.red], ['running', colors.cyan], ['queued', colors.amber], ['cancelled', colors.muted], ['interrupted', colors.white]].map(([status, color]) => ({ status, color, count: total[status] })).filter(row => known(row.count) && row.count > 0);
    if (!values.length) { card.append(empty('작업 기록이 없습니다.')); return card; }
    chart(card, '작업 상태 분포', { type: 'doughnut', data: { labels: values.map(row => statusLabel(row.status)), datasets: [{ data: values.map(row => row.count), backgroundColor: values.map(row => row.color), borderColor: '#000000', borderWidth: 2, hoverOffset: 2 }] }, options: { cutout: '76%', plugins: { tooltip: tooltip(t('작업')) } } }, ['상태', '작업'], values.map(row => [statusLabel(row.status), n(row.count)]));
    return card;
  }
  function comparisonPanel(value) {
    const card = panel('관측된 사용량 변화', 'MATCHED CONFIGURATION'); card.classList.add('ia-wide');
    card.append(h('p', 'ia-caption', t('같은 제공자·모델 ID·부서·권한의 완료 작업만 비교합니다.')), h('p', 'ia-disclaimer', t('시간순 이전 절반과 최근 절반을 같은 수로 비교합니다. 홀수 중간 표본은 제외합니다. 각 군 최소 3개가 필요합니다.')));
    const groups = Array.isArray(value?.groups) ? value.groups : [];
    if (!groups.length) card.append(empty('비교 가능한 보고 표본이 아직 없습니다.'));
    else {
      const comparable = groups.filter(group => group.status === 'available' && group.previousCount >= 3 && group.recentCount >= 3 && known(group.previousAverageTokens) && known(group.recentAverageTokens)).slice(0, 8);
      if (comparable.length) {
        const labels = comparable.map(group => `${group.provider} / ${group.modelId} · ${group.departmentId} · ${group.permission} · ${group.reasoningEffort || 'default'} · ${group.speed || 'default'}`);
        chart(card, '평균 보고 토큰', { type: 'bar', data: { labels, datasets: [
          { label: t('이전 평균'), data: comparable.map(group => group.previousAverageTokens), backgroundColor: colors.amber, maxBarThickness: 16 },
          { label: t('최근 평균'), data: comparable.map(group => group.recentAverageTokens), backgroundColor: colors.cyan, maxBarThickness: 16 },
        ] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { grid: { display: false }, ticks: { callback(value) { const label = String(this.getLabelForValue(value)); return label.length > 28 ? `${label.slice(0, 28)}…` : label; } } } }, plugins: { tooltip: tooltip('tokens') } } }, ['구성', '이전 평균', '최근 평균'], comparable.map((group, index) => [labels[index], n(group.previousAverageTokens), n(group.recentAverageTokens)]), Math.max(200, comparable.length * 48 + 50));
      }
      const wrap = h('div', 'ia-table-wrap'), table = h('table', 'ia-comparison-table'), head = h('thead'), header = h('tr');
      for (const title of ['구성', '각 군 표본', '이전 평균', '최근 평균', '변화']) { const cell = h('th', '', t(title)); cell.scope = 'col'; header.append(cell); } head.append(header); table.append(head);
      const body = h('tbody');
      groups.slice(0, 20).forEach(group => {
        const row = h('tr'), config = h('td'), change = h('td', group.status === 'available' ? 'ia-change-value' : 'ia-insufficient');
        config.append(h('strong', '', `${group.provider} / ${group.modelId}`), h('span', '', `${group.departmentId} · ${group.permission} · ${group.reasoningEffort || 'default'} · ${group.speed || 'default'}`));
        change.textContent = group.status === 'available' ? percentage(group.changePercent) : t('데이터 부족');
        row.append(config, h('td', '', `${n(group.previousCount)} / ${n(group.recentCount)}`), h('td', '', n(group.previousAverageTokens)), h('td', '', n(group.recentAverageTokens)), change); body.append(row);
      }); table.append(body); wrap.append(table); card.append(wrap);
    }
    if (value?.excludedUnknownModelTasks) card.append(h('p', 'ia-disclaimer', t('모델 ID 미지정 등 비교 제외 {count}건', { count: n(value.excludedUnknownModelTasks) })));
    card.append(h('p', 'ia-caution', t('난이도 미통제 · 청구 절감 아님 · 결과 품질 평가 아님'))); return card;
  }
  function paint(value) {
    if (!root || disposed) return;
    const nextSignature = JSON.stringify([language, value]);
    if (nextSignature === paintedSignature) { charts?.resize(); return; }
    charts?.destroyCharts(); pendingCharts = [];
    const focused = root.contains(document.activeElement) && document.activeElement?.classList.contains('ia-refresh');
    const header = h('header', 'ia-heading'), title = h('div'); title.append(h('span', 'ia-eyebrow', 'PERFORMANCE / LOCAL TELEMETRY'), h('h2', '', t('사용량과 운영 성능')), h('p', '', t('저장된 실제 작업 기준 · DEMO 제외')));
    const refreshButton = h('button', 'ia-refresh', t('새로고침')); refreshButton.type = 'button'; refreshButton.addEventListener('click', () => { void load(); }); header.append(title, refreshButton);
    const total = value.totals || {}, performance = value.performance || {}, metrics = h('div', 'ia-metrics');
    const values = [
      ['실제 작업', n(total.tasks), `${t('완료')} ${n(total.completed)} · ${t('실패')} ${n(total.failed)}`],
      ['보고된 토큰', n(total.totalTokens), t('보고 작업 {reported}/{total}', { reported: n(total.reportedTasks), total: n(total.tasks) })],
      ['완료 비율', known(performance.successRate) ? `${n(performance.successRate * 100)}%` : '—', t('완료 + 실패 작업 기준')],
      ['실행 시간 P50', duration(performance.durationMs?.p50), t('관측 {count}건', { count: n(performance.durationMs?.samples) })],
      ['실행 시간 P95', duration(performance.durationMs?.p95), 'NEAREST RANK'],
      ['구독 잔량', '—', t('화면 상단의 계정별 잔여 한도를 확인하세요.')],
    ];
    for (const [label, number, note] of values) { const metric = h('div', 'ia-metric'); metric.append(h('span', 'ia-metric-label', t(label)), h('strong', 'ia-metric-value', number), h('span', 'ia-metric-note', note)); metrics.append(metric); }
    const grid = h('div', 'ia-grid'); grid.append(dailyChart(value.byDay || []), historyChart(value.tokenHistory || []), durationChart(value.taskBars || [], performance.firstOutputLatencyMs), statusChart(total), memoryPanel(value.memory), comparisonPanel(value.comparison));
    const footer = h('footer', 'ia-footnote'); footer.append(h('p', '', t('UTC 날짜 기준 · 저장된 기록의 범위이며 계정 전체 사용량이 아닙니다.')), h('p', '', t('운영 지표이며 모델 응답의 정확도나 품질을 측정하지 않습니다.')));
    if (value.meta?.legacyWorkspaceTasks) footer.append(h('p', '', t('작업 폴더가 없는 이전 기록 {count}건을 현재 프로젝트에 포함했습니다.', { count: n(value.meta.legacyWorkspaceTasks) })));
    root.replaceChildren(header, metrics, grid, footer);
    for (const job of pendingCharts) {
      if (charts) charts.draw(job.canvas, job.specification, job.unavailable);
      else job.unavailable();
    }
    pendingCharts = []; paintedSignature = nextSignature; charts?.resize(true);
    if (focused) refreshButton.focus({ preventScroll: true });
  }
  async function load() {
    if (!root || disposed) return;
    const version = ++generation, workspace = latestState.settings?.workspace;
    try {
      const response = options.api ? await options.api('/api/analytics') : await fetch('/api/analytics').then(result => { if (!result.ok) throw new Error('analytics'); return result.json(); });
      if (disposed || version !== generation || workspace !== latestState.settings?.workspace) return;
      const incoming = response?.analytics || response;
      if (!incoming || typeof incoming !== 'object' || !incoming.totals) throw new Error('analytics');
      data = incoming; root.querySelector('.ia-load-error')?.remove(); paint(data);
    } catch {
      if (disposed || version !== generation) return;
      if (!data) root.replaceChildren(empty('분석 데이터를 불러오지 못했습니다.'));
      else { paint(data); root.querySelector('.ia-load-error')?.remove(); const message = h('p', 'ia-load-error', t('분석 데이터를 불러오지 못했습니다.')); message.setAttribute('role', 'status'); root.prepend(message); }
    }
  }
  function render(state) {
    if (!root || disposed) return;
    latestState = state || options.getState?.() || {};
    const selectedLanguage = ['ko', 'en', 'ja'].includes(latestState.settings?.language) ? latestState.settings.language : 'ko';
    const languageChanged = selectedLanguage !== language; language = selectedLanguage;
    const current = JSON.stringify([latestState.settings?.workspace, (latestState.tasks || []).map(task => [task.id, task.status, task.createdAt, task.startedAt, task.finishedAt, task.firstOutputAt, task.usageReported, task.usage, task.memoryUsage])]);
    if (current !== signature) {
      if (data?.meta?.workspace !== latestState.settings?.workspace) { data = null; paintedSignature = ''; charts?.destroyCharts(); root.replaceChildren(empty('불러오는 중…')); }
      signature = current;
      if (!timer) timer = setTimeout(() => { timer = null; void load(); }, 150);
    } else if (languageChanged && data) paint(data);
    charts?.resize();
  }
  function mount(container, configuration = {}) {
    clearTimeout(timer); timer = null; generation++; charts?.destroy(); disposed = false; root = container; options = configuration; data = null; signature = ''; paintedSignature = '';
    if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('An analytics container is required');
    charts = window.ImperiumAnalyticsCharts?.createManager({ container: root, Chart: options.Chart });
    root.classList.add('ia-analytics'); root.setAttribute('aria-label', 'IMPERIUM analytics'); root.replaceChildren(empty('불러오는 중…')); render(options.getState?.() || {});
    return { render, refresh: load, destroy() { disposed = true; generation++; clearTimeout(timer); timer = null; charts?.destroy(); charts = null; root?.replaceChildren(); } };
  }
  window.ImperiumAnalytics = { mount, render, refresh: load };
}());
