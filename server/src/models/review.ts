import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export const REVIEW_STATUSES = ['draft', 'final'] as const;

export interface WeeklyReviewDoc {
  profileId: string;
  planSlug: string;
  week: number;
  status: (typeof REVIEW_STATUSES)[number];
  plannedMinutes: number;
  actualMinutes: number;
  completedTaskSlugs: string[];
  newSkills: string;
  shipped: string;
  testResults: string;
  challenges: string;
  unfinished: string;
  nextWeekPlan: string;
  metricsSnapshot: Record<string, number>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EvaluationDoc {
  profileId: string;
  scope: 'phase' | 'project' | 'task' | 'week';
  targetSlug: string;
  title: string;
  criteria: string;
  evidence: string;
  result: 'pass' | 'fail' | 'partial';
  score: number;
  notes: string;
  evaluatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const weeklyReviewSchema = new Schema<WeeklyReviewDoc>(
  {
    profileId: { type: String, required: true, index: true },
    planSlug: { type: String, required: true },
    week: { type: Number, required: true },
    status: { type: String, enum: REVIEW_STATUSES, default: 'draft' },
    plannedMinutes: { type: Number, default: 0 },
    actualMinutes: { type: Number, default: 0 },
    completedTaskSlugs: { type: [String], default: [] },
    newSkills: { type: String, default: '' },
    shipped: { type: String, default: '' },
    testResults: { type: String, default: '' },
    challenges: { type: String, default: '' },
    unfinished: { type: String, default: '' },
    nextWeekPlan: { type: String, default: '' },
    metricsSnapshot: { type: Object, default: {} },
  },
  options
);

weeklyReviewSchema.index({ profileId: 1, planSlug: 1, week: 1 }, { unique: true });

const evaluationSchema = new Schema<EvaluationDoc>(
  {
    profileId: { type: String, required: true, index: true },
    scope: { type: String, enum: ['phase', 'project', 'task', 'week'], required: true },
    targetSlug: { type: String, required: true, index: true },
    title: { type: String, required: true },
    criteria: { type: String, default: '' },
    evidence: { type: String, default: '' },
    result: { type: String, enum: ['pass', 'fail', 'partial'], required: true },
    score: { type: Number, min: 0, max: 100, default: 0 },
    notes: { type: String, default: '' },
    evaluatedAt: { type: Date, default: Date.now },
  },
  options
);

evaluationSchema.index({ profileId: 1, evaluatedAt: -1 });

export const WeeklyReview =
  (models.WeeklyReview as mongoose.Model<WeeklyReviewDoc> | undefined) ?? model<WeeklyReviewDoc>('WeeklyReview', weeklyReviewSchema);
export const Evaluation =
  (models.Evaluation as mongoose.Model<EvaluationDoc> | undefined) ?? model<EvaluationDoc>('Evaluation', evaluationSchema);

export type WeeklyReviewModel = mongoose.Model<WeeklyReviewDoc>;
export type EvaluationModel = mongoose.Model<EvaluationDoc>;
