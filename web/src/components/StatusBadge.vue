<script setup lang="ts">
import { computed } from 'vue';
import { STATUS_LABEL } from '@/lib/format';

const props = defineProps<{
  status: string;
  label?: string;
}>();

const classMap: Record<string, string> = {
  done: 'badge-done',
  in_progress: 'badge-progress',
  review: 'badge-review',
  not_started: 'badge-idle',
  locked: 'badge',
  completed: 'badge-done',
  active: 'badge-progress',
  open: 'badge-danger',
  resolved: 'badge-done',
  final: 'badge-done',
  draft: 'badge-idle',
  todo: 'badge-idle',
  backlog: 'badge-idle',
  doing: 'badge-progress',
  pass: 'badge-done',
  partial: 'badge-review',
  fail: 'badge-danger',
  unread: 'badge-idle',
  reading: 'badge-progress',
  archived: 'badge-idle',
  planned: 'badge-idle',
  paused: 'badge-review',
};

const text = computed(() => {
  if (props.label) return props.label;
  if (props.status in STATUS_LABEL) return STATUS_LABEL[props.status as keyof typeof STATUS_LABEL];
  const fallback: Record<string, string> = {
    locked: '未解锁',
    completed: '已完成',
    active: '进行中',
    todo: '待开始',
    backlog: '待办',
    doing: '进行中',
    open: '未解决',
    resolved: '已解决',
    draft: '草稿',
    final: '已定稿',
    planned: '规划中',
    paused: '已暂停',
    pass: '通过',
    partial: '部分通过',
    fail: '未通过',
    unread: '未读',
    reading: '阅读中',
    archived: '已归档',
  };
  return fallback[props.status] ?? props.status;
});
</script>

<template>
  <span class="badge" :class="classMap[status] ?? 'badge'">{{ text }}</span>
</template>
