import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  civilFromDay,
  dayFromCivil,
  DEFAULT_START_DATE,
  parseIsoDate,
  toIsoDate,
  type DayNumber,
} from '@um/engine';
import { buildRealWorld, SCALE } from './assemble';
import type { BuildContext } from './assemble/context';
import { loadImportConfig, toEur, type ImportConfig } from './config';
import { diffWorlds } from './diff';
import { IdentityMap } from './identity';
import { ImportLog } from './log';
import { matchClubs, matchPlayers } from './matching';
import {
  IMPORTER_VERSION,
  manifestFile,
  PACK_FORMAT_VERSION,
  packDir,
  readPack,
  type DataPack,
  type PackManifest,
  type SourceFileInfo,
} from './pack-format';
import { packPaths, REPO_ROOT } from './paths';
import {
  logSection,
  matchingSection,
  reportMarkdown,
  worldSections,
  type QualityReport,
} from './report';
import { readSources } from './sources/read';
import type { SourceData } from './sources/records';
import { validateWorld } from './validate';

export interface ImportOptions {
  pack: string;
  dryRun?: boolean;
  /** data-packs root (default: repo data-packs or DATA_PACKS_DIR). */
  root?: string;
  /** Override where source CSVs are read from. */
  sourceDir?: string;
  /** Override the config file (null = defaults only). */
  configFile?: string | null;
  quiet?: boolean;
}

const PACK_SOURCES: Record<
  string,
  { dir: (raw: string) => string; config: (cfgDir: string) => string; label: string }
> = {
  real: {
    dir: (raw) => raw,
    config: (c) => path.join(c, 'import.json'),
    label: 'Real world (your datasets)',
  },
  sample: {
    dir: () => path.join(REPO_ROOT, 'data-packs', 'fixtures', 'sample', 'data'),
    config: () => path.join(REPO_ROOT, 'data-packs', 'fixtures', 'sample', 'import.json'),
    label: 'Sample (fictional test fixture)',
  },
};

/** Streaming SHA-256 (source files can be hundreds of MB). */
async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file, { highWaterMark: 1 << 20 }))
    hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function convertCurrencies(data: SourceData, config: ImportConfig) {
  const { ea, tm } = config.sourceCurrency;
  if (ea.toUpperCase() !== 'EUR') {
    for (const p of data.ea) {
      p.valueEur = toEur(p.valueEur, ea, config);
      p.wageEur = toEur(p.wageEur, ea, config);
      p.releaseClauseEur = toEur(p.releaseClauseEur, ea, config);
    }
  }
  if (tm.toUpperCase() !== 'EUR') {
    for (const p of data.tm.players) p.marketValueEur = toEur(p.marketValueEur, tm, config);
    for (const t of data.tm.transfers) {
      t.feeEur = toEur(t.feeEur, tm, config);
      t.marketValueEur = toEur(t.marketValueEur, tm, config);
    }
    for (const v of data.tm.valuations) v.valueEur = toEur(v.valueEur, tm, config)!;
  }
}

/** Career start: config, else the season containing the newest valuation, else the default. */
function startDayFor(data: SourceData, config: ImportConfig, log: ImportLog): DayNumber {
  if (config.startDate) return parseIsoDate(config.startDate);
  let latest: DayNumber | null = null;
  for (const v of data.tm.valuations) if (latest === null || v.date > latest) latest = v.date;
  if (latest !== null) {
    const { year, month } = civilFromDay(latest);
    const start = dayFromCivil(month >= 7 ? year : year - 1, 7, 1);
    log.info(
      'start_date.inferred',
      `Career start ${toIsoDate(start)} (season of the newest valuation, ${toIsoDate(latest)})`,
    );
    return start;
  }
  log.warn(
    'start_date.defaulted',
    `No valuation dates to infer the season from; using ${DEFAULT_START_DATE} (set "startDate" in the config)`,
  );
  return parseIsoDate(DEFAULT_START_DATE);
}

