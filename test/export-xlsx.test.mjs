import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildExportWorkbook, splitOutput } from '../lib/export-xlsx.mjs';

async function read(buffer) { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer); return workbook; }
const when = '2026-11-18T06:30:15.000Z';
function fixture(output = '=SUM(1,2)\nA real result') {
  return {
    server: { csrfToken: 'PRIVATE_CSRF_TOKEN_NEVER_EXPORT', internalSession: 'PRIVATE_SERVER_STATE' },
    terminal: { output: 'PRIVATE_TERMINAL_OUTPUT' }, apiKey: 'PRIVATE_API_KEY',
    settings: { workspace: 'C:\\연구 프로젝트\\workspace', language: 'en' },
    providers: [{ id: 'codex', status: 'ready', authenticated: true, apiKey: 'PRIVATE_PROVIDER_KEY' }, { id: 'claude', status: 'missing', authenticated: false }],
    departments: [{ id: 'strategy', code: 'STR', name: '=HYPERLINK("https://example.com")', provider: 'codex', role: '+SUM(1,2)' }],
    tasks: [
      { id: 'task-real', title: '=1+1', prompt: 'Analyze the requirements and report your findings.', departmentId: 'strategy', provider: 'codex', modelId: 'account-model', status: 'completed', priority: 'high', permission: 'read-only', demo: false, createdAt: when, startedAt: when, finishedAt: when, output, usage: { inputTokens: 120, outputTokens: 33 }, workflowId: 'workflow-1' },
      { id: 'task-queued', title: '@SUM(1,2)', departmentId: 'strategy', provider: 'codex', status: 'queued', createdAt: when, output: '', usage: { inputTokens: 0, outputTokens: 0 } },
      { id: 'task-demo', title: 'Demo', departmentId: 'strategy', provider: 'claude', status: 'completed', demo: true, createdAt: when, output: 'DEMO only', usage: { inputTokens: 999999, outputTokens: 999999 } },
    ],
    events: [{ id: 'event-1', timestamp: when, type: 'completed', provider: 'codex', departmentId: 'strategy', taskId: 'task-real', text: '-1+2', demo: false }],
    connections: [{ id: 'conn-1', providerId: 'codex', label: '+Personal', modelId: 'account-model', createdAt: when, updatedAt: when, secret: 'PRIVATE_CONNECTION_SECRET' }],
  };
}
const memory = { nodes: [{ id: 'memory-1', title: '@memory', content: '=Keep these facts', kind: 'note', tags: ['project', 'source'], pinned: true, revision: 3, createdAt: when, updatedAt: when, credential: 'PRIVATE_MEMORY_CREDENTIAL' }], edges: [] };

