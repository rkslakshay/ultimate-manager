/**
 * Headless multi-season DEVELOPMENT simulation: progression, retirements, contracts, free
 * agents and youth intakes over many seasons, without matches.
 *
 * Until the match engine (Phase 2) and season loop (Phase 3) exist, playing time, match ratings
 * and injuries here are SYNTHETIC stand-ins (documented below). This tests that the development
 * systems keep the population stable; it is not a prediction of real careers.
 */
import { addYears, ageOn, toIsoDate, type DayNumber } from '../core/date';
import { clamp, roundMoney } from '../core/math';
import { expectedWage, marketValue } from '../economy/value';
import { modelValue, type ValueModel } from '../economy/value-model';
import { H } from '../players/attributes';
import { POSITION_GROUP, POSITIONS } from '../players/positions';
import { createRng, type Rng } from '../rng/rng';
import { seasonEndDay } from '../world/squads';
import type { Club, Player, WorldState } from '../world/types';
import { applyProgression } from './progression';
import { retirementChance, youthIntake } from './lifecycle';

export interface DistributionStats {
  mean: number;
  median: number;
  p90: number;
  max: number;
}

export interface SeasonStats {
  season: number;
  date: string;
  activePlayers: number;
  imported: number;
  generated: number;
  ca: DistributionStats;
  paMean: number;
  /** Players with CA ≥ 160. */
  elite: number;
  caByAge: Record<string, number>;
  caByGroup: Record<string, number>;
  /** Mean CA of players who arrived through youth intakes, at their current age. */
  regenCaMean: number;
  retired: number;
  regens: number;
  freeAgents: number;
  valueMean: number;
  valueMedian: number;
  wageMean: number;
  squadMin: number;
  squadMax: number;
  /** Mean CA change applied to players aged ≤ 21 / ≥ 31 during the season. */
  youthGrowth: number;
  veteranDecline: number;
}

/** Squads above this size release their weakest players at season end. */
const MAX_SQUAD = 28;

export interface HeadlessOptions {
  seasons: number;
  seed: string;
  valueModel?: ValueModel | null;
  onSeason?: (s: SeasonStats) => void;
}

const dist = (xs: number[]): DistributionStats => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return { mean: 0, median: 0, p90: 0, max: 0 };
  return {
    mean: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10,
    median: s[Math.floor(s.length / 2)]!,
    p90: s[Math.floor(s.length * 0.9)]!,
    max: s.at(-1)!,
  };
};
const mean = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0;

/**
 * SYNTHETIC stand-in for match data: minutes by squad rank, ratings by relative ability.
 * Young players outside the top 18 are assumed to be loaned out and play regularly elsewhere
 * (what real clubs do, and what the loan system will model in Phase 8).
 */
function syntheticSeasonInputs(rng: Rng, squad: Player[], today: DayNumber) {
  const ranked = [...squad].sort((a, b) => b.ca - a.ca);
  const top = ranked.slice(0, 18);
  const levelCa = top.length ? top.reduce((a, p) => a + p.ca, 0) / top.length : 80;
  const inputs = new Map<number, { minutes: number; rating: number }>();
  ranked.forEach((p, i) => {
    const onLoan = i >= 18 && ageOn(p.birthDay, today) <= 22;
    const minutes =
      i < 11
        ? rng.float(0.7, 0.95)
        : i < 18
          ? rng.float(0.2, 0.5)
          : onLoan
            ? rng.float(0.4, 0.75)
            : rng.float(0, 0.12);
    inputs.set(p.id, {
      minutes,
      rating: clamp(6.6 + (p.ca - levelCa) / 40 + rng.normal(0, 0.25), 5.5, 8.5),
    });
  });
  return { inputs, levelCa };
}

