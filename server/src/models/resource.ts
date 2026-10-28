import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export const RESOURCE_KINDS = [
  'doc',
  'tutorial',
  'video',
  'repo',
  'article',
  'tool',
] as const;
export const RESOURCE_STATUSES = ['unread', 'reading', 'done', 'archived'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export interface ResourceDoc {
  slug: string;
  title: string;
  url: string;
  kind: (typeof RESOURCE_KINDS)[number];
  topic: string;
  difficulty: (typeof DIFFICULTIES)[number];
  phaseSlug: string;
  importance: number;
  order: number;
  keyPoints: string[];
  status: (typeof RESOURCE_STATUSES)[number];
  notes: string;
  tags: string[];
  favorite: boolean;
  official: boolean;
  lastVerifiedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const resourceSchema = new Schema<ResourceDoc>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    kind: { type: String, enum: RESOURCE_KINDS, required: true },
    topic: { type: String, default: '' },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'intermediate' },
    phaseSlug: { type: String, default: '', index: true },
    importance: { type: Number, min: 1, max: 5, default: 3 },
    order: { type: Number, default: 0 },
    keyPoints: { type: [String], default: [] },
    status: { type: String, enum: RESOURCE_STATUSES, default: 'unread', index: true },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    favorite: { type: Boolean, default: false },
    official: { type: Boolean, default: false },
    lastVerifiedAt: { type: Date, default: null },
  },
  options
);

resourceSchema.index({ title: 'text', topic: 'text', keyPoints: 'text', tags: 'text' });

export interface LearningRecordDoc {
  taskSlug: string;
  stepKey: string;
  date: string;
  minutes: number;
  summary: string;
  kind: 'study' | 'lab' | 'project' | 'review' | 'interview';
  createdAt?: Date;
}

const recordSchema = new Schema<LearningRecordDoc>(
  {
    taskSlug: { type: String, default: '', index: true },
    stepKey: { type: String, default: '' },
    date: { type: String, required: true, index: true },
    minutes: { type: Number, required: true, min: 1, max: 1440 },
    summary: { type: String, default: '' },
    kind: {
      type: String,
      enum: ['study', 'lab', 'project', 'review', 'interview'],
      default: 'study',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export const Resource = (models.Resource as mongoose.Model<ResourceDoc> | undefined) ?? model<ResourceDoc>('Resource', resourceSchema);
export const LearningRecord =
  (models.LearningRecord as mongoose.Model<LearningRecordDoc> | undefined) ?? model<LearningRecordDoc>('LearningRecord', recordSchema);

export type ResourceModel = mongoose.Model<ResourceDoc>;
export type LearningRecordModel = mongoose.Model<LearningRecordDoc>;
