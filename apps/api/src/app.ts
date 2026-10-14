import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config';
import type { Db } from './db';
import { registerErrorHandling } from './lib/errors';
import authPlugin from './plugins/auth';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { saveRoutes } from './routes/saves';

export interface BuildAppOptions {
  config: AppConfig;
  db: Db;
}

export async function buildApp({ config, db }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'development'
        ? {
            level: config.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname,reqId,req.remoteAddress,req.remotePort,req.host',
                singleLine: true,
              },
            },
          }
        : { level: config.LOG_LEVEL },
    bodyLimit: 1024 * 1024,
    // Behind the Vite dev proxy / a reverse proxy in production.
    trustProxy: true,
  });

  registerErrorHandling(app);
  await app.register(helmet, { contentSecurityPolicy: false });
  // Opt-in per route (auth endpoints set their own limits).
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin, { config, db });

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { prefix: '/health', db });
      await api.register(authRoutes, { prefix: '/auth', config, db });
      await api.register(saveRoutes, { prefix: '/saves', db });
    },
    { prefix: '/api' },
  );

  return app;
}
