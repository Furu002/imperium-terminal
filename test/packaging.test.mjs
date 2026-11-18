import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, readdir, copyFile, realpath, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as tar from 'tar';

const require = createRequire(import.meta.url);
const { createBeforePack, targetFor, validateArchivePaths } = require('../scripts/before-pack.cjs');
const version = '1.2.0-beta.18';
const native = arch => {
  const buffer = Buffer.alloc(128);
  buffer.writeUInt32LE(0xfeedfacf, 0); buffer.writeUInt32LE(arch === 'x64' ? 0x01000007 : 0x0100000c, 4);
  buffer.write('napi_register_module_v1', 32);
  return buffer;
};

async function fixture(t) {
  // macOS commonly resolves /var/folders through /private/var/folders. Use the
  // same canonical root as the production hook for all containment assertions.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'imperium-pack-test-')));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(path.dirname(resolved), await realpath(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('imperium-pack-test-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const scope = path.join(root, 'node_modules', '@lydell');
  await mkdir(path.join(scope, 'node-pty'), { recursive: true });
  const optionalDependencies = {};
  const packages = {};
  const archives = new Map();
  for (const arch of ['x64', 'arm64']) {
    const name = `@lydell/node-pty-darwin-${arch}`;
    const directoryName = `node-pty-darwin-${arch}`;
    const source = path.join(root, `source-${arch}`);
    const pkg = path.join(source, 'package');
    await mkdir(path.join(pkg, 'lib'), { recursive: true });
    await mkdir(path.join(pkg, 'prebuilds', `darwin-${arch}`), { recursive: true });
    await writeFile(path.join(pkg, 'package.json'), JSON.stringify({ name, version, os: ['darwin'], cpu: [arch] }));
    await writeFile(path.join(pkg, 'lib', 'index.js'), 'module.exports = {};');
    await writeFile(path.join(pkg, 'prebuilds', `darwin-${arch}`, 'pty.node'), native(arch));
    const archive = path.join(root, `${arch}.tgz`);
    await tar.c({ gzip: true, file: archive, cwd: source }, ['package']);
    optionalDependencies[name] = version;
    packages[`node_modules/${name}`] = { version, resolved: `https://registry.npmjs.org/${name}/-/${directoryName}-${version}.tgz`, integrity: `sha512-${createHash('sha512').update(await readFile(archive)).digest('base64')}` };
    archives.set(name, archive);
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'test-imperium', dependencies: { '@lydell/node-pty': version } }));
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages }));
  await writeFile(path.join(scope, 'node-pty', 'package.json'), JSON.stringify({ name: '@lydell/node-pty', version, optionalDependencies }));
  const context = arch => ({ electronPlatformName: 'darwin', arch, packager: { info: { appDir: root, projectDir: root } } });
  const downloads = [];
  const npm = async args => {
    assert.equal(args[0], 'pack'); assert.ok(args.includes('--ignore-scripts'));
    assert.ok(args.includes('--registry=https://registry.npmjs.org/'));
    const url = new URL(args[1]); assert.equal(url.origin, 'https://registry.npmjs.org');
    const name = decodeURIComponent(url.pathname).split('/-/')[0].slice(1);
    const directoryName = name.split('/')[1];
    const filename = `lydell-${directoryName}-${version}.tgz`;
    const cache = args[args.indexOf('--pack-destination') + 1];
    assert.ok(path.resolve(cache).startsWith(`${root}${path.sep}`));
    await copyFile(archives.get(name), path.join(cache, filename));
    downloads.push(name);
    return JSON.stringify([{ name, version, filename }]);
  };
  const collect = async () => (await readdir(scope)).filter(name => name !== 'node-pty').map(name => ({ name: `@lydell/${name}`, version, dir: path.join(scope, name) }));
  return { root, context, npm, collect, downloads, scope };
}

test('packaging target selection uses electron-builder target architecture rather than host architecture', () => {
  assert.deepEqual(targetFor({ electronPlatformName: 'darwin', arch: 1 }), { platform: 'darwin', arch: 'x64', name: '@lydell/node-pty-darwin-x64', directoryName: 'node-pty-darwin-x64' });
  assert.equal(targetFor({ electronPlatformName: 'darwin', arch: 3 }).arch, 'arm64');
  assert.throws(() => targetFor({ electronPlatformName: 'darwin', arch: 4 }), /Unsupported/);
  assert.throws(() => targetFor({ electronPlatformName: '../escape', arch: 1 }), /Unsupported/);
});

test('one build process prepares both Mac architectures and reuses existing verified packages', async t => {
  const data = await fixture(t);
  const hook = createBeforePack({ npm: data.npm, collect: data.collect, logger() {} });
  await Promise.all([hook(data.context(1)), hook(data.context(3))]);
  for (const arch of ['x64', 'arm64']) {
    const directory = path.join(data.scope, `node-pty-darwin-${arch}`);
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    assert.equal(manifest.cpu[0], arch);
    assert.deepEqual(await readFile(path.join(directory, 'prebuilds', `darwin-${arch}`, 'pty.node')), native(arch));
  }
  await hook(data.context(1));
  assert.deepEqual(data.downloads.sort(), ['@lydell/node-pty-darwin-arm64', '@lydell/node-pty-darwin-x64']);
});

test('modified tarballs fail locked integrity validation before entering node_modules', async t => {
  const data = await fixture(t);
  const hook = createBeforePack({ npm: async args => {
    const output = await data.npm(args);
    const packed = JSON.parse(output)[0];
    await writeFile(path.join(args[args.indexOf('--pack-destination') + 1], packed.filename), 'tampered archive');
    return output;
  }, collect: data.collect, logger() {} });
  await assert.rejects(hook(data.context(1)), /integrity/);
  await assert.rejects(access(path.join(data.scope, 'node-pty-darwin-x64')));
});

test('packaging fails if the production dependency collector omits the target prebuild', async t => {
  const data = await fixture(t);
  const hook = createBeforePack({ npm: data.npm, collect: async () => [], logger() {} });
  await assert.rejects(hook(data.context(3)), /dependency collection omitted/);
});

function unsafeTar(entryPath, type = '0') {
  const header = Buffer.alloc(512);
  header.write(entryPath, 0, 100, 'utf8'); header.write('0000644\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii'); header.write('0000000\0', 116, 'ascii');
  header.write('00000000000\0', 124, 'ascii'); header.write('00000000000\0', 136, 'ascii');
  header.fill(32, 148, 156); header.write(type, 156); header.write('ustar\0', 257, 'ascii'); header.write('00', 263, 'ascii');
  if (type === '2') header.write('../outside', 157, 100, 'ascii');
  const checksum = header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0');
  header.write(`${checksum}\0 `, 148, 'ascii');
  return gzipSync(Buffer.concat([header, Buffer.alloc(1024)]));
}

test('archive inspection rejects traversal paths and symlinks before extraction', async t => {
  const data = await fixture(t);
  for (const [name, entryPath, type] of [['traversal', 'package/../escape', '0'], ['link', 'package/link', '2']]) {
    const archive = path.join(data.root, `${name}.tgz`);
    await writeFile(archive, unsafeTar(entryPath, type));
    await assert.rejects(validateArchivePaths(archive), /Unsafe path or link/);
  }
});
