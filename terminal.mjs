import readline from 'node:readline';
import { createHQServer } from './server.mjs';

const url = `http://127.0.0.1:${Number(process.env.HQ_PORT) || 4310}`;
const langArg = process.argv.find(a => a.startsWith('--lang='))?.split('=')[1];
let lang = ['ko', 'en', 'ja'].includes(langArg) ? langArg : 'ko';
const words = {
  ko: { title: 'AI 지휘 터미널', running: '실행', queued: '대기', completed: '완료', departments: '조직 현황', missions: '작업 현황', feed: '실시간 활동', hint: '부서ID 지시내용 ↵  /help 도움말  /lang ko|en|ja  /quit 종료', help: '지시: strategy 프로젝트 분석해줘 | /write engineering 기능구현 | /cancel 작업ID | /demo | /clear-demo | /providers | /lang ko|en|ja | /quit', offline: '연결 끊김 · 재연결 중', sent: '지시를 접수했습니다.', empty: '아직 작업이 없습니다. 부서 ID와 지시를 입력하세요.' },
  en: { title: 'AI COMMAND TERMINAL', running: 'RUN', queued: 'QUEUE', completed: 'DONE', departments: 'DEPARTMENTS', missions: 'OPERATIONS', feed: 'LIVE FEED', hint: 'department instruction ↵  /help  /lang ko|en|ja  /quit', help: 'strategy Your instruction | /write engineering Your instruction | /cancel taskID | /demo | /clear-demo | /providers | /lang ko|en|ja | /quit', offline: 'Disconnected · reconnecting', sent: 'Command received.', empty: 'No operations. Enter a department ID and your instruction.' },
  ja: { title: 'AI 指揮ターミナル', running: '実行', queued: '待機', completed: '完了', departments: '組織状況', missions: '作業状況', feed: 'リアルタイム活動', hint: '部署ID 指示内容 ↵  /help  /lang ko|en|ja  /quit', help: 'strategy 指示内容 | /write engineering 指示内容 | /cancel 作業ID | /demo | /clear-demo | /providers | /lang ko|en|ja | /quit', offline: '切断 · 再接続中', sent: '指示を受け付けました。', empty: '作業はありません。部署IDと指示を入力してください。' },
};
let owned, state, input = '', message = '', busy = false;
let timer;
const C = { reset: '\x1b[0m', orange: '\x1b[38;2;255;145;64m', dim: '\x1b[38;2;119;133;147m', green: '\x1b[38;2;76;210;149m', cyan: '\x1b[38;2;101;192;220m', red: '\x1b[38;2;240;100;100m' };
const clean = s => String(s ?? '').replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|$))/g, '').replace(/[\x00-\x1f\x7f]/g, ' ');
const width = s => [...s].reduce((n, c) => n + (c.codePointAt(0) >= 0x1100 ? 2 : 1), 0);
function fit(value, length) {
  let s = clean(value);
  while (width(s) > length) s = [...s].slice(0, -1).join('');
  return s + ' '.repeat(Math.max(0, length - width(s)));
}
function draw() {
  if (!state) return;
  const t = words[lang];
  const cols = Math.max(66, Math.min(process.stdout.columns || 120, 150));
  const divider = '─'.repeat(cols);
  const lines = [];
  const add = (s, color = '') => lines.push(color + fit(s, cols) + C.reset);
  add('  I M P E R I U M   /   ' + t.title, C.orange);
  add(`  SUBSCRIPTION CLI   ${url}   ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul' })} KST`, C.dim);
  add(divider, C.dim);
  add(`  ${t.running} ${state.tasks.filter(x => x.status === 'running').length}     ${t.queued} ${state.tasks.filter(x => x.status === 'queued').length}     ${t.completed} ${state.tasks.filter(x => x.status === 'completed' && !x.demo).length}     ${state.providers.map(p => `${p.id.toUpperCase()} ${p.status.toUpperCase()}`).join('    ')}`, C.green);
  add(divider, C.dim);
  add('  01 / ' + t.departments, C.orange);
  for (const d of state.departments) {
    const task = state.tasks.find(x => x.departmentId === d.id && x.status === 'running');
    add('  ' + fit(d.id, 14) + fit(d.name, 18) + fit(d.provider, 9) + (task ? `RUNNING  ${task.title}` : 'IDLE'), task ? C.green : C.dim);
  }
  add(divider, C.dim);
  add('  02 / ' + t.missions, C.orange);
  const tasks = [...state.tasks].reverse().slice(0, 7);
  if (!tasks.length) add('  ' + t.empty, C.dim);
  for (const task of tasks) add('  ' + fit(task.id.slice(0, 8), 11) + fit(task.status.toUpperCase(), 14) + fit(task.departmentId, 14) + (task.demo ? '[DEMO] ' : '') + task.title, task.status === 'failed' ? C.red : task.status === 'running' ? C.green : '');
  add(divider, C.dim);
  add('  03 / ' + t.feed, C.orange);
  for (const event of state.events.slice(-Math.max(2, Math.min(5, (process.stdout.rows || 40) - 25)))) add('  ' + new Date(event.timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul' }) + '  ' + clean(event.text), C.dim);
  add(divider, C.dim);
  add('  ' + t.hint, C.dim);
  if (message) add('  ' + message, C.cyan);
  add('  HQ › ' + input, C.orange);
  if (process.stdout.isTTY) process.stdout.write('\x1b[H\x1b[2J' + lines.join('\n'));
  else console.log(lines.map(s => s.replace(/\x1b\[[0-9;]*m/g, '')).join('\n'));
}
async function refresh() {
  const response = await fetch(`${url}/api/state`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  state = await response.json();
  if (state.server?.mode !== 'subscription-cli') throw new Error('Another application is using this port.');
}
async function mutate(route, data, method = 'POST') {
  const response = await fetch(url + route, { method, headers: { 'content-type': 'application/json', 'x-hq-token': state.server.csrfToken }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  await refresh();
}
async function command(raw) {
  const value = raw.trim();
  if (!value) return;
  if (value === '/quit') return quit();
  if (value === '/help') { message = words[lang].help; return; }
  if (value.startsWith('/lang ')) {
    const next = value.split(' ')[1];
    if (words[next]) { lang = next; message = ''; } else message = '/lang ko | en | ja';
    return;
  }
  if (value === '/demo') return mutate('/api/demo');
  if (value === '/clear-demo') return mutate('/api/demo', null, 'DELETE');
  if (value === '/providers') return mutate('/api/providers/refresh');
  if (value.startsWith('/cancel ')) {
    const id = value.split(' ')[1];
    const matches = state.tasks.filter(t => t.id.startsWith(id));
    if (matches.length !== 1) throw new Error('Use one unique task ID.');
    return mutate(`/api/tasks/${matches[0].id}/cancel`);
  }
  const writable = value.startsWith('/write ');
  const text = writable ? value.slice(7) : value;
  const firstSpace = text.indexOf(' ');
  const departmentId = text.slice(0, firstSpace);
  if (firstSpace < 1 || !state.departments.some(d => d.id === departmentId)) { message = words[lang].help; return; }
  await mutate('/api/tasks', { departmentId, prompt: text.slice(firstSpace + 1), permission: writable ? 'workspace-write' : 'read-only' });
  message = words[lang].sent;
}
async function quit() {
  clearInterval(timer);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  if (process.stdout.isTTY) process.stdout.write('\x1b[?25h\x1b[?1049l');
  await owned?.close();
  process.exit(0);
}
try { await refresh(); }
catch {
  owned = createHQServer({ port: Number(process.env.HQ_PORT) || 4310 });
  await owned.start();
  await refresh();
}
if (!process.stdin.isTTY || process.argv.includes('--once')) {
  draw(); await owned?.close();
} else {
  process.stdout.write('\x1b[?1049h\x1b[?25l');
  process.stdin.setRawMode(true);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') return quit();
    if (busy) return;
    if (key.name === 'return') {
      const cmd = input; input = ''; busy = true;
      try { await command(cmd); } catch (error) { message = error.message; }
      finally { busy = false; draw(); }
    } else if (key.name === 'backspace') { input = [...input].slice(0, -1).join(''); draw(); }
    else if (key.ctrl && key.name === 'u') { input = ''; draw(); }
    else if (str && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(str)) { if (input.length < 12000) input += str; draw(); }
  });
  process.stdout.on('resize', draw);
  timer = setInterval(async () => { try { await refresh(); } catch { message = words[lang].offline; } draw(); }, 1000);
  process.once('SIGTERM', quit);
  draw();
}
