<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import ModalShell from '@/components/ModalShell.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { formatDateTime, formatMinutes, percentOf } from '@/lib/format';
import { notify } from '@/lib/toast';
import type { PlanResponse, WeeklyReview } from '@/types';

interface PhaseAcceptance {
  phaseSlug: string;
  title: string;
  tasksTotal: number;
  tasksDone: number;
  evaluation: { result: string; score: number; evaluatedAt: string } | null;
}

interface Evaluation {
  _id: string;
  scope: string;
  targetSlug: string;
  title: string;
  criteria: string;
  evidence: string;
  result: 'pass' | 'fail' | 'partial';
  score: number;
  notes: string;
  evaluatedAt: string | null;
}

const plan = ref<PlanResponse | null>(null);
const reviews = ref<WeeklyReview[]>([]);
const acceptance = ref<PhaseAcceptance[]>([]);
const evaluations = ref<Evaluation[]>([]);
const loading = ref(true);
const error = ref('');

const week = ref(1);
const review = ref<WeeklyReview | null>(null);
const reviewLoading = ref(false);
const reviewError = ref('');
const generating = ref(false);
const saving = ref(false);

const form = reactive({
  newSkills: '',
  shipped: '',
  testResults: '',
  challenges: '',
  unfinished: '',
  nextWeekPlan: '',
});

const evalOpen = ref(false);
const evalSaving = ref(false);
const evalError = ref('');
const evalForm = reactive({
  targetSlug: '',
  title: '',
  criteria: '',
  evidence: '',
  result: 'pass' as 'pass' | 'fail' | 'partial',
  score: 80,
  notes: '',
});

const RESULT_LABEL: Record<string, string> = { pass: '通过', partial: '部分通过', fail: '未通过' };

const totalWeeks = computed(() => plan.value?.plan.totalWeeks ?? 12);
const currentWeek = computed(() => plan.value?.plan.currentWeek ?? 1);
const existingWeeks = computed(() => new Set(reviews.value.map((item) => item.week)));
const reviewStatus = computed(() => review.value?.status ?? 'draft');

const snapshot = computed(() => review.value?.metricsSnapshot ?? null);

const evidenceCount = computed(() =>
  (form.shipped.trim() ? 1 : 0) +
  (form.testResults.trim() ? 1 : 0) +
  (form.newSkills.trim() ? 1 : 0)
);

async function loadBase() {
  loading.value = true;
  error.value = '';
  try {
    const [planData, reviewList, phaseList, evaluationList] = await Promise.all([
      api.get<PlanResponse>('/plan'),
      api.get<WeeklyReview[]>('/reviews'),
      api.get<PhaseAcceptance[]>('/phase-acceptance'),
      api.get<Evaluation[]>('/evaluations'),
    ]);
    plan.value = planData;
    reviews.value = reviewList;
    acceptance.value = phaseList;
    evaluations.value = evaluationList;
    week.value = planData.plan.currentWeek;
    await selectWeek(week.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复盘数据加载失败';
  } finally {
    loading.value = false;
  }
}

function syncForm(value: WeeklyReview | null) {
  form.newSkills = value?.newSkills ?? '';
  form.shipped = value?.shipped ?? '';
  form.testResults = value?.testResults ?? '';
  form.challenges = value?.challenges ?? '';
  form.unfinished = value?.unfinished ?? '';
  form.nextWeekPlan = value?.nextWeekPlan ?? '';
}

async function selectWeek(value: number) {
  week.value = value;
  reviewLoading.value = true;
  reviewError.value = '';
  try {
    const data = await api.get<WeeklyReview>(`/reviews/${value}`);
    review.value = data;
    syncForm(data);
  } catch (err) {
    review.value = null;
    syncForm(null);
    const message = err instanceof Error ? err.message : '';
    if (!message.includes('尚未生成')) reviewError.value = message;
  } finally {
    reviewLoading.value = false;
  }
}

async function refreshLists() {
  const [reviewList, phaseList, evaluationList] = await Promise.all([
    api.get<WeeklyReview[]>('/reviews'),
    api.get<PhaseAcceptance[]>('/phase-acceptance'),
    api.get<Evaluation[]>('/evaluations'),
  ]);
  reviews.value = reviewList;
  acceptance.value = phaseList;
  evaluations.value = evaluationList;
}

async function generate() {
  generating.value = true;
  try {
    const result = await api.post<{ review: WeeklyReview; generated: boolean; message?: string }>(
      `/reviews/${week.value}/generate`
    );
    notify(result.generated ? 'success' : 'info', result.message || `第 ${week.value} 周复盘已汇总`);
    await refreshLists();
    await selectWeek(week.value);
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '生成失败');
  } finally {
    generating.value = false;
  }
}

