<script setup lang="ts">
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bug,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Copy,
  ExternalLink,
  FileCode2,
  History,
  ListChecks,
  Lock,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Split,
  Target,
  Terminal,
  Timer,
  Trash2,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CodeBlock from '@/components/CodeBlock.vue';
import MarkdownView from '@/components/MarkdownView.vue';
import ModalShell from '@/components/ModalShell.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { aiOpen, useAppState } from '@/lib/appState';
import { STATUS_LABEL, formatClock, formatDate, formatDateTime, formatMinutes, isOverdue, relativeDay } from '@/lib/format';
import { profileCode } from '@/lib/profile';
import { notify, notifyError } from '@/lib/toast';
import type { TaskDetail, TaskStatus, TaskStep, TaskSummary } from '@/types';

const route = useRoute();
const router = useRouter();
const { refresh: refreshOverview } = useAppState();

const detail = ref<TaskDetail | null>(null);
const siblings = ref<TaskSummary[]>([]);
const loading = ref(true);
const error = ref('');
const busy = ref(false);
const openSteps = ref<string[]>([]);
const onlyOpen = ref(false);

const timerSeconds = ref(0);
const timerRunning = ref(false);
const timerStartedAt = ref<number | null>(null);
const timerAccumulated = ref(0);
let timerHandle: ReturnType<typeof setInterval> | null = null;

function timerStorageKey() {
  return `airoad.timer.v2.${profileCode.value || 'default'}`;
}
type StoredTimer = { startedAt: number | null; accumulated: number };

