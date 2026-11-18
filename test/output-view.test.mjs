import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../public/output-view.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/output-view.css', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const task = changes => ({ id: 'task-one', title: 'Readable result', prompt: 'Please inspect **this exact request**.', provider: 'claude', modelId: 'configured-model', reasoningEffort: 'high', speed: 'fast', permission: 'read-only', status: 'completed', output: '# Result\n\nThe answer is **ready**.', logs: [], ...changes });

test('model labels distinguish requested configuration from explicit CLI execution metadata', () => {
  const ui = fixture();
  try {
    ui.update(task({}));
    assert.match(ui.document.querySelector('.io-model-label').textContent, /Requested model.*configured-model.*not reported/);
    ui.update(task({ reportedModel: 'claude-observed-version' }));
    assert.equal(ui.document.querySelector('.io-model-label').textContent, 'CLI reported model · claude-observed-version');
    assert.match(ui.document.querySelector('.io-task-details').textContent, /configured-model/);
    assert.match(ui.document.querySelector('.io-task-details').textContent, /claude-observed-version/);
    ui.update(task({ reportedModel: '<script>model</script>' }), 'ja');
    assert.match(ui.document.querySelector('.io-model-label').textContent, /CLI報告モデル/);
    assert.equal(ui.document.querySelector('script'), null);
  } finally { ui.close(); }
});
function fixture(savedFont) {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only', url: 'http://127.0.0.1:4310/' });
  const writes = [];
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new dom.window.Event('close')); };
  if (savedFont !== undefined) dom.window.localStorage.setItem('imperium.outputFontSize', savedFont);
  dom.window.eval(source);
  const view = dom.window.ImperiumOutput.create({ onCopy: async value => { writes.push(value); return true; } });
  dom.window.document.querySelector('main').append(view.element);
  return { dom, document: dom.window.document, api: dom.window.ImperiumOutput, view, writes, update(value, language = 'en') { view.update({ task: value, language, provider: 'Claude Code' }); }, close() { view.destroy(); dom.window.close(); } };
}

test('output is a safe readable conversation with headings, lists, tables and exactly copied fenced code', async () => {
  const ui = fixture();
  const code = 'const greeting = "안녕";\r\nconsole.log(greeting);\r\n';
  const output = '# Result\n\nA **clear** answer with `inline code`.\n\n- First\n- [x] Done\n\n| Name | Value |\n| --- | --- |\n| Alpha | 42 |\n\n```js\r\n' + code + '```\r\n\n<img src=x onerror=alert(1)>\n<script>alert(1)</script>';
  try {
    ui.update(task({ output }));
    assert.equal(ui.document.querySelector('.io-request-text').textContent, 'Please inspect **this exact request**.');
    assert.equal(ui.document.querySelector('.io-markdown h2').textContent, 'Result');
    assert.equal(ui.document.querySelector('.io-markdown strong').textContent, 'clear');
    assert.equal(ui.document.querySelectorAll('.io-markdown li').length, 2);
    assert.equal(ui.document.querySelector('input[type=checkbox]').checked, true);
    assert.equal(ui.document.querySelector('input[type=checkbox]').disabled, true);
    assert.equal(ui.document.querySelectorAll('.io-markdown table td').length, 2);
    assert.equal(ui.document.querySelector('img,script'), null);
    assert.match(ui.document.querySelector('.io-markdown').textContent, /<script>alert\(1\)<\/script>/);
    ui.document.querySelector('.io-code-copy').click(); await settle();
    assert.deepEqual(ui.writes, [code]);
    ui.document.querySelector('.io-answer-copy').click(); await settle();
    assert.deepEqual(ui.writes, [code, output]);
    assert.equal(ui.document.querySelector('.io-raw'), null, 'raw text is lazy');
    ui.document.querySelectorAll('.io-mode')[1].click();
    assert.equal(ui.document.querySelector('.io-raw').textContent, output);
    assert.equal(ui.document.querySelector('.io-reading').hidden, true);
  } finally { ui.close(); }
});

