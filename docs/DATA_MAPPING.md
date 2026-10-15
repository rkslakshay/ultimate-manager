# Data mapping

How source records become game entities. The code is the reference; this page explains it.
Source column names appear only in `packages/data-import/src/sources/columns.ts`; mapping
rules only in `packages/data-import/src/mapping/`.

## Provenance model

Every imported player and club carries a `source` record:

- `key`: stable source key, e.g. `ea:20801|tm:8198` (ratings id + Transfermarkt-style id)
- `fields`: per-field status: `source_backed`, `derived`, `simulated`, `unverified`, `unknown`
- players also keep the source `overall`/`potential` (0-99) and one origin letter per attribute:
  `S` detailed source rating(s), `F` coarse face-stat fallback, `D` derived

Entities have an `origin`: `imported` (from a pack), `generated` (engine) or `custom`
(editor). A record mixes statuses: a real player's name is source-backed while his hidden
attributes are derived. The UI shows a "Real player" badge, dotted underlines on derived
attributes and tags on derived/simulated/unknown values.

## Identity matching (ratings ↔ Transfermarkt-style)

Applied in order; a level only accepts pairs that are unique on **both** sides:

1. Manual approvals (`config.identity.approve`)
2. Exact normalised full name + birth date
3. Exact normalised display name + birth date
4. Name tokens + birth date: same first name and every word of the shorter name appears in
   order in the longer one ("Kylian Mbappé" ↔ "Kylian Mbappé Lottin")
5. Surname + birth date + nationality

Normalisation removes accents, case and punctuation; original names are kept for display.
Several candidates at a level → **ambiguous**, nothing merged. Same birth date and
Jaro-Winkler similarity ≥ 0.85 but not equal → **fuzzy candidate**, reported, never merged.
Pairs in `config.identity.reject` are never matched. Players without a birth date can't be
matched. Matched pairs whose nationality or height disagree are kept and reported.

Clubs, in three passes, each one-to-one:

1. Exact normalised name (ignoring FC/CF/AFC/…), the Transfermarkt-style URL slug
   (`inter-miami-cf`) or a configured alias, when unique on both sides.
2. **Player overlap**: where the club's matched players play now: ≥ 3 players, at least twice as
   many as at any other club, and ≥ 25 % of the squad (so a few players who moved on between
   snapshots can't drag a club to their new club).
3. Name tokens: every word of one name is in the other's name or slug ("Benfica" ↔ "SL
   Benfica"), unique both ways, and at least one matched player of the club plays there now.

**Current club** (`primaryClubSource`, default `"tm"`): the Transfermarkt-style current club is
used when the player appeared in that source in the career-start season (`last_season`) and
the club is in the pack. If he is active this season at a club that isn't in the pack (and his
old club is identified), or his old club's squad was tracked this season without him
(retired/moved to an uncovered league), he is not placed in the world. Otherwise the ratings
club is kept. All three cases are counted in the report (`tm.*` counters). Canonical ids persist in `processed/<pack>/identity-map.json`.

## Leagues, nations, clubs

| Game field              | Rule                                                                                                                | Status                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| League membership       | Ratings club → league; fallback: matched club's competition                                                         | source                |
| League tier             | config → ratings `league_level` (majority) → 1 with a warning                                                       | source/config/default |
| League country          | config → matched competitions' country → most common player nationality (warned)                                    | source/config/derived |
| Included leagues        | ≥ `minClubsPerLeague` clubs in the data, not excluded, in `includeLeagues` if set                                   | config                |
| Promotion/relegation    | config → `min(3, floor(smaller league size / 6))` between consecutive tiers (reported)                              | config/simulated      |
| National cups           | One per playable nation, all its league clubs; named "<Nation> Cup"                                                 | simulated             |
| Club name, league       | Ratings source                                                                                                      | source                |
| Stadium, capacity       | Transfermarkt-style clubs; else "<Club> Stadium" and capacity from reputation                                       | source/derived        |
| City, founded year      | Not in the supported sources → **unknown** (shown as Unknown)                                                       | unknown               |
| Colours                 | Palette chosen by a hash of the club key                                                                            | derived               |
| Crest                   | User image `assets/crests/<slug>.png` if present, else generated badge                                              | user/derived          |
| Reputation (1-99)       | `30 + 24.1 × (log10(squad value €) − 6.3)` (≈ €500M → 88, €40M → 61, €2M → 30); squad ability if < 5 valued players | derived               |
| Balance, budgets        | balance = 12 % of squad value + €1M; transfer budget = 40 % of balance; wage budget = wage bill × 1.08              | derived               |
| Facilities              | From reputation                                                                                                     | derived               |
| Nation code, reputation | Code from the name; reputation from the mean CA of its best 23 players                                              | derived               |
| Nation name pool        | First/last names of that nationality's imported players (for regens)                                                | derived               |

