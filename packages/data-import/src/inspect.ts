import fs from 'node:fs';
import path from 'node:path';
import { streamCsv } from './csv-stream';
import {
  detectTable,
  EA_PLAYERS,
  isWomensTable,
  resolveColumns,
  TABLES,
  type TableKind,
} from './sources/columns';

export interface FileInventory {
  path: string;
  bytes: number;
  kind: 'csv' | 'documentation' | 'unsupported';
  encoding?: string;
  rows?: number;
  columns?: string[];
  table?: TableKind | null;
  missingRequired?: string[];
  missingOptional?: string[];
  unusedColumns?: string[];
  duplicateIds?: number;
  samples?: Record<string, string>[];
  note?: string;
}

const DOC_RE = /(^readme|^license|^licence|^copying|^notice|\.md$|\.txt$|\.pdf$|\.html?$)/i;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name === '.gitkeep' ? [] : [full];
  });
}

const ID_COLUMN: Partial<Record<TableKind, string>> = {
  eaPlayers: 'sourceId',
  tmPlayers: 'sourceId',
  tmClubs: 'sourceId',
  tmCompetitions: 'sourceId',
};

async function inspectCsv(file: string, rawDir: string): Promise<FileInventory> {
  const samples: Record<string, string>[] = [];
  let header: string[] = [];
  // First pass on a few rows to learn the header and table kind.
  const head = await streamCsv(file, (r) => samples.length < 3 && samples.push(r), { limit: 3 });
  header = head.header;
  const table = detectTable(path.basename(file), header);
  const resolved = table ? resolveColumns(header, TABLES[table]) : null;
  const idKey = table ? ID_COLUMN[table] : undefined;
  const idHeader =
    idKey && resolved ? (resolved.map as Record<string, string | null>)[idKey] : null;
  const versionHeader =
    table === 'eaPlayers' && resolved
      ? (resolved.map as Record<string, string | null>).version
      : null;

  const ids = new Map<string, number>();
  const full = await streamCsv(file, (r) => {
    if (!idHeader) return;
    // EA tables can hold several game versions per player: count duplicates within a version.
    const key = versionHeader ? `${r[versionHeader]}|${r[idHeader]}` : (r[idHeader] ?? '');
    ids.set(key, (ids.get(key) ?? 0) + 1);
  });
  let duplicates = 0;
  for (const n of ids.values()) if (n > 1) duplicates += n - 1;

  return {
    path: path.relative(rawDir, file).replace(/\\/g, '/'),
    bytes: fs.statSync(file).size,
    kind: 'csv',
    encoding: full.encoding,
    rows: full.rows,
    columns: header,
    table,
    missingRequired: resolved?.missingRequired ?? [],
    missingOptional: resolved?.missingOptional ?? [],
    unusedColumns: resolved?.unused ?? [],
    duplicateIds: idHeader ? duplicates : undefined,
    samples: samples.map((s) =>
      Object.fromEntries(
        Object.entries(s)
          .slice(0, 25)
          .map(([k, v]) => [k, v.length > 60 ? `${v.slice(0, 57)}...` : v]),
      ),
    ),
    note: table ? undefined : unusedNote(path.basename(file), header),
  };
}

/** Why a CSV isn't used, in words the user can act on. */
function unusedNote(name: string, header: readonly string[]): string {
  if (isWomensTable(name) && resolveColumns(header, EA_PLAYERS).missingRequired.length === 0) {
    return "Women's players: not imported (the game world is a men's football world)";
  }
  if (/coach|teams?.csv$|national_teams|countries/i.test(name))
    return 'Not used by the importer yet';
  if (/appearances|game_lineups|game_events|club_games|^games.csv$/i.test(name)) {
    return 'Match data: not used yet (needed once matches are simulated)';
  }
  return 'Not recognised as a supported table (see data-packs/README.md for expected file names)';
}

/** Inventory every file under the raw folder. Never modifies anything. */
export async function inspectRaw(rawDir: string): Promise<FileInventory[]> {
  const files = walk(rawDir).sort();
  const out: FileInventory[] = [];
  for (const file of files) {
    const name = path.basename(file);
    const rel = path.relative(rawDir, file).replace(/\\/g, '/');
    const bytes = fs.statSync(file).size;
    if (/\.csv$/i.test(name)) {
      try {
        out.push(await inspectCsv(file, rawDir));
      } catch (err) {
        out.push({
          path: rel,
          bytes,
          kind: 'unsupported',
          note: `Could not read CSV: ${(err as Error).message}`,
        });
      }
    } else if (DOC_RE.test(name)) {
      out.push({
        path: rel,
        bytes,
        kind: 'documentation',
        note: 'Read for licence and provenance details',
      });
    } else {
      const hint = /\.(zip|gz|7z)$/i.test(name)
        ? 'Archive: extract it into data-packs/raw/'
        : /\.(xlsx?|parquet|json|sqlite|db)$/i.test(name)
          ? 'Format not supported yet: export it to CSV'
          : 'Unknown file type';
      out.push({ path: rel, bytes, kind: 'unsupported', note: hint });
    }
  }
  return out;
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export function inventoryMarkdown(items: FileInventory[], rawDir: string): string {
  const lines = [`# Raw data inventory`, '', `Folder: \`${rawDir}\``, ''];
  if (!items.length) {
    lines.push(
      '**No files found.** Put dataset files in this folder (see `data-packs/README.md`). The',
      'real data pack cannot be built until they are present.',
    );
    return lines.join('\n');
  }
  lines.push(
    '| File | Size | Type | Rows | Encoding | Missing required | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const f of items) {
    lines.push(
      `| ${f.path} | ${mb(f.bytes)} | ${f.table ?? f.kind} | ${f.rows ?? ''} | ${f.encoding ?? ''} | ${f.missingRequired?.join(', ') ?? ''} | ${[f.note, f.duplicateIds ? `${f.duplicateIds} duplicate ids` : ''].filter(Boolean).join('; ')} |`,
    );
  }
  for (const f of items.filter((x) => x.kind === 'csv')) {
    lines.push(
      '',
      `## ${f.path}`,
      '',
      `Columns (${f.columns?.length}): ${f.columns?.join(', ')}`,
      '',
    );
    if (f.missingOptional?.length)
      lines.push(`Optional columns not present: ${f.missingOptional.join(', ')}`, '');
    if (f.unusedColumns?.length)
      lines.push(`Columns not used by the importer: ${f.unusedColumns.join(', ')}`, '');
    if (f.samples?.length)
      lines.push('Sample rows:', '', '```json', JSON.stringify(f.samples, null, 1), '```');
  }
  return lines.join('\n');
}
