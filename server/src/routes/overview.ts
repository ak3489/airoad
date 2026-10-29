import type { FastifyInstance } from 'fastify';
import { getOverview } from '../services/progress';

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/overview', async (request) => getOverview(request.profileId));
}
