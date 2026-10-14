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
    // Without this, initdb on Windows inherits the system code page (e.g. WIN1252), which
    // cannot store names like "Babić". Locale C keeps sorting byte-stable across platforms.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
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

const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

/** Return dates/timestamps as raw strings so copied rows round-trip exactly (no TZ shifts). */
const rawDates = {
  getTypeParser: (oid, format) =>
    [1082, 1114, 1184].includes(oid) ? (v) => v : pg.types.getTypeParser(oid, format),
};

function adminClient(url) {
  const { host, port, user, password } = parseDbUrl(url);
  return new pg.Client({ host, port, user, password, database: 'postgres' });
}

async function createUtf8Database(client, database) {
  await client.query(
    `CREATE DATABASE ${quoteIdent(database)} ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
}

async function terminateConnections(client, database) {
  await client.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [database],
  );
}

/**
 * Create the database named in `url` (UTF-8) if it doesn't exist yet. Databases created by
 * older versions with a non-UTF-8 encoding are either recreated (`recreateIfNotUtf8`, for
 * disposable test databases) or converted, keeping all data and a backup of the original.
 */
export async function ensureDatabase(url, { recreateIfNotUtf8 = false } = {}) {
  const { database } = parseDbUrl(url);
  const client = adminClient(url);
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = $1',
      [database],
    );
    const encoding = rows[0]?.encoding;
    if (!encoding) {
      await createUtf8Database(client, database);
      log(`Created database ${database}`);
    } else if (encoding !== 'UTF8') {
      if (recreateIfNotUtf8) {
        await terminateConnections(client, database);
        await client.query(`DROP DATABASE ${quoteIdent(database)}`);
        await createUtf8Database(client, database);
        log(`Recreated ${database} as UTF-8 (was ${encoding})`);
      } else {
        await convertToUtf8(client, url, encoding);
      }
    }
  } finally {
    await client.end();
  }
}

/** Copy a non-UTF-8 database into a new UTF-8 one, then swap them (original kept as backup). */
async function convertToUtf8(admin, url, encoding) {
  const parts = parseDbUrl(url);
  const tmpName = `${parts.database}__utf8_tmp`;
  const tmpUrl = Object.assign(new URL(url), { pathname: `/${tmpName}` }).toString();
  log(`Converting ${parts.database} from ${encoding} to UTF-8 (your data is kept)...`);

  await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(tmpName)}`);
  await createUtf8Database(admin, tmpName);
  await migrateDeploy(tmpUrl);

  const source = new pg.Client({ ...parts, types: rawDates });
  const target = new pg.Client({ ...parts, database: tmpName, types: rawDates });
  await source.connect();
  await target.connect();
  try {
    const { rows: tables } = await source.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`,
    );
    // Parents before children so foreign keys are satisfied.
    const order = ['User', 'Session', 'SaveGame'];
    const names = tables
      .map((t) => t.table_name)
      .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    await target.query('BEGIN');
    for (const table of names) {
      const { rows } = await source.query(`SELECT * FROM ${quoteIdent(table)}`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        await target.query(
          `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(', ')}) VALUES (${placeholders})`,
          cols.map((c) => row[c]),
        );
      }
      if (rows.length) log(`  copied ${rows.length} row(s) from ${table}`);
    }
    await target.query('COMMIT');
  } catch (err) {
    await target.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await source.end();
    await target.end();
  }

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
  const backup = `${parts.database}_${encoding.toLowerCase()}_backup_${stamp}`;
  await terminateConnections(admin, parts.database);
  await admin.query(`ALTER DATABASE ${quoteIdent(parts.database)} RENAME TO ${quoteIdent(backup)}`);
  await admin.query(
    `ALTER DATABASE ${quoteIdent(tmpName)} RENAME TO ${quoteIdent(parts.database)}`,
  );
  log(`Converted. Original kept as database "${backup}" (safe to drop once you're happy).`);
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
