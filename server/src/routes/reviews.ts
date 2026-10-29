import type { FastifyInstance } from 'fastify';
import { parse, HttpError } from '../lib/http';
import { evaluationCreateSchema, reviewPatchSchema } from '../schemas';
import {
  createEvaluation,
  generateWeeklyReview,
  getReview,
  listEvaluations,
  listReviews,
  patchReview,
  phaseAcceptanceStatus,
} from '../services/reviewService';

const weekParam = (value: string) => {
  const week = Number(value);
  if (!Number.isInteger(week) || week < 1 || week > 52) throw new HttpError(400, '周次无效');
  return week;
};

export async function reviewRoutes(app: FastifyInstance) {
  app.get('/reviews', async (request) => listReviews(request.profileId));

  app.get('/reviews/:week', async (request) => {
    const { week } = request.params as { week: string };
    return getReview(request.profileId, weekParam(week));
  });

  app.post('/reviews/:week/generate', async (request) => {
    const { week } = request.params as { week: string };
    return generateWeeklyReview(request.profileId, weekParam(week));
  });

  app.patch('/reviews/:week', async (request) => {
    const { week } = request.params as { week: string };
    const patch = parse(reviewPatchSchema, request.body);
    return patchReview(request.profileId, weekParam(week), patch);
  });

  app.get('/phase-acceptance', async (request) => phaseAcceptanceStatus(request.profileId));

  app.get('/evaluations', async (request) => {
    const { target } = request.query as { target?: string };
    return listEvaluations(request.profileId, target);
  });

  app.post('/evaluations', async (request, reply) => {
    const body = parse(evaluationCreateSchema, request.body);
    const evaluation = await createEvaluation(request.profileId, body);
    return reply.status(201).send(evaluation);
  });
}
