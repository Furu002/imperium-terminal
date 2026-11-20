function invalid() {
  return Object.assign(new Error('완료 기준은 1,200자, 산출물 제목은 160자 이내로 입력해 주세요.'), { status: 400 });
}

export function validateHarness(input) {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid();
  if (Object.keys(input).some(key => key !== 'criteria' && key !== 'artifactTitle')) throw invalid();
  const { criteria = '', artifactTitle = '' } = input;
  if (typeof criteria !== 'string' || criteria.length > 1200) throw invalid();
  if (typeof artifactTitle !== 'string' || artifactTitle.length > 160 || /[\x00-\x1f\x7f]/.test(artifactTitle)) throw invalid();
  return { criteria: criteria.trim(), artifactTitle: artifactTitle.trim() };
}

export function harnessInstructions(harness) {
  if (!harness) return '';
  return [
    '작업 완료 기준과 검증:',
    harness.criteria && `사용자가 지정한 완료 기준: ${harness.criteria}`,
    '작업 결과와 실제 확인 근거를 최종 답변에 포함하세요. 실행하지 않은 테스트나 충족하지 못한 조건은 명시하세요.',
    harness.artifactTitle && `종료 전에 imperium_memory artifact_publish로 title=${JSON.stringify(harness.artifactTitle)}, kind=result인 결과를 이 작업에서 게시하세요. 답변에 게시했다고 적는 것만으로는 확인되지 않습니다.`,
  ].filter(Boolean).join('\n');
}

export function evaluateHarness(task, { processPassed, findArtifact }) {
  const checkedAt = task.finishedAt;
  if (!processPassed) return { status: 'skipped', checkedAt, checks: [] };
  const checks = [{ id: 'output', passed: Boolean(task.output?.trim()) }];
  if (task.harness.artifactTitle) {
    const artifactId = findArtifact(task, task.harness.artifactTitle);
    checks.push({ id: 'artifact', passed: Boolean(artifactId), ...(artifactId ? { artifactId } : {}) });
  }
  return { status: checks.every(check => check.passed) ? 'passed' : 'failed', checkedAt, checks };
}
