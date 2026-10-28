<script setup lang="ts">
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Flame,
  FolderKanban,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-vue-next';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ProgressBar from '@/components/ProgressBar.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { formatDate, formatMinutes, greeting, isOverdue, relativeDay, todayLabel } from '@/lib/format';
import { useAppState } from '@/lib/appState';

const router = useRouter();
const { overview, overviewLoading, overviewError, refresh } = useAppState();

const recommended = computed(() => overview.value?.today.recommended ?? null);
const activePhase = computed(() => overview.value?.activePhase ?? null);
const stats = computed(() => overview.value?.stats);
const time = computed(() => overview.value?.time);
const plan = computed(() => overview.value?.plan);

const todayTasks = computed(() => overview.value?.today.tasks ?? []);
const issues = computed(() => overview.value?.openIssues ?? []);
const records = computed(() => overview.value?.recentRecords ?? []);

const weekActualPercent = computed(() => {
  const planned = time.value?.weekPlannedMinutes ?? 0;
  const actual = time.value?.weekActualMinutes ?? 0;
  if (!planned) return 0;
  return Math.min(100, Math.round((actual / planned) * 100));
});

const weekActualDisplay = computed(() => {
  const minutes = time.value?.weekActualMinutes ?? 0;
  if (minutes < 60) return { value: minutes, unit: '分钟' };
  return { value: Math.round(minutes / 6) / 10, unit: '小时' };
});

const ring = computed(() => {
  const value = stats.value?.completionRate ?? 0;
  return {
    background: `conic-gradient(var(--accent) ${value * 3.6}deg, rgba(255,255,255,.06) 0deg)`,
  };
});

function openRecommended() {
  if (recommended.value) router.push(`/tasks/${recommended.value.slug}`);
  else router.push('/tasks');
}

function goTask(slug: string) {
  router.push(`/tasks/${slug}`);
}

onMounted(() => refresh());
</script>

