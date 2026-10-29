import type { FastifyInstance } from 'fastify';
import { LearningPhase, LearningPlan } from '../models';
import { HttpError, parse } from '../lib/http';
import { phaseCreateSchema, phasePatchSchema, planPatchSchema } from '../schemas';
import { listTasks } from '../services/taskService';
import { getOverview } from '../services/progress';
import { phaseAcceptanceStatus } from '../services/reviewService';

export async function planRoutes(app: FastifyInstance) {
  app.get('/plan', async (request) => {
    const profileId = request.profileId;
    const [plan, phases, tasks, overview, acceptance] = await Promise.all([
      LearningPlan.findOne({ profileId, slug: 'main-plan' }).lean(),
      LearningPhase.find({ profileId, planSlug: 'main-plan' }).sort({ order: 1 }).lean(),
      listTasks(profileId, {}),
      getOverview(profileId),
      phaseAcceptanceStatus(profileId),
    ]);
    if (!plan) throw new Error('学习计划尚未初始化');

    const progressByPhase = new Map(overview.phases.map((phase) => [phase.slug, phase]));
    const acceptanceByPhase = new Map(acceptance.map((item) => [item.phaseSlug, item]));

    return {
      plan: {
        ...plan,
        startDate: plan.startDate.toISOString(),
        currentWeek: overview.plan.currentWeek,
      },
      phases: phases.map((phase) => ({
        ...phase,
        tasks: tasks
          .filter((task) => task.phaseSlug === phase.slug)
          .sort((a, b) => Number(a.optional) - Number(b.optional)),
        progress: progressByPhase.get(phase.slug) ?? null,
        evaluation: acceptanceByPhase.get(phase.slug)?.evaluation ?? null,
      })),
      totals: overview.stats,
    };
  });

  app.patch('/plan', async (request) => {
    const body = parse(planPatchSchema, request.body);
    const patch: Record<string, unknown> = { ...body };
    if (body.startDate) patch.startDate = new Date(body.startDate);
    const plan = await LearningPlan.findOneAndUpdate(
      { profileId: request.profileId, slug: 'main-plan' },
      { $set: patch },
      { new: true }
    ).lean();
    if (!plan) throw new HttpError(404, '学习计划不存在');
    return plan;
  });

  app.patch('/phases/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const patch = parse(phasePatchSchema, request.body);
    const phase = await LearningPhase.findOneAndUpdate(
      { profileId: request.profileId, slug },
      { $set: patch },
      { new: true }
    ).lean();
    if (!phase) throw new HttpError(404, '阶段不存在');
    return phase;
  });

  app.post('/phases', async (request, reply) => {
    const body = parse(phaseCreateSchema, request.body);
    const phase = await LearningPhase.create({
      ...body,
      profileId: request.profileId,
      slug: `custom-phase-${Date.now()}`,
      planSlug: 'main-plan',
      knowledge: [],
      prerequisites: [],
      estimatedHours: 0,
      deliverable: '',
      acceptance: [],
      unlockCondition: '自定义阶段，无强制解锁条件。',
    });
    return reply.status(201).send(phase.toObject());
  });
}
