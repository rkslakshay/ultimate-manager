// Database helpers shared by `npm run dev`, `npm run db:start` and the API test setup.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';
import { ROOT } from './env.mjs';

const log = (msg) => console.log(`[db] ${msg}`);

/** Parse a postgres URL into its parts. */
export function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function isPortOpen(host, port, timeoutMs = 750) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * Make sure a PostgreSQL server is reachable at `url`.
 * In embedded mode, starts one (data in ./.data/postgres) unless something already listens.
 * Returns an async `stop()` for servers this process started, otherwise null.
 */
export async function ensurePostgres(url, mode = process.env.DB_MODE ?? 'embedded') {
  const { host, port, user, password } = parseDbUrl(url);
  if (await isPortOpen(host, port)) {
    log(`PostgreSQL already listening on ${host}:${port}`);
    return null;
  }
  if (mode !== 'embedded') {
    throw new Error(
      `No PostgreSQL reachable at ${host}:${port} (DB_MODE=${mode}). ` +
        'Start it with `docker compose up -d` or set DB_MODE=embedded in .env.',
    );
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Embedded PostgreSQL only runs on localhost, but DATABASE_URL host is ${host}`);
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = path.join(ROOT, '.data', 'postgres');
  const isNew = !fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
  const server = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
    onLog: () => {},
    onError: (msg) => {
      const text = String(msg).trim();
      if (/ERROR|FATAL|PANIC/.test(text)) console.error(`[postgres] ${text}`);
    },
  });
  if (isNew) {
    log(`Initialising embedded PostgreSQL in ${path.relative(ROOT, databaseDir)} (first run)...`);
    await server.initialise();
  }
  log(`Starting embedded PostgreSQL on port ${port}...`);
  await server.start();
  log('Embedded PostgreSQL is ready');
  let stopped = false;
  return async () => {
    if (stopped) return;
    stopped = true;
    log('Stopping embedded PostgreSQL...');
    await server.stop();
  };
}

/** Create the database named in `url` if it doesn't exist yet. */
export async function ensureDatabase(url) {
  const { host, port, user, password, database } = parseDbUrl(url);
  const client = new pg.Client({ host, port, user, password, database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (!rowCount) {
      // Identifier can't be parameterised; quote it safely.
      await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      log(`Created database ${database}`);
    }
  } finally {
    await client.end();
  }
}

/** Apply pending Prisma migrations to the database at `url`. */
export function migrateDeploy(url) {
  return runPrisma(['migrate', 'deploy'], url);
}

/**
 * The Prisma CLI and client must share a major version: Prisma 7 reads the datasource URL from
 * prisma.config.ts, while a Prisma 6 CLI expects it in schema.prisma and fails with P1012.
 * (`npm audit fix --force` currently downgrades the CLI to 6.x, which causes exactly that.)
 */
export function assertPrismaVersionsMatch(require) {
  const version = (pkg) =>
    JSON.parse(fs.readFileSync(require.resolve(`${pkg}/package.json`), 'utf8')).version;
  const cli = version('prisma');
  const client = version('@prisma/client');
  if (cli.split('.')[0] !== client.split('.')[0]) {
    throw new Error(
      `Prisma version mismatch: prisma CLI ${cli} vs @prisma/client ${client}.\n` +
        'They must share a major version (this project uses Prisma 7). Restore the versions in\n' +
        'apps/api/package.json (git checkout -- apps/api/package.json package-lock.json) and run\n' +
        '`npm install`. Avoid `npm audit fix --force`, which downgrades the Prisma CLI.',
    );
  }
}

export function runPrisma(args, url) {
  return new Promise((resolve, reject) => {
    const apiDir = path.join(ROOT, 'apps', 'api');
    const require = createRequire(path.join(apiDir, 'package.json'));
    assertPrismaVersionsMatch(require);
    const prismaCli = path.join(
      path.dirname(require.resolve('prisma/package.json')),
      'build',
      'index.js',
    );
    const child = spawn(process.execPath, [prismaCli, ...args], {
      cwd: apiDir,
      env: { ...process.env, DATABASE_URL: url },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`prisma ${args.join(' ')} failed (exit ${code}):\n${output}`));
    });
  });
}
