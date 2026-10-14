import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildPack, runImport } from '../src/run-import';
import { listPacks, readPack } from '../src/pack-format';
import { REPO_ROOT } from '../src/paths';

const FIXTURES = path.join(REPO_ROOT, 'data-packs', 'fixtures', 'sample', 'data');
const FIXTURE_CONFIG = path.join(REPO_ROOT, 'data-packs', 'fixtures', 'sample', 'import.json');
const roots: string[] = [];
const newRoot = () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'um-packs-'));
  roots.push(r);
  return r;
};
afterAll(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

const sample = (root: string, over: object = {}) =>
  buildPack({ pack: 'sample', root, sourceDir: FIXTURES, configFile: FIXTURE_CONFIG, ...over });

describe('importer on the fictional fixture dataset', () => {
  it('builds a valid, deterministic pack', async () => {
    const a = await sample(newRoot());
    const b = await sample(newRoot());
    expect(a.report.status).toBe('ok');
    expect(a.pack).not.toBeNull();
    expect(a.pack!.version).toBe(b.pack!.version);
    expect(JSON.stringify(a.pack!.world)).toBe(JSON.stringify(b.pack!.world));
    const s = a.pack!.summary;
    expect(s.leagues.map((l) => l.name).sort()).toEqual([
      'Northland Championship',
      'Northland Premier',
      'Southmoor Liga',
    ]);
    expect(s.clubs).toBe(24);
    expect(s.players.imported).toBeGreaterThan(300);
  });

  it('reports rejections, ambiguity, fuzzy candidates, conflicts and exclusions', async () => {
    const { report } = await sample(newRoot());
    expect(report.errors.map((e) => e.split(':')[0])).toEqual(
      expect.arrayContaining(['ea.bad_overall', 'ea.missing_positions']),
    );
    expect(report.matching!.ambiguous).toBe(2);
    expect(report.matching!.fuzzyCandidates).toHaveLength(1);
    expect(report.matching!.conflicts.nationality).toBe(1);
    expect(report.dropped['drop.player_league_not_included']).toBeGreaterThan(0);
    expect(report.counts['league.nation_derived']).toBe(1);
    expect(report.counts['contract.expired_before_start']).toBe(1);
  });

  it('keeps imported and generated players distinct with field provenance', async () => {
    const { pack } = await sample(newRoot());
    const imported = pack!.world.players.filter((p) => p.origin === 'imported');
    const generated = pack!.world.players.filter((p) => p.origin === 'generated');
    expect(generated.length).toBeGreaterThan(0);
    for (const p of generated) expect(p.source).toBeNull();
    for (const p of imported) {
      expect(p.source!.key).toMatch(/^ea:\d+/);
      expect(p.source!.attributeOrigin).toHaveLength(p.attributes.length);
      expect(p.source!.fields.ability).toBe('derived');
    }
    // Every club can field a squad.
    for (const c of pack!.world.clubs)
      expect(pack!.world.players.filter((p) => p.clubId === c.id).length).toBeGreaterThanOrEqual(
        18,
      );
  });

  it('keeps unknown transfer fees unknown, zero as reported, and loans as stated', async () => {
    const { pack } = await sample(newRoot());
    const t = pack!.history.transfers;
    const unknown = t.filter((x) => x.feeStatus === 'unknown');
    expect(unknown.length).toBeGreaterThan(0);
    for (const x of unknown) expect(x.feeEur).toBeNull();
    for (const x of t.filter((x) => x.feeStatus === 'zero_reported')) expect(x.feeEur).toBe(0);
    for (const x of t.filter((x) => x.feeStatus === 'paid')) expect(x.feeEur).toBeGreaterThan(0);
    expect(t.some((x) => x.type === 'loan')).toBe(true);
    expect(pack!.history.valuations.length).toBeGreaterThan(0);
  });

  it('places tier-1 players above tier-2 players and calibrates CA to the source overall', async () => {
    const { report } = await sample(newRoot());
    expect(report.distributions!.abilityByTier['tier 1']!.median).toBeGreaterThan(
      report.distributions!.abilityByTier['tier 2']!.median,
    );
    expect(report.calibration!.correlation).toBeGreaterThan(0.8);
    expect(Math.abs(report.calibration!.medianError)).toBeLessThanOrEqual(3);
    expect(report.valueModel!.r2).toBeGreaterThan(0.6);
  });
});

describe('writing, reading and re-importing packs', () => {
  it('writes a versioned pack, keeps ids stable across re-imports, and reports changes', async () => {
    const root = newRoot();
    expect(
      await runImport({
        pack: 'sample',
        root,
        sourceDir: FIXTURES,
        configFile: FIXTURE_CONFIG,
        quiet: true,
      }),
    ).toBe(true);
    const first = readPack(path.join(root, 'processed'), 'sample');
    expect(listPacks(path.join(root, 'processed')).map((m) => m.version)).toEqual([first.version]);

    // A newer dataset: drop one club's ratings rows and change a player's club.
    const changed = path.join(root, 'changed');
    fs.cpSync(FIXTURES, changed, { recursive: true });
    const ratings = path.join(changed, 'ratings', 'players.csv');
    const lines = fs.readFileSync(ratings, 'utf8').split('\r\n');
    fs.writeFileSync(
      ratings,
      [lines[0], ...lines.slice(1).filter((_, i) => i % 50 !== 7)].join('\r\n'),
    );
    expect(
      await runImport({
        pack: 'sample',
        root,
        sourceDir: changed,
        configFile: FIXTURE_CONFIG,
        quiet: true,
      }),
    ).toBe(true);
    const second = readPack(path.join(root, 'processed'), 'sample');
    expect(second.version).not.toBe(first.version);
    // The previous version stays on disk for saves that still reference it.
    expect(readPack(path.join(root, 'processed'), 'sample', first.version).version).toBe(
      first.version,
    );
    // Same source key → same canonical id.
    const idsBefore = new Map(
      first.world.players.filter((p) => p.source).map((p) => [p.source!.key, p.id]),
    );
    for (const p of second.world.players.filter((x) => x.source)) {
      if (idsBefore.has(p.source!.key)) expect(p.id).toBe(idsBefore.get(p.source!.key));
    }
    const latest = fs.readFileSync(path.join(root, 'reports', 'latest-sample.md'), 'utf8');
    expect(latest).toMatch(/Changes since v/);
    expect(latest).toMatch(/Players: \+0 \/ −\d+/);
  });

  it('dry runs write a report but no pack', async () => {
    const root = newRoot();
    expect(
      await runImport({
        pack: 'sample',
        root,
        sourceDir: FIXTURES,
        configFile: FIXTURE_CONFIG,
        dryRun: true,
        quiet: true,
      }),
    ).toBe(true);
    expect(listPacks(path.join(root, 'processed'))).toEqual([]);
    expect(fs.existsSync(path.join(root, 'reports', 'latest-sample.md'))).toBe(true);
  });
});

describe('failure handling', () => {
  it('fails clearly with no folder, no files, or no ratings table', async () => {
    const root = newRoot();
    const missing = await buildPack({ pack: 'real', root, configFile: null });
    expect(missing.report.status).toBe('failed');
    expect(missing.report.errors[0]).toMatch(/does not exist|No CSV files/);

    fs.mkdirSync(path.join(root, 'raw'), { recursive: true });
    expect((await buildPack({ pack: 'real', root, configFile: null })).report.errors[0]).toMatch(
      /No CSV files/,
    );

    fs.writeFileSync(path.join(root, 'raw', 'clubs.csv'), 'club_id,name\n1,Alpha\n');
    const noRatings = await buildPack({ pack: 'real', root, configFile: null });
    expect(noRatings.pack).toBeNull();
    expect(noRatings.report.errors.join()).toMatch(/No player ratings table/);
  });

  it('rejects an invalid config and missing exchange rates', async () => {
    const root = newRoot();
    const cfg = path.join(root, 'bad.json');
    fs.writeFileSync(cfg, JSON.stringify({ minClubsPerLeague: 'many' }));
    expect((await sample(root, { configFile: cfg })).report.errors.join()).toMatch(
      /Invalid import config/,
    );
    fs.writeFileSync(cfg, JSON.stringify({ sourceCurrency: { ea: 'GBP', tm: 'EUR' } }));
    expect((await sample(root, { configFile: cfg })).report.errors.join()).toMatch(
      /No exchange rate for GBP/,
    );
    fs.writeFileSync(
      cfg,
      JSON.stringify({
        minClubsPerLeague: 6,
        sourceCurrency: { ea: 'GBP', tm: 'EUR' },
        fxRatesToEur: { GBP: 1.2 },
      }),
    );
    const converted = await sample(root, { configFile: cfg });
    const plain = await sample(root);
    const wage = (r: typeof plain) =>
      r.pack!.world.players.find(
        (p) => p.origin === 'imported' && p.source!.fields.wage === 'source_backed',
      )!.contract!.wage;
    expect(wage(converted)).toBeCloseTo(wage(plain) * 1.2, 0);
  });
});
