# Roadmap — Phases 1 to 9

How the rest of _Ultimate Manager — Road to Glory_ gets built. `CLAUDE.md` says **what** to
build; this document says **how**, in what order, and how each phase is proven done.
Status lives in [PROGRESS.md](../PROGRESS.md); the reasoning behind choices in
[DECISIONS.md](../DECISIONS.md).

---

## 1. Guiding architecture

These decisions shape every phase, so they're settled up front.

### 1.1 The world is engine state; the database persists and queries it

```
            ┌──────────────── packages/engine (pure, deterministic) ────────────────┐
            │  WorldState ──advance(days, inputs, rng)──▶ WorldState' + Events[]    │
            │  generators · calendar · match engine · AI · economy · development   │
            └──────────────────────────────────────────────────────────────────────┘
                     ▲ load (once per active save)          │ diff → batched writes
                     │                                       ▼
   apps/api ── SaveSession cache (LRU of active worlds) ── PostgreSQL (truth + queries)
                     ▲
   apps/web ── REST ─┘        live match: engine in a Web Worker, server re-simulates to verify
```

- **All game rules live in the engine** as functions over a plain, serialisable `WorldState`
  (clubs, players, staff, fixtures, finances…) plus a seeded `Rng`. No DB, no clocks, no I/O.
- **The API** loads a save's world into memory when it's opened (≈4k players → tens of ms),
  calls the engine to advance time, then **flushes only what changed** in one transaction
  (bulk `INSERT … ON CONFLICT` / `UPDATE … FROM (VALUES …)`), not row-by-row through Prisma.
