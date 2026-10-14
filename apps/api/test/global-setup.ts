import type { TestProject } from 'vitest/node';
import { ensureDatabase, ensurePostgres, migrateDeploy } from '../../../scripts/lib/db.mjs';
import { loadEnv } from '../../../scripts/lib/env.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Prepares a dedicated, migrated test database (DATABASE_URL_TEST) before any API test runs.
 * Starts the embedded PostgreSQL if needed and stops it again afterwards.
 */
export default async function setup(project: TestProject) {
  const env = loadEnv();
  const url = env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is not set (see .env.example)');
  if (env.DATABASE_URL && url === env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL: tests write test data');
  }
  const stop = await ensurePostgres(url, env.DB_MODE);
  await ensureDatabase(url, { recreateIfNotUtf8: true });
  await migrateDeploy(url);
  project.provide('databaseUrl', url);
  return async () => {
    if (stop) await stop();
  };
}
