import { LearningTask, Resource } from '../models';
import { notFound } from '../lib/http';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listResources(
  profileId: string,
  query: {
    q?: string;
    phase?: string;
    status?: string;
    kind?: string;
    favorite?: string;
    task?: string;
  }
) {
  const filter: Record<string, unknown> = { profileId };
  if (query.phase) filter.phaseSlug = query.phase;
  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;
  if (query.favorite === 'true') filter.favorite = true;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: regex }, { topic: regex }, { tags: regex }, { keyPoints: regex }];
  }
  if (query.task) {
    filter.slug = {
      $in: (await LearningTask.findOne({ profileId, slug: query.task }).lean())?.resourceSlugs ?? [],
    };
  }

  const resources = await Resource.find(filter).sort({ importance: -1, order: 1, title: 1 }).lean();
  const taskLinks = await LearningTask.find({
    profileId,
    resourceSlugs: { $in: resources.map((item) => item.slug) },
  })
    .select({ slug: 1, title: 1, status: 1, resourceSlugs: 1 })
    .lean();

  return resources.map((resource) => ({
    ...resource,
    lastVerifiedAt: resource.lastVerifiedAt?.toISOString() ?? null,
    linkedTasks: taskLinks
      .filter((task) => task.resourceSlugs.includes(resource.slug))
      .map((task) => ({ slug: task.slug, title: task.title, status: task.status })),
  }));
}

export async function getResource(profileId: string, slug: string) {
  const resource = await Resource.findOne({ profileId, slug }).lean();
  if (!resource) notFound('资料不存在');
  const tasks = await LearningTask.find({ profileId, resourceSlugs: slug })
    .select({ slug: 1, title: 1, status: 1, phaseSlug: 1 })
    .lean();
  return {
    resource: {
      ...resource,
      lastVerifiedAt: resource.lastVerifiedAt?.toISOString() ?? null,
    },
    linkedTasks: tasks,
  };
}

export async function createResource(profileId: string, input: Record<string, unknown>) {
  const resource = await Resource.create({
    ...input,
    profileId,
    slug: `custom-${Date.now()}`,
    order: 99,
    status: 'unread',
    notes: '',
    favorite: false,
    lastVerifiedAt: null,
  });
  return resource.toObject();
}

export async function patchResource(
  profileId: string,
  slug: string,
  patch: Record<string, unknown>
) {
  const resource = await Resource.findOneAndUpdate(
    { profileId, slug },
    { $set: patch },
    { new: true }
  ).lean();
  if (!resource) notFound('资料不存在');
  return resource;
}

export async function deleteResource(profileId: string, slug: string) {
  const resource = await Resource.findOneAndDelete({ profileId, slug });
  if (!resource) notFound('资料不存在');
  await LearningTask.updateMany(
    { profileId, resourceSlugs: slug },
    { $pull: { resourceSlugs: slug } }
  );
  return { deleted: true };
}
