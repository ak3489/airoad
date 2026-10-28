<script setup lang="ts">
import {
  Cpu,
  Database,
  Download,
  Eraser,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  PlugZap,
  Save,
  ShieldCheck,
  Terminal,
} from 'lucide-vue-next';
import { onMounted, reactive, ref } from 'vue';
import StateBlock from '@/components/StateBlock.vue';
import { api } from '@/lib/api';
import {
  aiConfig,
  aiConfigured,
  aiRequestHeaders,
  clearAiConfig,
  maskKey,
  saveAiConfig,
} from '@/lib/aiConfig';
import { useAppState } from '@/lib/appState';
import { formatDate } from '@/lib/format';
import { notify } from '@/lib/toast';
import type { PlanResponse } from '@/types';

const { settings } = useAppState();
const aiForm = reactive({
  apiKey: aiConfig.apiKey,
  baseUrl: aiConfig.baseUrl,
  model: aiConfig.model,
});
const showKey = ref(false);
const plan = ref<PlanResponse | null>(null);
const loading = ref(true);
const error = ref('');

const testing = ref(false);
const testResult = ref<{ ok: boolean; latencyMs: number; model: string; reply: string } | null>(null);
const testError = ref('');

const savingPlan = ref(false);
const exporting = ref(false);
const planForm = reactive({
  name: '',
  roleTarget: '',
  startDate: '',
  totalWeeks: 12,
  dailyMinutes: 90,
});

const SECURITY_RULES = [
  { icon: KeyRound, title: 'API Key 存在浏览器本地', desc: '只写入当前浏览器 localStorage；请求时临时传给本机 API 转发，服务端不落库、不写日志。' },
  { icon: Lock, title: 'AI 只读授权上下文', desc: '任务、阶段、项目、笔记按当前选择注入；不会读取浏览器之外的隐私数据。' },
  { icon: ShieldCheck, title: '危险操作必须人工确认', desc: 'Agent 不拥有无限制 Shell / root / Docker 权限，固定参数白名单之外的操作需授权与确认。' },
  { icon: Cpu, title: '不自动判定掌握', desc: 'AI 可以分析记录和出题，但掌握程度需要代码、测试与验收证据。' },
];

function toDateInput(value: string) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const planData = await api.get<PlanResponse>('/plan');
    plan.value = planData;
    planForm.name = planData.plan.name;
    planForm.roleTarget = planData.plan.roleTarget;
    planForm.startDate = toDateInput(planData.plan.startDate);
    planForm.totalWeeks = planData.plan.totalWeeks;
    planForm.dailyMinutes = planData.plan.dailyMinutes;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设置加载失败';
  } finally {
    loading.value = false;
  }
}

function validBaseUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function saveAi() {
  if (!aiForm.apiKey.trim()) return notify('error', '请填写 API Key');
  if (!validBaseUrl(aiForm.baseUrl)) return notify('error', 'Base URL 需为 http/https 地址');
  if (!aiForm.model.trim()) return notify('error', '请填写模型名');
  const persisted = saveAiConfig({ ...aiForm });
  aiForm.apiKey = aiConfig.apiKey;
  aiForm.baseUrl = aiConfig.baseUrl;
  aiForm.model = aiConfig.model;
  testResult.value = null;
  testError.value = '';
  if (persisted) notify('success', 'AI 配置已保存在此浏览器');
  else notify('error', '浏览器存储不可用，配置仅在当前页面生效');
}

function clearAi() {
  if (!window.confirm('清除此浏览器保存的 API Key 与模型配置？')) return;
  clearAiConfig();
  aiForm.apiKey = aiConfig.apiKey;
  aiForm.baseUrl = aiConfig.baseUrl;
  aiForm.model = aiConfig.model;
  showKey.value = false;
  testResult.value = null;
  testError.value = '';
  notify('success', '已清除浏览器中的 AI 配置');
}

async function exportData() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    await api.download('/export', `airoad-backup-${stamp}.json`);
    notify('success', '备份已开始下载');
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '导出失败');
  } finally {
    exporting.value = false;
  }
}

async function testConnection() {
  if (!aiForm.apiKey.trim()) return notify('error', '请先填写 API Key');
  if (!validBaseUrl(aiForm.baseUrl)) return notify('error', 'Base URL 需为 http/https 地址');
  testing.value = true;
  testResult.value = null;
  testError.value = '';
  try {
    testResult.value = await api.post<{ ok: boolean; latencyMs: number; model: string; reply: string }>(
      '/ai/test',
      undefined,
      aiRequestHeaders({
        apiKey: aiForm.apiKey,
        baseUrl: aiForm.baseUrl,
        model: aiForm.model,
      })
    );
  } catch (err) {
    testError.value = err instanceof Error ? err.message : '连接测试失败';
  } finally {
    testing.value = false;
  }
}