function readTimerStore(): Record<string, StoredTimer> {
  try {
    const raw = localStorage.getItem(timerStorageKey());
    const parsed = raw ? (JSON.parse(raw) as Record<string, StoredTimer>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistTimer() {
  const slug = task.value?.slug;
  if (!slug) return;
  const store = readTimerStore();
  if (!timerRunning.value && timerAccumulated.value === 0) delete store[slug];
  else store[slug] = { startedAt: timerStartedAt.value, accumulated: timerAccumulated.value };
  try {
    localStorage.setItem(timerStorageKey(), JSON.stringify(store));
  } catch {
    // 浏览器存储不可用时计时仍在内存中工作
  }
}

function stopTicking() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function tickTimer() {
  if (!timerRunning.value || !timerStartedAt.value) return;
  timerSeconds.value =
    timerAccumulated.value + Math.max(0, Math.floor((Date.now() - timerStartedAt.value) / 1000));
}

function applyTimerState() {
  stopTicking();
  const slug = task.value?.slug;
  const state = slug ? readTimerStore()[slug] : undefined;
  timerAccumulated.value = state?.accumulated ?? 0;
  timerStartedAt.value = state?.startedAt ?? null;
  timerRunning.value = Boolean(timerStartedAt.value);
  timerSeconds.value = timerRunning.value
    ? timerAccumulated.value + Math.max(0, Math.floor((Date.now() - (timerStartedAt.value as number)) / 1000))
    : timerAccumulated.value;
  if (timerRunning.value) timerHandle = setInterval(tickTimer, 1000);
}
const logSummary = ref('');
const logMinutes = ref<number>(0);

const notes = reactive({ notes: '', blockers: '', nextStep: '' });
const notesDirty = ref(false);
const drafts = reactive<Record<string, { resultLog: string; errorLog: string; notes: string }>>({});

const splitOpen = ref(false);
const splitParts = reactive([{ title: '', objective: '', estimatedMinutes: 45 }]);
const splitSaving = ref(false);
const dueOpen = ref(false);
const dueDraft = ref('');
const dueSaving = ref(false);

const task = computed(() => detail.value?.task ?? null);
const phase = computed(() => detail.value?.phase ?? null);
const doneSteps = computed(() => task.value?.steps.filter((step) => step.status === 'done').length ?? 0);
const progress = computed(() => {
  if (!task.value) return 0;
  if (task.value.status === 'done') return 100;
  if (!task.value.steps.length) return 0;
  return Math.round((doneSteps.value / task.value.steps.length) * 100);
});
const incompleteSteps = computed(() => task.value?.steps.filter((step) => step.status !== 'done') ?? []);
const nextStep = computed(() => task.value?.steps.find((step) => step.status !== 'done') ?? null);

const queue = computed(() => {
  const list = [...siblings.value].sort((a, b) => a.order - b.order);
  return onlyOpen.value ? list.filter((item) => item.status !== 'done') : list;
});

const actions = computed(() => {
  const status = task.value?.status;
  if (!status) return [];
  const blocked = incompleteSteps.value.length > 0;
  if (status === 'not_started') {
    return [{ label: '开始任务', target: 'in_progress' as TaskStatus, primary: true, disabled: false }];
  }
  if (status === 'in_progress') {
    return [
      { label: '提交验收', target: 'review' as TaskStatus, primary: true, disabled: false },
      {
        label: '标记完成',
        target: 'done' as TaskStatus,
        primary: false,
        disabled: blocked,
        hint: blocked ? '还有未完成步骤' : '',
      },
    ];
  }
  if (status === 'review') {
    return [
      { label: '验收通过', target: 'done' as TaskStatus, primary: true, disabled: false },
      { label: '退回进行中', target: 'in_progress' as TaskStatus, primary: false, disabled: false },
    ];
  }
  return [{ label: '重新打开', target: 'in_progress' as TaskStatus, primary: false, disabled: false }];
});

function initDrafts(steps: TaskStep[]) {
  for (const step of steps) {
    drafts[step.key] = {
      resultLog: step.resultLog ?? '',
      errorLog: step.errorLog ?? '',
      notes: step.notes ?? '',
    };
  }
}

async function load(slug?: string) {
  const target = slug || String(route.params.slug);
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get<TaskDetail>(`/tasks/${target}`);
    detail.value = data;
    initDrafts(data.task.steps);
    notes.notes = data.task.notes;
    notes.blockers = data.task.blockers;
    notes.nextStep = data.task.nextStep;
    notesDirty.value = false;
    const firstIncomplete = [...data.task.steps]
      .sort((a, b) => a.order - b.order)
      .find((step) => step.status !== 'done');
    openSteps.value = firstIncomplete ? [firstIncomplete.key] : data.task.steps[0] ? [data.task.steps[0].key] : [];
    const phaseTasks = await api.get<TaskSummary[]>(`/tasks?phase=${data.task.phaseSlug}`);
    siblings.value = phaseTasks;
    applyTimerState();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '任务加载失败';
  } finally {
    loading.value = false;
  }
}

function toggleStep(key: string) {
  openSteps.value = openSteps.value.includes(key)
    ? openSteps.value.filter((item) => item !== key)
    : [...openSteps.value, key];
}

function isOpen(key: string) {
  return openSteps.value.includes(key);
}

async function changeStatus(target: TaskStatus) {
  if (!task.value || busy.value) return;
  busy.value = true;
  try {
    await api.post(`/tasks/${task.value.slug}/status`, { status: target });
    notify('success', `任务状态已更新为「${target === 'in_progress' ? '进行中' : target === 'review' ? '待验收' : '已完成'}」`);
    await load(task.value.slug);
    refreshOverview();
  } catch (err) {
    notifyError(err);
  } finally {
    busy.value = false;
  }
}

async function completeStep(step: TaskStep) {
  if (!task.value) return;
  busy.value = true;
  try {
    const draft = drafts[step.key];
    await api.patch(`/tasks/${task.value.slug}/steps/${step.key}`, {
      status: 'done',
      resultLog: draft?.resultLog ?? '',
      errorLog: draft?.errorLog ?? '',
      notes: draft?.notes ?? '',
    });
    notify('success', `步骤「${step.title}」已完成`);
    await load(task.value.slug);
    refreshOverview();
    const ordered = [...(task.value?.steps ?? [])].sort((a, b) => a.order - b.order);
    const currentIndex = ordered.findIndex((item) => item.key === step.key);
    const next = ordered[currentIndex + 1];
    if (next) openSteps.value = [next.key];
  } catch (err) {
    notifyError(err);
  } finally {
    busy.value = false;
  }
}

async function reopenStep(step: TaskStep) {
  if (!task.value) return;
  busy.value = true;
  try {
    await api.patch(`/tasks/${task.value.slug}/steps/${step.key}`, { status: 'todo' });
    notify('info', `步骤「${step.title}」已退回`);
    await load(task.value.slug);
    refreshOverview();
  } catch (err) {
    notifyError(err);
  } finally {
    busy.value = false;
  }
}

async function saveStepLogs(step: TaskStep) {
  if (!task.value) return;
  const draft = drafts[step.key];
  busy.value = true;
  try {
    await api.patch(`/tasks/${task.value.slug}/steps/${step.key}`, {
      resultLog: draft.resultLog,
      errorLog: draft.errorLog,
      notes: draft.notes,
    });
    notify('success', '步骤记录已保存');
    await load(task.value.slug);
  } catch (err) {
    notifyError(err);
  } finally {
    busy.value = false;
  }
}

async function saveTaskNotes() {
  if (!task.value) return;
  busy.value = true;
  try {
    await api.patch(`/tasks/${task.value.slug}`, {
      notes: notes.notes,
      blockers: notes.blockers,
      nextStep: notes.nextStep,
    });
    notesDirty.value = false;
    notify('success', '任务笔记已保存');
    await load(task.value.slug);
  } catch (err) {
    notifyError(err);
  } finally {
    busy.value = false;
  }
}

async function addRecord() {
  if (!task.value) return;
  const minutes = Number(logMinutes.value) || Math.max(1, Math.round(timerSeconds.value / 60));
  if (!minutes || minutes > 600) {
    notify('error', '请填写 1–600 分钟的有效时长');
    return;
  }
  busy.value = true;
  try {
    await api.post(`/tasks/${task.value.slug}/records`, {
      minutes,
      summary: logSummary.value.trim() || '工作台记录',
      stepKey: nextStep.value?.key ?? '',
    });
    notify('success', `已记录 ${minutes} 分钟`);
    logSummary.value = '';
    logMinutes.value = 0;
    resetTimer();
    await load(task.value.slug);
    refreshOverview();
  } catch (err) {
    notifyError(err);
  } finally {
    busy.value = false;
  }
}

function startTimer() {
  if (timerRunning.value) return;
  timerStartedAt.value = Date.now();
  timerRunning.value = true;
  persistTimer();
  stopTicking();
  timerHandle = setInterval(tickTimer, 1000);
}

function pauseTimer() {
  if (timerRunning.value && timerStartedAt.value) {
    timerAccumulated.value += Math.max(
      0,
      Math.floor((Date.now() - timerStartedAt.value) / 1000)
    );
  }
  timerStartedAt.value = null;
  timerRunning.value = false;
  timerSeconds.value = timerAccumulated.value;
  stopTicking();
  persistTimer();
}

function resetTimer() {
  stopTicking();
  timerRunning.value = false;
  timerStartedAt.value = null;
  timerAccumulated.value = 0;
  timerSeconds.value = 0;
  persistTimer();
}

async function copyCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    notify('success', '命令已复制');
  } catch {
    notify('error', '复制失败，请手动选择');
  }
}

