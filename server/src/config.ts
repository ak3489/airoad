import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const serverRoot = path.resolve(__dirname, '..');

for (const envPath of [path.join(serverRoot, '.env'), path.join(serverRoot, '..', '.env')]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false, quiet: true });
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  serverRoot,
  host: process.env.HOST || '127.0.0.1',
  port: num(process.env.PORT, 8787),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'airoad',
  mongoPort: num(process.env.MONGO_PORT, 27017),
  mongodBinary:
    process.env.MONGOD_BINARY || path.join(serverRoot, '.cache', 'mongodb', 'bin', 'mongod.exe'),
  dataDir: path.join(serverRoot, '.data'),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
