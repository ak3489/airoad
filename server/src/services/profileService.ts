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
import { SEED_CONTENT_VERSION, seedProfile } from '../db/seed/run';
import { HttpError, notFound } from '../lib/http';
import { generateProfileCode, isValidProfileCode, normalizeProfileCode } from '../lib/profile';

const MAX_PROFILES = 100;

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

function publicProfile(profile: {
  _id: string;
  contentVersion: number;
  legacy: boolean;
  createdAt?: Date;
  lastSeenAt: Date | null;
}) {
  return {
    profileId: profile._id,
    contentVersion: profile.contentVersion,
    legacy: profile.legacy,
    createdAt: profile.createdAt?.toISOString() ?? null,
    lastSeenAt: profile.lastSeenAt?.toISOString() ?? null,
  };
}

async function transferLegacyData(profileId: string) {
  for (const model of PROFILE_MODELS) {
    await model.updateMany({ profileId: LEGACY_PROFILE_ID }, { $set: { profileId } });
  }
}

export async function createProfile() {
  const count = await Profile.countDocuments();
  if (count >= MAX_PROFILES) {
    throw new HttpError(429, '档案数量已达上限，请联系维护者清理不再使用的档案');
  }

  const profileId = generateProfileCode();
  await Profile.create({
    _id: profileId,
    contentVersion: 0,
    legacy: false,
    claimed: true,
    claimedBy: '',
    lastSeenAt: new Date(),
  });

  const legacy = await Profile.findOneAndUpdate(
    { _id: LEGACY_PROFILE_ID, claimed: false },
    { $set: { claimed: true, claimedBy: profileId } },
    { new: true }
  );
  if (legacy) await transferLegacyData(profileId);

  const result = await seedProfile(profileId);
  const profile = await Profile.findById(profileId).lean();
  return {
    ...publicProfile(profile!),
    legacyTransferred: Boolean(legacy),
    seed: result,
  };
}

export async function openProfile(rawCode: string) {
  const code = normalizeProfileCode(rawCode);
  if (!isValidProfileCode(code)) throw new HttpError(400, '档案码格式不正确');
  const profile = await Profile.findById(code);
  if (!profile) notFound('档案不存在，请检查档案码是否完整');

  if ((profile.contentVersion ?? 0) < SEED_CONTENT_VERSION) {
    await seedProfile(code);
  } else {
    profile.lastSeenAt = new Date();
    await profile.save();
  }
  const fresh = await Profile.findById(code).lean();
  return { ...publicProfile(fresh!), legacyTransferred: false };
}

export async function getProfileInfo(profileId: string) {
  const profile = await Profile.findById(profileId).lean();
  if (!profile) notFound('档案不存在');
  await Profile.updateOne({ _id: profileId }, { $set: { lastSeenAt: new Date() } });
  return publicProfile(profile);
}

export async function profileExists(profileId: string) {
  return Boolean(await Profile.exists({ _id: profileId }));
}
