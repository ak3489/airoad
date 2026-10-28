<script setup lang="ts">
import { ArrowLeft, Compass } from 'lucide-vue-next';
</script>

<template>
  <div class="not-found">
    <div class="nf-mark mono">404</div>
    <div class="nf-icon"><Compass :size="22" /></div>
    <h1>这条路径不存在</h1>
    <p>可能链接已经调整，或者任务被重新规划。回到总览继续今天的学习。</p>
    <div class="nf-actions">
      <RouterLink to="/" class="btn btn-primary"><ArrowLeft :size="14" /> 返回总览</RouterLink>
      <RouterLink to="/tasks" class="btn">查看每日任务</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 62vh;
  padding: 40px 20px;
}

.nf-mark {
  font-size: 84px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px var(--line-strong);
  user-select: none;
}

.nf-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin: -14px 0 16px;
  border-radius: 14px;
  border: 1px solid rgba(110, 231, 168, 0.25);
  background: var(--accent-soft);
  color: var(--accent);
}

h1 {
  font-size: 20px;
  font-weight: 600;
}

p {
  max-width: 380px;
  margin: 8px 0 20px;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.65;
}

.nf-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
