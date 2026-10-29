import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export const PLAN_STATUSES = ['active', 'paused', 'completed'] as const;

export interface LearningPlanDoc {
  profileId: string;
  slug: string;
  name: string;
  roleTarget: string;
  summary: string;
  startDate: Date;
  totalWeeks: number;
  dailyMinutes: number;
  status: (typeof PLAN_STATUSES)[number];
  contentVersion: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const planSchema = new Schema<LearningPlanDoc>(
  {
    profileId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    roleTarget: { type: String, required: true },
    summary: { type: String, default: '' },
    startDate: { type: Date, required: true },
    totalWeeks: { type: Number, default: 12 },
    dailyMinutes: { type: Number, default: 90 },
    status: { type: String, enum: PLAN_STATUSES, default: 'active' },
    contentVersion: { type: Number, default: 0 },
  },
  options
);

export interface LearningPhaseDoc {
  profileId: string;
  slug: string;
  planSlug: string;
  order: number;
  title: string;
  shortTitle: string;
  weeks: string;
  goal: string;
  why: string;
  knowledge: string[];
  prerequisites: string[];
  estimatedHours: number;
  deliverable: string;
  acceptance: string[];
  unlockCondition: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const phaseSchema = new Schema<LearningPhaseDoc>(
  {
    profileId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    planSlug: { type: String, required: true, index: true },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    shortTitle: { type: String, required: true },
    weeks: { type: String, required: true },
    goal: { type: String, required: true },
    why: { type: String, default: '' },
    knowledge: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    estimatedHours: { type: Number, default: 0 },
    deliverable: { type: String, default: '' },
    acceptance: { type: [String], default: [] },
    unlockCondition: { type: String, default: '' },
  },
  options
);

planSchema.index({ profileId: 1, slug: 1 }, { unique: true });
phaseSchema.index({ profileId: 1, slug: 1 }, { unique: true });
phaseSchema.index({ profileId: 1, planSlug: 1, order: 1 });

export const LearningPlan =
  (models.LearningPlan as mongoose.Model<LearningPlanDoc> | undefined) ?? model<LearningPlanDoc>('LearningPlan', planSchema);
export const LearningPhase =
  (models.LearningPhase as mongoose.Model<LearningPhaseDoc> | undefined) ?? model<LearningPhaseDoc>('LearningPhase', phaseSchema);

export type LearningPlanModel = mongoose.Model<LearningPlanDoc>;
export type LearningPhaseModel = mongoose.Model<LearningPhaseDoc>;
