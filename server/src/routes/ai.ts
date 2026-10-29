import type { FastifyInstance, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { AIConversation } from '../models/conversation';
import { HttpError, notFound, parse } from '../lib/http';
import { aiChatSchema } from '../schemas';
import { chatOnce, readAIConfig, streamChat, type AIMessageInput } from '../services/aiProvider';
import { buildAIContext } from '../services/aiContext';

function sseStart(reply: FastifyReply) {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}
function sseSend(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function aiRoutes(app: FastifyInstance) {
  app.post('/ai/test', async (request) => {
    const ai = readAIConfig(request.headers);
    const started = Date.now();
    const content = await chatOnce(
      ai,
      [
        { role: 'system', content: '你是一个连通性测试助手。' },
        { role: 'user', content: '只回复两个字母：OK' },
      ],
      20
    );
    return { ok: true, latencyMs: Date.now() - started, model: ai.model, reply: content.slice(0, 80) };
  });

  app.post('/ai/chat', async (request, reply) => {
    const ai = readAIConfig(request.headers);

    const body = parse(aiChatSchema, request.body);
    if (body.scope === 'task' && !body.taskSlug) throw new HttpError(400, '任务助手需要 taskSlug');
    if (body.scope === 'phase' && !body.phaseSlug) throw new HttpError(400, '阶段助手需要 phaseSlug');

    let conversation;
    if (body.conversationId) {
      if (!mongoose.isValidObjectId(body.conversationId)) {
        throw new HttpError(400, 'conversationId 无效');
      }
      conversation = await AIConversation.findOne({
        _id: body.conversationId,
        profileId: request.profileId,
      });
      if (!conversation) notFound('对话不存在');
    } else {
      conversation = await AIConversation.create({
        profileId: request.profileId,
        title: body.message.replace(/\s+/g, ' ').slice(0, 30) || '新的对话',
        scope: body.scope,
        taskSlug: body.taskSlug ?? '',
        phaseSlug: body.phaseSlug ?? '',
        projectSlug: body.projectSlug ?? '',
        messages: [],
      });
    }

    const context = await buildAIContext(request.profileId, {
      scope: body.scope,
      taskSlug: body.taskSlug,
      phaseSlug: body.phaseSlug,
      projectSlug: body.projectSlug,
      week: body.week,
    });

    const history = conversation.messages.slice(-10).map<AIMessageInput>((message) => ({
      role: message.role === 'system' ? 'assistant' : message.role,
      content: message.content.slice(0, 4000),
    }));

    const messages: AIMessageInput[] = [
      {
        role: 'system',
        content: `${context.system}\n\n<learning_context>\n${context.context}\n</learning_context>`,
      },
      ...history,
      { role: 'user', content: body.message },
    ];

    conversation.messages.push({ role: 'user', content: body.message, createdAt: new Date() });
    if (conversation.title === '新的对话') {
      conversation.title = body.message.replace(/\s+/g, ' ').slice(0, 30);
    }
    await conversation.save();

    const conversationId = String(conversation._id);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded) controller.abort();
    });

    sseStart(reply);
    sseSend(reply, 'meta', { conversationId, title: conversation.title, contextTitle: context.title });

    let answer = '';
    try {
      for await (const delta of streamChat(ai, messages, controller.signal)) {
        answer += delta;
        sseSend(reply, 'delta', { text: delta });
      }
      if (!answer.trim()) throw new Error('模型没有返回内容');
      conversation.messages.push({ role: 'assistant', content: answer, createdAt: new Date() });
      await conversation.save();
      sseSend(reply, 'done', { conversationId, length: answer.length });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : '模型调用失败或被中断';
      sseSend(reply, 'error', { message, detail: error instanceof HttpError ? error.details : undefined });
    } finally {
      clearTimeout(timeout);
      reply.raw.end();
    }
  });

  app.get('/ai/conversations', async (request) => {
    const conversations = await AIConversation.find({ profileId: request.profileId })
      .select({ title: 1, scope: 1, taskSlug: 1, projectSlug: 1, updatedAt: 1, messages: 1 })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return conversations.map((conversation) => ({
      id: String(conversation._id),
      title: conversation.title,
      scope: conversation.scope,
      taskSlug: conversation.taskSlug,
      projectSlug: conversation.projectSlug,
      updatedAt: conversation.updatedAt?.toISOString() ?? null,
      messageCount: conversation.messages.length,
    }));
  });

  app.get('/ai/conversations/:id', async (request) => {
    const { id } = request.params as { id: string };
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, '对话 ID 无效');
    const conversation = await AIConversation.findOne({ _id: id, profileId: request.profileId }).lean();
    if (!conversation) notFound('对话不存在');
    return {
      ...conversation,
      id: String(conversation._id),
      messages: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt?.toISOString() ?? null,
      })),
    };
  });

  app.delete('/ai/conversations/:id', async (request) => {
    const { id } = request.params as { id: string };
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, '对话 ID 无效');
    await AIConversation.findOneAndDelete({ _id: id, profileId: request.profileId });
    return { deleted: true };
  });
}
