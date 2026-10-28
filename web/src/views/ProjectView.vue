<script setup lang="ts">
import {
  CheckCircle2,
  ChevronDown,
  FileCode2,
  Github,
  ListTree,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
} from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import MarkdownView from '@/components/MarkdownView.vue';
import ModalShell from '@/components/ModalShell.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import StateBlock from '@/components/StateBlock.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/lib/api';
import { MAIN_PROJECT_SLUG } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/toast';
import type { Milestone, Project, ProjectTask } from '@/types';

const projectSlug = MAIN_PROJECT_SLUG;

const data = ref<Project | null>(null);
const loading = ref(true);
const error = ref('');
const tab = ref<'milestones' | 'board' | 'logs' | 'docs'>('milestones');
const expanded = ref<Record<string, boolean>>({});

const docsOpen = ref(false);
const docsSaving = ref(false);
const docsForm = reactive({ repoUrl: '', description: '', architecture: '', deployment: '', demo: '' });

const logOpen = ref(false);
const logSaving = ref(false);
const logError = ref('');
const logForm = reactive({ type: 'decision' as 'decision' | 'issue' | 'test', title: '', content: '' });
const logFilter = ref<'all' | 'decision' | 'issue' | 'test'>('all');

const PROJECT_STATUS_LABEL: Record<string, string> = {
  planned: '规划中',
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
};

const LOG_META = {
  decision: { label: '技术决策', cls: 'log-decision' },
  issue: { label: '问题', cls: 'log-issue' },
  test: { label: '测试记录', cls: 'log-test' },
} as const;

const BOARD_COLUMNS: { key: ProjectTask['status']; label: string }[] = [
  { key: 'backlog', label: '待办' },
  { key: 'doing', label: '进行中' },
  { key: 'review', label: '待验收' },
  { key: 'done', label: '已完成' },
];

const docSections = computed(() => {
  if (!data.value) return [];
  const project = data.value.project;
  return [
    { key: 'architecture', title: '架构设计', icon: ListTree, content: project.architecture },
    { key: 'deployment', title: '部署方案', icon: TerminalSquare, content: project.deployment },
    { key: 'demo', title: '演示与验收', icon: Sparkles, content: project.demo },
  ];
});

const logs = computed(() => {
  if (!data.value) return [];
  if (logFilter.value === 'all') return data.value.logs;
  return data.value.logs.filter((log) => log.type === logFilter.value);
});

const openIssueCount = computed(() => data.value?.logs.filter((log) => log.status === 'open').length ?? 0);

const securityList = computed(() => {
  const notes = data.value?.project.securityNotes ?? '';
  return notes
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get<Project>(`/projects/${projectSlug}`);
    data.value = result;
    if (!Object.keys(expanded.value).length) {
      const current = result.milestones.find((item) => item.status !== 'done') ?? result.milestones[0];
      if (current) expanded.value[current.slug] = true;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '项目加载失败';
  } finally {
    loading.value = false;
  }
}

function toggleMilestone(slug: string) {
  expanded.value[slug] = !expanded.value[slug];
}

async function changeProjectStatus(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (!data.value) return;
  const previous = data.value.project.status;
  data.value.project.status = value;
  try {
    await api.patch(`/projects/${projectSlug}`, { status: value });
    notify('success', '项目状态已更新');
  } catch (err) {
    data.value.project.status = previous;
    notify('error', err instanceof Error ? err.message : '更新失败');
  }
}

async function changeMilestoneStatus(milestone: Milestone, value: string) {
  if (value === milestone.status) return;
  try {
    await api.patch(`/projects/${projectSlug}/milestones/${milestone.slug}`, { status: value });
    notify('success', '里程碑状态已更新');
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '更新失败');
  }
}

async function changeTaskStatus(task: ProjectTask, value: string) {
  if (value === task.status) return;
  try {
    await api.patch(`/project-tasks/${task.slug}`, { status: value });
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '更新失败');
  }
}

function openDocs() {
  if (!data.value) return;
  const project = data.value.project;
  docsForm.repoUrl = project.repoUrl || '';
  docsForm.description = project.description || '';
  docsForm.architecture = project.architecture || '';
  docsForm.deployment = project.deployment || '';
  docsForm.demo = project.demo || '';
  docsOpen.value = true;
}

