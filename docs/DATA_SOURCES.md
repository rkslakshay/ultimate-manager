# Data sources

_Last updated: 2026-10-15_

## Current status: no real dataset has been provided yet

`data-packs/raw/` was empty when the real-data pipeline was built (checked with
`npm run data:inspect`). **No real-world player, club, contract, value or transfer data has
been imported, and none has been written from memory.** The `real` pack does not exist until
you add dataset files and run the importer. Everything below "Expected sources" describes what
the importer is built to read, not data that is present.

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
