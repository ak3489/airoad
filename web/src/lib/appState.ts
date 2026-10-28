import { ref } from 'vue';
import { api } from './api';
import type { Overview, Settings } from '@/types';

export const sidebarOpen = ref(false);
export const aiOpen = ref(false);
export const searchOpen = ref(false);

const overview = ref<Overview | null>(null);
const overviewLoading = ref(false);
const overviewError = ref('');
const settings = ref<Settings | null>(null);
let inFlight: Promise<void> | null = null;

export async function loadOverview(force = false): Promise<void> {
  if (overview.value && !force) return;
  if (inFlight) return inFlight;
  overviewLoading.value = true;
  overviewError.value = '';
  inFlight = (async () => {
    try {
      overview.value = await api.get<Overview>('/overview');
    } catch (error) {
      overviewError.value = error instanceof Error ? error.message : '概览加载失败';
    } finally {
      overviewLoading.value = false;
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function loadSettings(force = false): Promise<void> {
  if (settings.value && !force) return;
  try {
    settings.value = await api.get<Settings>('/settings');
  } catch {
    settings.value = null;
  }
}

export function useAppState() {
  return {
    sidebarOpen,
    aiOpen,
    searchOpen,
    overview,
    overviewLoading,
    overviewError,
    settings,
    refresh: () => loadOverview(true),
  };
}