function addSplitPart() {
  if (splitParts.length >= 8) return;
  splitParts.push({ title: '', objective: '', estimatedMinutes: 45 });
}

async function submitSplit() {
  if (!task.value) return;
  if (splitParts.some((part) => part.title.trim().length < 4 || part.objective.trim().length < 4)) {
    notify('error', '每个拆分任务的标题与目标至少 4 个字符');
    return;
  }
  splitSaving.value = true;
  try {
    await api.post(`/tasks/${task.value.slug}/split`, {
      parts: splitParts.map((part) => ({
        title: part.title.trim(),
        objective: part.objective.trim(),
        estimatedMinutes: Number(part.estimatedMinutes),
      })),
    });
    notify('success', '拆分完成，已生成自定义任务');
    splitOpen.value = false;
    splitParts.splice(0, splitParts.length, { title: '', objective: '', estimatedMinutes: 45 });
    await load(task.value.slug);
  } catch (err) {
    notifyError(err);
  } finally {
    splitSaving.value = false;
  }
}

function markDirty() {
  notesDirty.value = true;
}

function toDateInput(value: string | null) {
  const date = value ? new Date(value) : new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function openDue() {
  dueDraft.value = toDateInput(task.value?.dueDate ?? null);
  dueOpen.value = true;
}

function shiftDue(days: number) {
  const base = dueDraft.value ? new Date(`${dueDraft.value}T12:00:00`) : new Date();
  base.setDate(base.getDate() + days);
  dueDraft.value = toDateInput(base.toISOString());
}

async function saveDue() {
  if (!task.value) return;
  if (!dueDraft.value) {
    notify('error', '请选择新的截止日期');
    return;
  }
  dueSaving.value = true;
  try {
    const [year, month, day] = dueDraft.value.split('-').map(Number);
    const due = new Date(year, month - 1, day, 23, 59, 59, 999);
    await api.patch(`/tasks/${task.value.slug}`, { dueDate: due.toISOString() });
    notify('success', `已改期到 ${dueDraft.value}`);
    dueOpen.value = false;
    await load(task.value.slug);
    refreshOverview();
  } catch (err) {
    notifyError(err);
  } finally {
    dueSaving.value = false;
  }
}

function stepStatusLabel(step: TaskStep) {
  return step.status === 'done' ? '已完成' : '待完成';
}

watch(
  () => route.params.slug,
  (slug) => {
    if (!slug || String(slug) === task.value?.slug) return;
    pauseTimer();
    load(String(slug));
  }
);

onMounted(() => {
  window.addEventListener('beforeunload', pauseTimer);
  load();
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', pauseTimer);
  pauseTimer();
});
</script>

<template>
  <div class="page workbench-page">
    <StateBlock v-if="loading" variant="loading" title="打开任务工作台" description="正在加载步骤、资料与记录。" />
    <StateBlock v-else-if="error" variant="error" title="任务加载失败" :description="error">
      <template #action>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-sm" type="button" @click="load()">重试</button>
          <RouterLink to="/tasks" class="btn btn-sm">返回任务列表</RouterLink>
        </div>
      </template>
    </StateBlock>

    <template v-else-if="detail && task">
      <div class="wb-crumbs">
        <RouterLink to="/tasks" class="btn-link"><ArrowLeft :size="12" /> 每日任务</RouterLink>
        <span class="mono faint">/</span>
        <span class="mono text-xs faint">{{ phase?.shortTitle }} · W{{ task.week }} D{{ task.day }}</span>
        <span class="mono faint">/</span>
        <span class="mono text-xs faint">{{ task.slug }}</span>
      </div>

      <div class="wb-layout">
        <aside class="wb-queue">
          <div class="queue-head">
            <span class="mono text-xs faint">PHASE QUEUE</span>
            <button class="queue-filter mono" type="button" @click="onlyOpen = !onlyOpen">
              {{ onlyOpen ? '显示全部' : '只看未完成' }}
            </button>
          </div>
          <div class="queue-list">
            <button
              v-for="item in queue"
              :key="item.slug"
              class="queue-item"
              :class="{ current: item.slug === task.slug }"
              type="button"
              @click="router.push(`/tasks/${item.slug}`)"
            >
              <span class="queue-dot" :class="item.status" />
              <span class="queue-main">
                <span class="queue-title">{{ item.title }}</span>
                <span class="queue-sub mono">{{ item.stepDone }}/{{ item.stepTotal }} 步 · {{ STATUS_LABEL[item.status] }}</span>
              </span>
              <span class="queue-pct mono">{{ item.percent }}%</span>
            </button>
          </div>
          <div class="queue-foot">
            <span class="mono text-xs faint">{{ phase?.weeks }}</span>
            <RouterLink to="/roadmap" class="btn-link">路线图</RouterLink>
          </div>
        </aside>

        <main class="wb-main">
          <header class="task-head">
            <div class="task-head-top">
              <div class="flex gap-8">
                <StatusBadge :status="task.status" />
                <span v-if="task.optional" class="badge badge-idle no-dot">选修</span>
                <span class="chip mono"><Clock3 :size="10" /> 预计 {{ task.estimatedMinutes }}m</span>
                <span class="chip mono"><Timer :size="10" /> 实际 {{ detail.actualMinutes }}m</span>
                <span v-if="isOverdue(task.dueDate, task.status === 'done')" class="badge badge-danger">{{ relativeDay(task.dueDate) }}</span>
                <span v-else class="chip mono">{{ relativeDay(task.dueDate) }}</span>
              </div>
              <div class="task-actions">
                <button class="btn btn-sm" type="button" @click="aiOpen = true">
                  <Sparkles :size="13" /> AI 协助
                </button>
                <button class="btn btn-sm" type="button" @click="splitOpen = true">
                  <Split :size="13" /> 拆分
                </button>
                <button class="btn btn-sm" type="button" @click="openDue">
                  <CalendarClock :size="13" /> 改期
                </button>
                <button
                  v-for="action in actions"
                  :key="action.target"
                  class="btn btn-sm"
                  :class="action.primary ? 'btn-primary' : ''"
                  type="button"
                  :disabled="busy || action.disabled"
                  :title="action.hint || ''"
                  @click="changeStatus(action.target)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>

            <h1 class="task-title-h1">{{ task.title }}</h1>
            <p class="task-objective">{{ task.objective }}</p>
            <p v-if="task.optional" class="task-optional-note">
              选做任务：不计入阶段完成率、逾期统计与主线解锁条件，没有群晖设备时可以直接跳过。
            </p>
            <p v-if="task.problem" class="task-problem"><span class="mono text-xs faint">CONTEXT</span> {{ task.problem }}</p>

            <div class="task-meta-row">
              <div class="flex gap-6">
                <span v-for="tag in task.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
              <div class="flex gap-10 mono text-xs faint">
                <span>{{ doneSteps }}/{{ task.steps.length }} 步骤</span>
                <span v-if="task.startedAt">开始 {{ formatDate(task.startedAt) }}</span>
                <span v-if="task.completedAt">完成 {{ formatDate(task.completedAt) }}</span>
              </div>
            </div>

            <div class="task-progress-bar">
              <ProgressBar :value="progress" />
              <span class="mono text-xs">{{ progress }}%</span>
            </div>

            <div v-if="task.acceptance.length" class="acceptance-box">
              <div class="block-label mono"><Target :size="12" /> 任务验收标准</div>
              <ul class="accept-list">
                <li v-for="item in task.acceptance" :key="item"><CheckCircle2 :size="12" /><span>{{ item }}</span></li>
              </ul>
            </div>
          </header>

          <section class="steps-section">
            <div class="section-head">
              <div class="panel-title"><ListChecks :size="15" /> 步骤工作台</div>
              <span class="mono text-xs faint">完成当前步骤后解锁下一个 · 卡住时展开步骤里的「参考答案」</span>
            </div>

            <div v-if="!task.steps.length" class="mini-empty">
              这个任务没有拆解步骤。你可以直接推进状态，或使用「拆分」创建更小的任务。
            </div>

            <article
              v-for="(step, index) in [...task.steps].sort((a, b) => a.order - b.order)"
              :key="step.key"
              class="step-card"
              :class="{ done: step.status === 'done', locked: step.locked, open: isOpen(step.key) }"
            >
              <button class="step-head" type="button" :disabled="step.locked" @click="toggleStep(step.key)">
                <div class="step-index mono" :class="{ complete: step.status === 'done' }">
                  <Check v-if="step.status === 'done'" :size="13" />
                  <Lock v-else-if="step.locked" :size="11" />
                  <span v-else>{{ String(index + 1).padStart(2, '0') }}</span>
                </div>
                <div class="step-head-main">
                  <div class="step-title">{{ step.title }}</div>
                  <div class="step-goal">{{ step.goal }}</div>
                </div>
                <span v-if="step.reference" class="step-answer mono">参考答案</span>
                <span class="step-state mono" :class="step.status">{{ stepStatusLabel(step) }}</span>
                <ChevronDown :size="16" class="step-chev" />
              </button>

              <div v-if="isOpen(step.key) && !step.locked" class="step-body">
                <div v-if="step.principle" class="note-block">
                  <div class="block-label mono"><BookOpen :size="12" /> 原理解释</div>
                  <p>{{ step.principle }}</p>
                </div>
                <div v-if="step.setup" class="note-block">
                  <div class="block-label mono"><Terminal :size="12" /> 前置条件</div>
                  <p>{{ step.setup }}</p>
                </div>

                <div class="block-label mono mt-16">操作步骤</div>
                <MarkdownView :source="step.instructions" />

                <template v-if="step.commands && step.commands.length">
                  <div class="block-label mono mt-16">命令</div>
                  <div class="command-list">
                    <div v-for="command in step.commands" :key="command" class="command-row">
                      <span class="command-prompt mono">$</span>
                      <code class="mono">{{ command }}</code>
                      <button class="copy-btn" type="button" title="复制命令" @click="copyCommand(command)">
                        <Copy :size="12" />
                      </button>
                    </div>
                  </div>
                </template>

                <template v-if="step.code">
                  <div class="block-label mono mt-16"><FileCode2 :size="12" /> 参考代码</div>
                  <CodeBlock :code="step.code.content" :language="step.code.language" :file-path="step.code.filePath" />
                </template>

                <template v-if="step.expectedOutput">
                  <div class="block-label mono mt-16">预期输出</div>
                  <pre class="expected mono">{{ step.expectedOutput }}</pre>
                </template>

                <template v-if="step.pitfalls && step.pitfalls.length">
                  <div class="block-label mono mt-16"><AlertTriangle :size="12" /> 常见坑</div>
                  <div class="pitfalls">
                    <div v-for="pitfall in step.pitfalls" :key="pitfall.problem" class="pitfall">
                      <div class="pitfall-problem"><Bug :size="12" /> {{ pitfall.problem }}</div>
                      <div class="pitfall-solution">{{ pitfall.solution }}</div>
                    </div>
                  </div>
                </template>

                <template v-if="step.acceptance.length">
                  <div class="block-label mono mt-16">步骤验收</div>
                  <ul class="accept-list">
                    <li v-for="item in step.acceptance" :key="item"><Circle :size="10" /><span>{{ item }}</span></li>
                  </ul>
                </template>

                <details v-if="step.reference" class="solution">
                  <summary class="solution-head">
                    <span class="solution-title"><Sparkles :size="13" /> 参考答案</span>
                    <span class="solution-hint">先自己试，卡住了再展开对照</span>
                    <ChevronDown :size="14" class="solution-chev" />
                  </summary>
                  <div class="solution-body">
                    <MarkdownView :source="step.reference.approach" />

                    <template v-if="step.reference.commands && step.reference.commands.length">
                      <div class="block-label mono mt-16"><Terminal :size="12" /> 可直接执行的命令</div>
                      <div class="command-list">
                        <div v-for="command in step.reference.commands" :key="command" class="command-row">
                          <span class="command-prompt mono">$</span>
                          <code class="mono">{{ command }}</code>
                          <button class="copy-btn" type="button" title="复制命令" @click="copyCommand(command)">
                            <Copy :size="12" />
                          </button>
                        </div>
                      </div>
                    </template>

                    <template v-if="step.reference.files && step.reference.files.length">
                      <div class="block-label mono mt-16"><FileCode2 :size="12" /> 参考实现</div>
                      <div class="solution-files">
                        <CodeBlock
                          v-for="(file, fileIndex) in step.reference.files"
                          :key="fileIndex"
                          :code="file.content"
                          :language="file.language"
                          :file-path="file.filePath"
                        />
                      </div>
                    </template>

                    <template v-if="step.reference.verify && step.reference.verify.length">
                      <div class="block-label mono mt-16">做到这些才算完成</div>
                      <ul class="accept-list">
                        <li v-for="item in step.reference.verify" :key="item"><CheckCircle2 :size="12" /><span>{{ item }}</span></li>
                      </ul>
                    </template>
                  </div>
                </details>

                <div class="log-grid">
                  <div class="field">
                    <label class="field-label">运行结果 / 证据</label>
                    <textarea
                      v-model="drafts[step.key].resultLog"
                      class="textarea"
                      rows="3"
                      placeholder="记录命令输出、关键日志、测试结果或截图说明…"
                    />
                  </div>
                  <div class="field">
                    <label class="field-label">错误与修复</label>
                    <textarea
                      v-model="drafts[step.key].errorLog"
                      class="textarea"
                      rows="3"
                      placeholder="报错信息、定位过程、最终如何修复…"
                    />
                  </div>
                </div>
                <div class="field mt-12">
                  <label class="field-label">步骤笔记</label>
                  <textarea
                    v-model="drafts[step.key].notes"
                    class="textarea"
                    rows="2"
                    placeholder="这一小步的关键理解，面试时可以复述的内容…"
                  />
                </div>

                <div class="step-foot">
                  <div class="flex gap-8">
                    <button class="btn btn-sm" type="button" :disabled="busy" @click="saveStepLogs(step)">
                      <Save :size="12" /> 保存记录
                    </button>
                    <button
                      v-if="step.status === 'done'"
                      class="btn btn-sm btn-ghost"
                      type="button"
                      :disabled="busy"
                      @click="reopenStep(step)"
                    >
                      <RotateCcw :size="12" /> 撤销完成
                    </button>
                  </div>
                  <button
                    v-if="step.status !== 'done'"
                    class="btn btn-sm btn-primary"
                    type="button"
                    :disabled="busy"
                    @click="completeStep(step)"
                  >
                    <Check :size="13" /> 完成并解锁下一步
                  </button>
                  <span v-else class="done-mark mono"><CheckCircle2 :size="13" /> {{ formatDateTime(step.completedAt) }}</span>
                </div>
              </div>
            </article>
          </section>

          <footer class="task-nav">
            <RouterLink v-if="detail.previous" :to="`/tasks/${detail.previous.slug}`" class="task-nav-link">
              <ArrowLeft :size="14" />
              <span><span class="mono text-xs faint">PREV</span>{{ detail.previous.title }}</span>
            </RouterLink>
            <span v-else class="task-nav-empty mono text-xs">已经是阶段内第一个任务</span>
            <RouterLink v-if="detail.next" :to="`/tasks/${detail.next.slug}`" class="task-nav-link next">
              <span><span class="mono text-xs faint">NEXT</span>{{ detail.next.title }}</span>
              <ArrowRight :size="14" />
            </RouterLink>
            <span v-else class="task-nav-empty mono text-xs">已经是阶段内最后一个任务</span>
          </footer>
        </main>

        <aside class="wb-rail">
          <section class="rail-card timer-card">
            <div class="rail-head">
              <span class="mono text-xs faint">SESSION TIMER</span>
              <span class="mono text-xs" :class="timerRunning ? 'accent' : 'faint'">{{ timerRunning ? 'RUNNING' : 'PAUSED' }}</span>
            </div>
            <div class="timer-display mono">{{ formatClock(timerSeconds) }}</div>
            <div class="timer-actions">
              <button v-if="!timerRunning" class="btn btn-sm" type="button" @click="startTimer"><Play :size="12" /> 开始</button>
              <button v-else class="btn btn-sm" type="button" @click="pauseTimer"><Pause :size="12" /> 暂停</button>
              <button class="icon-btn small" type="button" title="重置计时" @click="resetTimer"><RotateCcw :size="13" /></button>
            </div>
            <div class="divider" />
            <div class="field">
              <label class="field-label">本次记录摘要</label>
              <input v-model="logSummary" class="input" placeholder="例如：调通 SSE 流式解析" />
            </div>
            <div class="flex gap-8 mt-8">
              <div class="field" style="flex: 1">
                <label class="field-label">分钟</label>
                <input v-model.number="logMinutes" class="input" type="number" min="1" max="600" placeholder="自动按计时" />
              </div>
              <button class="btn btn-sm btn-primary" style="margin-top: 22px" type="button" :disabled="busy" @click="addRecord">
                记录
              </button>
            </div>
            <p class="tiny-note">计时按任务保存在当前浏览器，刷新或切换页面不会丢；记录后才写入学习投入。</p>
          </section>

          <section class="rail-card">
            <div class="rail-head">
              <span class="mono text-xs faint">TASK NOTES</span>
              <span v-if="notesDirty" class="mono text-xs amber">未保存</span>
            </div>
            <div class="field mt-8">
              <label class="field-label">笔记</label>
              <textarea v-model="notes.notes" class="textarea" rows="3" placeholder="理解、命令、链接…" @input="markDirty" />
            </div>
            <div class="field mt-8">
              <label class="field-label">阻塞点</label>
              <textarea v-model="notes.blockers" class="textarea" rows="2" placeholder="卡住的原因、需要的帮助…" @input="markDirty" />
            </div>
            <div class="field mt-8">
              <label class="field-label">下一步</label>
              <textarea v-model="notes.nextStep" class="textarea" rows="2" placeholder="下次打开任务时先做什么…" @input="markDirty" />
            </div>
            <button class="btn btn-sm btn-block mt-12" type="button" :disabled="busy" @click="saveTaskNotes">
              <Save :size="12" /> 保存任务笔记
            </button>
          </section>

          <section v-if="detail.resources.length" class="rail-card">
            <div class="rail-head"><span class="mono text-xs faint">RESOURCES</span><span class="mono text-xs faint">{{ detail.resources.length }}</span></div>
            <div class="resource-stack">
              <a
                v-for="resource in detail.resources"
                :key="resource.slug"
                class="resource-item"
                :href="resource.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink :size="12" />
                <span class="resource-name">{{ resource.title }}</span>
                <span v-if="resource.official" class="official mono">official</span>
              </a>
            </div>
            <p class="tiny-note">
              资料最后核验：{{ detail.resources[0]?.lastVerifiedAt ? formatDate(detail.resources[0].lastVerifiedAt) : '未记录' }}
            </p>
          </section>

          <section v-if="detail.records.length" class="rail-card">
            <div class="rail-head"><span class="mono text-xs faint">TIME LOG</span><span class="mono text-xs faint">{{ formatMinutes(detail.actualMinutes) }}</span></div>
            <div class="record-stack">
              <div v-for="record in detail.records.slice(0, 6)" :key="record._id" class="record-item">
                <span class="record-dot" />
                <div class="record-main">
                  <div class="record-summary">{{ record.summary || '学习记录' }}</div>
                  <div class="record-meta mono">{{ formatDate(record.date) }} · {{ record.kind }}</div>
                </div>
                <span class="mono text-xs">{{ record.minutes }}m</span>
              </div>
            </div>
          </section>

          <section v-if="detail.prerequisiteTasks.length" class="rail-card">
            <div class="rail-head"><span class="mono text-xs faint">PREREQUISITES</span></div>
            <RouterLink
              v-for="item in detail.prerequisiteTasks"
              :key="item.slug"
              :to="`/tasks/${item.slug}`"
              class="prereq-item"
            >
              <StatusBadge :status="item.status" />
              <span>{{ item.title }}</span>
            </RouterLink>
          </section>

          <section v-if="task.statusHistory.length" class="rail-card">
            <div class="rail-head"><span class="mono text-xs faint"><History :size="11" /> STATUS HISTORY</span></div>
            <div class="history-stack">
              <div v-for="(event, index) in [...task.statusHistory].reverse().slice(0, 6)" :key="index" class="history-item">
                <span class="history-dot" />
                <div>
                  <div class="text-xs">{{ event.status }}</div>
                  <div class="mono text-xs faint">{{ formatDateTime(event.at) }}<template v-if="event.note"> · {{ event.note }}</template></div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <ModalShell v-if="splitOpen" title="拆分为更小的任务" sub="拆分任务会加入当前阶段末尾，并保留原任务作为前置依赖。" wide @close="splitOpen = false">
      <div class="split-list">
        <div v-for="(part, index) in splitParts" :key="index" class="split-row">
          <span class="mono text-xs faint">{{ index + 1 }}</span>
          <div class="split-fields">
            <input v-model="part.title" class="input" placeholder="子任务标题" />
            <input v-model="part.objective" class="input" placeholder="子任务目标（可验证）" />
          </div>
          <input v-model.number="part.estimatedMinutes" class="input split-minutes" type="number" min="10" max="600" />
          <button
            class="icon-btn small"
            type="button"
            :disabled="splitParts.length === 1"
            aria-label="移除"
            @click="splitParts.splice(index, 1)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
      <button class="btn btn-sm btn-ghost mt-8" type="button" @click="addSplitPart"><Plus :size="12" /> 增加一项</button>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="splitOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="splitSaving" @click="submitSplit">创建拆分任务</button>
      </template>
    </ModalShell>

    <ModalShell v-if="dueOpen" title="调整截止日期" sub="改期只影响计划，不会改变任务状态与已完成记录。" @close="dueOpen = false">
      <div class="due-form">
        <label class="field-label">新的截止日期</label>
        <input v-model="dueDraft" class="input" type="date" />
        <div class="due-shifts">
          <button class="btn btn-sm btn-ghost" type="button" @click="shiftDue(-1)">提前 1 天</button>
          <button class="btn btn-sm btn-ghost" type="button" @click="shiftDue(1)">推迟 1 天</button>
          <button class="btn btn-sm btn-ghost" type="button" @click="shiftDue(3)">推迟 3 天</button>
          <button class="btn btn-sm btn-ghost" type="button" @click="shiftDue(7)">推迟一周</button>
        </div>
        <p class="text-xs faint">当前：{{ relativeDay(task?.dueDate ?? null) }}</p>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="dueOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="dueSaving" @click="saveDue">
          <span v-if="dueSaving" class="spinner" /> 保存日期
        </button>
      </template>
    </ModalShell>

    <div v-if="task?.notes" class="floating-hint mono">
      <NotebookPen :size="11" /> 任务有历史笔记
    </div>
  </div>
</template>

<style scoped>
.workbench-page {
  max-width: 1580px;
}

.wb-crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.wb-layout {
  display: grid;
  grid-template-columns: 226px minmax(0, 1fr) 292px;
  gap: 16px;
  align-items: start;
}

.wb-queue,
.wb-rail {
  position: sticky;
  top: calc(var(--topbar-height) + 16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-queue {
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(11, 17, 15, 0.72);
  overflow: hidden;
}

.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--line);
}

.queue-filter {
  border: 0;
  background: none;
  color: var(--faint);
  font-size: 9px;
  cursor: pointer;
  padding: 0;
}

.queue-filter:hover {
  color: var(--accent);
}

.queue-list {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding: 5px;
}

.queue-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  transition: 0.13s ease;
}

