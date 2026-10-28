import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  formatClock,
  formatMinutes,
  isOverdue,
  percentOf,
  relativeDay,
  STATUS_LABEL,
} from './format';

describe('formatMinutes', () => {
  test('handles zero and partial hours', () => {
    expect(formatMinutes(0)).toBe('0 分钟');
    expect(formatMinutes(45)).toBe('45 分钟');
    expect(formatMinutes(60)).toBe('1 小时');
    expect(formatMinutes(95)).toBe('1 小时 35 分');
  });
});

describe('formatClock', () => {
  test('pads each segment', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(3661)).toBe('01:01:01');
    expect(formatClock(59)).toBe('00:00:59');
  });
});

describe('percentOf', () => {
  test('rounds and guards zero totals', () => {
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(3, 4)).toBe(75);
  });
});

describe('relativeDay and isOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('labels today, tomorrow and past days', () => {
    expect(relativeDay(null)).toBe('无截止日期');
    expect(relativeDay(new Date(2026, 9, 28, 23, 0, 0).toISOString())).toBe('今天截止');
    expect(relativeDay(new Date(2026, 9, 29, 9, 0, 0).toISOString())).toBe('明天截止');
    expect(relativeDay(new Date(2026, 9, 27, 9, 0, 0).toISOString())).toBe('昨天已逾期');
    expect(relativeDay(new Date(2026, 9, 24, 9, 0, 0).toISOString())).toBe('逾期 4 天');
    expect(relativeDay(new Date(2026, 10, 2, 9, 0, 0).toISOString())).toBe('5 天后截止');
  });

  test('only unfinished past-due tasks count as overdue', () => {
    expect(isOverdue(new Date(2026, 9, 27).toISOString(), false)).toBe(true);
    expect(isOverdue(new Date(2026, 9, 27).toISOString(), true)).toBe(false);
    expect(isOverdue(new Date(2026, 9, 28, 18, 0, 0).toISOString(), false)).toBe(false);
    expect(isOverdue(null, false)).toBe(false);
  });
});

describe('STATUS_LABEL', () => {
  test('covers every task status', () => {
    expect(STATUS_LABEL).toEqual({
      not_started: '未开始',
      in_progress: '进行中',
      review: '待验收',
      done: '已完成',
    });
  });
});
