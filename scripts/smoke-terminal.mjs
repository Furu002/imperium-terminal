import path from 'node:path';
import { pathToFileURL } from 'node:url';
const moduleURL = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2], 'lib/terminal.mjs')) : new URL('../lib/terminal.mjs', import.meta.url);
const { createTerminalManager } = await import(moduleURL.href);
const manager = createTerminalManager();
const session = manager.start({ cwd: process.cwd() });
const timer = setTimeout(() => { manager.closeAll(); console.error('PTY timeout'); process.exit(1); }, 12000);
let output = '';
manager.subscribe(session.id, event => {
  if (event.type !== 'data') return;
  output += event.data;
  if (output.includes('IMPERIUM_PTY_READY')) {
    clearTimeout(timer); manager.closeAll(); console.log('PTY_SMOKE_OK'); process.exit(0);
  }
});
manager.write(session.id, process.platform === 'win32' ? "Write-Output ('IMPERIUM_'+'PTY_READY')\r" : "printf 'IMPERIUM_%s\\n' PTY_READY\r");
