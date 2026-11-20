import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = await readFile(new URL('../public/task-harness.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));

function setup(t) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(script);
  t.after(() => window.close());
  return { ...window.ImperiumTaskHarness, document: window.document, window };
}

test('completion checks are opt-in and disabled draft fields survive a language and project change', t => {
  const { createEditor, document, window } = setup(t);
  const edits = [];
  const editor = createEditor({ language: 'ko', onChange: draft => edits.push(copy(draft)) });
  document.body.append(editor.element);
  const checkbox = editor.element.querySelector('[type=checkbox]');
  const criteria = editor.element.querySelector('textarea');
  const title = editor.element.querySelector('[type=text]');
  assert.equal(editor.getValue(), undefined);
  assert.equal(editor.element.open, false);

  editor.element.open = true;
  checkbox.click();
  assert.deepEqual(copy(editor.getValue()), { criteria: '', artifactTitle: '' });
  criteria.value = '  Run verification\nReview output  ';
  title.value = '  Review report  ';
  title.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.deepEqual(copy(editor.getValue()), { criteria: 'Run verification\nReview output', artifactTitle: 'Review report' });
  assert.equal(edits.at(-1).artifactTitle, '  Review report  ');
  assert.equal(criteria.maxLength, 1200);
  assert.equal(title.maxLength, 160);

  criteria.focus();
  criteria.setSelectionRange(2, 5);
  editor.update({ language: 'ja' });
  assert.equal(document.activeElement, criteria);
  assert.equal(criteria.selectionStart, 2);
  assert.match(editor.element.textContent, /受け入れ基準/);
  checkbox.click();
  assert.equal(editor.getValue(), undefined);
  const draft = copy(editor.getDraft());
  assert.deepEqual(draft, { enabled: false, open: true, criteria: '  Run verification\nReview output  ', artifactTitle: '  Review report  ' });
  editor.setValue(undefined);
  assert.deepEqual(copy(editor.getDraft()), { enabled: false, open: false, criteria: '', artifactTitle: '' });
  editor.setValue(draft);
  assert.deepEqual(copy(editor.getDraft()), draft);
  assert.equal(editor.getValue(), undefined);
});

test('workflow scope and report evidence stay distinct from owner acceptance and render as text', t => {
  const { createEditor, createReport, document } = setup(t);
  const editor = createEditor({ language: 'en', workflow: true });
  assert.match(editor.element.textContent, /starting agent/);
  assert.match(editor.element.textContent, /failed check stops dependent tasks/);
  assert.equal(createReport({ task: { status: 'completed' } }), null);
  const harness = { criteria: '<img src=x>\nReview actual tests', artifactTitle: '<script>review</script>' };
  const pending = createReport({ task: { status: 'running', harness }, language: 'en' });
  assert.equal(pending.dataset.harnessStatus, 'pending');
  assert.deepEqual([...pending.querySelectorAll('[data-check-status]')].map(node => node.dataset.checkStatus), ['waiting', 'waiting']);

  const report = createReport({ task: { status: 'completed', harness: { ...harness, result: { status: 'passed', checks: [
    { id: 'output', passed: true }, { id: 'artifact', passed: true, artifactId: 'artifact-id-123' },
  ] } } }, language: 'en' });
  document.body.append(report);
  assert.match(report.querySelector('summary').textContent, /Automated checks passed/);
  assert.equal(report.querySelector('code').textContent, 'artifact-id-123');
  assert.match(report.textContent, /Acceptance criteria for owner review/);
  assert.match(report.textContent, /<script>review<\/script>/);
  assert.equal(report.querySelector('script,img'), null);

  const failed = createReport({ task: { status: 'failed', harness: { ...harness, result: { status: 'failed', checks: [
    { id: 'output', passed: true }, { id: 'artifact', passed: false },
  ] } } }, language: 'ja' });
  assert.match(failed.querySelector('summary').textContent, /不合格/);
  assert.deepEqual([...failed.querySelectorAll('[data-check-status]')].map(node => node.dataset.checkStatus), ['pass', 'fail']);
  const cancelled = createReport({ task: { status: 'cancelled', harness }, language: 'ko' });
  assert.equal(cancelled.dataset.harnessStatus, 'skipped');
  assert.deepEqual([...cancelled.querySelectorAll('[data-check-status]')].map(node => node.dataset.checkStatus), ['notRun', 'notRun']);
});
