import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { inject } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb, type Db } from '../src/db';
import { SESSION_COOKIE } from '../src/plugins/auth';

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    BCRYPT_ROUNDS: '4',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_AUTH_MAX: '1000',
    ...overrides,
  });
  const db = createDb(config.DATABASE_URL);
  const app = await buildApp({ config, db });
  await app.ready();
  return {
    app,
    db,
    async close() {
      await app.close();
      await db.$disconnect();
    },
  };
}

/** Unique email so parallel test files never collide in the shared test database. */
export const uniqueEmail = () => `test-${randomUUID()}@example.com`;

export function sessionCookieFrom(res: LightMyRequestResponse): string | undefined {
  return res.cookies.find((c) => c.name === SESSION_COOKIE)?.value;
}

/** Register a fresh user and return their session cookie. */
export async function registerUser(app: FastifyInstance, email = uniqueEmail()) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'secret123', displayName: 'Test Manager' },
  });
  const token = sessionCookieFrom(res);
  if (res.statusCode !== 201 || !token) {
    throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  }
  return { email, token, cookies: { [SESSION_COOKIE]: token }, user: res.json().user };
}
