# PROJECT: "Ultimate Manager - Road to Glory" — a full-stack Football Manager-style web app (inspired by FM24)

You are the lead engineer, game designer, and QA on this project. Build the whole product autonomously, phase by phase, with high quality. Make sensible decisions yourself instead of asking me, unless a decision is truly blocking or irreversible. Record every significant decision in `DECISIONS.md`.

## 1. Vision
A deep, text-and-data-driven football management simulation playable in the browser. The player takes charge of a club, manages squad, tactics, training, transfers, finances, staff, and youth over multiple seasons, and watches matches unfold via a 2D pitch view and live commentary. Depth and believable results matter more than flashy graphics. Aim for the feel of FM24: dense information screens, meaningful decisions, emergent stories.

## 2. Tech stack (use unless you have a strong reason to change; log it in DECISIONS.md)
- Monorepo with npm/pnpm workspaces: `/apps/web`, `/apps/api`, `/packages/engine`, `/packages/shared`
- Frontend: React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Zustand (state), TanStack Query, React Router, Recharts (charts), Framer Motion (light animation)
- Backend: Node.js + TypeScript + Fastify (or Express), Zod validation
- Database: PostgreSQL with Prisma ORM (SQLite for quick local dev is acceptable)
- Auth: email/password with JWT sessions (bcrypt), multiple save games per user
- Simulation engine: pure TypeScript package (`/packages/engine`) with ZERO dependency on web or DB, deterministic via a seeded RNG, fully unit-tested. It must be able to run in Node (for bulk season sim) and in the browser (for live matches).
- Testing: Vitest (engine + API), Playwright (a few end-to-end flows)
- Tooling: ESLint, Prettier, Husky pre-commit (lint + typecheck), GitHub Actions CI, Docker Compose for Postgres
- Everything runs locally with a single `npm run dev`. Include a seed script and a clear README.

## 3. Core game systems (build to this spec)

### 3.1 World & data
- Fictional world generator: countries, leagues (at least 3 countries, 2 divisions each, 16-20 teams), clubs, stadiums, nationalities, regens
- Generated player database of roughly 3,000+ players with realistic distributions of age, position, nationality, ability, potential, wages, contracts
- Names pulled from per-nation name pools
- An in-app **database editor / import (JSON/CSV)** so users can rename clubs and players or import their own data. Do NOT include copyrighted real names, badges, or kits by default.
- Calendar system: a full season calendar with matchdays, cup rounds, international breaks, transfer windows (summer and winter), preseason, contract expiry dates

### 3.2 Player model
- Attributes on a 1-20 scale: Technical (finishing, passing, dribbling, first touch, crossing, tackling, heading, long shots, set pieces, marking...), Mental (decisions, vision, composure, positioning, off the ball, work rate, teamwork, anticipation, aggression, leadership, determination, flair...), Physical (pace, acceleration, stamina, strength, agility, jumping, balance, natural fitness...), plus Goalkeeping attributes
- Hidden attributes: consistency, injury proneness, important matches, versatility, professionalism, ambition, loyalty, temperament
- Current Ability (CA) and Potential Ability (PA), position-specific role ratings (1-20 per position), and a derived 1-5 star display
- Player traits/preferred moves ("cuts inside", "runs with ball often", etc.) that influence the match engine
- Dynamic state: fitness, match sharpness, morale, form (rolling match ratings), condition, injuries (type, severity, recovery), suspensions, yellow-card accumulation
- Contract: wage, length, bonuses, release clause, squad status (key, rotation, prospect, backup), agent demands
- Player development/decline curves by age and training, with randomness and professionalism influence
- Player personality/morale system: playing time promises, team performance, contract happiness, media comments, and training/interaction all affect morale
- Player interactions (praise, criticise, group talks) with believable responses

### 3.3 Match engine (the heart of the game: invest the most effort here)
- Tick-based simulation (e.g., one tick per game-second-chunk or per possession event) producing a stream of events: passes, dribbles, tackles, interceptions, shots, saves, fouls, cards, injuries, substitutions, set pieces, offsides
- Positional model: 11v11 on a 2D pitch with player positions, ball position, and possession; players move according to role, duty, mentality, team shape, and instructions (in-possession vs out-of-possession shapes)
- Outcomes must be driven by player attributes, roles, tactics, fatigue, morale, tactical matchups, home advantage, weather, and pitch condition, with calibrated randomness
- **Calibration targets (verify with a batch-sim test of 10,000 matches):** avg ~2.6-2.8 goals per match, ~10-13 shots per team, home win ~45%, draw ~25%, away win ~30%, realistic pass completion, realistic xG distribution, realistic card and injury rates
- Expected goals (xG) computed for every shot; full match stats: possession, shots, on target, xG, passes, tackles, fouls, corners, offsides, heat maps, pass networks, player ratings (1-10)
- Set pieces with designated takers and routines (basic version is fine)
- Live match UI: 2D top-down pitch with moving player dots (smooth interpolation), play/pause/speed controls (1x to max), key moments only mode, **live commentary feed** with varied text templates (aim for 500+ phrasing variants), live stats panel, ability to change tactics, make substitutions, and give team talks (pre-match, half-time, full-time)
- Quick-sim mode for non-user matches (fast, same engine, no rendering)
- Deterministic replay from seed + inputs (for debugging and tests)

