import type { FastifyInstance } from 'fastify';
import {
  LearningPhase,
  LearningPlan,
  LearningRecord,
  LearningTask,
  Note,
  Resource,
} from '../models';
import { Milestone, Project, ProjectLog, ProjectTask } from '../models/project';
import { Evaluation, WeeklyReview } from '../models/review';

export async function exportRoutes(app: FastifyInstance) {
  app.get('/export', async (_request, reply) => {
    const [plan, phases, tasks, resources, notes, records, reviews, evaluations, projects, milestones, projectTasks, projectLogs] =
      await Promise.all([
        LearningPlan.find({}).lean(),
        LearningPhase.find({}).sort({ order: 1 }).lean(),
        LearningTask.find({}).sort({ week: 1, order: 1 }).lean(),
        Resource.find({}).sort({ importance: -1 }).lean(),
        Note.find({}).sort({ updatedAt: -1 }).lean(),
        LearningRecord.find({}).sort({ createdAt: 1 }).lean(),
        WeeklyReview.find({}).sort({ week: 1 }).lean(),
        Evaluation.find({}).sort({ evaluatedAt: 1 }).lean(),
        Project.find({}).lean(),
        Milestone.find({}).sort({ order: 1 }).lean(),
        ProjectTask.find({}).sort({ order: 1 }).lean(),
        ProjectLog.find({}).sort({ createdAt: 1 }).lean(),
      ]);

    const exportedAt = new Date();
    const stamp = exportedAt.toISOString().slice(0, 10);

    reply.header('content-disposition', `attachment; filename="airoad-backup-${stamp}.json"`);
    reply.header('cache-control', 'no-store');

    return {
      format: 'airoad-backup',
      version: 1,
      exportedAt: exportedAt.toISOString(),
      note: '学习数据备份；不包含浏览器中的 AI Key 配置、AI 会话与任何日志。',
      data: {
        plan,
        phases,
        tasks,
        resources,
        notes,
        records,
        reviews,
        evaluations,
        projects,
        milestones,
        projectTasks,
        projectLogs,
      },
    };
  });
}