async function saveDocs() {
  docsSaving.value = true;
  try {
    await api.patch(`/projects/${projectSlug}`, {
      repoUrl: docsForm.repoUrl.trim(),
      description: docsForm.description,
      architecture: docsForm.architecture,
      deployment: docsForm.deployment,
      demo: docsForm.demo,
    });
    notify('success', '项目资料已保存');
    docsOpen.value = false;
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '保存失败');
  } finally {
    docsSaving.value = false;
  }
}

function openLog() {
  logError.value = '';
  logForm.title = '';
  logForm.content = '';
  logOpen.value = true;
}

async function submitLog() {
  logError.value = '';
  if (logForm.title.trim().length < 2) return (logError.value = '标题至少 2 个字符');
  logSaving.value = true;
  try {
    await api.post(`/projects/${projectSlug}/logs`, {
      type: logForm.type,
      title: logForm.title.trim(),
      content: logForm.content,
    });
    notify('success', '记录已保存');
    logOpen.value = false;
    await load();
  } catch (err) {
    logError.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    logSaving.value = false;
  }
}

async function toggleLogStatus(id: string, current: 'open' | 'resolved') {
  try {
    await api.patch(`/project-logs/${id}`, { status: current === 'open' ? 'resolved' : 'open' });
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '更新失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">PROJECT</span><span class="dot online" />主项目 · 真实交付</div>
        <h1 class="page-title">{{ data?.project.name || '主项目' }}</h1>
        <p class="page-sub">以真实企业知识库 AI 客服项目为主线，把 7 个阶段的知识落到可运行、可演示、可约束的系统上。</p>
      </div>
      <div class="page-actions">
        <a v-if="data?.project.repoUrl" class="btn" :href="data.project.repoUrl" target="_blank" rel="noopener noreferrer">
          <Github :size="15" /> 仓库
        </a>
        <button v-else class="btn" type="button" @click="openDocs"><Github :size="15" /> 设置仓库</button>
        <button class="btn" type="button" @click="openDocs"><Pencil :size="14" /> 编辑资料</button>
        <button class="btn btn-primary" type="button" @click="logFilter = 'issue'; tab = 'logs'; openLog()">
          <Plus :size="15" /> 记录问题
        </button>
      </div>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载项目" description="正在读取里程碑、任务与项目记录。" />
    <StateBlock v-else-if="error" variant="error" title="项目加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load">重试</button></template>
    </StateBlock>

    <template v-else-if="data">
      <section class="proj-hero">
        <div class="proj-hero-main">
          <div class="flex gap-10" style="align-items: center; flex-wrap: wrap">
            <span class="badge badge-progress">{{ PROJECT_STATUS_LABEL[data.project.status] || data.project.status }}</span>
            <span class="mono text-xs faint">{{ data.project.slug }}</span>
          </div>
          <p class="proj-goal">{{ data.project.goal }}</p>
          <div class="proj-stack">
            <span v-for="item in data.project.techStack" :key="item" class="tag">{{ item }}</span>
          </div>
          <div class="proj-hero-meta">
            <div>
              <span class="mono text-xs faint">里程碑</span>
              <b>{{ data.stats.milestonesDone }}/{{ data.stats.milestonesTotal }}</b>
            </div>
            <div>
              <span class="mono text-xs faint">项目任务</span>
              <b>{{ data.stats.tasksDone }}/{{ data.stats.tasksTotal }}</b>
            </div>
            <div>
              <span class="mono text-xs faint">未解决问题</span>
              <b :class="{ 'text-danger': openIssueCount > 0 }">{{ openIssueCount }}</b>
            </div>
            <div class="proj-next" v-if="data.stats.nextTask">
              <span class="mono text-xs faint">下一步</span>
              <b>{{ data.stats.nextTask.title }}</b>
            </div>
          </div>
        </div>
        <div class="proj-hero-side">
          <div class="proj-percent mono">{{ data.project.percent }}<span>%</span></div>
          <ProgressBar :value="data.project.percent" />
          <span class="text-xs faint">按里程碑完成度计算</span>
          <select class="select proj-status" :value="data.project.status" @change="changeProjectStatus">
            <option value="planned">规划中</option>
            <option value="active">进行中</option>
            <option value="paused">已暂停</option>
            <option value="done">已完成</option>
          </select>
        </div>
      </section>

      <section class="security-panel">
        <div class="security-head">
          <ShieldAlert :size="15" />
          <h2>信任边界与安全约束</h2>
          <span class="mono text-xs">NON-NEGOTIABLE</span>
        </div>
        <ul class="security-list">
          <li v-for="note in securityList" :key="note"><CheckCircle2 :size="11" /> {{ note }}</li>
        </ul>
      </section>

      <div class="proj-tabs">
        <div class="segmented">
          <button type="button" :class="{ active: tab === 'milestones' }" @click="tab = 'milestones'">里程碑</button>
          <button type="button" :class="{ active: tab === 'board' }" @click="tab = 'board'">任务看板</button>
          <button type="button" :class="{ active: tab === 'logs' }" @click="tab = 'logs'">
            决策与问题<span v-if="openIssueCount" class="tab-dot">{{ openIssueCount }}</span>
          </button>
          <button type="button" :class="{ active: tab === 'docs' }" @click="tab = 'docs'">架构 / 部署</button>
        </div>
        <span class="mono text-xs faint">
          {{ tab === 'milestones' ? `${data.milestones.length} 个里程碑` : tab === 'board' ? `${data.tasks.length} 个项目任务` : tab === 'logs' ? `${data.logs.length} 条记录` : '交付文档' }}
        </span>
      </div>

      <div v-if="tab === 'milestones'" class="milestone-list">
        <article v-for="milestone in data.milestones" :key="milestone.slug" class="milestone" :class="{ done: milestone.status === 'done' }">
          <button class="milestone-head" type="button" @click="toggleMilestone(milestone.slug)">
            <span class="milestone-index mono">M{{ String(milestone.order).padStart(2, '0') }}</span>
            <div class="milestone-main">
              <div class="flex gap-8" style="align-items: center; flex-wrap: wrap">
                <h2 class="milestone-title">{{ milestone.title }}</h2>
                <StatusBadge :status="milestone.status" />
              </div>
              <p class="milestone-desc">{{ milestone.description }}</p>
            </div>
            <div class="milestone-progress">
              <span class="mono text-xs faint">{{ milestone.tasksDone }}/{{ milestone.tasksTotal }} · {{ milestone.percent }}%</span>
              <ProgressBar :value="milestone.percent" thin />
            </div>
            <select
              class="select milestone-select"
              :value="milestone.status"
              @click.stop
              @change="changeMilestoneStatus(milestone, ($event.target as HTMLSelectElement).value)"
            >
              <option value="todo">待开始</option>
              <option value="in_progress">进行中</option>
              <option value="done">已完成</option>
            </select>
            <ChevronDown :size="15" class="milestone-chev" :class="{ open: expanded[milestone.slug] }" />
          </button>

          <div v-if="expanded[milestone.slug]" class="milestone-body">
            <div v-if="milestone.acceptance.length" class="milestone-accept">
              <span class="mono text-xs faint">验收标准</span>
              <ul>
                <li v-for="item in milestone.acceptance" :key="item"><CheckCircle2 :size="10" /> {{ item }}</li>
              </ul>
            </div>
            <div class="milestone-tasks">
              <div v-for="task in milestone.tasks" :key="task.slug" class="task-row">
                <span class="task-priority" :class="task.priority">{{ task.priority === 'high' ? 'H' : task.priority === 'low' ? 'L' : 'N' }}</span>
                <div class="task-row-main">
                  <span class="task-row-title">{{ task.title }}</span>
                  <span class="task-row-desc">{{ task.description }}</span>
                </div>
                <span class="mono text-xs faint task-hours">{{ task.estimateHours }}h</span>
                <select
                  class="select task-status-select"
                  :value="task.status"
                  @change="changeTaskStatus(task, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="backlog">待办</option>
                  <option value="doing">进行中</option>
                  <option value="review">待验收</option>
                  <option value="done">已完成</option>
                </select>
              </div>
              <p v-if="!milestone.tasks.length" class="milestone-empty">该里程碑暂无任务。</p>
            </div>
          </div>
        </article>
      </div>

      <div v-else-if="tab === 'board'" class="board">
        <section v-for="column in BOARD_COLUMNS" :key="column.key" class="board-col">
          <header class="board-head">
            <span>{{ column.label }}</span>
            <span class="mono text-xs faint">{{ data.tasks.filter((task) => task.status === column.key).length }}</span>
          </header>
          <div class="board-cards">
            <article v-for="task in data.tasks.filter((item) => item.status === column.key)" :key="task.slug" class="board-card">
              <div class="board-card-top">
                <span class="task-priority" :class="task.priority">{{ task.priority === 'high' ? 'H' : task.priority === 'low' ? 'L' : 'N' }}</span>
                <span class="mono text-xs faint">{{ task.estimateHours }}h</span>
              </div>
              <div class="board-card-title">{{ task.title }}</div>
              <p class="board-card-desc">{{ task.description }}</p>
              <div class="board-tags">
                <span v-for="tag in task.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
              </div>
              <select
                class="select board-select"
                :value="task.status"
                @change="changeTaskStatus(task, ($event.target as HTMLSelectElement).value)"
              >
                <option value="backlog">待办</option>
                <option value="doing">进行中</option>
                <option value="review">待验收</option>
                <option value="done">已完成</option>
              </select>
            </article>
            <p v-if="!data.tasks.some((task) => task.status === column.key)" class="board-empty">暂无任务</p>
          </div>
        </section>
      </div>

      <div v-else-if="tab === 'logs'" class="logs-view">
        <div class="logs-bar">
          <div class="segmented">
            <button type="button" :class="{ active: logFilter === 'all' }" @click="logFilter = 'all'">全部</button>
            <button type="button" :class="{ active: logFilter === 'decision' }" @click="logFilter = 'decision'">决策</button>
            <button type="button" :class="{ active: logFilter === 'issue' }" @click="logFilter = 'issue'">问题</button>
            <button type="button" :class="{ active: logFilter === 'test' }" @click="logFilter = 'test'">测试</button>
          </div>
          <button class="btn btn-sm" type="button" @click="openLog"><Plus :size="13" /> 新建记录</button>
        </div>

        <StateBlock v-if="!logs.length" variant="empty" title="还没有记录" description="把技术选型、踩过的坑和测试结论写下来，复盘时才有证据。" />

        <div v-else class="log-list">
          <article v-for="log in logs" :key="log._id" class="log-item">
            <div class="log-rail">
              <span class="log-type" :class="LOG_META[log.type].cls">{{ LOG_META[log.type].label }}</span>
              <span class="log-line" />
            </div>
            <div class="log-body">
              <div class="log-head">
                <h3>{{ log.title }}</h3>
                <button
                  class="badge"
                  :class="log.status === 'open' ? 'badge-danger' : 'badge-done'"
                  type="button"
                  style="border: 0"
                  @click="toggleLogStatus(log._id, log.status)"
                >
                  {{ log.status === 'open' ? '未解决' : '已解决' }}
                </button>
              </div>
              <p v-if="log.content" class="log-content">{{ log.content }}</p>
              <span class="mono text-xs faint">{{ formatDateTime(log.createdAt) }}</span>
            </div>
          </article>
        </div>
      </div>

      <div v-else class="docs-grid">
        <article v-for="section in docSections" :key="section.key" class="doc-card">
          <div class="doc-head">
            <component :is="section.icon" :size="15" />
            <h2>{{ section.title }}</h2>
          </div>
          <MarkdownView v-if="section.content" :source="section.content" />
          <div v-else class="doc-empty">
            <FileCode2 :size="18" />
            <span>尚未填写{{ section.title }}。先把真实方案写下来，再开始实现。</span>
          </div>
        </article>
        <article class="doc-card doc-wide">
          <div class="doc-head">
            <Github :size="15" />
            <h2>仓库与说明</h2>
          </div>
          <a v-if="data.project.repoUrl" :href="data.project.repoUrl" target="_blank" rel="noopener noreferrer" class="link mono">{{ data.project.repoUrl }}</a>
          <p v-else class="doc-empty-text">尚未设置仓库地址。</p>
          <MarkdownView v-if="data.project.description" :source="data.project.description" />
          <button class="btn btn-sm mt-12" type="button" @click="openDocs"><Pencil :size="12" /> 编辑项目资料</button>
        </article>
      </div>
    </template>

    <ModalShell v-if="docsOpen" title="编辑项目资料" sub="架构、部署与演示文档支持 Markdown。请只写真实存在的方案。" @close="docsOpen = false">
      <div class="form-grid">
        <div class="field">
          <label class="field-label">仓库地址</label>
          <input v-model="docsForm.repoUrl" class="input" placeholder="https://github.com/…（留空表示尚未创建）" />
        </div>
        <div class="field">
          <label class="field-label">项目说明</label>
          <textarea v-model="docsForm.description" class="textarea" rows="3" />
        </div>
        <div class="field">
          <label class="field-label">架构设计</label>
          <textarea v-model="docsForm.architecture" class="textarea mono" rows="7" placeholder="模块边界、数据流、信任边界…" />
        </div>
        <div class="field">
          <label class="field-label">部署方案</label>
          <textarea v-model="docsForm.deployment" class="textarea mono" rows="7" placeholder="Docker Compose、MongoDB、环境变量…" />
        </div>
        <div class="field">
          <label class="field-label">演示与验收</label>
          <textarea v-model="docsForm.demo" class="textarea mono" rows="5" placeholder="演示脚本、测试证据、截图位置…" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="docsOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="docsSaving" @click="saveDocs">
          <span v-if="docsSaving" class="spinner" /> 保存资料
        </button>
      </template>
    </ModalShell>

    <ModalShell v-if="logOpen" title="新建项目记录" sub="决策与问题都是学习证据，尽量写清楚当时的判断依据。" @close="logOpen = false">
      <div class="form-grid">
        <div class="field">
          <label class="field-label">类型</label>
          <div class="segmented">
            <button type="button" :class="{ active: logForm.type === 'decision' }" @click="logForm.type = 'decision'">技术决策</button>
            <button type="button" :class="{ active: logForm.type === 'issue' }" @click="logForm.type = 'issue'">问题</button>
            <button type="button" :class="{ active: logForm.type === 'test' }" @click="logForm.type = 'test'">测试记录</button>
          </div>
        </div>
        <div class="field">
          <label class="field-label">标题</label>
          <input v-model="logForm.title" class="input" placeholder="例如：为什么用固定参数白名单代替自由 Shell" />
        </div>
        <div class="field">
          <label class="field-label">内容</label>
          <textarea v-model="logForm.content" class="textarea" rows="6" placeholder="背景、方案、取舍、验证结果…" />
        </div>
        <p v-if="logError" class="form-error">{{ logError }}</p>
      </div>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="logOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="logSaving" @click="submitLog">
          <span v-if="logSaving" class="spinner" /> 保存记录
        </button>
      </template>
    </ModalShell>
  </div>
</template>

<style scoped>
.text-danger {
  color: var(--red);
}

.proj-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
  gap: 22px;
  padding: 20px;
  margin-bottom: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background:
    radial-gradient(600px 160px at 15% 0%, rgba(110, 231, 168, 0.08), transparent 70%),
    var(--surface);
}

.proj-hero-main {
  min-width: 0;
}

.proj-goal {
  margin-top: 9px;
  font-size: 13px;
  color: var(--text-soft);
  line-height: 1.65;
}

.proj-stack {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.proj-hero-meta {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.proj-hero-meta > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.proj-hero-meta b {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-soft);
}

.proj-next {
  min-width: 0;
  max-width: 360px;
}

.proj-next b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proj-hero-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  border-left: 1px solid var(--line);
  padding-left: 22px;
}

.proj-percent {
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  color: var(--accent);
  letter-spacing: -0.03em;
}

.proj-percent span {
  font-size: 16px;
  color: var(--faint);
  margin-left: 2px;
}

.proj-status {
  margin-top: 8px;
  height: 30px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 11.5px;
}

.security-panel {
  padding: 14px 18px;
  margin-bottom: 18px;
  border: 1px solid rgba(240, 198, 116, 0.22);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(240, 198, 116, 0.05), transparent);
}

