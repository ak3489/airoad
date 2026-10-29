import { ref } from 'vue';
import { API_BASE } from './apiBase';

const STORAGE_KEY = 'airoad.profile.v1';

export const PROFILE_HEADER = 'X-Profile-Id';

export interface ProfileInfo {
  profileId: string;
  contentVersion: number;
  legacy: boolean;
  legacyTransferred?: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
}

function readStoredCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export const profileCode = ref(readStoredCode());
export const profileReady = ref(false);
export const profileError = ref('');

let ready: Promise<boolean> | null = null;

async function postProfile(body?: { code?: string }): Promise<ProfileInfo> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error('无法连接后端服务，请确认 API 已启动。');
  }
  const text = await response.text();
  let data: (Partial<ProfileInfo> & { error?: string }) | null = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new Error(data?.error || `档案请求失败（HTTP ${response.status}）`);
  }
  return data as ProfileInfo;
}

function persistCode(code: string) {
  profileCode.value = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // 浏览器存储不可用时仅当前页面有效
  }
}

async function init(): Promise<boolean> {
  profileError.value = '';
  try {
    if (profileCode.value) {
      const profile = await postProfile({ code: profileCode.value });
      persistCode(profile.profileId);
    } else {
      const created = await postProfile();
      persistCode(created.profileId);
    }
    profileReady.value = true;
    return true;
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : '学习档案初始化失败';
    return false;
  }
}

export function ensureProfile(): Promise<boolean> {
  if (!ready) {
    ready = init().then((ok) => {
      if (!ok) ready = null;
      return ok;
    });
  }
  return ready;
}

export function profileHeaders(): Record<string, string> {
  return profileCode.value ? { [PROFILE_HEADER]: profileCode.value } : {};
}

export async function switchProfile(rawCode: string): Promise<void> {
  const code = rawCode.trim();
  if (!code) throw new Error('请填写档案码');
  const profile = await postProfile({ code });
  persistCode(profile.profileId);
  ready = Promise.resolve(true);
  profileReady.value = true;
  window.location.reload();
}

export async function createNewProfile(): Promise<void> {
  const profile = await postProfile();
  persistCode(profile.profileId);
  ready = Promise.resolve(true);
  profileReady.value = true;
  window.location.reload();
}

export function shortProfileCode(code: string): string {
  return code ? `${code.slice(0, 4)}…${code.slice(-4)}` : '未建立';
}
