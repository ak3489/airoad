<script setup lang="ts">
import { ChevronRight, Filter, ListChecks, Plus, Search } from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModalShell from '@/components/ModalShell.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { notify, notifyError } from '@/lib/toast';
import { isOverdue, relativeDay } from '@/lib/format';
import type { PlanResponse, TaskStatus, TaskSummary } from '@/types';

const router = useRouter();
const tasks = ref<TaskSummary[]>([]);
const phases = ref<{ slug: string; title: string; shortTitle: string; weeks: string }[]>([]);
const loading = ref(true);
const error = ref('');

const q = ref('');
const status = ref<'all' | TaskStatus>('all');
const phase = ref('all');
const week = ref<'all' | number>('all');

const createOpen = ref(false);
const submitting = ref(false);
const formError = ref('');
const form = reactive({
  phaseSlug: 'phase-1',
  week: 1,
  title: '',
  objective: '',
  estimatedMinutes: 60,
  tags: '',
  acceptance: '',
});

const statusOptions: { value: 'all' | TaskStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'review', label: '待验收' },
  { value: 'done', label: '已完成' },
];

const filtered = computed(() => {
  const keyword = q.value.trim().toLowerCase();
  return tasks.value.filter((task) => {
    if (status.value !== 'all' && task.status !== status.value) return false;
    if (phase.value !== 'all' && task.phaseSlug !== phase.value) return false;
    if (week.value !== 'all' && task.week !== week.value) return false;
    if (
      keyword &&
      !`${task.title} ${task.objective} ${task.tags.join(' ')}`.toLowerCase().includes(keyword)
    )
      return false;
    return true;
  });
});

const groups = computed(() => {
  const map = new Map<string, { slug: string; title: string; weeks: string; tasks: TaskSummary[] }>();
  for (const task of filtered.value) {
    const phaseMeta = phases.value.find((item) => item.slug === task.phaseSlug);
    if (!map.has(task.phaseSlug)) {
      map.set(task.phaseSlug, {
        slug: task.phaseSlug,
        title: phaseMeta?.title || task.phaseTitle,
        weeks: phaseMeta?.weeks || `第 ${task.week} 周`,
        tasks: [],
      });
    }
    map.get(task.phaseSlug)!.tasks.push(task);
  }
  return [...map.values()].map((group) => {
    const required = group.tasks.filter((task) => !task.optional);
    return {
      ...group,
      tasks: [...group.tasks].sort((a, b) => Number(a.optional) - Number(b.optional)),
      requiredTotal: required.length,
      requiredDone: required.filter((task) => task.status === 'done').length,
      optionalTotal: group.tasks.length - required.length,
    };
  });
});

const counts = computed(() => {
  const required = tasks.value.filter((task) => !task.optional);
  return {
    total: required.length,
    optional: tasks.value.length - required.length,
    done: required.filter((task) => task.status === 'done').length,
    active: required.filter((task) => task.status === 'in_progress').length,
    overdue: required.filter((task) => isOverdue(task.dueDate, task.status === 'done')).length,
  };
});

const weeks = computed(() => Array.from(new Set(tasks.value.map((task) => task.week))).sort((a, b) => a - b));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [taskList, plan] = await Promise.all([
      api.get<TaskSummary[]>('/tasks'),
      api.get<PlanResponse>('/plan'),
    ]);
    tasks.value = taskList;
    phases.value = plan.phases.map((item) => ({
      slug: item.slug,
      title: item.title,
      shortTitle: item.shortTitle,
      weeks: item.weeks,
    }));
    if (!form.phaseSlug && phases.value[0]) form.phaseSlug = phases.value[0].slug;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '任务加载失败';
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  q.value = '';
  status.value = 'all';
  phase.value = 'all';
  week.value = 'all';
}

function openCreate() {
  formError.value = '';
  createOpen.value = true;
}

