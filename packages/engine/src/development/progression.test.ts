import { describe, expect, it } from 'vitest';
import { addYears, parseIsoDate } from '../core/date';
import { currentAbility } from '../players/ability';
import { A, GOALKEEPING, PHYSICAL } from '../players/attributes';
import { generatePlayer } from '../players/generate-player';
import { P } from '../players/positions';
import { createRng } from '../rng/rng';
import type { Player } from '../world/types';
import { applyProgression, MONTHLY_CAP, SEASON_CAP, type ProgressionContext } from './progression';

const today = parseIsoDate('2026-09-01');

function player(age: number, ca: number, pa: number, position = P.MC, seed = 'p'): Player {
  const p = generatePlayer(createRng(seed), {
    id: 1,
    nationId: 1,
    flavour: 'anglo',
    position,
    age,
    targetCa: ca,
    referenceDay: today,
  });
  return { ...p, birthDay: addYears(today, -age) - 100, pa: Math.max(pa, p.ca) };
}

const ctx = (over: Partial<ProgressionContext> = {}, seed = 'ctx'): ProgressionContext => ({
  today,
  kind: 'monthly',
  rng: createRng(seed),
  minutesShare: 0.8,
  averageRating: 7,
  trainingQuality: 14,
  injuredDays: 0,
  levelCa: 120,
  ...over,
});

/** Mean CA change over many seeds for a season of 10 monthly + 1 season review. */
function seasonGrowth(p0: Player, over: Partial<ProgressionContext>, runs = 40): number {
  let total = 0;
  for (let r = 0; r < runs; r++) {
    let p = p0;
    for (let m = 0; m < 10; m++)
      p = applyProgression(p, ctx({ ...over, today: today + m * 30 }, `${r}:${m}`)).player;
    p = applyProgression(p, ctx({ ...over, kind: 'season', today: today + 300 }, `${r}:s`)).player;
    total += p.ca - p0.ca;
  }
  return total / runs;
}

describe('applyProgression', () => {
  it('is deterministic for identical inputs and seeds', () => {
    const p = player(19, 100, 160);
    expect(applyProgression(p, ctx())).toEqual(applyProgression(p, ctx()));
  });

  it('keeps attributes in range, respects per-review limits and never changes potential', () => {
    for (const [age, ca, pa] of [
      [17, 60, 190],
      [24, 150, 155],
      [35, 140, 150],
    ] as const) {
      const p = player(age, ca, pa, P.ST, `${age}`);
      for (const kind of ['monthly', 'season'] as const) {
        const r = applyProgression(p, ctx({ kind }));
        for (const v of r.player.attributes) expect(v >= 1 && v <= 20).toBe(true);
        const limit = kind === 'monthly' ? 1 : 2;
        for (const c of r.changes) expect(Math.abs(c.to - c.from)).toBeLessThanOrEqual(limit);
        expect(Math.abs(r.caAfter - r.caBefore)).toBeLessThanOrEqual(
          (kind === 'monthly' ? MONTHLY_CAP : SEASON_CAP) + 2,
        );
        expect(r.player.pa).toBe(p.pa);
        expect(r.player.ca).toBe(currentAbility(r.player.attributes, p.primaryPosition));
        expect(r.player.ca).toBeLessThanOrEqual(r.player.pa);
      }
    }
  });

  it('develops young high-potential players and declines veterans', () => {
    expect(seasonGrowth(player(18, 90, 170), {})).toBeGreaterThan(5);
    expect(seasonGrowth(player(34, 140, 145, P.AMR), {})).toBeLessThan(-2);
    // A player at his potential doesn't grow.
    expect(seasonGrowth(player(20, 120, 120), {})).toBeLessThanOrEqual(0.5);
  });

  it('rewards playing time, performance, training and professionalism; injuries hurt', () => {
    const p = player(19, 100, 170);
    const regular = seasonGrowth(p, { minutesShare: 0.9 });
    expect(regular).toBeGreaterThan(
      seasonGrowth(p, { minutesShare: 0.05, averageRating: null }) + 1,
    );
    expect(seasonGrowth(p, { averageRating: 7.8 })).toBeGreaterThan(
      seasonGrowth(p, { averageRating: 6.0 }),
    );
    expect(seasonGrowth(p, { trainingQuality: 20 })).toBeGreaterThan(
      seasonGrowth(p, { trainingQuality: 2 }),
    );
    expect(seasonGrowth(p, { injuredDays: 25 })).toBeLessThan(regular);
    const pro = { ...p, hidden: p.hidden.map((v, i) => (i === 4 ? 20 : v)) };
    const lazy = { ...p, hidden: p.hidden.map((v, i) => (i === 4 ? 1 : v)) };
    expect(seasonGrowth(pro, {})).toBeGreaterThan(seasonGrowth(lazy, {}));
  });

  it('is position-aware: growth goes to attributes that matter, decline hits physical first', () => {
    const counts = { relevant: 0, gk: 0, total: 0 };
    const physical = { phys: 0, total: 0 };
    for (let r = 0; r < 30; r++) {
      const young = applyProgression(
        player(18, 80, 180, P.ST, `y${r}`),
        ctx({ kind: 'season' }, `y${r}`),
      );
      for (const c of young.changes) {
        counts.total++;
        if (GOALKEEPING.some((k) => A[k] === c.attribute)) counts.gk++;
        if (
          [
            A.finishing,
            A.offTheBall,
            A.composure,
            A.firstTouch,
            A.pace,
            A.acceleration,
            A.anticipation,
          ].includes(c.attribute)
        )
          counts.relevant++;
      }
      const old = applyProgression(
        player(34, 140, 145, P.AMR, `o${r}`),
        ctx({ kind: 'season' }, `o${r}`),
      );
      for (const c of old.changes.filter((x) => x.to < x.from)) {
        physical.total++;
        if (PHYSICAL.some((k) => A[k] === c.attribute)) physical.phys++;
      }
    }
    expect(counts.gk).toBe(0);
    expect(counts.relevant / counts.total).toBeGreaterThan(0.3);
    expect(physical.phys / physical.total).toBeGreaterThan(0.5);
  });

  it('applies training focus to the chosen attribute group', () => {
    let focused = 0;
    let total = 0;
    for (let r = 0; r < 30; r++) {
      const res = applyProgression(
        player(18, 80, 180, P.MC, `f${r}`),
        ctx({ kind: 'season', trainingFocus: 'mental' }, `f${r}`),
      );
      for (const c of res.changes) {
        total++;
        if (c.reason === 'training') focused++;
      }
    }
    expect(focused / total).toBeGreaterThan(0.4);
  });

  it('gives different outcomes to players with the same ability (seeded variation)', () => {
    const p = player(19, 100, 160);
    const outcomes = new Set(
      Array.from({ length: 10 }, (_, i) =>
        JSON.stringify(applyProgression(p, ctx({ kind: 'season' }, `v${i}`)).changes),
      ),
    );
    expect(outcomes.size).toBeGreaterThan(5);
  });
});
