#!/usr/bin/env node
// `npm run db:start`: start the embedded PostgreSQL in the foreground (Ctrl+C to stop) and apply
// migrations. Useful for running API tests or Prisma commands without the full dev stack.
import { ensureDatabase, ensurePostgres, migrateDeploy } from './lib/db.mjs';
import { loadEnv } from './lib/env.mjs';

const env = loadEnv();
const stop = await ensurePostgres(env.DATABASE_URL, env.DB_MODE);
await ensureDatabase(env.DATABASE_URL);
await migrateDeploy(env.DATABASE_URL);
console.log('[db] Ready. Migrations applied.');

if (stop) {
  console.log('[db] Press Ctrl+C to stop.');
  const shutdown = async () => {
    await stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  setInterval(() => {}, 1 << 30);
}
