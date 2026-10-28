import { z } from 'zod';
import { TASK_STATUSES } from './models/task';

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD');

export const taskStatusSchema = z.enum(TASK_STATUSES);

export const taskListQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  phase: z.string().optional(),
  week: z.coerce.number().int().min(1).max(52).optional(),
  q: z.string().max(120).optional(),
  tag: z.string().max(40).optional(),
});

export const taskPatchSchema = z.object({
  title: z.string().min(4).max(120).optional(),
  objective: z.string().min(4).max(1000).optional(),
  problem: z.string().max(2000).optional(),
  notes: z.string().max(20000).optional(),
  blockers: z.string().max(5000).optional(),
  nextStep: z.string().max(1000).optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  estimatedMinutes: z.number().int().min(10).max(600).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  week: z.number().int().min(1).max(52).optional(),
  day: z.number().int().min(1).max(7).optional(),
  order: z.number().int().min(1).max(999).optional(),
  tags: z.array(z.string().min(1).max(30)).max(12).optional(),
});

export const transitionSchema = z.object({
  status: taskStatusSchema,
  note: z.string().max(500).optional(),
});

export const stepPatchSchema = z.object({
  status: z.enum(['todo', 'done']).optional(),
  resultLog: z.string().max(20000).optional(),
  errorLog: z.string().max(20000).optional(),
  notes: z.string().max(20000).optional(),
});

export const recordSchema = z.object({
  taskSlug: z.string().max(120).optional(),
  stepKey: z.string().max(120).optional(),
  date: dateKey.optional(),
  minutes: z.number().int().min(1).max(600),
  summary: z.string().max(1000).optional(),
  kind: z.enum(['study', 'lab', 'project', 'review', 'interview']).optional(),
});

export const splitSchema = z.object({
  parts: z
    .array(
      z.object({
        title: z.string().min(4).max(120),
        objective: z.string().min(4).max(1000),
        estimatedMinutes: z.number().int().min(10).max(600).default(45),
      })
    )
    .min(1)
    .max(8),
});

export const createTaskSchema = z.object({
  phaseSlug: z.string().min(1),
  week: z.number().int().min(1).max(52),
  title: z.string().min(4).max(120),
  objective: z.string().min(4).max(1000),
  estimatedMinutes: z.number().int().min(10).max(600).default(60),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(12).optional(),
  acceptance: z.array(z.string().max(500)).max(12).optional(),
});

export const phasePatchSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  goal: z.string().max(2000).optional(),
  order: z.number().int().min(1).max(99).optional(),
});

export const phaseCreateSchema = z.object({
  title: z.string().min(2).max(120),
  shortTitle: z.string().min(1).max(20),
  weeks: z.string().min(1).max(40),
  goal: z.string().min(4).max(2000),
  why: z.string().max(2000).default(''),
  order: z.number().int().min(1).max(99),
});

export const planPatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  roleTarget: z.string().min(2).max(120).optional(),
  startDate: z.string().datetime().optional(),
  totalWeeks: z.number().int().min(4).max(52).optional(),
  dailyMinutes: z.number().int().min(15).max(600).optional(),
});

export const resourceQuerySchema = z.object({
  q: z.string().max(120).optional(),
  phase: z.string().optional(),
  status: z.enum(['unread', 'reading', 'done', 'archived']).optional(),
  kind: z.enum(['doc', 'tutorial', 'video', 'repo', 'article', 'tool']).optional(),
  favorite: z.enum(['true', 'false']).optional(),
  task: z.string().optional(),
});

export const resourceCreateSchema = z.object({
  title: z.string().min(2).max(200),
  url: z.string().url().max(2000),
  kind: z.enum(['doc', 'tutorial', 'video', 'repo', 'article', 'tool']).default('doc'),
  topic: z.string().max(80).default(''),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  phaseSlug: z.string().max(40).default(''),
  importance: z.number().int().min(1).max(5).default(3),
  keyPoints: z.array(z.string().max(200)).max(12).default([]),
  tags: z.array(z.string().max(30)).max(12).default([]),
  official: z.boolean().default(false),
});

export const resourcePatchSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  status: z.enum(['unread', 'reading', 'done', 'archived']).optional(),
  notes: z.string().max(20000).optional(),
  favorite: z.boolean().optional(),
  importance: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().max(30)).max(12).optional(),
});

export const noteQuerySchema = z.object({
  q: z.string().max(120).optional(),
  kind: z.enum(['note', 'issue', 'snippet', 'summary', 'interview']).optional(),
  task: z.string().optional(),
  project: z.string().optional(),
  tag: z.string().optional(),
});

export const noteCreateSchema = z.object({
  title: z.string().min(1).max(160),
  content: z.string().max(50000).default(''),
  kind: z.enum(['note', 'issue', 'snippet', 'summary', 'interview']).default('note'),
  tags: z.array(z.string().max(30)).max(12).default([]),
  phaseSlug: z.string().max(40).default(''),
  taskSlug: z.string().max(120).default(''),
  resourceSlug: z.string().max(120).default(''),
  projectSlug: z.string().max(120).default(''),
  question: z.string().max(2000).default(''),
  referenceAnswer: z.string().max(10000).default(''),
  mastery: z.number().int().min(0).max(5).default(0),
  pinned: z.boolean().default(false),
});

export const notePatchSchema = noteCreateSchema.partial();

export const milestonePatchSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(2000).optional(),
});

export const projectTaskPatchSchema = z.object({
  status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  estimateHours: z.number().min(0.5).max(200).optional(),
});

export const projectPatchSchema = z.object({
  repoUrl: z.string().url().max(2000).or(z.literal('')).optional(),
  description: z.string().max(5000).optional(),
  architecture: z.string().max(30000).optional(),
  deployment: z.string().max(30000).optional(),
  demo: z.string().max(30000).optional(),
  status: z.enum(['planned', 'active', 'paused', 'done']).optional(),
});

export const projectLogCreateSchema = z.object({
  type: z.enum(['decision', 'issue', 'test']),
  title: z.string().min(2).max(200),
  content: z.string().max(20000).default(''),
});

export const projectLogPatchSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  content: z.string().max(20000).optional(),
  status: z.enum(['open', 'resolved']).optional(),
});

export const reviewPatchSchema = z.object({
  status: z.enum(['draft', 'final']).optional(),
  newSkills: z.string().max(10000).optional(),
  shipped: z.string().max(10000).optional(),
  testResults: z.string().max(10000).optional(),
  challenges: z.string().max(10000).optional(),
  unfinished: z.string().max(10000).optional(),
  nextWeekPlan: z.string().max(10000).optional(),
});

export const evaluationCreateSchema = z.object({
  scope: z.enum(['phase', 'project', 'task', 'week']),
  targetSlug: z.string().min(1).max(120),
  title: z.string().min(2).max(200),
  criteria: z.string().max(10000).default(''),
  evidence: z.string().min(10).max(30000),
  result: z.enum(['pass', 'fail', 'partial']),
  score: z.number().int().min(0).max(100).default(0),
  notes: z.string().max(10000).default(''),
});

export const aiChatSchema = z.object({
  conversationId: z.string().max(64).optional(),
  message: z.string().min(1).max(20000),
  scope: z.enum(['general', 'task', 'phase', 'project', 'review']).default('general'),
  taskSlug: z.string().max(120).optional(),
  phaseSlug: z.string().max(120).optional(),
  projectSlug: z.string().max(120).optional(),
  week: z.number().int().min(1).max(52).optional(),
});
