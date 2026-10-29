import type { FastifyInstance } from 'fastify';
import { Project, Milestone, ProjectTask } from '../models/project';
import { parse } from '../lib/http';
import {
  milestonePatchSchema,
  projectLogCreateSchema,
  projectLogPatchSchema,
  projectPatchSchema,
  projectTaskPatchSchema,
} from '../schemas';
import {
  createProjectLog,
  getProject,
  patchMilestone,
  patchProject,
  patchProjectLog,
  patchProjectTask,
} from '../services/projectService';

export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', async (request) => {
    const projects = await Project.find({ profileId: request.profileId }).lean();
    const results = [];
    for (const project of projects) {
      const [milestones, tasks] = await Promise.all([
        Milestone.find({ profileId: request.profileId, projectSlug: project.slug }).lean(),
        ProjectTask.find({ profileId: request.profileId, projectSlug: project.slug }).lean(),
      ]);
      const milestonesDone = milestones.filter((item) => item.status === 'done').length;
      results.push({
        ...project,
        stats: {
          milestonesDone,
          milestonesTotal: milestones.length,
          tasksDone: tasks.filter((item) => item.status === 'done').length,
          tasksTotal: tasks.length,
          percent: milestones.length
            ? Math.round((milestonesDone / milestones.length) * 100)
            : 0,
        },
      });
    }
    return results;
  });

  app.get('/projects/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return getProject(request.profileId, slug);
  });

  app.patch('/projects/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const patch = parse(projectPatchSchema, request.body);
    return patchProject(request.profileId, slug, patch);
  });

  app.patch('/projects/:slug/milestones/:milestoneSlug', async (request) => {
    const { milestoneSlug } = request.params as { slug: string; milestoneSlug: string };
    const patch = parse(milestonePatchSchema, request.body);
    return patchMilestone(request.profileId, milestoneSlug, patch);
  });

  app.patch('/project-tasks/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const patch = parse(projectTaskPatchSchema, request.body);
    return patchProjectTask(request.profileId, slug, patch);
  });

  app.post('/projects/:slug/logs', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = parse(projectLogCreateSchema, request.body);
    const log = await createProjectLog(request.profileId, { projectSlug: slug, ...body });
    return reply.status(201).send(log);
  });

  app.patch('/project-logs/:id', async (request) => {
    const { id } = request.params as { id: string };
    const patch = parse(projectLogPatchSchema, request.body);
    return patchProjectLog(request.profileId, id, patch);
  });
}
