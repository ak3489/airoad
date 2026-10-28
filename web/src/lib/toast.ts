import { readonly, ref } from 'vue';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const items = ref<ToastItem[]>([]);
let seed = 0;

export function notify(type: ToastItem['type'], message: string) {
  const id = ++seed;
  items.value.push({ id, type, message });
  setTimeout(() => {
    items.value = items.value.filter((item) => item.id !== id);
  }, 3600);
}

export const notifyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '操作失败，请稍后重试';
  notify('error', message);
};

export const toasts = readonly(items);