### 3.4 Tactics
- Formation editor (drag and drop on a pitch) supporting 4-4-2, 4-2-3-1, 4-3-3, 3-5-2, 5-3-2, etc., with custom positions
- Player roles and duties (e.g., Ball Winning Midfielder, Deep-Lying Playmaker, Inside Forward, Target Man, Sweeper Keeper, Wing-Back, etc.) with Attack/Support/Defend duties; each role has attribute weightings that determine role suitability
- Team mentality (very defensive to very attacking), in-possession and out-of-possession/transition instructions: tempo, width, passing directness, defensive line, line of engagement, pressing intensity, tackling, time wasting, play out from the back, etc.
- Individual player instructions
- Set tactic slots (several saved tactics per team), tactic familiarity that builds over time, and an assistant manager's tactical feedback
- Opposition instructions and scouting-based match preparation

### 3.5 Squad & training
- Squad screen with sortable and filterable tables (customizable column views), player profile pages (attributes hexagon/radar, history, contract, morale, stats, injuries, scouting report)
- Training: weekly schedule builder, per-player individual training focus, positional/role retraining, intensity, rest, match-preparation focus, injury risk tied to workload; coaches' ratings affect training gains
- Medical: injury risk, physio ratings, recovery estimates
- Youth academy: intake each year, youth squad, loans, promotions, wonderkid generation
- Team reports: squad dynamics, social groups, team cohesion, leadership hierarchy

### 3.6 Transfers & contracts
- Transfer market with search by attributes, position, age, value, contract status, nationality, and shortlists
- Scouting system: scouts with attributes assigned to regions/leagues/players, knowledge levels that mask exact attribute values (show ranges until scouted), recommendations, scouting reports
- Negotiation system with AI clubs and agents: bids, counter-offers, clauses (sell-on, appearance fees, release clauses), loan deals (wage split, option to buy), free transfers and pre-contracts, contract renewals, player demands
- AI clubs buy, sell, loan and release players realistically based on their needs, finances, and reputation; the market should feel alive
- Transfer/loan windows and registration rules (squad size, foreign player limits as configurable rule sets)

### 3.7 Finance & board
- Club finances: income (matchday, TV, sponsors, merchandise, prize money, transfers), expenses (wages, staff, facilities, fees), transfer budget and wage budget, debt, FFP-like rules
- Board: expectations, confidence meter, objectives (league finish, cup run, finances, youth development), board requests, facilities upgrades, stadium expansion, sackings and job offers
- Manager reputation and career progression: apply for jobs, get sacked, move clubs, national team opportunity (basic)

### 3.8 Staff
- Assistant manager, coaches (technical, tactical, fitness, goalkeeping), scouts, physios, analysts, with ratings that affect relevant systems; hiring/firing market and contracts

### 3.9 Media, inbox & narrative
- Central **inbox** driving the game loop: match previews, board messages, player complaints, transfer offers, injury reports, scouting reports, news
- Press conferences (pre and post match) with choices that affect morale and board confidence
- News feed, league tables, fixtures/results, top scorers/assists/ratings, awards (player of the month/season), season reviews, hall of fame, history

### 3.10 Game loop & saves
- "Continue" button advances the date to the next event requiring attention (match, deadline, inbox item). Smart pause rules so the player is not spammed but nothing important is skipped
- Multiple save games per user, auto-save, manual save, load, delete
- Background season simulation for the entire world (all leagues advance), with efficient batch processing. A full season of the world must simulate in a reasonable time (target under ~30 seconds on a laptop); profile and optimize

### 3.11 AI
- AI managers choose formations/tactics suited to their squad; pick lineups, make substitutions, handle transfers and contracts within budget
- Difficulty/realism settings

