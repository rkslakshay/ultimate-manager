import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The single .env file lives at the repo root. Existing env vars (e.g. set by scripts/dev.mjs or
// CI) take precedence.
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` doesn't need a database, so don't fail when the URL is absent.
    url: process.env.DATABASE_URL ?? 'postgresql://invalid:invalid@localhost:5433/invalid',
  },
});
