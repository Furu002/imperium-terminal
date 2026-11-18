(function () {
  'use strict';
  const TEXT = {
    en: { '계정별 잔여 한도': 'Account allowance', '모델별 독립 잔액이 아니라 같은 CLI 로그인 계정에서 공유하는 한도입니다.': 'Allowance is shared by the CLI account, not a separate balance for each model.', '새로 조회': 'Refresh account data', '조회 중…': 'Checking…', '조회됨': 'Reported', '조회 불가': 'Unavailable', '로그인 필요': 'Sign-in needed', '조회 오류': 'Check failed', '오프라인': 'Offline', '로컬 모델': 'Local model', '잔여': 'Remaining', '사용': 'Used', '조회 대기': 'Awaiting data', '알 수 없음': 'Unknown', '계정 사용량 열기': 'Open account usage', '출처': 'Source', '확인 시각': 'Checked', '조회 기록 없음': 'No check recorded', '이전 조회값': 'Last reported value', '2분 이상 지난 정보': 'Over 2 minutes old', '리셋 시각이 지났습니다. 새 조회가 필요합니다.': 'The reported reset time has passed. Refresh to confirm.', '약 {time} 후 리셋 예정': 'Reported reset in ~{time}', '리셋 시각 미제공': 'Reset time unavailable', '크레딧 잔액': 'Credit balance', '추가 크레딧 없음': 'No additional credits', '크레딧 무제한': 'Unlimited credits', '잔액 비공개': 'Balance unavailable', '크레딧 정보 없음': 'Credit data unavailable', '로컬 모델에는 클라우드 계정 잔여 한도를 적용하지 않습니다.': 'Cloud account quotas do not apply to local models.', '로컬 전용 모드': 'Local-only mode', '클라우드 계정 한도와 외부 사용량 링크를 숨겼습니다.': 'Cloud allowance and external usage links are hidden.', '한도를 확인할 수 없습니다. 공식 계정 화면을 확인하세요.': 'Allowance is unavailable. Check the official account page.', '요청을 처리하지 못했습니다.': 'The request could not be completed.', '사용 구간': 'Usage window', '요청': 'requests', '크레딧': 'credits', '상세': 'Details', '분': 'min', '시간': 'h', '일': 'd', 'Codex 공식 계정 조회': 'Codex account server', 'Claude 공식 사용량 이벤트': 'Claude usage event', '아직 조회하지 않았습니다.': 'No account data has been checked yet.' },
    ja: { '계정별 잔여 한도': 'アカウントの利用枠', '모델별 독립 잔액이 아니라 같은 CLI 로그인 계정에서 공유하는 한도입니다.': 'モデル別の独立した残高ではなく、同じCLIログインの利用枠を共有します。', '새로 조회': 'アカウント情報を更新', '조회 중…': '確認中…', '조회됨': '取得済み', '조회 불가': '取得不可', '로그인 필요': '要ログイン', '조회 오류': '取得エラー', '오프라인': 'オフライン', '로컬 모델': 'ローカルモデル', '잔여': '残り', '사용': '使用', '조회 대기': 'データ待ち', '알 수 없음': '不明', '계정 사용량 열기': '利用状況を開く', '출처': '出典', '확인 시각': '確認日時', '조회 기록 없음': '確認記録なし', '이전 조회값': '前回の報告値', '2분 이상 지난 정보': '2分以上前の情報', '리셋 시각이 지났습니다. 새 조회가 필요합니다.': '報告されたリセット時刻を過ぎています。更新して確認してください。', '약 {time} 후 리셋 예정': '報告上のリセットまで約{time}', '리셋 시각 미제공': 'リセット時刻不明', '크레딧 잔액': 'クレジット残高', '추가 크레딧 없음': '追加クレジットなし', '크레딧 무제한': 'クレジット無制限', '잔액 비공개': '残高取得不可', '크레딧 정보 없음': 'クレジット情報なし', '로컬 모델에는 클라우드 계정 잔여 한도를 적용하지 않습니다.': 'ローカルモデルにはクラウドアカウントの利用枠を適用しません。', '로컬 전용 모드': 'ローカル専用モード', '클라우드 계정 한도와 외부 사용량 링크를 숨겼습니다.': 'クラウドの利用枠と外部リンクを非表示にしています。', '한도를 확인할 수 없습니다. 공식 계정 화면을 확인하세요.': '利用枠を取得できません。公式アカウント画面を確認してください。', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '사용 구간': '利用期間', '요청': 'リクエスト', '크레딧': 'クレジット', '상세': '詳細', '분': '分', '시간': '時間', '일': '日', 'Codex 공식 계정 조회': 'Codex公式アカウント', 'Claude 공식 사용량 이벤트': 'Claude公式使用量イベント', '아직 조회하지 않았습니다.': 'アカウント情報はまだ取得されていません。' },
  };
  Object.assign(TEXT.en, { 'Claude 공식 사용량 조회': 'Claude account usage', 'Copilot 공식 계정 조회': 'Copilot account quota', '공식 사용량 안내': 'Official usage guide', '버킷별 계정 보고값': 'Reported account buckets', '추가 사용 비활성': 'Extra usage disabled', '추가 사용 활성': 'Extra usage enabled', '추가 사용 금액': 'Extra usage amount', '금액 단위 확인 필요': 'Monetary unit needs confirmation', '한도': 'Limit' });
  Object.assign(TEXT.ja, { 'Claude 공식 사용량 조회': 'Claude公式使用量', 'Copilot 공식 계정 조회': 'Copilot公式利用枠', '공식 사용량 안내': '公式使用量ガイド', '버킷별 계정 보고값': '報告されたアカウント区分', '추가 사용 비활성': '追加使用は無効', '추가 사용 활성': '追加使用は有効', '추가 사용 금액': '追加使用金額', '금액 단위 확인 필요': '通貨単位の確認が必要', '한도': '上限' });
  const ALLOWED_USAGE_HOSTS = new Set(['chatgpt.com', 'claude.ai', 'github.com', 'aistudio.google.com', 'geminicli.com']);
  Object.assign(TEXT.en, { '펼치기': 'Expand', '접기': 'Collapse' });
  Object.assign(TEXT.ja, { '펼치기': '展開', '접기': '折りたたむ' });
  const h = (tag, attrs = {}, ...children) => { const element = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') element.className = value; else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== undefined && value !== null && value !== false) element.setAttribute(key, String(value)); } children.flat().forEach(child => { if (child !== undefined && child !== null) element.append(child instanceof Node ? child : document.createTextNode(String(child))); }); return element; };
  let root, callbacks = {}, state = {}, payload = { providers: [], localOnly: false }, generation = 0, mountGeneration = 0, lastMode = false, requestPromise = null, busy = false, errorMessage = '', compact = false, expanded = false, detailsElement = null;
  const lang = () => document.documentElement.lang || state.settings?.language || 'ko';
  const tr = (key, values = {}) => (TEXT[lang()]?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const percent = value => number(value) !== null && value <= 100 ? value : null;
  const displayNumber = value => value.toLocaleString(lang() === 'ko' ? 'ko-KR' : lang() === 'ja' ? 'ja-JP' : 'en-US', { maximumFractionDigits: 1 });
  const localMode = () => state.settings?.localOnly === true || payload.localOnly === true;
  const isLocal = provider => provider.id === 'ollama' || state.providers?.some(item => item.id === provider.id && item.kind === 'local');
  const time = value => { const parsed = new Date(value).getTime(); return value && Number.isFinite(parsed) ? parsed : null; };
  const checkedTime = value => time(value) === null ? tr('조회 기록 없음') : new Date(value).toLocaleString(lang() === 'ko' ? 'ko-KR' : lang() === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Seoul', hour12: false }) + ' KST';
  function usageLink(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && ALLOWED_USAGE_HOSTS.has(url.hostname) ? url.href : null; } catch { return null; }
  }
  function duration(milliseconds) {
    const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)}${tr('일')} ${Math.floor(minutes % 1440 / 60)}${tr('시간')}`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)}${tr('시간')} ${minutes % 60}${tr('분')}`;
    return `${minutes}${tr('분')}`;
  }
  async function request(force) {
    const path = force ? '/api/quotas/refresh' : '/api/quotas';
    if (callbacks.api) return callbacks.api(path, force ? { method: 'POST', body: {} } : {});
    const response = await fetch(path, force ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: '{}' } : {});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || tr('요청을 처리하지 못했습니다.')); return result;
  }
  function refresh(force = false) {
    if (!root) return Promise.resolve();
    if (!force && requestPromise && busy) return requestPromise;
    const current = ++generation, owner = mountGeneration, requestedMode = state.settings?.localOnly === true;
    busy = true; errorMessage = ''; draw();
    const currentRequest = (async () => {
      try {
        const result = await request(force);
        if (current !== generation || owner !== mountGeneration || requestedMode !== (state.settings?.localOnly === true)) return;
        payload = { providers: Array.isArray(result.providers) ? result.providers : [], localOnly: result.localOnly === true, refreshAfterMs: result.refreshAfterMs };
      } catch (error) { if (current === generation && owner === mountGeneration && requestedMode === (state.settings?.localOnly === true)) errorMessage = error.message || tr('요청을 처리하지 못했습니다.'); }
      finally { if (current === generation && owner === mountGeneration) { busy = false; requestPromise = null; draw(); } }
    })();
    requestPromise = currentRequest;
    return currentRequest;
  }
  function providerCards() {
    const data = new Map(payload.providers.map(provider => [provider.id, provider]));
    const selected = new Set(localMode() ? ['ollama'] : ['codex', 'claude']);
    for (const provider of state.providers || []) if (provider.installed || provider.status === 'ready') selected.add(provider.id);
    for (const connection of state.connections || []) selected.add(connection.providerId);
    for (const provider of payload.providers) if (provider.status === 'available') selected.add(provider.id);
    return [...selected].map(id => data.get(id) || { id, name: state.providers?.find(provider => provider.id === id)?.name || ({ codex: 'ChatGPT / Codex', claude: 'Claude Code', ollama: 'Ollama' }[id] || id), status: id === 'ollama' ? 'local' : 'unavailable', reason: tr('아직 조회하지 않았습니다.'), windows: [], credits: null, checkedAt: null, source: null, usageUrl: null }).filter(provider => !localMode() || isLocal(provider));
  }
  function renderWindow(window, provider, stale) {
    const remaining = percent(window.remainingPercent), used = percent(window.usedPercent), reset = time(window.resetsAt), expired = reset !== null && reset <= Date.now();
    const section = h('section', { class: `iq-window${expired ? ' iq-window-expired' : ''}`, 'data-quota-window': String(window.id || ''), 'data-reset-expired': expired ? 'true' : 'false' });
    section.append(h('div', { class: 'iq-window-heading' }, h('strong', {}, String(window.label || window.id || tr('사용 구간'))), ...(stale || expired ? [h('span', { class: 'iq-last-value' }, tr('이전 조회값'))] : [])),
      h('div', { class: 'iq-values' }, h('div', {}, h('span', {}, tr('잔여')), h('strong', { class: 'iq-remaining' }, remaining === null ? '—' : `${displayNumber(remaining)}%`)), h('span', { class: 'iq-used' }, `${tr('사용')} ${used === null ? tr('알 수 없음') : `${displayNumber(used)}%`}`)));
    const value = remaining !== null ? remaining : used;
    if (value !== null) {
      const fill = h('span', { class: `iq-meter-fill${remaining === null ? ' iq-meter-used' : ''}` }); fill.style.width = `${value}%`;
      section.append(h('div', { class: 'iq-meter', role: 'progressbar', 'aria-label': `${provider.name} · ${window.label || window.id || tr('사용 구간')} · ${tr(remaining !== null ? '잔여' : '사용')}${stale || expired ? ` · ${tr('이전 조회값')}` : ''}`, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': value }, fill));
    }
    if (number(window.remaining) !== null && ['requests', 'credits'].includes(window.unit)) section.append(h('p', { class: 'iq-remaining-count' }, `${tr('잔여')} ${displayNumber(window.remaining)}${number(window.limit) !== null ? ` / ${displayNumber(window.limit)}` : ''} ${tr(window.unit === 'credits' ? '크레딧' : '요청')}`));
    const resetText = expired ? tr('리셋 시각이 지났습니다. 새 조회가 필요합니다.') : reset !== null ? tr('약 {time} 후 리셋 예정', { time: duration(reset - Date.now()) }) : tr('리셋 시각 미제공');
    section.append(h('p', { class: `iq-reset${expired ? ' iq-reset-expired' : ''}`, title: reset !== null ? checkedTime(window.resetsAt) : '' }, resetText));
    return section;
  }
  function renderCard(provider) {
    const statusLabels = { available: '조회됨', unavailable: '조회 불가', login_required: '로그인 필요', error: '조회 오류', offline: '오프라인', local: '로컬 모델' };
    const checked = time(provider.checkedAt), stale = checked !== null && Date.now() - checked > 120000;
    const card = h('article', { class: `iq-card${stale ? ' iq-stale' : ''}`, 'data-quota-provider': provider.id, 'data-quota-status': provider.status, 'data-quota-stale': stale ? 'true' : 'false' });
    card.append(h('div', { class: 'iq-card-heading' }, h('div', { class: 'iq-provider-title' }, h('span', { class: 'iq-provider-mark', 'aria-hidden': 'true' }, String(provider.name || provider.id).slice(0, 1)), h('h3', {}, provider.name || provider.id)), h('span', { class: `iq-status iq-status-${provider.status}` }, tr(statusLabels[provider.status] || '조회 불가'))),
      h('div', { class: 'iq-account-meta' }, h('span', { class: 'iq-shared-badge', title: tr(isLocal(provider) ? '로컬 모델에는 클라우드 계정 잔여 한도를 적용하지 않습니다.' : '모델별 독립 잔액이 아니라 같은 CLI 로그인 계정에서 공유하는 한도입니다.') }, isLocal(provider) ? 'LOCAL' : 'ACCOUNT-SHARED'), ...(provider.planType ? [h('span', { class: 'iq-plan' }, String(provider.planType).slice(0, 80))] : [])));
    if (provider.status === 'local' || isLocal(provider)) card.append(h('p', { class: 'iq-provider-reason' }, tr('로컬 모델에는 클라우드 계정 잔여 한도를 적용하지 않습니다.')));
    else if (provider.status === 'available') {
      const windows = Array.isArray(provider.windows) ? provider.windows : [];
      if (windows.length) card.append(h('div', { class: 'iq-windows' }, ...windows.map(window => renderWindow(window, provider, stale))));
      else card.append(h('p', { class: 'iq-provider-reason' }, tr('한도를 확인할 수 없습니다. 공식 계정 화면을 확인하세요.')));
      const creditBalances = Array.isArray(provider.creditBalances) ? provider.creditBalances : [];
      if (creditBalances.length) card.append(h('div', { class: 'iq-credit-buckets' }, h('span', { class: 'iq-bucket-heading' }, tr('버킷별 계정 보고값')), ...creditBalances.map(bucket => h('div', { class: 'iq-credit-bucket', 'data-credit-bucket': bucket.id }, h('strong', {}, bucket.label || bucket.id), renderCredits(bucket)))));
      else card.append(renderCredits(provider.credits));
      if (provider.extraUsage?.enabled === false) card.append(h('div', { class: 'iq-extra-usage', 'data-extra-usage': 'disabled' }, tr('추가 사용 비활성')));
      else if (provider.extraUsage?.enabled === true) {
        const extra = provider.extraUsage, section = h('div', { class: 'iq-extra-usage', 'data-extra-usage': 'enabled' }, tr('추가 사용 활성'));
        if (typeof extra.currency === 'string' && /^[A-Z]{3}$/.test(extra.currency) && Number.isInteger(extra.decimalPlaces) && extra.decimalPlaces >= 0 && extra.decimalPlaces <= 6 && [extra.limit, extra.used, extra.remaining].every(value => number(value) !== null)) {
          // The server already normalized minor units into major currency values.
          const money = value => value.toLocaleString(lang() === 'ko' ? 'ko-KR' : lang() === 'ja' ? 'ja-JP' : 'en-US', { style: 'currency', currency: extra.currency, minimumFractionDigits: extra.decimalPlaces, maximumFractionDigits: extra.decimalPlaces });
          section.append(h('div', { class: 'iq-extra-values', 'data-currency': extra.currency }, ...[['한도', extra.limit], ['사용', extra.used], ['잔여', extra.remaining]].map(([key, value]) => h('span', { 'data-extra-field': key }, `${tr(key)} ${money(value)}`))));
        } else section.append(h('span', {}, ' · ', tr('금액 단위 확인 필요')));
        card.append(section);
      }
    } else card.append(h('p', { class: 'iq-provider-reason' }, provider.reason || tr('한도를 확인할 수 없습니다. 공식 계정 화면을 확인하세요.')));
    const sources = { 'codex-app-server': 'Codex 공식 계정 조회', 'claude-cli-event': 'Claude 공식 사용량 이벤트', 'claude-cli-usage': 'Claude 공식 사용량 조회', 'copilot-cli': 'Copilot 공식 계정 조회' };
    const footer = h('div', { class: 'iq-card-footer' }, h('span', { class: 'iq-checked', title: provider.checkedAt || '' }, `${tr('확인 시각')} · ${checkedTime(provider.checkedAt)}`));
    if (stale) footer.append(h('span', { class: 'iq-stale-badge' }, tr('2분 이상 지난 정보')));
    if (provider.source) footer.append(h('span', { class: 'iq-source' }, `${tr('출처')} · ${sources[provider.source] ? tr(sources[provider.source]) : String(provider.source)}`));
    const link = !localMode() && !isLocal(provider) ? usageLink(provider.usageUrl) : null;
    if (link) footer.append(h('a', { href: link, target: '_blank', rel: 'noreferrer noopener', 'data-official-usage': provider.id }, tr(new URL(link).hostname === 'geminicli.com' ? '공식 사용량 안내' : '계정 사용량 열기'), ' ↗'));
    card.append(footer);
    return card;
  }
  function renderCredits(credits) {
    const value = creditData(credits);
    return h('div', { class: 'iq-credits', 'data-credit-status': value.status }, value.text);
  }
  function creditData(credits) {
    const reported = typeof credits?.balance === 'string' && credits.balance.trim() !== '' || typeof credits?.balance === 'number' && number(credits.balance) !== null;
    if (reported) return { status: 'reported', text: `${tr('크레딧 잔액')} ${credits.balance}${credits.unlimited === true ? ` · ${tr('크레딧 무제한')}` : credits.hasCredits === false ? ` · ${tr('추가 크레딧 없음')}` : ''}` };
    if (credits?.unlimited === true) return { status: 'unlimited', text: tr('크레딧 무제한') };
    if (credits?.hasCredits === false) return { status: 'none', text: tr('추가 크레딧 없음') };
    return { status: 'unknown', text: tr(credits ? '잔액 비공개' : '크레딧 정보 없음') };
  }
  function renderCompactSummary() {
    const accounts = h('span', { class: 'iq-compact-accounts' });
    for (const provider of providerCards()) {
      const checked = time(provider.checkedAt), stale = checked !== null && Date.now() - checked > 120000;
      const meta = `${tr('출처')} · ${provider.source || tr('알 수 없음')}\n${tr('확인 시각')} · ${checkedTime(provider.checkedAt)}${stale ? `\n${tr('2분 이상 지난 정보')}` : ''}`;
      const item = h('span', { class: 'iq-compact-provider', 'data-compact-quota-provider': provider.id }, h('strong', { class: 'iq-compact-provider-name', title: meta }, provider.name || provider.id));
      if (!isLocal(provider)) item.append(h('span', { class: `iq-compact-freshness${stale ? ' iq-compact-old' : ''}`, 'data-quota-freshness': stale ? 'stale' : checked !== null ? 'known' : 'unknown', title: meta, 'aria-label': meta }, stale ? '†' : checked !== null ? '·' : '?'));
      if (provider.status === 'available' && !isLocal(provider)) {
        const windows = Array.isArray(provider.windows) ? provider.windows : [];
        if (!windows.length) item.append(h('span', { class: 'iq-compact-unknown' }, tr('알 수 없음')));
        for (const window of windows) {
          const remaining = percent(window.remainingPercent), reset = time(window.resetsAt), expired = reset !== null && reset <= Date.now(), old = stale || expired;
          const windowLabel = String(window.label || window.id || tr('사용 구간'));
          const caption = `${windowLabel} ${remaining === null ? '—' : `${displayNumber(remaining)}%`}${expired ? ' ↻' : stale ? ' †' : ''}`;
          item.append(h('span', { class: `iq-compact-window${old ? ' iq-compact-old' : ''}`, 'data-compact-quota-window': String(window.id || ''), 'aria-label': `${windowLabel} · ${tr('잔여')} ${remaining === null ? tr('알 수 없음') : `${displayNumber(remaining)}%`}${old ? ` · ${tr('이전 조회값')}` : ''}`, title: `${expired ? `${tr('리셋 시각이 지났습니다. 새 조회가 필요합니다.')}\n` : stale ? `${tr('2분 이상 지난 정보')}\n` : ''}${tr('확인 시각')} · ${checkedTime(provider.checkedAt)}` }, caption));
        }
        const balances = Array.isArray(provider.creditBalances) && provider.creditBalances.length ? provider.creditBalances : [provider.credits];
        for (const credits of balances) {
          const value = creditData(credits);
          item.append(h('span', { class: `iq-compact-credit${value.status === 'unknown' ? ' iq-compact-unknown' : ''}`, 'data-credit-status': value.status, title: value.text }, `${credits?.label ? `${credits.label}: ` : ''}${value.status === 'unknown' ? `${tr('크레딧')} —` : value.text}`));
        }
      } else item.append(h('span', { class: 'iq-compact-status' }, tr(isLocal(provider) ? '로컬 모델' : { login_required: '로그인 필요', error: '조회 오류', offline: '오프라인' }[provider.status] || '조회 불가')));
      accounts.append(item);
    }
    return h('summary', { class: 'iq-compact-summary' }, h('span', { class: 'iq-compact-heading' }, h('span', { class: 'iq-compact-chevron', 'aria-hidden': 'true' }, '›'), 'ACCOUNT ALLOWANCE'), accounts, h('span', { class: 'iq-compact-toggle-label' }, tr(expanded ? '접기' : '펼치기')));
  }
  function draw() {
    if (!root) return;
    if (detailsElement?.isConnected) expanded = detailsElement.open;
    const refreshButton = h('button', { class: 'iq-refresh', type: 'button', disabled: busy, 'data-quota-refresh': 'true', onclick: () => refresh(true) }, busy ? tr('조회 중…') : `↻ ${tr('새로 조회')}`);
    const nodes = [h('div', { class: 'iq-heading' }, h('div', {}, h('span', { class: 'iq-eyebrow' }, 'TOTAL ACCOUNT ALLOWANCE'), h('h2', {}, tr('계정별 잔여 한도')), h('p', {}, tr('모델별 독립 잔액이 아니라 같은 CLI 로그인 계정에서 공유하는 한도입니다.'))), refreshButton)];
    if (localMode()) nodes.push(h('p', { class: 'iq-local-notice' }, h('strong', {}, tr('로컬 전용 모드')), ' · ', tr('클라우드 계정 한도와 외부 사용량 링크를 숨겼습니다.')));
    nodes.push(h('div', { class: 'iq-provider-grid' }, ...providerCards().map(renderCard)));
    if (errorMessage) nodes.push(h('p', { class: 'iq-error', role: 'status' }, errorMessage));
    root.classList.add('iq-quotas'); root.classList.toggle('iq-quotas-compact', compact); root.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (compact) {
      const details = h('details', { class: 'iq-disclosure', ...(expanded ? { open: '' } : {}) }, renderCompactSummary(), h('div', { class: 'iq-expanded-body' }, ...nodes));
      detailsElement = details;
      details.addEventListener('toggle', () => { if (detailsElement !== details) return; expanded = details.open; const label = details.querySelector('.iq-compact-toggle-label'); if (label) label.textContent = tr(expanded ? '접기' : '펼치기'); });
      root.replaceChildren(details);
    } else { detailsElement = null; root.replaceChildren(...nodes); }
  }
  function render(incoming) {
    state = incoming || callbacks.getState?.() || state;
    if (!root) return;
    const mode = state.settings?.localOnly === true;
    if (mode !== lastMode) { lastMode = mode; generation++; busy = false; requestPromise = null; errorMessage = ''; draw(); void refresh(false); }
    else draw();
  }
  function mount(target, configuration = {}) {
    root = typeof target === 'string' ? document.querySelector(target) : target; callbacks = configuration; if (!root) return;
    state = callbacks.getState?.() || {}; generation++; mountGeneration++; lastMode = state.settings?.localOnly === true; requestPromise = null; busy = false; errorMessage = ''; compact = configuration.compact === true; expanded = false; detailsElement = null; payload = { providers: [], localOnly: false }; draw(); void refresh(false);
  }
  window.ImperiumQuotas = { mount, render, refresh };
})();
