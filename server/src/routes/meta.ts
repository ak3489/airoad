import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { LearningTask, Note, Resource } from '../models';
import { ProjectLog } from '../models/project';
import { config } from '../config';
import { globalSearch } from '../services/searchService';

export async function metaRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  }));

  app.get('/search', async (request) => {
    const { q = '' } = request.query as { q?: string };
    return globalSearch(request.profileId, q.slice(0, 120));
  });

  app.get('/settings', async (request) => {
    const [tasks, resources, notes, issues] = await Promise.all([
      LearningTask.countDocuments({ profileId: request.profileId }),
      Resource.countDocuments({ profileId: request.profileId }),
      Note.countDocuments({ profileId: request.profileId }),
      ProjectLog.countDocuments({ profileId: request.profileId, status: 'open' }),
    ]);
    return {
      storage: {
        tasks,
        resources,
        notes,
        openIssues: issues,
        mode: config.mongoUri ? 'external-mongodb' : 'embedded-mongodb',
      },
      app: {
        name: 'AI Agent 工程师成长计划',
        version: '0.1.0',
        environment: config.isProduction ? 'production' : 'development',
      },
    };
  });
}
