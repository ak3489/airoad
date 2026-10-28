<script setup lang="ts">
import { Bot, MessageSquare, Plus, ShieldCheck, Trash2 } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import AiChat from '@/components/AiChat.vue';
import { api } from '@/lib/api';
import { MAIN_PROJECT_NAME, MAIN_PROJECT_SLUG } from '@/lib/constants';
import {
  conversationId,
  conversations,
  conversationsLoading,
  deleteConversation,
  loadConversations,
  messages,
  openConversation,
  resetChat,
} from '@/lib/aiChat';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/toast';
import type { PlanResponse, TaskSummary } from '@/types';

type Scope = 'general' | 'task' | 'phase' | 'project' | 'review';

const scope = ref<Scope>('general');
const taskSlug = ref('');
const phaseSlug = ref('');
const week = ref(1);
const tasks = ref<TaskSummary[]>([]);
const plan = ref<PlanResponse | null>(null);

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'general', label: '全局' },
  { value: 'task', label: '任务' },
  { value: 'phase', label: '阶段' },
  { value: 'project', label: '项目' },
  { value: 'review', label: '复盘' },
];

const SCOPE_LABEL: Record<string, string> = {
  general: '全局',
  task: '任务',
  phase: '阶段',
  project: '项目',
  review: '复盘',
};

const payload = computed<Record<string, unknown>>(() => {
  if (scope.value === 'task' && taskSlug.value) return { scope: 'task', taskSlug: taskSlug.value };
  if (scope.value === 'phase' && phaseSlug.value) return { scope: 'phase', phaseSlug: phaseSlug.value };
  if (scope.value === 'project') return { scope: 'project', projectSlug: MAIN_PROJECT_SLUG };
  if (scope.value === 'review') return { scope: 'review', week: Number(week.value) };
  return { scope: 'general' };
});

const scopeLabel = computed(() => {
  if (scope.value === 'task') {
    const task = tasks.value.find((item) => item.slug === taskSlug.value);
    return task ? `任务 · ${task.title}` : '任务上下文';
  }
  if (scope.value === 'phase') {
    const phase = plan.value?.phases.find((item) => item.slug === phaseSlug.value);
    return phase ? `阶段 · ${phase.shortTitle}` : '阶段上下文';
  }
  if (scope.value === 'project') return `项目 · ${MAIN_PROJECT_NAME}`;
  if (scope.value === 'review') return `复盘 · 第 ${week.value} 周`;
  return '全局学习上下文';
});

const suggestions = computed(() => {
  if (scope.value === 'task') {
    return [
      '解释这个任务的目标和验收标准',
      '这一步我卡住了，给提示但不要直接给答案',
      '帮我分析这段报错，先向我索取证据',
      '出 3 道自测题验证我是否真的理解',
    ];
  }
  if (scope.value === 'project') {
    return [
      '检查项目还有哪些技术风险',
      '帮我排序下一个里程碑的任务',
      '这个 Agent 的信任边界是否完整？',
      '怎样证明危险操作一定需要人工确认？',
    ];
  }
  if (scope.value === 'review') {
    return [
      '根据本周记录，帮我找出真实进展与缺口',
      '我的复盘缺少哪些可验证的证据？',
      '为下周制定可执行的 5 天计划',
    ];
  }
  return [
    '根据我现在的进度，今天最值得做什么？',
    '帮我找出当前学习计划里的风险',
    '给我一份 30 分钟的高效学习安排',
  ];
});

async function load() {
  try {
    const [planData, taskList] = await Promise.all([
      api.get<PlanResponse>('/plan'),
      api.get<TaskSummary[]>('/tasks'),
    ]);
    plan.value = planData;
    tasks.value = taskList;
    week.value = planData.plan.currentWeek;
    const active = planData.phases.find((item) => item.progress?.status === 'active') ?? planData.phases[0];
    phaseSlug.value = active?.slug ?? '';
    const nextTask = taskList.find((item) => item.status !== 'done');
    taskSlug.value = nextTask?.slug ?? taskList[0]?.slug ?? '';
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '上下文加载失败');
  }
  await loadConversations();
}

function newChat() {
  resetChat();
  notify('info', '已开始新对话');
}

async function open(id: string) {
  await openConversation(id);
}

