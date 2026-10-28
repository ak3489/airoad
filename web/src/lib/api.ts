import { aiRequestHeaders } from './aiConfig';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(0, '无法连接后端服务，请确认 API 已启动。');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = data as { error?: string; details?: unknown } | null;
    throw new ApiError(
      response.status,
      payload?.error || `请求失败（HTTP ${response.status}）`,
      payload?.details
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  download: async (path: string, filename: string) => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`);
    } catch {
      throw new ApiError(0, '无法连接后端服务，请确认 API 已启动。');
    }
    if (!response.ok) {
      const text = await response.text();
      let message = `请求失败（HTTP ${response.status}）`;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // keep default message
      }
      throw new ApiError(response.status, message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export interface StreamHandlers {
  onMeta?: (data: { conversationId: string; title: string; contextTitle: string }) => void;
  onDelta: (text: string) => void;
  onDone?: (data: { conversationId: string; length: number }) => void;
  onError?: (message: string) => void;
}

export async function streamAiChat(
  payload: Record<string, unknown>,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiRequestHeaders() },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    throw new ApiError(0, '无法连接 AI 服务');
  }

  if (!response.ok) {
    const text = await response.text();
    let message = `AI 请求失败（HTTP ${response.status}）`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* keep default */
    }
    throw new ApiError(response.status, message);
  }

  if (!response.body) throw new ApiError(0, '浏览器不支持流式响应');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    } catch {
      return;
    }
    if (event === 'meta') handlers.onMeta?.(data as never);
    else if (event === 'delta') handlers.onDelta(String(data.text ?? ''));
    else if (event === 'done') handlers.onDone?.(data as never);
    else if (event === 'error') handlers.onError?.(String(data.message ?? 'AI 调用失败'));
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    for (const block of blocks) dispatch(block);
  }
  if (buffer.trim()) dispatch(buffer);
}