## Players

| Game field         | Rule                                                                                                             | Status           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| First/last name    | Transfermarkt-style first/last; else "L. Surname" + first token of the long name                                 | source           |
| Birth date         | Ratings → Transfermarkt-style → from age (mid-year)                                                              | source/derived   |
| Nationality        | Ratings → Transfermarkt-style; players without one are dropped                                                   | source           |
| Height, weight     | Ratings → Transfermarkt-style (height) → position default                                                        | source/derived   |
| Foot, weaker foot  | Ratings foot; weak foot 1-5 → 3/7/11/15/19 of 20; 5 → "either"                                                   | source           |
| Positions          | Ratings list: 1st natural (20), then 18, 16…; neighbouring slots get 8 (derived)                                 | source           |
| Shirt number       | Ratings club jersey number                                                                                       | source/unknown   |
| Club               | Ratings club (or Transfermarkt-style with `primaryClubSource: "tm"`); conflicts counted                          | source           |
| Contract end       | Transfermarkt-style exact date → ratings contract year (30 June) → simulated 0-2 seasons; expired ones simulated | source/simulated |
| Contract start     | Ratings joined date → derived                                                                                    | source/derived   |
| Wage (weekly, EUR) | Ratings wage (a game estimate) → simulated from ability and club reputation                                      | source/simulated |
| Release clause     | Ratings release clause → unknown                                                                                 | source/unknown   |
| Market value (EUR) | Transfermarkt-style current value → ratings value → fitted value model                                           | source/simulated |
| Squad status       | Rank by CA within the club                                                                                       | derived          |
| Traits             | Ratings traits by keyword (table below); if the column is absent, generated from attributes                      | source/derived   |

### Attributes (0-99 → 1-20)

Scale: `1 + (rating − 25) × 19 / 70 + offset`, so 25 → 1 and 95 → 20. The global `offset` is
fitted at import time so that the median of (our CA − target CA) is zero (see below).

| Our attribute    | Source rating(s) (weights)                                 | Face-stat fallback         |
| ---------------- | ---------------------------------------------------------- | -------------------------- |
| Corners          | crossing .5, curve .5                                      | passing                    |
| Crossing         | crossing                                                   | passing                    |
| Dribbling        | dribbling (skill)                                          | dribbling                  |
| Finishing        | finishing .85, volleys .15                                 | shooting                   |
| First Touch      | ball control                                               | dribbling                  |
| Free Kick Taking | free-kick accuracy                                         | shooting .5, passing .5    |
| Heading          | heading accuracy                                           | physic                     |
| Long Shots       | long shots .7, shot power .3                               | shooting                   |
| Marking          | marking/defensive awareness                                | defending                  |
| Passing          | short passing .6, long passing .4                          | passing                    |
| Penalty Taking   | penalties                                                  | shooting                   |
| Tackling         | standing tackle .6, sliding tackle .4                      | defending                  |
| Technique        | ball control .4, dribbling .3, curve .3                    | dribbling                  |
| Aggression       | aggression                                                 | physic                     |
| Anticipation     | reactions .6, interceptions .4                             | defending .5, dribbling .5 |
| Composure        | composure                                                  | shooting .5, passing .5    |
| Decisions        | reactions .5, vision .25, composure .25                    | passing .5, dribbling .5   |
| Off the Ball     | (attacking) positioning                                    | shooting                   |
| Positioning      | marking .5, interceptions .5 (goalkeepers: GK positioning) | defending                  |
| Vision           | vision                                                     | passing                    |
| Acceleration     | acceleration                                               | pace                       |
| Agility          | agility                                                    | dribbling                  |
| Balance          | balance                                                    | dribbling                  |
| Jumping Reach    | jumping                                                    | physic                     |
| Pace             | sprint speed                                               | pace                       |
| Stamina          | stamina                                                    | physic                     |
| Strength         | strength                                                   | physic                     |
| Aerial Reach     | GK handling .6, jumping .4 (+ height for goalkeepers)      | —                          |
| Command of Area  | GK positioning .5, GK handling .5                          | —                          |
| Handling         | GK handling                                                | —                          |
| Kicking          | GK kicking                                                 | —                          |
| One on Ones      | GK diving .4, GK reflexes .4, GK speed .2                  | —                          |
| Reflexes         | GK reflexes                                                | —                          |
| Rushing Out      | GK speed                                                   | —                          |

