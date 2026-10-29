import type { FastifyInstance } from 'fastify';
import { parse } from '../lib/http';
import {
  createTaskSchema,
  recordSchema,
  splitSchema,
  stepPatchSchema,
  taskListQuerySchema,
  taskPatchSchema,
  taskStatusSchema,
  transitionSchema,
} from '../schemas';
import {
  addRecord,
  createTask,
  deleteCustomTask,
  getTaskDetail,
  listTasks,
  patchTask,
  splitTask,
  transitionTask,
  updateStep,
} from '../services/taskService';
import { LearningRecord } from '../models/resource';

export async function taskRoutes(app: FastifyInstance) {
  app.get('/tasks', async (request) => {
    const query = parse(taskListQuerySchema, request.query);
    return listTasks(request.profileId, query);
  });

  app.post('/tasks', async (request, reply) => {
    const body = parse(createTaskSchema, request.body);
    const task = await createTask(request.profileId, body);
    return reply.status(201).send(task);
  });

  app.get('/tasks/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return getTaskDetail(request.profileId, slug);
  });

  app.patch('/tasks/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const patch = parse(taskPatchSchema, request.body);
    return patchTask(request.profileId, slug, patch);
  });

  app.post('/tasks/:slug/status', async (request) => {
    const { slug } = request.params as { slug: string };
    const body = parse(transitionSchema, request.body);
    return transitionTask(request.profileId, slug, body.status, body.note);
  });

  app.patch('/tasks/:slug/steps/:stepKey', async (request) => {
    const { slug, stepKey } = request.params as { slug: string; stepKey: string };
    const patch = parse(stepPatchSchema, request.body);
    const task = await updateStep(request.profileId, slug, stepKey, patch);
    return { task };
  });

  app.post('/tasks/:slug/records', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = parse(recordSchema, request.body);
    const record = await addRecord(request.profileId, { ...body, taskSlug: slug });
    return reply.status(201).send({ record });
  });

  app.post('/tasks/:slug/split', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = parse(splitSchema, request.body);
    const tasks = await splitTask(request.profileId, slug, body.parts);
    return reply.status(201).send({ tasks });
  });

  app.delete('/tasks/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return deleteCustomTask(request.profileId, slug);
  });

  app.get('/records', async (request) => {
    const records = await LearningRecord.find({ profileId: request.profileId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return records.map((record) => ({
      ...record,
      createdAt: record.createdAt?.toISOString() ?? null,
    }));
  });

  app.post('/records', async (request, reply) => {
    const body = parse(recordSchema, request.body);
    const record = await addRecord(request.profileId, body);
    return reply.status(201).send({ record });
  });

  app.get('/statuses', async () => taskStatusSchema.options);
}
