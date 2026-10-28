<script setup lang="ts">
import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    variant?: 'empty' | 'error' | 'loading';
    title?: string;
    description?: string;
  }>(),
  { variant: 'empty', title: '', description: '' }
);
</script>

<template>
  <div class="state-block" :class="variant">
    <div class="state-icon">
      <LoaderCircle v-if="variant === 'loading'" class="loading-icon" />
      <AlertTriangle v-else-if="variant === 'error'" />
      <Inbox v-else />
    </div>
    <div class="state-title">{{ title || (variant === 'loading' ? '加载中' : variant === 'error' ? '出了点问题' : '暂无数据') }}</div>
    <p v-if="description" class="state-desc">{{ description }}</p>
    <slot name="action" />
  </div>
</template>

<style scoped>
.state-icon svg {
  width: 19px;
  height: 19px;
}

.state-block.error .state-icon {
  color: var(--red);
  border-color: rgba(255, 133, 133, 0.24);
  background: var(--red-soft);
}

.loading-icon {
  animation: spin 0.9s linear infinite;
}
</style>
