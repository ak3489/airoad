import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './db/mongo';
import { prepareProfiles } from './db/profiles';

async function main() {
  await connectDatabase();
  await prepareProfiles();

  const app = await createApp();
  await app.listen({ port: config.port, host: config.host });

  console.log(`[server] api ready at http://${config.host}:${config.port}/api/health`);

  const shutdown = async () => {
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('[server] failed to start:', error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
