import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = ['server.mjs', 'terminal.mjs', ...['lib', 'public', 'desktop', 'scripts'].flatMap(dir => readdirSync(dir).filter(file => /\.(mjs|cjs|js)$/.test(file)).map(file => `${dir}/${file}`))];
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true, env: { ...process.env, ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}) } });
  if (check.status) process.exit(check.status);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
