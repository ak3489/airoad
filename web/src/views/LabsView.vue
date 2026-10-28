<script setup lang="ts">
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FlaskConical,
  ListChecks,
  Lock,
  Search,
  Terminal,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ProgressBar from '@/components/ProgressBar.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { formatMinutes } from '@/lib/format';
import type { PlanResponse, TaskDetail, TaskStatus, TaskSummary } from '@/types';

const router = useRouter();
const tasks = ref<TaskSummary[]>([]);
const phases = ref<{ slug: string; shortTitle: string; title: string }[]>([]);
const loading = ref(true);
const error = ref('');

const q = ref('');
const phase = ref('all');
const state = ref<'all' | 'open' | 'done'>('all');

const selectedSlug = ref('');
const detail = ref<TaskDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref('');
const cache = new Map<string, TaskDetail>();
let requestToken = 0;

const labs = computed(() => tasks.value.filter((task) => task.stepTotal > 0));

const filtered = computed(() => {
  const keyword = q.value.trim().toLowerCase();
  return labs.value.filter((task) => {
    if (phase.value !== 'all' && task.phaseSlug !== phase.value) return false;
    if (state.value === 'open' && task.status === 'done') return false;
    if (state.value === 'done' && task.status !== 'done') return false;
    if (keyword && !`${task.title} ${task.objective} ${task.tags.join(' ')}`.toLowerCase().includes(keyword))
      return false;
    return true;
  });
});

const stats = computed(() => {
  const steps = labs.value.reduce((sum, task) => sum + task.stepTotal, 0);
  const done = labs.value.reduce((sum, task) => sum + task.stepDone, 0);
  return {
    labs: labs.value.length,
    steps,
    done,
    completed: labs.value.filter((task) => task.status === 'done').length,
    percent: steps ? Math.round((done / steps) * 100) : 0,
  };
});

function phaseTitle(slug: string) {
  return phases.value.find((item) => item.slug === slug)?.shortTitle || slug;
}

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
      shortTitle: item.shortTitle,
      title: item.title,
    }));
    const firstOpen = taskList.find((task) => task.stepTotal > 0 && task.status !== 'done');
    const target = selectedSlug.value || firstOpen?.slug || taskList[0]?.slug;
    if (target) await selectLab(target);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '实操教程加载失败';
  } finally {
    loading.value = false;
  }
}

async function selectLab(slug: string) {
  selectedSlug.value = slug;
  detailError.value = '';
  const cached = cache.get(slug);
  if (cached) {
    detail.value = cached;
    return;
  }
  const token = ++requestToken;
  detailLoading.value = true;
  detail.value = null;
  try {
    const data = await api.get<TaskDetail>(`/tasks/${slug}`);
    if (token !== requestToken) return;
    cache.set(slug, data);
    detail.value = data;
  } catch (err) {
    if (token !== requestToken) return;
    detailError.value = err instanceof Error ? err.message : '实验详情加载失败';
  } finally {
    if (token === requestToken) detailLoading.value = false;
  }
}

