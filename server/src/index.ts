import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './db/mongo';
import { SEED_CONTENT_VERSION, seedDatabase } from './db/seed/run';
import { LearningPlan } from './models';

async function main() {
  await connectDatabase();

  const plan = await LearningPlan.findOne({ slug: 'main-plan' }).select({ contentVersion: 1 }).lean();
  if (!plan) {
    const result = await seedDatabase();
    console.log('[seed] initial content created', result);
  } else if ((plan.contentVersion ?? 0) < SEED_CONTENT_VERSION) {
    const result = await seedDatabase();
    console.log('[seed] content updated', { ...result, version: SEED_CONTENT_VERSION });
  }

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
