<script setup lang="ts">
import { ArrowUp, Bot, Cpu, RotateCcw, Square } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import MarkdownView from '@/components/MarkdownView.vue';
import { chatError, contextTitle, messages, resetChat, sendChat, stopChat, streaming } from '@/lib/aiChat';
import { aiConfigured } from '@/lib/aiConfig';

const props = defineProps<{
  payload: Record<string, unknown>;
  scopeLabel: string;
  suggestions?: string[];
}>();
const draft = ref('');
const scrollArea = ref<HTMLElement | null>(null);

const defaults = [
  '根据我现在的进度，今天最值得做什么？',
  '帮我找出当前学习计划里的风险',
  '给我一份 30 分钟的高效学习安排',
];

function send(text?: string) {
  const content = text ?? draft.value;
  if (!content.trim() || streaming.value) return;
  draft.value = '';
  sendChat(props.payload, content);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
  }
);

watch(
  () => messages.value[messages.value.length - 1]?.content,
  async () => {
    await nextTick();
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
  }
);
</script>

<template>
  <div class="ai-chat">
    <div v-if="!aiConfigured" class="ai-offline">
      <Cpu :size="15" />
      <span>尚未配置模型 API。基础学习、任务与资料库不受影响。</span>
      <RouterLink to="/settings" class="btn-link">去配置 →</RouterLink>
    </div>

    <div ref="scrollArea" class="ai-messages">
      <div v-if="!messages.length" class="ai-welcome">
        <div class="ai-orb"><Bot :size="20" /></div>
        <div class="ai-welcome-title">AI 学习助手</div>
        <p class="ai-welcome-sub">
          当前上下文：{{ scopeLabel }}
          <template v-if="contextTitle"> · {{ contextTitle }}</template>
        </p>
        <div class="ai-suggestions">
          <button
            v-for="item in suggestions?.length ? suggestions : defaults"
            :key="item"
            class="suggestion"
            type="button"
            :disabled="!aiConfigured"
            @click="send(item)"
          >
            {{ item }}
          </button>
        </div>
        <p class="ai-note">
          助手只读取当前授权上下文，不会自动认定你已掌握某项技能。代码与高危操作仍需你确认后执行。
        </p>
      </div>

      <div v-for="(message, index) in messages" :key="index" class="ai-message" :class="message.role">
        <div v-if="message.role === 'assistant'" class="msg-avatar"><Bot :size="14" /></div>
        <div class="msg-body">
          <div v-if="message.role === 'user'" class="msg-user-text">{{ message.content }}</div>
          <template v-else>
            <MarkdownView v-if="message.content" :source="message.content" />
            <div v-else class="typing"><span /><span /><span /></div>
            <span v-if="message.streaming" class="cursor" />
          </template>
        </div>
      </div>

      <div v-if="chatError" class="ai-error">{{ chatError }}</div>
    </div>

    <div class="ai-composer">
      <div class="composer-context mono">
        <span class="dot online" />
        {{ scopeLabel }}
        <span v-if="streaming" class="composer-state">生成中…</span>
      </div>
      <textarea
        v-model="draft"
        class="ai-input"
        rows="2"
        placeholder="描述你的问题。Enter 发送，Shift+Enter 换行。"
        :disabled="!aiConfigured"
        @keydown="onKeydown"
      />
      <div class="composer-actions">
        <span class="composer-hint">AI 可能出错，请用运行结果验证。</span>
        <button
          v-if="streaming"
          class="btn btn-sm btn-danger"
          type="button"
          @click="stopChat"
        >
          <Square :size="12" /> 停止
        </button>
        <button
          v-else
          class="btn btn-sm btn-primary"
          type="button"
          :disabled="!draft.trim() || !aiConfigured"
          @click="send()"
        >
          <ArrowUp :size="14" /> 发送
        </button>
        <button
          v-if="messages.length"
          class="icon-btn reset-btn"
          type="button"
          title="清空当前对话"
          @click="resetChat"
        >
          <RotateCcw :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ai-offline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 14px 0;
  padding: 8px 11px;
  border: 1px solid rgba(240, 198, 116, 0.28);
  border-radius: 8px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 11.5px;
}

.ai-offline span {
  flex: 1;
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px 8px;
  min-height: 0;
}

.ai-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 6px;
}

.ai-orb {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin-bottom: 12px;
  border-radius: 50%;
  border: 1px solid rgba(110, 231, 168, 0.3);
  background: radial-gradient(circle at 30% 25%, rgba(110, 231, 168, 0.28), rgba(110, 231, 168, 0.04));
  color: var(--accent);
  box-shadow: 0 0 30px rgba(110, 231, 168, 0.12);
}

.ai-welcome-title {
  font-size: 15px;
  font-weight: 600;
}

.ai-welcome-sub {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--faint);
  font-family: var(--mono);
}

.ai-suggestions {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
  max-width: 420px;
  margin-top: 18px;
}

.suggestion {
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: 0.15s ease;
}

.suggestion:hover:not(:disabled) {
  border-color: rgba(110, 231, 168, 0.3);
  background: var(--accent-soft);
  color: var(--text);
}

.suggestion:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ai-note {
  margin-top: 16px;
  max-width: 360px;
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.6;
}

.ai-message {
  display: flex;
  gap: 9px;
  margin-bottom: 16px;
}

.ai-message.user {
  justify-content: flex-end;
}

.msg-avatar {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--accent);
  flex-shrink: 0;
}

.msg-body {
  min-width: 0;
  max-width: 92%;
}

.ai-message.user .msg-body {
  max-width: 85%;
}

.msg-user-text {
  padding: 8px 12px;
  border-radius: 10px 10px 3px 10px;
  background: var(--accent-soft);
  border: 1px solid rgba(110, 231, 168, 0.16);
  color: var(--text);
  font-size: 12.8px;
  white-space: pre-wrap;
}

.ai-message.assistant .markdown {
  font-size: 12.8px;
  padding-top: 2px;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: bounce 1.1s infinite ease-in-out;
}

.typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes bounce {
  0%,
  70%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  35% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

.cursor {
  display: inline-block;
  width: 6px;
  height: 13px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--accent);
  animation: blink 1s steps(2) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.ai-error {
  margin: 8px 0;
  padding: 8px 11px;
  border: 1px solid rgba(255, 133, 133, 0.3);
  border-radius: 8px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 11.5px;
}

.ai-composer {
  border-top: 1px solid var(--line);
  padding: 10px 14px 12px;
  background: rgba(7, 11, 10, 0.5);
}

.composer-context {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--faint);
  margin-bottom: 7px;
}

.composer-state {
  margin-left: auto;
  color: var(--accent);
}

.ai-input {
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  padding: 9px 11px;
  font-size: 12.8px;
  line-height: 1.55;
  resize: none;
  outline: none;
  transition: border-color 0.15s ease;
}

.ai-input:focus {
  border-color: rgba(110, 231, 168, 0.45);
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.composer-hint {
  flex: 1;
  font-size: 9.5px;
  color: var(--faint);
}

.reset-btn {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
}
</style>
