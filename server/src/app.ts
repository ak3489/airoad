import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { config } from './config';
import { HttpError } from './lib/http';
import { apiRoutes } from './routes';

export async function createApp(options: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...options });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || origin === config.webOrigin) return callback(null, true);
      return callback(new Error('Origin not allowed'), false);
    },
    credentials: false,
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
