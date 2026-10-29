import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/app';
import { MAIN_PROJECT_SLUG } from '../src/lib/constants';
import { LearningTask } from '../src/models';
import { computeStreak, currentWeekOf, dayKey } from '../src/services/progress';
import { updateStep } from '../src/services/taskService';
import { TEST_PROFILE_ID } from './setup';

let app: FastifyInstance;
let base = '';

beforeAll(async () => {
  app = await createApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('测试服务器未启动');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
});

interface ApiResponse {
  statusCode: number;
  payload: string;
  json: () => any;
}

async function api(
  method: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
): Promise<ApiResponse> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
      'x-profile-id': TEST_PROFILE_ID,
      ...(headers ?? {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  return {
    statusCode: res.status,
    payload: text,
    json: () => JSON.parse(text),
  };
}

describe('时间与连续打卡计算', () => {
  test('dayKey 输出本地日期键', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  test('currentWeekOf 将开始日算作第 1 周并限制上限', () => {
    const start = new Date(2026, 0, 1);
    expect(currentWeekOf(start, 12, new Date(2026, 0, 1))).toBe(1);
    expect(currentWeekOf(start, 12, new Date(2026, 0, 8))).toBe(2);
    expect(currentWeekOf(start, 12, new Date(2026, 5, 1))).toBe(12);
    expect(currentWeekOf(start, 12, new Date(2025, 11, 1))).toBe(1);
  });

  test('computeStreak 允许今天未打卡时从昨天连续计算', () => {
    const today = new Date(2026, 9, 28);
    expect(computeStreak(['2026-10-26', '2026-10-27'], today)).toBe(2);
    expect(computeStreak(['2026-10-26', '2026-10-27', '2026-10-28'], today)).toBe(3);
    expect(computeStreak([], today)).toBe(0);
  });
});

describe('初始概览与种子数据', () => {
  test('健康检查返回数据库已连接', async () => {
    const res = await api('GET', '/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json().db).toBe('connected');
  });

  test('概览没有虚构进度', async () => {
    const res = await api('GET', '/api/overview');
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.phases).toHaveLength(7);
    expect(data.stats.totalTasks).toBe(53);
    expect(data.stats.doneTasks).toBe(0);
    expect(data.stats.completionRate).toBe(0);
    expect(data.time.totalMinutes).toBe(0);
    expect(data.stats.overdueTasks).toBe(0);
    expect(data.today.recommended.slug).toBe('p1-t1-setup-lab');
    expect(data.activePhase.slug).toBe('phase-1');
  });

  test('路线图包含 7 个阶段和任务', async () => {
    const res = await api('GET', '/api/plan');
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.phases).toHaveLength(7);
    expect(data.phases[0].tasks.length).toBe(8);
    expect(data.phases[0].progress.status).toBe('active');
    expect(data.phases[1].progress.status).toBe('locked');
  });

  test('步骤带顺序与参考答案', async () => {
    const task = await LearningTask.findOne({ profileId: TEST_PROFILE_ID, slug: 'p4-t1-mcp-basics' }).lean();
    expect(task).not.toBeNull();
    const steps = [...(task?.steps ?? [])].sort((a, b) => a.order - b.order);
    expect(steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(steps.every((step) => Boolean(step.reference?.approach))).toBe(true);
    expect(steps[1].reference?.files?.length).toBeGreaterThan(0);

    const detail = (await api('GET', '/api/tasks/p4-t1-mcp-basics')).json();
    expect(detail.task.steps[0].reference.approach).toContain('clientInfo');
  });

  test('旧群晖任务以选修形式保留，不计入主线统计', async () => {
    const tasks = (await api('GET', '/api/tasks')).json();
    expect(tasks).toHaveLength(55);
    const optional = tasks.filter((task: any) => task.optional);
    expect(optional.map((task: any) => task.slug).sort()).toEqual([
      'p4-t7-dsm-readonly',
      'p5-t2-docker-tools',
    ]);
    expect(optional.every((task: any) => task.dueDate === null)).toBe(true);

    const acceptance = (await api('GET', '/api/phase-acceptance')).json();
    for (const item of acceptance) {
      const required = tasks.filter(
        (task: any) => task.phaseSlug === item.phaseSlug && !task.optional
      ).length;
      expect(item.tasksTotal).toBe(required);
    }

    const overview = (await api('GET', '/api/overview')).json();
    expect(overview.stats.totalTasks).toBe(53);
  });
});

describe('任务状态机与步骤门禁', () => {
  const slug = 'p1-t1-setup-lab';

  test('未完成步骤不能直接标记任务完成', async () => {
    const start = await api('POST', `/api/tasks/${slug}/status`, { status: 'in_progress' });
    expect(start.statusCode).toBe(200);

    const skip = await api('POST', `/api/tasks/${slug}/status`, { status: 'done' });
    expect(skip.statusCode).toBe(409);
    expect(skip.json().details.incompleteSteps.length).toBeGreaterThan(0);
  });

  test('不能跳过前置步骤', async () => {
    const detail = (await api('GET', `/api/tasks/${slug}`)).json();
    const steps = detail.task.steps;
    const res = await api('PATCH', `/api/tasks/${slug}/steps/${steps[1].key}`, {
      status: 'done',
    });
    expect(res.statusCode).toBe(409);
  });

  test('步骤日志可保存且完成后解锁下一步', async () => {
    const detail = (await api('GET', `/api/tasks/${slug}`)).json();
    const steps = [...detail.task.steps].sort((a: any, b: any) => a.order - b.order);

    const first = await api('PATCH', `/api/tasks/${slug}/steps/${steps[0].key}`, {
      status: 'done',
      resultLog: 'npm run dev 启动成功，端口 3000',
      errorLog: '首次忘记 .env',
    });
    expect(first.statusCode).toBe(200);

    const after = (await api('GET', `/api/tasks/${slug}`)).json();
    const ordered = [...after.task.steps].sort((a: any, b: any) => a.order - b.order);
    expect(ordered[0].status).toBe('done');
    expect(ordered[0].resultLog).toContain('启动成功');
    expect(ordered[0].locked).toBe(false);
    expect(ordered[1].locked).toBe(false);
    expect(ordered[2].locked).toBe(true);
  });

  test('完成全部步骤后可进入待验收并完成', async () => {
    const detail = (await api('GET', `/api/tasks/${slug}`)).json();
    const steps = [...detail.task.steps].sort((a: any, b: any) => a.order - b.order);
    for (const step of steps) {
      if (step.status === 'done') continue;
      const res = await api('PATCH', `/api/tasks/${slug}/steps/${step.key}`, {
        status: 'done',
        resultLog: `完成 ${step.title}`,
      });
      expect(res.statusCode).toBe(200);
    }

    const review = await api('POST', `/api/tasks/${slug}/status`, {
      status: 'review',
      note: '自测通过',
    });
    expect(review.statusCode).toBe(200);

    const done = await api('POST', `/api/tasks/${slug}/status`, {
      status: 'done',
      note: '验收通过',
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().task.status).toBe('done');
  });

  test('记录学习时间会累计到任务与概览', async () => {
    const res = await api('POST', `/api/tasks/${slug}/records`, {
      minutes: 45,
      summary: '初始化练习仓库',
    });
    expect(res.statusCode).toBe(201);

    const detail = (await api('GET', `/api/tasks/${slug}`)).json();
    expect(detail.actualMinutes).toBe(45);

    const overview = (await api('GET', '/api/overview')).json();
    expect(overview.time.totalMinutes).toBe(45);
    expect(overview.time.streak).toBe(1);
    expect(overview.stats.doneTasks).toBe(1);

    const tasks = (await api('GET', '/api/tasks?status=done')).json();
    expect(tasks[0].actualMinutes).toBe(45);
  });

  test('拆分任务生成依赖链且自定义任务可删除', async () => {
    const res = await api('POST', `/api/tasks/${slug}/split`, {
      parts: [
        { title: '拆分：初始化目录结构', objective: '建立目录与 git 仓库', estimatedMinutes: 20 },
        { title: '拆分：配置 TypeScript', objective: '配置 tsconfig 与脚本', estimatedMinutes: 30 },
      ],
    });
    expect(res.statusCode).toBe(201);
    const tasks = res.json().tasks;
    expect(tasks).toHaveLength(2);
    expect(tasks[0].prerequisiteSlugs).toEqual([slug]);
    expect(tasks[1].prerequisiteSlugs).toEqual([tasks[0].slug]);

    for (const task of tasks) {
      const del = await api('DELETE', `/api/tasks/${task.slug}`);
      expect(del.statusCode).toBe(200);
    }

    const guard = await api('DELETE', `/api/tasks/${slug}`);
    expect(guard.statusCode).toBe(403);
  });

  test('退回已完成步骤会把任务降级为进行中', async () => {
    const tempSlug = 'test-step-reopen';
    await LearningTask.findOneAndDelete({ profileId: TEST_PROFILE_ID, slug: tempSlug });
    await LearningTask.create({
      profileId: TEST_PROFILE_ID,
      slug: tempSlug,
      phaseSlug: 'phase-1',
      week: 1,
      day: 1,
      order: 99,
      title: '临时步骤回退任务',
      objective: '验证步骤回退后的任务状态一致性。',
      estimatedMinutes: 30,
      status: 'done',
      dueDate: null,
      startedAt: new Date(),
      completedAt: new Date(),
      tags: [],
      acceptance: [],
      resourceSlugs: [],
      prerequisiteSlugs: [],
      steps: [
        {
          key: 's1',
          order: 1,
          title: '唯一步骤',
          goal: '验证回退',
          instructions: '回退该步骤',
          acceptance: [],
          status: 'done',
          completedAt: new Date(),
        },
      ],
      statusHistory: [{ status: 'done', at: new Date(), note: '' }],
    });

    const updated = await updateStep(TEST_PROFILE_ID, tempSlug, 's1', { status: 'todo' });
    expect(updated?.status).toBe('in_progress');
    expect(updated?.completedAt).toBeNull();
    expect(updated?.statusHistory.at(-1)?.note).toContain('退回步骤');

    await LearningTask.findOneAndDelete({ profileId: TEST_PROFILE_ID, slug: tempSlug });
  });
});

describe('周复盘与验收证据', () => {
  test('生成周复盘并汇总真实投入', async () => {
    const res = await api('POST', '/api/reviews/1/generate');
    expect(res.statusCode).toBe(200);
    const review = res.json().review;
    expect(review.actualMinutes).toBe(45);
    expect(review.status).toBe('draft');
    expect(review.completedTaskSlugs).toContain('p1-t1-setup-lab');
    expect(review.metricsSnapshot.tasksDone).toBe(1);
  });

  test('复盘定稿需要填写关键字段', async () => {
    const missing = await api('PATCH', '/api/reviews/1', { status: 'final' });
    expect(missing.statusCode).toBe(400);

    const ok = await api('PATCH', '/api/reviews/1', {
      status: 'final',
      newSkills: '理解了 fetch 调用与错误处理',
      challenges: 'SSE 解析容易漏掉半包',
      nextWeekPlan: '完成结构化输出与 Provider 抽象',
    });
    expect(ok.statusCode).toBe(200);

    const regenerate = (await api('POST', '/api/reviews/1/generate')).json();
    expect(regenerate.generated).toBe(false);
  });

  test('阶段未完成时不能判定通过，任务完成后可以留下证据', async () => {
    const phasePass = await api('POST', '/api/evaluations', {
      scope: 'phase',
      targetSlug: 'phase-1',
      title: '阶段一验收',
      evidence: '已完成 p1-t1，其余任务未开始，证据不足。',
      result: 'pass',
    });
    expect(phasePass.statusCode).toBe(409);

    const taskPass = await api('POST', '/api/evaluations', {
      scope: 'task',
      targetSlug: 'p1-t1-setup-lab',
      title: '环境搭建验收',
      evidence: 'agent-lab 可运行，.env 未提交，截图与命令输出见笔记。',
      result: 'pass',
      score: 90,
    });
    expect(taskPass.statusCode).toBe(201);

    const list = (await api('GET', '/api/evaluations?target=p1-t1-setup-lab')).json();
    expect(list).toHaveLength(1);
    expect(list[0].result).toBe('pass');
  });
});

describe('资料、笔记与项目', () => {
  test('资料库记录核验日期且可按任务过滤', async () => {
    const res = await api('GET', '/api/resources?task=p1-t1-setup-lab');
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].lastVerifiedAt).toBeTruthy();
    expect(items[0].linkedTasks.some((task: any) => task.slug === 'p1-t1-setup-lab')).toBe(true);
  });

  test('笔记创建、搜索与非法 ID 处理', async () => {
    const created = await api('POST', '/api/notes', {
      title: 'SSE 半包问题',
      kind: 'issue',
      content: '解析 SSE 时需要缓存跨 chunk 的残留 buffer。',
      tags: ['SSE', '流式'],
    });
    expect(created.statusCode).toBe(201);

    const search = (await api('GET', '/api/notes?q=半包')).json();
    expect(search).toHaveLength(1);

    const invalid = await api('GET', '/api/notes/not-an-id');
    expect(invalid.statusCode).toBe(404);
  });

  test('项目接口返回里程碑、任务与开放问题', async () => {
    const res = await api('GET', `/api/projects/${MAIN_PROJECT_SLUG}`);
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.milestones).toHaveLength(10);
    expect(data.stats.tasksTotal).toBe(24);
    expect(data.project.securityNotes.length).toBeGreaterThan(0);

    const log = await api('POST', `/api/projects/${MAIN_PROJECT_SLUG}/logs`, {
      type: 'issue',
      title: '订单查询超时处理',
      content: '需要实现 mock CRM 超时降级。',
    });
    expect(log.statusCode).toBe(201);

    const overview = (await api('GET', '/api/overview')).json();
    expect(overview.openIssues.some((issue: any) => issue.title === '订单查询超时处理')).toBe(true);
  });
});

