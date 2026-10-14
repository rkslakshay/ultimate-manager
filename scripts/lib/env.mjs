// Loads the repo-root .env (creating it from .env.example on first run).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(path.join(ROOT, '.env.example'), envPath);
    console.log('[env] Created .env from .env.example');
  }
  loadDotenv({ path: envPath, quiet: true });
  return process.env;
}
