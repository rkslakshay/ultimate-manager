import { ageOn, ATTRIBUTE_KEYS, POSITIONS, type ValueFit, type WorldState } from '@um/engine';
import type { PackDiff } from './diff';
import type { ImportLog, LogEntry } from './log';
import type { CalibrationResult } from './mapping/ability';
import type { ClubMatching, PlayerMatching } from './matching';
import type { PackSummary, SourceFileInfo } from './pack-format';

export interface Stats {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export function stats(values: number[]): Stats {
  const s = [...values].sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor((s.length - 1) * f))] ?? 0;
  return {
    n: s.length,
    min: s[0] ?? 0,
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    max: s.at(-1) ?? 0,
  };
}

export interface QualityReport {
  pack: string;
  status: 'ok' | 'failed' | 'dry-run';
  version: string | null;
  startedAt: string;
  durationMs: number;
  sourceDir: string;
  files: SourceFileInfo[];
  matching: {
    players: Record<string, number>;
    ambiguous: number;
    fuzzyCandidates: { ea: string; tm: string; score: number }[];
    conflicts: Record<string, number>;
    conflictExamples: string[];
    clubs: Record<string, number>;
    unmatchedClubs: string[];
  } | null;
  dropped: Record<string, number>;
  provenance: {
    attributeOrigin: Record<string, number>;
    alwaysDerivedAttributes: string[];
    playerFields: Record<string, Record<string, number>>;
    clubFields: Record<string, Record<string, number>>;
  } | null;
  distributions: {
    abilityByTier: Record<string, Stats>;
    valueByTier: Record<string, Stats>;
    ageImported: Stats;
    positions: Record<string, number>;
  } | null;
  calibration: CalibrationResult | null;
  valueModel: Omit<ValueFit, 'model'> | null;
  summary: PackSummary | null;
  diff: PackDiff | null;
  counts: Record<string, number>;
  entries: LogEntry[];
  errors: string[];
}

export function matchingSection(
  players: PlayerMatching,
  clubs: ClubMatching,
): QualityReport['matching'] {
  const byMethod: Record<string, number> = {};
  for (const p of players.pairs) byMethod[p.method] = (byMethod[p.method] ?? 0) + 1;
  byMethod.ratings_unmatched = players.eaUnmatched.length;
  byMethod.transfermarkt_unmatched = players.tmUnmatched.length;
  byMethod.ratings_without_dob = players.eaWithoutDob;
  const conflicts: Record<string, number> = {};
  for (const c of players.conflicts) conflicts[c.field] = (conflicts[c.field] ?? 0) + 1;
  const clubMethods: Record<string, number> = { unmatched: clubs.unmatched.length };
  for (const m of clubs.byEaClub.values()) clubMethods[m.method] = (clubMethods[m.method] ?? 0) + 1;
  return {
    players: byMethod,
    ambiguous: players.ambiguous.length,
    fuzzyCandidates: players.candidates.slice(0, 50).map((c) => ({
      ea: `${c.ea.name} (${c.ea.sourceId})`,
      tm: `${c.tm.name} (${c.tm.sourceId})`,
      score: c.score,
    })),
    conflicts,
    conflictExamples: players.conflicts
      .slice(0, 20)
      .map((c) => `${c.ea.name}: ${c.field} ${c.eaValue} vs ${c.tmValue}`),
    clubs: clubMethods,
    unmatchedClubs: clubs.unmatched.slice(0, 100),
  };
}

