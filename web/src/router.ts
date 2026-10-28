import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 };
  },
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('./views/DashboardView.vue'),
      meta: { title: '总览' },
    },
    {
      path: '/roadmap',
      name: 'roadmap',
      component: () => import('./views/RoadmapView.vue'),
      meta: { title: '学习路线' },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('./views/TasksView.vue'),
      meta: { title: '每日任务' },
    },
    {
      path: '/tasks/:slug',
      name: 'task-detail',
      component: () => import('./views/TaskDetailView.vue'),
      meta: { title: '任务工作台' },
    },
    {
      path: '/labs',
      name: 'labs',
      component: () => import('./views/LabsView.vue'),
      meta: { title: '实操教程' },
    },
    {
      path: '/resources',
      name: 'resources',
      component: () => import('./views/ResourcesView.vue'),
      meta: { title: '资料库' },
    },
    {
      path: '/project',
      name: 'project',
      component: () => import('./views/ProjectView.vue'),
      meta: { title: '主项目' },
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('./views/NotesView.vue'),
      meta: { title: '笔记与面试' },
    },
    {
      path: '/reviews',
      name: 'reviews',
      component: () => import('./views/ReviewsView.vue'),
      meta: { title: '周复盘与验收' },
    },
    {
      path: '/assistant',
      name: 'assistant',
      component: () => import('./views/AssistantView.vue'),
      meta: { title: 'AI 学习助手' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) || 'AI Agent 工程师成长计划';
  document.title = `${title} · AI Agent 成长计划`;
});
