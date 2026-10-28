import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export const MILESTONE_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const PROJECT_TASK_STATUSES = ['backlog', 'doing', 'review', 'done'] as const;
export const LOG_TYPES = ['decision', 'issue', 'test'] as const;

export interface ProjectDoc {
  slug: string;
  name: string;
  goal: string;
  repoUrl: string;
  description: string;
  architecture: string;
  deployment: string;
  demo: string;
  status: 'planned' | 'active' | 'paused' | 'done';
  techStack: string[];
  securityNotes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MilestoneDoc {
  slug: string;
  projectSlug: string;
  order: number;
  title: string;
  description: string;
  status: (typeof MILESTONE_STATUSES)[number];
  acceptance: string[];
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectTaskDoc {
  slug: string;
  projectSlug: string;
  milestoneSlug: string;
  order: number;
  title: string;
  description: string;
  status: (typeof PROJECT_TASK_STATUSES)[number];
  priority: 'high' | 'normal' | 'low';
  estimateHours: number;
  tags: string[];
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectLogDoc {
  projectSlug: string;
  type: (typeof LOG_TYPES)[number];
  title: string;
  content: string;
  status: 'open' | 'resolved';
  createdAt?: Date;
  updatedAt?: Date;
}

const projectSchema = new Schema<ProjectDoc>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    goal: { type: String, required: true },
    repoUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    architecture: { type: String, default: '' },
    deployment: { type: String, default: '' },
    demo: { type: String, default: '' },
    status: { type: String, enum: ['planned', 'active', 'paused', 'done'], default: 'active' },
    techStack: { type: [String], default: [] },
    securityNotes: { type: String, default: '' },
  },
  options
);

const milestoneSchema = new Schema<MilestoneDoc>(
  {
    slug: { type: String, required: true, unique: true },
    projectSlug: { type: String, required: true, index: true },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: MILESTONE_STATUSES, default: 'todo' },
    acceptance: { type: [String], default: [] },
    completedAt: { type: Date, default: null },
  },
  options
);

const projectTaskSchema = new Schema<ProjectTaskDoc>(
  {
    slug: { type: String, required: true, unique: true },
    projectSlug: { type: String, required: true, index: true },
    milestoneSlug: { type: String, default: '', index: true },
    order: { type: Number, default: 0 },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: PROJECT_TASK_STATUSES, default: 'backlog', index: true },
    priority: { type: String, enum: ['high', 'normal', 'low'], default: 'normal' },
    estimateHours: { type: Number, default: 2 },
    tags: { type: [String], default: [] },
    completedAt: { type: Date, default: null },
  },
  options
);

const projectLogSchema = new Schema<ProjectLogDoc>(
  {
    projectSlug: { type: String, required: true, index: true },
    type: { type: String, enum: LOG_TYPES, required: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  },
  { timestamps: true, versionKey: false }
);

export const Project = (models.Project as mongoose.Model<ProjectDoc> | undefined) ?? model<ProjectDoc>('Project', projectSchema);
export const Milestone =
  (models.Milestone as mongoose.Model<MilestoneDoc> | undefined) ?? model<MilestoneDoc>('Milestone', milestoneSchema);
export const ProjectTask =
  (models.ProjectTask as mongoose.Model<ProjectTaskDoc> | undefined) ?? model<ProjectTaskDoc>('ProjectTask', projectTaskSchema);
export const ProjectLog = (models.ProjectLog as mongoose.Model<ProjectLogDoc> | undefined) ?? model<ProjectLogDoc>('ProjectLog', projectLogSchema);

export type ProjectModel = mongoose.Model<ProjectDoc>;
export type MilestoneModel = mongoose.Model<MilestoneDoc>;
export type ProjectTaskModel = mongoose.Model<ProjectTaskDoc>;
export type ProjectLogModel = mongoose.Model<ProjectLogDoc>;