function statusLabel(status: TaskStatus) {
  return status === 'done' ? '已完成' : status === 'in_progress' ? '进行中' : status === 'review' ? '待验收' : '未开始';
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">LABS</span><span class="dot online" />引导式实验 · 真实可运行</div>
        <h1 class="page-title">实操教程</h1>
        <p class="page-sub">
          每个实验拆成独立步骤，按顺序解锁。留下命令输出、报错和结论，才算完成一步。
        </p>
      </div>
      <div class="page-actions">
        <div class="lab-score mono">
          <span>{{ stats.done }}<em>/{{ stats.steps }}</em> 步</span>
          <ProgressBar :value="stats.percent" thin />
        </div>
      </div>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载实验目录" description="正在读取任务步骤与资源。" />
    <StateBlock v-else-if="error" variant="error" title="实验加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load">重试</button></template>
    </StateBlock>

    <template v-else>
      <div class="lab-filters">
        <label class="lab-search">
          <Search :size="14" />
          <input v-model="q" placeholder="搜索实验、目标或标签" />
        </label>
        <select v-model="phase" class="select lab-select">
          <option value="all">全部阶段</option>
          <option v-for="item in phases" :key="item.slug" :value="item.slug">{{ item.shortTitle }}</option>
        </select>
        <div class="segmented">
          <button type="button" :class="{ active: state === 'all' }" @click="state = 'all'">全部</button>
          <button type="button" :class="{ active: state === 'open' }" @click="state = 'open'">未完成</button>
          <button type="button" :class="{ active: state === 'done' }" @click="state = 'done'">已完成</button>
        </div>
        <span class="mono text-xs faint lab-count">{{ filtered.length }} / {{ stats.labs }} 个实验</span>
      </div>

      <StateBlock
        v-if="!filtered.length"
        variant="empty"
        title="没有匹配的实验"
        description="调整搜索或筛选条件，或者先去每日任务里看看。"
      >
        <template #action><RouterLink to="/tasks" class="btn btn-sm mt-8">打开每日任务</RouterLink></template>
      </StateBlock>

      <div v-else class="labs-layout">
        <div class="lab-list">
          <button
            v-for="task in filtered"
            :key="task.slug"
            class="lab-card"
            :class="{ selected: task.slug === selectedSlug }"
            type="button"
            @click="selectLab(task.slug)"
          >
            <div class="lab-card-top">
              <span class="lab-index mono">LAB {{ String(task.order).padStart(2, '0') }}</span>
              <span class="mono text-xs faint">{{ phaseTitle(task.phaseSlug) }} · W{{ task.week }}</span>
            </div>
            <div class="lab-card-title">{{ task.title }}</div>
            <p class="lab-card-sub">{{ task.objective }}</p>
            <div class="lab-card-foot">
              <div class="lab-steps mono text-xs">
                <ListChecks :size="12" />
                {{ task.stepDone }}/{{ task.stepTotal }} 步
              </div>
              <div class="lab-card-progress"><span :style="{ width: `${task.percent}%` }" /></div>
              <StatusBadge :status="task.status" />
            </div>
            <div class="lab-card-tags">
              <span v-for="tag in task.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
              <span class="mono text-xs faint lab-time"><Clock3 :size="11" /> {{ formatMinutes(task.estimatedMinutes) }}</span>
            </div>
            <span class="lab-chev"><ChevronRight :size="14" /></span>
          </button>
        </div>

        <aside class="lab-stage">
          <template v-if="detailLoading">
            <div class="stage-loading">
              <span class="spinner" />
              正在读取实验步骤…
            </div>
          </template>
          <StateBlock v-else-if="detailError" variant="error" title="实验详情加载失败" :description="detailError">
            <template #action>
              <button class="btn btn-sm mt-8" type="button" @click="selectLab(selectedSlug)">重试</button>
            </template>
          </StateBlock>
          <template v-else-if="detail">
            <div class="stage-head">
              <div class="flex gap-8">
                <span class="stage-icon"><FlaskConical :size="15" /></span>
                <div>
                  <div class="mono text-xs faint">{{ phaseTitle(detail.task.phaseSlug) }} · {{ detail.task.week }} 周 · {{ statusLabel(detail.task.status) }}</div>
                  <h2 class="stage-title">{{ detail.task.title }}</h2>
                </div>
              </div>
              <StatusBadge :status="detail.task.status" />
            </div>

            <p class="stage-sub">{{ detail.task.objective }}</p>

            <div class="stage-meta mono">
              <span>{{ detail.task.steps.filter((step) => step.status === 'done').length }}/{{ detail.task.steps.length }} 步完成</span>
              <span>{{ formatMinutes(detail.actualMinutes) }} 已投入</span>
              <span>{{ detail.task.steps.filter((step) => step.code).length }} 段代码</span>
              <span>{{ detail.task.steps.filter((step) => step.commands?.length).length }} 组命令</span>
            </div>

            <div class="stage-progress"><ProgressBar :value="detail.task.steps.length ? Math.round((detail.task.steps.filter((step) => step.status === 'done').length / detail.task.steps.length) * 100) : 0" /></div>

            <div class="stage-steps">
              <div
                v-for="(step, index) in detail.task.steps"
                :key="step.key"
                class="stage-step"
                :class="{ done: step.status === 'done', locked: step.locked }"
              >
                <div class="stage-step-rail">
                  <span class="stage-step-dot">
                    <Check v-if="step.status === 'done'" :size="11" />
                    <Lock v-else-if="step.locked" :size="10" />
                    <template v-else>{{ index + 1 }}</template>
                  </span>
                  <span v-if="index < detail.task.steps.length - 1" class="stage-step-line" />
                </div>
                <div class="stage-step-body">
                  <div class="stage-step-title">
                    {{ step.title }}
                    <span v-if="step.locked" class="mono text-xs faint">先完成上一步</span>
                  </div>
                  <div class="stage-step-goal">{{ step.goal }}</div>
                  <div class="stage-step-badges">
                    <span v-if="step.code" class="stage-chip"><Code2 :size="10" /> {{ step.code.language }}</span>
                    <span v-if="step.commands?.length" class="stage-chip"><Terminal :size="10" /> {{ step.commands.length }} 条命令</span>
                    <span v-if="step.acceptance.length" class="stage-chip"><BookOpen :size="10" /> {{ step.acceptance.length }} 条验收</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="stage-foot">
              <button class="btn btn-primary btn-block" type="button" @click="router.push(`/tasks/${detail.task.slug}`)">
                进入开发者工作台 <ArrowRight :size="14" />
              </button>
              <p class="stage-note">步骤内的运行结果、报错和笔记会保存在任务中，刷新后仍然保留。</p>
            </div>
          </template>
          <StateBlock v-else variant="empty" title="选择一个实验" description="从左侧列表选择实验查看步骤预览。" />
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lab-score {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 150px;
  font-size: 11px;
  color: var(--faint);
  text-align: right;
}

.lab-score em {
  font-style: normal;
  color: var(--faint);
}

.lab-score .progress {
  width: 150px;
}

.lab-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(12, 19, 17, 0.7);
}