async function savePlan() {
  if (!planForm.name.trim() || !planForm.roleTarget.trim()) {
    return notify('error', '计划名称与目标角色不能为空');
  }
  savingPlan.value = true;
  try {
    await api.patch('/plan', {
      name: planForm.name.trim(),
      roleTarget: planForm.roleTarget.trim(),
      startDate: new Date(`${planForm.startDate}T00:00:00`).toISOString(),
      totalWeeks: Number(planForm.totalWeeks),
      dailyMinutes: Number(planForm.dailyMinutes),
    });
    notify('success', '学习计划已更新');
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '保存失败');
  } finally {
    savingPlan.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">SETTINGS</span><span class="dot online" />本地模型配置</div>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">模型配置保存在当前浏览器。未配置 AI 时，学习、任务、资料库与项目全部可用。</p>
      </div>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载设置" description="正在读取学习计划与数据统计。" />
    <StateBlock v-else-if="error" variant="error" title="设置加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load">重试</button></template>
    </StateBlock>

    <div v-else class="settings-grid">
      <section class="settings-card">
        <div class="settings-head">
          <Cpu :size="15" />
          <h2>模型连接</h2>
          <span class="badge" :class="aiConfigured ? 'badge-done' : 'badge-review'">
            {{ aiConfigured ? '已配置' : '未配置' }}
          </span>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <div class="field">
              <label class="field-label">Base URL</label>
              <input
                v-model="aiForm.baseUrl"
                class="input mono"
                placeholder="https://api.deepseek.com"
                spellcheck="false"
              />
            </div>
            <div class="field">
              <label class="field-label">模型</label>
              <input
                v-model="aiForm.model"
                class="input mono"
                placeholder="deepseek-chat"
                spellcheck="false"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label">API Key</label>
            <div class="key-row">
              <input
                v-model="aiForm.apiKey"
                class="input mono"
                :type="showKey ? 'text' : 'password'"
                placeholder="sk-…"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                class="icon-btn small"
                type="button"
                :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'"
                @click="showKey = !showKey"
              >
                <EyeOff v-if="showKey" :size="14" />
                <Eye v-else :size="14" />
              </button>
            </div>
            <p class="field-hint">
              仅保存在当前浏览器 localStorage，服务端不落库、不写日志。
              <span v-if="aiConfig.apiKey" class="mono">当前已保存 {{ maskKey(aiConfig.apiKey) }}</span>
            </p>
          </div>
        </div>

        <div class="test-row">
          <button class="btn btn-primary btn-sm" type="button" @click="saveAi">
            <Save :size="13" /> 保存配置
          </button>
          <button class="btn btn-sm" type="button" :disabled="testing" @click="testConnection">
            <span v-if="testing" class="spinner" />
            <PlugZap v-else :size="13" />
            测试连接
          </button>
          <button class="btn btn-sm btn-ghost" type="button" :disabled="!aiConfigured" @click="clearAi">
            <Eraser :size="13" /> 清除
          </button>
          <span v-if="testResult" class="test-ok mono">
            通 · {{ testResult.latencyMs }}ms · {{ testResult.model }} · 回复：{{ testResult.reply }}
          </span>
          <span v-else-if="testError" class="test-fail">{{ testError }}</span>
        </div>

        <p class="settings-warn">
          密钥保存在浏览器存储中，可被能访问此浏览器或注入脚本的人读取。请仅在个人设备使用，不要在多用户共用电脑上保存。
        </p>
      </section>

      <section class="settings-card">
        <div class="settings-head">
          <Database :size="15" />
          <h2>数据与存储</h2>
          <span class="mono text-xs faint">{{ settings?.app.environment }}</span>
        </div>
        <div v-if="settings" class="data-grid">
          <div class="data-cell">
            <span class="mono text-xs faint">任务</span>
            <b>{{ settings.storage.tasks }}</b>
          </div>
          <div class="data-cell">
            <span class="mono text-xs faint">资料</span>
            <b>{{ settings.storage.resources }}</b>
          </div>
          <div class="data-cell">
            <span class="mono text-xs faint">笔记</span>
            <b>{{ settings.storage.notes }}</b>
          </div>
          <div class="data-cell">
            <span class="mono text-xs faint">未解决问题</span>
            <b :class="{ warn: settings.storage.openIssues > 0 }">{{ settings.storage.openIssues }}</b>
          </div>
        </div>
        <div class="kv-list">
          <div class="kv"><span>数据库模式</span><b class="mono">{{ settings?.storage.mode }}</b></div>
          <div class="kv"><span>应用版本</span><b class="mono">v{{ settings?.app.version }}</b></div>
          <div class="kv"><span>AI 配置</span><b class="mono">浏览器 localStorage</b></div>
        </div>
        <div class="flex gap-8 mt-12">
          <button class="btn btn-sm" type="button" :disabled="exporting" @click="exportData">
            <Download :size="13" /> {{ exporting ? '导出中…' : '下载 JSON 备份' }}
          </button>
          <span class="mono text-xs faint">不含 API Key 与 AI 会话</span>
        </div>
        <p class="settings-note">
          本地开发使用内置 MongoDB（<code class="inline-code">server/.data/mongodb</code>）；
          设置 <code class="inline-code">MONGODB_URI</code> 后自动切换为外部数据库。
        </p>
      </section>

      <section class="settings-card">
        <div class="settings-head">
          <Terminal :size="15" />
          <h2>学习计划参数</h2>
          <span class="mono text-xs faint">PLAN</span>
        </div>
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
            <div class="field">
              <label class="field-label">每日分钟</label>
              <input v-model.number="planForm.dailyMinutes" class="input" type="number" min="15" max="600" />
            </div>
          </div>
        </div>
        <div class="plan-meta mono text-xs faint" v-if="plan">
          当前第 {{ plan.plan.currentWeek }} 周 · 开始于 {{ formatDate(plan.plan.startDate) }} ·
          {{ plan.phases.length }} 个阶段
        </div>
        <div class="settings-actions">
          <button class="btn btn-primary btn-sm" type="button" :disabled="savingPlan" @click="savePlan">
            <span v-if="savingPlan" class="spinner" />
            <Save v-else :size="13" />
            保存计划参数
          </button>
          <span class="text-xs faint">修改开始日期会重新计算所有任务截止日。</span>
        </div>
      </section>

      <section class="settings-card security-card">
        <div class="settings-head">
          <ShieldCheck :size="15" />
          <h2>安全边界</h2>
          <span class="mono text-xs faint">BY DESIGN</span>
        </div>
        <div class="rule-list">
          <div v-for="rule in SECURITY_RULES" :key="rule.title" class="rule">
            <span class="rule-icon"><component :is="rule.icon" :size="13" /></span>
            <div>
              <div class="rule-title">{{ rule.title }}</div>
              <p class="rule-desc">{{ rule.desc }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--surface);
}