async function save(final = false) {
  if (!review.value) return;
  if (final) {
    const missing: string[] = [];
    if (!form.newSkills.trim()) missing.push('新掌握技能');
    if (!form.challenges.trim()) missing.push('遇到的难题');
    if (!form.nextWeekPlan.trim()) missing.push('下周计划');
    if (missing.length) return notify('error', `定稿前请填写：${missing.join('、')}`);
  }
  saving.value = true;
  try {
    const updated = await api.patch<WeeklyReview>(`/reviews/${week.value}`, {
      ...form,
      status: final ? 'final' : 'draft',
    });
    review.value = { ...review.value, ...updated };
    notify('success', final ? '本周复盘已定稿' : '复盘草稿已保存');
    await refreshLists();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

function openEvaluation(item: PhaseAcceptance) {
  evalForm.targetSlug = item.phaseSlug;
  evalForm.title = `${item.title} · 阶段验收`;
  evalForm.criteria = '完成该阶段全部任务，能独立演示并通过可复现的测试/代码证据。';
  evalForm.evidence = '';
  evalForm.result = 'pass';
  evalForm.score = 80;
  evalForm.notes = '';
  evalError.value = '';
  evalOpen.value = true;
}

async function submitEvaluation() {
  evalError.value = '';
  if (evalForm.evidence.trim().length < 10) {
    return (evalError.value = '验收证据至少 10 个字符：请写明可复现的代码、测试输出或演示结果');
  }
  evalSaving.value = true;
  try {
    await api.post('/evaluations', {
      scope: 'phase',
      targetSlug: evalForm.targetSlug,
      title: evalForm.title,
      criteria: evalForm.criteria,
      evidence: evalForm.evidence,
      result: evalForm.result,
      score: Number(evalForm.score),
      notes: evalForm.notes,
    });
    notify('success', '验收记录已保存');
    evalOpen.value = false;
    await refreshLists();
  } catch (err) {
    evalError.value = err instanceof Error ? err.message : '验收保存失败';
  } finally {
    evalSaving.value = false;
  }
}

onMounted(loadBase);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">REVIEW</span><span class="dot online" />第 {{ currentWeek }} 周 · {{ reviews.length }} 份复盘</div>
        <h1 class="page-title">周复盘与验收</h1>
        <p class="page-sub">复盘从任务状态、学习记录和笔记自动汇数据；通过验收必须有可复现的证据，读一遍不算掌握。</p>
      </div>
      <div class="page-actions">
        <div class="week-switcher">
          <button class="icon-btn week-btn" type="button" :disabled="week <= 1" @click="selectWeek(week - 1)">
            <ArrowLeft :size="14" />
          </button>
          <select class="select week-select" :value="week" @change="selectWeek(Number(($event.target as HTMLSelectElement).value))">
            <option v-for="n in totalWeeks" :key="n" :value="n">
              第 {{ n }} 周{{ n === currentWeek ? '（本周）' : existingWeeks.has(n) ? ' · 已复盘' : '' }}
            </option>
          </select>
          <button class="icon-btn week-btn" type="button" :disabled="week >= totalWeeks" @click="selectWeek(week + 1)">
            <ArrowRight :size="14" />
          </button>
        </div>
        <button class="btn btn-primary" type="button" :disabled="generating" @click="generate">
          <span v-if="generating" class="spinner" />
          <Sparkles v-else :size="14" />
          汇总本周
        </button>
      </div>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载复盘数据" description="正在读取周复盘、阶段验收与评估记录。" />
    <StateBlock v-else-if="error" variant="error" title="复盘加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="loadBase">重试</button></template>
    </StateBlock>

    <div v-else class="review-layout">
      <section class="review-main">
        <div v-if="reviewLoading && !review" class="review-loading">
          <span class="spinner" /> 正在读取第 {{ week }} 周复盘…
        </div>
        <StateBlock v-else-if="reviewError" variant="error" title="复盘读取失败" :description="reviewError">
          <template #action><button class="btn btn-sm mt-8" type="button" @click="selectWeek(week)">重试</button></template>
        </StateBlock>

        <div v-else-if="!review" class="review-empty">
          <div class="review-empty-icon"><ClipboardCheck :size="22" /></div>
          <h2>第 {{ week }} 周还没有复盘</h2>
          <p>
            汇总会统计本周任务完成情况、学习时长、记录条数和笔记数量，生成草稿。
            之后你再补充结论，填写完必填项才能定稿。
          </p>
          <button class="btn btn-primary" type="button" :disabled="generating" @click="generate">
            <Sparkles :size="14" /> 从真实记录生成本周复盘
          </button>
        </div>

        <template v-else>
          <div class="review-banner">
            <div class="flex-between gap-10" style="align-items: flex-start; flex-wrap: wrap">
              <div>
                <div class="flex gap-8" style="align-items: center">
                  <h2>第 {{ week }} 周复盘</h2>
                  <StatusBadge :status="reviewStatus" />
                </div>
                <p class="text-xs faint mt-4">
                  {{ reviewStatus === 'final' ? '已定稿，汇总不会再覆盖正文。' : '草稿：汇总可刷新，正文由你确认。' }}
                  · 更新于 {{ formatDateTime(review.updatedAt) }}
                </p>
              </div>
              <button class="btn btn-sm" type="button" :disabled="generating" @click="generate">
                <RefreshCw :size="12" /> 重新汇总数据
              </button>
            </div>

            <div v-if="snapshot" class="review-metrics">
              <div>
                <span class="mono text-xs faint">任务</span>
                <b>{{ snapshot.tasksDone }}<em>/{{ snapshot.tasksTotal }}</em></b>
                <ProgressBar :value="percentOf(snapshot.tasksDone, snapshot.tasksTotal)" thin />
              </div>
              <div>
                <span class="mono text-xs faint">学习时长</span>
                <b>{{ formatMinutes(snapshot.actualMinutes) }}</b>
                <span class="text-xs faint">计划 {{ formatMinutes(snapshot.plannedMinutes) }}</span>
              </div>
              <div>
                <span class="mono text-xs faint">学习天数</span>
                <b>{{ snapshot.studyDays }}<em> 天</em></b>
                <span class="text-xs faint">{{ snapshot.recordsCount }} 条记录</span>
              </div>
              <div>
                <span class="mono text-xs faint">笔记</span>
                <b>{{ snapshot.notesCount }}<em> 条</em></b>
                <span class="text-xs faint">进行中 {{ snapshot.tasksInProgress }}</span>
              </div>
            </div>
          </div>

          <div class="review-form">
            <div class="review-field">
              <label class="review-label">新掌握的技能 <span class="mono text-xs faint">必填 · 写清能做什么</span></label>
              <textarea v-model="form.newSkills" class="textarea" rows="3" placeholder="例如：能用 Zod 校验工具入参，并为失败路径写集成测试。" />
            </div>
            <div class="review-field">
              <label class="review-label">本周交付 / 产出</label>
              <textarea v-model="form.shipped" class="textarea" rows="3" placeholder="提交、演示、文档、可复现实验…" />
            </div>
            <div class="review-field">
              <label class="review-label">测试与验证结果</label>
              <textarea v-model="form.testResults" class="textarea mono" rows="3" placeholder="例如：npm test 20 passed；手动验证了只读工具越权返回 403。" />
            </div>
            <div class="review-field">
              <label class="review-label">未完成事项</label>
              <textarea v-model="form.unfinished" class="textarea" rows="3" placeholder="未完成任务及原因，可直接使用自动汇总。" />
            </div>
            <div class="review-field">
              <label class="review-label">遇到的难题与解决方式 <span class="mono text-xs faint">必填</span></label>
              <textarea v-model="form.challenges" class="textarea" rows="3" placeholder="卡在哪里？如何定位？最后的结论是什么？" />
            </div>
            <div class="review-field">
              <label class="review-label">下周计划 <span class="mono text-xs faint">必填 · 可执行</span></label>
              <textarea v-model="form.nextWeekPlan" class="textarea" rows="3" placeholder="下周要完成哪些任务、达到什么验收标准？" />
            </div>
          </div>

          <div class="review-actions">
            <span class="mono text-xs faint">证据字段已填写 {{ evidenceCount }}/3</span>
            <button class="btn btn-sm" type="button" :disabled="saving" @click="save(false)">保存草稿</button>
            <button class="btn btn-primary btn-sm" type="button" :disabled="saving || reviewStatus === 'final'" @click="save(true)">
              <span v-if="saving" class="spinner" />
              <Save v-else :size="13" />
              定稿本周复盘
            </button>
          </div>
        </template>
      </section>

      <aside class="review-side">
        <section class="side-card">
          <div class="side-head">
            <ClipboardCheck :size="14" />
            <h2>阶段验收</h2>
            <span class="mono text-xs faint">EVIDENCE</span>
          </div>
          <div class="accept-list">
            <div v-for="item in acceptance" :key="item.phaseSlug" class="accept-row">
              <div class="accept-main">
                <div class="flex gap-6" style="align-items: center; flex-wrap: wrap">
                  <span class="accept-title">{{ item.title }}</span>
                  <StatusBadge
                    v-if="item.evaluation"
                    :status="item.evaluation.result"
                    :label="RESULT_LABEL[item.evaluation.result]"
                  />
                </div>
                <div class="accept-progress">
                  <span class="mono text-xs faint">{{ item.tasksDone }}/{{ item.tasksTotal }}</span>
                  <ProgressBar :value="percentOf(item.tasksDone, item.tasksTotal)" thin />
                </div>
                <span v-if="item.evaluation" class="mono text-xs faint">
                  {{ item.evaluation.score }} 分 · {{ formatDateTime(item.evaluation.evaluatedAt) }}
                </span>
              </div>
              <button class="btn btn-sm" type="button" @click="openEvaluation(item)">
                {{ item.evaluation ? '重新验收' : '记录验收' }}
              </button>
            </div>
          </div>
          <p class="side-note">阶段任务全部完成后才允许判定通过；证据不足会被服务端拒绝。</p>
        </section>

        <section class="side-card">
          <div class="side-head">
            <FileCheck2 :size="14" />
            <h2>验收记录</h2>
            <span class="mono text-xs faint">{{ evaluations.length }}</span>
          </div>
          <StateBlock v-if="!evaluations.length" variant="empty" title="暂无验收记录" description="完成一个阶段后，用真实证据记录一次验收。" />
          <div v-else class="eval-list">
            <article v-for="item in evaluations" :key="item._id" class="eval-item">
              <div class="flex-between gap-8" style="align-items: flex-start">
                <span class="eval-title">{{ item.title }}</span>
                <StatusBadge :status="item.result" :label="RESULT_LABEL[item.result]" />
              </div>
              <p class="eval-evidence">{{ item.evidence }}</p>
              <span class="mono text-xs faint">{{ item.score }} 分 · {{ formatDateTime(item.evaluatedAt) }}</span>
            </article>
          </div>
        </section>
      </aside>
    </div>

    <ModalShell v-if="evalOpen" title="记录阶段验收" sub="只有可复现的证据才能作为通过依据。任务未完成时通过判定会被拒绝。" @close="evalOpen = false">
      <div class="form-grid">
        <div class="field">
          <label class="field-label">验收对象</label>
          <input v-model="evalForm.title" class="input" />
        </div>
        <div class="field">
          <label class="field-label">验收标准</label>
          <textarea v-model="evalForm.criteria" class="textarea" rows="3" />
        </div>
        <div class="field">
          <label class="field-label">证据（必填，≥ 10 字）</label>
          <textarea
            v-model="evalForm.evidence"
            class="textarea"
            rows="5"
            placeholder="写明代码路径、命令与输出、测试数量、演示步骤或截图说明。"
          />
        </div>
        <div class="form-row">
          <div class="field">
            <label class="field-label">结论</label>
            <select v-model="evalForm.result" class="select">
              <option value="pass">通过</option>
              <option value="partial">部分通过</option>
              <option value="fail">未通过</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">评分（0–100）</label>
            <input v-model.number="evalForm.score" class="input" type="number" min="0" max="100" />
          </div>
        </div>
        <div class="field">
          <label class="field-label">备注</label>
          <textarea v-model="evalForm.notes" class="textarea" rows="2" placeholder="需要补强的部分…" />
        </div>
        <p v-if="evalError" class="form-error">{{ evalError }}</p>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="evalOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="evalSaving" @click="submitEvaluation">
          <span v-if="evalSaving" class="spinner" /> 保存验收
        </button>
      </template>
    </ModalShell>
  </div>
</template>

<style scoped>
.week-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-soft);
}

