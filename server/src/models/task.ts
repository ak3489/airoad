import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export const TASK_STATUSES = ['not_started', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['high', 'normal', 'low'] as const;

export interface StepPitfall {
  problem: string;
  solution: string;
}

export interface StepReferenceFile {
  filePath?: string;
  language: string;
  content: string;
}

export interface StepReference {
  approach: string;
  commands?: string[];
  files?: StepReferenceFile[];
  verify?: string[];
}

export interface TaskStep {
  key: string;
  order: number;
  title: string;
  goal: string;
  principle?: string;
  setup?: string;
  instructions: string;
  code?: { language: string; filePath?: string; content: string };
  commands?: string[];
  expectedOutput?: string;
  pitfalls?: StepPitfall[];
  reference?: StepReference | null;
  acceptance: string[];
  status: 'todo' | 'done';
  resultLog?: string;
  errorLog?: string;
  notes?: string;
  completedAt?: Date | null;
}

export interface StatusEvent {
  status: TaskStatus;
  at: Date;
  note?: string;
}

export interface LearningTaskDoc {
  profileId: string;
  slug: string;
  phaseSlug: string;
  week: number;
  day: number;
  order: number;
  title: string;
  objective: string;
  problem: string;
  estimatedMinutes: number;
  status: TaskStatus;
  priority: (typeof PRIORITIES)[number];
  dueDate: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  notes: string;
  blockers: string;
  nextStep: string;
  tags: string[];
  acceptance: string[];
  resourceSlugs: string[];
  prerequisiteSlugs: string[];
  optional: boolean;
  steps: TaskStep[];
  statusHistory: StatusEvent[];
  createdAt?: Date;
  updatedAt?: Date;
}

const pitfallSchema = new Schema<StepPitfall>(
  { problem: { type: String, required: true }, solution: { type: String, required: true } },
  { _id: false }
);

const referenceFileSchema = new Schema<StepReferenceFile>(
  {
    filePath: { type: String, default: '' },
    language: { type: String, default: 'bash' },
    content: { type: String, required: true },
  },
  { _id: false }
);

const referenceSchema = new Schema<StepReference>(
  {
    approach: { type: String, required: true },
    commands: { type: [String], default: [] },
    files: { type: [referenceFileSchema], default: [] },
    verify: { type: [String], default: [] },
  },
  { _id: false }
);

const stepSchema = new Schema<TaskStep>(
  {
    key: { type: String, required: true },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    goal: { type: String, required: true },
    principle: { type: String, default: '' },
    setup: { type: String, default: '' },
    instructions: { type: String, required: true },
    code: {
      type: new Schema(
        {
          language: { type: String, default: 'bash' },
          filePath: { type: String, default: '' },
          content: { type: String, required: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    commands: { type: [String], default: [] },
    expectedOutput: { type: String, default: '' },
    pitfalls: { type: [pitfallSchema], default: [] },
    reference: { type: referenceSchema, default: undefined },
    acceptance: { type: [String], default: [] },
    status: { type: String, enum: ['todo', 'done'], default: 'todo' },
    resultLog: { type: String, default: '' },
    errorLog: { type: String, default: '' },
    notes: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const statusEventSchema = new Schema<StatusEvent>(
  {
    status: { type: String, enum: TASK_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const taskSchema = new Schema<LearningTaskDoc>(
  {
    profileId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    phaseSlug: { type: String, required: true, index: true },
    week: { type: Number, required: true, index: true },
    day: { type: Number, default: 1 },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    objective: { type: String, required: true },
    problem: { type: String, default: '' },
    estimatedMinutes: { type: Number, default: 90 },
    status: { type: String, enum: TASK_STATUSES, default: 'not_started', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'normal' },
    dueDate: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    blockers: { type: String, default: '' },
    nextStep: { type: String, default: '' },
    tags: { type: [String], default: [] },
    acceptance: { type: [String], default: [] },
    resourceSlugs: { type: [String], default: [] },
    prerequisiteSlugs: { type: [String], default: [] },
    optional: { type: Boolean, default: false },
    steps: { type: [stepSchema], default: [] },
    statusHistory: { type: [statusEventSchema], default: [] },
  },
  options
);

taskSchema.index({ profileId: 1, slug: 1 }, { unique: true });
taskSchema.index({ profileId: 1, phaseSlug: 1, week: 1, order: 1 });
taskSchema.index({ title: 'text', objective: 'text', tags: 'text' });

export const LearningTask =
  (models.LearningTask as mongoose.Model<LearningTaskDoc> | undefined) ?? model<LearningTaskDoc>('LearningTask', taskSchema);

export type LearningTaskModel = mongoose.Model<LearningTaskDoc>;
