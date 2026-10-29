import { afterAll, beforeAll } from 'vitest';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27019/airoad_test';
process.env.MONGODB_DB = 'airoad_test';
process.env.NODE_ENV = 'test';

const { connectDatabase, disconnectDatabase } = await import('../src/db/mongo');
const { seedProfile } = await import('../src/db/seed/run');

export const TEST_PROFILE_ID = 'test-profile-0001';

beforeAll(async () => {
  const mongoose = (await import('mongoose')).default;
  await connectDatabase();
  await mongoose.connection.dropDatabase();
  await seedProfile(TEST_PROFILE_ID);
});

afterAll(async () => {
  await disconnectDatabase();
});
