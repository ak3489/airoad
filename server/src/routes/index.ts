import type { FastifyInstance } from 'fastify';
import { aiRoutes } from './ai';
import { exportRoutes } from './export';
import { metaRoutes } from './meta';
import { noteRoutes } from './notes';
import { overviewRoutes } from './overview';
import { planRoutes } from './plan';
import { projectRoutes } from './projects';
import { resourceRoutes } from './resources';
import { reviewRoutes } from './reviews';
import { taskRoutes } from './tasks';

export async function apiRoutes(app: FastifyInstance) {
  await app.register(metaRoutes);
  await app.register(overviewRoutes);
  await app.register(taskRoutes);
  await app.register(planRoutes);
  await app.register(resourceRoutes);
  await app.register(noteRoutes);
  await app.register(projectRoutes);
  await app.register(reviewRoutes);
  await app.register(aiRoutes);
  await app.register(exportRoutes);
}
