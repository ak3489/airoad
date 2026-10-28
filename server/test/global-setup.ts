import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const port = 27019;
let mongod: ChildProcess | null = null;
let dbPath = '';

function portOpen(target: number, timeout = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port: target, host: '127.0.0.1' });
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export async function setup() {
  const binary =
    process.env.MONGOD_BINARY ||
    path.join(process.cwd(), '.cache', 'mongodb', 'bin', 'mongod.exe');
  if (!fs.existsSync(binary)) {
    throw new Error(`mongod binary not found at ${binary}; run npm run mongo:setup`);
  }

  dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'airoad-test-mongo-'));
  mongod = spawn(
    binary,
    ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet'],
    { stdio: 'ignore', windowsHide: true }
  );

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return;
    if (mongod.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('test mongod did not start');
}

export async function teardown() {
  if (mongod && !mongod.killed) {
    mongod.kill();
    mongod = null;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (dbPath) {
    fs.rmSync(dbPath, { recursive: true, force: true });
    dbPath = '';
  }
}