.queue-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.queue-item.current {
  background: var(--accent-soft);
}

.queue-dot {
  width: 6px;
  height: 6px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--faint);
  flex-shrink: 0;
}

.queue-dot.in_progress {
  background: var(--blue);
}

.queue-dot.review {
  background: var(--amber);
}

.queue-dot.done {
  background: var(--accent);
}

.queue-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.queue-title {
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.queue-item.current .queue-title {
  color: var(--text);
}

.queue-sub {
  font-size: 9px;
  color: var(--faint);
}

.queue-pct {
  font-size: 9px;
  color: var(--faint);
  margin-top: 1px;
}

.queue-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-top: 1px solid var(--line);
}

.wb-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.task-head {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(18, 27, 24, 0.92), rgba(12, 19, 17, 0.92));
}

.task-head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.task-title-h1 {
  margin-top: 12px;
  font-size: clamp(20px, 2.2vw, 25px);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.35;
}

.task-objective {
  margin-top: 7px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
  max-width: 820px;
}

.task-optional-note {
  margin-top: 9px;
  display: inline-block;
  padding: 6px 10px;
  border: 1px solid rgba(147, 197, 253, 0.25);
  border-radius: 6px;
  background: rgba(147, 197, 253, 0.06);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.task-problem {
  margin-top: 10px;
  padding: 9px 12px;
  border-left: 2px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.02);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.65;
  border-radius: 0 6px 6px 0;
}

