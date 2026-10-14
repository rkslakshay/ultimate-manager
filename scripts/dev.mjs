#!/usr/bin/env node
// `npm run dev`: one command that starts everything.
//   1. load .env (created from .env.example on first run)
//   2. ensure PostgreSQL is up (embedded server, or your own when DB_MODE=external)
//   3. apply migrations and generate the Prisma client
//   4. run the API (tsx watch) and the web app (Vite) with prefixed output
import { spawn } from 'node:child_process';
import { ensureDatabase, ensurePostgres, migrateDeploy, runPrisma } from './lib/db.mjs';
import { loadEnv } from './lib/env.mjs';

const env = loadEnv();
const COLORS = { api: '\x1b[36m', web: '\x1b[35m' };
const RESET = '\x1b[0m';
const children = [];
let stopDb = null;
let shuttingDown = false;

function run(name, workspace) {
  // Run npm through node directly (no shell) when launched via `npm run dev`.
  const npmCli = process.env.npm_execpath;
  const args = ['run', 'dev', '--workspace', workspace];
  const child = npmCli
    ? spawn(process.execPath, [npmCli, ...args], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    : spawn(`npm ${args.join(' ')}`, {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });
  const prefix = `${COLORS[name] ?? ''}[${name}]${RESET} `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`${prefix}exited with code ${code}; shutting down`);
      void shutdown(code ?? 1);
    }
  });
  children.push(child);
}

function killTree(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(killTree);
  if (stopDb) {
    try {
      await stopDb();
    } catch (err) {
      console.error('[db] Failed to stop cleanly:', err.message);
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

try {
  stopDb = await ensurePostgres(env.DATABASE_URL, env.DB_MODE);
  await ensureDatabase(env.DATABASE_URL);
  console.log('[db] Applying migrations...');
  await migrateDeploy(env.DATABASE_URL);
  await runPrisma(['generate'], env.DATABASE_URL);
  console.log('[db] Database ready');
} catch (err) {
  console.error(`\n[dev] Database setup failed:\n${err.message}\n`);
  await shutdown(1);
}

run('api', '@um/api');
run('web', '@um/web');
console.log(`\n  Web: http://localhost:${env.WEB_PORT ?? 5173}`);
console.log(`  API: http://${env.API_HOST ?? '127.0.0.1'}:${env.API_PORT ?? 4000}/api/health\n`);