describe('数据备份导出', () => {
  test('导出 JSON 包含学习数据且不含密钥字段', async () => {
    const res = await fetch(`${base}/api/export`, {
      headers: { 'x-profile-id': TEST_PROFILE_ID },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const data = await res.json();
    expect(data.format).toBe('airoad-backup');
    expect(data.data.plan).toHaveLength(1);
    expect(data.data.phases).toHaveLength(7);
    expect(data.data.tasks).toHaveLength(55);
    expect(data.data.resources).toHaveLength(29);
    expect(JSON.stringify(data)).not.toContain('apiKey');
  });
});

describe('AI 配置由浏览器提供', () => {
  test('没有请求头配置时聊天与测试返回 503', async () => {
    const chat = await api('POST', '/api/ai/chat', {
      scope: 'general',
      message: '帮我看看本周计划',
    });
    expect(chat.statusCode).toBe(503);

    const testRes = await api('POST', '/api/ai/test');
    expect(testRes.statusCode).toBe(503);

    const settings = (await api('GET', '/api/settings')).json();
    expect(JSON.stringify(settings)).not.toContain('apiKey');
    expect(settings.ai).toBeUndefined();
  });

  test('请求头中的 Base URL 会校验协议', async () => {
    const res = await api('POST', '/api/ai/test', undefined, {
      'x-ai-key': 'sk-test',
      'x-ai-base-url': 'ftp://example.com',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('匿名学习档案隔离', () => {
  async function createProfile(): Promise<string> {
    const res = await fetch(`${base}/api/profile`, { method: 'POST' });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { profileId: string; contentVersion: number };
    expect(data.profileId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(data.contentVersion).toBeGreaterThan(0);
    return data.profileId;
  }

  test('缺少档案头返回 401，未知档案返回 404', async () => {
    const missing = await fetch(`${base}/api/overview`);
    expect(missing.status).toBe(401);

    const unknown = await fetch(`${base}/api/overview`, {
      headers: { 'x-profile-id': 'unknown-profile-0001' },
    });
    expect(unknown.status).toBe(404);
  });

  test('新建档案自动获得完整课程且进度为零', async () => {
    const profileId = await createProfile();
    const headers = { 'x-profile-id': profileId };

    const overview = await (await fetch(`${base}/api/overview`, { headers })).json();
    expect(overview.stats.totalTasks).toBe(53);
    expect(overview.stats.doneTasks).toBe(0);
    expect(overview.time.totalMinutes).toBe(0);

    const tasks = await (await fetch(`${base}/api/tasks`, { headers })).json();
    expect(tasks).toHaveLength(55);

    const plan = await (await fetch(`${base}/api/plan`, { headers })).json();
    expect(plan.phases).toHaveLength(7);
  });

  test('笔记与项目记录不会跨档案泄漏', async () => {
    const profileA = await createProfile();
    const profileB = await createProfile();

    const created = await fetch(`${base}/api/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-profile-id': profileA },
      body: JSON.stringify({ title: 'A 档案私有笔记', kind: 'issue', content: '只属于 A' }),
    });
    expect(created.status).toBe(201);

    const listA = await (await fetch(`${base}/api/notes`, { headers: { 'x-profile-id': profileA } })).json();
    const listB = await (await fetch(`${base}/api/notes`, { headers: { 'x-profile-id': profileB } })).json();
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(0);

    const settingsA = await (await fetch(`${base}/api/settings`, { headers: { 'x-profile-id': profileA } })).json();
    const settingsB = await (await fetch(`${base}/api/settings`, { headers: { 'x-profile-id': profileB } })).json();
    expect(settingsA.storage.notes).toBe(1);
    expect(settingsB.storage.notes).toBe(0);
  });

  test('使用档案码恢复同一档案', async () => {
    const profileId = await createProfile();
    const res = await fetch(`${base}/api/profile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: profileId }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { profileId: string }).profileId).toBe(profileId);
  });

  test('不存在的档案码返回 404 而不是新建档案', async () => {
    const res = await fetch(`${base}/api/profile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'missing-profile-0001' }),
    });
    expect(res.status).toBe(404);
  });
});
