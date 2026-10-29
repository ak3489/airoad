import mongoose, { Schema, model, models } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface AIConversationDoc {
  profileId: string;
  title: string;
  scope: 'general' | 'task' | 'phase' | 'project' | 'review';
  taskSlug: string;
  phaseSlug: string;
  projectSlug: string;
  messages: AIMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

const messageSchema = new Schema<AIMessage>(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new Schema<AIConversationDoc>(
  {
    profileId: { type: String, required: true, index: true },
    title: { type: String, default: '新的对话' },
    scope: { type: String, enum: ['general', 'task', 'phase', 'project', 'review'], default: 'general' },
    taskSlug: { type: String, default: '' },
    phaseSlug: { type: String, default: '' },
    projectSlug: { type: String, default: '' },
    messages: { type: [messageSchema], default: [] },
  },
  options
);

conversationSchema.index({ profileId: 1, updatedAt: -1 });

export const AIConversation =
  (models.AIConversation as mongoose.Model<AIConversationDoc> | undefined) ?? model<AIConversationDoc>('AIConversation', conversationSchema);

export type AIConversationModel = mongoose.Model<AIConversationDoc>;
