import { connectDatabase, disconnectDatabase } from '../mongo';
import { LearningPhase, LearningPlan, LearningTask, Resource } from '../../models';
import { Milestone, Project, ProjectTask } from '../../models/project';
import { phases } from './phases';
import { resources } from './resources';
import { seedResourcesVerifiedAt } from './types';
import { projectSeed } from './project';
import { referenceCount, referenceFor } from './references';
import { phase1Tasks } from './tasks/phase1';
import { phase2Tasks } from './tasks/phase2';
import { phase3Tasks } from './tasks/phase3';
import { phase4Tasks } from './tasks/phase4';
import { phase5Tasks } from './tasks/phase5';
import { phase6Tasks } from './tasks/phase6';
import { phase7Tasks } from './tasks/phase7';
import type { SeedStep, SeedTask } from './types';

const planSlug = 'main-plan';

// 每次课程内容（步骤、参考答案、资料）有实质更新时递增，启动时会自动刷新种子内容并保留学习进度。
export const SEED_CONTENT_VERSION = 2;

const allTasks: SeedTask[] = [
  ...phase1Tasks,
  ...phase2Tasks,
  ...phase3Tasks,
  ...phase4Tasks,
  ...phase5Tasks,
  ...phase6Tasks,
  ...phase7Tasks,
];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dueDateFor(startDate: Date, week: number, day: number): Date {
  const date = new Date(startDate);
  date.setDate(date.getDate() + (week - 1) * 7 + (day - 1));
  date.setHours(23, 59, 59, 999);
  return date;
}

function mergeSteps(
  existing: { key: string; status?: string; resultLog?: string; errorLog?: string; notes?: string; completedAt?: Date | null }[] | undefined,
  seedSteps: SeedStep[],
  taskSlug: string
) {
  return seedSteps.map((step, index) => {
    const prev = existing?.find((item) => item.key === step.key);
    return {
      ...step,
      order: index + 1,
      reference: referenceFor(taskSlug, step.key),
      status: prev?.status === 'done' ? 'done' : 'todo',
      resultLog: prev?.resultLog ?? '',
      errorLog: prev?.errorLog ?? '',
      notes: prev?.notes ?? '',
      completedAt: prev?.completedAt ?? null,
    };
  });
}

export async function seedDatabase() {
  const now = new Date();
  const existingPlan = await LearningPlan.findOne({ slug: planSlug });
  const startDate = existingPlan?.startDate ?? startOfDay(now);

  await LearningPlan.findOneAndUpdate(
    { slug: planSlug },
    {
      $set: {
        name: 'AI Agent 工程师 12 周成长计划',
        roleTarget: 'AI Agent 工程师 / 大模型应用开发工程师',
        summary: '以真实项目为主线，从模型 API 到可部署的企业知识库 AI 客服。每天 1–2 小时，12 周完成第一阶段。',
        totalWeeks: 12,
        dailyMinutes: 90,
        contentVersion: SEED_CONTENT_VERSION,
      },
      $setOnInsert: { startDate, status: 'active' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  for (const phase of phases) {
    await LearningPhase.findOneAndUpdate(
      { slug: phase.slug },
      { $set: { ...phase, planSlug } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  for (const resource of resources) {
    await Resource.findOneAndUpdate(
      { slug: resource.slug },
      {
        $set: {
          title: resource.title,
          url: resource.url,
          kind: resource.kind,
          topic: resource.topic,
          difficulty: resource.difficulty,
          phaseSlug: resource.phaseSlug,
          importance: resource.importance,
          order: resource.importance,
          keyPoints: resource.keyPoints,
          tags: resource.tags,
          official: resource.official,
          lastVerifiedAt: resource.verified ? seedResourcesVerifiedAt : null,
        },
        $setOnInsert: { status: 'unread', notes: '', favorite: false },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  for (const task of allTasks) {
    const existing = await LearningTask.findOne({ slug: task.slug }).lean();
    await LearningTask.findOneAndUpdate(
      { slug: task.slug },
      {
        $set: {
          phaseSlug: task.phaseSlug,
          week: task.week,
          day: task.day,
          order: task.order,
          title: task.title,
          objective: task.objective,
          problem: task.problem,
          estimatedMinutes: task.estimatedMinutes,
          priority: task.priority ?? 'normal',
          tags: task.tags,
          acceptance: task.acceptance,
          resourceSlugs: task.resourceSlugs,
          prerequisiteSlugs: task.prerequisiteSlugs ?? [],
          optional: task.optional ?? false,
          steps: mergeSteps(existing?.steps as never, task.steps, task.slug),
          ...(task.optional ? { dueDate: null } : {}),
        },
        $setOnInsert: {
          status: 'not_started',
          ...(task.optional ? {} : { dueDate: dueDateFor(startDate, task.week, task.day) }),
          notes: '',
          blockers: '',
          nextStep: '',
          statusHistory: [],
          startedAt: null,
          completedAt: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  await Project.findOneAndUpdate(
    { slug: projectSeed.slug },
    {
      $set: {
        name: projectSeed.name,
        goal: projectSeed.goal,
        repoUrl: projectSeed.repoUrl,
        description: projectSeed.description,
        architecture: projectSeed.architecture,
        deployment: projectSeed.deployment,
        demo: projectSeed.demo,
        status: projectSeed.status,
        techStack: projectSeed.techStack,
        securityNotes: projectSeed.securityNotes,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  for (const milestone of projectSeed.milestones) {
    await Milestone.findOneAndUpdate(
      { slug: milestone.slug },
      {
        $set: {
          projectSlug: projectSeed.slug,
          order: milestone.order,
          title: milestone.title,
          description: milestone.description,
          acceptance: milestone.acceptance,
        },
        $setOnInsert: { status: 'todo', completedAt: null },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  for (const task of projectSeed.tasks) {
    await ProjectTask.findOneAndUpdate(
      { slug: task.slug },
      {
        $set: {
          projectSlug: projectSeed.slug,
          milestoneSlug: task.milestoneSlug,
          order: task.order,
          title: task.title,
          description: task.description,
          estimateHours: task.estimateHours,
          tags: task.tags,
          priority: task.order === 1 ? 'high' : 'normal',
        },
        $setOnInsert: { status: 'backlog', completedAt: null },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  return {
    plan: planSlug,
    phases: phases.length,
    tasks: allTasks.length,
    steps: allTasks.reduce((sum, task) => sum + task.steps.length, 0),
    references: referenceCount(),
    resources: resources.length,
    milestones: projectSeed.milestones.length,
    projectTasks: projectSeed.tasks.length,
  };
}

if (require.main === module) {
  connectDatabase()
    .then(async () => {
      const result = await seedDatabase();
      console.log('[seed] completed', result);
    })
    .catch((error) => {
      console.error('[seed] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectDatabase();
    });
}
