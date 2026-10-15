# Data quality

## Reports

Every `npm run data:import` writes `data-packs/reports/import-<pack>-<time>.md` and `.json`
(also `latest-<pack>.md`), **including failed and dry runs**. Sections:

- **Files:** path, detected table, rows read and accepted, encoding (UTF-8, BOM or Latin-1)
- **Errors and warnings:** rejected rows with file and line, unreadable dates, out-of-range
  ratings, missing columns, unknown leagues, defaulted tiers or countries
- **Imported:** nations, clubs, imported vs generated players, transfers, valuations, per league
- **Identity matching:** pairs by method, ambiguous identities (not merged), fuzzy candidates
  (not merged), unmatched records on each side, identity conflicts (nationality, height)
- **Dropped records:** every reason with a count (no club, league not included, no
  nationality, no age, …)
- **Provenance:** share of attribute values from detailed source / coarse source / derived,
  attributes that are always derived, per-field status counts for players and clubs
- **Distributions:** Current Ability and market value by tier, ages, primary positions
- **Ability calibration** and **value model** fit statistics
- **Changes since the previous version** (on re-import), with examples
- All counters

Records _processed_ are not records _verified_; the report never claims coverage beyond what
was read.

## Current results

### Real pack

Built locally from the user's files (version `v3e667f52a6e5`, ~8 s): 157 nations, 35 leagues,
613 clubs, 13,819 imported + 939 generated players, 58,166 historical transfers, 162,985
valuations; career start 2025-07-01. Full report: `data-packs/reports/latest-real.md` (local).

- Player matching: 12,059 ratings players matched to Transfermarkt-style records (full name
  6,915 · display name 1,304 · name tokens 3,255 · surname 585); 5 ambiguous, not merged.
- Club matching: exact name 289 · player overlap 114 · name tokens 30 · unmatched 239 (mostly
  clubs the Transfermarkt-style source doesn't cover: Brazil, Argentina, MLS, China…).
- Squad sizes 20-33 (median 24) after removing players who left their 2023 club.
- Calibration: CA tracks source overall with r = 0.854; value model R² (log) 0.703.
- Known: nationality spelling conflicts are reported, not resolved (Turkey/Türkiye,
  Bosnia and Herzegovina/Bosnia-Herzegovina); league membership follows the 2023 ratings
  file; five leagues have a derived country (set `leagues[...].nation` in the config).

### Sample pack (fictional fixture, committed)

`npm run data:import -- --pack sample`, version `v2701b9d9256b`:

| Measure                               | Result                                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| Ratings rows read / accepted          | 383 / 381 (2 malformed rows rejected with reasons)         |
| Older game version + duplicate update | collapsed to one record each                               |
| Leagues imported                      | 3 (a 3-club league excluded as too small)                  |
| Clubs / imported players / generated  | 24 / 337 / 116 (96 squad fillers + 20 free agents)         |
| Players matched across sources        | 222, all by full name + birth date (accents ignored)       |
| Ambiguous (same name and birth date)  | 2, not merged                                              |
| Fuzzy candidates                      | 1 (surname spelt differently), not merged                  |
| Identity conflicts kept               | 1 (nationality)                                            |
| League country derived                | 1 league (no country in the data), warned                  |
| Contracts simulated                   | 1 (expired before the start date)                          |
| Attribute values                      | 70.5 % source-backed, 29.5 % derived                       |
| CA vs source overall                  | correlation 0.884, median error 1, mean absolute error 6.7 |
| Value model                           | R² (log) 0.84, median error 27 %                           |

### Scale benchmark (large fictional dataset)

`npx tsx apps/api/scripts/bench-pack.ts`: 36 leagues, 648 clubs, 18,144 rated players,
15,495 Transfermarkt-style players, 123,960 valuations, 9,370 transfers (all invented):

| Step                                        | Time on the dev laptop |
| ------------------------------------------- | ---------------------- |
| Import (read, match, map, build)            | 2.1 s                  |
| Write pack (31.8 MB JSON)                   | 0.3 s                  |
| First new save (also installs pack history) | 4.8 s                  |
| Further new saves                           | 3.4 s                  |

## Resolving issues

| Report says                           | What to do                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Fuzzy candidate                       | If it is the same person, add `{ "ea": "<id>", "tm": "<id>" }` to `identity.approve`   |
| Wrong automatic match                 | Add the pair to `identity.reject`                                                      |
| Unmatched club                        | Add `clubAliases["<ratings name>"] = "<Transfermarkt-style name>"`                     |
| League country derived / tier default | Set `leagues["<league>"].nation` / `.tier`                                             |
| Promotion counts defaulted            | Set `leagues["<league>"].promotionPlaces` / `relegationPlaces`                         |
| No exchange rate                      | Set `sourceCurrency` and `fxRatesToEur`                                                |
| Wrong data for a player or club       | Fix it in the in-game database editor (per save) or in your source files and re-import |
