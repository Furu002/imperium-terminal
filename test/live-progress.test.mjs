import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../public/live-progress.js', import.meta.url), 'utf8');
const workspace = 'C:\\Projects\\Live';
const task = (id, extra = {}) => ({ id, workspace, title: `Task ${id}`, provider: 'codex', modelId: 'real-model', departmentId: 'engineering', reasoningEffort: 'high', speed: 'fast', status: 'running', logs: [], ...extra });
const state = tasks => ({ settings: { workspace, language: 'en' }, departments: [{ id: 'engineering', name: 'Engineering' }], projects: [{ workspace, name: 'Actual project' }], tasks });
function fixture() {
  const dom = new JSDOM('<main><section id="quotas-section"></section><section id="next"></section></main>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310' });
  dom.window.eval(source);
  const selections = [], options = { language: 'en', onSelectTask: id => selections.push(id) };
  return { dom, document: dom.window.document, selections, render(value, overrides) { dom.window.ImperiumLiveProgress.render(value, { ...options, ...overrides }); }, close() { dom.window.ImperiumLiveProgress.destroy(); dom.window.close(); } };
}

test('the compact panel mounts after account quotas only for real active tasks in the explicitly current project', () => {
  const ui = fixture();
  try {
    ui.render(state([]));
    const root = ui.document.querySelector('#live-progress-section');
    assert.equal(root.previousElementSibling.id, 'quotas-section');
    assert.equal(root.hidden, true);
    ui.render(state([task('real'), task('queue', { status: 'queued' }), task('demo', { demo: true }), task('finished', { status: 'completed' }), task('foreign', { workspace: 'C:\\Projects\\Foreign' }), task('legacy', { workspace: undefined })]));
    assert.equal(root.hidden, false);
    assert.equal(root.querySelector('details').open, true);
    assert.equal(root.querySelectorAll('.lp-task').length, 2);
    assert.match(root.textContent, /Actual project/);
    assert.match(root.textContent, /Engineering.*real-model.*high.*fast/);
    assert.doesNotMatch(root.textContent, /Task (?:demo|finished|foreign|legacy)/);
    ui.document.querySelectorAll('.lp-task-title')[1].click();
    assert.deepEqual(ui.selections, ['queue']);
    ui.render({ ...state([task('no-project')]), settings: {} });
    assert.equal(root.hidden, true);
  } finally { ui.close(); }
});

test('latest explicit public summary is prominent and retains its honest AI-reported percent, ETA and timestamp', () => {
  const ui = fixture(), reportedAt = '2026-11-18T01:02:03Z', summaryAt = '2026-11-18T01:03:04Z';
  try {
    ui.render(state([task('one', { progress: { source: 'model-estimate', percent: 42.5, etaMinutes: 3.5, stage: 'Checking implementation', updatedAt: reportedAt }, logs: [
      { type: 'status', source: 'model-summary', text: 'Reviewing the test failure', timestamp: summaryAt },
      { type: 'tool', text: 'Read app.js', timestamp: '2026-11-18T01:04:05Z' },
    ] })]));
    const root = ui.document.querySelector('#live-progress-section');
    assert.equal(root.querySelector('.lp-stage').textContent, 'Reviewing the test failure');
    assert.equal(root.querySelector('.lp-summary-source').textContent, 'Public progress summary');
    assert.equal(root.querySelector('progress').value, 42.5);
    assert.match(root.textContent, /AI self estimate · 42.5%/);
    assert.match(root.textContent, /Reported remaining estimate: 3.5 min/);
    assert.equal(root.querySelector('.lp-updated time').dateTime, '2026-11-18T01:04:05Z');
    assert.match(root.textContent, /separate from confirmed completion/);
    assert.match(root.textContent, /Private internal reasoning is not shown/);
    const snapshot = root.querySelector('.lp-task');
    ui.render(state([task('one', { progress: { source: 'model-estimate', percent: 42.5, etaMinutes: 3.5, stage: 'Checking implementation', updatedAt: reportedAt }, logs: [
      { type: 'status', source: 'model-summary', text: 'Reviewing the test failure', timestamp: summaryAt },
      { type: 'tool', text: 'Read app.js', timestamp: '2026-11-18T01:04:05Z' },
    ] })]));
    assert.equal(root.querySelector('.lp-task'), snapshot, 'wall-clock passage must not fabricate percent or ETA changes');
  } finally { ui.close(); }
});