## 4. UI/UX requirements
- Dense, professional, dark-themed dashboard layout inspired by FM24: left sidebar navigation (Inbox, Squad, Tactics, Training, Transfers, Scouting, Finances, Club, Fixtures, League, Search), top bar with date, Continue button, and club info
- Fully responsive desktop-first, with a usable tablet layout; mobile acceptable but secondary
- Data-rich tables with sorting, filtering, column customization, and quick-view player cards
- Keyboard shortcuts for common actions
- Accessible (semantic HTML, contrast, focus states)
- Loading skeletons and optimistic updates; no blocking spinners for local operations
- Consistent design system: define tokens (colors, spacing, typography) up front and reuse components

## 5. Architecture rules
- The engine package is pure, deterministic, and framework-free. All game rules live there, never in React components or route handlers
- Shared types and Zod schemas live in `/packages/shared` and are used by both web and api
- API is RESTful (or tRPC if you prefer, log the choice), validated, with consistent error handling and pagination
- Database schema normalized with migrations; indexes on common queries (player search, fixtures by date)
- No giant files: keep modules cohesive, under ~300 lines where reasonable
- Strict TypeScript (`strict: true`), no `any` without justification
- Write tests as you go: engine logic (unit + statistical calibration), API (integration), key UI flows (Playwright)
- Never commit secrets; use `.env.example`

## 6. Phased build plan (do these IN ORDER; finish and verify each before the next)

**Phase 0: Foundation.** Monorepo scaffold, tooling, CI, Docker Compose, README, `PROGRESS.md`, `DECISIONS.md`, design system, app shell with navigation, auth, health checks.

**Phase 1: Data & world.** Prisma schema, name pools, world/league/club/player generators, seed script, database browsing screens (league tables, club pages, player profile pages).

**Phase 2: Match engine v1 (headless).** Seeded RNG, simplified possession/shot model, player ratings, xG, stats, batch calibration test against targets in 3.3. Then upgrade to the full positional/tactical model.

**Phase 3: Season loop.** Calendar, fixture generation, "Continue" loop, quick-sim of all matches, league tables, results, basic inbox, saves, season rollover (promotion/relegation, contracts expiring, player aging and development, retirements, regens).

**Phase 4: Squad, tactics & live match.** Squad screens, formation/role/instruction editor, live match view with 2D pitch, commentary, half-time talks, substitutions, post-match report.

**Phase 5: Training, fitness, injuries, morale, staff.**

**Phase 6: Transfers, scouting, contracts, negotiation, AI transfer activity.**

**Phase 7: Finance, board, press conferences, objectives, job market, sackings.**

**Phase 8: Youth academy, loans, international break/basic national team, awards, history/records.**

**Phase 9: Polish & hardening.** Performance profiling, balance pass (long-run sims of 20+ seasons to check for economic inflation, ability drift, absurd results), UX polish, accessibility, E2E tests, documentation, deployment config (Dockerfile, deployment guide).

## 7. Working agreements (how you operate)
1. **At the start of every session, read `PROGRESS.md` and `DECISIONS.md`.** At the end of every meaningful chunk of work, update `PROGRESS.md` (what's done, what's next, known issues).
2. **Work autonomously.** Do not stop to ask for confirmation between small tasks. Only pause at the end of each phase with a short summary, how to run/test it, and what's next.
3. **Plan before coding** each phase: write a brief plan (files, data models, risks), then implement.
4. **Verify your work:** run the type checker, linter, and tests after changes; actually start the app and exercise the feature where possible. Don't claim something works without running it. Fix failures yourself.
5. **Commit often** with clear conventional-commit messages (`feat:`, `fix:`, `test:`, `chore:`). One logical change per commit.
6. **No placeholders or fake implementations** presented as finished. If you stub something, mark it `// TODO(phase-N)` and list it in `PROGRESS.md`.
7. **Be honest about limitations,** simplifications, and anything you couldn't verify.
8. **Keep the scope disciplined:** build the spec in priority order. If something is too large, ship a solid simplified version and note the full version as a future enhancement. Don't gold-plate early phases.
9. **Performance matters:** use pagination/virtualized tables for large lists, memoize expensive selectors, and keep the engine allocation-light.
10. **Legal:** all default data is fictional. No copyrighted names, logos, or kits.

## 8. Definition of done (for the whole project)
- A new user can register, create a save, choose a club, and play multiple full seasons with no crashes
- Live match view works, with tactical changes affecting outcomes in a believable way
- League results are statistically realistic (calibration test passes)
- Transfers, finance, board, training, and youth all function and interact
- `npm run dev` works from a clean clone following the README; `npm test` and CI are green
- A 20-season headless simulation completes without errors or runaway values

Begin with Phase 0. First write your plan for it, then execute.