<template>
  <div class="page dashboard">
    <div class="page-head">
      <div>
        <div class="eyebrow">
          <span class="mono">OVERVIEW</span>
          <span class="dot online" />
          <span v-if="plan" class="mono">WEEK {{ plan.currentWeek }} / {{ plan.totalWeeks }}</span>
        </div>
        <h1 class="page-title">{{ greeting() }}，继续把系统跑起来。</h1>
        <p class="page-sub">
          {{ todayLabel() }} ·
          <template v-if="plan">{{ plan.roleTarget }}</template>
          目标不是"看完"，而是能运行、能验证、能解释。
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" type="button" :disabled="overviewLoading" @click="refresh()">
          <RefreshCw :size="14" :class="{ spinning: overviewLoading }" />
          刷新
        </button>
        <button class="btn btn-primary" type="button" @click="openRecommended">
          <Sparkles :size="15" />
          {{ recommended ? '继续学习' : '查看任务' }}
        </button>
      </div>
    </div>

    <StateBlock
      v-if="overviewError && !overview"
      variant="error"
      title="概览加载失败"
      :description="overviewError"
    >
      <template #action>
        <button class="btn btn-sm mt-8" type="button" @click="refresh()">重试</button>
      </template>
    </StateBlock>

    <template v-else-if="!overview">
      <div class="skeleton" style="height: 168px; margin-bottom: 16px" />
      <div class="grid grid-4 mb-16">
        <div v-for="i in 4" :key="i" class="skeleton" style="height: 92px" />
      </div>
      <div class="grid grid-2">
        <div class="skeleton" style="height: 300px" />
        <div class="skeleton" style="height: 300px" />
      </div>
    </template>

    <template v-else>
      <section class="hero hero-grid">
        <div class="hero-left">
          <div class="hero-kicker mono">
            <Target :size="13" />
            CURRENT PHASE · {{ activePhase?.weeks || '—' }}
          </div>
          <h2 class="hero-title">{{ activePhase?.title || '等待初始化学习计划' }}</h2>
          <p class="hero-goal">{{ activePhase?.goal }}</p>
          <div class="hero-progress">
            <div class="flex-between text-xs">
              <span class="muted">{{ activePhase?.tasksDone ?? 0 }} / {{ activePhase?.tasksTotal ?? 0 }} 个任务完成</span>
              <span class="mono accent">{{ activePhase?.percent ?? 0 }}%</span>
            </div>
            <ProgressBar :value="activePhase?.percent ?? 0" />
          </div>
          <div class="hero-meta">
            <span class="chip"><Clock3 :size="11" /> 每天 {{ plan?.dailyMinutes ?? 90 }} 分钟</span>
            <span class="chip"><CalendarCheck :size="11" /> 第 {{ plan?.currentWeek ?? 1 }} 周</span>
            <span class="chip"><ListChecks :size="11" /> 剩余 {{ (stats?.totalTasks ?? 0) - (stats?.doneTasks ?? 0) }} 个任务</span>
          </div>
        </div>

        <div class="focus-card">
          <div class="focus-head">
            <span class="mono text-xs faint">NEXT ACTION · 推荐下一步</span>
            <span v-if="recommended" class="tag accent">可立即开始</span>
          </div>
          <template v-if="recommended">
            <h3 class="focus-title">{{ recommended.title }}</h3>
            <p class="focus-objective">{{ recommended.objective }}</p>
            <div class="focus-meta mono">
              <span>{{ recommended.stepDone }}/{{ recommended.stepTotal }} 步</span>
              <span>约 {{ recommended.estimatedMinutes }} 分钟</span>
              <span :class="{ 'text-danger': isOverdue(recommended.dueDate, false) }">
                {{ relativeDay(recommended.dueDate) }}
              </span>
            </div>
            <div class="flex gap-8 mt-16">
              <button class="btn btn-primary btn-sm" type="button" @click="goTask(recommended.slug)">
                打开工作台 <ArrowRight :size="13" />
              </button>
              <RouterLink to="/tasks" class="btn btn-sm">全部任务</RouterLink>
            </div>
          </template>
          <StateBlock v-else variant="empty" title="所有任务已完成" description="可以进入复盘，或开始补充新的学习任务。" />
        </div>
      </section>

      <section class="grid grid-4 mt-16">
        <article class="card stat">
          <div class="stat-top">
            <span class="stat-label">总完成率</span>
            <div class="ring" :style="ring"><span>{{ stats?.completionRate ?? 0 }}%</span></div>
          </div>
          <div class="stat-value">{{ stats?.doneTasks ?? 0 }}<small>/ {{ stats?.totalTasks ?? 0 }}</small></div>
          <div class="stat-foot">已完成任务 · 未完成 {{ (stats?.totalTasks ?? 0) - (stats?.doneTasks ?? 0) }}</div>
        </article>

        <article class="card stat">
          <div class="stat-top">
            <span class="stat-label">进行中</span>
            <Activity :size="15" class="stat-icon blue" />
          </div>
          <div class="stat-value">{{ stats?.inProgressTasks ?? 0 }}<small>进行中</small></div>
          <div class="stat-foot">待验收 {{ stats?.reviewTasks ?? 0 }} · 未开始 {{ stats?.notStartedTasks ?? 0 }}</div>
        </article>

        <article class="card stat">
          <div class="stat-top">
            <span class="stat-label">本周投入</span>
            <Clock3 :size="15" class="stat-icon amber" />
          </div>
          <div class="stat-value">{{ weekActualDisplay.value }}<small>{{ weekActualDisplay.unit }}</small></div>
          <div class="stat-foot">计划 {{ formatMinutes(time?.weekPlannedMinutes ?? 0) }} · 完成 {{ weekActualPercent }}%</div>
        </article>

        <article class="card stat">
          <div class="stat-top">
            <span class="stat-label">连续学习</span>
            <Flame :size="15" class="stat-icon accent" />
          </div>
          <div class="stat-value">{{ time?.streak ?? 0 }}<small>天</small></div>
          <div class="stat-foot">
            累计 {{ time?.studyDays ?? 0 }} 个学习日 ·
            <span :class="{ 'text-danger': (stats?.overdueTasks ?? 0) > 0 }">逾期 {{ stats?.overdueTasks ?? 0 }}</span>
          </div>
        </article>
      </section>

      <div class="dashboard-grid mt-16">
        <div class="stack gap-16">
          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><CalendarCheck :size="15" /> 今日任务</div>
              <RouterLink to="/tasks" class="btn-link">全部任务 <ArrowRight :size="12" /></RouterLink>
            </div>
            <div v-if="todayTasks.length" class="task-list">
              <button
                v-for="task in todayTasks"
                :key="task.slug"
                class="data-row task-row"
                type="button"
                @click="goTask(task.slug)"
              >
                <div class="step-ring">{{ task.stepDone }}/{{ task.stepTotal }}</div>
                <div class="row-main">
                  <div class="row-title">{{ task.title }}</div>
                  <div class="row-sub">
                    {{ task.phaseTitle }} · 预计 {{ task.estimatedMinutes }} 分钟
                    <span v-if="isOverdue(task.dueDate, false)" class="text-danger"> · {{ relativeDay(task.dueDate) }}</span>
                  </div>
                </div>
                <div class="row-meta">
                  <StatusBadge :status="task.status" />
                </div>
              </button>
            </div>
            <StateBlock
              v-else
              variant="empty"
              title="今天没有到期任务"
              description="可以从推荐任务开始，或提前推进本周内容。"
            >
              <template #action>
                <button class="btn btn-sm mt-8" type="button" @click="openRecommended">打开推荐任务</button>
              </template>
            </StateBlock>
          </section>

          <section v-if="overview.project" class="panel project-panel">
            <div class="panel-head">
              <div class="panel-title"><FolderKanban :size="15" /> 主项目 · {{ overview.project.name }}</div>
              <RouterLink to="/project" class="btn-link">打开项目 <ArrowRight :size="12" /></RouterLink>
            </div>
            <div class="panel-body">
              <div class="flex-between mb-8">
                <span class="text-sm muted">里程碑 {{ overview.project.milestonesDone }}/{{ overview.project.milestonesTotal }} · 任务 {{ overview.project.tasksDone }}/{{ overview.project.tasksTotal }}</span>
                <span class="mono accent">{{ overview.project.percent }}%</span>
              </div>
              <ProgressBar :value="overview.project.percent" />
              <div class="project-next">
                <span class="mono text-xs faint">NEXT PROJECT TASK</span>
                <template v-if="overview.project.nextTask">
                  <div class="text-sm mt-4">{{ overview.project.nextTask.title }}</div>
                </template>
                <div v-else class="text-sm muted mt-4">所有项目任务已完成，检查部署与演示记录。</div>
              </div>
            </div>
          </section>
        </div>

        <div class="stack gap-16">
          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><Clock3 :size="15" /> 本周时间</div>
              <span class="mono text-xs faint">W{{ plan?.currentWeek ?? 1 }}</span>
            </div>
            <div class="panel-body">
              <div class="time-block">
                <div class="flex-between text-xs mb-8">
                  <span class="muted">实际投入</span>
                  <span class="mono">{{ formatMinutes(time?.weekActualMinutes ?? 0) }}</span>
                </div>
                <div class="time-track"><span :style="{ width: `${weekActualPercent}%` }" /></div>
              </div>
              <div class="time-block mt-16">
                <div class="flex-between text-xs mb-8">
                  <span class="muted">本周计划</span>
                  <span class="mono">{{ formatMinutes(time?.weekPlannedMinutes ?? 0) }}</span>
                </div>
                <div class="time-track planned"><span style="width: 100%" /></div>
              </div>
              <div class="time-facts">
                <div><b>{{ time?.studyDays ?? 0 }}</b><span>学习天数</span></div>
                <div><b>{{ time?.streak ?? 0 }}</b><span>连续天数</span></div>
                <div><b>{{ Math.round((time?.totalMinutes ?? 0) / 60) }}</b><span>累计小时</span></div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><TriangleAlert :size="15" /> 开放问题</div>
              <span class="mono text-xs faint">{{ issues.length }}</span>
            </div>
            <div v-if="issues.length">
              <div v-for="issue in issues" :key="issue.id" class="data-row issue-row">
                <span class="issue-kind mono">{{ issue.source === 'project' ? issue.kind : 'note' }}</span>
                <div class="row-main">
                  <div class="row-title">{{ issue.title }}</div>
                  <div class="row-sub">{{ issue.source === 'project' ? '项目记录' : '笔记' }} · {{ formatDate(issue.createdAt) }}</div>
                </div>
              </div>
            </div>
            <div v-else class="mini-empty">
              <CheckCircle2 :size="15" />
              没有待处理的开放问题。
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><ListChecks :size="15" /> 最近记录</div>
              <RouterLink to="/tasks" class="btn-link">记录时间</RouterLink>
            </div>
            <div v-if="records.length">
              <div v-for="record in records" :key="record.id" class="data-row record-row">
                <div class="record-dot" />
                <div class="row-main">
                  <div class="row-title">{{ record.summary || record.taskTitle }}</div>
                  <div class="row-sub">{{ record.taskTitle }} · {{ formatDate(record.date) }}</div>
                </div>
                <span class="mono text-xs faint">{{ record.minutes }}m</span>
              </div>
            </div>
            <div v-else class="mini-empty">
              还没有学习记录。在任务工作台里记录一次真实投入后，这里会出现时间线。
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 26px;
  align-items: stretch;
}