test('a newer public progress stage wins over an older summary; recent tools remain a bounded timeline', () => {
  const ui = fixture();
  try {
    ui.render(state([task('one', { progress: { source: 'model-estimate', percent: 75, etaMinutes: 1, stage: 'Validating the result', updatedAt: '2026-11-18T02:00:00Z' }, logs: [
      { type: 'status', source: 'model-summary', text: 'Older public summary', timestamp: '2026-11-18T01:00:00Z' },
      ...Array.from({ length: 12 }, (_, index) => ({ type: 'tool', text: `Read file ${index}`, timestamp: `2026-11-18T01:0${Math.floor(index / 6)}:${String(index).padStart(2, '0')}Z` })),
    ] })]));
    const root = ui.document.querySelector('#live-progress-section');
    assert.equal(root.querySelector('.lp-stage').textContent, 'Validating the result');
    assert.equal(root.querySelector('.lp-summary-source').textContent, 'AI self estimate');
    assert.equal(root.querySelectorAll('.lp-event').length, 8);
    assert.equal(root.querySelector('.lp-updated time').dateTime, '2026-11-18T02:00:00Z');
    ui.render(state([task('one', { logs: [{ type: 'status', source: 'model-summary', text: 'Keep the public summary' }, ...Array.from({ length: 12 }, (_, index) => ({ type: 'tool', text: `Tool ${index}` }))] })]));
    assert.equal(root.querySelector('.lp-stage').textContent, 'Keep the public summary', 'a summary remains visible when eight newer tools fill the timeline');
  } finally { ui.close(); }
});

