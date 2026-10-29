import type { FastifyInstance } from 'fastify';
import { parse } from '../lib/http';
import { profileOpenSchema } from '../schemas';
import { createProfile, getProfileInfo, openProfile } from '../services/profileService';

export async function profileRoutes(app: FastifyInstance) {
  app.post('/profile', async (request, reply) => {
    const body = parse(profileOpenSchema, request.body ?? {});
    if (body.code) return openProfile(body.code);
    return reply.status(201).send(await createProfile());
  });

  app.get('/profile', async (request) => getProfileInfo(request.profileId));
}
