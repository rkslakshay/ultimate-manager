# Progress

_Last updated: 2026-10-15_

Plan for all phases: [docs/ROADMAP.md](docs/ROADMAP.md). Reasoning: [DECISIONS.md](DECISIONS.md).

| Phase                       | Status                                        |
| --------------------------- | --------------------------------------------- |
| 0 — Foundation              | ✅ complete                                   |
| 1 — Data & world            | ✅ complete                                   |
| 1.5 — Real-world data packs | ✅ complete (awaiting your dataset files)     |
| 2 — Match engine            | ⏸ paused (groundwork committed), resumes next |
| 3 — Season loop             | ⏳ next                                       |
| 4–9                         | not started                                   |

---

## Phase 1.5 — Real-world data packs ✅

### Real pack (local, from the user's files)

The user's datasets are in `data-packs/raw/` (gitignored). `npm run data:import -- --pack real`
builds 35 leagues, 613 clubs, 13,819 imported + 939 generated players (start 2025-07-01) in ~8 s,
and the pack appears in the New career dialog. First debugging pass (2026-10-15):

- Fixed: women's players, coaches/teams and match-log tables were picked up as ratings or
  Transfermarkt tables. Detection now goes by file name and skips unused files without
  reading them. Only the newest game version's rows are used, and hashing is streamed.
- Fixed: famous players with long legal names didn't match (new name-token level).
- Fixed: clubs came from the 2023 ratings file while the start date is 2025. They now come
  from the newer source, guarded by `last_season` (D-031). Club matching checks
  names/slugs first and no longer pairs the wrong clubs (Derry City ↔ Dundee FC). Squads that
  had grown to 70+ are now 20-33.

### Done

- **Data packs:** `fictional` (generator, default) plus imported packs; versioned by content
  hash; saves record pack + version and keep their own world copy; pack history (transfers,
  valuations) stored once per version in shared immutable tables. Re-import never changes an
  ongoing career (tested).
- **Importer** (`@um/data-import`): `data:inspect` inventory; `data:import` with dry run;
  streaming CSV with encoding detection; column alias tables; conservative identity matching
  (unique exact keys, ambiguity and fuzzy candidates reported, approve/reject overrides,
  persistent identity map); documented attribute mapping with S/F/D provenance; seeded
  hidden attributes; CA calibrated to the source overall; contracts, wages, release clauses,
  values, valuation history and transfers (unknown fees stay unknown); derived club finances,
  reputation and colours; generated squad fillers and free agents; fitted value model;
  validation; Markdown + JSON quality report; version diff on re-import.
- **Engine:** world schema v2 (origins, provenance, shirt numbers, crests, name pools),
  fitted value model, **progression** (`applyProgression`), retirements, youth intakes and a
  headless multi-season development simulator with stability checks.
- **API:** pack listing, saves from packs, player history, crest serving, attribute
  development history, editor create endpoints, import creates rows without an id.
- **Web:** pack choice in the new-career dialog, real/generated/custom badges, provenance
  tags and dotted derived attributes, source-data panel, market value chart, historical
  transfers, development section, user crests, add club/player dialogs.
- **Docs:** `docs/DATA_SOURCES.md`, `DATA_MAPPING.md`, `DATA_QUALITY.md`,
  `data-packs/README.md`, README legal notice, DECISIONS D-020…D-030.

### Verification

| Check                                    | Result                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| typecheck / lint / format                | ✅                                                                                                                   |
| `npm test`                               | ✅ 140 (engine 44, shared 9, data-import 38, api 46, web 3)                                                          |
| `npm run test:e2e`                       | ✅ 8 (incl. new save from a pack → club → squad → player with provenance and transfer history; editor adds a player) |
| Sample import                            | ✅ 337 imported + 116 generated players, 197 transfers, 941 valuations, deterministic version                        |
| Scale benchmark (fictional, 18k players) | import 2.1 s · first save 4.8 s · later saves 3.4 s                                                                  |
| 20-season development sim                | ✅ 9/9 stability checks on the fictional world (3.4k players, 4 s) and the sample pack                               |

### Known issues / simplifications

- Real pack: league membership still follows the 2023 ratings file (promotions/relegations
  since then are missing); nationality spellings differ between sources (reported only);
  239 clubs, mostly outside Europe, have no Transfermarkt-style match, so their players keep
  2023 clubs and contracts. A newer ratings file would remove most of this.
- 20-season development sim: 9/9 checks pass for fictional, sample and real packs (D-032).
  Regen potential is now a share of the headroom to the world's starting PA ceiling. Real-pack
  elites go 16 → 31 (were 15 → 168), mean CA drifts about +7 % (allowed ±10 %), and fictional
  elites settle 83 → 54. TODO(phase-3): the season loop must store the save's PA ceiling at
  creation and pass it to `youthIntake`; recalibrate once real minutes replace synthetic ones.
- Progression isn't driven by game time yet: the season loop (Phase 3) will call it. Until
  then the development simulator uses synthetic playing time and the profile's Development
  section is empty.
- Burn-in: worlds settle in their first 4 simulated seasons (fictional mean CA 102 → 96,
  then stable at ~95).
- First save from a full-size pack takes ~4.8 s (mostly inserting 18k players); `COPY` would
  speed it up if needed.
- Promotion/relegation counts, league countries and tiers fall back to labelled defaults when
  neither the data nor the config provides them. National cups are simulated.
- Matching uses birth dates: ratings rows without one can't be matched to Transfermarkt-style
  records.
- Continental competitions aren't modelled yet (no data path).

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
