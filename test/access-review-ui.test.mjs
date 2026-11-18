import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../public/access-review.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const workspace = 'C:\\Projects\\Access';
const state = settings => ({ settings: { workspace, language: 'en', ...settings }, tasks: [] });
const review = changes => ({ available: true, workspace, generatedAt: '2026-11-19T01:02:03Z', diff: 'diff --git a/app.js b/app.js\n--- a/app.js\n+++ b/app.js\n-old\n+new\n', stagedDiff: '+staged line\n', untracked: ['new-file.txt'], files: [{ path: 'app.js', indexStatus: ' ', worktreeStatus: 'M' }], truncated: false, ...changes });
function fixture(api = async () => { throw new Error('Unexpected request'); }) {
  const dom = new JSDOM('<dialog id="settings-dialog"><div class="dialog-body"><form id="settings-form"><input name="workspace"></form></div></dialog>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/' });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new dom.window.Event('close')); };
  dom.window.eval(script);
  let latest = state(), options = { language: 'en', api, onSettingsChanged: result => saved.push(result) };
  const saved = [], calls = [];
  options.api = (path, input) => { calls.push(JSON.parse(JSON.stringify({ path, ...input }))); return api(path, input); };
  const render = (value = latest, overrides = {}) => { latest = value; options = { ...options, ...overrides }; dom.window.ImperiumAccessReview.render(latest, options); };
  const change = (node, value) => { if (node.type === 'checkbox') node.checked = value; else node.value = value; node.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const submit = () => dom.window.document.querySelector('.ar-policy-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  render();
  return { dom, document: dom.window.document, saved, calls, render, change, submit, open() { dom.window.document.querySelector('.ar-review-button').click(); }, close() { dom.window.ImperiumAccessReview.destroy(); dom.window.close(); } };
}

test('permissions are a separate explicit form with truthful enforcement details and no automatic requests', () => {
  const ui = fixture();
  try {
    const panel = ui.document.querySelector('.ar-panel'), form = panel.querySelector('form');
    assert.equal(panel.nextElementSibling.id, 'settings-form');
    assert.equal(form.closest('#settings-form'), null);
    assert.equal(ui.document.querySelector('#settings-form form'), null);
    assert.equal(ui.document.querySelector('#ar-access-policy').value, 'task-confirm');
    assert.equal(ui.document.querySelector('#ar-terminal-enabled').checked, true);
    assert.equal(ui.document.querySelector('.ar-primary').disabled, true);
    assert.match(panel.textContent, /CLI sandbox/);
    assert.match(panel.textContent, /Bash is not allowed/);
    assert.match(panel.textContent, /not a guarantee of OS isolation/);
    assert.match(panel.textContent, /Current adapters are read-only/);
    assert.match(panel.textContent, /OS user shell/);
    ui.render(state({ accessPolicy: 'read-only', terminalEnabled: false }));
    assert.equal(ui.document.querySelector('#ar-access-policy').value, 'read-only');
    assert.equal(ui.document.querySelector('#ar-terminal-enabled').checked, false);
    assert.deepEqual(ui.calls, []);
  } finally { ui.close(); }
});

test('dirty choices survive streamed settings and language changes without autosaving', () => {
  const ui = fixture();
  try {
    const policy = ui.document.querySelector('#ar-access-policy'), terminal = ui.document.querySelector('#ar-terminal-enabled');
    ui.change(policy, 'read-only'); ui.change(terminal, false);
    ui.render(state({ accessPolicy: 'task-confirm', terminalEnabled: true }), { language: 'ja' });
    assert.equal(ui.document.querySelector('#ar-access-policy'), policy);
    assert.equal(policy.value, 'read-only'); assert.equal(terminal.checked, false);
    assert.match(ui.document.querySelector('.ar-message').textContent, /未保存/);
    assert.equal(ui.document.querySelector('.ar-primary').disabled, false);
    ui.render(state(), { language: 'ko' });
    assert.equal(policy.value, 'read-only');
    assert.match(ui.document.querySelector('.ar-panel').textContent, /권한과 파일 변경 검토/);
    assert.deepEqual(ui.calls, []);
  } finally { ui.close(); }
});

test('saving posts only the permission fields and retains pending choices until the confirmed response', async () => {
  const pending = deferred(), ui = fixture(() => pending.promise);
  try {
    ui.change(ui.document.querySelector('#ar-access-policy'), 'read-only'); ui.change(ui.document.querySelector('#ar-terminal-enabled'), false);
    ui.submit(); ui.submit();
    assert.deepEqual(ui.calls, [{ path: '/api/settings', method: 'POST', body: { accessPolicy: 'read-only', terminalEnabled: false } }]);
    ui.render(state({ accessPolicy: 'task-confirm', terminalEnabled: true }), { language: 'ja' });
    assert.equal(ui.document.querySelector('#ar-access-policy').disabled, true);
    assert.equal(ui.document.querySelector('#ar-access-policy').value, 'read-only');
    assert.equal(ui.document.querySelector('#ar-terminal-enabled').checked, false);
    const result = { settings: { workspace, accessPolicy: 'read-only', terminalEnabled: false } };
    pending.resolve(result); await settle();
    assert.deepEqual(ui.saved, [result]);
    assert.equal(ui.document.querySelector('.ar-primary').disabled, true);
    assert.equal(ui.document.querySelector('#ar-access-policy').disabled, false);
    assert.match(ui.document.querySelector('.ar-message').textContent, /保存しました/);
  } finally { ui.close(); }
});

test('409 active-task rejection keeps unsaved choices and never reports a save', async () => {
  const error = new Error('Active tasks'); error.status = 409;
  const ui = fixture(async () => { throw error; });
  try {
    ui.change(ui.document.querySelector('#ar-access-policy'), 'read-only'); ui.submit(); await settle();
    assert.equal(ui.document.querySelector('#ar-access-policy').value, 'read-only');
    assert.equal(ui.document.querySelector('.ar-primary').disabled, false);
    assert.equal(ui.document.querySelector('.ar-message').getAttribute('role'), 'alert');
    assert.match(ui.document.querySelector('.ar-message').textContent, /running or queued.*409/);
    assert.deepEqual(ui.saved, []);
  } finally { ui.close(); }
});

test('Git review fetches on demand and shows working-tree, staged and untracked data as safe text only', async () => {
  const payload = '<img src=x onerror=alert(1)><script>unsafe()</script>';
  const result = review({ diff: `-old\n+${payload}\n`, untracked: [payload] });
  const ui = fixture(async () => ({ review: result }));
  try {
    assert.equal(ui.calls.length, 0); ui.open(); await settle();
    const dialog = ui.document.querySelector('.ar-review-dialog');
    assert.equal(dialog.open, true);
    assert.deepEqual(ui.calls, [{ path: '/api/changes' }]);
    assert.match(dialog.textContent, /not changes attributed to a specific AI task/);
    assert.match(dialog.textContent, /does not approve changes/);
    assert.equal(dialog.querySelector('.ar-patch').textContent, result.diff);
    assert.equal(dialog.querySelector('img,script,a,iframe'), null);
    assert.equal(dialog.querySelector('time').dateTime, result.generatedAt);
    assert.match(dialog.querySelector('.ar-review-workspace').textContent, /Projects/);
    assert.equal(dialog.querySelector('.ar-added').textContent, `+${payload}\n`);
    dialog.querySelector('[data-tab="staged"]').click();
    assert.equal(dialog.querySelector('.ar-patch').textContent, result.stagedDiff);
    assert.equal(dialog.querySelector('[data-tab="staged"]').getAttribute('aria-pressed'), 'true');
    dialog.querySelector('[data-tab="untracked"]').click();
    assert.equal(dialog.querySelector('.ar-untracked li').textContent, payload);
    assert.match(dialog.querySelector('.ar-files').textContent, /app.js/);
    assert.equal(ui.calls.length, 1, 'tabs never read untracked contents or execute Git mutations');
    assert.deepEqual([...dialog.querySelectorAll('button')].map(node => node.textContent), ['Refresh review', 'Close', 'Working tree', 'Staged', 'Untracked files (1)']);
    assert.doesNotMatch(script, /\.\s*(?:innerHTML|outerHTML)\b|insertAdjacentHTML\s*\(|\beval\s*\(/);
  } finally { ui.close(); }
});

test('a late review response cannot show another project, including close and reopen races', async () => {
  const old = deferred(), next = deferred(); let requests = 0;
  const ui = fixture(() => ++requests === 1 ? old.promise : next.promise);
  try {
    ui.open(); const nextWorkspace = 'C:\\Projects\\Other';
    ui.render(state({ workspace: nextWorkspace }));
    assert.equal(ui.document.querySelector('.ar-review-dialog'), null);
    ui.open();
    old.resolve({ review: review({ diff: '+PRIVATE OLD PROJECT\n' }) }); await settle();
    assert.doesNotMatch(ui.document.body.textContent, /PRIVATE OLD PROJECT/);
    next.resolve({ review: review({ workspace: nextWorkspace, diff: '+CURRENT PROJECT\n' }) }); await settle();
    assert.equal(ui.document.querySelector('.ar-patch').textContent, '+CURRENT PROJECT\n');
    assert.doesNotMatch(ui.document.body.textContent, /PRIVATE OLD PROJECT/);
  } finally { ui.close(); }
});

test('server workspace mismatch clears the patch and unavailable Git reasons remain explicit and translated', async () => {
  let result = { review: review({ workspace: 'C:\\Projects\\Wrong', diff: '+DO NOT SHOW\n' }) };
  const ui = fixture(async () => result);
  try {
    ui.open(); await settle();
    assert.match(ui.document.querySelector('.ar-review-message').textContent, /project changed/);
    assert.equal(ui.document.querySelector('.ar-patch'), null);
    for (const reason of ['git-unavailable', 'not-repository', 'timeout', 'git-error']) {
      result = { review: review({ available: false, reason }) };
      ui.document.querySelector('.ar-review-actions button').click(); await settle();
      assert.equal(ui.document.querySelector('.ar-patch'), null);
      assert.ok(ui.document.querySelector('.ar-review-message').textContent.length > 10);
      assert.equal(ui.document.querySelector('.ar-review-tabs').hidden, true);
    }
    ui.render(state(), { language: 'ja' });
    assert.match(ui.document.querySelector('.ar-review-message').textContent, /変更内容を返せません/);
  } finally { ui.close(); }
});

test('live snapshots preserve the inspected patch DOM and scroll; long changes are explicitly bounded', async () => {
  const long = '+line\n'.repeat(10000), ui = fixture(async () => ({ review: review({ diff: long }) }));
  try {
    ui.open(); await settle();
    const pre = ui.document.querySelector('.ar-patch'); pre.scrollTop = 145;
    assert.ok(pre.querySelectorAll('span').length <= 3000);
    assert.equal(ui.document.querySelector('.ar-truncated').hidden, false);
    ui.render(state()); ui.render(state());
    assert.equal(ui.document.querySelector('.ar-patch'), pre);
    assert.equal(pre.scrollTop, 145);
    assert.equal(ui.calls.length, 1);
    ui.render(state(), { language: 'ko' });
    assert.match(ui.document.querySelector('.ar-truncated').textContent, /일부만 표시/);
    assert.equal(ui.calls.length, 1, 'language updates never fetch or save');
  } finally { ui.close(); }
});
