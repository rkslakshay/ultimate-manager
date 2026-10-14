# Ultimate Manager — Road to Glory

A deep, text-and-data-driven football management simulation for the browser, inspired by
Football Manager. All clubs, players and competitions are fictional.

> **Status:** Phase 0 (foundation) complete. See [PROGRESS.md](PROGRESS.md) for what works today
> and [DECISIONS.md](DECISIONS.md) for the reasoning behind technical choices.

## Quick start

Requirements: **Node.js ≥ 22.12** (24 recommended, see `.nvmrc`) and npm ≥ 10. **No Docker or
PostgreSQL install is needed** — `npm run dev` starts an embedded PostgreSQL for you.

```bash
git clone <repo-url> ultimate-manager
cd ultimate-manager
npm install
npm run dev
```

Then open <http://localhost:5173>, create an account, and start a career.

On first run `npm run dev` will:

1. create `.env` from `.env.example`,
2. initialise and start an embedded PostgreSQL 18 on port **5433** (data in `./.data/postgres`),
3. apply database migrations and generate the Prisma client,
4. start the API on <http://127.0.0.1:4000> and the web app on <http://localhost:5173>
   (Vite proxies `/api` to the API, so the browser only talks to one origin).

Press `Ctrl+C` once to stop everything, including the database.

### Using Docker / your own PostgreSQL instead

```bash
docker compose up -d          # PostgreSQL 18 on localhost:5433 (user/pass/db: um/um/ultimate_manager)
```

Then set `DB_MODE=external` in `.env` and run `npm run dev` as usual. Any PostgreSQL ≥ 14 works;
point `DATABASE_URL` / `DATABASE_URL_TEST` at it.

## Commands

| Command                  | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`            | Start database (embedded), API and web app with live reload          |
| `npm test`               | Unit + integration tests for every workspace (Vitest)                |
| `npm run test:e2e`       | Playwright end-to-end tests (starts the dev stack if not running)    |
| `npm run lint`           | ESLint (zero warnings allowed)                                       |
| `npm run typecheck`      | `tsc --noEmit` in every workspace                                    |
| `npm run format`         | Prettier write (`format:check` to verify)                            |
| `npm run db:start`       | Start only the embedded database and apply migrations                |
| `npm run db:migrate:dev` | Create a new migration after editing `apps/api/prisma/schema.prisma` |
| `npm run db:reset`       | Drop and re-create the dev database (destroys local data)            |

First-time E2E setup: `npx playwright install chromium`.

API integration tests run against a separate database (`DATABASE_URL_TEST`, created and
migrated automatically). If nothing is listening on the database port they start the embedded
server themselves.

## Repository layout

```
apps/
  web/        React 19 + Vite + Tailwind v4 front end (shadcn-style components on Radix)
  api/        Fastify 5 REST API, Prisma 7 + PostgreSQL, Zod validation
packages/
  engine/     Pure, deterministic simulation engine (seeded RNG; no web/DB dependencies)
  shared/     Zod schemas and types shared by web and api
scripts/      Dev orchestration (embedded Postgres, migrations, process runner)
e2e/          Playwright tests
docs/         Design system and other documentation
```

Workspace packages export their TypeScript source directly (no build step in development).

## Configuration

All configuration lives in the single repo-root `.env` (see [`.env.example`](.env.example) for
every variable and its meaning). The API validates its environment on startup and refuses to
run in production with the development `JWT_SECRET`.

## API overview (Phase 0)

All endpoints are under `/api`. Errors always have the shape
`{ "error": { "code": "...", "message": "...", "fieldErrors"?: {...} } }`.

| Method | Path              | Description                                |
| ------ | ----------------- | ------------------------------------------ |
| GET    | `/health`         | Liveness + database check (503 if DB down) |
| POST   | `/auth/register`  | Create account, start session (201)        |
| POST   | `/auth/login`     | Start session                              |
| POST   | `/auth/logout`    | Revoke session, clear cookie (204)         |
| GET    | `/auth/me`        | Current user (401 if signed out)           |
| GET    | `/saves`          | List your save games (most recent first)   |
| POST   | `/saves`          | Create a save (max 10 per user)            |
| GET    | `/saves/:id`      | Get one of your saves                      |
| POST   | `/saves/:id/load` | Mark a save as played                      |
| PATCH  | `/saves/:id`      | Rename                                     |
| DELETE | `/saves/:id`      | Delete (204)                               |

Sessions are JWTs in an `httpOnly`, `SameSite=Lax` cookie, each backed by a `Session` row so
logout really revokes them.

## Keyboard shortcuts (in game)

`Space` Continue · `g` then a letter jumps to a section (shown on hover in the sidebar) · `?`
shortcut list · `[` collapse the sidebar.

## Troubleshooting

- **Port 5433 / 4000 / 5173 in use** — change `DATABASE_URL`, `API_PORT` or `WEB_PORT` in `.env`.
- **Embedded database won't start after a crash** — stop any stray `postgres` processes, then
  delete `.data/postgres/postmaster.pid`. To start completely fresh, delete `.data/`.
- **macOS/Linux: embedded Postgres fails with missing libraries** — make sure install scripts
  ran (`npm rebuild @embedded-postgres/<platform>`), or use Docker with `DB_MODE=external`.
- **Prisma error P1012 "The datasource property `url` is no longer supported" / "url argument is
  missing"** — the Prisma CLI and `@prisma/client` are on different major versions (usually after
  `npm audit fix --force`, which downgrades the CLI to 6.x). This project uses Prisma 7, where the
  URL lives in `apps/api/prisma.config.ts`, not in `schema.prisma`. Restore the versions with
  `git checkout -- apps/api/package.json package-lock.json` and run `npm install`.
  `npm run dev` now detects the mismatch and prints this advice.
- **`npm install` warns about install scripts** — the project allow-lists the few packages that
  need them in `package.json#allowScripts` (Prisma engines, embedded Postgres, esbuild).
