<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  ExternalLink,
  Lock,
  Pencil,
  Target,
} from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModalShell from '@/components/ModalShell.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import type { PlanResponse, Resource } from '@/types';

const router = useRouter();
const plan = ref<PlanResponse | null>(null);
const resources = ref<Resource[]>([]);
const loading = ref(true);
const error = ref('');
const expanded = ref<Record<string, boolean>>({});

const planModal = ref(false);
const phaseModal = ref(false);
const saving = ref(false);
const planForm = reactive({ name: '', roleTarget: '', startDate: '', totalWeeks: 12, dailyMinutes: 90 });
const phaseForm = reactive({ slug: '', title: '', goal: '' });

const phaseResources = computed(() => {
  const map = new Map<string, Resource[]>();
  for (const resource of resources.value) {
    const list = map.get(resource.phaseSlug) ?? [];
    list.push(resource);
    map.set(resource.phaseSlug, list);
  }
  return map;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [planData, resourceData] = await Promise.all([
      api.get<PlanResponse>('/plan'),
      api.get<Resource[]>('/resources'),
    ]);
    plan.value = planData;
    resources.value = resourceData;
    if (!Object.keys(expanded.value).length) {
      const active = planData.phases.find((phase) => phase.progress?.status === 'active');
      if (active) expanded.value[active.slug] = true;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '路线图加载失败';
  } finally {
    loading.value = false;
  }
}

function toggle(slug: string) {
  expanded.value[slug] = !expanded.value[slug];
}

const requiredCount = (tasks: { optional: boolean }[]) => tasks.filter((task) => !task.optional).length;
const optionalCount = (tasks: { optional: boolean }[]) => tasks.filter((task) => task.optional).length;

function openPlanModal() {
  if (!plan.value) return;
  planForm.name = plan.value.plan.name;
  planForm.roleTarget = plan.value.plan.roleTarget;
  planForm.startDate = plan.value.plan.startDate.slice(0, 10);
  planForm.totalWeeks = plan.value.plan.totalWeeks;
  planForm.dailyMinutes = plan.value.plan.dailyMinutes;
  planModal.value = true;
}

async function savePlan() {
  saving.value = true;
  try {
    await api.patch('/plan', {
      name: planForm.name,
      roleTarget: planForm.roleTarget,
      startDate: new Date(`${planForm.startDate}T00:00:00`).toISOString(),
      totalWeeks: Number(planForm.totalWeeks),
      dailyMinutes: Number(planForm.dailyMinutes),
    });
    notify('success', '学习计划已更新');
    planModal.value = false;
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '更新失败');
  } finally {
    saving.value = false;
  }
}

function openPhaseModal(slug: string) {
  const phase = plan.value?.phases.find((item) => item.slug === slug);
  if (!phase) return;
  phaseForm.slug = slug;
  phaseForm.title = phase.title;
  phaseForm.goal = phase.goal;
  phaseModal.value = true;
}

async function savePhase() {
  saving.value = true;
  try {
    await api.patch(`/phases/${phaseForm.slug}`, { title: phaseForm.title, goal: phaseForm.goal });
    notify('success', '阶段信息已更新');
    phaseModal.value = false;
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '更新失败');
  } finally {
    saving.value = false;
  }
}

