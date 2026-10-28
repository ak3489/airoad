import type { PhaseStatus, TaskStatus } from '@/types';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  review: '待验收',
  done: '已完成',
};

export const PHASE_LABEL: Record<PhaseStatus, string> = {
  locked: '未解锁',
  active: '进行中',
  completed: '已完成',
};

export function formatMinutes(minutes: number): string {
  if (!minutes) return '0 分钟';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} 分钟`;
  if (!rest) return `${hours} 小时`;
  return `${hours} 小时 ${rest} 分`;
}

export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeDay(value: string | null | undefined): string {
  if (!value) return '无截止日期';
  const target = new Date(value);
  const start = new Date();
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return '今天截止';
  if (diff === 1) return '明天截止';
  if (diff === -1) return '昨天已逾期';
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
  return `${diff} 天后截止`;
}

export function isOverdue(value: string | null | undefined, done: boolean): boolean {
  if (!value || done) return false;
  return new Date(value).getTime() < new Date().setHours(0, 0, 0, 0);
}

export function percentOf(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}
