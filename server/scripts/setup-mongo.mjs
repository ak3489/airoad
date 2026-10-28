#!/usr/bin/env node
/**
 * Downloads an official MongoDB Community binary for the local dev database.
 * Production deployments should use MONGODB_URI instead of this embedded instance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const envPath of [path.join(serverRoot, '.env'), path.join(serverRoot, '..', '.env')]) {
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const version = process.env.MONGO_VERSION || '7.0.14';
const cacheDir = path.join(serverRoot, '.cache');
const binDir = path.join(cacheDir, 'mongodb', 'bin');
const exeName = process.platform === 'win32' ? 'mongod.exe' : 'mongod';
const target = process.env.MONGOD_BINARY || path.join(binDir, exeName);

if (fs.existsSync(target)) {
  const size = (fs.statSync(target).size / 1024 / 1024).toFixed(0);
  console.log(`[mongo] binary already present: ${target} (${size} MB)`);
  process.exit(0);
}

if (process.env.MONGOD_BINARY) {
  console.error(`[mongo] MONGOD_BINARY is set but not found: ${process.env.MONGOD_BINARY}`);
  process.exit(1);
}

if (process.platform !== 'win32') {
  console.error(
    `[mongo] Automatic download is implemented for Windows only.\n` +
      `Set MONGOD_BINARY=/path/to/mongod, or set MONGODB_URI to an existing MongoDB.`
  );
  process.exit(1);
}

const url = `https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-${version}.zip`;
const zipPath = path.join(cacheDir, `mongodb-${version}.zip`);
const extractDir = path.join(cacheDir, `mongodb-${version}`);
const proxy =
  process.env.MONGO_DOWNLOAD_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || '';

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(extractDir, { recursive: true });

if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 100 * 1024 * 1024) {
  console.log(`[mongo] downloading MongoDB ${version} from ${url}`);
  const curlArgs = ['-fL', '--retry', '3', '--retry-delay', '2', '-C', '-', '-o', zipPath];
  if (proxy) curlArgs.push('-x', proxy);
  curlArgs.push(url);

  const curl = spawnSync('curl', curlArgs, { stdio: 'inherit' });
  if (curl.status !== 0) {
    console.error('[mongo] download failed. Set MONGO_DOWNLOAD_PROXY if a proxy is required.');
    process.exit(1);
  }
} else {
  console.log(`[mongo] using existing archive ${zipPath}`);
}

console.log('[mongo] extracting archive');
const tarBinary = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
const untar = spawnSync(
  tarBinary,
  ['-xf', path.basename(zipPath), '-C', path.basename(extractDir)],
  { stdio: 'inherit', cwd: cacheDir }
);
if (untar.status !== 0) {
  console.error('[mongo] extraction failed (need bsdtar/tar with zip support).');
  process.exit(1);
}

function findMongod(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMongod(full);
      if (found) return found;
    } else if (entry.name.toLowerCase() === 'mongod.exe') {
      return full;
    }
  }
  return null;
}

const found = findMongod(extractDir);
if (!found) {
  console.error('[mongo] mongod.exe not found in the extracted archive.');
  process.exit(1);
}

fs.mkdirSync(binDir, { recursive: true });
fs.copyFileSync(found, target);
fs.rmSync(extractDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
console.log(`[mongo] installed: ${target}`);
console.log('[mongo] local data directory will be created at server/.data/mongodb');