async function movePhase(index: number, direction: -1 | 1) {
  if (!plan.value) return;
  const current = plan.value.phases[index];
  const target = plan.value.phases[index + direction];
  if (!current || !target) return;
  try {
    await Promise.all([
      api.patch(`/phases/${current.slug}`, { order: target.order }),
      api.patch(`/phases/${target.slug}`, { order: current.order }),
    ]);
    notify('success', '阶段顺序已调整');
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '调整失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">ROADMAP</span><span class="dot online" />7 个阶段 · 12 周</div>
        <h1 class="page-title">学习路线</h1>
        <p class="page-sub" v-if="plan">
          {{ plan.plan.summary }} 目标角色：{{ plan.plan.roleTarget }}。
        </p>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" @click="openPlanModal">调整计划</button>
        <RouterLink to="/tasks" class="btn btn-primary">进入每日任务</RouterLink>
      </div>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载学习路线" description="正在读取阶段、任务与资料关联。" />
    <StateBlock v-else-if="error" variant="error" title="路线加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load">重试</button></template>
    </StateBlock>

    <div v-else-if="plan" class="roadmap">
      <div class="roadmap-summary">
        <div>
          <span class="mono text-xs faint">START</span>
          <b>{{ formatDate(plan.plan.startDate) }}</b>
        </div>
        <div>
          <span class="mono text-xs faint">DURATION</span>
          <b>{{ plan.plan.totalWeeks }} 周</b>
        </div>
        <div>
          <span class="mono text-xs faint">DAILY</span>
          <b>{{ plan.plan.dailyMinutes }} 分钟</b>
        </div>
        <div>
          <span class="mono text-xs faint">WEEK</span>
          <b>第 {{ plan.plan.currentWeek }} 周</b>
        </div>
        <div class="summary-progress">
          <span class="mono text-xs faint">OVERALL</span>
          <div class="flex gap-8">
            <ProgressBar :value="plan.totals.completionRate" style="min-width: 90px" />
            <b class="mono">{{ plan.totals.completionRate }}%</b>
          </div>
        </div>
      </div>

      <div class="phase-list">
        <article
          v-for="(phase, index) in plan.phases"
          :key="phase.slug"
          class="phase"
          :class="[phase.progress?.status, { open: expanded[phase.slug] }]"
        >
          <div class="phase-rail">
            <div class="phase-number mono">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="phase-line" />
          </div>

          <div class="phase-card card">
            <div class="phase-head" @click="toggle(phase.slug)">
              <div class="phase-head-main">
                <div class="phase-titles">
                  <div class="flex gap-8">
                    <h2 class="phase-title">{{ phase.title }}</h2>
                    <StatusBadge :status="phase.progress?.status || 'locked'" />
                    <span v-if="phase.progress?.status === 'locked'" class="lock-note mono">
                      <Lock :size="10" /> 需先完成前一阶段
                    </span>
                  </div>
                  <div class="phase-meta mono">
                    <span>{{ phase.weeks }}</span>
                    <span>·</span>
                    <span>{{ phase.estimatedHours }}h</span>
                    <span>·</span>
                    <span>{{ phase.progress?.tasksDone ?? 0 }}/{{ phase.progress?.tasksTotal ?? 0 }} 任务</span>
                  </div>
                </div>
                <div class="phase-right">
                  <div class="phase-percent mono">{{ phase.progress?.percent ?? 0 }}%</div>
                  <ChevronDown :size="17" class="chev" />
                </div>
              </div>
              <div class="phase-progress-line">
                <ProgressBar :value="phase.progress?.percent ?? 0" thin />
              </div>
            </div>

            <div class="phase-body">
              <div class="phase-grid">
                <div class="phase-col">
                  <div class="block-label mono"><Target :size="12" /> 阶段目标</div>
                  <p class="phase-text">{{ phase.goal }}</p>
                  <template v-if="phase.why">
                    <div class="block-label mono mt-16">为什么现在学</div>
                    <p class="phase-text muted">{{ phase.why }}</p>
                  </template>
                  <div class="block-label mono mt-16">知识点</div>
                  <div class="chip-wrap">
                    <span v-for="item in phase.knowledge" :key="item" class="chip">{{ item }}</span>
                  </div>
                  <div class="block-label mono mt-16">产出</div>
                  <p class="phase-text">{{ phase.deliverable || '—' }}</p>
                </div>

                <div class="phase-col">
                  <div class="block-label mono">阶段验收</div>
                  <ul class="accept-list">
                    <li v-for="item in phase.acceptance" :key="item">
                      <CheckCircle2 :size="13" />
                      <span>{{ item }}</span>
                    </li>
                  </ul>
                  <div class="block-label mono mt-16">解锁条件</div>
                  <p class="phase-text muted">{{ phase.unlockCondition }}</p>
                  <div v-if="phase.prerequisites.length" class="block-label mono mt-16">先修要求</div>
                  <div class="chip-wrap">
                    <span v-for="item in phase.prerequisites" :key="item" class="chip">{{ item }}</span>
                  </div>
                  <div v-if="phase.evaluation" class="evaluation">
                    <StatusBadge :status="phase.evaluation.result" />
                    <span class="text-xs muted">阶段验收得分 {{ phase.evaluation.score }}</span>
                  </div>
                </div>
              </div>

              <div class="tasks-block">
                <div class="flex-between mb-8">
                  <div class="block-label mono"><Clock3 :size="12" /> 阶段任务</div>
                  <span class="mono text-xs faint">
                    {{ requiredCount(phase.tasks) }} 必修<template v-if="optionalCount(phase.tasks)"> · {{ optionalCount(phase.tasks) }} 选修</template>
                  </span>
                </div>
                <div class="phase-tasks">
                  <button
                    v-for="task in phase.tasks"
                    :key="task.slug"
                    class="phase-task"
                    type="button"
                    @click="router.push(`/tasks/${task.slug}`)"
                  >
                    <Circle v-if="task.status === 'not_started'" :size="13" class="task-dot" />
                    <CheckCircle2 v-else-if="task.status === 'done'" :size="13" class="task-dot done" />
                    <Clock3 v-else :size="13" class="task-dot active" />
                    <span class="task-name">{{ task.title }}</span>
                    <span v-if="task.optional" class="badge badge-idle no-dot">选修</span>
                    <span class="mono text-xs faint">{{ task.stepDone }}/{{ task.stepTotal }}</span>
                    <StatusBadge :status="task.status" />
                  </button>
                </div>
              </div>

              <div v-if="(phaseResources.get(phase.slug) || []).length" class="resources-block">
                <div class="block-label mono mb-8">关联资料</div>
                <div class="resource-links">
                  <a
                    v-for="resource in (phaseResources.get(phase.slug) || []).slice(0, 5)"
                    :key="resource.slug"
                    :href="resource.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="resource-link"
                  >
                    <ExternalLink :size="11" />
                    <span>{{ resource.title }}</span>
                    <span v-if="resource.official" class="official mono">official</span>
                  </a>
                </div>
              </div>

              <div class="phase-foot">
                <div class="flex gap-6">
                  <button
                    class="icon-btn small"
                    type="button"
                    title="上移阶段"
                    :disabled="index === 0"
                    @click="movePhase(index, -1)"
                  >
                    <ArrowUp :size="13" />
                  </button>
                  <button
                    class="icon-btn small"
                    type="button"
                    title="下移阶段"
                    :disabled="index === plan.phases.length - 1"
                    @click="movePhase(index, 1)"
                  >
                    <ArrowDown :size="13" />
                  </button>
                  <button class="btn btn-sm btn-ghost" type="button" @click="openPhaseModal(phase.slug)">
                    <Pencil :size="12" /> 编辑阶段
                  </button>
                </div>
                <RouterLink
                  to="/tasks"
                  class="btn-link"
                  @click="expanded[phase.slug] = true"
                >
                  查看任务
                </RouterLink>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>

    <ModalShell v-if="planModal" title="调整学习计划" sub="调整开始日期会重算当前周与任务截止日期。" @close="planModal = false">
      <div class="form-grid">
        <div class="field">
          <label class="field-label">计划名称</label>
          <input v-model="planForm.name" class="input" />
        </div>
        <div class="field">
          <label class="field-label">目标角色</label>
          <input v-model="planForm.roleTarget" class="input" />
        </div>
        <div class="form-row">
          <div class="field">
            <label class="field-label">开始日期</label>
            <input v-model="planForm.startDate" class="input" type="date" />
          </div>
          <div class="field">
            <label class="field-label">总周数</label>
            <input v-model.number="planForm.totalWeeks" class="input" type="number" min="4" max="52" />
          </div>
        </div>
        <div class="field">
          <label class="field-label">每日学习时长（分钟）</label>
          <input v-model.number="planForm.dailyMinutes" class="input" type="number" min="15" max="600" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="planModal = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="savePlan">保存计划</button>
      </template>
    </ModalShell>

    <ModalShell v-if="phaseModal" title="编辑阶段" @close="phaseModal = false">
      <div class="form-grid">
        <div class="field">
          <label class="field-label">阶段名称</label>
          <input v-model="phaseForm.title" class="input" />
        </div>
        <div class="field">
          <label class="field-label">阶段目标</label>
          <textarea v-model="phaseForm.goal" class="textarea" rows="4" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="phaseModal = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="savePhase">保存</button>
      </template>
    </ModalShell>
  </div>
</template>

<style scoped>
.roadmap-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, auto)) 1fr;
  gap: 26px;
  align-items: end;
  padding: 14px 18px;
  margin-bottom: 24px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(12, 19, 17, 0.68);
}