export function worldSections(
  world: WorldState,
): Pick<QualityReport, 'provenance' | 'distributions'> {
  const imported = world.players.filter((p) => p.origin === 'imported');
  const attributeOrigin: Record<string, number> = { S: 0, F: 0, D: 0 };
  const playerFields: Record<string, Record<string, number>> = {};
  const alwaysDerived = new Set<string>(ATTRIBUTE_KEYS);
  for (const p of imported) {
    const origin = p.source?.attributeOrigin ?? '';
    [...origin].forEach((c, i) => {
      attributeOrigin[c] = (attributeOrigin[c] ?? 0) + 1;
      if (c !== 'D') alwaysDerived.delete(ATTRIBUTE_KEYS[i]!);
    });
    for (const [f, status] of Object.entries(p.source?.fields ?? {})) {
      playerFields[f] ??= {};
      playerFields[f][status] = (playerFields[f][status] ?? 0) + 1;
    }
  }
  const clubFields: Record<string, Record<string, number>> = {};
  for (const c of world.clubs) {
    for (const [f, status] of Object.entries(c.source?.fields ?? {})) {
      clubFields[f] ??= {};
      clubFields[f][status] = (clubFields[f][status] ?? 0) + 1;
    }
  }
  const tierOf = new Map<number, number>();
  for (const comp of world.competitions)
    if (comp.kind === 'league') for (const id of comp.clubIds) tierOf.set(id, comp.tier ?? 0);
  const byTier = (pick: (p: (typeof imported)[number]) => number) => {
    const groups: Record<string, number[]> = {};
    for (const p of imported) {
      const t = `tier ${tierOf.get(p.clubId ?? -1) ?? '?'}`;
      (groups[t] ??= []).push(pick(p));
    }
    return Object.fromEntries(
      Object.entries(groups)
        .sort()
        .map(([k, v]) => [k, stats(v)]),
    );
  };
  const positions: Record<string, number> = {};
  for (const p of imported)
    positions[POSITIONS[p.primaryPosition]!] = (positions[POSITIONS[p.primaryPosition]!] ?? 0) + 1;
  return {
    provenance: {
      attributeOrigin,
      alwaysDerivedAttributes: [...alwaysDerived],
      playerFields,
      clubFields,
    },
    distributions: {
      abilityByTier: byTier((p) => p.ca),
      valueByTier: byTier((p) => p.value),
      ageImported: stats(imported.map((p) => ageOn(p.birthDay, world.startDay))),
      positions,
    },
  };
}

export function logSection(
  log: ImportLog,
): Pick<QualityReport, 'counts' | 'entries' | 'dropped' | 'errors'> {
  const counts = Object.fromEntries([...log.counts.entries()].sort());
  return {
    counts,
    entries: log.entries,
    dropped: Object.fromEntries(Object.entries(counts).filter(([k]) => k.startsWith('drop.'))),
    errors: log.entries
      .filter((e) => e.level === 'error')
      .map(
        (e) => `${e.code}: ${e.message}${e.file ? ` (${e.file}${e.row ? `:${e.row}` : ''})` : ''}`,
      ),
  };
}

const fmtStats = (s: Stats, money = false) => {
  const f = (v: number) => (money ? `€${(v / 1e6).toFixed(1)}M` : String(Math.round(v)));
  return `n=${s.n} · min ${f(s.min)} · p25 ${f(s.p25)} · median ${f(s.median)} · p75 ${f(s.p75)} · max ${f(s.max)}`;
};
const table = (rec: Record<string, number>) =>
  Object.entries(rec)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n');

