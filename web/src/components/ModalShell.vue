<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';

withDefaults(defineProps<{ title: string; wide?: boolean; sub?: string }>(), {
  wide: false,
  sub: '',
});
const emit = defineEmits<{ close: [] }>();

const titleId = `modal-title-${useId()}`;
const modalRef = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables() {
  const root = modalRef.value;
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null
  );
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusables();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const inside = active ? modalRef.value?.contains(active) : false;
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  lastFocused = document.activeElement as HTMLElement | null;
  document.addEventListener('keydown', onKey);
  await nextTick();
  const items = focusables();
  const primary = items.find((element) => element.matches('input, textarea, select')) ?? items[0];
  primary?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  lastFocused?.focus?.();
});
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.self="emit('close')">
      <div
        ref="modalRef"
        class="modal"
        :class="{ wide }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="modal-head">
          <div>
            <div :id="titleId" class="modal-title">{{ title }}</div>
            <div v-if="sub" class="text-xs faint mt-4">{{ sub }}</div>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>
        <div class="modal-body"><slot /></div>
        <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
