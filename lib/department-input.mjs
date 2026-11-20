import { resolveExecutionOptions } from './execution-options.mjs';

export const DEPARTMENT_PROVIDERS = Object.freeze(['codex', 'claude', 'gemini', 'copilot', 'ollama']);
export const DEPARTMENT_LIMITS = Object.freeze({ agents: 64, name: 24, title: 80, role: 1500, modelId: 200 });
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const fail = (status, message, field) => Object.assign(new Error(message), { status, field });

/**
 * Create-time agent rules shared by POST /api/departments and template import.
 * Returns the normalized record fields; it never reads or changes stored departments.
 */
export function validateDepartmentInput(input, { connections = [] } = {}) {
  for (const [key, max] of [['name', DEPARTMENT_LIMITS.name], ['role', DEPARTMENT_LIMITS.role]]) {
    if (typeof input?.[key] !== 'string' || !input[key].trim() || input[key].length > max) throw fail(400, '이름과 역할을 올바르게 입력해 주세요.', key);
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > DEPARTMENT_LIMITS.title)) throw fail(400, '직함은 80자 이내로 입력해 주세요.', 'title');
  const connection = input.connectionId ? connections.find(item => item.id === input.connectionId) : null;
  if (input.connectionId && !connection) throw fail(400, '등록된 연결을 찾을 수 없습니다.', 'connectionId');
  const provider = connection?.providerId || input.provider;
  if (!DEPARTMENT_PROVIDERS.includes(provider)) throw fail(400, '지원하는 제공자를 선택해 주세요.', 'provider');
  const modelId = input.modelId ?? connection?.modelId ?? '';
  if (typeof modelId !== 'string' || modelId && !MODEL_ID.test(modelId)) throw fail(400, '모델 ID를 확인해 주세요.', 'modelId');
  const execution = resolveExecutionOptions(provider, input);
  return { name: input.name.trim(), title: input.title?.trim() || '', role: input.role.trim(), provider, modelId, ...execution, connectionId: connection?.id || null };
}