/** Build a pack and its quality report. Writes nothing; see runImport for persistence. */
export async function buildPack(
  opts: ImportOptions,
): Promise<{ report: QualityReport; pack: DataPack | null; identity: IdentityMap | null }> {
  const started = Date.now();
  const paths = packPaths(opts.root);
  const def = PACK_SOURCES[opts.pack];
  const log = new ImportLog();
  const sourceDir = opts.sourceDir ?? (def ? def.dir(paths.raw) : paths.raw);
  const report: QualityReport = {
    pack: opts.pack,
    status: 'failed',
    version: null,
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    sourceDir,
    files: [],
    matching: null,
    dropped: {},
    provenance: null,
    distributions: null,
    calibration: null,
    valueModel: null,
    summary: null,
    diff: null,
    counts: {},
    entries: [],
    errors: [],
  };
  const finish = (pack: DataPack | null, identity: IdentityMap | null) => {
    Object.assign(report, logSection(log));
    report.durationMs = Date.now() - started;
    return { report, pack, identity };
  };

  if (!def && !opts.sourceDir) {
    log.error('pack.unknown', `Unknown pack "${opts.pack}" (use real or sample)`);
    return finish(null, null);
  }
  let config: ImportConfig;
  try {
    config = loadImportConfig(
      opts.configFile === undefined ? (def?.config(paths.config) ?? null) : opts.configFile,
    );
  } catch (err) {
    log.error('config.invalid', (err as Error).message);
    return finish(null, null);
  }
  if (!fs.existsSync(sourceDir)) {
    log.error(
      'source.missing_folder',
      `Source folder ${sourceDir} does not exist. See data-packs/README.md.`,
    );
    return finish(null, null);
  }
  const data = await readSources(sourceDir, log);
  report.files = await Promise.all(
    data.files.map(async (f) => ({
      ...f,
      sha256: f.table === 'not used' ? '' : await sha256(path.join(sourceDir, f.path)),
    })),
  );
  if (!data.files.length) {
    log.error(
      'source.no_files',
      `No CSV files in ${sourceDir}. See data-packs/README.md for what to put there.`,
    );
    return finish(null, null);
  }
  if (!data.ea.length) {
    log.error(
      'source.no_ratings',
      'No player ratings table was found (a table with overall and potential columns is required).',
    );
    return finish(null, null);
  }
  try {
    convertCurrencies(data, config);
  } catch (err) {
    log.error('currency.missing_rate', (err as Error).message);
    return finish(null, null);
  }

  const players = matchPlayers(data.ea, data.tm.players, config);
  const clubs = matchClubs(data.ea, data.tm.clubs, players.pairs, config);
  report.matching = matchingSection(players, clubs);
  const eaClubKeyByTm = new Map<string, string>();
  for (const [key, m] of clubs.byEaClub) eaClubKeyByTm.set(m.tm.sourceId, key);
  const identityFile = path.join(packDir(paths.processed, opts.pack), 'identity-map.json');
  const ids = IdentityMap.load(identityFile);
  const ctx: BuildContext = {
    config,
    log,
    ids,
    startDay: startDayFor(data, config, log),
    data,
    players,
    clubs,
    tmByEa: new Map(players.pairs.map((p) => [p.ea.sourceId, p.tm])),
    tmClubById: new Map(data.tm.clubs.map((c) => [c.sourceId, c])),
    tmCompetitionById: new Map(data.tm.competitions.map((c) => [c.sourceId, c])),
    eaClubKeyByTm,
  };
  const built = buildRealWorld(ctx);
  report.calibration = built.calibration;
  report.valueModel = built.valueFit
    ? {
        r2: built.valueFit.r2,
        medianAbsPctError: built.valueFit.medianAbsPctError,
        samples: built.valueFit.samples,
      }
    : null;
  report.summary = built.summary;
  Object.assign(report, worldSections(built.world));

  if (!built.world.clubs.length) {
    log.error(
      'build.no_clubs',
      'No league met the inclusion rules (see minClubsPerLeague / includeLeagues in the config).',
    );
    return finish(null, null);
  }
  for (const problem of validateWorld(built.world)) log.error('validate.world', problem);
  if (log.get('validate.world')) return finish(null, null);

  const content = JSON.stringify({
    importer: IMPORTER_VERSION,
    world: built.world,
    t: built.transfers,
    v: built.valuations,
  });
  const version = `v${createHash('sha256').update(content).digest('hex').slice(0, 12)}`;
  built.world.seed = `${opts.pack}:${version}`;
  const sources: SourceFileInfo[] = report.files;
  const pack: DataPack = {
    format: 'um-data-pack',
    formatVersion: PACK_FORMAT_VERSION,
    pack: opts.pack,
    version,
    createdAt: new Date().toISOString(),
    importerVersion: IMPORTER_VERSION,
    baseCurrency: 'EUR',
    startDate: toIsoDate(built.world.startDay),
    label: def?.label ?? opts.pack,
    sources,
    calibration: { ...built.calibration, ...SCALE },
    valueModel: built.valueFit,
    world: built.world,
    history: { transfers: built.transfers, valuations: built.valuations },
    summary: built.summary,
  };
  report.version = version;
  if (fs.existsSync(manifestFile(paths.processed, opts.pack))) {
    try {
      const prev = readPack(paths.processed, opts.pack);
      if (prev.version !== version) report.diff = diffWorlds(prev.world, pack.world, prev.version);
    } catch (err) {
      log.warn(
        'diff.previous_unreadable',
        `Previous pack could not be read for comparison: ${(err as Error).message}`,
      );
    }
  }
  report.status = opts.dryRun ? 'dry-run' : 'ok';
  return finish(pack, ids);
}