async function remove(id: string, event: Event) {
  event.stopPropagation();
  if (!window.confirm('确定删除这条对话记录？')) return;
  try {
    await deleteConversation(id);
    notify('success', '对话已删除');
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '删除失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="page assistant-page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">ASSISTANT</span><span class="dot online" />只读取授权上下文</div>
        <h1 class="page-title">AI 学习助手</h1>
        <p class="page-sub">用来解释、引导、分析日志和出题，不代替你运行代码，也不会自动判定你已掌握。</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" @click="newChat"><Plus :size="15" /> 新对话</button>
      </div>
    </div>

    <div class="assistant-shell">
      <aside class="conv-sidebar">
        <div class="conv-head">
          <MessageSquare :size="13" />
          <span>对话记录</span>
          <span class="mono text-xs faint">{{ conversations.length }}</span>
        </div>
        <div class="conv-list">
          <div v-if="conversationsLoading && !conversations.length" class="conv-loading">
            <span class="spinner" /> 加载中…
          </div>
          <button
            v-for="item in conversations"
            :key="item.id"
            class="conv-row"
            :class="{ active: item.id === conversationId }"
            type="button"
            @click="open(item.id)"
          >
            <div class="conv-body">
              <div class="conv-title">{{ item.title }}</div>
              <div class="conv-meta mono">
                <span>{{ SCOPE_LABEL[item.scope] || item.scope }}</span>
                <span>{{ item.messageCount }} 条</span>
                <span>{{ formatDateTime(item.updatedAt) }}</span>
              </div>
            </div>
            <button class="conv-del" type="button" title="删除对话" @click="remove(item.id, $event)">
              <Trash2 :size="12" />
            </button>
          </button>
          <p v-if="!conversationsLoading && !conversations.length" class="conv-empty">
            还没有对话。发送第一条消息后会出现在这里。
          </p>
        </div>
        <div class="conv-foot">
          <ShieldCheck :size="12" />
          <span>不会发送 API Key；上下文仅限当前选择的任务、阶段、项目或复盘。</span>
        </div>
      </aside>

      <section class="assistant-main">
        <div class="context-bar">
          <div class="context-scopes">
            <button
              v-for="item in SCOPES"
              :key="item.value"
              type="button"
              :class="{ active: scope === item.value }"
              @click="scope = item.value"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="context-detail">
            <select v-if="scope === 'task'" v-model="taskSlug" class="select context-select-wide">
              <option value="" disabled>选择任务</option>
              <option v-for="task in tasks" :key="task.slug" :value="task.slug">
                W{{ task.week }} · {{ task.title }}
              </option>
            </select>
            <select v-else-if="scope === 'phase'" v-model="phaseSlug" class="select context-select">
              <option value="" disabled>选择阶段</option>
              <option v-for="phase in plan?.phases ?? []" :key="phase.slug" :value="phase.slug">
                {{ phase.shortTitle }}
              </option>
            </select>
            <template v-else-if="scope === 'review'">
              <span class="mono text-xs faint">周次</span>
              <input v-model.number="week" class="input context-week" type="number" min="1" :max="plan?.plan.totalWeeks ?? 12" />
            </template>
            <span v-else-if="scope === 'project'" class="mono text-xs faint">{{ MAIN_PROJECT_NAME }}</span>
            <span v-else class="mono text-xs faint">整个学习计划</span>
          </div>

          <span class="context-note">{{ messages.length ? '切换上下文仅影响后续提问' : '选择上下文后开始' }}</span>
        </div>

        <div class="assistant-chat">
          <AiChat :payload="payload" :scope-label="scopeLabel" :suggestions="suggestions" />
        </div>
      </section>
    </div>

    <div class="assistant-foot">
      <div><Bot :size="12" /> 模型未配置时，任务、资料库、项目与复盘仍然完全可用。</div>
      <div>AI 输出可能出错，请用运行结果、测试与代码验证后再接受结论。</div>
    </div>
  </div>
</template>

<style scoped>
.assistant-page {
  display: flex;
  flex-direction: column;
}

.assistant-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  height: calc(100vh - var(--topbar-height) - 168px);
  min-height: 480px;
  border: 1px solid var(--line);
  border-radius: 13px;
  overflow: hidden;
  background: var(--surface);
}

.conv-sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: rgba(10, 16, 14, 0.6);
  min-height: 0;
}

.conv-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 13px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
}

.conv-head span:nth-child(2) {
  flex: 1;
}

.conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.conv-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  font-size: 11px;
  color: var(--faint);
}

.conv-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: 0.14s ease;
}

.conv-row:hover {
  background: var(--surface-2);
}

.conv-row.active {
  border-color: rgba(110, 231, 168, 0.25);
  background: var(--accent-soft);
}

.conv-body {
  flex: 1;
  min-width: 0;
}

.conv-title {
  font-size: 11.8px;
  color: var(--text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-meta {
  display: flex;
  gap: 7px;
  margin-top: 2px;
  font-size: 9px;
  color: var(--faint);
}

.conv-del {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--faint);
  opacity: 0;
  cursor: pointer;
  transition: 0.14s ease;
}

.conv-row:hover .conv-del {
  opacity: 1;
}

.conv-del:hover {
  color: var(--red);
  background: var(--red-soft);
}

.conv-empty {
  padding: 18px 10px;
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.55;
  text-align: center;
}

.conv-foot {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 10px 13px;
  border-top: 1px solid var(--line);
  font-size: 9.5px;
  color: var(--faint);
  line-height: 1.5;
}

.conv-foot svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent);
}

.assistant-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.context-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(7, 11, 10, 0.4);
}

.context-scopes {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-soft);
}

.context-scopes button {
  padding: 3px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--faint);
  font-size: 10px;
  cursor: pointer;
  transition: 0.14s ease;
}

.context-scopes button:hover {
  color: var(--text-soft);
}

.context-scopes button.active {
  background: var(--surface-3);
  color: var(--accent);
}

.context-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.context-select {
  height: 26px;
  padding: 0 7px;
  font-size: 10.5px;
  width: 130px;
}

.context-select-wide {
  height: 26px;
  padding: 0 7px;
  font-size: 10.5px;
  width: min(340px, 100%);
}

.context-week {
  height: 26px;
  width: 64px;
  padding: 0 7px;
  font-size: 10.5px;
}

.context-note {
  font-size: 9.5px;
  color: var(--faint);
  font-family: var(--mono);
}

.assistant-chat {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.assistant-foot {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 9px 2px 0;
  font-size: 10px;
  color: var(--faint);
}

.assistant-foot div {
  display: flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 900px) {
  .assistant-shell {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
  }
  .conv-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--line);
    max-height: 190px;
  }
  .assistant-main {
    height: 62vh;
    min-height: 460px;
  }
  .context-note {
    display: none;
  }
}
</style>
