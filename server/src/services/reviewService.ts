import { LearningPhase, LearningPlan, LearningRecord, LearningTask, Note } from '../models';
import { Evaluation, WeeklyReview } from '../models/review';
import { HttpError, notFound } from '../lib/http';
import { dayKey, weekRange } from './progress';

export async function generateWeeklyReview(week: number) {
  if (week < 1 || week > 52) throw new HttpError(400, '周次必须在 1–52 之间');
  const plan = await LearningPlan.findOne({ slug: 'main-plan' }).lean();
  if (!plan) notFound('学习计划不存在');
  if (week > plan.totalWeeks + 4) throw new HttpError(400, '该周次超出计划范围');

  const range = weekRange(plan.startDate, week);
  const [allTasks, records, notes, existing] = await Promise.all([
    LearningTask.find({ week }).sort({ order: 1 }).lean(),
    LearningRecord.find({ date: { $gte: range.startKey, $lte: range.endKey } }).lean(),
    Note.find({ createdAt: { $gte: range.start, $lte: new Date(range.end.getTime() + 86_399_999) } }).lean(),
    WeeklyReview.findOne({ planSlug: plan.slug, week }).lean(),
  ]);
  const tasks = allTasks.filter((task) => !task.optional);

  if (existing?.status === 'final') {
    return { review: existing, generated: false, message: '该周复盘已定稿，未被覆盖' };
  }

  const completed = tasks.filter(
    (task) => task.completedAt && task.completedAt >= range.start && task.completedAt <= new Date(range.end.getTime() + 86_399_999)
  );
  const unfinished = tasks.filter((task) => task.status !== 'done');
  const actualMinutes = records.reduce((sum, record) => sum + record.minutes, 0);
  const plannedMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const unfinishedText =
    existing?.unfinished ||
    unfinished
      .map((task) => `- ${task.title}（${task.status === 'not_started' ? '未开始' : task.status === 'in_progress' ? '进行中' : '待验收'}）${task.blockers ? `：${task.blockers}` : ''}`)
      .join('\n');

  const payload = {
    planSlug: plan.slug,
    week,
    status: existing?.status ?? 'draft',
    plannedMinutes,
    actualMinutes,
    completedTaskSlugs: completed.map((task) => task.slug),
    unfinished: unfinishedText,
    metricsSnapshot: {
      tasksTotal: tasks.length,
      tasksDone: completed.length,
      tasksInProgress: tasks.filter((task) => task.status === 'in_progress').length,
      recordsCount: records.length,
      notesCount: notes.length,
      studyDays: new Set(records.map((record) => record.date)).size,
      actualMinutes,
      plannedMinutes,
    },
  };

  const review = await WeeklyReview.findOneAndUpdate(
    { planSlug: plan.slug, week },
    {
      $set: payload,
      $setOnInsert: {
        newSkills: '',
        shipped: '',
        testResults: '',
        challenges: '',
        nextWeekPlan: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return { review, generated: true };
}

export async function listReviews() {
  const reviews = await WeeklyReview.find({}).sort({ week: -1 }).lean();
  return reviews.map((review) => ({
    ...review,
    createdAt: review.createdAt?.toISOString() ?? null,
    updatedAt: review.updatedAt?.toISOString() ?? null,
  }));
}

export async function getReview(week: number) {
  const review = await WeeklyReview.findOne({ planSlug: 'main-plan', week }).lean();
  if (!review) notFound('该周复盘尚未生成');
  return {
    ...review,
    createdAt: review.createdAt?.toISOString() ?? null,
    updatedAt: review.updatedAt?.toISOString() ?? null,
  };
}

export async function patchReview(week: number, patch: Record<string, unknown>) {
  if (patch.status === 'final') {
    const review = await WeeklyReview.findOne({ planSlug: 'main-plan', week }).lean();
    if (!review) notFound('该周复盘尚未生成');
    const missing = ['newSkills', 'challenges', 'nextWeekPlan'].filter(
      (key) => !String((patch[key] ?? (review as unknown as Record<string, unknown>)[key] ?? '')).trim()
    );
    if (missing.length) {
      throw new HttpError(400, '定稿前请填写新掌握技能、遇到的难题和下周计划', { missing });
    }
  }
  const review = await WeeklyReview.findOneAndUpdate(
    { planSlug: 'main-plan', week },
    { $set: patch },
    { new: true }
  ).lean();
  if (!review) notFound('该周复盘尚未生成');
  return review;
}

export async function createEvaluation(input: {
  scope: 'phase' | 'project' | 'task' | 'week';
  targetSlug: string;
  title: string;
  criteria: string;
  evidence: string;
  result: 'pass' | 'fail' | 'partial';
  score: number;
  notes: string;
}) {
  if (input.result === 'pass') {
    if (input.scope === 'phase') {
      const phase = await LearningPhase.findOne({ slug: input.targetSlug }).lean();
      if (!phase) notFound('阶段不存在');
      const phaseTasks = await LearningTask.find({ phaseSlug: input.targetSlug }).lean();
      const tasks = phaseTasks.filter((task) => !task.optional);
      const unfinished = tasks.filter((task) => task.status !== 'done');
      if (tasks.length === 0 || unfinished.length > 0) {
        throw new HttpError(
          409,
          `阶段还有 ${unfinished.length} 个任务未完成，不能判定为通过`,
          { unfinished: unfinished.map((task) => task.slug) }
        );
      }
    }
    if (input.scope === 'task') {
      const task = await LearningTask.findOne({ slug: input.targetSlug }).lean();
      if (!task) notFound('任务不存在');
      if (task.status !== 'done') throw new HttpError(409, '任务尚未完成，不能判定为通过');
    }
  }

  const evaluation = await Evaluation.create({
    ...input,
    evaluatedAt: new Date(),
  });
  return evaluation.toObject();
}

export async function listEvaluations(targetSlug?: string) {
  const filter = targetSlug ? { targetSlug } : {};
  const items = await Evaluation.find(filter).sort({ evaluatedAt: -1 }).lean();
  return items.map((item) => ({
    ...item,
    evaluatedAt: item.evaluatedAt?.toISOString() ?? null,
    createdAt: item.createdAt?.toISOString() ?? null,
  }));
}

export async function phaseAcceptanceStatus() {
  const [phases, tasks, evaluations] = await Promise.all([
    LearningPhase.find({}).sort({ order: 1 }).lean(),
    LearningTask.find({}).select({ phaseSlug: 1, status: 1, optional: 1 }).lean(),
    Evaluation.find({ scope: 'phase' }).sort({ evaluatedAt: -1 }).lean(),
  ]);

  const latest = new Map<string, (typeof evaluations)[number]>();
  for (const evaluation of evaluations) {
    if (!latest.has(evaluation.targetSlug)) latest.set(evaluation.targetSlug, evaluation);
  }

  return phases.map((phase) => {
    const phaseTasks = tasks.filter((task) => task.phaseSlug === phase.slug && !task.optional);
    const done = phaseTasks.filter((task) => task.status === 'done').length;
    return {
      phaseSlug: phase.slug,
      title: phase.title,
      tasksTotal: phaseTasks.length,
      tasksDone: done,
      evaluation: latest.get(phase.slug)
        ? {
            result: latest.get(phase.slug)!.result,
            score: latest.get(phase.slug)!.score,
            evaluatedAt: latest.get(phase.slug)!.evaluatedAt,
          }
        : null,
    };
  });
}

export const todayKey = () => dayKey(new Date());
