import { LearningPhase, LearningTask, LearningRecord, Resource } from '../models';
import type { TaskStatus } from '../models/task';
import { HttpError, notFound } from '../lib/http';
import { dayKey } from './progress';

const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  not_started: ['in_progress'],
  in_progress: ['review', 'done'],
  review: ['done', 'in_progress'],
  done: ['in_progress'],
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  review: '待验收',
  done: '已完成',
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function stepSummary(steps: { key: string; order: number; title: string; status: string }[]) {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  const firstIncomplete = ordered.findIndex((step) => step.status !== 'done');
  return ordered.map((step, index) => ({
    key: step.key,
    order: step.order,
    title: step.title,
    status: step.status,
    locked: firstIncomplete !== -1 && index > firstIncomplete,
  }));
}

export async function listTasks(
  profileId: string,
  query: {
    status?: TaskStatus;
    phase?: string;
    week?: number;
    q?: string;
    tag?: string;
  }
) {
  const filter: Record<string, unknown> = { profileId };
  if (query.status) filter.status = query.status;
  if (query.phase) filter.phaseSlug = query.phase;
  if (query.week) filter.week = query.week;
  if (query.tag) filter.tags = query.tag;
  if (query.q) filter.title = new RegExp(escapeRegex(query.q), 'i');

  const [tasks, phases, records] = await Promise.all([
    LearningTask.find(filter).sort({ week: 1, order: 1 }).lean(),
    LearningPhase.find({ profileId }).select({ slug: 1, title: 1, order: 1 }).lean(),
    LearningRecord.find({ profileId }).select({ taskSlug: 1, minutes: 1 }).lean(),
  ]);

  const phaseTitle = new Map(phases.map((phase) => [phase.slug, phase.title]));
  const minutes = new Map<string, number>();
  for (const record of records) {
    if (!record.taskSlug) continue;
    minutes.set(record.taskSlug, (minutes.get(record.taskSlug) ?? 0) + record.minutes);
  }

  return tasks.map((task) => ({
    slug: task.slug,
    title: task.title,
    objective: task.objective,
    phaseSlug: task.phaseSlug,
    phaseTitle: phaseTitle.get(task.phaseSlug) ?? '',
    week: task.week,
    day: task.day,
    order: task.order,
    status: task.status,
    priority: task.priority,
    optional: Boolean(task.optional),
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: minutes.get(task.slug) ?? 0,
    dueDate: task.dueDate?.toISOString() ?? null,
    tags: task.tags,
    stepTotal: task.steps.length,
    stepDone: task.steps.filter((step) => step.status === 'done').length,
    percent:
      task.status === 'done'
        ? 100
        : task.steps.length
          ? Math.round((task.steps.filter((step) => step.status === 'done').length / task.steps.length) * 100)
          : 0,
  }));
}

