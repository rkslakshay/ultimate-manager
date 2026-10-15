import fs from 'node:fs';
import path from 'node:path';
import { streamCsv } from '../csv-stream';
import type { ImportLog } from '../log';
import { parseDateFlexible, parseInteger, parseNumber } from '../normalize';
import { detectTable, isWomensTable, resolveColumns, TABLES, type TableKind } from './columns';
import { RATING_KEYS, type EaPlayer, type Ratings, type SourceData } from './records';

type Row = Record<string, string>;
type Getter = (row: Row, key: string) => string;

function walkCsv(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walkCsv(path.join(dir, e.name))
        : /\.csv$/i.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    )
    .sort();
}

const text = (v: string) => {
  const s = v.trim();
  return s && !/^(nan|null|none)$/i.test(s) ? s : null;
};

function footOf(v: string): 'left' | 'right' | 'either' | null {
  const s = v.trim().toLowerCase();
  if (s.startsWith('l')) return 'left';
  if (s.startsWith('r')) return 'right';
  if (s.startsWith('b') || s.startsWith('either')) return 'either';
  return null;
}

function parseEa(
  get: Getter,
  row: Row,
  rowIndex: number,
  file: string,
  log: ImportLog,
): EaPlayer | null {
  const sourceId = text(get(row, 'sourceId'));
  const overall = parseInteger(get(row, 'overall'));
  const potential = parseInteger(get(row, 'potential'));
  const positions = (get(row, 'positions') || '')
    .split(/[,/;]/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const name = text(get(row, 'shortName')) ?? text(get(row, 'longName'));
  const where = { file, row: rowIndex + 2 };
  if (!sourceId) return (log.error('ea.missing_id', 'Row has no player id', where), null);
  if (!name) return (log.error('ea.missing_name', `Player ${sourceId} has no name`, where), null);
  if (overall === null || overall < 1 || overall > 99)
    return (
      log.error(
        'ea.bad_overall',
        `Player ${sourceId}: overall "${get(row, 'overall')}" is not 1-99`,
        where,
      ),
      null
    );
  if (potential === null || potential < 1 || potential > 99)
    return (
      log.error(
        'ea.bad_potential',
        `Player ${sourceId}: potential "${get(row, 'potential')}" is not 1-99`,
        where,
      ),
      null
    );
  if (!positions.length)
    return (log.error('ea.missing_positions', `Player ${sourceId} has no positions`, where), null);

  const ratings: Ratings = {};
  for (const key of RATING_KEYS) {
    const v = parseNumber(get(row, key));
    if (v !== null) {
      if (v < 1 || v > 99)
        log.warn('ea.rating_out_of_range', `Player ${sourceId}: ${key}=${v} ignored`, where);
      else ratings[key] = v;
    }
  }
  const wr = text(get(row, 'workRate'));
  const wrParts = wr?.split('/').map((s) => s.trim());
  const dob = parseDateFlexible(get(row, 'dob'));
  if (get(row, 'dob') && dob === null)
    log.warn(
      'ea.bad_dob',
      `Player ${sourceId}: unreadable date of birth "${get(row, 'dob')}"`,
      where,
    );
  const foot = footOf(get(row, 'foot'));
  return {
    sourceId,
    name,
    fullName: text(get(row, 'longName')),
    dob,
    age: parseInteger(get(row, 'age')),
    nationality: text(get(row, 'nationality')),
    positions,
    overall,
    potential: Math.max(potential, overall),
    valueEur: parseNumber(get(row, 'valueEur')),
    wageEur: parseNumber(get(row, 'wageEur')),
    releaseClauseEur: parseNumber(get(row, 'releaseClause')),
    heightCm: parseInteger(get(row, 'heightCm')),
    weightKg: parseInteger(get(row, 'weightKg')),
    foot: foot === 'either' ? null : foot,
    weakFoot: parseInteger(get(row, 'weakFoot')),
    skillMoves: parseInteger(get(row, 'skillMoves')),
    internationalReputation: parseInteger(get(row, 'internationalReputation')),
    workRate: wrParts && wrParts.length === 2 ? [wrParts[0]!, wrParts[1]!] : null,
    traits: (get(row, 'traits') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    clubSourceId: text(get(row, 'clubId')),
    clubName: text(get(row, 'clubName')),
    leagueSourceId: text(get(row, 'leagueId')),
    leagueName: text(get(row, 'leagueName')),
    leagueLevel: parseInteger(get(row, 'leagueLevel')),
    jersey: parseInteger(get(row, 'jersey')),
    contractUntilYear: parseInteger(get(row, 'contractUntil')),
    joined: parseDateFlexible(get(row, 'joined')),
    ratings,
    version: text(get(row, 'version')),
  };
}

/** Keep only the newest game version and, per player, the newest update within it. */
function latestEaRows(
  players: EaPlayer[],
  updates: Map<EaPlayer, number>,
  log: ImportLog,
): EaPlayer[] {
  const versions = [
    ...new Set(players.map((p) => p.version).filter((v): v is string => v !== null)),
  ];
  if (versions.length <= 1 && !players.some((p) => (updates.get(p) ?? 0) > 0))
    return dedupe(players, updates, log);
  const latest =
    versions.sort((a, b) => (parseNumber(a) ?? 0) - (parseNumber(b) ?? 0)).at(-1) ?? null;
  const inLatest = players.filter((p) => p.version === latest || p.version === null);
  log.info(
    'ea.version_filter',
    `Using game version ${latest}: ${inLatest.length} of ${players.length} rows`,
  );
  log.count('ea.rows_other_versions', players.length - inLatest.length);
  return dedupe(inLatest, updates, log);
}

function dedupe(players: EaPlayer[], updates: Map<EaPlayer, number>, log: ImportLog): EaPlayer[] {
  const byId = new Map<string, EaPlayer>();
  for (const p of players) {
    const prev = byId.get(p.sourceId);
    if (!prev) byId.set(p.sourceId, p);
    else {
      log.count('ea.duplicate_rows');
      if ((updates.get(p) ?? 0) >= (updates.get(prev) ?? 0)) byId.set(p.sourceId, p);
    }
  }
  return [...byId.values()];
}

/** Newest game version in a ratings table (by numeric order), or null when it has none. */
async function latestEaVersion(file: string): Promise<string | null> {
  const { header } = await streamCsv(file, () => {}, { limit: 0 });
  if (detectTable(path.basename(file), header) !== 'eaPlayers') return null;
  const versionHeader = (
    resolveColumns(header, TABLES.eaPlayers).map as Record<string, string | null>
  ).version;
  if (!versionHeader) return null;
  let best: string | null = null;
  await streamCsv(file, (row) => {
    const v = (row[versionHeader] ?? '').trim();
    if (v && (best === null || (parseNumber(v) ?? -Infinity) > (parseNumber(best) ?? -Infinity)))
      best = v;
  });
  return best;
}

/** Read every supported CSV under `dir` into typed source records. */
export async function readSources(dir: string, log: ImportLog): Promise<SourceData> {
  const data: SourceData = {
    ea: [],
    tm: { players: [], clubs: [], competitions: [], transfers: [], valuations: [] },
    eaColumns: [],
    files: [],
  };
  const eaColumns = new Set<string>();
  const eaUpdates = new Map<EaPlayer, number>();
  for (const file of walkCsv(dir)) {
    const rel = path.relative(dir, file).replace(/\\/g, '/');
    let kind: TableKind | null = null;
    let get: Getter = () => '';
    let accepted = 0;
    let resolvedOnce = false;
    // Skip tables the importer doesn't use without reading them (match logs can be 400 MB+).
    const peek = await streamCsv(file, () => {}, { limit: 0 });
    if (!detectTable(path.basename(file), peek.header)) {
      log.info(
        'source.file_not_used',
        `${rel}: not used (${isWomensTable(path.basename(file)) ? "women's table" : 'not a table the importer reads'})`,
        { file: rel },
      );
      data.files.push({
        path: rel,
        table: 'not used',
        rows: 0,
        accepted: 0,
        encoding: peek.encoding,
      });
      continue;
    }
    // Ratings tables can hold ~10 game versions (180k rows): find the newest version in a cheap
    // first pass so only its rows are parsed into records.
    const latestVersion = await latestEaVersion(file);
    const result = await streamCsv(file, (row, i) => {
      if (!resolvedOnce) {
        resolvedOnce = true;
        const header = Object.keys(row);
        kind = detectTable(path.basename(file), header);
        if (kind) {
          const { map } = resolveColumns(header, TABLES[kind]);
          const m = map as Record<string, string | null>;
          if (kind === 'eaPlayers') for (const [k, h] of Object.entries(m)) if (h) eaColumns.add(k);
          get = (r, key) => {
            const h = m[key];
            return h ? (r[h] ?? '') : '';
          };
        }
      }
      if (!kind) return;
      const where = { file: rel, row: i + 2 };
      switch (kind) {
        case 'eaPlayers': {
          if (
            latestVersion !== null &&
            text(get(row, 'version')) !== null &&
            get(row, 'version').trim() !== latestVersion
          ) {
            log.count('ea.rows_other_versions');
            return;
          }
          const p = parseEa(get, row, i, rel, log);
          if (p) {
            data.ea.push(p);
            eaUpdates.set(p, parseNumber(get(row, 'update')) ?? 0);
            accepted++;
          }
          break;
        }
        case 'tmPlayers': {
          const id = text(get(row, 'sourceId'));
          const name = text(get(row, 'name'));
          if (!id || !name)
            return log.error(
              'tm.player_missing_id_or_name',
              'Player row without id or name',
              where,
            );
          data.tm.players.push({
            sourceId: id,
            name,
            firstName: text(get(row, 'firstName')),
            lastName: text(get(row, 'lastName')),
            dob: parseDateFlexible(get(row, 'dob')),
            nationality: text(get(row, 'nationality')),
            position: text(get(row, 'position')),
            subPosition: text(get(row, 'subPosition')),
            foot: footOf(get(row, 'foot')),
            heightCm: parseInteger(get(row, 'heightCm')),
            contractEnd: parseDateFlexible(get(row, 'contractEnd')),
            marketValueEur: parseNumber(get(row, 'marketValueEur')),
            clubSourceId: text(get(row, 'clubId')),
            clubName: text(get(row, 'clubName')),
            competitionId: text(get(row, 'competitionId')),
            lastSeason: parseInteger(get(row, 'lastSeason')),
          });
          accepted++;
          break;
        }
        case 'tmClubs': {
          const id = text(get(row, 'sourceId'));
          const name = text(get(row, 'name'));
          if (!id || !name)
            return log.error('tm.club_missing_id_or_name', 'Club row without id or name', where);
          data.tm.clubs.push({
            sourceId: id,
            name,
            code: text(get(row, 'code')),
            competitionId: text(get(row, 'competitionId')),
            stadiumName: text(get(row, 'stadiumName')),
            stadiumSeats: parseInteger(get(row, 'stadiumSeats')),
            lastSeason: parseInteger(get(row, 'lastSeason')),
          });
          accepted++;
          break;
        }
        case 'tmCompetitions': {
          const id = text(get(row, 'sourceId'));
          const name = text(get(row, 'name'));
          if (!id || !name)
            return log.error(
              'tm.competition_missing_id_or_name',
              'Competition row without id or name',
              where,
            );
          data.tm.competitions.push({
            sourceId: id,
            name,
            country: text(get(row, 'country')),
            type: text(get(row, 'type')),
            subType: text(get(row, 'subType')),
          });
          accepted++;
          break;
        }
        case 'tmTransfers': {
          const playerId = text(get(row, 'playerId'));
          const date = parseDateFlexible(get(row, 'date'));
          if (!playerId || date === null)
            return log.error(
              'tm.transfer_invalid',
              'Transfer row without player id or valid date',
              where,
            );
          data.tm.transfers.push({
            playerId,
            date,
            season: text(get(row, 'season')),
            fromClubId: text(get(row, 'fromClubId')),
            toClubId: text(get(row, 'toClubId')),
            fromClubName: text(get(row, 'fromClubName')),
            toClubName: text(get(row, 'toClubName')),
            feeEur: parseNumber(get(row, 'fee')),
            marketValueEur: parseNumber(get(row, 'marketValueEur')),
            type: text(get(row, 'type')),
          });
          accepted++;
          break;
        }
        case 'tmValuations': {
          const playerId = text(get(row, 'playerId'));
          const date = parseDateFlexible(get(row, 'date'));
          const valueEur = parseNumber(get(row, 'valueEur'));
          if (!playerId || date === null || valueEur === null || valueEur < 0) {
            return log.error(
              'tm.valuation_invalid',
              'Valuation row without player id, date or value',
              where,
            );
          }
          data.tm.valuations.push({ playerId, date, valueEur, clubId: text(get(row, 'clubId')) });
          accepted++;
          break;
        }
      }
    });
    if (!resolvedOnce) kind = detectTable(path.basename(file), result.header);
    if (!kind) {
      log.info(
        'source.file_not_used',
        `${rel}: not used (${isWomensTable(path.basename(file)) ? "women's table" : 'not a table the importer reads'})`,
        { file: rel },
      );
    } else if (result.rows === 0) {
      log.warn('source.empty_file', `${rel}: no data rows`, { file: rel });
    }
    data.files.push({
      path: rel,
      table: kind ?? 'unrecognised',
      rows: result.rows,
      accepted,
      encoding: result.encoding,
    });
    if (result.encoding === 'latin1')
      log.warn('source.latin1', `${rel}: not valid UTF-8, read as Latin-1`, { file: rel });
  }
  data.ea = latestEaRows(data.ea, eaUpdates, log);
  data.eaColumns = [...eaColumns].sort();
  return data;
}
