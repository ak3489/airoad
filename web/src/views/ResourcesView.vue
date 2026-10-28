<script setup lang="ts">
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  Github,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Video,
  Wrench,
} from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import ModalShell from '@/components/ModalShell.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import type { PlanResponse, Resource } from '@/types';

const resources = ref<Resource[]>([]);
const phases = ref<{ slug: string; shortTitle: string }[]>([]);
const loading = ref(true);
const error = ref('');

const q = ref('');
const kind = ref('all');
const status = ref('all');
const phase = ref('all');
const favoriteOnly = ref(false);

const addOpen = ref(false);
const addError = ref('');
const adding = ref(false);
const addForm = reactive({
  title: '',
  url: '',
  kind: 'doc',
  topic: '',
  difficulty: 'intermediate',
  phaseSlug: '',
  importance: 3,
  keyPoints: '',
  tags: '',
});

const noteTarget = ref<Resource | null>(null);
const noteDraft = ref('');
const savingNote = ref(false);

const KIND_META: Record<Resource['kind'], { label: string; icon: unknown }> = {
  doc: { label: '官方文档', icon: FileText },
  tutorial: { label: '教程', icon: BookOpen },
  video: { label: '视频', icon: Video },
  repo: { label: '代码仓库', icon: Github },
  article: { label: '文章', icon: Newspaper },
  tool: { label: '工具', icon: Wrench },
};

const DIFFICULTY_LABEL: Record<Resource['difficulty'], string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
};

const kindOptions = Object.entries(KIND_META).map(([value, meta]) => ({ value, label: meta.label }));

const filtered = computed(() => {
  const keyword = q.value.trim().toLowerCase();
  return resources.value.filter((resource) => {
    if (kind.value !== 'all' && resource.kind !== kind.value) return false;
    if (status.value !== 'all' && resource.status !== status.value) return false;
    if (phase.value !== 'all' && resource.phaseSlug !== phase.value) return false;
    if (favoriteOnly.value && !resource.favorite) return false;
    if (
      keyword &&
      !`${resource.title} ${resource.topic} ${resource.tags.join(' ')} ${resource.keyPoints.join(' ')}`
        .toLowerCase()
        .includes(keyword)
    )
      return false;
    return true;
  });
});

const stats = computed(() => ({
  total: resources.value.length,
  reading: resources.value.filter((item) => item.status === 'reading').length,
  done: resources.value.filter((item) => item.status === 'done').length,
  verified: resources.value.filter((item) => item.lastVerifiedAt).length,
  official: resources.value.filter((item) => item.official).length,
}));

function phaseTitle(slug: string) {
  return phases.value.find((item) => item.slug === slug)?.shortTitle || '';
}

