import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import mongoose from 'mongoose';
import { config } from '../config';

let mongod: ChildProcess | null = null;
let cleanupRegistered = false;

function portOpen(port: number, host = '127.0.0.1', timeout = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
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

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const stop = () => {
    if (mongod && !mongod.killed) {
      mongod.kill();
      mongod = null;
    }
  };
  process.once('exit', stop);
  process.once('SIGINT', () => {
    stop();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    stop();
    process.exit(0);
  });
}

export async function startLocalMongo(): Promise<string> {
  if (config.mongoUri) return config.mongoUri;

  const uri = `mongodb://127.0.0.1:${config.mongoPort}/${config.mongoDb}`;
  if (await portOpen(config.mongoPort)) {
    console.log(`[mongo] using existing instance on 127.0.0.1:${config.mongoPort}`);
    return uri;
  }

  if (!fs.existsSync(config.mongodBinary)) {
    throw new Error(
      `Local mongod binary not found at ${config.mongodBinary}. ` +
        'Run "npm run mongo:setup", set MONGOD_BINARY, or configure MONGODB_URI.'
    );
  }

  const dbPath = path.join(config.dataDir, 'mongodb');
  fs.mkdirSync(dbPath, { recursive: true });
  const logPath = path.join(config.dataDir, 'mongod.log');
  const log = fs.openSync(logPath, 'a');

  console.log(`[mongo] starting embedded mongod (data: ${dbPath})`);
  mongod = spawn(
    config.mongodBinary,
    [
      '--dbpath',
      dbPath,
      '--port',
      String(config.mongoPort),
      '--bind_ip',
      '127.0.0.1',
      '--quiet',
    ],
    { stdio: ['ignore', log, log], windowsHide: true }
  );
  mongod.on('error', (error) => console.error('[mongo] failed to start:', error.message));
  registerCleanup();

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await portOpen(config.mongoPort)) return uri;
    if (mongod.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`mongod did not become ready. See ${logPath}`);
}

export async function connectDatabase(uri?: string): Promise<string> {
  const target = uri || (await startLocalMongo());
  await mongoose.connect(target, {
    dbName: config.mongoDb,
    serverSelectionTimeoutMS: 10_000,
  });
  console.log(`[mongo] connected (${config.mongoDb})`);
  return target;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongod && !mongod.killed) {
    mongod.kill();
    mongod = null;
  }
}
