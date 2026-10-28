import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export const NOTE_KINDS = ['note', 'issue', 'snippet', 'summary', 'interview'] as const;

export interface NoteDoc {
  title: string;
  content: string;
  kind: (typeof NOTE_KINDS)[number];
  tags: string[];
  phaseSlug: string;
  taskSlug: string;
  resourceSlug: string;
  projectSlug: string;
  question: string;
  referenceAnswer: string;
  mastery: number;
  pinned: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const noteSchema = new Schema<NoteDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, default: '' },
    kind: { type: String, enum: NOTE_KINDS, default: 'note', index: true },
    tags: { type: [String], default: [] },
    phaseSlug: { type: String, default: '' },
    taskSlug: { type: String, default: '', index: true },
    resourceSlug: { type: String, default: '' },
    projectSlug: { type: String, default: '', index: true },
    question: { type: String, default: '' },
    referenceAnswer: { type: String, default: '' },
    mastery: { type: Number, min: 0, max: 5, default: 0 },
    pinned: { type: Boolean, default: false },
  },
  options
);

noteSchema.index({ title: 'text', content: 'text', tags: 'text', question: 'text' });

export const Note = (models.Note as mongoose.Model<NoteDoc> | undefined) ?? model<NoteDoc>('Note', noteSchema);
export type NoteModel = mongoose.Model<NoteDoc>;