export function simulateSeasons(
  start: WorldState,
  opts: HeadlessOptions,
): { world: WorldState; stats: SeasonStats[] } {
  let world: WorldState = {
    ...start,
    players: start.players.map((p) => ({ ...p })),
    clubs: start.clubs.map((c) => ({ ...c })),
  };
  const regenIds = new Set<number>();
  const stats: SeasonStats[] = [];
  let nextId = world.players.reduce((m, p) => Math.max(m, p.id), 0);
  const newId = () => ++nextId;
  const clubById = new Map(world.clubs.map((c) => [c.id, c]));
  const nationById = new Map(world.nations.map((n) => [n.id, n]));
  const value = (p: Player, today: DayNumber, club: Club | undefined) => {
    const age = ageOn(p.birthDay, today);
    const years = p.contract ? (p.contract.endDay - today) / 365 : 0;
    const rep = club?.reputation ?? 30;
    return opts.valueModel
      ? modelValue(opts.valueModel, {
          ca: p.ca,
          pa: p.pa,
          age,
          contractYearsLeft: years,
          clubReputation: rep,
        })
      : marketValue({ ca: p.ca, pa: p.pa, age, contractYearsLeft: years, reputation: rep });
  };

  for (let season = 1; season <= opts.seasons; season++) {
    const rng = createRng(`headless:${opts.seed}:${season}`);
    const seasonStart = world.startDay;
    const players = world.players.filter((p) => !p.retired);
    const squads = new Map<number, Player[]>();
    for (const p of players)
      if (p.clubId !== null) squads.set(p.clubId, [...(squads.get(p.clubId) ?? []), p]);
    const synthetic = new Map<number, { minutes: number; rating: number; levelCa: number }>();
    for (const [, squad] of squads) {
      const { inputs, levelCa } = syntheticSeasonInputs(rng, squad, seasonStart);
      for (const [id, v] of inputs) synthetic.set(id, { ...v, levelCa });
    }
    const growth: { young: number[]; old: number[] } = { young: [], old: [] };
    const byId = new Map(world.players.map((p, i) => [p.id, i]));

    // 10 monthly reviews (August-May) and one season-end review.
    const reviews: { kind: 'monthly' | 'season'; day: DayNumber }[] = [
      ...Array.from({ length: 10 }, (_, m) => ({
        kind: 'monthly' as const,
        day: seasonStart + 31 + m * 30,
      })),
      { kind: 'season', day: seasonEndDay(seasonStart, 0) },
    ];
    const caAtStart = new Map(players.map((p) => [p.id, p.ca]));
    for (const review of reviews) {
      for (const p0 of players) {
        const idx = byId.get(p0.id)!;
        const p = world.players[idx]!;
        const input = synthetic.get(p.id) ?? { minutes: 0, rating: 6.2, levelCa: p.ca };
        const club = p.clubId !== null ? clubById.get(p.clubId) : undefined;
        const injuryRisk = 0.025 * ((p.hidden[H.injuryProneness] ?? 10) / 10);
        const injured = review.kind === 'monthly' && rng.chance(injuryRisk) ? rng.int(5, 30) : 0;
        const result = applyProgression(p, {
          today: review.day,
          kind: review.kind,
          rng: rng.fork(`p:${p.id}:${review.day}`),
          minutesShare: p.clubId === null ? 0 : input.minutes,
          averageRating: p.clubId === null ? null : input.rating,
          trainingQuality: club?.trainingFacilities ?? 6,
          injuredDays: injured,
          levelCa: input.levelCa,
        });
        world.players[idx] = result.player;
      }
    }
    for (const p of players) {
      const after = world.players[byId.get(p.id)!]!;
      const age = ageOn(p.birthDay, seasonStart);
      if (age <= 21) growth.young.push(after.ca - caAtStart.get(p.id)!);
      if (age >= 31) growth.old.push(after.ca - caAtStart.get(p.id)!);
    }

    // Season end: retirements, contracts, transfers of free agents, youth intakes.
    const seasonEnd = seasonEndDay(seasonStart, 0);
    let retired = 0;
    for (const p of world.players) {
      if (p.retired) continue;
      if (rng.chance(retirementChance(p, seasonEnd))) {
        p.retired = true;
        p.clubId = null;
        p.contract = null;
        retired++;
      }
    }
    const nextStart = addYears(seasonStart, 1);
    for (const p of world.players) {
      if (p.retired || !p.contract || p.contract.endDay > seasonEnd) continue;
      const age = ageOn(p.birthDay, seasonEnd);
      const renew =
        p.contract.squadStatus === 'key' || p.contract.squadStatus === 'firstTeam'
          ? 0.85
          : p.contract.squadStatus === 'prospect'
            ? 0.6
            : 0.45;
      if (rng.chance(age >= 33 ? renew * 0.5 : renew)) {
        const club = clubById.get(p.clubId!)!;
        p.contract = {
          ...p.contract,
          startDay: nextStart,
          endDay: seasonEndDay(nextStart, rng.int(0, 3)),
          wage: roundMoney(expectedWage(p.ca, age, club.reputation)),
        };
      } else {
        p.clubId = null;
        p.contract = null;
      }
    }
    let regens = 0;
    for (const club of world.clubs) {
      const squadCas = world.players
        .filter((p) => p.clubId === club.id)
        .map((p) => p.ca)
        .sort((x, y) => x - y);
      const level = squadCas.length
        ? {
            median: squadCas[Math.floor(squadCas.length / 2)]!,
            p75: squadCas[Math.floor(squadCas.length * 0.75)]!,
          }
        : undefined;
      const intake = youthIntake(
        rng.fork(`youth:${club.id}`),
        club,
        nationById.get(club.nationId)!,
        nextStart,
        newId,
        level,
      );
      for (const r of intake) regenIds.add(r.id);
      world.players.push(...intake);
      regens += intake.length;
    }
    // Squad balancing: thin squads sign the best affordable free agents; bloated ones release.
    const free = world.players
      .filter((p) => !p.retired && p.clubId === null)
      .sort((a, b) => b.ca - a.ca);
    for (const club of world.clubs) {
      const squad = world.players.filter((p) => p.clubId === club.id);
      const level = squad.length ? squad.reduce((a, p) => a + p.ca, 0) / squad.length : 80;
      for (let n = squad.length; n < 22; n++) {
        const i = free.findIndex((p) => p.ca <= level + 15);
        if (i < 0) break;
        const [p] = free.splice(i, 1);
        const age = ageOn(p!.birthDay, nextStart);
        p!.clubId = club.id;
        p!.contract = {
          wage: roundMoney(expectedWage(p!.ca, age, club.reputation)),
          startDay: nextStart,
          endDay: seasonEndDay(nextStart, rng.int(0, 2)),
          squadStatus: 'rotation',
          releaseClause: null,
        };
      }
      const after = world.players.filter((p) => p.clubId === club.id);
      if (after.length > MAX_SQUAD) {
        // Release the weakest, but keep teenagers who still have real potential.
        const promising = (p: Player) => ageOn(p.birthDay, nextStart) <= 20 && p.pa - p.ca >= 20;
        const surplus = after
          .filter((p) => !promising(p))
          .sort((a, b) => a.ca - b.ca)
          .slice(0, after.length - MAX_SQUAD);
        for (const p of surplus) {
          p.clubId = null;
          p.contract = null;
        }
      }
      // Squad status by rank.
      const ranked = world.players.filter((p) => p.clubId === club.id).sort((a, b) => b.ca - a.ca);
      ranked.forEach((p, i) => {
        if (!p.contract) return;
        const age = ageOn(p.birthDay, nextStart);
        p.contract.squadStatus =
          i < 2
            ? 'key'
            : i < 11
              ? 'firstTeam'
              : age <= 20
                ? 'prospect'
                : i < 17
                  ? 'rotation'
                  : 'backup';
      });
    }
    for (const p of world.players)
      if (!p.retired)
        p.value = value(p, nextStart, p.clubId !== null ? clubById.get(p.clubId) : undefined);
    world = { ...world, startDay: nextStart };

    const active = world.players.filter((p) => !p.retired);
    const sizes = world.clubs.map((c) => active.filter((p) => p.clubId === c.id).length);
    const ageBand = (p: Player) => {
      const a = ageOn(p.birthDay, nextStart);
      return a < 21 ? '<21' : a < 26 ? '21-25' : a < 30 ? '26-29' : a < 34 ? '30-33' : '34+';
    };
    const caByAge: Record<string, number> = {};
    for (const band of ['<21', '21-25', '26-29', '30-33', '34+'])
      caByAge[band] = mean(active.filter((p) => ageBand(p) === band).map((p) => p.ca));
    const caByGroup: Record<string, number> = {};
    for (const g of ['GK', 'DEF', 'MID', 'ATT'])
      caByGroup[g] = mean(
        active.filter((p) => POSITION_GROUP[POSITIONS[p.primaryPosition]!] === g).map((p) => p.ca),
      );
    const s: SeasonStats = {
      season,
      date: toIsoDate(nextStart),
      activePlayers: active.length,
      imported: active.filter((p) => p.origin === 'imported').length,
      generated: active.filter((p) => p.origin === 'generated').length,
      ca: dist(active.map((p) => p.ca)),
      paMean: mean(active.map((p) => p.pa)),
      elite: active.filter((p) => p.ca >= 160).length,
      caByAge,
      caByGroup,
      regenCaMean: mean(active.filter((p) => regenIds.has(p.id)).map((p) => p.ca)),
      retired,
      regens,
      freeAgents: active.filter((p) => p.clubId === null).length,
      valueMean: Math.round(mean(active.map((p) => p.value))),
      valueMedian: dist(active.map((p) => p.value)).median,
      wageMean: Math.round(mean(active.filter((p) => p.contract).map((p) => p.contract!.wage))),
      squadMin: Math.min(...sizes),
      squadMax: Math.max(...sizes),
      youthGrowth: mean(growth.young),
      veteranDecline: mean(growth.old),
    };
    stats.push(s);
    opts.onSeason?.(s);
  }
  return { world, stats };
}

