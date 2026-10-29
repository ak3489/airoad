import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { config } from './config';
import { HttpError } from './lib/http';
import { isValidProfileCode, normalizeProfileCode, PROFILE_HEADER } from './lib/profile';
import { apiRoutes } from './routes';
import { profileExists } from './services/profileService';

export async function createApp(options: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...options });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || origin === config.webOrigin) return callback(null, true);
      return callback(new Error('Origin not allowed'), false);
    },
    credentials: false,
    allowedHeaders: [
      'Content-Type',
      PROFILE_HEADER,
      'x-ai-key',
      'x-ai-base-url',
      'x-ai-model',
    ],
  });

  app.decorateRequest('profileId', '');
  app.addHook('onRequest', async (request) => {
    if (request.method === 'OPTIONS') return;
    const path = (request.raw.url ?? '').split('?')[0];
    if (!path.startsWith('/api/')) return;
    if (path === '/api/health') return;
    if (path === '/api/profile' && request.method === 'POST') return;

    const header = request.headers[PROFILE_HEADER];
    const profileId = normalizeProfileCode(Array.isArray(header) ? header[0] : header);
    if (!profileId) {
      throw new HttpError(401, '缺少学习档案码，请刷新页面重新建立档案', {
        code: 'PROFILE_REQUIRED',
      });
    }
    if (!isValidProfileCode(profileId)) {
      throw new HttpError(400, '学习档案码格式不正确', { code: 'PROFILE_INVALID' });
    }
    if (!(await profileExists(profileId))) {
      throw new HttpError(404, '学习档案不存在或已失效', { code: 'PROFILE_UNKNOWN' });
    }
    request.profileId = profileId;
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.status).send({
        error: error.message,
        details: error.details ?? null,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: '请求参数校验失败',
        details: error.flatten(),
      });
    }

    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: error.message, details: null });
    }

    request.log.error({ err: error }, 'unhandled request error');
    console.error('[server] unhandled error:', error);
    return reply.status(500).send({ error: '服务器内部错误', details: null });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: `未找到接口 ${request.method} ${request.url}`, details: null })
  );

  await app.register(apiRoutes, { prefix: '/api' });

  return app;
}
