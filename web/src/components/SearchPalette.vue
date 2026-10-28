<script setup lang="ts">
import { FileText, FolderKanban, Library, ListChecks, Search, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';
import type { SearchResults } from '@/types';

const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const input = ref<HTMLInputElement | null>(null);
const q = ref('');
const loading = ref(false);
const results = ref<SearchResults | null>(null);
const activeIndex = ref(0);
let timer: ReturnType<typeof setTimeout> | null = null;

interface Entry {
  title: string;
  sub: string;
  to: string;
  icon: typeof FileText;
}

const groups = computed(() => {
  const data = results.value;
  if (!data) return [] as { label: string; entries: Entry[] }[];
  return [
    {
      label: '学习任务',
      entries: data.tasks.map((item) => ({
        title: item.title,
        sub: `${item.slug} · ${item.status}`,
        to: `/tasks/${item.slug}`,
        icon: ListChecks,
      })),
    },
    {
      label: '资料',
      entries: data.resources.map((item) => ({
        title: item.title,
        sub: item.url,
        to: '/resources',
        icon: Library,
      })),
    },
    {
      label: '笔记',
      entries: data.notes.map((item) => ({
        title: item.title,
        sub: item.kind,
        to: '/notes',
        icon: FileText,
      })),
    },
    {
      label: '项目任务',
      entries: data.projectTasks.map((item) => ({
        title: item.title,
        sub: item.slug,
        to: '/project',
        icon: FolderKanban,
      })),
    },
  ].filter((group) => group.entries.length > 0);
});

const flat = computed(() => groups.value.flatMap((group) => group.entries));

watch(q, (value) => {
  activeIndex.value = 0;
  if (timer) clearTimeout(timer);
  if (value.trim().length < 2) {
    results.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  timer = setTimeout(async () => {
    try {
      results.value = await api.get<SearchResults>(`/search?q=${encodeURIComponent(value.trim())}`);
    } catch {
      results.value = null;
    } finally {
      loading.value = false;
    }
  }, 220);
});

function go(entry: Entry) {
  router.push(entry.to);
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') return emit('close');
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, Math.max(flat.value.length - 1, 0));
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  }
  if (event.key === 'Enter' && flat.value[activeIndex.value]) {
    go(flat.value[activeIndex.value]);
  }
}

onMounted(() => input.value?.focus());
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop search-backdrop" @mousedown.self="emit('close')">
      <div class="search-panel" role="dialog" aria-modal="true">
        <div class="search-input-row">
          <Search :size="17" class="faint" />
          <input
            ref="input"
            v-model="q"
            class="search-input"
            placeholder="搜索任务、资料、笔记、项目任务…"
            @keydown="onKeydown"
          />
          <button class="icon-btn search-close" type="button" aria-label="关闭搜索" @click="emit('close')">
            <X :size="15" />
          </button>
        </div>

        <div class="search-body">
          <div v-if="q.trim().length < 2" class="search-hint">
            输入至少 2 个字符开始搜索。支持任务标题、资料标题、笔记正文。
          </div>
          <div v-else-if="loading" class="search-hint"><span class="spinner" /> 搜索中…</div>
          <div v-else-if="!flat.length" class="search-hint">没有找到与「{{ q }}」相关的内容。</div>
          <div v-for="group in groups" v-else :key="group.label" class="search-group">
            <div class="search-group-label mono">{{ group.label }}</div>
            <button
              v-for="entry in group.entries"
              :key="`${group.label}-${entry.title}`"
              class="search-entry"
              :class="{ active: flat[activeIndex] === entry }"
              type="button"
              @click="go(entry)"
            >
              <component :is="entry.icon" :size="15" />
              <span class="entry-main">
                <span class="entry-title">{{ entry.title }}</span>
                <span class="entry-sub mono">{{ entry.sub }}</span>
              </span>
            </button>
          </div>
        </div>

        <div class="search-foot mono">
          <span>↑↓ 选择</span>
          <span>enter 打开</span>
          <span>esc 关闭</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.search-backdrop {
  padding-top: 12vh;
}

.search-panel {
  width: 100%;
  max-width: 640px;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  background: rgba(13, 20, 18, 0.98);
  box-shadow: var(--shadow);
  overflow: hidden;
  animation: modal-in 0.2s ease;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.search-input {
  flex: 1;
  border: 0;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 14.5px;
}

.search-input::placeholder {
  color: var(--faint);
}

.search-close {
  width: 26px;
  height: 26px;
  border: 0;
  background: transparent;
}

.search-body {
  max-height: 52vh;
  overflow-y: auto;
  padding: 8px;
}

.search-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  color: var(--faint);
  font-size: 12.5px;
  justify-content: center;
}

.search-group {
  margin-bottom: 4px;
}

.search-group-label {
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
  padding: 8px 10px 4px;
}

.search-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  color: var(--muted);
  transition: 0.12s ease;
}

.search-entry:hover,
.search-entry.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.entry-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.entry-title {
  font-size: 12.8px;
  color: var(--text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-entry:hover .entry-title,
.search-entry.active .entry-title {
  color: var(--text);
}

.entry-sub {
  font-size: 10px;
  color: var(--faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-foot {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--line);
  font-size: 9.5px;
  color: var(--faint);
  letter-spacing: 0.04em;
}
</style>
