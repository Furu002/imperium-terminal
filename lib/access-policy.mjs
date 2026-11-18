// Application policy for AI dispatch and the user-operated terminal.
// These switches do not install an OS sandbox or change CLI/account permissions.
export const ACCESS_POLICIES = Object.freeze(['task-confirm', 'read-only']);
const fail = (status, message) => Object.assign(new Error(message), { status });

export function resolveAccessSettings(settings = {}) {
  return {
    accessPolicy: settings.accessPolicy === undefined ? 'task-confirm' : ACCESS_POLICIES.includes(settings.accessPolicy) ? settings.accessPolicy : 'read-only',
    terminalEnabled: settings.terminalEnabled === undefined ? true : settings.terminalEnabled === true,
  };
}

export function validateAccessSettings(input, current = {}) {
  const next = resolveAccessSettings(current);
  if (Object.hasOwn(input, 'accessPolicy')) {
    if (!ACCESS_POLICIES.includes(input.accessPolicy)) throw fail(400, 'AI 접근 정책은 작업별 선택 또는 읽기 전용을 선택해 주세요.');
    next.accessPolicy = input.accessPolicy;
  }
  if (Object.hasOwn(input, 'terminalEnabled')) {
    if (typeof input.terminalEnabled !== 'boolean') throw fail(400, '터미널 사용 설정은 켜짐 또는 꺼짐이어야 합니다.');
    next.terminalEnabled = input.terminalEnabled;
  }
  return next;
}

export function accessSettingsChanged(current, next) {
  const before = resolveAccessSettings(current), after = resolveAccessSettings(next);
  return before.accessPolicy !== after.accessPolicy || before.terminalEnabled !== after.terminalEnabled;
}

export function assertTaskPermission(settings, permission) {
  if (resolveAccessSettings(settings).accessPolicy === 'read-only' && permission === 'workspace-write') throw fail(403, 'AI 읽기 전용 정책이 켜져 있습니다. 파일 수정 작업은 접근 설정을 변경한 뒤 요청해 주세요.');
}

export function assertTerminalEnabled(settings) {
  if (!resolveAccessSettings(settings).terminalEnabled) throw fail(403, '접근 설정에서 사용자 터미널이 꺼져 있습니다.');
}