export async function getTaskDetail(profileId: string, slug: string) {
  const task = await LearningTask.findOne({ profileId, slug }).lean();
  if (!task) notFound('任务不存在');

  const [phase, resources, records, siblings, minutesAgg] = await Promise.all([
    LearningPhase.findOne({ profileId, slug: task.phaseSlug }).lean(),
    Resource.find({ profileId, slug: { $in: task.resourceSlugs } }).lean(),
    LearningRecord.find({ profileId, taskSlug: slug }).sort({ createdAt: -1 }).limit(20).lean(),
    LearningTask.find({ profileId, phaseSlug: task.phaseSlug }).sort({ order: 1 }).lean(),
    LearningRecord.aggregate<{ total: number }>([
      { $match: { profileId, taskSlug: slug } },
      { $group: { _id: null, total: { $sum: '$minutes' } } },
    ]),
  ]);

  const index = siblings.findIndex((item) => item.slug === slug);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  const prerequisiteTasks = await LearningTask.find({
    profileId,
    slug: { $in: task.prerequisiteSlugs },
  })
    .select({ slug: 1, title: 1, status: 1 })
    .lean();

  const summaries = stepSummary(task.steps);
  const stepsByKey = new Map(task.steps.map((step) => [step.key, step]));

  return {
    task: {
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      steps: summaries.map((summaryStep) => ({
        ...stepsByKey.get(summaryStep.key),
        locked: summaryStep.locked,
      })),
    },
    phase,
    resources,
    records: records.map((record) => ({
      ...record,
      createdAt: record.createdAt?.toISOString() ?? null,
    })),
    actualMinutes: minutesAgg[0]?.total ?? 0,
    previous: previous ? { slug: previous.slug, title: previous.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
    prerequisiteTasks,
    statusLabels: STATUS_LABEL,
  };
}

export async function transitionTask(profileId: string, slug: string, target: TaskStatus, note = '') {
  const task = await LearningTask.findOne({ profileId, slug }).lean();
  if (!task) notFound('任务不存在');
  const current = task.status as TaskStatus;
  if (current === target) return { task: { slug, status: current }, changed: false };
  if (!ALLOWED[current].includes(target)) {
    throw new HttpError(
      409,
      `不允许从「${STATUS_LABEL[current]}」直接切换到「${STATUS_LABEL[target]}」`
    );
  }
  if (target === 'done') {
    const incomplete = task.steps.filter((step) => step.status !== 'done');
    if (incomplete.length > 0) {
      throw new HttpError(
        409,
        `还有 ${incomplete.length} 个步骤未完成，不能标记任务完成`,
        { incompleteSteps: incomplete.map((step) => step.key) }
      );
    }
  }

  const now = new Date();
  const update: Record<string, unknown> = {
    $set: { status: target },
    $push: { statusHistory: { status: target, at: now, note } },
  };
  if (target === 'in_progress') {
    (update.$set as Record<string, unknown>).startedAt = task.startedAt ?? now;
    (update.$set as Record<string, unknown>).completedAt = null;
  }
  if (target === 'done') {
    (update.$set as Record<string, unknown>).completedAt = now;
    (update.$set as Record<string, unknown>).startedAt = task.startedAt ?? now;
  }

  const updated = await LearningTask.findOneAndUpdate({ profileId, slug }, update, { new: true }).lean();
  return { task: updated, changed: true };
}

export async function patchTask(profileId: string, slug: string, patch: Record<string, unknown>) {
  if (patch.dueDate !== undefined) {
    patch.dueDate = patch.dueDate ? new Date(patch.dueDate as string) : null;
  }
  const task = await LearningTask.findOneAndUpdate(
    { profileId, slug },
    { $set: patch },
    { new: true }
  ).lean();
  if (!task) notFound('任务不存在');
  return task;
}

export async function updateStep(
  profileId: string,
  slug: string,
  stepKey: string,
  patch: { status?: 'todo' | 'done'; resultLog?: string; errorLog?: string; notes?: string }
) {
  const task = await LearningTask.findOne({ profileId, slug }).lean();
  if (!task) notFound('任务不存在');
  const index = task.steps.findIndex((step) => step.key === stepKey);
  if (index === -1) notFound('步骤不存在');

  const ordered = [...task.steps].sort((a, b) => a.order - b.order);
  const position = ordered.findIndex((step) => step.key === stepKey);

  if (patch.status === 'done') {
    const previousIncomplete = ordered.slice(0, position).some((step) => step.status !== 'done');
    if (previousIncomplete) throw new HttpError(409, '请先完成前面的步骤');
  }
  if (patch.status === 'todo') {
    const laterDone = ordered.slice(position + 1).some((step) => step.status === 'done');
    if (laterDone) throw new HttpError(409, '后续步骤已完成，不能回退该步骤');
  }

  const steps = task.steps.map((step) =>
    step.key === stepKey
      ? {
          ...step,
          ...patch,
          completedAt:
            patch.status === 'done'
              ? step.completedAt ?? new Date()
              : patch.status === 'todo'
                ? null
                : step.completedAt,
        }
      : step
  );

  const update: Record<string, unknown> = { $set: { steps } };
  if (patch.status === 'done' && task.status === 'not_started') {
    update.$set = {
      steps,
      status: 'in_progress',
      startedAt: task.startedAt ?? new Date(),
    };
    update.$push = { statusHistory: { status: 'in_progress', at: new Date(), note: '完成第一个步骤' } };
  }
  if (patch.status === 'todo' && (task.status === 'review' || task.status === 'done')) {
    update.$set = {
      ...(update.$set as Record<string, unknown>),
      status: 'in_progress',
      completedAt: null,
    };
    update.$push = {
      statusHistory: {
        status: 'in_progress',
        at: new Date(),
        note: `退回步骤「${ordered[position].title}」`,
      },
    };
  }

  const updated = await LearningTask.findOneAndUpdate({ profileId, slug }, update, { new: true }).lean();
  return updated;
}

export async function addRecord(
  profileId: string,
  input: {
    taskSlug?: string;
    stepKey?: string;
    date?: string;
    minutes: number;
    summary?: string;
    kind?: string;
  }
) {
  let task = null;
  if (input.taskSlug) {
    task = await LearningTask.findOne({ profileId, slug: input.taskSlug });
    if (!task) notFound('任务不存在');
  }

  const record = await LearningRecord.create({
    profileId,
    taskSlug: input.taskSlug ?? '',
    stepKey: input.stepKey ?? '',
    date: input.date ?? dayKey(new Date()),
    minutes: input.minutes,
    summary: input.summary ?? '',
    kind: input.kind ?? (input.taskSlug ? 'study' : 'project'),
  });

  if (task && task.status === 'not_started') {
    task.status = 'in_progress';
    task.startedAt = task.startedAt ?? new Date();
    task.statusHistory.push({ status: 'in_progress', at: new Date(), note: '记录学习时间' });
    await task.save();
  }

  return record.toObject();
}

export async function splitTask(
  profileId: string,
  slug: string,
  parts: { title: string; objective: string; estimatedMinutes: number }[]
) {
  const original = await LearningTask.findOne({ profileId, slug }).lean();
  if (!original) notFound('任务不存在');

  const phaseTasks = await LearningTask.find({ profileId, phaseSlug: original.phaseSlug })
    .sort({ order: -1 })
    .limit(1)
    .lean();
  let order = (phaseTasks[0]?.order ?? original.order) + 1;
  const stamp = Date.now();

  const created = [];
  for (const [index, part] of parts.entries()) {
    const task = await LearningTask.create({
      profileId,
      slug: `custom-${stamp}-${index + 1}`,
      phaseSlug: original.phaseSlug,
      week: original.week,
      day: original.day,
      order: order++,
      title: part.title,
      objective: part.objective,
      problem: `由任务「${original.title}」拆分而来。`,
      estimatedMinutes: part.estimatedMinutes,
      status: 'not_started',
      priority: original.priority,
      optional: Boolean(original.optional),
      dueDate: original.dueDate,
      tags: [...(original.tags ?? []), '拆分任务'],
      acceptance: [],
      resourceSlugs: original.resourceSlugs,
      prerequisiteSlugs: index === 0 ? [original.slug] : [`custom-${stamp}-${index}`],
      steps: [],
      statusHistory: [],
    });
    created.push(task.toObject());
  }
  return created;
}

export async function createTask(
  profileId: string,
  input: {
    phaseSlug: string;
    week: number;
    title: string;
    objective: string;
    estimatedMinutes: number;
    dueDate?: string | null;
    tags?: string[];
    acceptance?: string[];
  }
) {
  const phase = await LearningPhase.findOne({ profileId, slug: input.phaseSlug }).lean();
  if (!phase) notFound('阶段不存在');
  const last = await LearningTask.find({ profileId, phaseSlug: input.phaseSlug })
    .sort({ order: -1 })
    .limit(1)
    .lean();

  const task = await LearningTask.create({
    profileId,
    slug: `custom-${Date.now()}`,
    phaseSlug: input.phaseSlug,
    week: input.week,
    day: 1,
    order: (last[0]?.order ?? 0) + 1,
    title: input.title,
    objective: input.objective,
    problem: '',
    estimatedMinutes: input.estimatedMinutes,
    status: 'not_started',
    priority: 'normal',
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    tags: input.tags ?? [],
    acceptance: input.acceptance ?? [],
    resourceSlugs: [],
    prerequisiteSlugs: [],
    steps: [],
    statusHistory: [],
  });
  return task.toObject();
}

export async function deleteCustomTask(profileId: string, slug: string) {
  if (!slug.startsWith('custom-')) {
    throw new HttpError(403, '只能删除自定义任务');
  }
  const task = await LearningTask.findOneAndDelete({ profileId, slug });
  if (!task) notFound('任务不存在');
  await LearningRecord.deleteMany({ profileId, taskSlug: slug });
  return { deleted: true };
}
