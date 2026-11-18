(function () {
  'use strict';
  const TEXT = {
    en: { '실행 모델': 'Execution model', '추론 강도': 'Reasoning effort', '응답 속도': 'Response speed', '계정 모델 불러오기': 'Load account models', '조회 중…': 'Loading…', 'CLI 기본 모델': 'CLI default model', '현재 설정': 'Current setting', '모델 ID 직접 입력': 'Enter model ID', '모델 ID': 'Model ID', 'CLI·모델 기본값': 'CLI / model default', 'CLI 속도 설정 상속': 'Inherit CLI speed', 'Standard · Fast 끄기': 'Standard · Fast off', 'Fast · 계정 지원 필요': 'Fast · account support required', '지원 설정을 조회하고 있습니다.': 'Checking supported settings.', '지원 정보를 확인할 수 없어 기본 옵션만 사용합니다.': 'Support could not be verified; only default options are available.', '이 제공자는 기본 추론·속도 설정만 지원합니다.': 'This provider supports only default reasoning and speed settings.', '모델별 지원은 다를 수 있습니다. 실제 실행 시 계정과 모델이 허용하는 설정만 적용됩니다.': 'Support can vary by model. Execution remains subject to account and model capabilities.', '선택한 모델의 공식 메타데이터에 맞춰 옵션을 제한했습니다.': 'Options follow the selected model’s reported metadata.', '지원되지 않는 설정을 기본값으로 변경했습니다.': 'Unsupported settings were reset to default.', 'Fast는 추가 사용량이 발생할 수 있으며 계정·모델 지원에 따라 달라집니다.': 'Fast may use more allowance and depends on account and model support.', 'Claude Fast는 별도 사용 크레딧을 사용합니다. 계정·모델의 지원이 필요합니다.': 'Claude Fast uses separate usage credits and requires account and model support.', '기본 속도는 CLI 설정을 상속합니다. Standard는 Fast를 명시적으로 끕니다.': 'Default inherits CLI settings. Standard explicitly turns Fast off.', '모델 ID를 입력하세요.': 'Enter a model ID.', '모델 ID는 영문·숫자로 시작하고 영문·숫자·점·밑줄·콜론·슬래시·하이픈으로 200자 이내여야 합니다.': 'Model IDs must start with a letter or digit and use only letters, digits, dots, underscores, colons, slashes or hyphens, up to 200 characters.', '계정에서 확인': 'Account discovery', 'CLI 별칭': 'CLI alias', '로컬 모델': 'Local model', '직접 입력': 'Manual entry', '접근 권한 미확인': 'Access not verified', '모델 목록을 자동으로 확인할 수 없습니다. 현재 설정 또는 수동 ID를 사용할 수 있습니다.': 'Automatic discovery is unavailable. Keep the current setting or enter an ID.', '모델 기본 추론': 'Reported default effort', '선택 가능한 모델이 없습니다.': 'No models were returned.', '요청을 처리하지 못했습니다.': 'The request could not be completed.', '지원 확인 중': 'Checking support', '이름을 알 수 없는 제공자': 'Unknown provider' },
    ja: { '실행 모델': '実行モデル', '추론 강도': '推論の強度', '응답 속도': '応答速度', '계정 모델 불러오기': 'アカウントのモデルを取得', '조회 중…': '取得中…', 'CLI 기본 모델': 'CLIの既定モデル', '현재 설정': '現在の設定', '모델 ID 직접 입력': 'モデルIDを直接入力', '모델 ID': 'モデルID', 'CLI·모델 기본값': 'CLI・モデルの既定値', 'CLI 속도 설정 상속': 'CLIの速度設定を継承', 'Standard · Fast 끄기': 'Standard · Fastを無効', 'Fast · 계정 지원 필요': 'Fast · アカウント対応が必要', '지원 설정을 조회하고 있습니다.': '対応する設定を確認しています。', '지원 정보를 확인할 수 없어 기본 옵션만 사용합니다.': '対応情報を確認できないため、既定の設定のみ使用します。', '이 제공자는 기본 추론·속도 설정만 지원합니다.': 'このプロバイダーは既定の推論・速度設定のみ対応します。', '모델별 지원은 다를 수 있습니다. 실제 실행 시 계정과 모델이 허용하는 설정만 적용됩니다.': '対応状況はモデルごとに異なります。実行時はアカウントとモデルが許可する設定のみ適用されます。', '선택한 모델의 공식 메타데이터에 맞춰 옵션을 제한했습니다.': '選択したモデルの報告メタデータに基づく設定です。', '지원되지 않는 설정을 기본값으로 변경했습니다.': '非対応の設定を既定値に戻しました。', 'Fast는 추가 사용량이 발생할 수 있으며 계정·모델 지원에 따라 달라집니다.': 'Fastは利用枠を多く消費する場合があり、アカウントとモデルの対応が必要です。', 'Claude Fast는 별도 사용 크레딧을 사용합니다. 계정·모델의 지원이 필요합니다.': 'Claude Fastは別枠の使用クレジットを消費し、アカウントとモデルの対応が必要です。', '기본 속도는 CLI 설정을 상속합니다. Standard는 Fast를 명시적으로 끕니다.': '既定はCLI設定を継承します。StandardはFastを明示的に無効にします。', '모델 ID를 입력하세요.': 'モデルIDを入力してください。', '모델 ID는 영문·숫자로 시작하고 영문·숫자·점·밑줄·콜론·슬래시·하이픈으로 200자 이내여야 합니다.': 'モデルIDは英数字で始め、英数字・ピリオド・下線・コロン・スラッシュ・ハイフンのみで200文字以内にしてください。', '계정에서 확인': 'アカウントから取得', 'CLI 별칭': 'CLIエイリアス', '로컬 모델': 'ローカルモデル', '직접 입력': '直接入力', '접근 권한 미확인': '利用権限未確認', '모델 목록을 자동으로 확인할 수 없습니다. 현재 설정 또는 수동 ID를 사용할 수 있습니다.': 'モデル一覧を自動取得できません。現在の設定または手入力のIDを利用できます。', '모델 기본 추론': '報告された既定の推論', '선택 가능한 모델이 없습니다.': 'モデルが返されませんでした。', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。', '지원 확인 중': '対応状況を確認中', '이름을 알 수 없는 제공자': '不明なプロバイダー' },
  };
  Object.assign(TEXT.en, {
    '로그인한 공식 CLI가 반환한 계정 모델과 지원 설정입니다. 계정·조직 정책에 따라 실행 시 조정되거나 거절될 수 있습니다.': 'Account models and supported settings reported by the signed-in official CLI. Account or organization policies may adjust or reject these settings at execution.',
    '이 컴퓨터의 Ollama에서 조회한 설치 모델입니다. 클라우드 모델은 제외했습니다.': 'Installed models reported by Ollama on this computer. Cloud models are excluded.',
    '계정 모델 조회에 실패해 공식 별칭만 표시합니다. 지원 설정 확인 전에는 기본값을 사용하세요.': 'Account model discovery failed; only official aliases are shown. Use defaults until supported settings are verified.',
    'Codex 모델 목록을 불러오지 못했습니다. Codex CLI 로그인과 버전을 확인하거나 모델 ID를 직접 입력하세요.': 'The Codex model list could not be loaded. Check the Codex CLI sign-in and version, or enter a model ID.',
    '로컬 Ollama 서비스에 연결하지 못했습니다. Ollama를 실행하고 모델 설치 상태를 확인하세요.': 'The local Ollama service could not be reached. Start Ollama and check the installed models.',
  });
  Object.assign(TEXT.ja, {
    '로그인한 공식 CLI가 반환한 계정 모델과 지원 설정입니다. 계정·조직 정책에 따라 실행 시 조정되거나 거절될 수 있습니다.': 'ログイン済みの公式CLIが返したアカウントのモデルと対応設定です。実行時にアカウントや組織のポリシーにより調整・拒否される場合があります。',
    '이 컴퓨터의 Ollama에서 조회한 설치 모델입니다. 클라우드 모델은 제외했습니다.': 'このコンピューターのOllamaから取得したインストール済みモデルです。クラウドモデルは除外しています。',
    '계정 모델 조회에 실패해 공식 별칭만 표시합니다. 지원 설정 확인 전에는 기본값을 사용하세요.': 'アカウントのモデル取得に失敗したため、公式エイリアスのみ表示します。対応設定を確認するまでは既定値を使用してください。',
    'Codex 모델 목록을 불러오지 못했습니다. Codex CLI 로그인과 버전을 확인하거나 모델 ID를 직접 입력하세요.': 'Codexのモデル一覧を取得できませんでした。Codex CLIのログイン状態とバージョンを確認するか、モデルIDを直接入力してください。',
    '로컬 Ollama 서비스에 연결하지 못했습니다. Ollama를 실행하고 모델 설치 상태를 확인하세요.': 'ローカルのOllamaサービスに接続できませんでした。Ollamaを起動し、モデルのインストール状況を確認してください。',
  });
  const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
  const SAFE_OPTION = /^[a-z][a-z0-9_-]{0,31}$/;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  let sequence = 0;
  const h = (tag, attrs = {}, ...children) => { const element = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (key === 'class') element.className = value; else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== undefined && value !== null && value !== false) element.setAttribute(key, String(value)); } children.flat().forEach(child => { if (child !== undefined && child !== null) element.append(child instanceof Node ? child : document.createTextNode(String(child))); }); return element; };
  function create(configuration = {}) {
    const id = ++sequence, element = h('section', { class: 'ie-options', 'data-execution-instance': id });
    const api = configuration.api, onChange = configuration.onChange;
    let provider = String(configuration.provider || ''), modelId = String(configuration.modelId || ''), reasoningEffort = String(configuration.reasoningEffort || 'default'), speed = String(configuration.speed || 'default');
    let capabilities = { reasoningEfforts: ['default'], speeds: ['default'] }, capabilityStatus = 'loading', models = [], modelDetail = '', modelDetailKey = '', modelLoading = false, manual = false, errorMessage = '', resetNotice = false, destroyed = false, contextGeneration = 0, capabilityGeneration = 0, modelGeneration = 0, lastEmitted = JSON.stringify({ modelId, reasoningEffort, speed });
    let modelSelect, effortSelect, speedSelect, manualInput, notes, error, lookup;
    const lang = () => document.documentElement.lang || 'ko';
    const tr = key => TEXT[lang()]?.[key] ?? key;
    const uniqueOptions = value => [...new Set(['default', ...(Array.isArray(value) ? value.filter(item => typeof item === 'string' && SAFE_OPTION.test(item)) : [])])];
    const activeMetadata = () => modelId ? models.find(model => model.id === modelId || model.resolvedModel === modelId || Array.isArray(model.aliases) && model.aliases.includes(modelId)) : models.find(model => model.isDefault === true);
    const modelEfforts = model => Array.isArray(model?.supportedReasoningEfforts) ? model.supportedReasoningEfforts : Array.isArray(model?.supportsReasoningEfforts) ? model.supportsReasoningEfforts : null;
    const allowedEfforts = () => { const metadata = activeMetadata(), list = modelEfforts(metadata); return list === null ? capabilities.reasoningEfforts : capabilities.reasoningEfforts.filter(value => value === 'default' || list.includes(value)); };
    const allowedSpeeds = () => activeMetadata()?.supportsFastMode === false ? capabilities.speeds.filter(value => value !== 'fast') : capabilities.speeds;
    const sourceLabel = source => tr({ account: '계정에서 확인', alias: 'CLI 별칭', local: '로컬 모델', manual: '직접 입력' }[source] || '접근 권한 미확인');
    const effortLabel = value => value === 'default' ? tr('CLI·모델 기본값') : value.toUpperCase();
    const speedLabel = value => value === 'default' ? tr('CLI 속도 설정 상속') : value === 'standard' ? tr('Standard · Fast 끄기') : value === 'fast' ? tr('Fast · 계정 지원 필요') : value.toUpperCase();
    async function request(path) {
      if (typeof api === 'function') return api(path, {});
      const response = await fetch(path); const result = await response.json(); if (!response.ok) throw new Error(result.error || tr('요청을 처리하지 못했습니다.')); return result;
    }
    function validation() {
      const value = manual && manualInput ? manualInput.value.trim() : modelId;
      if (manual && !value) return tr('모델 ID를 입력하세요.');
      if (value && !MODEL_ID.test(value)) return tr('모델 ID는 영문·숫자로 시작하고 영문·숫자·점·밑줄·콜론·슬래시·하이픈으로 200자 이내여야 합니다.');
      return '';
    }
    function getValue() {
      const message = validation(); if (message) { errorMessage = message; renderNotes(); throw new Error(message); }
      return { modelId: manual && manualInput ? manualInput.value.trim() : modelId, reasoningEffort, speed };
    }
    function emit() {
      if (destroyed || validation()) return;
      const value = getValue(), signature = JSON.stringify(value);
      if (signature === lastEmitted) return;
      lastEmitted = signature; if (typeof onChange === 'function') onChange(value);
    }
    function constrain() {
      if (capabilityStatus === 'loading') return;
      let changed = false;
      if (!allowedEfforts().includes(reasoningEffort)) { reasoningEffort = 'default'; changed = true; }
      if (!allowedSpeeds().includes(speed)) { speed = 'default'; changed = true; }
      if (changed) resetNotice = true;
    }
    function renderNotes() {
      if (!notes || destroyed) return;
      const metadata = activeMetadata(), children = [];
      const key = capabilityStatus === 'loading' ? '지원 설정을 조회하고 있습니다.' : capabilityStatus === 'unavailable' ? '지원 정보를 확인할 수 없어 기본 옵션만 사용합니다.' : capabilities.reasoningEfforts.length === 1 && capabilities.speeds.length === 1 ? '이 제공자는 기본 추론·속도 설정만 지원합니다.' : metadata && (modelEfforts(metadata) !== null || typeof metadata.supportsFastMode === 'boolean') ? '선택한 모델의 공식 메타데이터에 맞춰 옵션을 제한했습니다.' : '모델별 지원은 다를 수 있습니다. 실제 실행 시 계정과 모델이 허용하는 설정만 적용됩니다.';
      children.push(h('p', { class: 'ie-capability-note', 'data-execution-capability-status': capabilityStatus }, tr(key)));
      if (metadata?.defaultReasoningEffort) children.push(h('p', { class: 'ie-model-default' }, `${tr('모델 기본 추론')} · ${String(metadata.defaultReasoningEffort).toUpperCase()}`));
      if (resetNotice) children.push(h('p', { class: 'ie-reset-note' }, tr('지원되지 않는 설정을 기본값으로 변경했습니다.')));
      if (capabilities.speeds.includes('fast')) children.push(h('p', { class: `ie-fast-note${speed === 'fast' ? ' ie-fast-selected' : ''}` }, tr(provider === 'claude' ? 'Claude Fast는 별도 사용 크레딧을 사용합니다. 계정·모델의 지원이 필요합니다.' : 'Fast는 추가 사용량이 발생할 수 있으며 계정·모델 지원에 따라 달라집니다.'), ' ', tr('기본 속도는 CLI 설정을 상속합니다. Standard는 Fast를 명시적으로 끕니다.')));
      if (modelDetail || modelDetailKey) children.push(h('p', { class: 'ie-discovery-detail' }, tr(modelDetailKey || modelDetail)));
      if (errorMessage && validation()) errorMessage = validation();
      notes.replaceChildren(...children); error.textContent = errorMessage; error.hidden = !errorMessage;
      if (manualInput) manualInput.setAttribute('aria-invalid', validation() ? 'true' : 'false');
    }
    function syncKnobs() {
      effortSelect.replaceChildren(...allowedEfforts().map(value => h('option', { value }, effortLabel(value))));
      if (capabilityStatus === 'loading' && reasoningEffort !== 'default' && !allowedEfforts().includes(reasoningEffort)) effortSelect.append(h('option', { value: reasoningEffort }, `${reasoningEffort.toUpperCase()} · ${tr('지원 확인 중')}`));
      effortSelect.value = reasoningEffort; effortSelect.disabled = capabilityStatus === 'loading' || allowedEfforts().length < 2;
      speedSelect.replaceChildren(...allowedSpeeds().map(value => h('option', { value }, speedLabel(value))));
      if (capabilityStatus === 'loading' && speed !== 'default' && !allowedSpeeds().includes(speed)) speedSelect.append(h('option', { value: speed }, `${speed.toUpperCase()} · ${tr('지원 확인 중')}`));
      speedSelect.value = speed; speedSelect.disabled = capabilityStatus === 'loading' || allowedSpeeds().length < 2;
    }
    function render() {
      if (destroyed) return;
      element.dataset.provider = provider;
      modelSelect = h('select', { id: `ie-model-${id}`, 'data-execution-model': 'true', 'aria-label': tr('실행 모델') }, h('option', { value: '' }, tr('CLI 기본 모델')));
      if (modelId && !models.some(model => model.id === modelId)) modelSelect.append(h('option', { value: modelId, 'data-model-source': 'current' }, `${tr('현재 설정')} · ${modelId}`));
      for (const model of models) modelSelect.append(h('option', { value: model.id, 'data-model-source': model.source || 'manual' }, `${model.name || model.id} · ${sourceLabel(model.source)}`));
      modelSelect.append(h('option', { value: '__manual__' }, tr('모델 ID 직접 입력'))); modelSelect.value = manual ? '__manual__' : modelId;
      lookup = h('button', { type: 'button', 'data-execution-load-models': 'true', disabled: modelLoading || !provider, onclick: loadModels }, tr(modelLoading ? '조회 중…' : '계정 모델 불러오기'));
      manualInput = h('input', { id: `ie-manual-${id}`, type: 'text', value: modelId, maxlength: '200', placeholder: tr('모델 ID'), 'aria-label': tr('모델 ID'), 'data-execution-model-manual': 'true', hidden: !manual, autocomplete: 'off', spellcheck: 'false', 'aria-describedby': `ie-error-${id}` });
      effortSelect = h('select', { id: `ie-effort-${id}`, 'data-execution-effort': 'true', 'aria-label': tr('추론 강도'), 'aria-describedby': `ie-notes-${id}` }, ...allowedEfforts().map(value => h('option', { value }, effortLabel(value))));
      if (capabilityStatus === 'loading' && reasoningEffort !== 'default' && !allowedEfforts().includes(reasoningEffort)) effortSelect.append(h('option', { value: reasoningEffort }, `${reasoningEffort.toUpperCase()} · ${tr('지원 확인 중')}`));
      effortSelect.value = reasoningEffort; effortSelect.disabled = capabilityStatus === 'loading' || allowedEfforts().length < 2;
      speedSelect = h('select', { id: `ie-speed-${id}`, 'data-execution-speed': 'true', 'aria-label': tr('응답 속도'), 'aria-describedby': `ie-notes-${id}` }, ...allowedSpeeds().map(value => h('option', { value }, speedLabel(value))));
      if (capabilityStatus === 'loading' && speed !== 'default' && !allowedSpeeds().includes(speed)) speedSelect.append(h('option', { value: speed }, `${speed.toUpperCase()} · ${tr('지원 확인 중')}`));
      speedSelect.value = speed; speedSelect.disabled = capabilityStatus === 'loading' || allowedSpeeds().length < 2;
      notes = h('div', { class: 'ie-notes', id: `ie-notes-${id}` }); error = h('p', { class: 'ie-error', id: `ie-error-${id}`, role: 'alert', hidden: '' });
      const modelField = h('div', { class: 'ie-field ie-model-field' }, h('div', { class: 'ie-model-label-row' }, h('label', { for: `ie-model-${id}` }, tr('실행 모델')), lookup), modelSelect, manualInput);
      element.replaceChildren(h('div', { class: 'ie-grid' }, modelField, h('label', { class: 'ie-field' }, h('span', {}, tr('추론 강도')), effortSelect), h('label', { class: 'ie-field' }, h('span', {}, tr('응답 속도')), speedSelect)), notes, error);
      modelSelect.addEventListener('change', () => { manual = modelSelect.value === '__manual__'; if (!manual) modelId = modelSelect.value; resetNotice = false; errorMessage = ''; constrain(); render(); emit(); if (manual) manualInput.focus(); });
      manualInput.addEventListener('input', () => { modelId = manualInput.value.trim(); resetNotice = false; errorMessage = validation(); constrain(); syncKnobs(); renderNotes(); emit(); });
      effortSelect.addEventListener('change', () => { reasoningEffort = effortSelect.value; resetNotice = false; errorMessage = ''; renderNotes(); emit(); });
      speedSelect.addEventListener('change', () => { speed = speedSelect.value; resetNotice = false; errorMessage = ''; renderNotes(); emit(); });
      renderNotes();
    }
    async function loadCapabilities() {
      const generation = ++capabilityGeneration, context = contextGeneration, requestedProvider = provider;
      capabilityStatus = 'loading'; render();
      try {
        const result = await request('/api/execution/capabilities');
        if (destroyed || generation !== capabilityGeneration || context !== contextGeneration || requestedProvider !== provider) return;
        const reported = result.providers?.[provider];
        if (reported && Array.isArray(reported.reasoningEfforts) && Array.isArray(reported.speeds)) { capabilities = { reasoningEfforts: uniqueOptions(reported.reasoningEfforts), speeds: uniqueOptions(reported.speeds) }; capabilityStatus = 'available'; }
        else { capabilities = { reasoningEfforts: ['default'], speeds: ['default'] }; capabilityStatus = 'unavailable'; }
      } catch {
        if (destroyed || generation !== capabilityGeneration || context !== contextGeneration || requestedProvider !== provider) return;
        capabilities = { reasoningEfforts: ['default'], speeds: ['default'] }; capabilityStatus = 'unavailable';
      }
      constrain(); render(); emit();
    }
    async function loadModels() {
      if (!provider || destroyed) return;
      const generation = ++modelGeneration, context = contextGeneration, requestedProvider = provider;
      modelLoading = true; modelDetail = ''; modelDetailKey = ''; render();
      try {
        const result = await request(`/api/providers/${encodeURIComponent(provider)}/models`);
        if (destroyed || generation !== modelGeneration || context !== contextGeneration || requestedProvider !== provider) return;
        const seen = new Set(); models = (Array.isArray(result.models) ? result.models : []).filter(model => model && typeof model.id === 'string' && MODEL_ID.test(model.id) && !seen.has(model.id) && seen.add(model.id));
        modelDetail = typeof result.detail === 'string' ? result.detail : ''; modelDetailKey = !modelDetail && !models.length ? '선택 가능한 모델이 없습니다.' : '';
      } catch {
        if (destroyed || generation !== modelGeneration || context !== contextGeneration || requestedProvider !== provider) return;
        modelDetailKey = '모델 목록을 자동으로 확인할 수 없습니다. 현재 설정 또는 수동 ID를 사용할 수 있습니다.';
      }
      modelLoading = false; constrain(); render(); emit();
    }
    function setContext(next = {}) {
      if (destroyed) return;
      const changed = own(next, 'provider') && String(next.provider || '') !== provider;
      if (changed) { provider = String(next.provider || ''); contextGeneration++; modelGeneration++; modelLoading = false; models = []; modelDetail = ''; modelDetailKey = ''; manual = false; modelId = own(next, 'modelId') ? String(next.modelId || '') : ''; reasoningEffort = own(next, 'reasoningEffort') ? String(next.reasoningEffort || 'default') : 'default'; speed = own(next, 'speed') ? String(next.speed || 'default') : 'default'; capabilities = { reasoningEfforts: ['default'], speeds: ['default'] }; capabilityStatus = 'loading'; }
      else { if (own(next, 'modelId')) { modelId = String(next.modelId || ''); manual = false; } if (own(next, 'reasoningEffort')) reasoningEffort = String(next.reasoningEffort || 'default'); if (own(next, 'speed')) speed = String(next.speed || 'default'); }
      errorMessage = ''; resetNotice = false; constrain(); render(); emit(); if (changed) void loadCapabilities();
    }
    const observer = new MutationObserver(() => { if (!destroyed) render(); }); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render(); void loadCapabilities();
    return { element, getValue, setContext, destroy() { destroyed = true; contextGeneration++; capabilityGeneration++; modelGeneration++; observer.disconnect(); element.remove(); } };
  }
  window.ImperiumExecution = { create };
})();