export function writePack(root: string | undefined, pack: DataPack, identity: IdentityMap): string {
  const paths = packPaths(root);
  const dir = packDir(paths.processed, pack.pack);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${pack.version}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify(pack));
  const manifest: PackManifest = {
    pack: pack.pack,
    label: pack.label,
    version: pack.version,
    file,
    startDate: pack.startDate,
    createdAt: pack.createdAt,
    summary: pack.summary,
  };
  fs.writeFileSync(manifestFile(paths.processed, pack.pack), JSON.stringify(manifest, null, 2));
  identity.save(path.join(dir, 'identity-map.json'));
  return path.join(dir, file);
}

export function writeReport(root: string | undefined, report: QualityReport): string {
  const paths = packPaths(root);
  fs.mkdirSync(paths.reports, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-').slice(0, 19);
  const base = path.join(paths.reports, `import-${report.pack}-${stamp}`);
  const md = reportMarkdown(report);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${base}.md`, md);
  fs.writeFileSync(path.join(paths.reports, `latest-${report.pack}.md`), md);
  return `${base}.md`;
}

/** CLI entry: build, validate, write pack (unless dry run) and report. */
export async function runImport(opts: ImportOptions): Promise<boolean> {
  const { report, pack, identity } = await buildPack(opts);
  let packFile: string | null = null;
  if (pack && identity && !opts.dryRun) packFile = writePack(opts.root, pack, identity);
  const reportFile = writeReport(opts.root, report);
  if (!opts.quiet) {
    if (pack) {
      const s = pack.summary;
      console.log(
        `${opts.dryRun ? 'Dry run OK' : 'Imported'} ${pack.pack} ${pack.version}: ${s.leagues.length} leagues, ${s.clubs} clubs, ${s.players.imported} imported + ${s.players.generated} generated players, ${s.transfers} transfers, ${s.valuations} valuations (${(report.durationMs / 1000).toFixed(1)} s)`,
      );
      if (packFile) console.log(`Pack: ${path.relative(process.cwd(), packFile)}`);
    } else {
      console.error(`Import failed. ${report.errors.slice(0, 5).join('\n')}`);
    }
    console.log(`Report: ${path.relative(process.cwd(), reportFile)}`);
  }
  return pack !== null;
}
