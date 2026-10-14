# Progress

_Last updated: 2026-10-14_

Plan for all phases: [docs/ROADMAP.md](docs/ROADMAP.md). Reasoning: [DECISIONS.md](DECISIONS.md).

| Phase            | Status         |
| ---------------- | -------------- |
| 0 — Foundation   | ✅ complete    |
| 1 — Data & world | ✅ complete    |
| 2 — Match engine | 🔨 in progress |
| 3 — Season loop  | ⏳ next        |
| 4–9              | not started    |

---

## Phase 1 — Data & world ✅

### Done

- **Engine — player model:** 47 attributes (technical, mental, physical, goalkeeping) + 11 hidden,
  14 positions with familiarity, Current/Potential Ability (CA derived from attributes through
  per-position weights), 1-20 position ratings, star ratings, 18 traits, market value and wage
  models. Pure civil-date arithmetic (the engine may not use `Date`).
- **Engine — world generator:** `generateWorld(seed)` builds 9 fictional nations (3 playable
  with two divisions: 20/20, 18/20, 16/18 → 112 clubs), national cups, stadiums, finances,
  facilities, squads of 24-28 by tier (key/starter/rotation/backup/prospect), contracts, and
  ~3,200 players including free agents — in ~60 ms. Name pools for 8 naming styles: common first
  names plus generated surnames, towns and club names (no real people, clubs or crests).
- **Database:** world tables per save keyed by `(saveId, id)`, cascade delete, search indexes.
  Worlds are generated and stored when a save is created (~250 ms insert via
  `jsonb_to_recordset`) and round-trip exactly (`WorldState` → DB → `WorldState`).
- **API:** world overview, competitions, clubs, club detail with squad, player detail, paginated
  player search (name, position, nation, club, age, ability, value, free agents, expiring
  contracts; sortable), choose-club, database editor (edit clubs/players with CA and value
  recomputed by the engine; JSON/CSV export and import with per-row errors), world generation
  for saves made before worlds existed.
- **Web:** choose-your-club, club page, squad, player profile (attribute colour ramp, positions
  pitch map, position ratings, contract, traits), league browser, player search (server-side
  filtering/sorting/paging), database editor (club and player dialogs, import/export), real club
  badge in the top bar.
- **Fixed along the way:** embedded Postgres on Windows created WIN1252 databases (could not
  store "ć"). New clusters/databases are UTF-8; the existing dev database was converted in place
  with every row kept (verified identical) and the original kept as a backup database.

### Verification

| Check                  | Result                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| typecheck / lint / fmt | ✅                                                                                                |
| `npm test`             | ✅ engine 32, shared 9, api 32 (real Postgres), web 3                                             |
| `npm run test:e2e`     | ✅ 6 Playwright tests incl. choose club → club → squad → player → league → search → editor rename |
| Manual                 | ✅ legacy save opened → world generated → redirected to choose-club                               |

### Known issues / simplifications

- **Abilities are visible** as stars (and exact CA/PA in the editor). Scouting knowledge that
  masks attributes arrives in Phase 6 (`TODO(phase-6)`).
- Stars are absolute (CA/40), not relative to the viewer's squad as in FM.
- Player search filters on **primary** position only (not every position a player can play).
- Import edits existing clubs/players only; it can't add new leagues, clubs or players yet.
- League tables show zeros in predicted order until fixtures exist (Phase 3).
- Squad lists use client-side tables (≤ 30 rows); the 3,000+ player search uses server
  pagination instead of a virtualised list.
- Staff are not generated yet (Phase 5).
- Club codes can repeat between clubs (e.g. two "VAL"); they're display-only.

---

## Phase 0 — Foundation ✅

Monorepo (npm workspaces, strict TS 6), ESLint/Prettier/Husky/CI, embedded Postgres + Prisma 7,
one-command `npm run dev`, Fastify API with cookie-JWT auth and revocable sessions, save games
CRUD, seeded RNG, dark FM-style design system and app shell, Playwright E2E. Verified on a
clean clone and in GitHub Actions.

---

## Standing known issues

- Docker Compose is untested locally (no Docker on the dev machine); CI uses the same image.
- Embedded Postgres was only exercised on Windows; macOS/Linux rely on its (allow-listed)
  install script — use Docker with `DB_MODE=external` if it fails.
- First visit logs one expected `401` from `/api/auth/me` (signed-out check).
- `Continue` only shows a toast — `TODO(phase-3)` in `GameLayout.tsx`.
- Web bundle is one ~750 kB chunk (~220 kB gzip); route-level code splitting in Phase 4/9.
- `npm audit`: 4 "high" advisories inside the `prisma` **CLI** devDependency only.
  **Do not run `npm audit fix --force`** — it downgrades the CLI to 6.x and `npm run dev` fails
  with P1012 (the dev scripts detect the mismatch and explain the fix).
- On Windows, hard-killing the `npm run dev` parent can orphan API/Vite children; Ctrl+C is clean.
- No password reset / email verification.
