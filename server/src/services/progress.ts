import { MAIN_PROJECT_SLUG } from '../lib/constants';
import { LearningPhase, LearningPlan, LearningRecord, LearningTask, Note } from '../models';
import { Milestone, Project, ProjectLog, ProjectTask } from '../models/project';

export const dayKey = (date: Date | string): string => {
  const value = typeof date === 'string' ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const weekRange = (startDate: Date, week: number) => {
  const start = addDays(startOfDay(startDate), (week - 1) * 7);
  const end = addDays(start, 6);
  return { start, end, startKey: dayKey(start), endKey: dayKey(end) };
};

export const currentWeekOf = (startDate: Date, totalWeeks: number, now = new Date()): number => {
  const diff = Math.floor(
    (startOfDay(now).getTime() - startOfDay(startDate).getTime()) / 86_400_000
  );
  return Math.min(Math.max(Math.floor(diff / 7) + 1, 1), totalWeeks);
};

export interface TaskSummary {
  slug: string;
  title: string;
  phaseSlug: string;
  phaseTitle: string;
  week: number;
  status: string;
  priority: string;
  optional: boolean;
  estimatedMinutes: number;
  actualMinutes: number;
  dueDate: string | null;
  tags: string[];
  stepTotal: number;
  stepDone: number;
  percent: number;
}

type LeanTask = {
  slug: string;
  title: string;
  phaseSlug: string;
  week: number;
  day: number;
  order: number;
  status: string;
  priority: string;
  optional?: boolean;
  estimatedMinutes: number;
  dueDate?: Date | null;
  tags?: string[];
  steps?: { key: string; order: number; status: string }[];
  prerequisiteSlugs?: string[];
};

type LeanRecord = { taskSlug?: string; date: string; minutes: number };

export function summarizeTask(task: LeanTask, phaseTitle: string, minutesByTask: Map<string, number>): TaskSummary {
  const stepTotal = task.steps?.length ?? 0;
  const stepDone = task.steps?.filter((step) => step.status === 'done').length ?? 0;
  const percent =
    task.status === 'done' ? 100 : stepTotal > 0 ? Math.round((stepDone / stepTotal) * 100) : 0;
  return {
    slug: task.slug,
    title: task.title,
    phaseSlug: task.phaseSlug,
    phaseTitle,
    week: task.week,
    status: task.status,
    priority: task.priority,
    optional: Boolean(task.optional),
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: minutesByTask.get(task.slug) ?? 0,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    tags: task.tags ?? [],
    stepTotal,
    stepDone,
    percent,
  };
}

export function computeStreak(recordDates: string[], now = new Date()): number {
  const dates = new Set(recordDates);
  let cursor = startOfDay(now);
  if (!dates.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (dates.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getOverview() {
  const plan = await LearningPlan.findOne({ slug: 'main-plan' }).lean();
  if (!plan) throw new Error('学习计划尚未初始化，请先运行 npm run seed');

  const [phases, tasks, records, project, milestones, projectTasks, recentNotes, openLogs] =
    await Promise.all([
      LearningPhase.find({ planSlug: plan.slug }).sort({ order: 1 }).lean(),
      LearningTask.find({}).sort({ week: 1, order: 1 }).lean<LeanTask[]>(),
      LearningRecord.find({}).select({ taskSlug: 1, date: 1, minutes: 1, summary: 1 }).lean(),
      Project.findOne({ slug: MAIN_PROJECT_SLUG }).lean(),
      Milestone.find({ projectSlug: MAIN_PROJECT_SLUG }).sort({ order: 1 }).lean(),
      ProjectTask.find({ projectSlug: MAIN_PROJECT_SLUG }).sort({ order: 1 }).lean(),
      Note.find({ kind: 'issue' }).sort({ createdAt: -1 }).limit(5).lean(),
      ProjectLog.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

  const phaseTitle = new Map(phases.map((phase) => [phase.slug, phase.title]));
  const minutesByTask = new Map<string, number>();
  for (const record of records) {
    if (!record.taskSlug) continue;
    minutesByTask.set(record.taskSlug, (minutesByTask.get(record.taskSlug) ?? 0) + record.minutes);
  }

  const week = currentWeekOf(plan.startDate, plan.totalWeeks);
  const range = weekRange(plan.startDate, week);
  const now = new Date();
  const todayKey = dayKey(now);
  const startToday = startOfDay(now);

  const doneSet = new Set(tasks.filter((task) => task.status === 'done').map((task) => task.slug));
  const requiredTasks = tasks.filter((task) => !task.optional);
  const sorted = [...requiredTasks].sort((a, b) => a.week - b.week || a.order - b.order);
  const nextTask =
    sorted.find(
      (task) =>
        task.status !== 'done' &&
        (task.prerequisiteSlugs ?? []).every((slug) => doneSet.has(slug))
    ) ??
    sorted.find((task) => task.status !== 'done') ??
    null;

  const todayTasks = sorted
    .filter(
      (task) =>
        task.status !== 'done' &&
        task.dueDate &&
        dayKey(task.dueDate) <= todayKey
    )
    .slice(0, 3);

  const phaseStats = phases.map((phase, index) => {
    const phaseTasks = requiredTasks.filter((task) => task.phaseSlug === phase.slug);
    const steps = phaseTasks.reduce((sum, task) => sum + (task.steps?.length ?? 0), 0);
    const stepsDone = phaseTasks.reduce(
      (sum, task) => sum + (task.steps?.filter((step) => step.status === 'done').length ?? 0),
      0
    );
    const tasksDone = phaseTasks.filter((task) => task.status === 'done').length;
    const percent =
      steps > 0
        ? Math.round((stepsDone / steps) * 100)
        : phaseTasks.length
          ? Math.round((tasksDone / phaseTasks.length) * 100)
          : 0;
    const allDone = phaseTasks.length > 0 && tasksDone === phaseTasks.length;
    const previousDone = phases
      .slice(0, index)
      .every((prev) => {
        const prevTasks = requiredTasks.filter((task) => task.phaseSlug === prev.slug);
        return prevTasks.length > 0 && prevTasks.every((task) => task.status === 'done');
      });
    return {
      slug: phase.slug,
      order: phase.order,
      title: phase.title,
      shortTitle: phase.shortTitle,
      weeks: phase.weeks,
      goal: phase.goal,
      percent,
      tasksDone,
      tasksTotal: phaseTasks.length,
      status: allDone ? 'completed' : previousDone ? 'active' : 'locked',
    };
  });

  const activePhase = phaseStats.find((phase) => phase.status === 'active') ?? phaseStats.at(-1);

  const totalTasks = requiredTasks.length;
  const doneTasks = requiredTasks.filter((task) => task.status === 'done').length;
  const inProgressTasks = requiredTasks.filter((task) => task.status === 'in_progress').length;
  const reviewTasks = requiredTasks.filter((task) => task.status === 'review').length;
  const overdueTasks = requiredTasks.filter(
    (task) => task.status !== 'done' && task.dueDate && task.dueDate < startToday
  ).length;

  const weekTasks = requiredTasks.filter((task) => task.week === week);
  const weekPlanned = weekTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const weekActual = records
    .filter((record) => record.date >= range.startKey && record.date <= range.endKey)
    .reduce((sum, record) => sum + record.minutes, 0);

  const projectMilestonesDone = milestones.filter((item) => item.status === 'done').length;
  const projectTasksDone = projectTasks.filter((item) => item.status === 'done').length;
  const projectPercent =
    milestones.length > 0
      ? Math.round((projectMilestonesDone / milestones.length) * 100)
      : 0;

  const recordTask = new Map(tasks.map((task) => [task.slug, task.title]));
  const recentRecords = await LearningRecord.find({})
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const openIssues = [
    ...openLogs.map((log) => ({
      id: String(log._id),
      title: log.title,
      kind: log.type,
      source: 'project' as const,
      taskSlug: '',
      createdAt: log.createdAt?.toISOString() ?? null,
    })),
    ...recentNotes.map((note) => ({
      id: String(note._id),
      title: note.title,
      kind: note.kind,
      source: 'note' as const,
      taskSlug: note.taskSlug,
      createdAt: note.createdAt?.toISOString() ?? null,
    })),
  ].slice(0, 6);

  const nextProjectTask = projectTasks.find((task) => task.status !== 'done') ?? null;

  return {
    plan: {
      slug: plan.slug,
      name: plan.name,
      roleTarget: plan.roleTarget,
      summary: plan.summary,
      startDate: plan.startDate.toISOString(),
      totalWeeks: plan.totalWeeks,
      dailyMinutes: plan.dailyMinutes,
      currentWeek: week,
    },
    phases: phaseStats,
    activePhase: activePhase ?? null,
    stats: {
      totalTasks,
      doneTasks,
      inProgressTasks,
      reviewTasks,
      notStartedTasks: totalTasks - doneTasks - inProgressTasks - reviewTasks,
      overdueTasks,
      completionRate: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
    },
    time: {
      totalMinutes: records.reduce((sum, record) => sum + record.minutes, 0),
      weekPlannedMinutes: weekPlanned,
      weekActualMinutes: weekActual,
      studyDays: new Set(records.map((record) => record.date)).size,
      streak: computeStreak(records.map((record) => record.date)),
    },
    today: {
      tasks: todayTasks.map((task) =>
        summarizeTask(task, phaseTitle.get(task.phaseSlug) ?? '', minutesByTask)
      ),
      recommended: nextTask
        ? summarizeTask(nextTask, phaseTitle.get(nextTask.phaseSlug) ?? '', minutesByTask)
        : null,
    },
    project: project
      ? {
          slug: project.slug,
          name: project.name,
          percent: projectPercent,
          milestonesDone: projectMilestonesDone,
          milestonesTotal: milestones.length,
          tasksDone: projectTasksDone,
          tasksTotal: projectTasks.length,
          nextTask: nextProjectTask
            ? { slug: nextProjectTask.slug, title: nextProjectTask.title }
            : null,
        }
      : null,
    recentRecords: recentRecords.map((record) => ({
      id: String(record._id),
      taskSlug: record.taskSlug,
      taskTitle: recordTask.get(record.taskSlug) ?? '自主学习',
      date: record.date,
      minutes: record.minutes,
      summary: record.summary,
      createdAt: record.createdAt?.toISOString() ?? null,
    })),
    openIssues,
  };
}
