<script setup lang="ts">
import {
  Bot,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  Library,
  ListChecks,
  Menu,
  NotebookPen,
  Route as RouteIcon,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AiPanel from '@/components/AiPanel.vue';
import SearchPalette from '@/components/SearchPalette.vue';
import ToastHost from '@/components/ToastHost.vue';
import { api } from '@/lib/api';
import { aiOpen, loadOverview, loadSettings, searchOpen, sidebarOpen, useAppState } from '@/lib/appState';

const route = useRoute();
const { overview, settings } = useAppState();
const apiOnline = ref<boolean | null>(null);

const navGroups = [
  {
    label: '学习',
    items: [
      { to: '/', label: '总览', icon: LayoutDashboard, exact: true },
      { to: '/roadmap', label: '学习路线', icon: RouteIcon },
      { to: '/tasks', label: '每日任务', icon: ListChecks, badge: 'tasks' },
      { to: '/labs', label: '实操教程', icon: FlaskConical },
    ],
  },
  {
    label: '工作区',
    items: [
      { to: '/project', label: '主项目', icon: FolderKanban },
      { to: '/resources', label: '资料库', icon: Library },
      { to: '/notes', label: '笔记与面试', icon: NotebookPen },
      { to: '/reviews', label: '复盘与验收', icon: ClipboardCheck },
    ],
  },
  {
    label: '系统',
    items: [
      { to: '/assistant', label: 'AI 助手', icon: Sparkles },
      { to: '/settings', label: '设置', icon: SettingsIcon },
    ],
  },
];

const pageTitle = computed(() => (route.meta.title as string) || '总览');
const overdueCount = computed(() => overview.value?.stats.overdueTasks ?? 0);

function navBadge(kind?: string) {
  if (kind === 'tasks' && overdueCount.value > 0) return overdueCount.value;
  return null;
}

function onKey(event: KeyboardEvent) {
  const meta = event.metaKey || event.ctrlKey;
  if (meta && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchOpen.value = true;
  }
  if (meta && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    aiOpen.value = !aiOpen.value;
  }
}

async function checkHealth() {
  try {
    await api.get<{ ok: boolean }>('/health');
    apiOnline.value = true;
  } catch {
    apiOnline.value = false;
  }
}

onMounted(() => {
  loadOverview();
  loadSettings();
  checkHealth();
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <RouterLink to="/" class="brand" @click="sidebarOpen = false">
        <div class="brand-mark">AI</div>
        <div>
          <div class="brand-name">工程师成长计划</div>
          <div class="brand-sub">agent engineer / 12w</div>
        </div>
      </RouterLink>

      <nav class="stack" style="gap: 18px">
        <div v-for="group in navGroups" :key="group.label">
          <div class="nav-group-label">{{ group.label }}</div>
          <div class="nav">
            <RouterLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
              <span
                v-if="navBadge(item.badge)"
                class="nav-count"
                :class="{ 'count-danger': overdueCount > 0 }"
              >
                {{ navBadge(item.badge) }}
              </span>
            </RouterLink>
          </div>
        </div>
      </nav>

      <div class="sidebar-foot">
        <div class="sidebar-week">
          <span>PHASE PROGRESS</span>
          <span>{{ overview?.stats.completionRate ?? 0 }}%</span>
        </div>
        <div class="progress thin">
          <span :style="{ width: `${overview?.stats.completionRate ?? 0}%` }" />
        </div>
        <div class="sidebar-status">
          <span class="dot" :class="apiOnline === false ? 'offline' : apiOnline ? 'online' : ''" />
          <span>{{ apiOnline === false ? 'API 离线' : apiOnline ? 'API 在线' : '检测中…' }}</span>
          <span style="margin-left: auto">v{{ settings?.app.version || '0.1.0' }}</span>
        </div>
      </div>
    </aside>
    <div v-if="sidebarOpen" class="sidebar-scrim" @click="sidebarOpen = false" />

    <div class="main-area">
      <header class="topbar">
        <button class="icon-btn mobile-toggle" type="button" aria-label="打开导航" @click="sidebarOpen = true">
          <Menu :size="17" />
        </button>
        <div class="topbar-crumbs">
          <span class="mono">AIROAD</span>
          <span class="sep">/</span>
          <b>{{ pageTitle }}</b>
        </div>
        <div class="topbar-spacer" />
        <button class="search-trigger" type="button" @click="searchOpen = true">
          <Search :size="14" />
          <span>搜索任务、资料、笔记</span>
          <span class="kbd">Ctrl K</span>
        </button>
        <div class="week-chip">
          <span>WEEK</span>
          <b>{{ overview?.plan.currentWeek ?? '—' }}</b>
          <span>/ {{ overview?.plan.totalWeeks ?? 12 }}</span>
        </div>
        <button class="icon-btn" type="button" title="AI 学习助手 (Ctrl J)" aria-label="AI 学习助手" @click="aiOpen = true">
          <Sparkles :size="16" />
        </button>
      </header>

      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </div>

    <SearchPalette v-if="searchOpen" @close="searchOpen = false" />
    <AiPanel />
    <ToastHost />
  </div>
</template>

<style scoped>
.nav-count.count-danger {
  color: var(--red);
  border-color: rgba(255, 133, 133, 0.3);
  background: var(--red-soft);
}
</style>
