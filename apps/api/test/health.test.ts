import { healthResponseSchema } from '@um/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = healthResponseSchema.parse(res.json());
    expect(body).toMatchObject({ status: 'ok', checks: { database: 'ok' } });
  });

  it('reports degraded (503) when the database is unreachable', async () => {
    const broken = await createTestApp({
      DATABASE_URL: 'postgresql://nobody:nothing@127.0.0.1:1/none',
    });
    try {
      const res = await broken.app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ status: 'degraded', checks: { database: 'error' } });
    } finally {
      await broken.close();
    }
  });

  it('returns a consistent 404 body for unknown routes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('config', () => {
  it('refuses the development JWT secret in production', async () => {
    const { loadConfig } = await import('../src/config');
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: 'dev-only-change-me-please-0123456789abcdef',
      }),
    ).toThrow(/JWT_SECRET/);
  });
});
