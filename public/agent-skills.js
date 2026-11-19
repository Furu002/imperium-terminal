/* Local skill catalog, equipment and preview. No installation or model dispatch. */
(function () {
  'use strict';
  const WORDS = {
    ko: { title: '스킬 관리', intro: '프로젝트 안의 SKILL.md를 등록하고 에이전트 역할에 장착합니다.', local: 'LOCAL / PROJECT SCOPED', register: '로컬 스킬 등록', path: 'SKILL.md 경로', pathHint: '예: skills/review/SKILL.md', origin: 'GitHub 출처 URL · 선택', originHint: 'https://github.com/owner/repository', sourceNote: '출처 URL은 사용자 입력 메타데이터입니다. 원격 조회·설치·라이선스 검증은 하지 않습니다.', registerButton: '등록', catalog: '등록한 스킬', empty: '이 프로젝트에 등록된 스킬이 없습니다.', preview: '원문 보기', remove: '등록 삭제', agent: '장착할 에이전트', noAgents: '먼저 조직에서 에이전트 역할을 만드세요.', equipment: '역할에 장착', save: '장착 저장', equipped: '장착됨', unequipped: '미장착', registered: '등록됨', unobserved: '장착과 실제 사용은 다릅니다. 사용 여부는 실행 기록의 관측·모델 보고로 확인하세요.', permission: '등록·장착은 도구를 설치하거나 실행 권한을 확대하지 않습니다. 실행마다 파일과 버전을 다시 확인하며 지침 합계는 16 KiB 이내입니다.', license: '라이선스 미검증', unverified: '사용자 입력 출처 · 미검증', previewEmpty: '스킬을 선택하면 고정된 원문과 버전을 확인할 수 있습니다.', content: '등록한 버전의 원문', version: 'SHA-256 고정 버전', refresh: '새로고침', loading: '불러오는 중…', saved: '장착을 저장했습니다.', added: '로컬 스킬을 등록했습니다.', removed: '스킬 등록을 삭제했습니다.', error: '스킬 요청을 처리하지 못했습니다.', deleteTitle: '스킬 등록 삭제', deleteNote: '이 프로젝트의 등록과 모든 에이전트 장착을 해제합니다. 원본 SKILL.md와 기존 실행 기록은 보존됩니다.', confirm: '등록 삭제 확인', cancel: '취소', selectAgent: '에이전트를 선택하세요.', bytes: '바이트', changed: '저장하지 않은 장착 변경', noOrigin: '로컬 파일 · 외부 출처 미입력', scopeChanged: '프로젝트가 변경되었습니다. 다시 시도해 주세요.' },
    en: { title: 'Agent skills', intro: 'Register a SKILL.md inside this project and equip agent roles.', local: 'LOCAL / PROJECT SCOPED', register: 'Register a local skill', path: 'SKILL.md path', pathHint: 'Example: skills/review/SKILL.md', origin: 'GitHub source URL · optional', originHint: 'https://github.com/owner/repository', sourceNote: 'The source URL is user-supplied metadata. No remote lookup, installation or license verification is performed.', registerButton: 'Register', catalog: 'Registered skills', empty: 'No skills are registered in this project.', preview: 'View source', remove: 'Remove registration', agent: 'Agent to equip', noAgents: 'Create an agent role in Organization first.', equipment: 'Equip a role', save: 'Save equipment', equipped: 'Equipped', unequipped: 'Not equipped', registered: 'Registered', unobserved: 'Equipment is separate from actual use. Check observed events and model reports in run history.', permission: 'Registration and equipment do not install tools or expand permissions. Files and pinned versions are checked for every run; combined instructions are limited to 16 KiB.', license: 'License unverified', unverified: 'User-supplied source · unverified', previewEmpty: 'Select a skill to inspect its pinned source and version.', content: 'Registered source version', version: 'SHA-256 pinned version', refresh: 'Refresh', loading: 'Loading…', saved: 'Equipment saved.', added: 'Local skill registered.', removed: 'Skill registration removed.', error: 'The skill request could not be completed.', deleteTitle: 'Remove skill registration', deleteNote: 'Removes this project registration and unequips it from all agents. The original SKILL.md and existing run records are retained.', confirm: 'Confirm removal', cancel: 'Cancel', selectAgent: 'Select an agent.', bytes: 'bytes', changed: 'Unsaved equipment changes', noOrigin: 'Local file · no external source supplied', scopeChanged: 'The project changed. Please try again.' },
    ja: { title: 'スキル管理', intro: 'プロジェクト内のSKILL.mdを登録し、エージェントの役割に装備します。', local: 'LOCAL / PROJECT SCOPED', register: 'ローカルスキルを登録', path: 'SKILL.mdのパス', pathHint: '例: skills/review/SKILL.md', origin: 'GitHubの出典URL・任意', originHint: 'https://github.com/owner/repository', sourceNote: '出典URLはユーザー入力の情報です。リモート取得・インストール・ライセンス検証は行いません。', registerButton: '登録', catalog: '登録済みスキル', empty: 'このプロジェクトに登録されたスキルはありません。', preview: '原文を表示', remove: '登録を削除', agent: '装備するエージェント', noAgents: '先に組織でエージェントの役割を作成してください。', equipment: '役割に装備', save: '装備を保存', equipped: '装備済み', unequipped: '未装備', registered: '登録済み', unobserved: '装備と実際の使用は別です。実行履歴の観測記録・モデル報告で確認してください。', permission: '登録・装備でツールのインストールや権限拡張は行いません。毎回ファイルと固定バージョンを確認し、指示の合計は16 KiB以内です。', license: 'ライセンス未検証', unverified: 'ユーザー入力の出典・未検証', previewEmpty: 'スキルを選ぶと固定された原文とバージョンを確認できます。', content: '登録したバージョンの原文', version: 'SHA-256固定バージョン', refresh: '更新', loading: '読み込み中…', saved: '装備を保存しました。', added: 'ローカルスキルを登録しました。', removed: 'スキル登録を削除しました。', error: 'スキルのリクエストを処理できませんでした。', deleteTitle: 'スキル登録を削除', deleteNote: 'このプロジェクトの登録と全エージェントの装備を解除します。元のSKILL.mdと既存の実行記録は保持します。', confirm: '登録の削除を確認', cancel: 'キャンセル', selectAgent: 'エージェントを選択してください。', bytes: 'バイト', changed: '未保存の装備変更', noOrigin: 'ローカルファイル・外部出典なし', scopeChanged: 'プロジェクトが変わりました。もう一度お試しください。' },
  };
  const scope = value => { const text = typeof value === 'string' ? value.replace(/\\/g, '/').replace(/\/+$/, '') : ''; return /^[A-Za-z]:\//.test(text) ? text.toLowerCase() : text; };
  const h = (tag, attributes = {}, ...children) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attributes)) { if (key === 'class') node.className = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else if (value !== undefined && value !== false) node.setAttribute(key, String(value)); } for (const child of children.flat()) if (child !== undefined && child !== null) node.append(child instanceof Node ? child : document.createTextNode(String(child))); return node; };
  let host, callbacks = {}, state = {}, project = '', language = 'ko', epoch = 0, serial = 0, detailSerial = 0, visibility = false;
  let loaded = false, pending = false, busy = false, observedRevision, data = { skills: [], bindings: {}, revision: 0 }, roleId = '', draft = new Set(), dirty = false;
  let message, catalog, equipment, roleSelect, preview, pathInput, originInput, registerButton, saveButton, dialog, selected = '', externalAgent;
  const tr = key => WORDS[language][key] || key;
  const visible = () => Boolean(visibility && host?.isConnected && !host.hidden);
  const current = (key, owner) => Boolean(host?.isConnected && owner === epoch && key === project && scope((callbacks.getState?.() || state).settings?.workspace) === key);
  function announce(text = '', error = false) { if (message) { message.textContent = text; message.classList.toggle('isk-error', error); } }
  async function api(url, key, method = 'GET', body) {
    const target = method === 'GET' ? `${url}${url.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(key)}` : url;
    const options = method === 'GET' ? {} : { method, body: { ...body, workspace: key } };
    if (callbacks.api) return callbacks.api(target, options);
    const response = await fetch(target, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-hq-token': state.server?.csrfToken || '' }, body: method === 'GET' ? undefined : JSON.stringify(options.body) });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || tr('error')); return value;
  }
  function accept(value, key) {
    if (scope(value?.workspace) !== key || !Array.isArray(value.skills) || !value.bindings || typeof value.bindings !== 'object') throw new Error(tr('scopeChanged'));
    data = { skills: value.skills.filter(skill => typeof skill?.id === 'string').slice(0, 200), bindings: value.bindings, revision: value.revision };
    draft = dirty ? new Set([...draft].filter(id => data.skills.some(skill => skill.id === id))) : new Set(data.bindings[roleId] || []);
  }
  const field = (label, input) => h('label', { class: 'isk-field' }, h('span', {}, label), input);
  function setRole(id) { roleId = id; draft = new Set(data.bindings[id] || []); dirty = false; draw(); }
  function drawEquipment() {
    const roles = Array.isArray(state.departments) ? state.departments : [];
    if (!roles.some(role => role.id === roleId)) { roleId = roles[0]?.id || ''; draft = new Set(data.bindings[roleId] || []); dirty = false; }
    roleSelect.replaceChildren(...(roles.length ? roles.map(role => h('option', { value: role.id }, role.name || role.id, role.title ? ` · ${role.title}` : '')) : [h('option', { value: '' }, tr('selectAgent'))]));
    roleSelect.value = roleId; roleSelect.disabled = busy || !roles.length;
    equipment.replaceChildren(...(!roles.length ? [h('p', { class: 'isk-empty' }, tr('noAgents'))] : data.skills.length ? data.skills.map(skill => {
      const checked = draft.has(skill.id), checkbox = h('input', { type: 'checkbox', value: skill.id, 'data-skill-toggle': skill.id, disabled: busy }); checkbox.checked = checked;
      checkbox.addEventListener('change', () => { if (checkbox.checked) draft.add(skill.id); else draft.delete(skill.id); dirty = true; drawEquipment(); });
      return h('label', { class: `isk-equip-row${checked ? ' equipped' : ''}` }, checkbox, h('span', {}, h('strong', {}, skill.name || skill.relativePath), h('small', {}, checked ? tr('equipped') : tr('unequipped'))));
    }) : [h('p', { class: 'isk-empty' }, tr('empty'))]));
    saveButton.disabled = busy || !loaded || !roleId || !dirty; saveButton.textContent = tr('save');
    equipment.append(h('p', { class: 'isk-help isk-dirty', 'data-skill-dirty': '' }, dirty ? tr('changed') : tr('unobserved')));
  }
  function draw() {
    if (!catalog) return;
    catalog.replaceChildren(...(data.skills.length ? data.skills.map(skill => h('article', { class: `isk-skill${selected === skill.id ? ' selected' : ''}`, 'data-skill-id': skill.id }, h('div', { class: 'isk-skill-head' }, h('h3', {}, skill.name || skill.relativePath), h('span', { class: 'isk-badge' }, tr('registered'))), ...(skill.description ? [h('p', {}, skill.description)] : []), h('code', { class: 'isk-path' }, skill.relativePath), h('small', {}, `${Number(skill.bytes) || 0} ${tr('bytes')} · ${tr('license')}`), h('small', {}, `${tr('version')}: ${String(skill.sha256 || '').slice(0, 12)}`), h('p', { class: 'isk-origin' }, skill.originUrl ? `${tr('unverified')} · ${skill.originUrl}` : tr('noOrigin')), h('div', { class: 'isk-row-actions' }, h('button', { type: 'button', disabled: busy, 'data-skill-preview': skill.id, onclick: () => { void inspect(skill.id); } }, tr('preview')), h('button', { type: 'button', class: 'isk-danger', disabled: busy, 'data-skill-remove': skill.id, onclick: () => confirmRemove(skill) }, tr('remove'))))) : [h('p', { class: 'isk-empty' }, pending ? tr('loading') : tr('empty'))]));
    registerButton.disabled = busy || pending; drawEquipment();
  }
  function build() {
    dialog?.remove(); selected = ''; detailSerial++;
    message = h('p', { class: 'isk-message', role: 'status', 'aria-live': 'polite' });
    pathInput = h('input', { type: 'text', required: '', maxlength: 4096, placeholder: tr('pathHint'), 'data-skill-path': '', autocomplete: 'off' });
    originInput = h('input', { type: 'url', maxlength: 2048, placeholder: tr('originHint'), 'data-skill-origin': '', autocomplete: 'off' });
    registerButton = h('button', { type: 'submit', class: 'isk-primary' }, tr('registerButton'));
    const form = h('form', { class: 'isk-register', 'data-skill-register': '' }, h('h3', {}, tr('register')), field(tr('path'), pathInput), field(tr('origin'), originInput), h('p', { class: 'isk-help' }, tr('sourceNote')), registerButton);
    form.addEventListener('submit', event => { event.preventDefault(); const inputPath = pathInput.value.trim(), originUrl = originInput.value.trim(); void mutate('/api/skills', 'POST', { path: inputPath, originUrl }, 'added', () => { pathInput.value = ''; originInput.value = ''; }); });
    catalog = h('div', { class: 'isk-catalog' }); equipment = h('div', { class: 'isk-equipment' }); preview = h('section', { class: 'isk-preview', 'aria-label': tr('content') }, h('p', { class: 'isk-empty' }, tr('previewEmpty')));
    roleSelect = h('select', { 'data-skill-agent': '', 'aria-label': tr('agent'), onchange: () => setRole(roleSelect.value) });
    saveButton = h('button', { type: 'button', class: 'isk-primary', 'data-skill-save': '', onclick: () => { if (!roleId || !dirty) return; const agent = roleId, ids = [...draft]; void mutate(`/api/skills/bindings/${encodeURIComponent(agent)}`, 'PUT', { skillIds: ids }, 'saved', () => { if (agent === roleId) dirty = false; }); } }, tr('save'));
    host.classList.add('isk-skills'); host.replaceChildren(h('header', { class: 'isk-heading' }, h('div', {}, h('span', { class: 'isk-eyebrow' }, tr('local')), h('h2', {}, tr('title')), h('p', {}, tr('intro'))), h('button', { type: 'button', 'data-skill-refresh': '', onclick: () => { void reload(); } }, tr('refresh'))), message, h('div', { class: 'isk-layout' }, h('section', { class: 'isk-panel' }, form, h('h3', {}, tr('catalog')), catalog), h('section', { class: 'isk-panel' }, h('h3', {}, tr('equipment')), field(tr('agent'), roleSelect), equipment, saveButton, h('p', { class: 'isk-help' }, tr('permission')), preview)));
    draw();
  }
  async function reload() {
    if (!project || !host?.isConnected || pending || busy) return false;
    const key = project, owner = epoch, id = ++serial, stamp = state.server?.skillsRevision; pending = true; observedRevision = stamp; announce(tr('loading')); draw();
    try {
      const value = await api('/api/skills', key);
      if (!current(key, owner) || id !== serial) return false;
      accept(value, key); loaded = true; pending = false; draw(); announce('');
      if (visible() && stamp !== state.server?.skillsRevision) void reload(); return true;
    } catch (error) { if (current(key, owner) && id === serial) { pending = false; loaded = true; draw(); announce(error.message || tr('error'), true); } return false; }
  }
  async function inspect(skillId) {
    const key = project, owner = epoch, id = ++detailSerial; selected = skillId; draw(); preview.replaceChildren(h('p', {}, tr('loading')));
    try {
      const result = await api(`/api/skills/${encodeURIComponent(skillId)}`, key);
      if (!current(key, owner) || id !== detailSerial || selected !== skillId) return;
      if (scope(result?.workspace) !== key || result.skill?.id !== skillId) throw new Error(tr('scopeChanged'));
      const skill = result.skill;
      preview.replaceChildren(h('h3', {}, skill.name), h('p', { class: 'isk-help' }, tr('content')), h('code', { class: 'isk-path' }, `${tr('version')}: ${skill.sha256}`), h('pre', { 'data-skill-content': skillId }, String(skill.content || '').slice(0, 32768)));
    } catch (error) { if (current(key, owner) && id === detailSerial) preview.replaceChildren(h('p', { class: 'isk-error', role: 'alert' }, error.message || tr('error'))); }
  }
  async function mutate(url, method, body, success, after) {
    if (busy || pending || !project) return;
    const key = project, owner = epoch; busy = true; announce(tr('loading')); draw();
    try {
      const result = await api(url, key, method, body);
      if (!current(key, owner)) return;
      if (scope(result?.workspace) !== key) throw new Error(tr('scopeChanged'));
      after?.(); if (method === 'DELETE') { selected = ''; detailSerial++; preview.replaceChildren(h('p', { class: 'isk-empty' }, tr('previewEmpty'))); }
      busy = false; loaded = false;
      window.dispatchEvent(new CustomEvent('imperium:skills-changed', { detail: { workspace: key, revision: result.revision } }));
      const refreshed = await reload(); if (current(key, owner) && refreshed) { announce(tr(success)); callbacks.toast?.(tr(success)); }
    } catch (error) { if (current(key, owner)) { busy = false; draw(); announce(error.message || tr('error'), true); } }
  }
  function confirmRemove(skill) {
    if (busy || pending) return; dialog?.remove();
    const key = project, owner = epoch;
    const cancel = h('button', { type: 'button', onclick: () => dialog.remove() }, tr('cancel'));
    const confirm = h('button', { type: 'button', class: 'isk-danger', 'data-skill-confirm-remove': '', onclick: () => { dialog.remove(); if (current(key, owner)) void mutate(`/api/skills/${encodeURIComponent(skill.id)}`, 'DELETE', {}, 'removed'); } }, tr('confirm'));
    dialog = h('dialog', { class: 'isk-dialog', 'aria-label': tr('deleteTitle') }, h('h3', {}, tr('deleteTitle')), h('strong', {}, skill.name), h('p', {}, tr('deleteNote')), h('div', { class: 'isk-row-actions' }, cancel, confirm));
    host.append(dialog); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function render(incoming, options = {}) {
    state = incoming || callbacks.getState?.() || state; if (!host) return;
    if (Object.hasOwn(options, 'visible')) visibility = options.visible !== false;
    const key = scope(state.settings?.workspace), preferredLanguage = document.documentElement.lang || state.settings?.language, nextLanguage = Object.hasOwn(WORDS, preferredLanguage) ? preferredLanguage : 'ko';
    if (key !== project || !catalog || !host.contains(catalog)) {
      project = key; language = nextLanguage; epoch++; serial++; detailSerial++; pending = busy = loaded = false; observedRevision = undefined; data = { skills: [], bindings: {}, revision: 0 }; roleId = ''; draft.clear(); dirty = false; build();
    } else if (nextLanguage !== language) { const previousPath = pathInput.value, previousOrigin = originInput.value; language = nextLanguage; build(); pathInput.value = previousPath; originInput.value = previousOrigin; }
    else draw();
    if (visible() && !pending && !busy && (!loaded || observedRevision !== state.server?.skillsRevision)) void reload();
  }
  function destroy() { epoch++; serial++; detailSerial++; window.removeEventListener('imperium:skills-agent', externalAgent); dialog?.remove(); host = null; pending = busy = loaded = false; }
  function init(configuration = {}) {
    destroy(); callbacks = configuration; host = typeof configuration.container === 'string' ? document.querySelector(configuration.container) : configuration.container || document.querySelector('#skills-section');
    project = ''; roleId = ''; visibility = false;
    externalAgent = event => { const value = event.detail || {}; const currentState = callbacks.getState?.() || state; if (scope(value.workspace) !== scope(currentState.settings?.workspace)) return; render(currentState); if (state.departments?.some(role => role.id === value.departmentId)) setRole(value.departmentId); };
    window.addEventListener('imperium:skills-agent', externalAgent); if (host) render(callbacks.getState?.() || {}); return { render, reload, destroy };
  }
  window.ImperiumSkills = Object.freeze({ init, render, reload, destroy });
})();