.task-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.task-progress-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.task-progress-bar .progress {
  flex: 1;
}

.acceptance-box {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.block-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 6px;
}

.accept-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.accept-list li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11.8px;
  color: var(--muted);
  line-height: 1.5;
}

.accept-list svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--accent-strong);
}

.steps-section {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--line);
}

.step-card {
  border-bottom: 1px solid var(--line);
  transition: background 0.15s ease;
}

.step-card:last-child {
  border-bottom: 0;
}

.step-card.locked {
  opacity: 0.5;
}

.step-card.open {
  background: rgba(255, 255, 255, 0.012);
}

.step-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 18px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.step-head:disabled {
  cursor: not-allowed;
}

.step-index {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 7px;
  border: 1px solid var(--line-strong);
  background: var(--bg-soft);
  color: var(--muted);
  font-size: 10px;
}

.step-index.complete {
  color: var(--accent);
  border-color: rgba(110, 231, 168, 0.3);
  background: var(--accent-soft);
}

.step-head-main {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-size: 13.5px;
  font-weight: 570;
  color: var(--text-soft);
}

.step-goal {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--faint);
  line-height: 1.55;
}

.step-state {
  font-size: 9px;
  color: var(--faint);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
  flex-shrink: 0;
  margin-top: 3px;
}

