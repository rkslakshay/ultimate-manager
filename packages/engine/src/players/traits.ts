import type { Rng } from '../rng/rng';
import { A } from './attributes';
import { P } from './positions';

/** Player traits ("preferred moves") that bias the match engine's decisions. Append only. */
export const TRAITS = {
  cutsInside: 'Cuts inside from wide',
  runsWithBallOften: 'Runs with ball often',
  shootsFromDistance: 'Shoots from distance',
  triesKillerBalls: 'Tries killer balls often',
  playsShortPasses: 'Plays short simple passes',
  getsForward: 'Gets forward whenever possible',
  staysBack: 'Stays back at all times',
  divesIntoTackles: 'Dives into tackles',
  staysOnFeet: 'Stays on feet',
  roundsKeeper: 'Likes to round keeper',
  placesShots: 'Places shots',
  powersShots: 'Shoots with power',
  arrivesLateInBox: 'Arrives late in opposition area',
  movesIntoChannels: 'Moves into channels',
  backToGoal: 'Plays with back to goal',
  triesTricks: 'Tries tricks',
  comesForCrosses: 'Comes for crosses',
  distributesQuickly: 'Distributes ball quickly',
} as const;

export type TraitId = keyof typeof TRAITS;

interface Rule {
  trait: TraitId;
  /** Relative likelihood given the player's attributes and position (0 = impossible). */
  weight: (attrs: readonly number[], position: number) => number;
}

const at = (attrs: readonly number[], idx: number) => attrs[idx] as number;
const isWide = (p: number) => [P.ML, P.MR, P.AML, P.AMR, P.WBL, P.WBR].includes(p);
const isAttacker = (p: number) => [P.AML, P.AMR, P.AMC, P.ST].includes(p);
const isGk = (p: number) => p === P.GK;

const RULES: Rule[] = [
  { trait: 'cutsInside', weight: (a, p) => (isWide(p) && at(a, A.dribbling) >= 12 ? 3 : 0) },
  { trait: 'runsWithBallOften', weight: (a, p) => (!isGk(p) && at(a, A.dribbling) >= 13 ? 2 : 0) },
  { trait: 'shootsFromDistance', weight: (a, p) => (!isGk(p) && at(a, A.longShots) >= 13 ? 2 : 0) },
  { trait: 'triesKillerBalls', weight: (a, p) => (!isGk(p) && at(a, A.vision) >= 14 ? 2 : 0) },
  { trait: 'playsShortPasses', weight: (a, p) => (!isGk(p) && at(a, A.vision) <= 11 ? 1 : 0) },
  {
    trait: 'getsForward',
    weight: (a, p) =>
      [P.DL, P.DR, P.WBL, P.WBR, P.MC].includes(p) && at(a, A.stamina) >= 13 ? 2 : 0,
  },
  { trait: 'staysBack', weight: (_a, p) => ([P.DC, P.DM].includes(p) ? 1 : 0) },
  { trait: 'divesIntoTackles', weight: (a, p) => (!isGk(p) && at(a, A.aggression) >= 14 ? 2 : 0) },
  {
    trait: 'staysOnFeet',
    weight: (a, p) => (!isGk(p) && at(a, A.aggression) <= 9 && at(a, A.tackling) >= 11 ? 1 : 0),
  },
  { trait: 'roundsKeeper', weight: (a, p) => (isAttacker(p) && at(a, A.dribbling) >= 13 ? 1 : 0) },
  { trait: 'placesShots', weight: (a, p) => (isAttacker(p) && at(a, A.composure) >= 13 ? 2 : 0) },
  { trait: 'powersShots', weight: (a, p) => (isAttacker(p) && at(a, A.strength) >= 13 ? 1 : 0) },
  {
    trait: 'arrivesLateInBox',
    weight: (a, p) => ([P.MC, P.AMC].includes(p) && at(a, A.offTheBall) >= 12 ? 2 : 0),
  },
  { trait: 'movesIntoChannels', weight: (a, p) => (p === P.ST && at(a, A.pace) >= 13 ? 2 : 0) },
  { trait: 'backToGoal', weight: (a, p) => (p === P.ST && at(a, A.strength) >= 14 ? 2 : 0) },
  { trait: 'triesTricks', weight: (a, p) => (!isGk(p) && at(a, A.flair) >= 15 ? 2 : 0) },
  { trait: 'comesForCrosses', weight: (a, p) => (isGk(p) && at(a, A.commandOfArea) >= 13 ? 2 : 0) },
  { trait: 'distributesQuickly', weight: (a, p) => (isGk(p) && at(a, A.kicking) >= 12 ? 1 : 0) },
];

/** Mutually exclusive pairs: a player never gets both. */
const CONFLICTS: [TraitId, TraitId][] = [
  ['getsForward', 'staysBack'],
  ['divesIntoTackles', 'staysOnFeet'],
  ['placesShots', 'powersShots'],
  ['triesKillerBalls', 'playsShortPasses'],
];

/** Pick 0-3 traits suited to the player's attributes and position. */
export function pickTraits(
  rng: Rng,
  attrs: readonly number[],
  position: number,
  age: number,
): TraitId[] {
  // Older players have had more time to develop habits.
  const count = rng.weighted([0, 1, 2, 3], age < 21 ? [55, 35, 10, 0] : [25, 40, 25, 10]);
  const chosen: TraitId[] = [];
  const candidates = RULES.map((r) => ({
    trait: r.trait,
    weight: r.weight(attrs, position),
  })).filter((c) => c.weight > 0);
  while (chosen.length < count && candidates.length) {
    const pick = rng.weighted(
      candidates,
      candidates.map((c) => c.weight),
    );
    chosen.push(pick.trait);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const t = candidates[i]!.trait;
      if (
        t === pick.trait ||
        CONFLICTS.some(([x, y]) => (x === pick.trait && y === t) || (y === pick.trait && x === t))
      ) {
        candidates.splice(i, 1);
      }
    }
  }
  return chosen;
}
