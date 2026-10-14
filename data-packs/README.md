# Data packs

A **data pack** is the starting world for a new career:

| Pack        | What it is                                                          | Where it comes from                                   |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `fictional` | Generated nations, clubs and players (the default; safe to publish) | Built into the game, generated from the save's seed   |
| `real`      | Real clubs, leagues and players                                     | **Your** dataset files in `raw/`, imported locally    |
| `sample`    | A tiny fictional dataset in the real-data format (tests and demos)  | `fixtures/sample/` (committed; every row is invented) |

> **Licensed data must never be committed.** `raw/`, `staging/`, `processed/`, `reports/`,
> `assets/` and `config/*.json` are gitignored. Real names and data are for **personal,
> non-commercial use** only and must not be redistributed. See `docs/DATA_SOURCES.md`.

## Folder layout

```
data-packs/
  raw/          your downloaded dataset files (CSV), any sub-folders      (gitignored)
  staging/      reserved for intermediate files                            (gitignored)
  processed/    built packs: <pack>/<version>.json, current.json, identity-map.json (gitignored)
  reports/      inspection and import reports (Markdown + JSON)            (gitignored)
  assets/crests your own club images: <crest-key>.png|svg|jpg|webp         (gitignored)
  config/       import.json: optional import settings                      (gitignored)
  fixtures/     committed, FICTIONAL test datasets
```

## What to put in `raw/`

The importer reads every `.csv` under `raw/` and recognises tables by their columns (names
are matched case- and punctuation-insensitively; aliases live in
`packages/data-import/src/sources/columns.ts`):

1. **Player ratings (required):** one row per player with an id, name, positions, `overall`
   and `potential` (0-99), ideally the detailed ratings (crossing, finishing, … goalkeeping),
   club, league, league level, birth date, nationality, height, foot, wage, value, release
   clause and contract year. EA FC/FIFA-style player tables have this shape.
2. **Transfermarkt-style tables (optional, recommended):** `players.csv` (contract expiry,
   market value, current club), `clubs.csv` (stadium name and capacity), `competitions.csv`
   (league country), `transfers.csv` (historical transfers and fees) and
   `player_valuations.csv` (market value history).

Extract archives first; export Excel/Parquet to CSV. Then check what the importer sees:

```bash
npm run data:inspect
```

The report (`reports/inspect-*.md`) lists every file's columns, row count, encoding, detected
table type, missing columns and sample rows.

## Building and re-building a pack

```bash
npm run data:import -- --pack real --dry-run   # validate and report only
npm run data:import -- --pack real             # write processed/real/<version>.json
```

Every run writes `reports/import-real-*.md` (and `reports/latest-real.md`): files read, rows
accepted/rejected, identity matching, dropped records and why, provenance counts,
distributions, calibration, and (on re-import) what changed since the previous version.

**Re-importing a newer dataset is safe.** The version is a hash of the content; the previous
version file is kept. Saves keep their own copy of their world and remember their pack
version, so an ongoing career is never modified. Only new careers use the new version.
Canonical ids are kept stable across imports by `processed/<pack>/identity-map.json`.

## Optional configuration: `config/import.json`

All fields are optional (see `packages/data-import/src/config.ts`):

```json
{
  "startDate": "2025-07-01",
  "minClubsPerLeague": 8,
  "includeLeagues": ["Example League"],
  "leagues": { "Example League": { "tier": 1, "nation": "Exampleland", "relegationPlaces": 3 } },
  "primaryClubSource": "ea",
  "minSquadSize": 20,
  "generatedFreeAgents": 80,
  "clubAliases": { "Ratings Club Name": "Transfermarkt Club Name" },
  "identity": { "approve": [{ "ea": "123", "tm": "456" }], "reject": [] },
  "sourceCurrency": { "ea": "EUR", "tm": "EUR" },
  "fxRatesToEur": {}
}
```

Use `leagues` to supply facts the data lacks (tier, country, promotion/relegation counts);
otherwise the importer uses labelled simulation defaults and says so in the report. Use
`identity.approve` / `reject` to resolve the fuzzy candidates the report lists.

## Your own crests

No real badges, kits or photos ship with the game. To see your own crest for a club, save an
image as `assets/crests/<crest-key>.png` (or `.svg`, `.jpg`, `.webp`). The crest key is the
club name in lower case, accents and punctuation removed, spaces as dashes (e.g.
`example-united.png`). Otherwise a badge
is drawn from the club's colours and code.
