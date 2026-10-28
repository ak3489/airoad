import { HttpError } from '../lib/http';

export interface AIMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEFAULT_AI_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_AI_MODEL = 'deepseek-chat';

const MAX_KEY_LENGTH = 500;

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function readAIConfig(headers: Record<string, string | string[] | undefined>): AIRequestConfig {
  const apiKey = headerValue(headers['x-ai-key']).trim();
  if (!apiKey) {
    throw new HttpError(
      503,
      '尚未配置模型 API。请在「设置 → 模型连接」填写 API Key（只保存在当前浏览器）；学习、任务与资料库不受影响。'
    );
  }
  if (apiKey.length > MAX_KEY_LENGTH) throw new HttpError(400, 'API Key 长度异常');

  const rawBase = headerValue(headers['x-ai-base-url']).trim() || DEFAULT_AI_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(rawBase);
  } catch {
    throw new HttpError(400, 'Base URL 不是合法地址');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HttpError(400, 'Base URL 只支持 http/https');
  }
  if (parsed.username || parsed.password) {
    throw new HttpError(400, 'Base URL 不能包含账号密码');
  }

  const model = headerValue(headers['x-ai-model']).trim().slice(0, 100) || DEFAULT_AI_MODEL;

  return {
    apiKey,
    baseUrl: rawBase.replace(/\/+$/, ''),
    model,
  };
}

async function postChat(ai: AIRequestConfig, body: Record<string, unknown>, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new HttpError(502, '无法连接模型服务，请检查 Base URL 与网络', {
      reason: error instanceof Error ? error.message : 'network error',
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(502, `模型服务返回 ${res.status}`, {
      status: res.status,
      body: text.slice(0, 500),
    });
  }
  return res;
}

export async function chatOnce(
  ai: AIRequestConfig,
  messages: AIMessageInput[],
  maxTokens = 1200
): Promise<string> {
  const res = await postChat(
    ai,
    {
      model: ai.model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      stream: false,
    },
    AbortSignal.timeout(45_000)
  );
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, '模型返回了空内容');
  return content;
}

export async function* streamChat(
  ai: AIRequestConfig,
  messages: AIMessageInput[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const res = await postChat(
    ai,
    {
      model: ai.model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
      stream: true,
    },
    signal
  );
  if (!res.body) throw new HttpError(502, '模型未返回流式响应');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) yield piece;
        } catch {
          // Ignore malformed keep-alive fragments, continue streaming.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
