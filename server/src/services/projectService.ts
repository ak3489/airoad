import mongoose from 'mongoose';
import { Project, Milestone, ProjectTask, ProjectLog } from '../models/project';
import { notFound } from '../lib/http';

export async function getProject(profileId: string, slug: string) {
  const project = await Project.findOne({ profileId, slug }).lean();
  if (!project) notFound('项目不存在');

  const [milestones, tasks, logs] = await Promise.all([
    Milestone.find({ profileId, projectSlug: slug }).sort({ order: 1 }).lean(),
    ProjectTask.find({ profileId, projectSlug: slug }).sort({ order: 1 }).lean(),
    ProjectLog.find({ profileId, projectSlug: slug }).sort({ createdAt: -1 }).lean(),
  ]);

  const tasksByMilestone = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const list = tasksByMilestone.get(task.milestoneSlug) ?? [];
    list.push(task);
    tasksByMilestone.set(task.milestoneSlug, list);
  }

  const milestonesDone = milestones.filter((item) => item.status === 'done').length;
  const tasksDone = tasks.filter((item) => item.status === 'done').length;
  const nextTask = tasks.find((task) => task.status !== 'done') ?? null;

  return {
    project: {
      ...project,
      percent: milestones.length ? Math.round((milestonesDone / milestones.length) * 100) : 0,
    },
    milestones: milestones.map((milestone) => {
      const items = tasksByMilestone.get(milestone.slug) ?? [];
      return {
        ...milestone,
        tasks: items,
        tasksDone: items.filter((task) => task.status === 'done').length,
        tasksTotal: items.length,
        percent: items.length
          ? Math.round((items.filter((task) => task.status === 'done').length / items.length) * 100)
          : milestone.status === 'done'
            ? 100
            : 0,
      };
    }),
    tasks,
    logs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt?.toISOString() ?? null,
      updatedAt: log.updatedAt?.toISOString() ?? null,
    })),
    stats: {
      milestonesDone,
      milestonesTotal: milestones.length,
      tasksDone,
      tasksTotal: tasks.length,
      nextTask,
    },
  };
}

export async function patchProject(
  profileId: string,
  slug: string,
  patch: Record<string, unknown>
) {
  const project = await Project.findOneAndUpdate(
    { profileId, slug },
    { $set: patch },
    { new: true }
  ).lean();
  if (!project) notFound('项目不存在');
  return project;
}

export async function patchMilestone(
  profileId: string,
  slug: string,
  patch: Record<string, unknown>
) {
  if (patch.status === 'done') patch.completedAt = new Date();
  if (patch.status && patch.status !== 'done') patch.completedAt = null;
  const milestone = await Milestone.findOneAndUpdate(
    { profileId, slug },
    { $set: patch },
    { new: true }
  ).lean();
  if (!milestone) notFound('里程碑不存在');
  return milestone;
}

export async function patchProjectTask(
  profileId: string,
  slug: string,
  patch: Record<string, unknown>
) {
  if (patch.status === 'done') patch.completedAt = new Date();
  if (patch.status && patch.status !== 'done') patch.completedAt = null;
  const task = await ProjectTask.findOneAndUpdate(
    { profileId, slug },
    { $set: patch },
    { new: true }
  ).lean();
  if (!task) notFound('项目任务不存在');
  return task;
}

export async function createProjectLog(
  profileId: string,
  input: {
    projectSlug: string;
    type: 'decision' | 'issue' | 'test';
    title: string;
    content: string;
  }
) {
  const project = await Project.findOne({ profileId, slug: input.projectSlug }).lean();
  if (!project) notFound('项目不存在');
  const log = await ProjectLog.create({ ...input, profileId });
  return log.toObject();
}

export async function patchProjectLog(
  profileId: string,
  id: string,
  patch: Record<string, unknown>
) {
  if (!mongoose.isValidObjectId(id)) notFound('记录不存在');
  const log = await ProjectLog.findOneAndUpdate(
    { _id: id, profileId },
    { $set: patch },
    { new: true }
  ).lean();
  if (!log) notFound('记录不存在');
  return log;
}
