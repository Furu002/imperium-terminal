/* Ensure the target PTY prebuild exists before electron-builder collects deps.
 * npm installs optional binaries for the host, which is insufficient when a
 * macOS build targets both x64 and arm64. No package scripts or rebuilds run.
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const tar = require('tar');

const execute = promisify(execFile);
const VERSION = '1.2.0-beta.18';
const ARCH_NAMES = { 1: 'x64', 3: 'arm64' };
const pending = new Map();

function within(root, candidate) {
  const absolute = path.resolve(candidate);
  const relative = path.relative(root, absolute);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('PTY packaging path must stay inside the application directory.');
  }
  return absolute;
}

async function exists(file) {
  try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function safeDirectory(root, directory) {
  const absolute = within(root, directory);
  let current = root;
  for (const segment of path.relative(root, absolute).split(path.sep)) {
    current = path.join(current, segment);
    try { await fs.mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const entry = await fs.lstat(current);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('PTY packaging refuses symlinked or non-directory paths.');
  }
  return absolute;
}

function targetFor(context) {
  const platform = context.electronPlatformName;
  const arch = typeof context.arch === 'string' ? context.arch : ARCH_NAMES[context.arch];
  if (!['win32', 'darwin', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch)) {
    throw new Error(`Unsupported PTY packaging target: ${platform}/${arch || context.arch}`);
  }
  return { platform, arch, name: `@lydell/node-pty-${platform}-${arch}`, directoryName: `node-pty-${platform}-${arch}` };
}

async function requireRegularFile(root, file) {
  within(root, file);
  let current = root;
  const segments = path.relative(root, file).split(path.sep);
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error('PTY package contains a symlink or invalid file.');
    }
  }
  return fs.readFile(file);
}

function binaryArchitecture(buffer, platform) {
  if (platform === 'win32') {
    if (buffer.length < 64 || buffer.toString('ascii', 0, 2) !== 'MZ') return null;
    const offset = buffer.readUInt32LE(60);
    if (offset + 6 > buffer.length || buffer.toString('ascii', offset, offset + 4) !== 'PE\u0000\u0000') return null;
    return { 0x8664: 'x64', 0xaa64: 'arm64' }[buffer.readUInt16LE(offset + 4)] || null;
  }
  if (platform === 'linux') {
    if (buffer.length < 20 || buffer.subarray(0, 4).toString('hex') !== '7f454c46' || buffer[5] !== 1) return null;
    return { 62: 'x64', 183: 'arm64' }[buffer.readUInt16LE(18)] || null;
  }
  if (buffer.length < 8 || buffer.readUInt32LE(0) !== 0xfeedfacf) return null;
  return { 0x01000007: 'x64', 0x0100000c: 'arm64' }[buffer.readUInt32LE(4)] || null;
}

async function validatePackage(directory, target) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PTY package directory must not be a symlink.');
  const manifest = JSON.parse(await requireRegularFile(directory, path.join(directory, 'package.json')));
  if (manifest.name !== target.name || manifest.version !== VERSION || !manifest.os?.includes(target.platform) || !manifest.cpu?.includes(target.arch)) {
    throw new Error(`PTY package metadata does not match ${target.name}@${VERSION}.`);
  }
  await requireRegularFile(directory, path.join(directory, 'lib', 'index.js'));
  const nativeName = target.platform === 'win32' ? 'conpty.node' : 'pty.node';
  const binary = await requireRegularFile(directory, path.join(directory, 'prebuilds', `${target.platform}-${target.arch}`, nativeName));
  if (binaryArchitecture(binary, target.platform) !== target.arch) throw new Error('PTY native binary architecture does not match the build target.');
  // N-API prebuilds can run across Node/Electron ABIs without node-gyp rebuilds.
  if (!binary.includes(Buffer.from('napi_register_module_v1'))) throw new Error('PTY prebuild is not a verified N-API module.');
  return manifest;
}

async function verifyArchive(archive, integrity) {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity || '');
  if (!match) throw new Error('A locked SHA-512 integrity value is required for the PTY prebuild.');
  const expected = Buffer.from(match[1], 'base64');
  const digest = crypto.createHash('sha512').update(await fs.readFile(archive)).digest();
  if (expected.length !== digest.length || !crypto.timingSafeEqual(expected, digest)) throw new Error('PTY archive does not match package-lock.json integrity.');
}

async function validateArchivePaths(archive) {
  let totalBytes = 0;
  let entries = 0;
  let violation;
  await tar.t({
    file: archive,
    strict: true,
    onReadEntry(entry) {
      const segments = entry.path.split('/');
      const unsafe = entry.path.length > 2048 || entry.path.includes('\\') || segments[0] !== 'package' || segments.some(part => part === '..' || part === '.' || part.includes(':'));
      if (unsafe || !['File', 'OldFile', 'Directory'].includes(entry.type)) violation ||= new Error('Unsafe path or link in PTY archive.');
      entries++;
      totalBytes += entry.size || 0;
      if (entries > 10000 || totalBytes > 128 * 1024 * 1024) violation ||= new Error('PTY archive exceeds packaging limits.');
      entry.resume();
    },
  });
  if (violation) throw violation;
}

async function npmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    '/usr/share/nodejs/npm/bin/npm-cli.js',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (path.basename(candidate) === 'npm-cli.js' && await exists(candidate)) return path.resolve(candidate);
  }
  throw new Error('Cannot find npm-cli.js. Run packaging through npm run build:win, build:mac, or build:linux.');
}

async function runNpm(args, root) {
  try {
    const result = await execute(process.execPath, [await npmCliPath(), ...args], { cwd: root, shell: false, windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
    return result.stdout;
  } catch {
    throw new Error('Failed to download the locked PTY prebuild from the official npm registry.');
  }
}

async function collectProductionDependencies(root, packageName) {
  const { NpmNodeModulesCollector } = require('app-builder-lib/out/node-module-collector/npmNodeModulesCollector');
  const { TmpDir } = require('builder-util');
  const temporary = new TmpDir('imperium-pty-collector');
  try { return (await new NpmNodeModulesCollector(root, temporary).getNodeModules({ packageName })).nodeModules; }
  finally { await temporary.cleanup(); }
}

function findDependency(nodes, name) {
  for (const node of nodes || []) {
    if (node.name === name) return node;
    const nested = findDependency(node.dependencies, name);
    if (nested) return nested;
  }
  return null;
}

function createBeforePack({ npm = runNpm, collect = collectProductionDependencies, logger = console.log } = {}) {
  return async function beforePack(context) {
    const target = targetFor(context);
    const configuredRoot = context.packager?.info?.appDir || context.packager?.info?.projectDir;
    if (!configuredRoot || !path.isAbsolute(configuredRoot)) throw new Error('An absolute electron-builder application directory is required.');
    const root = await fs.realpath(configuredRoot);
    const key = `${root}\0${target.name}`;
    if (pending.has(key)) return pending.get(key);
    const work = (async () => {
      const appManifest = JSON.parse(await requireRegularFile(root, path.join(root, 'package.json')));
      const lock = JSON.parse(await requireRegularFile(root, path.join(root, 'package-lock.json')));
      const wrapperDirectory = within(root, path.join(root, 'node_modules', '@lydell', 'node-pty'));
      const wrapper = JSON.parse(await requireRegularFile(root, path.join(wrapperDirectory, 'package.json')));
      if (wrapper.name !== '@lydell/node-pty' || wrapper.version !== VERSION || wrapper.optionalDependencies?.[target.name] !== VERSION) {
        throw new Error(`Expected @lydell/node-pty@${VERSION} with the declared target optional dependency.`);
      }
      const lockEntry = lock.packages?.[`node_modules/${target.name}`];
      const registryURL = `https://registry.npmjs.org/${target.name}/-/${target.directoryName}-${VERSION}.tgz`;
      if (lockEntry?.version !== VERSION || lockEntry.resolved !== registryURL || !lockEntry.integrity) throw new Error('The target PTY package must be locked to its official npm registry URL.');
      const scope = await safeDirectory(root, path.join(root, 'node_modules', '@lydell'));
      const destination = within(root, path.join(scope, target.directoryName));
      if (await exists(destination)) await validatePackage(destination, target);
      else {
        const cacheRoot = await safeDirectory(root, path.join(root, '.packaging-cache'));
        const cache = await safeDirectory(root, path.join(cacheRoot, `${target.platform}-${target.arch}-${VERSION}`));
        const filename = `lydell-${target.directoryName}-${VERSION}.tgz`;
        const archive = within(root, path.join(cache, filename));
        if (!await exists(archive)) {
          const result = JSON.parse(await npm(['pack', registryURL, '--ignore-scripts', '--json', '--pack-destination', cache, '--registry=https://registry.npmjs.org/', '--cache', path.join(cacheRoot, 'npm-cache'), '--loglevel=error'], root));
          if (!Array.isArray(result) || result.length !== 1 || result[0].name !== target.name || result[0].version !== VERSION || result[0].filename !== filename) throw new Error('npm pack returned unexpected PTY package metadata.');
        }
        const archiveStat = await fs.lstat(archive);
        if (!archiveStat.isFile() || archiveStat.isSymbolicLink()) throw new Error('PTY archive must be a regular file inside the packaging cache.');
        await verifyArchive(archive, lockEntry.integrity);
        await validateArchivePaths(archive);
        // Stage inside the verified project cache, then install by one atomic
        // rename. Existing packages are never deleted or overwritten.
        const stage = await fs.mkdtemp(path.join(cache, 'extract-'));
        within(root, stage);
        await tar.x({ file: archive, cwd: stage, strip: 1, strict: true, preservePaths: false, preserveOwner: false });
        await validatePackage(stage, target);
        try { await fs.rename(stage, destination); }
        catch (error) {
          if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code) || !await exists(destination)) throw error;
          await validatePackage(destination, target);
        }
        logger(`[IMPERIUM] Prepared ${target.name}@${VERSION} for ${target.platform}/${target.arch}.`);
      }
      const collected = await collect(root, appManifest.name);
      const dependency = findDependency(collected, target.name);
      if (!dependency || dependency.version !== VERSION || await fs.realpath(dependency.dir) !== await fs.realpath(destination)) {
        throw new Error(`electron-builder production dependency collection omitted ${target.name}. Refusing an incomplete app.`);
      }
      logger(`[IMPERIUM] Verified production dependency ${target.name} (N-API).`);
    })();
    pending.set(key, work);
    try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
  };
}

module.exports = createBeforePack();
module.exports.createBeforePack = createBeforePack;
module.exports.targetFor = targetFor;
module.exports.validateArchivePaths = validateArchivePaths;
module.exports.binaryArchitecture = binaryArchitecture;