.step-state.done {
  color: var(--accent);
  border-color: rgba(110, 231, 168, 0.22);
  background: var(--accent-soft);
}

.step-answer {
  flex-shrink: 0;
  margin-top: 3px;
  padding: 2px 6px;
  border: 1px solid rgba(147, 197, 253, 0.24);
  border-radius: 4px;
  background: rgba(147, 197, 253, 0.06);
  color: var(--blue);
  font-size: 9px;
  line-height: 1.5;
}

.step-chev {
  color: var(--faint);
  margin-top: 4px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.step-card.open .step-chev {
  transform: rotate(180deg);
}

.step-body {
  padding: 0 18px 18px 58px;
  animation: fade-in 0.18s ease;
}

.note-block {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.018);
}

.note-block p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.7;
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.command-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #080e0c;
}

.command-prompt {
  color: var(--accent);
  font-size: 11px;
  flex-shrink: 0;
}

.command-row code {
  flex: 1;
  font-size: 11.5px;
  color: #d7e6df;
  overflow-x: auto;
  white-space: nowrap;
}

.copy-btn {
  border: 0;
  background: transparent;
  color: var(--faint);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
}

.copy-btn:hover {
  color: var(--accent);
}

.expected {
  margin: 0;
  padding: 9px 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 7px;
  background: rgba(110, 231, 168, 0.03);
  color: #b9d9c7;
  font-family: var(--mono);
  font-size: 11.5px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.pitfalls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pitfall {
  padding: 8px 11px;
  border: 1px solid rgba(240, 198, 116, 0.2);
  border-radius: 7px;
  background: rgba(240, 198, 116, 0.04);
}

.pitfall-problem {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--amber);
}

