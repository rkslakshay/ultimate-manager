# Data sources

_Last updated: 2026-10-15_

## Current status (local machine, not committed)

The user has placed two datasets in `data-packs/raw/` (gitignored); `npm run data:inspect`
lists them. Nothing from them is committed and nothing was written from memory.

| Folder               | Files used by the importer                                                               | Snapshot                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `raw/ratings/`       | `male_players.csv` (rows of game version 24 only: 18,350 of 180,021)                     | file dates Oct 2023                                                               |
| `raw/transfermarkt/` | `players.csv`, `clubs.csv`, `competitions.csv`, `transfers.csv`, `player_valuations.csv` | file dates Sep 2026; newest valuation in season 2025-26 → career start 2025-07-01 |

Present but not used: `female_*` (the game world is men's football), `male_coaches.csv`,
`male_teams.csv`, `countries.csv`, `national_teams.csv` (not needed yet) and the match tables
`appearances`, `games`, `club_games`, `game_events`, `game_lineups` (needed once matches are
simulated). Unused files are recognised by name and skipped without reading their rows.

**The two snapshots are about two seasons apart.** Ratings come from the 2023 file; current
clubs, contracts and values come from the newer Transfermarkt-style file where a player is
matched (see `docs/DATA_MAPPING.md`). League membership of clubs still follows the ratings file,
so promotions/relegations since 2023 are not reflected. A newer ratings file fixes both.
Licence, retrieval date and attribution below must be filled in from the dataset pages.

## Expected sources

The importer is designed around two kinds of public dataset that together cover the game's
needs. Before using any of them, read the dataset page's licence and terms yourself; the
entries below must be completed with what you find (this project does not assume any
dataset may be redistributed or used commercially).

### 1. Player ratings (required)

| Item              | Details                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kind              | EA Sports FC / FIFA-style player table (e.g. a "complete player dataset" CSV on Kaggle)                                                                                                                                                    |
| Put files in      | `data-packs/raw/ratings/` (any name, e.g. `players.csv`)                                                                                                                                                                                   |
| Fields used       | ids, names, positions, overall/potential, detailed ratings, birth date, nationality, height, weight, foot, weak foot, skill moves, work rate, traits, club, league, league level, shirt number, contract year, wage, value, release clause |
| Important caveats | Ratings, wages and values in such tables are **a video game's estimates**, not real wages or official valuations. Provenance marks them as coming from this source; the UI does not present them as verified facts.                        |
| Licence           | _To be filled in from the dataset page when provided._                                                                                                                                                                                     |
| Retrieval date    | _To be filled in._                                                                                                                                                                                                                         |
| Attribution       | _To be filled in._                                                                                                                                                                                                                         |

### 2. Transfermarkt-style tables (optional, recommended)

| Item              | Details                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kind              | Tables derived from Transfermarkt (e.g. a "football data from Transfermarkt" dataset)                                                                         |
| Put files in      | `data-packs/raw/transfermarkt/` (`players.csv`, `clubs.csv`, `competitions.csv`, `transfers.csv`, `player_valuations.csv`)                                    |
| Fields used       | contract expiry, current market value, value history, transfer history (date, clubs, fee), stadium name/capacity, competition country                         |
| Important caveats | Market values are community estimates, not fees. A missing fee is stored as **unknown**, never 0; a reported fee of 0 is stored as "€0 / free (as reported)". |
| Licence           | _To be filled in from the dataset page when provided._                                                                                                        |
| Retrieval date    | _To be filled in._                                                                                                                                            |
| Attribution       | _To be filled in._                                                                                                                                            |

### Not used

- No website is scraped and no API is called by the game.
- No club badges, kits or player photos are shipped. Users may place their own images in
  `data-packs/assets/crests/` (gitignored) for personal use.

## Committed fictional data

| Dataset                                 | Licence / origin                                                         |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `data-packs/fixtures/sample/`           | Invented by this project (generated by `make-fixtures.ts`); no real data |
| Fictional world generator (`fictional`) | Invented by this project's engine from name morphemes and a seed         |

## Real vs derived, at a glance

See `docs/DATA_MAPPING.md` for every field. In short:

- **From the source data (when present):** names, birth dates, nationality, height, weight,
  foot, positions, detailed ratings (mapped), source overall/potential, club and league,
  shirt number, contract expiry, wage (game estimate), release clause, market value and its
  history, historical transfers and fees, stadium name and capacity.
- **Derived by the game (labelled):** hidden attributes, mental/physical attributes with no
  source equivalent (e.g. bravery, leadership, determination), Current/Potential Ability,
  club reputation, finances and facilities, club colours, nation codes and reputation,
  promotion/relegation counts when not configured, league country when not in the data.
- **Simulated (labelled):** contracts or wages missing from the data, squad fillers and free
  agents (marked "generated"), national cups (a game construct), values for players without
  one.