.week-btn {
  width: 26px;
  height: 26px;
  border: 0;
  background: transparent;
  color: var(--faint);
}

.week-btn:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-2);
}

.week-select {
  height: 26px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  font-size: 11.5px;
  width: 150px;
}

.review-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 14px;
  align-items: start;
}

.review-main {
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--surface);
  min-height: 420px;
}

.review-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--faint);
  font-size: 12px;
}

.review-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 54px 26px;
}

.review-empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 13px;
  border: 1px solid rgba(110, 231, 168, 0.25);
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: 14px;
}

.review-empty h2 {
  font-size: 16px;
  font-weight: 600;
}

.review-empty p {
  max-width: 430px;
  margin: 8px 0 18px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.65;
}

.review-banner {
  padding: 17px 19px;
  border-bottom: 1px solid var(--line);
  background: radial-gradient(500px 120px at 10% 0%, rgba(110, 231, 168, 0.06), transparent 70%);
}

.review-banner h2 {
  font-size: 16px;
  font-weight: 600;
}

.review-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 15px;
}

.review-metrics > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-soft);
}

.review-metrics b {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
}

.review-metrics em {
  font-style: normal;
  font-size: 11px;
  color: var(--faint);
  margin-left: 1px;
}

.review-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 17px 19px;
}