function verifiedLabel(value: string | null) {
  if (!value) return '待核验';
  return `核验于 ${new Date(value).toLocaleDateString('zh-CN')}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [list, plan] = await Promise.all([
      api.get<Resource[]>('/resources'),
      api.get<PlanResponse>('/plan'),
    ]);
    resources.value = list;
    phases.value = plan.phases.map((item) => ({ slug: item.slug, shortTitle: item.shortTitle }));
    if (!addForm.phaseSlug && phases.value[0]) addForm.phaseSlug = phases.value[0].slug;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '资料库加载失败';
  } finally {
    loading.value = false;
  }
}

async function toggleFavorite(resource: Resource) {
  const next = !resource.favorite;
  resource.favorite = next;
  try {
    await api.patch(`/resources/${resource.slug}`, { favorite: next });
    notify('success', next ? '已加入收藏' : '已取消收藏');
  } catch (err) {
    resource.favorite = !next;
    notify('error', err instanceof Error ? err.message : '操作失败');
  }
}

async function changeStatus(resource: Resource, value: string) {
  if (value === resource.status) return;
  const previous = resource.status;
  resource.status = value as Resource['status'];
  try {
    await api.patch(`/resources/${resource.slug}`, { status: value });
    notify('success', '阅读状态已更新');
  } catch (err) {
    resource.status = previous;
    notify('error', err instanceof Error ? err.message : '更新失败');
  }
}

function openNotes(resource: Resource) {
  noteTarget.value = resource;
  noteDraft.value = resource.notes || '';
}

async function saveNotes() {
  if (!noteTarget.value) return;
  savingNote.value = true;
  try {
    await api.patch(`/resources/${noteTarget.value.slug}`, { notes: noteDraft.value });
    noteTarget.value.notes = noteDraft.value;
    notify('success', '阅读笔记已保存');
    noteTarget.value = null;
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '保存失败');
  } finally {
    savingNote.value = false;
  }
}

function openAdd() {
  addError.value = '';
  addOpen.value = true;
}

async function submitAdd() {
  addError.value = '';
  if (addForm.title.trim().length < 2) return (addError.value = '标题至少 2 个字符');
  if (!/^https?:\/\//i.test(addForm.url.trim())) return (addError.value = '请填写以 http(s):// 开头的完整链接');
  adding.value = true;
  try {
    await api.post('/resources', {
      title: addForm.title.trim(),
      url: addForm.url.trim(),
      kind: addForm.kind,
      topic: addForm.topic.trim(),
      difficulty: addForm.difficulty,
      phaseSlug: addForm.phaseSlug,
      importance: Number(addForm.importance),
      keyPoints: addForm.keyPoints
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      tags: addForm.tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      official: false,
    });
    notify('success', '资料已加入，未核验资料不会标记为官方');
    addOpen.value = false;
    addForm.title = '';
    addForm.url = '';
    addForm.topic = '';
    addForm.keyPoints = '';
    addForm.tags = '';
    await load();
  } catch (err) {
    addError.value = err instanceof Error ? err.message : '添加失败';
  } finally {
    adding.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">LIBRARY</span><span class="dot online" />{{ stats.official }} 份官方资料 · {{ stats.verified }} 份已核验</div>
        <h1 class="page-title">资料库</h1>
        <p class="page-sub">只收录官方或高质量免费资源。未核验的链接会明确标注，不冒充官方资料。</p>
      </div>
      <div class="page-actions">
        <div class="res-stats mono">
          <span>{{ stats.total }} 份</span>
          <span>阅读中 <b class="accent">{{ stats.reading }}</b></span>
          <span>已读 <b class="accent">{{ stats.done }}</b></span>
        </div>
        <button class="btn btn-primary" type="button" @click="openAdd"><Plus :size="15" /> 添加资料</button>
      </div>
    </div>

    <div class="res-filters">
      <label class="res-search">
        <Search :size="14" />
        <input v-model="q" placeholder="搜索标题、主题、标签或要点" />
      </label>
      <select v-model="kind" class="select res-select">
        <option value="all">全部类型</option>
        <option v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <select v-model="status" class="select res-select">
        <option value="all">全部状态</option>
        <option value="unread">未读</option>
        <option value="reading">阅读中</option>
        <option value="done">已读</option>
        <option value="archived">已归档</option>
      </select>
      <select v-model="phase" class="select res-select">
        <option value="all">全部阶段</option>
        <option v-for="item in phases" :key="item.slug" :value="item.slug">{{ item.shortTitle }}</option>
      </select>
      <button class="btn btn-ghost btn-sm" :class="{ 'fav-on': favoriteOnly }" type="button" @click="favoriteOnly = !favoriteOnly">
        <Star :size="13" :fill="favoriteOnly ? 'currentColor' : 'none'" /> 收藏
      </button>
      <button
        class="btn btn-ghost btn-sm"
        type="button"
        @click="q = ''; kind = 'all'; status = 'all'; phase = 'all'; favoriteOnly = false"
      >
        <Filter :size="13" /> 重置
      </button>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载资料库" description="正在读取资料与关联任务。" />
    <StateBlock v-else-if="error" variant="error" title="资料库加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load">重试</button></template>
    </StateBlock>
    <StateBlock
      v-else-if="!filtered.length"
      variant="empty"
      title="没有匹配的资料"
      description="换个关键词，或添加一份你信任的资料。"
    >
      <template #action><button class="btn btn-sm mt-8" type="button" @click="openAdd">添加资料</button></template>
    </StateBlock>

    <div v-else class="res-grid">
      <article v-for="resource in filtered" :key="resource.slug" class="res-card">
        <div class="res-top">
          <span class="res-kind">
            <component :is="KIND_META[resource.kind].icon" :size="13" />
            {{ KIND_META[resource.kind].label }}
          </span>
          <span v-if="resource.official" class="res-official"><ShieldCheck :size="11" /> 官方</span>
          <span class="mono text-xs faint res-importance">P{{ resource.importance }}</span>
          <button
            class="res-star"
            :class="{ active: resource.favorite }"
            type="button"
            :title="resource.favorite ? '取消收藏' : '加入收藏'"
            @click="toggleFavorite(resource)"
          >
            <Star :size="14" :fill="resource.favorite ? 'currentColor' : 'none'" />
          </button>
        </div>

        <a class="res-title" :href="resource.url" target="_blank" rel="noopener noreferrer">
          {{ resource.title }}
          <ExternalLink :size="12" />
        </a>

        <div class="res-meta mono">
          <span v-if="resource.topic">{{ resource.topic }}</span>
          <span>{{ DIFFICULTY_LABEL[resource.difficulty] }}</span>
          <span v-if="resource.phaseSlug">{{ phaseTitle(resource.phaseSlug) }}</span>
        </div>

        <ul v-if="resource.keyPoints.length" class="res-points">
          <li v-for="point in resource.keyPoints.slice(0, 3)" :key="point">{{ point }}</li>
        </ul>

        <div v-if="resource.linkedTasks?.length" class="res-tasks">
          <span class="mono text-xs faint">关联</span>
          <RouterLink
            v-for="task in resource.linkedTasks.slice(0, 2)"
            :key="task.slug"
            :to="`/tasks/${task.slug}`"
            class="res-task"
          >
            {{ task.title }}
          </RouterLink>
          <span v-if="resource.linkedTasks.length > 2" class="mono text-xs faint">+{{ resource.linkedTasks.length - 2 }}</span>
        </div>

        <div class="res-footer">
          <span class="res-verified" :class="{ pending: !resource.lastVerifiedAt }">
            <CheckCircle2 v-if="resource.lastVerifiedAt" :size="11" />
            {{ verifiedLabel(resource.lastVerifiedAt) }}
          </span>
          <div class="res-actions">
            <button class="btn-link" type="button" @click="openNotes(resource)">阅读笔记</button>
            <select
              class="res-status-select"
              :value="resource.status"
              @change="changeStatus(resource, ($event.target as HTMLSelectElement).value)"
            >
              <option value="unread">未读</option>
              <option value="reading">阅读中</option>
              <option value="done">已读</option>
              <option value="archived">已归档</option>
            </select>
          </div>
        </div>

        <div v-if="resource.tags.length" class="res-tags">
          <span v-for="tag in resource.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </article>
    </div>

    <ModalShell v-if="noteTarget" :title="noteTarget.title" sub="阅读笔记只保存在本地数据库，不会发送给外部服务。" @close="noteTarget = null">
      <div class="field">
        <label class="field-label">我的笔记</label>
        <textarea
          v-model="noteDraft"
          class="textarea"
          rows="9"
          placeholder="记录关键结论、可复用的代码片段、尚未理解的问题…"
        />
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="noteTarget = null">取消</button>
        <button class="btn btn-primary" type="button" :disabled="savingNote" @click="saveNotes">
          <span v-if="savingNote" class="spinner" /> 保存笔记
        </button>
      </template>
    </ModalShell>

    <ModalShell v-if="addOpen" title="添加资料" sub="请填写真实可访问的链接；自行添加的资料默认标记为未核验。" @close="addOpen = false">
      <div class="form-grid">
        <div class="field">
          <label class="field-label">标题</label>
          <input v-model="addForm.title" class="input" placeholder="例如：OpenAI Function Calling 指南" />
        </div>
        <div class="field">
          <label class="field-label">链接</label>
          <input v-model="addForm.url" class="input" placeholder="https://…" />
        </div>
        <div class="form-row">
          <div class="field">
            <label class="field-label">类型</label>
            <select v-model="addForm.kind" class="select">
              <option v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">难度</label>
            <select v-model="addForm.difficulty" class="select">
              <option value="beginner">入门</option>
              <option value="intermediate">进阶</option>
              <option value="advanced">高级</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">优先级</label>
            <select v-model.number="addForm.importance" class="select">
              <option :value="1">P1</option>
              <option :value="2">P2</option>
              <option :value="3">P3</option>
              <option :value="4">P4</option>
              <option :value="5">P5</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label class="field-label">主题</label>
            <input v-model="addForm.topic" class="input" placeholder="例如：Function Calling" />
          </div>
          <div class="field">
            <label class="field-label">所属阶段</label>
            <select v-model="addForm.phaseSlug" class="select">
              <option value="">不关联阶段</option>
              <option v-for="item in phases" :key="item.slug" :value="item.slug">{{ item.shortTitle }}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label">关键要点（每行一条）</label>
          <textarea v-model="addForm.keyPoints" class="textarea" rows="3" placeholder="读完后应掌握什么？" />
        </div>
        <div class="field">
          <label class="field-label">标签</label>
          <input v-model="addForm.tags" class="input" placeholder="用逗号分隔" />
        </div>
        <p v-if="addError" class="form-error">{{ addError }}</p>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="addOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="adding" @click="submitAdd">
          <span v-if="adding" class="spinner" /> 添加到资料库
        </button>
      </template>
    </ModalShell>
  </div>
</template>

<style scoped>
.res-stats {
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: var(--faint);
}

.res-stats b {
  font-weight: 600;
}

.res-filters {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(12, 19, 17, 0.7);
}

.res-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 190px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-soft);
  color: var(--faint);
}

.res-search:focus-within {
  border-color: rgba(110, 231, 168, 0.4);
}

.res-search input {
  width: 100%;
  border: 0;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 12.5px;
}

.res-select {
  width: 116px;
  height: 32px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 12px;
}

.fav-on {
  color: var(--amber);
  border-color: rgba(240, 198, 116, 0.35);
  background: var(--amber-soft);
}

.res-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.res-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 15px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  transition: border-color 0.15s ease;
}

.res-card:hover {
  border-color: var(--line-strong);
}

.res-top {
  display: flex;
  align-items: center;
  gap: 7px;
}

.res-kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--muted);
  font-family: var(--mono);
}

.res-official {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border: 1px solid rgba(110, 231, 168, 0.25);
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 9.5px;
}

.res-importance {
  margin-left: auto;
}

.res-star {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--faint);
  cursor: pointer;
  transition: 0.15s ease;
}

.res-star:hover {
  color: var(--amber);
  background: var(--amber-soft);
}

.res-star.active {
  color: var(--amber);
}

.res-title {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  font-size: 13.5px;
  font-weight: 560;
  color: var(--text);
  line-height: 1.45;
}

.res-title svg {
  flex-shrink: 0;
  color: var(--faint);
  transform: translateY(1px);
}

.res-title:hover {
  color: var(--accent);
}

.res-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 9.5px;
  color: var(--faint);
}

.res-points {
  margin: 0;
  padding-left: 15px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11.2px;
  color: var(--muted);
  line-height: 1.55;
}

.res-points li::marker {
  color: var(--faint);
}

.res-tasks {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.res-task {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--bg-soft);
  color: var(--text-soft);
  font-size: 10px;
  transition: 0.15s ease;
}

.res-task:hover {
  border-color: rgba(110, 231, 168, 0.3);
  color: var(--accent);
}

.res-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}

.res-verified {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  color: var(--faint);
  font-family: var(--mono);
}

.res-verified svg {
  color: var(--accent);
}

.res-verified.pending {
  color: var(--amber);
}

.res-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.res-actions .btn-link {
  font-size: 10.5px;
}

.res-status-select {
  height: 24px;
  padding: 0 5px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--bg-soft);
  color: var(--muted);
  font-size: 10px;
  outline: none;
}

.res-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

@media (max-width: 980px) {
  .res-grid {
    grid-template-columns: 1fr;
  }
  .res-select {
    flex: 1;
    width: auto;
  }
}

@media (max-width: 640px) {
  .res-stats {
    display: none;
  }
}
</style>