.settings-head {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
}

.settings-head h2 {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-soft);
  margin-right: auto;
}

.kv-list {
  display: flex;
  flex-direction: column;
}

.kv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
  font-size: 11.2px;
}

.kv:last-child {
  border-bottom: 0;
}

.kv span {
  color: var(--faint);
}

.kv b {
  font-weight: 500;
  color: var(--text-soft);
  font-size: 10.8px;
  text-align: right;
  word-break: break-all;
}

.test-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.test-ok {
  font-size: 10px;
  color: var(--accent);
  line-height: 1.5;
}

.test-fail {
  font-size: 10.5px;
  color: var(--red);
}

.key-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.key-row .input {
  flex: 1;
  min-width: 0;
}

.field-hint {
  margin-top: 6px;
  font-size: 10.3px;
  color: var(--faint);
  line-height: 1.6;
}

.field-hint .mono {
  color: var(--muted);
}

.settings-note {
  font-size: 10.8px;
  color: var(--faint);
  line-height: 1.6;
}

.settings-warn {
  padding: 8px 10px;
  border: 1px solid rgba(240, 198, 116, 0.22);
  border-radius: 7px;
  background: var(--amber-soft);
  font-size: 10.3px;
  color: var(--amber);
  line-height: 1.55;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.data-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-soft);
}

.data-cell b {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.data-cell b.warn {
  color: var(--amber);
}

.plan-meta {
  padding-top: 8px;
  border-top: 1px solid var(--line);
  line-height: 1.55;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.security-card {
  background:
    radial-gradient(420px 120px at 90% 0%, rgba(110, 231, 168, 0.05), transparent 70%),
    var(--surface);
}

.rule-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rule {
  display: flex;
  gap: 9px;
  align-items: flex-start;
}

.rule-icon {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  color: var(--accent);
}

.rule-title {
  font-size: 11.5px;
  font-weight: 540;
  color: var(--text-soft);
}

.rule-desc {
  margin-top: 2px;
  font-size: 10.3px;
  color: var(--faint);
  line-height: 1.55;
}

@media (max-width: 1050px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .data-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rule-list {
    grid-template-columns: 1fr;
  }
}
</style>
