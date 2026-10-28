<script setup lang="ts">
import { Bot, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AiChat from '@/components/AiChat.vue';
import { aiOpen, useAppState } from '@/lib/appState';
import { aiConfig, aiConfigured } from '@/lib/aiConfig';
import { MAIN_PROJECT_NAME, MAIN_PROJECT_SLUG } from '@/lib/constants';

const route = useRoute();
const { overview } = useAppState();

const payload = computed<Record<string, unknown>>(() => {
  if (route.name === 'task-detail' && route.params.slug) {
    return { scope: 'task', taskSlug: String(route.params.slug) };
  }
  if (route.name === 'project') {
    return { scope: 'project', projectSlug: MAIN_PROJECT_SLUG };
  }
  if (route.name === 'reviews') {
    return { scope: 'review', week: overview.value?.plan.currentWeek ?? 1 };
  }
  return { scope: 'general' };
});

const label = computed(() => {
  if (payload.value.scope === 'task') return '当前任务';
  if (payload.value.scope === 'project') return MAIN_PROJECT_NAME;
  if (payload.value.scope === 'review') return `第 ${payload.value.week} 周复盘`;
  return '全局学习上下文';
});

const suggestions = computed(() => {
  if (payload.value.scope === 'task') {
    return [
      '解释这个任务的目标和验收标准',
      '这一步我卡住了，给我提示而不是直接给答案',
      '帮我分析这段报错，先问我要证据',
      '出 3 道自测题验证我是否真的理解',
    ];
  }
  if (payload.value.scope === 'project') {
    return [
      '检查项目里还有哪些技术风险',
      '帮我排下一个里程碑的任务顺序',
      '这个 Agent 的信任边界设计是否完整？',
    ];
  }
  return undefined;
});

function close() {
  aiOpen.value = false;
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && aiOpen.value) close();
}

onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div v-if="aiOpen" class="ai-scrim" @mousedown.self="close">
      <aside class="ai-drawer" role="dialog" aria-modal="true" aria-label="AI 学习助手">
        <header class="ai-drawer-head">
          <div class="flex gap-10">
            <div class="drawer-icon"><Bot :size="17" /></div>
            <div>
              <div class="drawer-title">AI 学习助手</div>
              <div class="drawer-sub mono">
                {{ aiConfig.model }} ·
                {{ aiConfigured ? '本地已配置' : '未配置' }}
              </div>
            </div>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭助手" @click="close">
            <X :size="16" />
          </button>
        </header>

        <div class="ai-drawer-body">
          <AiChat :payload="payload" :scope-label="label" :suggestions="suggestions" />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.ai-scrim {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(2, 5, 4, 0.55);
  backdrop-filter: blur(3px);
  animation: fade-in 0.15s ease;
}

.ai-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(430px, 100vw);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--line-strong);
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.45);
  animation: slide-in 0.22s ease;
}

@keyframes slide-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
}

.ai-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}

.drawer-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid rgba(110, 231, 168, 0.3);
  background: var(--accent-soft);
  color: var(--accent);
}

.drawer-title {
  font-size: 13.5px;
  font-weight: 600;
}

.drawer-sub {
  font-size: 10px;
  color: var(--faint);
}

.ai-drawer-body {
  flex: 1;
  min-height: 0;
}
</style>