.pitfall-solution {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.6;
}

.solution {
  margin-top: 16px;
  border: 1px solid rgba(147, 197, 253, 0.22);
  border-radius: 9px;
  background: rgba(147, 197, 253, 0.035);
  overflow: hidden;
}

.solution-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.solution-head::-webkit-details-marker {
  display: none;
}

.solution-head:hover {
  background: rgba(147, 197, 253, 0.05);
}

.solution-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--blue);
  font-size: 12px;
  font-weight: 550;
}

.solution-hint {
  flex: 1;
  color: var(--faint);
  font-size: 10.5px;
}

.solution-chev {
  color: var(--faint);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.solution[open] .solution-chev {
  transform: rotate(180deg);
}

.solution-body {
  padding: 2px 14px 14px;
  border-top: 1px dashed rgba(147, 197, 253, 0.18);
}

.solution-body :deep(.markdown) {
  margin-top: 10px;
}

.solution-body :deep(.markdown p),
.solution-body :deep(.markdown li) {
  font-size: 12px;
  line-height: 1.75;
}

.solution-body :deep(.markdown table) {
  font-size: 11.5px;
}

.solution-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.step-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
  flex-wrap: wrap;
}

.done-mark {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--accent);
}

.task-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}

.task-nav-link {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 46%;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--muted);
  font-size: 11.5px;
  transition: 0.14s ease;
}