.roadmap-summary > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.roadmap-summary b {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--mono);
  color: var(--text-soft);
}

.summary-progress {
  align-items: flex-end;
}

.phase-list {
  display: flex;
  flex-direction: column;
}

.phase {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 16px;
}

.phase-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 14px;
}

.phase-number {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--faint);
  font-size: 10px;
}

.phase.active .phase-number {
  color: var(--accent);
  border-color: rgba(110, 231, 168, 0.35);
  background: var(--accent-soft);
  box-shadow: 0 0 18px rgba(110, 231, 168, 0.08);
}

.phase.completed .phase-number {
  color: var(--accent);
  border-color: rgba(110, 231, 168, 0.25);
}

.phase-line {
  flex: 1;
  width: 1px;
  background: var(--line);
  margin: 6px 0;
}

.phase:last-child .phase-line {
  display: none;
}

.phase-card {
  margin-bottom: 16px;
  overflow: hidden;
}

.phase-head {
  padding: 16px 18px 0;
  cursor: pointer;
  user-select: none;
}

.phase-head-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 12px;
}

.phase-title {
  font-size: 15.5px;
  font-weight: 620;
  letter-spacing: -0.01em;
}

.lock-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  color: var(--faint);
}

.phase-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
  font-size: 10.5px;
  color: var(--faint);
}