.security-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--amber);
}

.security-head h2 {
  font-size: 12.5px;
  font-weight: 600;
  margin-right: auto;
}

.security-head .mono {
  color: rgba(240, 198, 116, 0.6);
  letter-spacing: 0.08em;
}

.security-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 22px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.security-list li {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 11.2px;
  color: var(--muted);
  line-height: 1.55;
}

.security-list svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--amber);
}

.proj-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.tab-dot {
  display: inline-grid;
  place-items: center;
  min-width: 15px;
  height: 15px;
  margin-left: 5px;
  padding: 0 4px;
  border-radius: 99px;
  background: var(--red-soft);
  color: var(--red);
  font-family: var(--mono);
  font-size: 9px;
}

.milestone-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.milestone {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.milestone.done {
  opacity: 0.82;
}

.milestone:hover {
  border-color: var(--line-strong);
}

.milestone-head {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 150px 98px 18px;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.milestone-index {
  font-size: 10px;
  color: var(--accent);
}

.milestone-title {
  font-size: 13.5px;
  font-weight: 560;
}

.milestone-desc {
  margin-top: 3px;
  font-size: 11.2px;
  color: var(--faint);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.milestone-progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.milestone-select {
  height: 27px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 10.5px;
}

.milestone-chev {
  color: var(--faint);
  transition: transform 0.18s ease;
}

.milestone-chev.open {
  transform: rotate(180deg);
}

.milestone-body {
  padding: 0 16px 14px 64px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.milestone-accept {
  margin-bottom: 12px;
}

.milestone-accept ul {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.milestone-accept li {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 10.8px;
  color: var(--muted);
}

.milestone-accept svg {
  color: var(--accent);
  flex-shrink: 0;
}

.milestone-tasks {
  border: 1px solid var(--line);
  border-radius: 9px;
  overflow: hidden;
}

.task-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 44px 96px;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
}

.task-row:last-child {
  border-bottom: 0;
}

.task-priority {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 9px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--faint);
}

.task-priority.high {
  background: var(--red-soft);
  color: var(--red);
}

.task-priority.low {
  background: rgba(255, 255, 255, 0.028);
}

.task-row-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.task-row-title {
  font-size: 12px;
  color: var(--text-soft);
}

.task-row-desc {
  font-size: 10.5px;
  color: var(--faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status-select {
  height: 25px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 10px;
}

.milestone-empty {
  padding: 12px;
  font-size: 11px;
  color: var(--faint);
}

.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.board-col {
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(10, 16, 14, 0.6);
  min-height: 200px;
}

.board-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--text-soft);
}

.board-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px;
}

.board-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.board-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.board-card-title {
  font-size: 12px;
  font-weight: 540;
  color: var(--text-soft);
  line-height: 1.45;
}

.board-card-desc {
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.board-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.board-select {
  height: 24px;
  padding: 0 5px;
  font-size: 10px;
}

.board-empty {
  padding: 18px 8px;
  text-align: center;
  font-size: 10.5px;
  color: var(--faint);
}

.logs-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-item {
  display: flex;
  gap: 14px;
}

.log-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 62px;
  flex-shrink: 0;
}

.log-type {
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 9.5px;
  font-family: var(--mono);
  white-space: nowrap;
}

.log-decision {
  background: var(--blue-soft);
  color: var(--blue);
}

.log-issue {
  background: var(--red-soft);
  color: var(--red);
}

.log-test {
  background: var(--violet-soft);
  color: var(--violet);
}

.log-line {
  width: 1px;
  flex: 1;
  margin-top: 5px;
  background: var(--line);
}

.log-body {
  flex: 1;
  padding-bottom: 18px;
  min-width: 0;
}

.log-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.log-head h3 {
  font-size: 12.8px;
  font-weight: 540;
  color: var(--text-soft);
}

.log-content {
  margin: 5px 0 4px;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.6;
  white-space: pre-wrap;
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.doc-card {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

.doc-wide {
  grid-column: 1 / -1;
}

.doc-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  color: var(--accent);
}

.doc-head h2 {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-soft);
}

.doc-empty {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 16px;
  border: 1px dashed var(--line);
  border-radius: 8px;
  color: var(--faint);
  font-size: 11px;
  line-height: 1.55;
}

.doc-empty-text {
  font-size: 11.5px;
  color: var(--faint);
}

@media (max-width: 1100px) {
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .milestone-head {
    grid-template-columns: 30px minmax(0, 1fr) 120px 18px;
  }
  .milestone-select {
    display: none;
  }
}

@media (max-width: 860px) {
  .proj-hero {
    grid-template-columns: 1fr;
  }
  .proj-hero-side {
    border-left: 0;
    border-top: 1px solid var(--line);
    padding-left: 0;
    padding-top: 14px;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
  .proj-percent {
    font-size: 30px;
  }
  .proj-hero-side .progress {
    flex: 1;
    min-width: 100px;
  }
  .proj-status {
    margin-top: 0;
  }
  .security-list {
    grid-template-columns: 1fr;
  }
  .docs-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .board {
    grid-template-columns: 1fr;
  }
  .milestone-head {
    grid-template-columns: 26px minmax(0, 1fr) 16px;
    gap: 10px;
  }
  .milestone-progress {
    display: none;
  }
  .milestone-body {
    padding-left: 16px;
  }
  .task-row {
    grid-template-columns: 18px minmax(0, 1fr) 84px;
  }
  .task-hours {
    display: none;
  }
  .log-rail {
    width: 52px;
  }
}
</style>
