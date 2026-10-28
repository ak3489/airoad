<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next';
import hljs from 'highlight.js/lib/common';
import { computed, ref } from 'vue';

const props = defineProps<{
  code: string;
  language?: string;
  filePath?: string;
}>();

const highlighted = computed(() => {
  const language = props.language && hljs.getLanguage(props.language) ? props.language : 'plaintext';
  return hljs.highlight(props.code, { language }).value;
});

const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div class="code-shell">
    <div class="code-head">
      <span class="code-path mono">{{ filePath || language || 'snippet' }}</span>
      <button class="code-copy" type="button" @click="copy">
        <Check v-if="copied" />
        <Copy v-else />
        {{ copied ? '已复制' : '复制' }}
      </button>
    </div>
    <pre class="code-pre"><code v-html="highlighted" /></pre>
  </div>
</template>

<style scoped>
.code-shell {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #080e0c;
  overflow: hidden;
}

.code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.015);
}

.code-path {
  font-size: 10.5px;
  color: var(--faint);
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--faint);
  font-size: 10.5px;
  cursor: pointer;
  transition: 0.15s ease;
}

.code-copy:hover {
  color: var(--accent);
  border-color: rgba(110, 231, 168, 0.2);
  background: var(--accent-soft);
}

.code-copy svg {
  width: 12px;
  height: 12px;
}

.code-pre {
  margin: 0;
  padding: 13px 14px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.68;
  color: #d7e6df;
}
</style>
