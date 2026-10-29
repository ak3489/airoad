import type { FastifyInstance } from 'fastify';
import { parse } from '../lib/http';
import {
  resourceCreateSchema,
  resourcePatchSchema,
  resourceQuerySchema,
} from '../schemas';
import {
  createResource,
  deleteResource,
  getResource,
  listResources,
  patchResource,
} from '../services/resourceService';

export async function resourceRoutes(app: FastifyInstance) {
  app.get('/resources', async (request) => {
    const query = parse(resourceQuerySchema, request.query);
    return listResources(request.profileId, query);
  });

  app.get('/resources/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return getResource(request.profileId, slug);
  });

  app.post('/resources', async (request, reply) => {
    const body = parse(resourceCreateSchema, request.body);
    const resource = await createResource(request.profileId, body);
    return reply.status(201).send(resource);
  });

  app.patch('/resources/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const patch = parse(resourcePatchSchema, request.body);
    return patchResource(request.profileId, slug, patch);
  });

  app.delete('/resources/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return deleteResource(request.profileId, slug);
  });
}