.review-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.review-label {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: 12px;
  font-weight: 540;
  color: var(--text-soft);
}

.review-actions {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 19px;
  border-top: 1px solid var(--line);
  background: rgba(7, 11, 10, 0.45);
}

.review-actions > span {
  margin-right: auto;
}

.review-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  padding: 14px;
}

.side-head {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  margin-bottom: 10px;
}

.side-head h2 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-soft);
  margin-right: auto;
}

.accept-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.accept-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-soft);
}

.accept-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.accept-title {
  font-size: 11.5px;
  color: var(--text-soft);
}

.accept-progress {
  display: flex;
  align-items: center;
  gap: 7px;
}

.accept-progress .progress {
  flex: 1;
}

.accept-row .btn {
  flex-shrink: 0;
  height: 25px;
  padding: 0 8px;
  font-size: 10px;
}

.side-note {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  color: var(--faint);
  line-height: 1.55;
}

.eval-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: 340px;
  overflow-y: auto;
}

.eval-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.eval-title {
  font-size: 11.2px;
  color: var(--text-soft);
  font-weight: 540;
}

.eval-evidence {
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .review-layout {
    grid-template-columns: 1fr;
  }
  .review-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .review-side {
    grid-template-columns: 1fr;
  }
  .review-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .week-select {
    width: 118px;
  }
}
</style>
