<script setup lang="ts">
withDefaults(
  defineProps<{
    value: number;
    thin?: boolean;
    tone?: 'default' | 'amber';
  }>(),
  { thin: false, tone: 'default' }
);
</script>

<template>
  <div class="progress" :class="{ thin, amber: tone === 'amber' }" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <span :style="{ width: `${Math.min(100, Math.max(0, value))}%` }" />
  </div>
</template>
