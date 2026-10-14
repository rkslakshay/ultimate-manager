# Progress

_Last updated: 2026-10-14_

## Current phase: Phase 0 — Foundation ✅ complete

### Done

- **Monorepo** (npm workspaces): `apps/web`, `apps/api`, `packages/engine`, `packages/shared`;
  strict TypeScript 6 everywhere (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Tooling**: ESLint 9 flat config (typescript-eslint, react-hooks, engine purity rules),
  Prettier, Husky pre-commit (lint-staged + full typecheck), GitHub Actions CI (format, lint,
  typecheck, unit/integration tests against a Postgres service, web build, Playwright E2E).
- **Database**: PostgreSQL via Prisma 7 (`pg` adapter). Migration `init`: `User`, `Session`,
  `SaveGame`. Embedded PostgreSQL for zero-install local dev; `docker-compose.yml` alternative.
- **One-command dev**: `npm run dev` → `.env` bootstrap, DB start, migrate, generate, API + web.
- **API** (Fastify 5): `/api/health` (DB check, 503 when down), auth (register / login / logout /
  me) with bcrypt, JWT httpOnly cookie + revocable DB sessions, per-IP rate limit on auth routes,
  save games CRUD (+ load, max 10 per user, ownership enforced as 404), consistent error bodies,
  helmet, env validation (rejects dev JWT secret in production).
- **Shared**: Zod schemas for auth, saves, errors, pagination, health; navigation sections.
- **Engine**: seeded RNG (SFC32), string/number seeds, int/float/chance/normal/weighted/pick/
  shuffle, forkable sub-streams, exact state save/restore, pinned reference sequence.
- **Web**: dark FM-style design system (tokens, WCAG-AA-checked colours), components (Button,
  Card, DataTable, Tabs, Dialog, DropdownMenu, Input/FormField, Badge/Kbd, Skeleton), auth
  pages with client + server validation, saves screen (create / load / optimistic rename +
  delete), game shell (collapsible sidebar with 11 sections, top bar with club, date, Continue),
  routed placeholder pages labelled with their delivery phase, keyboard shortcuts
  (`Space`, `g`+key, `?`, `[`), UI kit page, 404 page, session-expiry handling.
- **Docs**: README (setup, commands, API, troubleshooting), DECISIONS, design system.

### Verification (run on Windows 11, Node 24.19)

| Check                  | Result                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | ✅ all 4 workspaces                                                                                  |
| `npm run lint`         | ✅ 0 errors, 0 warnings                                                                              |
| `npm run format:check` | ✅                                                                                                   |
| `npm test`             | ✅ engine 17, shared 6, api 20 (real Postgres), web 3                                                |
| `npm run test:e2e`     | ✅ 4 Playwright tests (register, validation, full save flow + shell nav + shortcuts, wrong password) |
| Manual (browser)       | ✅ register, create save, sidebar + keyboard nav, Continue toast, UI kit                             |
| Clean clone            | ✅ fresh `git clone` → `npm ci` → `npm run dev` (new .env + DB) → health OK, all tests + E2E pass    |

### Known issues / limitations

- CI workflow is written but **has not run yet** (no GitHub remote configured).
- Docker Compose file is untested locally (Docker not installed on the dev machine); CI uses the
  same image via a service container.
- Embedded PostgreSQL was only exercised on Windows. macOS/Linux depend on its install script
  (allow-listed) — fall back to Docker if it fails.
- The first visit logs one expected `401` from `/api/auth/me` in the browser console (signed-out
  check).
- Placeholder screens: every game section except the shell itself — each states its phase.
- `Continue` shows a toast only — `TODO(phase-3)` in `GameLayout.tsx`.
- Club info in the top bar is "No club" until the world exists — `TODO(phase-1)` in `TopBar.tsx`.
- DataTable paginates client-side; virtualisation for thousands of rows is planned for Phase 1
  (player database screens).
- Web bundle is a single 747 kB chunk (219 kB gzip); route-level code splitting planned once
  real screens exist (Phase 4/9).
- `npm audit`: 4 "high" advisories, all inside the `prisma` **CLI** devDependency
  (`deepmerge-ts` in its config loader, bundled `mysql2`); not used at runtime. npm's only fix
  is downgrading to Prisma 6 — revisit when Prisma ships updated deps.
- On Windows, hard-killing the `npm run dev` parent (Task Manager / tool kill) can orphan the
  API/Vite children; normal Ctrl+C in a terminal shuts everything down cleanly.
- No password reset / email verification (no mail service); not in the Phase 0 scope.

## Next: Phase 1 — Data & world

See the plan at the bottom of the Phase 0 summary in the conversation / below.

1. Prisma schema for the world, scoped per save game: `Nation`, `League` (+ divisions),
   `Club`, `Stadium`, `Player` (attributes, hidden attributes, CA/PA, positions, traits, contract),
   `Staff` (stub). Indexes for player search and club lookups.
2. Engine: name pools per fictional nation, world generator (≥3 countries × 2 divisions,
   16–20 clubs, ~3,000+ players) driven by the save seed; ability/age/position distributions;
   CA/PA model and position role ratings; star ratings; wages/values/contracts.
3. Persist a generated world when a save is created (bulk insert), "choose your club" step.
4. Browsing screens: league tables (pre-season zeros), club pages, player profiles,
   virtualised player search; database editor + JSON/CSV import (basic).
5. Tests: generator determinism and distribution checks; API integration tests.
