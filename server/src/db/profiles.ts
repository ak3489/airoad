import type mongoose from 'mongoose';
import {
  AIConversation,
  Evaluation,
  LearningPhase,
  LearningPlan,
  LearningRecord,
  LearningTask,
  LEGACY_PROFILE_ID,
  Note,
  Profile,
  Project,
  Milestone,
  ProjectLog,
  ProjectTask,
  Resource,
  WeeklyReview,
} from '../models';
import { SEED_CONTENT_VERSION, seedProfile } from './seed/run';

const PROFILE_MODELS: mongoose.Model<any>[] = [
  LearningPlan,
  LearningPhase,
  LearningTask,
  Resource,
  LearningRecord,
  Note,
  Project,
  Milestone,
  ProjectTask,
  ProjectLog,
  WeeklyReview,
  Evaluation,
  AIConversation,
];

async function migrateLegacyData() {
  let moved = 0;
  for (const model of PROFILE_MODELS) {
    const result = await model.updateMany(
      { profileId: { $exists: false } },
      { $set: { profileId: LEGACY_PROFILE_ID } }
    );
    moved += result.modifiedCount;
  }

  const legacyDocs = await LearningTask.countDocuments({ profileId: LEGACY_PROFILE_ID });
  const legacyPhases = await LearningPhase.countDocuments({ profileId: LEGACY_PROFILE_ID });
  if (legacyDocs > 0 || legacyPhases > 0) {
    await Profile.updateOne(
      { _id: LEGACY_PROFILE_ID },
      {
        $setOnInsert: {
          contentVersion: 0,
          legacy: true,
          claimed: false,
          claimedBy: '',
          lastSeenAt: null,
        },
      },
      { upsert: true }
    );
  }

  if (moved > 0) console.log('[migrate] legacy data assigned to', LEGACY_PROFILE_ID, { documents: moved });
}

async function syncProfileIndexes() {
  for (const model of PROFILE_MODELS) {
    await model.syncIndexes();
  }
}

async function refreshProfiles() {
  const profiles = await Profile.find({ contentVersion: { $lt: SEED_CONTENT_VERSION } })
    .select({ _id: 1 })
    .lean();
  for (const profile of profiles) {
    const result = await seedProfile(profile._id);
    console.log('[seed] content updated', {
      ...result,
      profileId: profile._id,
      version: SEED_CONTENT_VERSION,
    });
  }
}

export async function prepareProfiles() {
  await migrateLegacyData();
  await syncProfileIndexes();
  await refreshProfiles();
}
