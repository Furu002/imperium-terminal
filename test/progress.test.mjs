import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createProgressReader, estimateHistoricalETA } from '../lib/progress.mjs';

const marker = data => `[[IMPERIUM_PROGRESS ${JSON.stringify(data)}]]`;
const statusMarker = data => `[[IMPERIUM_STATUS ${JSON.stringify(data)}]]`;
const skillMarker = data => `[[IMPERIUM_SKILL ${JSON.stringify(data)}]]`;
function collect() {
  const texts = [], events = [], statuses = [], skills = [];
  const reader = createProgressReader({ onText: text => texts.push(text), onProgress: event => events.push(event), onStatus: event => statuses.push(event), onSkill: event => skills.push(event) });
  return { ...reader, texts, events, statuses, skills, output: () => texts.join('') };
}

test('public Korean progress markers survive every possible chunk boundary and disappear from visible text', () => {
  const progress = marker({ percent: 40, etaMinutes: 3, stage: '구현 검토' });
  const input = `시작했습니다.\n${progress}\n다음 작업 🙂`;
  for (let split = 0; split <= input.length; split++) {
    const reader = collect();
    reader.write(input.slice(0, split)); reader.write(input.slice(split)); reader.end();
    assert.equal(reader.output(), '시작했습니다.\n\n다음 작업 🙂', `split ${split}`);
    assert.deepEqual(reader.events, [{ type: 'progress', percent: 40, etaMinutes: 3, stage: '구현 검토', source: 'model-estimate' }]);
  }
});

test('single-character chunks preserve non-marker content exactly while parsing multiple updates', () => {
  const reader = collect();
  const input = `앞[문장]${marker({ percent: 0 })}중간${marker({ percent: 99, etaMinutes: 0, stage: '검증' })}끝`;
  for (const char of input) reader.write(char);
  reader.end();
  assert.equal(reader.output(), '앞[문장]중간끝');
  assert.deepEqual(reader.events.map(event => [event.percent, event.etaMinutes]), [[0, null], [99, 0]]);
});

test('ordinary text streams immediately; only a possible marker prefix is held until completion', () => {
  const reader = collect();
  reader.write('바로 표시\n[');
  assert.equal(reader.output(), '바로 표시\n');
  reader.write('일반 텍스트');
  assert.equal(reader.output(), '바로 표시\n[일반 텍스트');
  reader.write('[[IMPERIUM_PRO');
  assert.equal(reader.output(), '바로 표시\n[일반 텍스트');
  reader.end(); reader.end(); reader.write('늦은 출력');
  assert.equal(reader.output(), '바로 표시\n[일반 텍스트[[IMPERIUM_PRO');
});

test('invalid JSON, metadata types, and out-of-range estimates remain literal and never become completion', () => {
  const invalid = [
    '[[IMPERIUM_PROGRESS {invalid}]]',
    marker({ percent: 100 }), marker({ percent: -1 }), marker({ percent: '40' }),
    '[[IMPERIUM_PROGRESS {"percent":1e999}]]',
    marker({ percent: 40, etaMinutes: -1 }), marker({ percent: 40, etaMinutes: 1441 }),
    marker({ percent: 40, etaMinutes: '3' }), marker({ percent: 40, stage: {} }),
    marker([]), marker(null), marker({ etaMinutes: 3 }),
  ].join('\n');
  const reader = collect(); reader.write(invalid); reader.end();
  assert.equal(reader.output(), invalid);
  assert.deepEqual(reader.events, []);
});

test('stage metadata remains literal text, removes controls, and cannot override event provenance', () => {
  const reader = collect();
  const html = '<img src=x onerror="globalThis.progressAttack=1">';
  reader.write(marker({ percent: 12.5, etaMinutes: 1440, stage: `  검토\n${html}\u202e${'가'.repeat(130)}`, source: 'process', type: 'complete', extra: { html } }));
  reader.end();
  assert.equal(reader.output(), '');
  assert.equal(reader.events[0].source, 'model-estimate');
  assert.equal(reader.events[0].type, 'progress');
  assert.equal([...reader.events[0].stage].length, 120);
  assert.ok(reader.events[0].stage.includes(html));
  assert.ok(!/[\n\u202e]/u.test(reader.events[0].stage));
  assert.equal(globalThis.progressAttack, undefined);
  assert.equal(Object.hasOwn(reader.events[0], 'extra'), false);
});

