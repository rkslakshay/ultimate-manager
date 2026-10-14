import type { HealthResponse } from '@um/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db';
import { API_VERSION } from '../version';

export async function healthRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/', async (request, reply) => {
    let database: HealthResponse['checks']['database'] = 'ok';
    try {
      await db.$queryRaw`SELECT 1`;
    } catch (err) {
      request.log.warn({ err }, 'Health check: database unreachable');
      database = 'error';
    }
    const response: HealthResponse = {
      status: database === 'ok' ? 'ok' : 'degraded',
      version: API_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
    return reply.status(database === 'ok' ? 200 : 503).send(response);
  });
}
