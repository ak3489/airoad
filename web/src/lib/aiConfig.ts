import { computed, reactive } from 'vue';

export const AI_STORAGE_KEY = 'airoad.ai.config.v1';
export const DEFAULT_AI_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_AI_MODEL = 'deepseek-chat';

export interface LocalAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function defaults(): LocalAiConfig {
  return { apiKey: '', baseUrl: DEFAULT_AI_BASE_URL, model: DEFAULT_AI_MODEL };
}

export function normalizeBaseUrl(value: string) {
  return (value.trim() || DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
}

function read(): LocalAiConfig {
  if (typeof localStorage === 'undefined') return defaults();
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<LocalAiConfig>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseUrl:
        typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
          ? normalizeBaseUrl(parsed.baseUrl)
          : DEFAULT_AI_BASE_URL,
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model.trim()
          : DEFAULT_AI_MODEL,
    };
  } catch {
    return defaults();
  }
}

export const aiConfig = reactive<LocalAiConfig>(read());
export const aiConfigured = computed(() => aiConfig.apiKey.trim().length > 0);

export function saveAiConfig(next: LocalAiConfig): boolean {
  aiConfig.apiKey = next.apiKey.trim();
  aiConfig.baseUrl = normalizeBaseUrl(next.baseUrl);
  aiConfig.model = next.model.trim() || DEFAULT_AI_MODEL;
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({ ...aiConfig }));
    return true;
  } catch {
    return false;
  }
}

export function clearAiConfig() {
  Object.assign(aiConfig, defaults());
  try {
    localStorage.removeItem(AI_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; in-memory state is still reset.
  }
}

export function aiRequestHeaders(config: LocalAiConfig = aiConfig): Record<string, string> {
  return {
    'x-ai-key': config.apiKey.trim(),
    'x-ai-base-url': normalizeBaseUrl(config.baseUrl),
    'x-ai-model': config.model.trim() || DEFAULT_AI_MODEL,
  };
}

export function maskKey(key: string) {
  const value = key.trim();
  if (!value) return '';
  if (value.length <= 10) return '••••••';
  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
}