- **PostgreSQL stays normalised** (it's the source of truth after every Continue) and serves
  all list/search screens with pagination and indexes.
- **Per-save scoping:** every world table carries `saveId` (FK, cascade delete) and is indexed
  on `(saveId, …)`. Deleting a save deletes its world.

Why: a full world season is ~2,000+ matches. Simulating in memory and writing results in bulk
is the only realistic way to hit the **< 30 s per season** target, and it keeps the engine
testable without a database.

### 1.2 Determinism as a feature

- One root seed per save. Every subsystem gets `rng.fork("<system>:<id>:<date>")`, so adding a
  feature never reshuffles unrelated randomness.
- A match is fully defined by `(engineVersion, matchSeed, teamSheets, tactics, inputLog)`.
  We **store that, not the event stream**: any match can be replayed exactly for reports,
  highlights and debugging. Only the user's matches keep a compact event log for fast replay.
- Golden tests pin the output of fixed seeds; changing them requires bumping `ENGINE_VERSION`.

### 1.3 Live matches run in the browser, the server stays authoritative

The engine runs in a Web Worker for the live view (smooth, no network round-trips). Every user
input (substitution, tactic change, shout) is recorded with its match tick. At full time the
client sends the input log; the server re-runs the same engine with the same seed and inputs,
stores _its_ result, and rejects mismatches. Closing the tab mid-match resumes from the input
log.

### 1.4 Scale targets used for budgeting

| Item                       | Target                                                     |
| -------------------------- | ---------------------------------------------------------- |
| Playable countries/leagues | 3 countries × 2 divisions (18–20 clubs) ≈ 114 clubs        |
| Players per save           | ≈ 3,500 at start (squads + free agents), growing via youth |
| Matches per world season   | ≈ 2,100 (league + cups)                                    |
| Quick-sim cost per match   | ≤ 5 ms average (worker pool across cores)                  |
| World season               | < 30 s on a laptop; 20 seasons headless < 15 min           |
| "Continue" (non-match day) | < 300 ms end to end                                        |
| Player search query        | < 100 ms p95 (paginated, indexed)                          |

---

## 2. How every phase runs

1. **Plan** — a short plan in the conversation (files, data model, risks); decisions logged in
   `DECISIONS.md`.
2. **Engine first** — rules and generators in `packages/engine` with unit tests; then API; then UI.
3. **Small commits, pushed immediately** to `github.com/rkslakshay/ultimate-manager`
   (conventional commits; Husky runs lint + typecheck on each).
4. **Verify for real** — typecheck, lint, all tests, run the app and click through the new
   flows; Playwright for each phase's key flow.
5. **Close out** — update `PROGRESS.md`, check CI is green on GitHub, then pause with a summary,
   commands and known limitations. The next phase starts only on your "continue".

### Testing layers (grow every phase)

| Layer           | Tool                      | Runs                                                    |
| --------------- | ------------------------- | ------------------------------------------------------- |
| Engine unit     | Vitest                    | every commit (CI)                                       |
| Statistical     | Vitest, seeded batches    | CI: 2k-match quick check; `npm run calibrate`: full 10k |
| Golden/replay   | pinned seeds → snapshots  | every commit                                            |
| API integration | Vitest + real Postgres    | every commit                                            |
| E2E             | Playwright                | every commit (key flows)                                |
| Long-run world  | headless 20-season sim    | nightly scheduled CI job                                |
| Performance     | `npm run bench:*` scripts | on demand + nightly trend                               |

---

## 3. Phases

Each phase lists **scope → engine → data → API → UI → proof of done**. Sizes are rough
relative effort (S/M/L/XL).

### Phase 1 — Data & world (L)

**Scope:** a generated, browsable, fictional football world created per save.

- **Engine**
  - `world/nations`: ~12 fictional nations (3 playable with leagues, the rest feed
    nationalities), each with a name-pool "language flavour" (syllable models + curated
    first/last-name lists, 500+ combinations each, blocklist against real famous names).
  - `players/model`: 1–20 attributes (technical, mental, physical, goalkeeping), hidden
    attributes, CA/PA (1–200), position familiarity per slot (GK…ST), preferred foot, height,
    traits, star rating (0.5–5 from CA/PA relative to league level).
  - `players/generate`: ability by club reputation tier, realistic age pyramid (16–38),
    positional mix per squad, attribute profiles consistent with position and CA, PA ≥ CA
    with age-based headroom, wonderkid tail.
  - `economy/value`: market value and wage from CA, PA, age, reputation, contract length.
  - `world/generate(seed)`: nations → leagues (2 tiers) → clubs (names from place-name
    generator, colours, stadium, reputation) → squads + free agents. Pure and deterministic.
- **Data:** `Nation`, `Competition` (league/cup, tier, rules), `Club`, `Stadium`, `Player`,
  `PlayerContract`, `Staff` (stub). Attributes stored as compact JSON/array columns (scale is
  small per save; searchable fields like position, age, CA, value get real indexed columns).
  Bulk insert of a whole world in one transaction.
- **API:** world creation on save creation (with progress), choose-club step, paginated
  endpoints for nations, competitions, clubs, players (search: name, position, age, nationality,
  ability, value, contract), player/club detail.
- **UI:** "choose your club" screen, league overview, club page (squad, stadium, reputation),
  player profile (attributes with the colour ramp, positions pitch map, contract, traits),
  virtualised player search (TanStack Virtual), **database editor** (rename clubs/players,
  edit attributes) and **JSON/CSV import/export** with Zod validation.
- **Done when:** same seed ⇒ identical world (test); distribution tests pass (age, CA, positions,
  wages in sane ranges); world of ≥3,000 players generated + saved in < 5 s; you can create a
  save, pick a club and browse every club/player.

### Phase 2 — Match engine (XL — the heart)

**v1 (headless, statistical):** possession-chain model. Each attacking phase picks events
(pass, dribble, cross, shot, foul, set piece) by weighted probabilities from player attributes,
team strength, tactics (stub), fatigue and home advantage. xG per shot from distance, angle,
body part, assist type and pressure. Outputs full stats and 1–10 player ratings.
**Calibrate first** so later layers start from realistic numbers.

**v2 (positional):** an **event-driven** 2D model rather than a fixed per-second tick:

- Team shapes in/out of possession computed from formation + role + duty + mentality + width +
  line height; players move toward targets with speed from pace/acceleration/stamina.
- The ball state machine resolves each action between "decision points" (pass/carry/shot/
  tackle) using the geometry (passing lanes, pressure, distance to goal) and attributes.
- Positions are sampled at decision points and interpolated for rendering, so quick-sim and
  live mode share one engine; quick-sim simply skips rendering.
- Cards, fouls, injuries, offside, set pieces with designated takers and basic routines,
  substitutions, fatigue curves, weather and pitch modifiers.

**Calibration harness:** `npm run calibrate` runs 10,000 matches between generated teams and
prints a report against the CLAUDE.md targets (goals 2.6–2.8, shots 10–13/team, H/D/A
45/25/30 %, pass completion, xG distribution, cards, injuries). CI runs a 2,000-match version
with tolerance bands. Tuning constants live in one typed `calibration.ts`.

- **Done when:** both calibration runs are within the bands; golden replay tests pass;
  benchmark ≤ 5 ms/match quick-sim; tactics measurably change outcomes in A/B batch tests
  (e.g. high press ⇒ more turnovers high up, more fouls, faster fatigue).

### Phase 3 — Season loop (L)

- **Engine:** calendar generator (pre-season friendlies, league matchdays Aug–May, midweek cup
  rounds, international breaks Sep/Oct/Nov/Mar, summer + winter windows, contract expiry on
  30 June); double round-robin fixtures (circle method, home/away balancing, no 3 in a row);
  domestic cup draws; `advance(world, until)` processes days: AI lineups → matches → tables →
  events.
- **Continue loop:** advances to the next stop event (user match, deadline, important inbox
  item) with **smart pause rules**, configurable in settings.
- **Bulk sim:** matchday fixtures fan out to a Node `worker_threads` pool; results merge in a
  deterministic order so the outcome doesn't depend on the number of cores.
- **Season rollover:** promotion/relegation, contract expiry, ageing and development/decline
  curves, retirements, regens.
- **Inbox v1, saves:** autosave on each Continue; manual "save as" snapshot; load/delete.
- **UI:** fixtures/results calendar, league tables with form, results with match stats, inbox.
- **Done when:** a full season (all leagues) simulates in < 30 s and the profile is recorded;
  the user can Continue through a whole season into the next; tables and promotions are correct
  (tests on fixture validity and tie-break rules).

### Phase 4 — Squad, tactics & live match (XL)

- **Tactics:** formation editor with drag and drop (dnd-kit) and custom positions; roles and
  duties catalogue (BWM, DLP, IF, TM, SK, WB, … with attribute weightings → suitability);
  team mentality and in/out-of-possession and transition instructions; individual player
  instructions; several saved tactic slots; familiarity that grows with use; assistant feedback.
- **Squad:** sortable/filterable tables with saved column views, quick-view player cards,
  selection (XI/bench/reserves), captaincy, set-piece takers.
- **Live match:** SVG/canvas 2D pitch with interpolated dots, play/pause/speed (1× → max),
  key-moments mode, **commentary** from a template system (500+ variants with slots for players,
  minute, score context, intensity), live stats, subs, tactic changes and shouts, team talks
  (pre/half/full-time) feeding morale. Post-match report: stats, xG timeline, shot map, heat
  maps, pass network, ratings (Recharts).
- **Done when:** a user plays a full match live, changes tactics and subs mid-game, and the
  server-verified result matches the client; a batch test shows tactic changes moving results
  believably.

### Phase 5 — Training, fitness, injuries, morale, staff (L)

- Weekly schedule builder, intensity, rest, match-prep focus; individual focus and position or
  role retraining; development gains scaled by coach ratings, age, professionalism, playing time.
- Fitness, match sharpness, condition; injury model (type, severity, recovery) tied to workload,
  injury proneness and physio quality; medical centre view.
- Morale system: playing time vs. promises, team results, contract happiness, interactions
  (praise/criticise/group talks with personality-driven reactions), squad dynamics.
- Staff: roles, ratings, contracts, hire/fire market; staff affect training, scouting, medical,
  analysis.
- **Done when:** long-run tests show realistic development (peak ages, decline), injury rates
  within targets, and morale responding to events.

### Phase 6 — Transfers, scouting, contracts (XL)

- Transfer market search by attributes, position, age, value, contract, nationality; shortlists.
- Scouting: scouts with ratings, assignments (region/league/player), **knowledge levels that
  mask attributes as ranges** until scouted, reports and recommendations.
- Negotiation state machine (club ↔ club, club ↔ agent): bids, counters, sell-on, appearance
  fees, release clauses, loans (wage split, option/obligation to buy), free transfers,
  pre-contracts, renewals; personality-driven demands.
- **AI market:** clubs identify needs (position depth, quality gaps, age profile), set budgets,
  buy, sell, loan and release; deadline-day dynamics; registration rules (squad size, foreign
  limits) as configurable rule sets.
- **Done when:** a simulated season shows a living market (dozens of AI transfers per window,
  sane fees vs. value), and the user can complete every deal type end to end (E2E).

### Phase 7 — Finance, board, media, career (L)

- Finances: matchday, TV, sponsorship, merchandise, prize money, transfers; wages, staff,
  facilities; budgets, debt, FFP-like rules; monthly reports with charts.
- Board: expectations, confidence meter, objectives (league, cup, finance, youth), requests
  (budget, facilities, stadium expansion), warnings and sacking.
- Press conferences (pre/post match) with choices affecting morale and board confidence; news.
- Manager reputation, job market, applications, offers, moving clubs, basic national team job.
- **Done when:** 20-season runs show no runaway inflation or bankrupt-everyone collapse, and the
  user can be sacked and hired elsewhere.

### Phase 8 — Youth, loans, international, history (M)

- Youth academy and annual intake (quality from facilities and youth coaching), youth squad,
  promotions, loans with development tracking, wonderkids.
- International breaks: national squads picked from player pools, basic international matches,
  caps and goals.
- Awards (player/manager of the month and season, team of the season), records, hall of fame,
  club and competition history, season review screens.
- **Done when:** regens keep the world's ability distribution stable over 20 seasons (no drift).

### Phase 9 — Polish & hardening (L)

- Profiling and optimisation (engine allocations, bulk-write paths, API caching), route-level
  code splitting.
- **Balance pass:** 20+ season headless runs with dashboards for goals, ability drift, wages,
  transfer fees and finances; fix anything absurd.
- UX polish, accessibility audit (keyboard, screen reader, contrast), keyboard shortcuts
  everywhere, empty/error states, loading skeletons.
- Broader E2E coverage, documentation, production Dockerfile + deployment guide (API serving the
  built web app, managed Postgres, secrets).
- **Done when:** the CLAUDE.md definition of done holds: register → create save → play several
  full seasons with no crashes; calibration passes; all systems interact; clean-clone
  `npm run dev` works; CI green; 20-season sim completes with no runaway values.

---

## 4. Order of work and dependencies

```
P1 World ─▶ P2 Match engine ─▶ P3 Season loop ─▶ P4 Tactics + live match
                                      │
                                      ├─▶ P5 Training/fitness/morale/staff ─┐
                                      ├─▶ P6 Transfers/scouting/contracts ──┼─▶ P9 Polish
                                      ├─▶ P7 Finance/board/media ───────────┤
                                      └─▶ P8 Youth/international/history ───┘
```

P5–P8 all depend on the season loop and are fairly independent of each other, but they
interact (wages ↔ finance, morale ↔ transfers), so they stay in the CLAUDE.md order.

## 5. Key risks and mitigations

| Risk                                                               | Mitigation                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Match engine fails to calibrate, or tactics have no visible effect | Calibrate v1 first; a harness with A/B tactic batches; all tuning constants in one module; golden tests catch accidental drift |
| World season > 30 s                                                | Event-driven engine (no per-second ticks), worker pool, allocation-light code, bulk SQL writes; benchmark in CI from Phase 3   |
| Long-run economic or ability drift                                 | Nightly 20-season sim with thresholds that fail the job; feedback loops (wage caps, regen quality) tuned in Phase 9            |
| Large DB writes per Continue                                       | Diff-based flush; raw bulk SQL for hot paths; don't store AI match event streams (replay from seed)                            |
| UI complexity, giant files                                         | Feature folders, shared table/card components, < 300-line modules, design system first                                         |
| Scope creep                                                        | Ship solid simplified versions; mark deferred items `TODO(phase-N)` and list them in PROGRESS.md                               |
| Tooling betas (embedded Postgres, Prisma audit noise)              | Docker/CI path always works; version guard for Prisma; pin exact versions                                                      |

## 6. What you'll get at the end of each phase

- A short summary, the exact commands to try it, and honest notes on anything simplified.
- Updated `PROGRESS.md` / `DECISIONS.md`, commits on GitHub, and a green CI run.
- A working build you can open on <http://localhost:5173> to play with what's new.