**Always derived** (no source equivalent; seeded per player from `attributes:<ratings id>`):
long throws (strength), bravery (aggression, strength, heading), concentration
(anticipation, composure, marking), determination (international reputation), leadership
(age, international reputation), teamwork (defensive/attacking work rate), work rate (work
rate words, else stamina), flair (skill moves, else dribbling), natural fitness (stamina,
strength), communication (command of area for keepers), eccentricity, punching, throwing
(kicking).

### Hidden attributes (all derived unless stated)

Seeded from `hidden:<ratings id>` (identical on every re-import): consistency ↑ overall,
injury proneness random (set 16-19 when the source lists an "Injury Prone" trait, 2-5 for
"Solid Player": those two are source-backed), important matches and pressure ↑ composure,
versatility ↑ number of listed positions, professionalism ↑ determination, ambition ↑
international reputation, temperament ↓ aggression, loyalty/sportsmanship/adaptability random.

### Current and Potential Ability

CA is **always computed by our engine** from the mapped attributes and position weights; it is
not copied from the source and does not claim to reproduce any other game's ability formula.
Target used for calibration: `target(rating) = (rating − 28) × 2.85` (94 → 188, 85 → 162,
75 → 134, 65 → 105). PA keeps the source headroom: `PA = CA + target(potential) −
target(overall)`, clamped to [CA, 200]. The report shows the fitted offset, the median and mean
absolute CA error and the correlation with the source overall.

### Traits (keyword → our trait)

long shot → shoots from distance · flair, outside foot → tries tricks · technical/speed
dribbler → runs with ball often · playmaker, long passer → tries killer balls · finesse shot →
places shots · power free-kick/shot → shoots with power · dives into tackles · rushes
out/sweeper → comes for crosses. Others are counted as unmapped in the report.

## Transfers and values

- Base currency **EUR**. Both supported sources publish EUR columns; other currencies need
  `sourceCurrency` + `fxRatesToEur` in the config (the import fails rather than guess a rate).
- **Historical transfers** keep date, season, both clubs (linked to game clubs when they are in
  the pack, names otherwise), fee, market value at the time, the stated type (e.g. loan) and
  source. `feeStatus`: `paid` (> 0), `zero_reported` (0, shown "€0 / free (as reported)"),
  `unknown` (missing; never stored as 0).
- **Valuations** keep date, value and source.
- History is stored once per pack version in shared, immutable tables. In-game transfers
  (Phase 6) will live in a separate per-save table, so historical and simulated transfers never
  mix.
- **Value model:** `ln(value) = a + b·CA + c·(age−26) + d·(age−26)² + e·max(0, PA−CA) +
f·min(yearsLeft, 4) + g·clubReputation`, fitted by least squares on source-backed values
  (report shows R² and median error). It values players whose source value is missing and
  will drive in-game valuations later. It is an estimate of worth, not an asking price or fee.

## Generated players in real packs

- **Squad fillers:** clubs with fewer real players than `minSquadSize` (default 20) get
  generated players to cover missing positions, named from the nation's pool and pitched
  slightly below the club's median ability.
- **Free agents:** `generatedFreeAgents` (default 80) generated unattached players.
- **Regens** (Phase 3) will use the same nation name pools.

All of them have `origin: generated`, no source record, and a "gen" marker in real-data
squad lists.