test('private reasoning fields, answer text, raw CLI payloads and untrusted HTML cannot become public summaries', () => {
  const ui = fixture(), payload = '<img src=x onerror=alert(1)><script>unsafe()</script>';
  try {
    ui.render(state([task('one', { title: payload, output: 'PRIVATE_ANSWER_TEXT', reasoning: 'PRIVATE_REASONING_FIELD', thinking: 'PRIVATE_THINKING_FIELD', progress: { source: 'private-reasoning', stage: 'PRIVATE_STAGE', percent: 90, etaMinutes: 1 }, logs: [
      { type: 'text', text: 'PRIVATE_TEXT_LOG' }, { type: 'thinking', text: 'PRIVATE_THINKING_LOG' }, { type: 'reasoning', text: 'PRIVATE_REASONING_LOG' },
      { type: 'status', text: '{"thinking":"PRIVATE_RAW_JSON"}' }, { type: 'status', text: 'PRIVATE_UNSOURCED_RAW_LINE' }, { type: 'tool', text: '{"reasoning":"PRIVATE_TOOL_JSON"}' },
      { type: 'status', source: 'model-summary', text: payload, timestamp: 'bad timestamp' },
      { type: 'tool', taskId: 'other-task', text: 'FOREIGN_LOG' },
    ] })]));
    const root = ui.document.querySelector('#live-progress-section');
    assert.equal(root.querySelector('img,script,a,iframe'), null);
    assert.equal(root.querySelector('.lp-stage').textContent, payload);
    assert.doesNotMatch(root.textContent, /PRIVATE_|FOREIGN_LOG/);
    assert.equal(root.querySelector('progress'), null);
    assert.equal(root.querySelector('.lp-updated time').hasAttribute('datetime'), false);
    assert.doesNotMatch(source, /\.\s*(?:innerHTML|outerHTML)\b|insertAdjacentHTML\s*\(|\bfetch\s*\(|\bEventSource\b|\bWebSocket\b|\beval\s*\(/);
  } finally { ui.close(); }
});

test('no model report means waiting, never an inferred completion percentage or ETA', () => {
  const ui = fixture();
  try {
    ui.render(state([task('running', { startedAt: '2020-01-01T00:00:00Z', historicalETA: { remainingSeconds: 5 } }), task('queued', { status: 'queued', progress: { source: 'model-estimate', percent: 60, etaMinutes: 2, stage: 'Stale stage' } })]));
    const root = ui.document.querySelector('#live-progress-section');
    assert.equal(root.querySelector('progress'), null);
    assert.equal(root.querySelector('.lp-eta'), null);
    assert.match(root.textContent, /Waiting for a public progress event/);
    assert.match(root.textContent, /Queued. Public progress will appear after execution starts/);
    assert.match(root.textContent, /AI progress and ETA not reported/);
    assert.doesNotMatch(root.textContent, /Stale stage|100%/);
    ui.render(state([task('invalid', { progress: { source: 'model-estimate', percent: 100, etaMinutes: -5 } })]));
    assert.equal(root.querySelector('progress'), null);
    assert.equal(root.querySelector('.lp-eta'), null);
    ui.render(state([task('zero', { progress: { source: 'model-estimate', percent: 0, etaMinutes: 0 } })]));
    assert.equal(root.querySelector('progress').value, 0);
    assert.match(root.textContent, /estimate: 0 min/);
  } finally { ui.close(); }
});

test('public CLI and tool events are shown literally with actual timestamps and known CLI states translate', () => {
  const ui = fixture();
  try {
    const value = state([task('one', { logs: [{ type: 'status', text: '작업을 검토하고 있습니다.', timestamp: '2026-11-18T01:00:00Z' }, { type: 'tool', text: 'Read /project/app.js', timestamp: '2026-11-18T01:00:01Z' }] })]);
    ui.render(value);
    assert.equal(ui.document.querySelectorAll('.lp-event').length, 2);
    assert.match(ui.document.querySelector('.lp-timeline').textContent, /Reviewing the task/);
    assert.equal(ui.document.querySelector('.lp-stage').textContent, 'Read /project/app.js');
    ui.render(value, { language: 'ja' });
    assert.match(ui.document.querySelector('.lp-heading').textContent, /リアルタイム進捗/);
    assert.match(ui.document.querySelector('.lp-timeline').textContent, /タスクを確認中/);
    assert.equal(ui.document.querySelector('.lp-stage').textContent, 'Read /project/app.js');
    ui.render(value, { language: 'ko' });
    assert.match(ui.document.querySelector('.lp-heading').textContent, /실시간 진행/);
  } finally { ui.close(); }
});

test('same payload reuses DOM, keeps title focus and honors the user disclosure choice across inactivity and project changes', () => {
  const ui = fixture(), value = state([task('one'), task('two', { provider: 'claude' })]);
  try {
    ui.render(value);
    const root = ui.document.querySelector('#live-progress-section'), details = root.querySelector('details'), first = root.querySelector('.lp-task'), title = first.querySelector('button');
    details.open = false; title.focus();
    ui.render(JSON.parse(JSON.stringify(value)));
    assert.equal(root.querySelector('.lp-task'), first);
    assert.equal(ui.document.activeElement, title);
    assert.equal(details.open, false);
    ui.render(state([])); assert.equal(root.hidden, true);
    ui.render(value); assert.equal(details.open, false);
    const nextWorkspace = 'C:\\Projects\\Other';
    ui.render({ ...value, settings: { workspace: nextWorkspace }, tasks: [task('new', { workspace: nextWorkspace })] });
    assert.equal(details.open, false);
    assert.equal(root.querySelectorAll('.lp-task').length, 1);
    assert.equal(root.querySelector('.lp-task-title').textContent, 'Task new');
    assert.doesNotMatch(root.textContent, /Task one|Task two/);
    ui.render({ ...value, settings: { workspace: 'c:/projects/live/' }, tasks: [task('case')] });
    assert.equal(root.hidden, false, 'Windows path casing and separators identify the same project');
  } finally { ui.close(); }
});

test('skill chips distinguish real CLI document reads and calls from model reports without inferring usage or completion', () => {
  const ui = fixture();
  try {
    ui.render(state([task('one', { output: 'I read SKILL.md using invented-skill.', logs: [
      { type: 'text', text: 'SKILL.md says to use fictional-skill' },
      { type: 'tool', text: 'Read SKILL.md' },
      { type: 'skill', source: 'unknown', text: 'unverified-skill' },
      { type: 'skill', source: 'cli-skill-read', text: 'frontend-design', timestamp: '2026-11-18T01:00:00Z' },
      { type: 'skill', source: 'cli-skill-call', text: 'code-review', timestamp: '2026-11-18T01:00:01Z' },
      { type: 'skill', source: 'model-reported', text: 'testing', timestamp: '2026-11-18T01:00:02Z' },
      { type: 'skill', source: 'model-reported', text: 'testing', timestamp: '2026-11-18T01:00:03Z' },
      { type: 'skill', source: 'cli-skill-read', text: 'C:\\private\\SKILL.md' },
    ] })]));
    const skills = ui.document.querySelector('.lp-skills');
    assert.equal(skills.querySelectorAll('.lp-skill-chip').length, 3);
    assert.match(skills.textContent, /Skill document read detected/);
    assert.match(skills.textContent, /CLI invocation detected/);
    assert.match(skills.textContent, /Model usage report/);
    assert.match(skills.textContent, /do not confirm successful skill completion/);
    assert.doesNotMatch(skills.textContent, /fictional|invented|unverified-skill|private|SKILL.md/);
    assert.equal([...skills.querySelectorAll('time')].at(-1).dateTime, '2026-11-18T01:00:03Z');
    assert.equal(ui.document.querySelector('.lp-updated time').dateTime, '2026-11-18T01:00:03Z');
    ui.render(state([task('one', { logs: Array.from({ length: 20 }, (_, index) => ({ type: 'skill', source: 'model-reported', text: `skill-${index}` })) })]));
    assert.equal(ui.document.querySelectorAll('.lp-skill-chip').length, 12);
    ui.render(state([task('one')]));
    assert.match(ui.document.querySelector('.lp-skills').textContent, /No skill usage reported/);
  } finally { ui.close(); }
});
