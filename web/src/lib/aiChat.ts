import { computed, ref } from 'vue';
import { api, streamAiChat } from './api';
import { aiConfigured } from './aiConfig';
import type { ChatMessage, ConversationSummary } from '@/types';

export const messages = ref<ChatMessage[]>([]);
export const conversationId = ref('');
export const streaming = ref(false);
export const chatError = ref('');
export const contextTitle = ref('');
export const conversations = ref<ConversationSummary[]>([]);
export const conversationsLoading = ref(false);

let controller: AbortController | null = null;

export const hasMessages = computed(() => messages.value.length > 0);

export async function loadConversations() {
  conversationsLoading.value = true;
  try {
    conversations.value = await api.get<ConversationSummary[]>('/ai/conversations');
  } catch {
    conversations.value = [];
  } finally {
    conversationsLoading.value = false;
  }
}

export function resetChat() {
  stopChat();
  messages.value = [];
  conversationId.value = '';
  contextTitle.value = '';
  chatError.value = '';
}

export function stopChat() {
  controller?.abort();
  controller = null;
  streaming.value = false;
  const last = messages.value[messages.value.length - 1];
  if (last?.streaming) {
    last.streaming = false;
    if (!last.content.trim()) last.content = '已停止生成。';
  }
}

export async function sendChat(payload: Record<string, unknown>, text: string) {
  const content = text.trim();
  if (!content || streaming.value) return;
  if (!aiConfigured.value) {
    chatError.value = '请先在「设置 → 模型连接」填写 API Key（只保存在当前浏览器）。';
    return;
  }

  chatError.value = '';
  messages.value.push({ role: 'user', content, createdAt: new Date().toISOString() });
  messages.value.push({ role: 'assistant', content: '', streaming: true });
  const assistant = messages.value[messages.value.length - 1];

  streaming.value = true;
  controller = new AbortController();

  try {
    await streamAiChat(
      {
        ...payload,
        conversationId: conversationId.value || undefined,
        message: content,
      },
      {
        onMeta: (meta) => {
          conversationId.value = meta.conversationId;
          contextTitle.value = meta.contextTitle;
        },
        onDelta: (delta) => {
          assistant.content += delta;
        },
        onError: (message) => {
          assistant.error = true;
          assistant.content = message;
          chatError.value = message;
        },
      },
      controller.signal
    );
    if (!assistant.content.trim()) {
      assistant.error = true;
      assistant.content = '模型没有返回内容，请检查服务端日志或稍后重试。';
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      assistant.content = assistant.content || '已停止生成。';
    } else {
      const message = error instanceof Error ? error.message : 'AI 调用失败';
      assistant.error = true;
      assistant.content = message;
      chatError.value = message;
    }
  } finally {
    assistant.streaming = false;
    streaming.value = false;
    controller = null;
    await loadConversations();
  }
}

export async function openConversation(id: string) {
  try {
    const data = await api.get<{
      id: string;
      messages: { role: string; content: string; createdAt: string | null }[];
    }>(`/ai/conversations/${id}`);
    resetChat();
    conversationId.value = data.id;
    messages.value = data.messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
        createdAt: message.createdAt,
      }));
  } catch (error) {
    chatError.value = error instanceof Error ? error.message : '对话加载失败';
  }
}

export async function deleteConversation(id: string) {
  await api.del(`/ai/conversations/${id}`);
  if (conversationId.value === id) resetChat();
  await loadConversations();
}