export function reportMarkdown(r: QualityReport): string {
  const out: string[] = [
    `# Data import report: ${r.pack}`,
    '',
    `- **Status:** ${r.status}${r.version ? ` · version \`${r.version}\`` : ''}`,
    `- **Started:** ${r.startedAt} · **Duration:** ${(r.durationMs / 1000).toFixed(1)} s`,
    `- **Source folder:** \`${r.sourceDir}\``,
    '',
    '> Records *processed* are not records *verified*. Source data can be wrong or stale; this',
    '> report shows what was read, matched, derived and dropped, not that it is correct.',
    '',
    '## Files',
    '',
    '| File | Table | Rows | Accepted | Encoding |',
    '| --- | --- | --- | --- | --- |',
    ...r.files.map((f) => `| ${f.path} | ${f.table} | ${f.rows} | ${f.accepted} | ${f.encoding} |`),
  ];
  if (!r.files.length) out.push('', '**No source files found.**');
  if (r.errors.length) out.push('', '## Errors', '', ...r.errors.slice(0, 50).map((e) => `- ${e}`));
  if (r.summary) {
    out.push(
      '',
      '## Imported',
      '',
      `${r.summary.nations} nations · ${r.summary.clubs} clubs · ${r.summary.players.imported} imported players · ${r.summary.players.generated} generated players · ${r.summary.transfers} historical transfers · ${r.summary.valuations} valuations`,
      '',
    );
    out.push(
      '| League | Nation | Tier | Clubs | Imported players | Generated fillers |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const l of r.summary.leagues)
      out.push(
        `| ${l.name} | ${l.nation} | ${l.tier} | ${l.clubs} | ${l.importedPlayers} | ${l.generatedPlayers} |`,
      );
  }
  if (r.matching) {
    out.push(
      '',
      '## Identity matching',
      '',
      '| Players | Count |',
      '| --- | --- |',
      table(r.matching.players),
      `| ambiguous (not merged) | ${r.matching.ambiguous} |`,
    );
    out.push('', '| Clubs | Count |', '| --- | --- |', table(r.matching.clubs));
    if (Object.keys(r.matching.conflicts).length)
      out.push(
        '',
        'Identity conflicts kept for review:',
        '',
        table(r.matching.conflicts),
        '',
        ...r.matching.conflictExamples.map((e) => `- ${e}`),
      );
    if (r.matching.fuzzyCandidates.length) {
      out.push(
        '',
        'Fuzzy candidates (NOT merged; approve in config `identity.approve` if correct):',
        '',
        ...r.matching.fuzzyCandidates.map((c) => `- ${c.ea} ↔ ${c.tm} (similarity ${c.score})`),
      );
    }
    if (r.matching.unmatchedClubs.length)
      out.push(
        '',
        `Unmatched clubs (${r.matching.unmatchedClubs.length}): ${r.matching.unmatchedClubs.join(', ')}`,
      );
  }
  if (Object.keys(r.dropped).length)
    out.push('', '## Dropped records', '', '| Reason | Count |', '| --- | --- |', table(r.dropped));
  if (r.provenance) {
    const total = Object.values(r.provenance.attributeOrigin).reduce((a, b) => a + b, 0) || 1;
    out.push(
      '',
      '## Provenance',
      '',
      'Attribute values by origin (S source, F coarse source fallback, D derived):',
      '',
    );
    for (const [k, v] of Object.entries(r.provenance.attributeOrigin))
      out.push(`- ${k}: ${v} (${((v / total) * 100).toFixed(1)}%)`);
    out.push(
      '',
      `Attributes always derived (no source equivalent): ${r.provenance.alwaysDerivedAttributes.join(', ')}`,
      '',
      '| Player field | Status counts |',
      '| --- | --- |',
    );
    for (const [f, s] of Object.entries(r.provenance.playerFields))
      out.push(
        `| ${f} | ${Object.entries(s)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')} |`,
      );
    out.push('', '| Club field | Status counts |', '| --- | --- |');
    for (const [f, s] of Object.entries(r.provenance.clubFields))
      out.push(
        `| ${f} | ${Object.entries(s)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')} |`,
      );
  }
  if (r.distributions) {
    out.push(
      '',
      '## Distributions (imported players)',
      '',
      'Current Ability by tier:',
      '',
      ...Object.entries(r.distributions.abilityByTier).map(([t, s]) => `- ${t}: ${fmtStats(s)}`),
    );
    out.push(
      '',
      'Market value by tier:',
      '',
      ...Object.entries(r.distributions.valueByTier).map(
        ([t, s]) => `- ${t}: ${fmtStats(s, true)}`,
      ),
    );
    out.push(
      '',
      `Age: ${fmtStats(r.distributions.ageImported)}`,
      '',
      `Primary positions: ${Object.entries(r.distributions.positions)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
    );
  }
  if (r.calibration) {
    out.push(
      '',
      '## Ability calibration',
      '',
      `Offset ${r.calibration.offset} attribute points · median CA error ${r.calibration.medianError} · mean absolute error ${r.calibration.meanAbsError.toFixed(1)} · correlation with source overall ${r.calibration.correlation.toFixed(3)} (n=${r.calibration.samples})`,
    );
  }
  out.push(
    '',
    '## Value model',
    '',
    r.valueModel
      ? `Fitted on ${r.valueModel.samples} source values · R² (log) ${r.valueModel.r2.toFixed(3)} · median absolute error ${(r.valueModel.medianAbsPctError * 100).toFixed(1)}%`
      : 'Not fitted (fewer than 30 source-backed values).',
  );
  if (r.diff) {
    const d = r.diff;
    out.push(
      '',
      `## Changes since ${d.previousVersion}`,
      '',
      `Players: +${d.players.added} / −${d.players.removed} · club changed ${d.players.clubChanged} · ability changed ${d.players.abilityChanged} · value changed ${d.players.valueChanged} · contract changed ${d.players.contractChanged}`,
      `Clubs: +${d.clubs.added} / −${d.clubs.removed} · renamed ${d.clubs.renamed}`,
      '',
      'Existing saves are not modified: each save keeps its own copy of its world (see data-packs/README.md).',
      '',
      ...d.examples.map((e) => `- ${e}`),
    );
  }
  const warnings = r.entries.filter((e) => e.level === 'warning');
  if (warnings.length)
    out.push(
      '',
      '## Warnings',
      '',
      ...warnings.slice(0, 100).map((e) => `- ${e.code}: ${e.message}`),
    );
  out.push('', '## All counters', '', '| Counter | Value |', '| --- | --- |', table(r.counts));
  return out.join('\n');
}
