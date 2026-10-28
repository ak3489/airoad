import { beforeEach, describe, expect, test, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('浏览器本地 AI 配置', () => {
  test('默认没有密钥与自定义模型', async () => {
    const mod = await import('./aiConfig');
    expect(mod.aiConfig.apiKey).toBe('');
    expect(mod.aiConfig.baseUrl).toBe('https://api.deepseek.com');
    expect(mod.aiConfig.model).toBe('deepseek-chat');
    expect(mod.aiConfigured.value).toBe(false);
  });

  test('保存后写入 localStorage 并规范化地址', async () => {
    const mod = await import('./aiConfig');
    const saved = mod.saveAiConfig({
      apiKey: '  sk-test-1234567890  ',
      baseUrl: ' https://api.deepseek.com/ ',
      model: ' deepseek-chat ',
    });

    expect(saved).toBe(true);
    expect(mod.aiConfig.apiKey).toBe('sk-test-1234567890');
    expect(mod.aiConfig.baseUrl).toBe('https://api.deepseek.com');
    expect(mod.aiConfigured.value).toBe(true);

    const stored = JSON.parse(localStorage.getItem(mod.AI_STORAGE_KEY) ?? '{}');
    expect(stored.apiKey).toBe('sk-test-1234567890');
    expect(stored.model).toBe('deepseek-chat');
  });

  test('页面重载时从 localStorage 恢复', async () => {
    localStorage.setItem(
      'airoad.ai.config.v1',
      JSON.stringify({ apiKey: 'sk-restored', baseUrl: 'https://example.com/v1/', model: 'qwen' })
    );
    const mod = await import('./aiConfig');
    expect(mod.aiConfig.apiKey).toBe('sk-restored');
    expect(mod.aiConfig.baseUrl).toBe('https://example.com/v1');
    expect(mod.aiConfig.model).toBe('qwen');
  });

  test('损坏的存储内容回退到默认值', async () => {
    localStorage.setItem('airoad.ai.config.v1', '{not-json');
    const mod = await import('./aiConfig');
    expect(mod.aiConfig.apiKey).toBe('');
    expect(mod.aiConfig.baseUrl).toBe('https://api.deepseek.com');
  });

  test('请求头包含当前配置', async () => {
    const mod = await import('./aiConfig');
    mod.saveAiConfig({ apiKey: 'sk-header', baseUrl: 'https://example.com', model: 'deepseek-chat' });
    expect(mod.aiRequestHeaders()).toEqual({
      'x-ai-key': 'sk-header',
      'x-ai-base-url': 'https://example.com',
      'x-ai-model': 'deepseek-chat',
    });
  });

  test('清除后移除存储与内存配置', async () => {
    const mod = await import('./aiConfig');
    mod.saveAiConfig({ apiKey: 'sk-clear', baseUrl: 'https://example.com', model: 'm' });
    mod.clearAiConfig();

    expect(mod.aiConfig.apiKey).toBe('');
    expect(mod.aiConfigured.value).toBe(false);
    expect(localStorage.getItem(mod.AI_STORAGE_KEY)).toBeNull();
  });
});
