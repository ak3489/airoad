<script setup lang="ts">
import {
  BookOpen,
  Bug,
  Code2,
  Eye,
  FileText,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import MarkdownView from '@/components/MarkdownView.vue';
import StateBlock from '@/components/StateBlock.vue';
import { api } from '@/lib/api';
import { MAIN_PROJECT_NAME, MAIN_PROJECT_SLUG } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/toast';
import type { Note, PlanResponse } from '@/types';

type NoteKind = Note['kind'];

const notes = ref<Note[]>([]);
const phases = ref<{ slug: string; shortTitle: string }[]>([]);
const loading = ref(true);
const error = ref('');
const q = ref('');
const kindFilter = ref<'all' | NoteKind>('all');
const selectedId = ref('');
const preview = ref<'edit' | 'preview'>('edit');
const saving = ref(false);
const deleting = ref(false);

const form = reactive({
  title: '',
  content: '',
  kind: 'note' as NoteKind,
  tags: '',
  phaseSlug: '',
  taskSlug: '',
  projectSlug: '',
  question: '',
  referenceAnswer: '',
  mastery: 0,
  pinned: false,
});

const KINDS: { value: NoteKind; label: string; icon: unknown }[] = [
  { value: 'note', label: '笔记', icon: FileText },
  { value: 'issue', label: '问题', icon: Bug },
  { value: 'snippet', label: '代码片段', icon: Code2 },
  { value: 'summary', label: '总结', icon: BookOpen },
  { value: 'interview', label: '面试题', icon: MessageSquare },
];

const filtered = computed(() => {
  const keyword = q.value.trim().toLowerCase();
  return notes.value.filter((note) => {
    if (kindFilter.value !== 'all' && note.kind !== kindFilter.value) return false;
    if (
      keyword &&
      !`${note.title} ${note.content} ${note.tags.join(' ')} ${note.question}`.toLowerCase().includes(keyword)
    )
      return false;
    return true;
  });
});

const counts = computed(() => {
  const map: Record<string, number> = { all: notes.value.length };
  for (const note of notes.value) map[note.kind] = (map[note.kind] ?? 0) + 1;
  return map;
});

const selected = computed(() => notes.value.find((note) => note._id === selectedId.value) ?? null);

const tagList = computed(() =>
  form.tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
);

function kindMeta(kind: NoteKind) {
  return KINDS.find((item) => item.value === kind) ?? KINDS[0];
}

function excerpt(note: Note) {
  const text = (note.content || note.referenceAnswer || '').replace(/[#>*`\-\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 78) || '尚无内容';
}

async function load(selectAfter?: string) {
  loading.value = true;
  error.value = '';
  try {
    const [list, plan] = await Promise.all([
      api.get<Note[]>('/notes'),
      api.get<PlanResponse>('/plan'),
    ]);
    notes.value = list;
    phases.value = plan.phases.map((item) => ({ slug: item.slug, shortTitle: item.shortTitle }));
    const targetId = selectAfter || selectedId.value;
    const target = list.find((note) => note._id === targetId);
    if (target) selectNote(target);
    else if (list.length) selectNote(list[0]);
    else newNote();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '笔记加载失败';
  } finally {
    loading.value = false;
  }
}

function selectNote(note: Note) {
  selectedId.value = note._id;
  form.title = note.title;
  form.content = note.content;
  form.kind = note.kind;
  form.tags = note.tags.join(', ');
  form.phaseSlug = note.phaseSlug;
  form.taskSlug = note.taskSlug;
  form.projectSlug = note.projectSlug;
  form.question = note.question;
  form.referenceAnswer = note.referenceAnswer;
  form.mastery = note.mastery;
  form.pinned = note.pinned;
  preview.value = 'edit';
}

function newNote(kind: NoteKind = 'note') {
  selectedId.value = '';
  form.title = '';
  form.content = '';
  form.kind = kind;
  form.tags = '';
  form.phaseSlug = '';
  form.taskSlug = '';
  form.projectSlug = '';
  form.question = '';
  form.referenceAnswer = '';
  form.mastery = 0;
  form.pinned = false;
  preview.value = 'edit';
}

async function save() {
  if (!form.title.trim()) return notify('error', '请先填写标题');
  saving.value = true;
  const payload = {
    title: form.title.trim(),
    content: form.content,
    kind: form.kind,
    tags: tagList.value,
    phaseSlug: form.phaseSlug,
    taskSlug: form.taskSlug.trim(),
    projectSlug: form.projectSlug,
    question: form.question,
    referenceAnswer: form.referenceAnswer,
    mastery: Number(form.mastery),
    pinned: form.pinned,
  };
  try {
    if (selectedId.value) {
      await api.patch(`/notes/${selectedId.value}`, payload);
      notify('success', '笔记已保存');
      await load(selectedId.value);
    } else {
      const created = await api.post<Note>('/notes', payload);
      notify('success', '笔记已创建');
      selectedId.value = created._id;
      await load(created._id);
    }
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!selectedId.value) return;
  if (!window.confirm(`确定删除「${form.title || '未命名笔记'}」？此操作不可撤销。`)) return;
  deleting.value = true;
  try {
    await api.del(`/notes/${selectedId.value}`);
    notify('success', '笔记已删除');
    selectedId.value = '';
    await load();
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '删除失败');
  } finally {
    deleting.value = false;
  }
}

async function togglePin() {
  if (!selectedId.value) return;
  try {
    const updated = await api.patch<Note>(`/notes/${selectedId.value}`, { pinned: !form.pinned });
    form.pinned = updated.pinned;
    const target = notes.value.find((note) => note._id === selectedId.value);
    if (target) target.pinned = updated.pinned;
    notify('success', updated.pinned ? '已置顶' : '已取消置顶');
  } catch (err) {
    notify('error', err instanceof Error ? err.message : '操作失败');
  }
}

function setMastery(value: number) {
  form.mastery = form.mastery === value ? 0 : value;
}

onMounted(() => load());
</script>

<template>
  <div class="page notes-page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="mono">KNOWLEDGE</span><span class="dot online" />{{ counts.all }} 条记录</div>
        <h1 class="page-title">笔记与面试</h1>
        <p class="page-sub">用 Markdown 记录结论、问题和代码。面试题按掌握程度标注，掌握程度由证据决定。</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" @click="newNote()"><Plus :size="15" /> 新建笔记</button>
      </div>
    </div>

    <StateBlock v-if="loading" variant="loading" title="加载笔记" description="正在读取笔记、问题与面试题。" />
    <StateBlock v-else-if="error" variant="error" title="笔记加载失败" :description="error">
      <template #action><button class="btn btn-sm mt-8" type="button" @click="load()">重试</button></template>
    </StateBlock>

    <div v-else class="notes-layout">
      <aside class="notes-sidebar">
        <label class="notes-search">
          <Search :size="14" />
          <input v-model="q" placeholder="搜索标题、内容、标签" />
        </label>
        <div class="notes-kinds">
          <button type="button" :class="{ active: kindFilter === 'all' }" @click="kindFilter = 'all'">
            全部 <span class="mono">{{ counts.all ?? 0 }}</span>
          </button>
          <button
            v-for="item in KINDS"
            :key="item.value"
            type="button"
            :class="{ active: kindFilter === item.value }"
            @click="kindFilter = item.value"
          >
            {{ item.label }} <span class="mono">{{ counts[item.value] ?? 0 }}</span>
          </button>
        </div>

        <div class="notes-list">
          <button
            v-for="note in filtered"
            :key="note._id"
            class="note-row"
            :class="{ selected: note._id === selectedId }"
            type="button"
            @click="selectNote(note)"
          >
            <div class="note-row-top">
              <span class="note-kind" :class="note.kind">
                <component :is="kindMeta(note.kind).icon" :size="10" />
                {{ kindMeta(note.kind).label }}
              </span>
              <Pin v-if="note.pinned" :size="11" class="note-pin" />
              <span class="mono text-xs faint note-time">{{ formatDateTime(note.updatedAt) }}</span>
            </div>
            <div class="note-row-title">{{ note.title }}</div>
            <p class="note-row-excerpt">{{ excerpt(note) }}</p>
            <div class="note-row-foot">
              <span v-if="note.kind === 'interview'" class="mastery-dots">
                <i v-for="n in 5" :key="n" :class="{ on: n <= note.mastery }" />
              </span>
              <span v-for="tag in note.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </button>

          <StateBlock
            v-if="!filtered.length"
            variant="empty"
            title="没有匹配的记录"
            description="清空搜索条件，或新建一条笔记。"
          />
        </div>
      </aside>

      <section class="note-editor">
        <div class="editor-head">
          <div class="editor-kinds">
            <button
              v-for="item in KINDS"
              :key="item.value"
              type="button"
              :class="{ active: form.kind === item.value }"
              @click="form.kind = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <div class="editor-actions">
            <button
              v-if="selectedId"
              class="icon-btn editor-icon"
              type="button"
              :class="{ pinned: form.pinned }"
              :title="form.pinned ? '取消置顶' : '置顶'"
              @click="togglePin"
            >
              <Pin :size="14" />
            </button>
            <button
              v-if="selectedId"
              class="icon-btn editor-icon danger"
              type="button"
              title="删除笔记"
              :disabled="deleting"
              @click="remove"
            >
              <Trash2 :size="14" />
            </button>
            <button class="btn btn-primary btn-sm" type="button" :disabled="saving" @click="save">
              <span v-if="saving" class="spinner" />
              <Save v-else :size="13" />
              保存
            </button>
          </div>
        </div>

        <input v-model="form.title" class="editor-title" placeholder="标题：一句话说清这条记录" />

        <div v-if="form.kind === 'interview'" class="interview-fields">
          <div class="field">
            <label class="field-label">面试问题</label>
            <textarea v-model="form.question" class="textarea" rows="2" placeholder="例如：如何防止 Agent 执行危险命令？" />
          </div>
          <div class="field">
            <label class="field-label">参考答案 / 我的回答</label>
            <textarea v-model="form.referenceAnswer" class="textarea" rows="4" placeholder="写出结构化回答，标注你不确定的部分。" />
          </div>
          <div class="mastery-row">
            <span class="mono text-xs faint">掌握程度（0–5，需有实际证据）</span>
            <div class="mastery-picker">
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                :class="{ on: n <= form.mastery }"
                :title="`${n} 级`"
                @click="setMastery(n)"
              >{{ n }}</button>
              <span class="mono text-xs faint">{{ form.mastery }}/5</span>
            </div>
          </div>
        </div>

        <div class="editor-tabs">
          <button type="button" :class="{ active: preview === 'edit' }" @click="preview = 'edit'">
            <Pencil :size="12" /> 编辑
          </button>
          <button type="button" :class="{ active: preview === 'preview' }" @click="preview = 'preview'">
            <Eye :size="12" /> 预览
          </button>
          <span class="mono text-xs faint editor-hint">支持 Markdown</span>
        </div>

        <div v-if="preview === 'edit'" class="editor-body">
          <textarea
            v-model="form.content"
            class="editor-textarea mono"
            placeholder="记录背景、结论、代码和待办。粘贴代码时请标注语言。&#10;&#10;```ts&#10;// code&#10;```"
          />
        </div>
        <div v-else class="editor-preview">
          <MarkdownView v-if="form.content.trim()" :source="form.content" />
          <p v-else class="editor-empty">还没有内容。切换回编辑开始写。</p>
        </div>

        <div class="editor-meta">
          <div class="field">
            <label class="field-label">标签（逗号分隔）</label>
            <input v-model="form.tags" class="input" placeholder="e.g. Agent, 安全, 复盘" />
          </div>
          <div class="field">
            <label class="field-label">关联阶段</label>
            <select v-model="form.phaseSlug" class="select">
              <option value="">不关联</option>
              <option v-for="item in phases" :key="item.slug" :value="item.slug">{{ item.shortTitle }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">关联任务 slug</label>
            <input v-model="form.taskSlug" class="input" placeholder="可选，例如 phase-1-day-1" />
          </div>
          <div class="field">
            <label class="field-label">关联项目</label>
            <select v-model="form.projectSlug" class="select">
              <option value="">不关联</option>
              <option :value="MAIN_PROJECT_SLUG">{{ MAIN_PROJECT_NAME }}</option>
            </select>
          </div>
        </div>

        <div v-if="selected" class="editor-foot mono text-xs faint">
          创建于 {{ formatDateTime(selected.createdAt) }} · 更新于 {{ formatDateTime(selected.updatedAt) }}
        </div>
        <div v-else class="editor-foot mono text-xs faint">新记录 · 保存后写入数据库</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.notes-page {
  display: flex;
  flex-direction: column;
}

.notes-layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.notes-sidebar {
  position: sticky;
  top: calc(var(--topbar-height) + 16px);
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: calc(100vh - var(--topbar-height) - 40px);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  padding: 11px;
}

.notes-search {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-soft);
  color: var(--faint);
}

.notes-search:focus-within {
  border-color: rgba(110, 231, 168, 0.4);
}

.notes-search input {
  width: 100%;
  border: 0;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 12px;
}

.notes-kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.notes-kinds button {
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
  transition: 0.15s ease;
}

.notes-kinds button:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.notes-kinds button.active {
  border-color: rgba(110, 231, 168, 0.32);
  background: var(--accent-soft);
  color: var(--accent);
}

.notes-kinds span {
  opacity: 0.7;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow-y: auto;
  min-height: 160px;
}

.note-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: 0.14s ease;
}

.note-row:hover {
  background: var(--surface-2);
}

.note-row.selected {
  border-color: rgba(110, 231, 168, 0.25);
  background: var(--accent-soft);
}

.note-row-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.note-kind {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 9px;
  font-family: var(--mono);
  color: var(--muted);
  background: rgba(255, 255, 255, 0.035);
}

.note-kind.interview {
  color: var(--violet);
  background: var(--violet-soft);
}

.note-kind.issue {
  color: var(--red);
  background: var(--red-soft);
}

.note-kind.snippet {
  color: var(--blue);
  background: var(--blue-soft);
}

.note-pin {
  color: var(--amber);
}

.note-time {
  margin-left: auto;
}

.note-row-title {
  font-size: 12.2px;
  font-weight: 540;
  color: var(--text-soft);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-row-excerpt {
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-row-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.mastery-dots {
  display: inline-flex;
  gap: 2px;
}

.mastery-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.mastery-dots i.on {
  background: var(--violet);
}

.note-editor {
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.editor-kinds {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-soft);
}

.editor-kinds button {
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: 10.5px;
  cursor: pointer;
}

.editor-kinds button.active {
  background: var(--surface-3);
  color: var(--text);
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.editor-icon {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--faint);
}

.editor-icon:hover {
  background: var(--surface-2);
  color: var(--text-soft);
}

.editor-icon.pinned {
  color: var(--amber);
}

.editor-icon.danger:hover {
  color: var(--red);
  background: var(--red-soft);
}

.editor-title {
  width: 100%;
  margin: 12px 0 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 20px;
  font-weight: 600;
  outline: none;
}

.editor-title::placeholder {
  color: #3f524b;
}

.interview-fields {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(195, 173, 255, 0.16);
  border-radius: 9px;
  background: rgba(195, 173, 255, 0.035);
}

.mastery-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mastery-picker {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mastery-picker button {
  width: 24px;
  height: 24px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--bg-soft);
  color: var(--faint);
  font-family: var(--mono);
  font-size: 10px;
  cursor: pointer;
  transition: 0.14s ease;
}

.mastery-picker button:hover {
  border-color: rgba(195, 173, 255, 0.4);
  color: var(--violet);
}

.mastery-picker button.on {
  border-color: rgba(195, 173, 255, 0.45);
  background: var(--violet-soft);
  color: var(--violet);
}

.editor-tabs {
  display: flex;
  align-items: center;
  gap: 3px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.editor-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--faint);
  font-size: 10.5px;
  cursor: pointer;
}

.editor-tabs button:hover {
  color: var(--text-soft);
}

.editor-tabs button.active {
  background: var(--surface-2);
  color: var(--text);
}

.editor-hint {
  margin-left: auto;
}

.editor-body {
  padding-top: 10px;
}

.editor-textarea {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #080e0c;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
}

.editor-textarea:focus {
  border-color: rgba(110, 231, 168, 0.35);
}

.editor-preview {
  min-height: 300px;
  padding: 12px 4px;
}

.editor-empty {
  font-size: 12px;
  color: var(--faint);
}

.editor-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.editor-foot {
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .editor-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .notes-layout {
    grid-template-columns: 1fr;
  }
  .notes-sidebar {
    position: static;
    max-height: 360px;
  }
}

@media (max-width: 600px) {
  .editor-meta {
    grid-template-columns: 1fr;
  }
  .editor-title {
    font-size: 17px;
  }
}
</style>