async function submitCreate() {
  if (form.title.trim().length < 4) return (formError.value = '标题至少 4 个字符');
  if (form.objective.trim().length < 4) return (formError.value = '目标至少 4 个字符');
  submitting.value = true;
  formError.value = '';
  try {
    const created = await api.post<TaskSummary>('/tasks', {
      phaseSlug: form.phaseSlug,
      week: Number(form.week),
      title: form.title.trim(),
      objective: form.objective.trim(),
      estimatedMinutes: Number(form.estimatedMinutes),
      tags: form.tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      acceptance: form.acceptance
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
    notify('success', '任务已创建');
    createOpen.value = false;
    form.title = '';
    form.objective = '';
    form.tags = '';
    form.acceptance = '';
    await load();
    router.push(`/tasks/${created.slug}`);
  } catch (err) {
    formError.value = err instanceof Error ? err.message : '创建失败';
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">TASKS</span><span class="dot online" />{{ counts.total }} 个主线任务<template v-if="counts.optional"> · {{ counts.optional }} 个选修</template></div>
        <h1 class="page-title">每日任务</h1>
        <p class="page-sub">按周推进，每完成一个步骤就留下运行结果。状态推进由证据驱动，而不是点了"完成"就算。</p>
      </div>
      <div class="page-actions">
        <div class="filter-stats mono">
          <span>完成 <b class="accent">{{ counts.done }}</b></span>
          <span>进行中 <b class="blue">{{ counts.active }}</b></span>
          <span v-if="counts.overdue">逾期 <b class="red">{{ counts.overdue }}</b></span>
        </div>
        <button class="btn btn-primary" type="button" @click="openCreate"><Plus :size="15" /> 新建任务</button>
      </div>
    </div>

    <div class="filter-bar">
      <label class="search-box">
        <Search :size="14" />
        <input v-model="q" class="filter-input" placeholder="搜索标题、目标、标签" />
      </label>
      <div class="segmented">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          :class="{ active: status === option.value }"
          @click="status = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <select v-model="phase" class="select filter-select">
        <option value="all">全部阶段</option>
        <option v-for="item in phases" :key="item.slug" :value="item.slug">{{ item.shortTitle || item.title }}</option>
      </select>
      <select v-model="week" class="select filter-select">
        <option value="all">全部周次</option>
        <option v-for="item in weeks" :key="item" :value="item">第 {{ item }} 周</option>
      </select>
      <button class="btn btn-ghost btn-sm" type="button" @click="resetFilters"><Filter :size="13" /> 重置</button>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载任务中" description="正在读取学习计划与任务状态。" />
    <StateBlock v-else-if="error" variant="error" title="任务加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load">重试</button></template>
    </StateBlock>
    <StateBlock
      v-else-if="!filtered.length"
      variant="empty"
      title="没有匹配的任务"
      description="调整筛选条件，或创建一个新的自定义任务。"
    >
      <template #action><button class="btn btn-sm mt-8" type="button" @click="resetFilters">清除筛选</button></template>
    </StateBlock>

    <div v-else class="task-groups">
      <section v-for="group in groups" :key="group.slug" class="task-group">
        <div class="group-head">
          <div class="flex gap-8">
            <ListChecks :size="14" class="faint" />
            <h2 class="group-title">{{ group.title }}</h2>
            <span class="mono text-xs faint">{{ group.weeks }}</span>
          </div>
          <span class="mono text-xs faint">
            {{ group.requiredDone }}/{{ group.requiredTotal }}
            <template v-if="group.optionalTotal"> · {{ group.optionalTotal }} 选修</template>
          </span>
        </div>
        <div class="task-table">
          <button
            v-for="task in group.tasks"
            :key="task.slug"
            class="task-line"
            type="button"
            @click="router.push(`/tasks/${task.slug}`)"
          >
            <span class="task-order mono">{{ String(task.order).padStart(2, '0') }}</span>
            <div class="task-main">
              <div class="task-title-row">
                <span class="task-title">{{ task.title }}</span>
                <span v-if="task.optional" class="badge badge-idle no-dot">选修</span>
                <span v-for="tag in task.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
              </div>
              <div class="task-sub">{{ task.objective }}</div>
            </div>
            <div class="task-steps">
              <span class="mono text-xs">{{ task.stepDone }}/{{ task.stepTotal }} 步</span>
              <div class="mini-progress"><span :style="{ width: `${task.percent}%` }" /></div>
            </div>
            <div class="task-time mono text-xs">
              {{ task.actualMinutes }}<span class="faint">/{{ task.estimatedMinutes }}m</span>
            </div>
            <div class="task-due text-xs" :class="{ 'text-danger': isOverdue(task.dueDate, task.status === 'done') }">
              {{ relativeDay(task.dueDate) }}
            </div>
            <div class="task-status">
              <StatusBadge :status="task.status" />
            </div>
            <ChevronRight :size="15" class="chev" />
          </button>
        </div>
      </section>
    </div>

    <ModalShell v-if="createOpen" title="新建学习任务" sub="自定义任务会加入当前阶段末尾，可随时拆分或删除。" @close="createOpen = false">
      <div class="form-grid">
        <div class="form-row">
          <div class="field">
            <label class="field-label">所属阶段</label>
            <select v-model="form.phaseSlug" class="select">
              <option v-for="item in phases" :key="item.slug" :value="item.slug">{{ item.title }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">周次</label>
            <input v-model.number="form.week" class="input" type="number" min="1" max="52" />
          </div>
        </div>
        <div class="field">
          <label class="field-label">标题</label>
          <input v-model="form.title" class="input" placeholder="例如：给 Agent 增加超时与重试" />
        </div>
        <div class="field">
          <label class="field-label">目标</label>
          <textarea v-model="form.objective" class="textarea" rows="3" placeholder="完成后能够做到什么？如何验证？" />
        </div>
        <div class="form-row">
          <div class="field">
            <label class="field-label">预计分钟</label>
            <input v-model.number="form.estimatedMinutes" class="input" type="number" min="10" max="600" />
          </div>
          <div class="field">
            <label class="field-label">标签</label>
            <input v-model="form.tags" class="input" placeholder="用逗号分隔，例如：重试, 稳定性" />
          </div>
        </div>
        <div class="field">
          <label class="field-label">验收标准（每行一条）</label>
          <textarea v-model="form.acceptance" class="textarea" rows="3" placeholder="能运行…&#10;有测试…&#10;能解释…" />
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="createOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="submitCreate">
          <span v-if="submitting" class="spinner" /> 创建任务
        </button>
      </template>
    </ModalShell>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin-bottom: 18px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(12, 19, 17, 0.7);
}

.search-box {
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

.search-box:focus-within {
  border-color: rgba(110, 231, 168, 0.4);
}

.filter-input {
  width: 100%;
  border: 0;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 12.5px;
}

.filter-select {
  width: 132px;
  height: 32px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 12px;
}

.filter-stats {
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: var(--faint);
}

.filter-stats b {
  font-weight: 600;
}

.blue {
  color: var(--blue);
}
.red {
  color: var(--red);
}

.text-danger {
  color: var(--red);
}

.task-groups {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 8px;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-soft);
}

.task-table {
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  overflow: hidden;
}

.task-line {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 120px 82px 100px 78px 18px;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 13px 16px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s ease;
}

.task-line:last-child {
  border-bottom: 0;
}

.task-line:hover {
  background: rgba(255, 255, 255, 0.022);
}

.task-order {
  font-size: 10px;
  color: var(--faint);
}

.task-main {
  min-width: 0;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.task-title {
  font-size: 13px;
  font-weight: 540;
  color: var(--text-soft);
}

.task-line:hover .task-title {
  color: var(--text);
}

.task-sub {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-steps {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--faint);
}

.mini-progress {
  height: 3px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.mini-progress span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.task-time {
  color: var(--text-soft);
}

.task-due {
  color: var(--faint);
  line-height: 1.35;
}

.chev {
  color: var(--faint);
  transition: transform 0.15s ease;
}

.task-line:hover .chev {
  transform: translateX(2px);
  color: var(--accent);
}

@media (max-width: 1000px) {
  .task-line {
    grid-template-columns: 26px minmax(0, 1fr) 78px;
  }
  .task-steps,
  .task-time,
  .task-due {
    display: none;
  }
  .task-status {
    justify-self: end;
  }
  .chev {
    display: none;
  }
}

@media (max-width: 700px) {
  .filter-select {
    flex: 1;
    width: auto;
  }
}
</style>