export interface StabilityCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** Seasons treated as burn-in: an imported world adjusts to the simulation's rules first. */
export const BURN_IN_SEASONS = 4;

/**
 * Documented stability thresholds over a long run, comparing the last season with the first
 * season after burn-in (season 5), so one-off adjustments of an imported world (e.g. thin real
 * squads filling up to normal size) don't count as drift.
 */
export function checkStability(stats: SeasonStats[]): StabilityCheck[] {
  const first = stats[Math.min(BURN_IN_SEASONS, stats.length - 1)]!;
  const last = stats.at(-1)!;
  const ratio = (a: number, b: number) => (b ? a / b : 1);
  const within = (
    name: string,
    value: number,
    lo: number,
    hi: number,
    detail: string,
  ): StabilityCheck => ({
    name,
    ok: value >= lo && value <= hi,
    detail: `${detail} (allowed ${lo}-${hi})`,
  });
  const maxCa = Math.max(...stats.map((s) => s.ca.max));
  return [
    within(
      'mean CA drift',
      ratio(last.ca.mean, first.ca.mean),
      0.9,
      1.1,
      `${first.ca.mean} → ${last.ca.mean}`,
    ),
    within(
      'top-10% CA drift',
      ratio(last.ca.p90, first.ca.p90),
      0.9,
      1.1,
      `${first.ca.p90} → ${last.ca.p90}`,
    ),
    within(
      'elite players ratio',
      ratio(last.elite, Math.max(1, first.elite)),
      first.elite ? 0.4 : 0,
      first.elite ? 2.5 : 1e9,
      `${first.elite} → ${last.elite}`,
    ),
    within(
      'active population ratio',
      ratio(last.activePlayers, first.activePlayers),
      0.85,
      1.25,
      `${first.activePlayers} → ${last.activePlayers}`,
    ),
    within('maximum CA', maxCa, 1, 200, `${maxCa}`),
    within(
      'mean value ratio',
      ratio(last.valueMean, first.valueMean),
      0.4,
      2.5,
      `${first.valueMean} → ${last.valueMean}`,
    ),
    within(
      'smallest squad',
      Math.min(...stats.map((s) => s.squadMin)),
      16,
      99,
      `${Math.min(...stats.map((s) => s.squadMin))}`,
    ),
    within(
      'youth grow on average',
      Math.min(...stats.map((s) => s.youthGrowth)),
      0.5,
      99,
      `min mean growth of ≤21s per season ${Math.min(...stats.map((s) => s.youthGrowth))}`,
    ),
    within(
      'veterans decline on average',
      Math.max(...stats.map((s) => s.veteranDecline)),
      -99,
      0,
      `max mean change of ≥31s per season ${Math.max(...stats.map((s) => s.veteranDecline))}`,
    ),
  ];
}
