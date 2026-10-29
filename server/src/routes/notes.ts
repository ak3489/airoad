import type { FastifyInstance } from 'fastify';
import { parse } from '../lib/http';
import { noteCreateSchema, notePatchSchema, noteQuerySchema } from '../schemas';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  patchNote,
} from '../services/noteService';

export async function noteRoutes(app: FastifyInstance) {
  app.get('/notes', async (request) => {
    const query = parse(noteQuerySchema, request.query);
    return listNotes(request.profileId, query);
  });

  app.get('/notes/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getNote(request.profileId, id);
  });

  app.post('/notes', async (request, reply) => {
    const body = parse(noteCreateSchema, request.body);
    const note = await createNote(request.profileId, body);
    return reply.status(201).send(note);
  });

  app.patch('/notes/:id', async (request) => {
    const { id } = request.params as { id: string };
    const patch = parse(notePatchSchema, request.body);
    return patchNote(request.profileId, id, patch);
  });

  app.delete('/notes/:id', async (request) => {
    const { id } = request.params as { id: string };
    return deleteNote(request.profileId, id);
  });
}
