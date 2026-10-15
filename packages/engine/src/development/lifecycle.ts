import { ageOn, type DayNumber } from '../core/date';
import { clamp, roundMoney } from '../core/math';
import { expectedWage, marketValue } from '../economy/value';
import { generatePlayer } from '../players/generate-player';
import { P, type Position } from '../players/positions';
import type { Rng } from '../rng/rng';
import { seasonEndDay } from '../world/squads';
import type { Club, Nation, Player } from '../world/types';

/**
 * Chance a player retires at the end of a season. Configurable curve; better players and
 * goalkeepers carry on longer, unattached veterans retire sooner.
 */
export function retirementChance(player: Player, today: DayNumber): number {
  const age = ageOn(player.birthDay, today);
  const gkBonus = player.primaryPosition === P.GK ? 2 : 0;
  const effective = age - gkBonus - (player.ca >= 150 ? 1 : 0);
  let chance =
    effective < 32
      ? 0
      : effective < 33
        ? 0.06
        : effective < 34
          ? 0.15
          : effective < 35
            ? 0.3
            : effective < 36
              ? 0.5
              : effective < 37
                ? 0.7
                : 0.9;
  // Unattached players drift out of professional football (lower leagues, other careers).
  if (player.clubId === null)
    chance = Math.min(1, chance + (age >= 28 ? 0.5 : age >= 22 ? 0.3 : 0.25));
  if (player.clubId === null && age >= 34) chance = 1;
  return chance;
}

/**
 * Academy PA = squad p75 + share × (world PA ceiling − p75), share ~ normal(mean + 0.004 ×
 * youth facilities, sd). Tuned with the 20-season development sim (DECISIONS.md, regen potential).
 */
export const PA_SHARE_MEAN = 0.12;
export const PA_SHARE_SD = 0.22;

const INTAKE_POSITIONS: Position[] = [
  'GK',
  'DC',
  'DC',
  'DL',
  'DR',
  'DM',
  'MC',
  'MC',
  'ML',
  'MR',
  'AMC',
  'AML',
  'AMR',
  'ST',
  'ST',
];

/**
 * Annual youth intake for one club: 2-4 regens aged 15-17, quality from youth facilities and
 * reputation, names from the club nation's pool (real packs) or flavour (fictional worlds).
 * Regens are always origin "generated".
 */
export interface SquadLevel {
  /** Median and upper-quartile CA of the club's current squad. */
  median: number;
  p75: number;
  /** Highest PA in the world when the save started (defaults to 200, the scale maximum). */
  paCeiling?: number;
}

export function youthIntake(
  rng: Rng,
  club: Club,
  nation: Nation,
  today: DayNumber,
  nextId: () => number,
  level?: SquadLevel,
): Player[] {
  const count = rng.int(2, 4);
  const out: Player[] = [];
  for (let i = 0; i < count; i++) {
    const age = rng.int(15, 17);
    const position = P[rng.pick(INTAKE_POSITIONS)];
    // Quality is anchored to the club's own squad level when known (keeps any world's ability
    // scale stable), plus facilities; otherwise it falls back to reputation.
    const quality = level
      ? level.median * 0.45 + club.youthFacilities * 1.2 + 8
      : 35 + club.youthFacilities * 1.6 + club.reputation * 0.25;
    const p = generatePlayer(rng, {
      id: nextId(),
      nationId: nation.id,
      flavour: nation.flavour,
      namePool: nation.namePool,
      position,
      age,
      targetCa: clamp(rng.normal(quality, 9), 25, 110),
      referenceDay: today,
      wonderkidChance: 0.004 + club.youthFacilities / 2500,
    });
    // Academy potential spans journeymen to future stars and scales with club quality and
    // facilities (the generic generator's age-based headroom is far too low for 15-17s).
    // With a known squad level, potential is a share of the headroom between the squad's p75
    // and the world's PA ceiling, so the spread narrows at clubs that are already elite (as for
    // imported under-21s) and a world never breeds stars beyond its own scale. A fixed spread
    // let elite academies feed their own p75 and ratchet upwards (DECISIONS.md, regen potential).
    const paRaw = level
      ? level.p75 +
        Math.max(0, (level.paCeiling ?? 200) - level.p75) *
          rng.normal(PA_SHARE_MEAN + club.youthFacilities * 0.004, PA_SHARE_SD)
      : rng.normal(68 + club.reputation * 0.75 + club.youthFacilities * 1.6, 24);
    p.pa = clamp(Math.round(paRaw), p.ca + 10, 200);
    const endDay = seasonEndDay(today, rng.int(2, 3));
    p.clubId = club.id;
    p.contract = {
      wage: roundMoney(expectedWage(p.ca, age, club.reputation) * 0.5),
      startDay: today,
      endDay,
      squadStatus: 'prospect',
      releaseClause: null,
    };
    p.value = marketValue({
      ca: p.ca,
      pa: p.pa,
      age,
      contractYearsLeft: (endDay - today) / 365,
      reputation: club.reputation,
    });
    out.push(p);
  }
  return out;
}