test('oversized malformed markers cannot hold unlimited visible output or prevent a later valid update', () => {
  const reader = collect();
  const prefix = '[[IMPERIUM_PROGRESS ';
  const huge = `${prefix}${'x'.repeat(128 * 1024)}]]`;
  reader.write(huge.slice(0, 4096));
  assert.ok(reader.output().length > 0);
  reader.write(huge.slice(4096));
  reader.write(marker({ percent: 75, stage: '후속 검증' })); reader.end();
  assert.equal(reader.output(), huge);
  assert.equal(reader.events.length, 1);
  assert.equal(reader.events[0].percent, 75);
});

test('unfinished and unrelated marker-looking prose is flushed literally', () => {
  for (const input of ['[[IMPERIUM_PROGRESS {"percent":40}', '[[IMPERIUM_PROGRESS', '[[OTHER {"percent":40}]]', '완성도 100%, 2분 남음']) {
    const reader = collect(); reader.write(input); reader.end();
    assert.equal(reader.output(), input); assert.deepEqual(reader.events, []);
  }
});

test('bracket pairs and escaped quotes inside JSON stage text do not end the marker early', () => {
  const reader = collect(), stage = '검토 ]] "따옴표" \\ 경로';
  for (const char of marker({ percent: 35, stage })) reader.write(char);
  reader.end();
  assert.equal(reader.output(), '');
  assert.equal(reader.events.length, 1);
  assert.equal(reader.events[0].stage, stage);
});

test('public status summaries need no estimate and survive every split alongside progress markers', () => {
  const summary = '파일 목록 검토 · 日本語と한국어 🙂 ]] "경로" \\';
  const input = `시작${statusMarker({ summary })}중간${marker({ percent: 25, stage: '구현' })}끝`;
  for (let split = 0; split <= input.length; split++) {
    const reader = collect(); reader.write(input.slice(0, split)); reader.write(input.slice(split)); reader.end();
    assert.equal(reader.output(), '시작중간끝', `split ${split}`);
    assert.deepEqual(reader.statuses, [{ type: 'status', summary, source: 'model-summary' }]);
    assert.equal(reader.events[0].percent, 25);
  }
  const legacy = createProgressReader(); assert.doesNotThrow(() => { legacy.write(statusMarker({ summary })); legacy.end(); });
  assert.throws(() => createProgressReader({ onStatus: 'wrong type' }), TypeError);
});

test('status summaries strip controls, bound Unicode to 240 code points and ignore forged provenance or hidden fields', () => {
  const reader = collect(), html = '<img src=x onerror="globalThis.statusAttack=1">';
  reader.write(statusMarker({ summary: `  요약\n\u0000\u001b\u200b\u202e${html}${'🙂'.repeat(300)}`, source: 'process', type: 'reasoning', percent: 100, thinking: 'PRIVATE_DATA', reasoning: 'PRIVATE_DATA' })); reader.end();
  assert.equal(reader.output(), ''); assert.equal(reader.statuses.length, 1);
  const event = reader.statuses[0]; assert.deepEqual(Object.keys(event), ['type', 'summary', 'source']);
  assert.equal(event.source, 'model-summary'); assert.equal(event.type, 'status'); assert.equal([...event.summary].length, 240);
  assert.ok(event.summary.includes(html)); assert.ok(!/[\p{Cc}\u200b\u202e]/u.test(event.summary)); assert.ok(!event.summary.includes('PRIVATE_DATA')); assert.equal(globalThis.statusAttack, undefined);
});