.task-nav-link:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.task-nav-link.next {
  text-align: right;
  margin-left: auto;
}

.task-nav-link span {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.task-nav-link span > span {
  display: block;
}

.task-nav-empty {
  color: var(--faint);
}

.wb-rail {
  min-width: 0;
}

.rail-card {
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(11, 17, 15, 0.72);
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.timer-display {
  font-size: 29px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text);
  line-height: 1.2;
  margin: 4px 0 8px;
}

.timer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn.small {
  width: 27px;
  height: 27px;
  border: 0;
  background: transparent;
}

.icon-btn.small:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tiny-note {
  margin-top: 9px;
  font-size: 9.5px;
  color: var(--faint);
  line-height: 1.55;
}

.amber {
  color: var(--amber);
}

.resource-stack,
.record-stack,
.history-stack {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 5px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.resource-item:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--accent);
}

.resource-item svg {
  flex-shrink: 0;
  color: var(--faint);
}

.resource-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.official {
  font-size: 7.5px;
  color: var(--accent);
  border: 1px solid rgba(110, 231, 168, 0.2);
  border-radius: 3px;
  padding: 0 3px;
  flex-shrink: 0;
}

.record-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--line);
}

.record-item:last-child {
  border-bottom: 0;
}

.record-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  margin-top: 5px;
  flex-shrink: 0;
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-summary {
  font-size: 11px;
  color: var(--text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta {
  font-size: 9px;
  color: var(--faint);
}

.prereq-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 11px;
  color: var(--muted);
}

.prereq-item:last-child {
  border-bottom: 0;
}

.prereq-item:hover {
  color: var(--text);
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 4px 0;
}

.history-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--line-strong);
  margin-top: 6px;
  flex-shrink: 0;
}

.mini-empty {
  padding: 20px 18px;
  font-size: 11.5px;
  color: var(--faint);
  line-height: 1.6;
}

.split-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.split-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.split-fields {
  flex: 1;
  display: grid;
  gap: 6px;
}

.split-minutes {
  width: 78px;
}

.due-form {
  display: grid;
  gap: 10px;
}

.due-shifts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.due-form .text-xs {
  margin: 0;
}

.floating-hint {
  display: none;
}

@media (max-width: 1280px) {
  .wb-layout {
    grid-template-columns: 196px minmax(0, 1fr) 260px;
  }
}

@media (max-width: 1120px) {
  .wb-layout {
    grid-template-columns: minmax(0, 1fr) 286px;
  }
  .wb-queue {
    display: none;
  }
}

@media (max-width: 880px) {
  .wb-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .wb-rail {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .timer-card {
    grid-column: span 2;
  }
  .step-body {
    padding-left: 18px;
  }
  .log-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .wb-rail {
    grid-template-columns: 1fr;
  }
  .timer-card {
    grid-column: span 1;
  }
  .step-head {
    padding: 12px 14px;
    gap: 9px;
  }
  .step-state {
    display: none;
  }
  .task-actions {
    width: 100%;
  }
  .task-nav {
    flex-direction: column;
    align-items: stretch;
  }
  .task-nav-link {
    max-width: 100%;
  }
}
</style>