.hero-left {
  display: flex;
  flex-direction: column;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--accent);
  margin-bottom: 10px;
}

.hero-title {
  font-size: clamp(20px, 2.2vw, 26px);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.hero-goal {
  margin-top: 8px;
  max-width: 560px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.hero-progress {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 18px;
  max-width: 460px;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.focus-card {
  display: flex;
  flex-direction: column;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: rgba(8, 13, 11, 0.62);
  backdrop-filter: blur(6px);
}

.focus-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.focus-title {
  margin-top: 12px;
  font-size: 15.5px;
  font-weight: 620;
  line-height: 1.45;
}

.focus-objective {
  margin-top: 7px;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.focus-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
  font-size: 10.5px;
  color: var(--faint);
}

.stat {
  padding: 15px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}

.stat-icon {
  width: 15px;
  height: 15px;
}

.stat-icon.blue {
  color: var(--blue);
}
.stat-icon.amber {
  color: var(--amber);
}
.stat-icon.accent {
  color: var(--accent);
}

.stat-value {
  font-size: 27px;
  font-weight: 640;
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-family: var(--mono);
}

.stat-value small {
  margin-left: 5px;
  font-size: 11px;
  font-weight: 400;
  color: var(--faint);
  letter-spacing: 0;
}

.stat-foot {
  font-size: 11px;
  color: var(--faint);
}

.ring {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  position: relative;
}

.ring::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--surface);
}

.ring span {
  position: relative;
  z-index: 1;
  font-family: var(--mono);
  font-size: 8px;
  color: var(--accent);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  align-items: start;
}

.task-list {
  display: flex;
  flex-direction: column;
}

.task-row {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.task-row:last-child {
  border-bottom: 0;
}

.step-ring {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  font-family: var(--mono);
  font-size: 9.5px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.015);
}

.project-next {
  margin-top: 16px;
  padding-top: 13px;
  border-top: 1px dashed var(--line);
}

.time-block .time-track {
  height: 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.time-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-strong), var(--accent));
}

.time-track.planned > span {
  background: rgba(255, 255, 255, 0.16);
}

.time-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.time-facts div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.time-facts b {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 600;
}

.time-facts span {
  font-size: 10.5px;
  color: var(--faint);
}

.issue-row {
  align-items: flex-start;
  padding: 10px 16px;
}

.issue-kind {
  margin-top: 1px;
  font-size: 8.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--amber);
  border: 1px solid rgba(240, 198, 116, 0.25);
  background: var(--amber-soft);
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}

.record-row {
  padding: 10px 16px;
}

.record-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
  flex-shrink: 0;
}

.mini-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  color: var(--faint);
  font-size: 11.5px;
  line-height: 1.6;
}

.mini-empty svg {
  flex-shrink: 0;
  color: var(--accent);
}

.text-danger {
  color: var(--red);
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@media (max-width: 1080px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