test('duplicate sanitized public status reports are removed while changed stages remain ordered', () => {
  const reader = collect();
  for (const char of `${statusMarker({ summary: '검토' })}${statusMarker({ summary: ' 검토 ' })}${marker({ percent: 30 })}${statusMarker({ summary: '검토' })}${statusMarker({ summary: '검증' })}${statusMarker({ summary: '검토' })}`) reader.write(char);
  reader.end(); assert.equal(reader.output(), ''); assert.deepEqual(reader.statuses.map(event => event.summary), ['검토', '검증', '검토']); assert.equal(reader.events.length, 1);
});

test('broken, oversized or invalid status reports stay literal and never manufacture progress', () => {
  const invalid = ['[[IMPERIUM_STATUS {bad}]]', statusMarker([]), statusMarker(null), statusMarker({ summary: {} }), statusMarker({ summary: 12 }), statusMarker({ summary: '\u0000\n\u202e' }), statusMarker({ percent: 50 }), '[[IMPERIUM_STATUS {"summary":"unfinished', '[[IMPERIUM_STA'];
  for (const input of invalid) { const reader = collect(); reader.write(input); reader.end(); assert.equal(reader.output(), input); assert.deepEqual(reader.statuses, []); assert.deepEqual(reader.events, []); }
  const reader = collect(), huge = `[[IMPERIUM_STATUS ${'x'.repeat(128 * 1024)}]]`;
  reader.write(huge.slice(0, 4096)); assert.ok(reader.output().length > 0); reader.write(huge.slice(4096)); reader.write(statusMarker({ summary: '정상 재개' })); reader.end();
  assert.equal(reader.output(), huge); assert.deepEqual(reader.statuses.map(event => event.summary), ['정상 재개']); assert.deepEqual(reader.events, []);
});

test('public skill reports survive every boundary, stay self-reported and do not invent an estimate', () => {
  const name = '문서 검토 🙂 日本語 ]] "인용"';
  const input = `앞${skillMarker({ name, source: 'cli-skill-call', phase: 'completed', reasoning: 'PRIVATE' })}중간${statusMarker({ summary: '문서 확인' })}${marker({ percent: 12 })}뒤`;
  for (let split = 0; split <= input.length; split++) {
    const reader = collect(); reader.write(input.slice(0, split)); reader.write(input.slice(split)); reader.end();
    assert.equal(reader.output(), '앞중간뒤'); assert.deepEqual(reader.skills, [{ type: 'skill', name, source: 'model-reported' }]); assert.equal(reader.statuses.length, 1); assert.equal(reader.events.length, 1);
  }
  const legacy = createProgressReader(); assert.doesNotThrow(() => { legacy.write(skillMarker({ name })); legacy.end(); });
  assert.throws(() => createProgressReader({ onSkill: null }), TypeError);
});

test('skill reports sanitize and cap Unicode names, remove duplicates and preserve malformed literals', () => {
  const reader = collect(), longName = ` \u0000\u001b\u202e${'🙂'.repeat(180)}`;
  for (const char of `${skillMarker({ name: longName })}${skillMarker({ name: longName })}${skillMarker({ name: '다음 스킬' })}${skillMarker({ name: longName })}`) reader.write(char);
  reader.end(); assert.equal(reader.output(), ''); assert.equal(reader.skills.length, 3); assert.equal([...reader.skills[0].name].length, 160); assert.equal(reader.skills[0].name, '🙂'.repeat(160)); assert.deepEqual(reader.events, []);
  const invalid = [skillMarker(null), skillMarker([]), skillMarker({ name: {} }), skillMarker({ name: 12 }), skillMarker({ name: '\u0000\n\u202e' }), skillMarker({ skill: 'not-name' }), '[[IMPERIUM_SKILL {bad}]]', '[[IMPERIUM_SKILL {"name":"partial', '[[IMPERIUM_SKI'];
  for (const input of invalid) { const literal = collect(); literal.write(input); literal.end(); assert.equal(literal.output(), input); assert.deepEqual(literal.skills, []); }
  const oversized = collect(), huge = `[[IMPERIUM_SKILL ${'x'.repeat(128 * 1024)}]]`;
  oversized.write(huge.slice(0, 4096)); assert.ok(oversized.output().length > 0); oversized.write(huge.slice(4096)); oversized.write(skillMarker({ name: 'recovered' })); oversized.end(); assert.equal(oversized.output(), huge); assert.equal(oversized.skills[0].name, 'recovered');
});