.phase-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.phase-percent {
  font-size: 12px;
  color: var(--muted);
}

.chev {
  color: var(--faint);
  transition: transform 0.2s ease;
}

.phase.open .chev {
  transform: rotate(180deg);
}

.phase-progress-line {
  padding-bottom: 10px;
}

.phase-body {
  display: none;
  padding: 4px 18px 16px;
  border-top: 1px solid var(--line);
}

.phase.open .phase-body {
  display: block;
  animation: fade-in 0.2s ease;
}

.phase-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 30px;
  padding-top: 16px;
}

.block-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 7px;
}

.phase-text {
  font-size: 12.5px;
  color: var(--text-soft);
  line-height: 1.7;
}

.phase-text.muted {
  color: var(--muted);
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.accept-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.accept-list li {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.55;
}

.accept-list svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent);
}

.evaluation {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.tasks-block,
.resources-block {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.phase-tasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.phase-task {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  font-size: 12px;
  cursor: pointer;
  transition: 0.13s ease;
}

.phase-task:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
}

.task-dot {
  color: var(--faint);
  flex-shrink: 0;
}

.task-dot.done {
  color: var(--accent);
}

.task-dot.active {
  color: var(--blue);
}

.task-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.resource-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--muted);
  font-size: 11px;
  transition: 0.14s ease;
}

.resource-link:hover {
  color: var(--accent);
  border-color: rgba(110, 231, 168, 0.3);
}

.official {
  font-size: 8px;
  color: var(--accent);
  border: 1px solid rgba(110, 231, 168, 0.2);
  border-radius: 3px;
  padding: 0 3px;
}

.phase-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.icon-btn.small {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
}

.icon-btn.small:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .roadmap-summary {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .summary-progress {
    grid-column: span 2;
    align-items: flex-start;
  }
  .phase {
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 10px;
  }
  .phase-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .phase-number {
    width: 26px;
    height: 26px;
  }
}
</style>
