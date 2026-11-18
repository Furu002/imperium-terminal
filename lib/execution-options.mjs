const DEFAULTS = { reasoningEffort: 'default', speed: 'default' };
const CODEX_EFFORTS = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const CLAUDE_EFFORTS = ['default', 'low', 'medium', 'high', 'xhigh', 'max'];
export const EXECUTION_CAPABILITIES = {
  codex: { reasoningEfforts: CODEX_EFFORTS, speeds: ['default', 'standard', 'fast'] },
  claude: { reasoningEfforts: CLAUDE_EFFORTS, speeds: ['default', 'standard', 'fast'] },
  copilot: { reasoningEfforts: CLAUDE_EFFORTS, speeds: ['default'] },
  gemini: { reasoningEfforts: ['default'], speeds: ['default'] },
  ollama: { reasoningEfforts: ['default'], speeds: ['default'] },
};

/** Provider defaults are explicit. No global CLI configuration is edited. */
export function resolveExecutionOptions(provider, input = {}, defaults = {}) {
  const caps = Object.hasOwn(EXECUTION_CAPABILITIES, provider) ? EXECUTION_CAPABILITIES[provider] : null;
  if (!caps) throw Object.assign(new Error('지원하지 않는 모델 연결입니다.'), { status: 400 });
  const value = {};
  for (const [key, allowed] of [['reasoningEffort', caps.reasoningEfforts], ['speed', caps.speeds]]) {
    const selected = Object.hasOwn(input, key) ? input[key] : defaults[key] ?? DEFAULTS[key];
    if (typeof selected !== 'string' || !allowed.includes(selected)) throw Object.assign(new Error(key === 'speed' ? '이 모델 연결에서 지원하는 처리 속도를 선택해 주세요.' : '이 모델 연결에서 지원하는 추론 강도를 선택해 주세요.'), { status: 400 });
    value[key] = selected;
  }
  return value;
}

// Current official CLI mappings, scoped to each invocation:
// https://learn.chatgpt.com/docs/config-file/config-reference
// https://code.claude.com/docs/en/cli-reference
// https://code.claude.com/docs/en/fast-mode
// https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
export function executionArguments(provider, input = {}) {
  const { reasoningEffort, speed } = resolveExecutionOptions(provider, input);
  const args = [];
  if (reasoningEffort !== 'default') {
    if (provider === 'codex') args.push('-c', `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
    else if (provider === 'claude') args.push('--effort', reasoningEffort);
    else if (provider === 'copilot') args.push('--reasoning-effort', reasoningEffort);
  }
  if (provider === 'codex' && speed !== 'default') args.push('-c', `features.fast_mode=${speed === 'fast'}`, '-c', `service_tier=${JSON.stringify(speed === 'fast' ? 'fast' : 'default')}`);
  if (provider === 'claude' && speed !== 'default') args.push('--settings', JSON.stringify({ fastMode: speed === 'fast' }));
  return args;
}