test('links allow explicit HTTP and local navigation, never scripts or automatic external images', () => {
  const ui = fixture();
  try {
    const output = '[safe](https://example.com/docs) [local](./notes.md) [hash](#result) [bad](javascript:alert(1)) [data](data:text/html,x) [file](file:///secret) [remote](//example.com/x) ![image](https://example.com/tracker.png)';
    ui.update(task({ output }));
    const links = [...ui.document.querySelectorAll('.io-markdown a')];
    assert.equal(links.length, 3);
    assert.deepEqual(links.map(link => link.textContent), ['safe', 'local', 'hash']);
    assert.ok(links.every(link => link.target === '_blank' && link.rel === 'noopener noreferrer'));
    assert.equal(ui.document.querySelector('img,iframe,object,video,svg'), null);
    for (const value of ['javascript:alert(1)', 'data:text/html,x', 'file:///secret', '//host/x', String.fromCharCode(92) + 'evil.test/x', 'https://a.test/\nb', 'mailto:user@example.com']) assert.equal(ui.api.safeLink(value), null);
    assert.equal(ui.api.safeLink('/notes?id=1'), 'http://127.0.0.1:4310/notes?id=1');
    assert.equal(ui.api.safeLink('https://example.com/docs'), 'https://example.com/docs');
    assert.doesNotMatch(source, /\.\s*(?:innerHTML|outerHTML)\b|insertAdjacentHTML\s*\(|\bfetch\s*\(|new\s+(?:Image|XMLHttpRequest)\b|\beval\s*\(/);
  } finally { ui.close(); }
});

test('320k response renders bounded sections, loads raw text lazily and copies the complete original', async () => {
  const ui = fixture(), output = 'Long response 한글🙂 content.\n'.repeat(14000).slice(0, 320000);
  try {
    ui.update(task({ output }));
    assert.ok(ui.document.querySelector('.io-markdown').textContent.length <= 40000);
    assert.equal(ui.document.querySelector('.io-raw'), null);
    ui.document.querySelector('.io-answer-copy').click(); await settle();
    assert.equal(ui.writes[0], output);
    ui.document.querySelector('.io-reading .io-load-more').click();
    assert.ok(ui.document.querySelector('.io-markdown').textContent.length <= 80000);
    ui.document.querySelector('.io-reading .io-load-more').click();
    assert.ok(ui.document.querySelector('.io-markdown').textContent.length <= 120000);
    ui.document.querySelector('.io-reading .io-load-more').click();
    assert.equal(ui.document.querySelector('.io-raw').textContent, output.slice(0, 60000));
    ui.document.querySelector('.io-raw-view .io-load-more').click();
    assert.equal(ui.document.querySelector('.io-raw').textContent, output.slice(0, 120000));
    while (ui.document.querySelector('.io-raw-view .io-load-more')) ui.document.querySelector('.io-raw-view .io-load-more').click();
    assert.equal(ui.document.querySelector('.io-raw').textContent, output);
  } finally { ui.close(); }
});

test('unchanged snapshots preserve parsed DOM, disclosure state and raw mode during streaming', async () => {
  const ui = fixture(), first = task({ status: 'running', logs: [{ id: 'one', timestamp: '2026-11-18T00:00:00Z', type: 'tool', text: 'Read app.js' }] });
  try {
    ui.update(first);
    const body = ui.document.querySelector('.io-markdown'), details = ui.document.querySelector('.io-task-details');
    details.open = true;
    ui.update({ ...first, logs: [...first.logs] });
    assert.equal(ui.document.querySelector('.io-markdown'), body);
    assert.equal(ui.document.querySelector('.io-task-details'), details);
    assert.equal(details.open, true);
    const logs = ui.document.querySelector('.io-execution-logs');
    assert.equal(logs.querySelector('.io-log-body'), null);
    logs.open = true; await settle();
    assert.match(logs.textContent, /Read app.js/);
    ui.document.querySelectorAll('.io-mode')[1].click();
    ui.update({ ...first, output: first.output + '\nMore output', logs: [...first.logs, { id: 'two', type: 'status', text: 'Finished reading' }] }); await settle();
    assert.equal(ui.document.querySelector('.io-reading').hidden, true);
    assert.equal(ui.document.querySelector('.io-raw').textContent, first.output + '\nMore output');
    assert.equal(ui.document.querySelector('.io-execution-logs').open, true);
    assert.match(ui.document.querySelector('.io-execution-logs').textContent, /Finished reading/);
  } finally { ui.close(); }
});

test('expanded conversation updates live, copies original text and closes with its owning task view', async () => {
  const ui = fixture(), first = task({ title: '<script>unsafe title</script>' });
  try {
    ui.update(first); ui.document.querySelector('.io-expand').click();
    const dialog = ui.document.querySelector('dialog.io-dialog');
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector('.io-dialog-heading strong').textContent, first.title);
    assert.equal(dialog.querySelector('.io-expand'), null, 'expanded views cannot nest dialogs');
    ui.update({ ...first, output: '# Updated\n\nNew response' });
    assert.equal(dialog.querySelector('.io-markdown h2').textContent, 'Updated');
    dialog.querySelector('.io-answer-copy').click(); await settle();
    assert.equal(ui.writes[0], '# Updated\n\nNew response');
    dialog.querySelector('.io-dialog-close').click();
    assert.equal(ui.document.querySelector('dialog'), null);
    ui.document.querySelector('.io-expand').click();
    ui.view.destroy(); assert.equal(ui.document.querySelector('dialog'), null);
  } finally { ui.close(); }
});

test('interface translations never alter request or model text; previews cannot copy incomplete responses', () => {
  const ui = fixture(), value = task({ output: '원문은 그대로 / Original / 原文', detailsTruncated: true });
  try {
    for (const [language, expected] of [['ko', '내 요청'], ['en', 'Your request'], ['ja', 'あなたの依頼']]) {
      ui.update(value, language);
      assert.equal(ui.document.querySelector('.io-request .io-message-heading strong').textContent, expected);
      assert.equal(ui.document.querySelector('.io-markdown').textContent, value.output);
      assert.equal(ui.document.querySelector('.io-answer-copy').disabled, true);
      assert.ok(ui.document.querySelector('.io-preview-note'));
    }
    ui.update({ ...value, detailsTruncated: false });
    assert.equal(ui.document.querySelector('.io-answer-copy').disabled, false);
    assert.equal(ui.document.querySelector('.io-preview-note'), null);
    assert.match(ui.document.querySelector('.io-task-details').textContent, /configured-model/);
  } finally { ui.close(); }
});

test('waiting, cancellation and failure states stay explicit and log rendering remains bounded', async () => {
  const ui = fixture();
  try {
    ui.update(task({ status: 'running', output: '' }));
    assert.equal(ui.document.querySelector('.io-answer-copy').disabled, true);
    assert.match(ui.document.querySelector('.io-waiting').textContent, /Writing a response/);
    ui.update(task({ status: 'cancelled', output: '' }));
    assert.match(ui.document.querySelector('.io-waiting').textContent, /cancelled/);
    ui.update(task({ status: 'failed', output: '', error: '<img src=x> Failure', logs: Array.from({ length: 120 }, (_, index) => ({ id: String(index), type: 'tool', text: `Log ${index}` })) }));
    assert.equal(ui.document.querySelector('.io-error p').textContent, '<img src=x> Failure');
    assert.equal(ui.document.querySelector('img'), null);
    ui.document.querySelector('.io-execution-logs').open = true; await settle();
    assert.equal(ui.document.querySelectorAll('.io-log-entry').length, 100);
    assert.match(ui.document.querySelector('.io-log-body').textContent, /latest 100/);
  } finally { ui.close(); }
});

test('pathological Markdown stays bounded and partial fenced code cannot copy an incomplete block', () => {
  const ui = fixture();
  try {
    ui.update(task({ output: 'text\n\n'.repeat(15000) }));
    assert.ok(ui.document.querySelector('.io-markdown').children.length <= 351);
    ui.update(task({ output: '```js\n' + 'x'.repeat(100000) + '\n```' }));
    assert.equal(ui.document.querySelector('.io-code-copy'), null);
    assert.match(ui.document.querySelector('.io-partial-code').textContent, /Partial code/);
  } finally { ui.close(); }
});

test('completed task logs retain original text while translating skill and public-summary provenance', async () => {
  const ui = fixture();
  const logs = [
    { type: 'skill', source: 'cli-skill-read', text: 'frontend-design' },
    { type: 'skill', source: 'cli-skill-call', text: 'code-review' },
    { type: 'skill', source: 'model-reported', text: 'testing' },
    { type: 'status', source: 'model-summary', text: 'A public summary' },
    { type: 'status', source: 'model-estimate', text: 'A public stage' },
    { type: 'tool', text: 'Original tool log' },
  ];
  try {
    for (const [language, expected] of [
      ['ko', ['스킬 문서 읽기 감지', '스킬 CLI 호출 감지', '모델 스킬 사용 보고', '공개 수행 요약', 'AI 단계 보고']],
      ['en', ['Skill document read detected', 'Skill CLI invocation detected', 'Model-reported skill usage', 'Public execution summary', 'AI stage report']],
      ['ja', ['スキル文書の読み取りを検知', 'スキルのCLI呼び出しを検知', 'モデルによるスキル使用報告', '公開された実行要約', 'AIの段階報告']],
    ]) {
      ui.update(task({ status: 'completed', logs }), language);
      ui.document.querySelector('.io-execution-logs').open = true; await settle();
      const body = ui.document.querySelector('.io-log-body');
      for (const label of expected) assert.ok(body.textContent.includes(label));
      assert.deepEqual([...body.querySelectorAll('.io-log-entry pre')].map(node => node.textContent), logs.map(log => log.text));
      assert.equal(body.querySelectorAll('.io-log-entry>span')[5].textContent, 'tool');
      assert.ok(body.querySelector('.io-log-source-note'));
    }
  } finally { ui.close(); }
});

test('readable defaults expose a public large-reader API and a nearly full-window dialog', () => {
  const ui = fixture();
  try {
    const style = ui.document.createElement('style'); style.textContent = styles; ui.document.head.append(style);
    ui.update(task({ reportedModel: 'observed-model' }));
    assert.equal(ui.view.element.style.getPropertyValue('--io-body-size'), '18px');
    assert.equal(ui.document.querySelector('.io-expand').textContent, 'Read large');
    assert.equal(ui.document.querySelector('dialog'), null, 'streamed updates do not open a window');
    ui.view.openFull();
    const dialog = ui.document.querySelector('.io-dialog');
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector('.io-conversation').style.getPropertyValue('--io-body-size'), '20px');
    assert.equal(Number.parseFloat(ui.dom.window.getComputedStyle(dialog).width), Math.min(1400, ui.dom.window.innerWidth - 32));
    assert.equal(Number.parseFloat(ui.dom.window.getComputedStyle(dialog).height), ui.dom.window.innerHeight - 32);
    assert.match(dialog.querySelector('.io-model-label').textContent, /observed-model/);
    assert.equal(dialog.querySelector('.io-expand'), null);
    ui.view.openFull(); assert.equal(ui.document.querySelectorAll('.io-dialog').length, 1);
    assert.doesNotMatch(styles, /\.io-dialog \.io-markdown\{font-size:(?:14|15)px/);
  } finally { ui.close(); }
});

test('text size controls persist bounded global reader preferences without changing source text or reparsing', async () => {
  const ui = fixture(), value = task({ output: '# Heading\n\nThe **original** response.\n\n```js\nexact();\n```' });
  try {
    ui.update(value); const parsed = ui.document.querySelector('.io-markdown');
    ui.document.querySelector('.io-font-up').click();
    assert.equal(ui.view.element.style.getPropertyValue('--io-body-size'), '20px');
    assert.equal(ui.dom.window.localStorage.getItem('imperium.outputFontSize'), '20');
    assert.equal(ui.document.querySelector('.io-markdown'), parsed);
    for (let i = 0; i < 10; i++) ui.document.querySelector('.io-font-up').click();
    assert.equal(ui.view.element.style.getPropertyValue('--io-body-size'), '28px');
    assert.equal(ui.document.querySelector('.io-font-up').disabled, true);
    ui.view.openFull();
    assert.equal(ui.document.querySelector('.io-dialog .io-conversation').style.getPropertyValue('--io-body-size'), '28px');
    for (let i = 0; i < 10; i++) ui.document.querySelector('.io-font-down').click();
    assert.equal(ui.view.element.style.getPropertyValue('--io-body-size'), '14px');
    assert.equal(ui.document.querySelector('.io-font-down').disabled, true);
    ui.update(value, 'ja');
    assert.equal(ui.view.element.style.getPropertyValue('--io-body-size'), '14px');
    assert.equal(ui.document.querySelector('.io-font-up').getAttribute('aria-label'), '文字を大きく');
    ui.document.querySelector('.io-answer-copy').click(); await settle();
    assert.equal(ui.writes[0], value.output);
  } finally { ui.close(); }
  for (const [stored, expected] of [['22', '22px'], ['garbage', '18px'], ['999', '28px'], ['-4', '14px']]) {
    const restored = fixture(stored);
    try { restored.update(task({})); assert.equal(restored.view.element.style.getPropertyValue('--io-body-size'), expected); }
    finally { restored.close(); }
  }
});