const now = Date.parse('2026-11-18T00:10:00Z');
const folder = path.resolve('progress-project');
const task = (id, seconds, changes = {}) => ({ id, provider: 'codex', modelId: 'known-model', departmentId: 'engineering', permission: 'read-only', workspace: folder, status: 'completed', startedAt: '2026-11-18T00:00:00Z', finishedAt: new Date(Date.parse('2026-11-18T00:00:00Z') + seconds * 1000).toISOString(), ...changes });
const running = changes => ({ ...task('current', 1), status: 'running', finishedAt: null, startedAt: new Date(now - 20_000).toISOString(), ...changes });

test('historical ETA uses nearest-rank median and p90 from completed matching real tasks', () => {
  const result = estimateHistoricalETA(running(), [task('one', 60), task('two', 30), task('three', 120)], { now });
  assert.deepEqual(result, { source: 'history', sampleCount: 3, medianSeconds: 60, p90Seconds: 120, remainingSeconds: 40 });
  assert.equal(Object.hasOwn(result, 'percent'), false);
});

test('historical samples exclude other configurations, workspaces, failed/demo/running jobs, self and invalid clocks', () => {
  const excluded = [
    task('demo', 10, { demo: true }), task('active', 10, { status: 'running' }), task('failed', 10, { status: 'failed' }),
    task('cancelled', 10, { status: 'cancelled' }), task('other-provider', 10, { provider: 'claude' }),
    task('other-model', 10, { modelId: 'another-model' }), task('other-role', 10, { departmentId: 'quality' }),
    task('other-permission', 10, { permission: 'workspace-write' }), task('other-workspace', 10, { workspace: path.resolve('other-project') }),
    task('bad-start', 10, { startedAt: 'invalid' }), task('bad-finish', 10, { finishedAt: null }),
    task('negative', 10, { finishedAt: '2026-11-17T00:00:00Z' }), task('current', 10),
  ];
  const result = estimateHistoricalETA(running(), [task('one', 30), task('two', 60), ...excluded], { now });
  assert.equal(result, null);
  const enough = estimateHistoricalETA(running(), [task('one', 30), task('two', 60), task('three', 90), ...excluded], { now });
  assert.equal(enough.sampleCount, 3);
  assert.equal(enough.medianSeconds, 60);
});

test('history requires known configuration and enough samples, supports legacy workspace absence and clamps remaining time', () => {
  const samples = [task('one', 30, { workspace: undefined }), task('two', 60), task('three', 90)];
  assert.equal(estimateHistoricalETA(running({ modelId: '' }), samples, { now }), null);
  assert.equal(estimateHistoricalETA(running({ demo: true }), samples, { now }), null);
  assert.equal(estimateHistoricalETA(running(), samples.slice(0, 2), { now }), null);
  assert.equal(estimateHistoricalETA(running({ startedAt: new Date(now - 120_000).toISOString() }), samples, { now }).remainingSeconds, 0);
  assert.equal(estimateHistoricalETA(running({ startedAt: null }), samples, { now }).remainingSeconds, 60);
  assert.equal(estimateHistoricalETA(running({ startedAt: new Date(now + 1000).toISOString() }), samples, { now }).remainingSeconds, 60);
  assert.throws(() => estimateHistoricalETA(running(), samples, { minSamples: 0, now }), RangeError);
});

test('even historical sample counts use nearest-rank quantiles and valid zero duration remains observed', () => {
  const samples = [task('a', 0), task('b', 10), task('c', 20), task('d', 30)];
  const result = estimateHistoricalETA(running({ startedAt: null }), samples, { now });
  assert.equal(result.medianSeconds, 10);
  assert.equal(result.p90Seconds, 30);
  assert.equal(result.sampleCount, 4);
});
