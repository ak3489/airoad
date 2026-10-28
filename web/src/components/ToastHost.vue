<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from 'lucide-vue-next';
import { toasts } from '@/lib/toast';
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" role="status" aria-live="polite" aria-atomic="false">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
        <CircleCheck v-if="toast.type === 'success'" :size="15" />
        <CircleAlert v-else-if="toast.type === 'error'" :size="15" />
        <Info v-else :size="15" />
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </Teleport>
</template>
