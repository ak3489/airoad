import type { ZodType } from 'zod';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = '资源不存在'): never {
  throw new HttpError(404, message);
}

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, '请求参数校验失败', result.error.flatten());
  }
  return result.data;
}
