import { LearningTask, Note, Resource } from '../models';
import { ProjectTask } from '../models/project';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function globalSearch(profileId: string, query: string) {
  const q = query.trim();
  if (q.length < 2) return { query: q, tasks: [], resources: [], notes: [], projectTasks: [] };
  const regex = new RegExp(escapeRegex(q), 'i');

  const [tasks, resources, notes, projectTasks] = await Promise.all([
    LearningTask.find({ profileId, $or: [{ title: regex }, { objective: regex }, { tags: regex }] })
      .select({ slug: 1, title: 1, week: 1, status: 1, phaseSlug: 1, estimatedMinutes: 1 })
      .limit(6)
      .lean(),
    Resource.find({
      profileId,
      $or: [{ title: regex }, { topic: regex }, { tags: regex }, { keyPoints: regex }],
    })
      .select({ slug: 1, title: 1, url: 1, kind: 1, status: 1, topic: 1 })
      .limit(5)
      .lean(),
    Note.find({
      profileId,
      $or: [{ title: regex }, { content: regex }, { question: regex }, { tags: regex }],
    })
      .select({ _id: 1, title: 1, kind: 1, taskSlug: 1, updatedAt: 1 })
      .limit(5)
      .lean(),
    ProjectTask.find({
      profileId,
      $or: [{ title: regex }, { description: regex }, { tags: regex }],
    })
      .select({ slug: 1, title: 1, status: 1, milestoneSlug: 1 })
      .limit(4)
      .lean(),
  ]);

  return {
    query: q,
    tasks,
    resources,
    notes: notes.map((note) => ({ ...note, id: String(note._id) })),
    projectTasks,
  };
}