.lab-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 180px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-soft);
  color: var(--faint);
}

.lab-search:focus-within {
  border-color: rgba(110, 231, 168, 0.4);
}

.lab-search input {
  width: 100%;
  border: 0;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 12.5px;
}

.lab-select {
  width: 130px;
  height: 32px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 12px;
}

.lab-count {
  margin-left: auto;
}

.labs-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 430px;
  gap: 18px;
  align-items: start;
}

.lab-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lab-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 15px 17px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: 0.16s ease;
}

.lab-card:hover {
  border-color: var(--line-strong);
  background: var(--surface-2);
}

.lab-card.selected {
  border-color: rgba(110, 231, 168, 0.42);
  background: linear-gradient(180deg, rgba(110, 231, 168, 0.07), var(--surface));
  box-shadow: 0 0 0 1px rgba(110, 231, 168, 0.08);
}

.lab-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.lab-index {
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.lab-card-title {
  font-size: 14px;
  font-weight: 560;
  color: var(--text);
  padding-right: 18px;
}

.lab-card-sub {
  font-size: 11.8px;
  color: var(--muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lab-card-foot {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lab-steps {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--faint);
  flex-shrink: 0;
}

.lab-card-progress {
  flex: 1;
  height: 3px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.lab-card-progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.lab-card-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lab-time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
}

.lab-chev {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
  opacity: 0;
  transition: 0.15s ease;
}

.lab-card.selected .lab-chev {
  color: var(--accent);
  opacity: 1;
}

.lab-stage {
  position: sticky;
  top: calc(var(--topbar-height) + 16px);
  border: 1px solid var(--line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  padding: 18px;
  max-height: calc(100vh - var(--topbar-height) - 40px);
  overflow-y: auto;
}

.stage-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 30px 8px;
  color: var(--faint);
  font-size: 12px;
}

.stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.stage-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(110, 231, 168, 0.25);
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.stage-title {
  margin-top: 3px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.stage-sub {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

.stage-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0 8px;
  font-size: 10px;
  color: var(--faint);
}

.stage-progress {
  margin-bottom: 18px;
}

.stage-steps {
  display: flex;
  flex-direction: column;
}

.stage-step {
  display: flex;
  gap: 10px;
}

.stage-step-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.stage-step-dot {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: var(--bg-soft);
  color: var(--faint);
  font-family: var(--mono);
  font-size: 9.5px;
  flex-shrink: 0;
}

.stage-step.done .stage-step-dot {
  border-color: rgba(110, 231, 168, 0.4);
  background: var(--accent-soft);
  color: var(--accent);
}

.stage-step.locked .stage-step-dot {
  border-style: dashed;
}

.stage-step-line {
  width: 1px;
  flex: 1;
  min-height: 16px;
  background: var(--line);
  margin: 3px 0;
}

.stage-step-body {
  flex: 1;
  min-width: 0;
  padding-bottom: 15px;
}

.stage-step-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12.5px;
  font-weight: 540;
  color: var(--text-soft);
  line-height: 1.5;
}

.stage-step.locked .stage-step-title {
  color: var(--faint);
}

.stage-step-goal {
  margin-top: 3px;
  font-size: 11px;
  color: var(--faint);
  line-height: 1.55;
}

.stage-step-badges {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.stage-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--bg-soft);
  color: var(--faint);
  font-size: 9.5px;
  font-family: var(--mono);
}

.stage-foot {
  margin-top: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.stage-note {
  margin-top: 9px;
  font-size: 10.5px;
  color: var(--faint);
  text-align: center;
  line-height: 1.55;
}

@media (max-width: 1180px) {
  .labs-layout {
    grid-template-columns: minmax(0, 1fr) 380px;
  }
}

@media (max-width: 980px) {
  .labs-layout {
    grid-template-columns: 1fr;
  }
  .lab-stage {
    position: static;
    max-height: none;
  }
  .lab-list {
    max-height: 420px;
    overflow-y: auto;
    padding-right: 2px;
  }
}

@media (max-width: 700px) {
  .lab-count {
    display: none;
  }
  .lab-select {
    flex: 1;
    width: auto;
  }
  .lab-score {
    display: none;
  }
}
</style>
