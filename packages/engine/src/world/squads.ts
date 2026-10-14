import { type DayNumber, addYears, civilFromDay, dayFromCivil } from '../core/date';
import { clamp, roundClamp, roundMoney } from '../core/math';
import { expectedWage, marketValue } from '../economy/value';
import { generatePlayer } from '../players/generate-player';
import { P, type Position } from '../players/positions';
import type { Rng } from '../rng/rng';
import type { Club, Nation, Player, SquadStatus } from './types';

type Tier = 'key' | 'starter' | 'rotation' | 'backup' | 'prospect';

/** Squad template: one entry per player (26 total, 11 starters). */
const SQUAD_TEMPLATE: [Position, Tier][] = [
  ['GK', 'starter'],
  ['GK', 'backup'],
  ['GK', 'prospect'],
  ['DC', 'starter'],
  ['DC', 'starter'],
  ['DC', 'rotation'],
  ['DC', 'backup'],
  ['DL', 'starter'],
  ['DL', 'backup'],
  ['DR', 'starter'],
  ['DR', 'rotation'],
  ['DM', 'starter'],
  ['DM', 'rotation'],
  ['MC', 'starter'],
  ['MC', 'starter'],
  ['MC', 'rotation'],
  ['MC', 'prospect'],
  ['ML', 'rotation'],
  ['MR', 'rotation'],
  ['AML', 'starter'],
  ['AMR', 'starter'],
  ['AMC', 'rotation'],
  ['ST', 'starter'],
  ['ST', 'rotation'],
  ['ST', 'backup'],
  ['ST', 'prospect'],
];

const TIER_OFFSET: Record<Tier, number> = {
  key: 16,
  starter: 7,
  rotation: -1,
  backup: -10,
  prospect: -26,
};
const TIER_STATUS: Record<Tier, SquadStatus> = {
  key: 'key',
  starter: 'firstTeam',
  rotation: 'rotation',
  backup: 'backup',
  prospect: 'prospect',
};
const STATUS_WAGE: Record<SquadStatus, number> = {
  key: 1.35,
  firstTeam: 1,
  rotation: 0.85,
  backup: 0.7,
  prospect: 0.55,
};

/**
 * Highest realistic Current Ability for a teenage prospect: academy players are raw, and
 * their quality shows in potential rather than current ability.
 */
const prospectCap = (age: number) => 80 + (age - 17) * 13;
/** Softer cap for any young player: exceptional youngsters exist, but not 18-year-old greats. */
const youthCap = (age: number) => 95 + (age - 17) * 16;

/** Average Current Ability of a club's first team, from its reputation (1-100). */
export const squadAbilityFor = (reputation: number) => 40 + reputation * 1.3;

function ageFor(rng: Rng, tier: Tier): number {
  if (tier === 'prospect') return rng.int(17, 20);
  if (tier === 'backup')
    return roundClamp(rng.chance(0.5) ? rng.normal(21, 1.5) : rng.normal(31, 2.5), 18, 37);
  return roundClamp(rng.normal(26.5, 3.4), 20, 35);
}

/** 30 June of the season `yearsAhead` seasons after the one containing `day`. */
export function seasonEndDay(day: DayNumber, yearsAhead: number): DayNumber {
  const { year, month } = civilFromDay(day);
  const seasonEndYear = month >= 7 ? year + 1 : year;
  return dayFromCivil(seasonEndYear + yearsAhead, 6, 30);
}

export interface SquadContext {
  rng: Rng;
  club: Club;
  nation: Nation;
  nations: Nation[];
  startDay: DayNumber;
  nextPlayerId: () => number;
}

/** Pick a nationality: mostly domestic, otherwise weighted towards stronger nations. */
function pickNationality(rng: Rng, home: Nation, nations: Nation[], domesticShare: number): Nation {
  if (rng.chance(domesticShare)) return home;
  const others = nations.filter((n) => n.id !== home.id);
  return rng.weighted(
    others,
    others.map((n) => n.reputation ** 2),
  );
}

/** Contract, wage and value for a newly generated player at a club. */
export function signPlayer(
  rng: Rng,
  player: Player,
  club: Club,
  status: SquadStatus,
  startDay: DayNumber,
  age: number,
): void {
  const years =
    status === 'prospect' ? rng.int(1, 3) : rng.weighted([0, 1, 2, 3, 4], [24, 26, 22, 16, 12]);
  const endDay = seasonEndDay(startDay, years);
  const wage = roundMoney(
    expectedWage(player.ca, age, club.reputation) * STATUS_WAGE[status] * rng.float(0.85, 1.15),
  );
  player.clubId = club.id;
  player.contract = {
    wage,
    startDay: addYears(startDay, -rng.int(0, 3)),
    endDay,
    squadStatus: status,
    releaseClause: null,
  };
  player.value = marketValue({
    ca: player.ca,
    pa: player.pa,
    age,
    contractYearsLeft: (endDay - startDay) / 365,
    reputation: club.reputation,
  });
  if (rng.chance(0.18))
    player.contract.releaseClause = roundMoney(player.value * rng.float(1.6, 3.2));
}

export function generateSquad({
  rng,
  club,
  nation,
  nations,
  startDay,
  nextPlayerId,
}: SquadContext): Player[] {
  const caMean = squadAbilityFor(club.reputation);
  const domesticShare = clamp(
    0.92 - club.reputation / 400 - (nation.reputation - 60) / 300,
    0.55,
    0.92,
  );
  const template = SQUAD_TEMPLATE.map(([pos, tier]) => [pos, tier] as [Position, Tier]);
  // One or two stand-out players per club.
  const starters = template.filter(([, t]) => t === 'starter');
  for (let k = 0; k < rng.int(1, 2); k++) rng.pick(starters)[1] = 'key';
  // A couple of extra squad players at random positions.
  for (let k = 0; k < rng.int(0, 2); k++)
    template.push([rng.pick(['DC', 'MC', 'ST', 'AML', 'AMR', 'DR'] as const), 'backup']);

  return template.map(([pos, tier]) => {
    const age = ageFor(rng, tier);
    const home = pickNationality(rng, nation, nations, domesticShare);
    const player = generatePlayer(rng, {
      id: nextPlayerId(),
      nationId: home.id,
      flavour: home.flavour,
      position: P[pos],
      age,
      targetCa:
        Math.min(
          caMean + TIER_OFFSET[tier],
          tier === 'prospect' ? prospectCap(age) : youthCap(age),
        ) + rng.normal(0, 6),
      referenceDay: startDay,
      wonderkidChance: tier === 'prospect' ? 0.015 + club.youthFacilities / 1000 : 0,
    });
    signPlayer(rng, player, club, TIER_STATUS[tier], startDay, age);
    return player;
  });
}