test('XLSX export contains seven styled localized sheets and only whitelisted data', async () => {
  const state = fixture();
  Object.assign(state.tasks[0], { departmentName: 'Original project agent', reportedModel: 'runtime-model' });
  const buffer = await buildExportWorkbook(state, { memory, language: 'en' });
  assert.ok(Buffer.isBuffer(buffer)); assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const workbook = await read(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Summary', 'Tasks', 'Task Output', 'Departments', 'Events', 'Memory', 'Connections']);
  for (const sheet of workbook.worksheets) {
    assert.equal(sheet.views[0].state, 'frozen'); assert.equal(sheet.views[0].ySplit, 1);
    assert.ok(sheet.autoFilter); assert.equal(sheet.getRow(1).getCell(1).font.bold, true); assert.ok(sheet.getColumn(1).width >= 20);
  }
  assert.equal(workbook.getWorksheet('Tasks').getCell('J2').value.toISOString(), when);
  assert.equal(workbook.getWorksheet('Tasks').getCell('C2').value, 'Original project agent');
  assert.equal(workbook.getWorksheet('Tasks').getCell('E2').value, 'runtime-model');
  assert.equal(workbook.getWorksheet('Tasks').getCell('R2').value, 'Analyze the requirements and report your findings.');
  assert.equal(workbook.getWorksheet('Tasks').getCell('S1').value, 'Requested reasoning effort');
  assert.equal(workbook.getWorksheet('Tasks').getCell('T1').value, 'Requested processing speed');
  assert.equal(workbook.getWorksheet('Tasks').getCell('S2').value, 'default');
  assert.equal(workbook.getWorksheet('Memory').getCell('F2').value, 3);
  const allValues = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
  for (const secret of ['PRIVATE_CSRF_TOKEN_NEVER_EXPORT', 'PRIVATE_SERVER_STATE', 'PRIVATE_TERMINAL_OUTPUT', 'PRIVATE_API_KEY', 'PRIVATE_PROVIDER_KEY', 'PRIVATE_CONNECTION_SECRET', 'PRIVATE_MEMORY_CREDENTIAL']) assert.ok(!allValues.includes(secret), `${secret} must not be exported`);
});

test('formula-like user content is kept as a literal Excel string cell', async () => {
  const workbook = await read(await buildExportWorkbook(fixture(), { memory, language: 'en' }));
  for (const [sheet, address, expected] of [
    ['Tasks', 'B2', '=1+1'], ['Tasks', 'B3', '@SUM(1,2)'], ['Departments', 'C2', '=HYPERLINK("https://example.com")'],
    ['Departments', 'E2', '+SUM(1,2)'], ['Events', 'G2', '-1+2'], ['Memory', 'I2', '=Keep these facts'], ['Connections', 'C2', '+Personal'],
  ]) { const cell = workbook.getWorksheet(sheet).getCell(address); assert.equal(cell.type, ExcelJS.ValueType.String); assert.equal(cell.value, expected); assert.equal(cell.numFmt, '@'); }
});

test('a complete 200000-character output round-trips across bounded Unicode-safe chunks', async () => {
  const output = ('한글🙂\n=literal output | ').repeat(12000).slice(0, 200000);
  assert.equal(output.length, 200000);
  const workbook = await read(await buildExportWorkbook(fixture(output), { memory, language: 'en' }));
  const sheet = workbook.getWorksheet('Task Output'); const parts = [];
  sheet.eachRow((row, index) => { if (index > 1 && row.getCell(1).value === 'task-real') { const part = row.getCell(5).value; assert.ok(part.length <= 32000); assert.equal(row.getCell(3).value, parts.length + 1); assert.equal(row.getCell(4).value, Math.ceil(output.length / 32000)); parts.push(part); } });
  assert.equal(parts.join(''), output); assert.equal(workbook.getWorksheet('Tasks').getCell('O2').value, output.length);
  const boundary = `${'a'.repeat(31999)}🙂tail`; const chunks = splitOutput(boundary);
  assert.equal(chunks[0].length, 31999); assert.equal(chunks[1], '🙂tail'); assert.equal(chunks.join(''), boundary);
});

test('Korean and Japanese headers are localized and unreported or demo usage is not invented', async () => {
  const korean = await read(await buildExportWorkbook(fixture(), { memory, language: 'ko' }));
  assert.equal(korean.getWorksheet('작업').getCell('A1').value, '작업 ID'); assert.ok(korean.getWorksheet('기억'));
  assert.equal(korean.getWorksheet('작업').getCell('S1').value, '추론 강도 (요청)');
  const japanese = await read(await buildExportWorkbook(fixture(), { memory, language: 'ja' }));
  assert.equal(japanese.getWorksheet('タスク').getCell('A1').value, 'タスクID'); assert.ok(japanese.getWorksheet('接続'));
  assert.equal(japanese.getWorksheet('タスク').getCell('T1').value, '処理速度（要求）');
  const english = await read(await buildExportWorkbook(fixture(), { memory, language: 'en' }));
  const tasks = english.getWorksheet('Tasks');
  assert.equal(tasks.getCell('M2').value, 120); assert.equal(tasks.getCell('N2').value, 33);
  assert.equal(tasks.getCell('M3').value, null); assert.equal(tasks.getCell('N3').value, null);
  assert.equal(tasks.getCell('M4').value, null); assert.equal(tasks.getCell('N4').value, null);
  const summary = english.getWorksheet('Summary');
  const values = new Map(); summary.eachRow((row, index) => { if (index > 1) values.set(row.getCell(1).value, row.getCell(2).value); });
  assert.equal(values.get('Reported input tokens'), 120); assert.equal(values.get('Reported output tokens'), 33); assert.equal(values.get('Real tasks'), 2); assert.equal(values.get('Demo tasks'), 1);
});

test('XLSX departments sheet shows the reporting parent and leaves old records without parentId blank', async () => {
  const state = fixture();
  state.departments.push({ id: 'child', code: 'AI', name: 'Child agent', provider: 'claude', role: 'Reports upward.', parentId: 'strategy' }, { id: 'dangling', code: 'AI', name: 'Dangling', provider: 'codex', role: 'Unknown parent.', parentId: 'removed-agent' });
  for (const [language, header] of [['ko', '상위 에이전트'], ['en', 'Reports to'], ['ja', '上位エージェント']]) {
    const sheet = (await read(await buildExportWorkbook(state, { memory, language }))).worksheets[3];
    assert.equal(sheet.getCell('F1').value, header);
    assert.equal(sheet.getCell('F2').value ?? '', '', 'old records without parentId stay blank');
    assert.equal(sheet.getCell('F3').value, '=HYPERLINK("https://example.com")', 'the parent name is exported as plain text');
    assert.equal(sheet.getCell('F4').value ?? '', '');
  }
});
