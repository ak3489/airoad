import mongoose from 'mongoose';
import { Note } from '../models';
import { notFound } from '../lib/http';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ensureId(id: string) {
  if (!mongoose.isValidObjectId(id)) notFound('笔记不存在');
}

export async function listNotes(query: {
  q?: string;
  kind?: string;
  task?: string;
  project?: string;
  tag?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.kind) filter.kind = query.kind;
  if (query.task) filter.taskSlug = query.task;
  if (query.project) filter.projectSlug = query.project;
  if (query.tag) filter.tags = query.tag;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: regex }, { content: regex }, { question: regex }, { tags: regex }];
  }
  const notes = await Note.find(filter).sort({ pinned: -1, updatedAt: -1 }).limit(300).lean();
  return notes.map((note) => ({
    ...note,
    createdAt: note.createdAt?.toISOString() ?? null,
    updatedAt: note.updatedAt?.toISOString() ?? null,
  }));
}

export async function getNote(id: string) {
  ensureId(id);
  const note = await Note.findById(id).lean();
  if (!note) notFound('笔记不存在');
  return note;
}

export async function createNote(input: Record<string, unknown>) {
  const note = await Note.create(input);
  return note.toObject();
}

export async function patchNote(id: string, patch: Record<string, unknown>) {
  ensureId(id);
  const note = await Note.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  if (!note) notFound('笔记不存在');
  return note;
}

export async function deleteNote(id: string) {
  ensureId(id);
  const note = await Note.findByIdAndDelete(id);
  if (!note) notFound('笔记不存在');
  return { deleted: true };
}
