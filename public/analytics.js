(function () {
  'use strict';
  const COPY = {
    en: {
      '사용량과 운영 성능': 'Usage and operational performance', '저장된 실제 작업 기준 · DEMO 제외': 'Retained real tasks · DEMO excluded', '새로고침': 'Refresh',
      '불러오는 중…': 'Loading…', '분석 데이터를 불러오지 못했습니다.': 'Analytics could not be loaded.', '실제 작업': 'Real tasks', '보고된 토큰': 'Reported tokens', '완료 비율': 'Completion rate', '실행 시간 P50': 'Duration P50', '실행 시간 P95': 'Duration P95', '구독 잔량': 'Subscription balance',
      '구독 CLI가 잔량을 제공하지 않습니다.': 'Subscription CLIs do not expose the remaining allowance.', '완료 + 실패 작업 기준': 'Completed + failed tasks', '보고 작업 {reported}/{total}': 'Reported jobs {reported}/{total}',
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
      '실제 작업': '実タスク', '보고된 토큰': '報告トークン', '완료 비율': '完了率', '실행 시간 P50': '実行時間 P50', '실행 시간 P95': '実行時間 P95', '구독 잔량': 'プラン残量', '구독 CLI가 잔량을 제공하지 않습니다.': 'サブスクリプションCLIは残量を公開していません。', '완료 + 실패 작업 기준': '完了＋失敗タスクが対象', '보고 작업 {reported}/{total}': '報告タスク {reported}/{total}',
      '일별 보고 토큰': '日別の報告トークン', '입력': '入力', '출력': '出力', '누적 보고 이력': '累積報告履歴', '저장된 보고값의 누적 합계': '保存された報告値の累積合計', '실행 시간 · 최근 관측 작업': '実行時間・直近の観測タスク', '관측된 실행 시간 기록이 없습니다.': '観測された実行時間がありません。', '보고된 토큰 기록이 없습니다.': '報告トークンの記録がありません。', '작업 기록이 없습니다.': 'タスク履歴がありません。', '완료': '完了', '실패': '失敗', '실행 중': '実行中', '대기': '待機', '보고 없음': '未報告',
      '첫 출력 지연 P50': '初回出力待ち時間 P50', '관측 {count}건': '観測 {count}件', '장기 기억 문맥': '長期記憶のコンテキスト', '초기 전달 문맥': '初期コンテキスト', '작업별 전체 기억 합계': 'タスク別の全記憶量合計', '추가 조회 문자': '追加取得文字数', '추가 조회': '追加取得回数', '문자 수 기준이며 문맥 레이블을 포함합니다. 토큰·요금 절감량이 아닙니다.': '文字数にはラベルを含みます。トークンや料金の節約量ではありません。', '추가 조회 문자 미보고 작업 {count}건': '追加取得サイズが未報告のタスク {count}件', '기억 사용 기록이 없습니다.': '記憶の使用記録がありません。',
      '관측된 사용량 변화': '観測された使用量の変化', '같은 제공자·모델 ID·부서·권한의 완료 작업만 비교합니다.': '同じプロバイダー・モデルID・部署・権限の完了タスクを比較します。', '시간순 이전 절반과 최근 절반을 같은 수로 비교합니다. 홀수 중간 표본은 제외합니다. 각 군 최소 3개가 필요합니다.': '時系列の前半と後半を同数で比較し、奇数の中央標本は除外します。各群に最低3件が必要です。', '난이도 미통제 · 청구 절감 아님 · 결과 품질 평가 아님': '難易度は未調整・請求額の節約ではありません・品質評価ではありません', '구성': '構成', '각 군 표본': '各群の標本', '이전 평균': '前半の平均', '최근 평균': '後半の平均', '변화': '変化', '데이터 부족': 'データ不足', '비교 가능한 보고 표본이 아직 없습니다.': '比較できる報告標本がまだありません。', '모델 ID 미지정 등 비교 제외 {count}건': 'モデルID未指定などで {count}件を比較対象から除外',
      'UTC 날짜 기준 · 저장된 기록의 범위이며 계정 전체 사용량이 아닙니다.': 'UTC日付・保存履歴の範囲のみで、アカウント全体の使用量ではありません。', '작업 폴더가 없는 이전 기록 {count}건을 현재 프로젝트에 포함했습니다.': '作業フォルダーのない旧記録 {count}件を現在のプロジェクトに含めました。', '운영 지표이며 모델 응답의 정확도나 품질을 측정하지 않습니다.': '稼働指標であり、回答の正確性や品質は測定しません。',
    },
  };
  const h = (tag, className, value) => { const element = document.createElement(tag); if (className) element.className = className; if (value !== undefined) element.textContent = String(value); return element; };
  const s = (tag, attributes, value) => { const element = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, item] of Object.entries(attributes || {})) element.setAttribute(key, String(item)); if (value !== undefined) element.textContent = String(value); return element; };
  const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  let root, options, latestState = {}, language = 'ko', data, signature = '', generation = 0, timer, disposed = false;
  const t = (key, values = {}) => (COPY[language]?.[key] || key).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  const locale = () => language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'ko-KR';
  const n = value => known(value) ? value.toLocaleString(locale(), { maximumFractionDigits: 1 }) : '—';
  const duration = value => !known(value) ? '—' : value < 1000 ? `${n(value)} ms` : value < 60000 ? `${n(value / 1000)} s` : `${n(value / 60000)} min`;
  const percentage = value => typeof value === 'number' && Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%` : '—';
  const empty = message => h('div', 'ia-empty', t(message));
  function panel(title, label) {
    const card = h('section', 'ia-panel'), header = h('header', 'ia-panel-heading');
    header.append(h('h3', '', t(title))); if (label) header.append(h('span', 'ia-panel-label', label));
    card.append(header); return card;
  }
  function chart(label, height = 220) {
    const image = s('svg', { viewBox: `0 0 720 ${height}`, role: 'img', 'aria-label': t(label), class: 'ia-chart' });
    image.append(s('title', {}, t(label))); return image;
  }
  function axes(image, maximum, height = 220, left = 52) {
    for (const value of [0, maximum / 2, maximum]) {
      const y = height - 38 - value / maximum * (height - 62);
      image.append(s('line', { x1: left, y1: y, x2: 705, y2: y, class: 'ia-gridline' }), s('text', { x: left - 8, y: y + 4, 'text-anchor': 'end', class: 'ia-axis' }, n(value)));
    }
  }
  function dailyChart(rows) {
    const card = panel('일별 보고 토큰', 'UTC / TOKENS');
    const legend = h('div', 'ia-legend'); legend.append(h('span', 'ia-input-key', t('입력')), h('span', 'ia-output-key', t('출력'))); card.append(legend);
    const values = rows.slice(-14);
    if (!values.some(row => known(row.totalTokens))) { card.append(empty('보고된 토큰 기록이 없습니다.')); return card; }
    const image = chart('일별 보고 토큰'), max = Math.max(1, ...values.map(row => known(row.totalTokens) ? row.totalTokens : 0));
    axes(image, max);
    const step = 640 / values.length;
    values.forEach((row, index) => {
      const x = 57 + step * index, width = Math.min(32, step * .6), base = 182;
      const input = known(row.inputTokens) ? row.inputTokens / max * 158 : 0, output = known(row.outputTokens) ? row.outputTokens / max * 158 : 0;
      if (known(row.totalTokens)) {
        const group = s('g'); group.append(s('title', {}, `${row.day}: ${n(row.totalTokens)} tokens · ${t('입력')} ${n(row.inputTokens)} / ${t('출력')} ${n(row.outputTokens)}`));
        group.append(s('rect', { x, y: base - input, width, height: input, class: 'ia-input-bar' }), s('rect', { x, y: base - input - output, width, height: output, class: 'ia-output-bar' })); image.append(group);
      } else image.append(s('text', { x: x + width / 2, y: 173, 'text-anchor': 'middle', class: 'ia-axis' }, '—'));
      image.append(s('text', { x: x + width / 2, y: 207, 'text-anchor': 'middle', class: 'ia-axis' }, String(row.day).slice(5)));
    });
    card.append(image); return card;
  }
  function historyChart(rows) {
    const card = panel('누적 보고 이력', 'OBSERVED / TOKENS');
    card.append(h('p', 'ia-caption', t('저장된 보고값의 누적 합계')));
    if (!rows.length) { card.append(empty('보고된 토큰 기록이 없습니다.')); return card; }
    const values = rows.slice(-60), image = chart('누적 보고 이력'), max = Math.max(1, ...values.map(row => known(row.cumulativeTokens) ? row.cumulativeTokens : 0));
    axes(image, max);
    const points = values.map((row, index) => ({ x: values.length === 1 ? 375 : 57 + index / (values.length - 1) * 640, y: 182 - (known(row.cumulativeTokens) ? row.cumulativeTokens : 0) / max * 158, row }));
    image.append(s('path', { d: points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '), class: 'ia-history-line' }));
    points.forEach(point => { const circle = s('circle', { cx: point.x, cy: point.y, r: points.length > 30 ? 2 : 3, class: 'ia-history-point' }); circle.append(s('title', {}, `${point.row.day}: ${n(point.row.cumulativeTokens)} tokens`)); image.append(circle); });
    image.append(s('text', { x: 57, y: 207, class: 'ia-axis' }, String(values[0].day)), s('text', { x: 699, y: 207, 'text-anchor': 'end', class: 'ia-axis' }, String(values.at(-1).day)));
    card.append(image); return card;
  }
  function durationChart(rows, latency) {
    const card = panel('실행 시간 · 최근 관측 작업', 'DURATION / SECONDS');
    const values = rows.filter(row => known(row.durationMs)).slice(-12);
    if (!values.length) card.append(empty('관측된 실행 시간 기록이 없습니다.'));
    else {
      const height = 30 + values.length * 29, image = chart('실행 시간 · 최근 관측 작업', height), max = Math.max(1, ...values.map(row => row.durationMs));
      values.forEach((row, index) => {
        const y = 12 + index * 29, group = s('g'); group.append(s('title', {}, `${row.title} · ${duration(row.durationMs)} · ${row.provider}`));
        group.append(s('text', { x: 16, y: y + 13, class: 'ia-task-label' }, String(row.title || row.id).slice(0, 14)), s('rect', { x: 210, y, width: row.durationMs / max * 400, height: 17, class: row.status === 'failed' ? 'ia-failed-bar' : 'ia-duration-bar' }), s('text', { x: 700, y: y + 13, 'text-anchor': 'end', class: 'ia-axis' }, duration(row.durationMs)));
        image.append(group);
      }); card.append(image);
    }
    const note = h('div', 'ia-panel-foot'); note.append(h('span', '', t('첫 출력 지연 P50')), h('strong', '', duration(latency?.p50)), h('span', '', t('관측 {count}건', { count: n(latency?.samples) }))); card.append(note); return card;
  }
  function memoryPanel(value) {
    const card = panel('장기 기억 문맥', 'MEMORY / CHARACTERS');
    if (!value?.measuredTasks) { card.append(empty('기억 사용 기록이 없습니다.')); return card; }
    const bars = h('div', 'ia-memory-bars');
    const maximum = Math.max(1, known(value.totalMemoryChars) ? value.totalMemoryChars : 0, known(value.initialContextChars) ? value.initialContextChars : 0, known(value.retrievedChars) ? value.retrievedChars : 0);
    for (const [label, number, kind] of [['초기 전달 문맥', value.initialContextChars, 'context'], ['작업별 전체 기억 합계', value.totalMemoryChars, 'pool'], ['추가 조회 문자', value.retrievedChars, 'retrieved']]) {
      const row = h('div', 'ia-memory-row'), track = h('div', 'ia-memory-track'), fill = h('span', `ia-memory-fill ia-${kind}`);
      fill.style.width = `${known(number) ? number / maximum * 100 : 0}%`; track.append(fill); row.append(h('span', '', t(label)), track, h('strong', '', n(number))); bars.append(row);
    }
    card.append(bars, h('p', 'ia-caption', `${t('추가 조회')} ${n(value.additionalRetrievals)} · ${t('관측 {count}건', { count: n(value.measuredTasks) })}`), h('p', 'ia-disclaimer', t('문자 수 기준이며 문맥 레이블을 포함합니다. 토큰·요금 절감량이 아닙니다.')));
    if (value.unknownRetrievedCharTasks) card.append(h('p', 'ia-disclaimer', t('추가 조회 문자 미보고 작업 {count}건', { count: n(value.unknownRetrievedCharTasks) })));
    return card;
  }
  function comparisonPanel(value) {
    const card = panel('관측된 사용량 변화', 'MATCHED CONFIGURATION'); card.classList.add('ia-wide');
    card.append(h('p', 'ia-caption', t('같은 제공자·모델 ID·부서·권한의 완료 작업만 비교합니다.')), h('p', 'ia-disclaimer', t('시간순 이전 절반과 최근 절반을 같은 수로 비교합니다. 홀수 중간 표본은 제외합니다. 각 군 최소 3개가 필요합니다.')));
    const groups = Array.isArray(value?.groups) ? value.groups : [];
    if (!groups.length) card.append(empty('비교 가능한 보고 표본이 아직 없습니다.'));
    else {
      const wrap = h('div', 'ia-table-wrap'), table = h('table', 'ia-comparison-table'), head = h('thead'), header = h('tr');
      for (const title of ['구성', '각 군 표본', '이전 평균', '최근 평균', '변화']) header.append(h('th', '', t(title))); head.append(header); table.append(head);
      const body = h('tbody');
      groups.slice(0, 20).forEach(group => {
        const row = h('tr'), config = h('td'), change = h('td', group.status === 'available' ? 'ia-change-value' : 'ia-insufficient');
        config.append(h('strong', '', `${group.provider} / ${group.modelId}`), h('span', '', `${group.departmentId} · ${group.permission}`));
        change.textContent = group.status === 'available' ? percentage(group.changePercent) : t('데이터 부족');
        row.append(config, h('td', '', `${n(group.previousCount)} / ${n(group.recentCount)}`), h('td', '', n(group.previousAverageTokens)), h('td', '', n(group.recentAverageTokens)), change); body.append(row);
      }); table.append(body); wrap.append(table); card.append(wrap);
    }
    if (value?.excludedUnknownModelTasks) card.append(h('p', 'ia-disclaimer', t('모델 ID 미지정 등 비교 제외 {count}건', { count: n(value.excludedUnknownModelTasks) })));
    card.append(h('p', 'ia-caution', t('난이도 미통제 · 청구 절감 아님 · 결과 품질 평가 아님'))); return card;
  }
  function paint(value) {
    if (!root || disposed) return;
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
      ['구독 잔량', '—', t('구독 CLI가 잔량을 제공하지 않습니다.')],
    ];
    for (const [label, number, note] of values) { const metric = h('div', 'ia-metric'); metric.append(h('span', 'ia-metric-label', t(label)), h('strong', 'ia-metric-value', number), h('span', 'ia-metric-note', note)); metrics.append(metric); }
    const grid = h('div', 'ia-grid'); grid.append(dailyChart(value.byDay || []), historyChart(value.tokenHistory || []), durationChart(value.taskBars || [], performance.firstOutputLatencyMs), memoryPanel(value.memory), comparisonPanel(value.comparison));
    const footer = h('footer', 'ia-footnote'); footer.append(h('p', '', t('UTC 날짜 기준 · 저장된 기록의 범위이며 계정 전체 사용량이 아닙니다.')), h('p', '', t('운영 지표이며 모델 응답의 정확도나 품질을 측정하지 않습니다.')));
    if (value.meta?.legacyWorkspaceTasks) footer.append(h('p', '', t('작업 폴더가 없는 이전 기록 {count}건을 현재 프로젝트에 포함했습니다.', { count: n(value.meta.legacyWorkspaceTasks) })));
    root.replaceChildren(header, metrics, grid, footer); if (focused) refreshButton.focus({ preventScroll: true });
  }
  async function load() {
    if (!root || disposed) return;
    const version = ++generation, workspace = latestState.settings?.workspace;
    try {
      const response = options.api ? await options.api('/api/analytics') : await fetch('/api/analytics').then(result => { if (!result.ok) throw new Error('analytics'); return result.json(); });
      if (disposed || version !== generation || workspace !== latestState.settings?.workspace) return;
      const incoming = response?.analytics || response;
      if (!incoming || typeof incoming !== 'object' || !incoming.totals) throw new Error('analytics');
      data = incoming; paint(data);
    } catch {
      if (disposed || version !== generation) return;
      if (!data) root.replaceChildren(empty('분석 데이터를 불러오지 못했습니다.'));
      else { paint(data); const message = h('p', 'ia-load-error', t('분석 데이터를 불러오지 못했습니다.')); message.setAttribute('role', 'status'); root.prepend(message); }
    }
  }
  function render(state) {
    if (!root || disposed) return;
    latestState = state || options.getState?.() || {};
    const selectedLanguage = ['ko', 'en', 'ja'].includes(latestState.settings?.language) ? latestState.settings.language : 'ko';
    const languageChanged = selectedLanguage !== language; language = selectedLanguage;
    const current = JSON.stringify([latestState.settings?.workspace, (latestState.tasks || []).map(task => [task.id, task.status, task.createdAt, task.startedAt, task.finishedAt, task.firstOutputAt, task.usageReported, task.usage, task.memoryUsage])]);
    if (current !== signature) {
      if (data?.meta?.workspace !== latestState.settings?.workspace) { data = null; root.replaceChildren(empty('불러오는 중…')); }
      signature = current;
      if (!timer) timer = setTimeout(() => { timer = null; void load(); }, 150);
    } else if (languageChanged && data) paint(data);
  }
  function mount(container, configuration = {}) {
    clearTimeout(timer); timer = null; generation++; disposed = false; root = container; options = configuration; data = null; signature = '';
    if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('An analytics container is required');
    root.classList.add('ia-analytics'); root.setAttribute('aria-label', 'IMPERIUM analytics'); root.replaceChildren(empty('불러오는 중…')); render(options.getState?.() || {});
    return { render, refresh: load, destroy() { disposed = true; generation++; clearTimeout(timer); timer = null; root?.replaceChildren(); } };
  }
  window.ImperiumAnalytics = { mount, render, refresh: load };
}());
