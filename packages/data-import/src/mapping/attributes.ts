/**
 * Source ratings (EA-style, 0-99) → our 47 attributes (1-20).
 *
 * Every attribute has exactly one rule below. Its origin is recorded per player:
 *   S  source-backed: one detailed source rating, or a weighted combination of several
 *   F  coarse fallback: the detailed ratings were missing, so a face stat (pace, shooting…) was used
 *   D  derived: the source has no equivalent; a seeded generator (stable per player) produces it
 *      from related ratings with documented correlations
 * See docs/DATA_MAPPING.md for the same table in prose.
 *
 * Scale: a 0-99 source rating maps linearly so that 25 → 1 and 95 → 20, then a global offset
 * fitted at import time (see calibrate.ts) shifts it so our Current Ability tracks the source
 * overall rating. This is a baseline, not a claim that the scales mean the same thing.
 */
import {
  A,
  ATTRIBUTE_COUNT,
  ATTRIBUTE_KEYS,
  clamp,
  P,
  roundClamp,
  type AttributeKey,
  type Rng,
} from '@um/engine';
import type { RatingKey, Ratings } from '../sources/records';

export const SOURCE_LOW = 25;
export const SOURCE_HIGH = 95;

/** Map one 0-99 rating onto 1-20 (unrounded), plus the calibration offset. */
export function scaleRating(value: number, offset = 0): number {
  return 1 + ((value - SOURCE_LOW) * 19) / (SOURCE_HIGH - SOURCE_LOW) + offset;
}

type Weighted = readonly (readonly [RatingKey, number])[];
interface SourceRule {
  kind: 'source';
  detailed: Weighted;
  /** Face-stat fallback when no detailed rating is present. */
  face: Weighted;
}

const src = (detailed: Weighted, face: Weighted): SourceRule => ({
  kind: 'source',
  detailed,
  face,
});

/** Detailed/face sources per attribute (GK attributes use goalkeeper face stats via physic etc.). */
const SOURCE_RULES: Partial<Record<AttributeKey, SourceRule>> = {
  corners: src(
    [
      ['crossing', 0.5],
      ['curve', 0.5],
    ],
    [['passing', 1]],
  ),
  crossing: src([['crossing', 1]], [['passing', 1]]),
  dribbling: src([['skillDribbling', 1]], [['dribbling', 1]]),
  finishing: src(
    [
      ['finishing', 0.85],
      ['volleys', 0.15],
    ],
    [['shooting', 1]],
  ),
  firstTouch: src([['ballControl', 1]], [['dribbling', 1]]),
  freeKicks: src(
    [['fkAccuracy', 1]],
    [
      ['shooting', 0.5],
      ['passing', 0.5],
    ],
  ),
  heading: src([['headingAccuracy', 1]], [['physic', 1]]),
  longShots: src(
    [
      ['longShots', 0.7],
      ['shotPower', 0.3],
    ],
    [['shooting', 1]],
  ),
  marking: src([['markingAwareness', 1]], [['defending', 1]]),
  passing: src(
    [
      ['shortPassing', 0.6],
      ['longPassing', 0.4],
    ],
    [['passing', 1]],
  ),
  penaltyTaking: src([['penalties', 1]], [['shooting', 1]]),
  tackling: src(
    [
      ['standingTackle', 0.6],
      ['slidingTackle', 0.4],
    ],
    [['defending', 1]],
  ),
  technique: src(
    [
      ['ballControl', 0.4],
      ['skillDribbling', 0.3],
      ['curve', 0.3],
    ],
    [['dribbling', 1]],
  ),
  aggression: src([['aggression', 1]], [['physic', 1]]),
  anticipation: src(
    [
      ['reactions', 0.6],
      ['interceptions', 0.4],
    ],
    [
      ['defending', 0.5],
      ['dribbling', 0.5],
    ],
  ),
  composure: src(
    [['composure', 1]],
    [
      ['shooting', 0.5],
      ['passing', 0.5],
    ],
  ),
  decisions: src(
    [
      ['reactions', 0.5],
      ['vision', 0.25],
      ['composure', 0.25],
    ],
    [
      ['passing', 0.5],
      ['dribbling', 0.5],
    ],
  ),
  offTheBall: src([['positioning', 1]], [['shooting', 1]]),
  positioning: src(
    [
      ['markingAwareness', 0.5],
      ['interceptions', 0.5],
    ],
    [['defending', 1]],
  ),
  vision: src([['vision', 1]], [['passing', 1]]),
  acceleration: src([['acceleration', 1]], [['pace', 1]]),
  agility: src([['agility', 1]], [['dribbling', 1]]),
  balance: src([['balance', 1]], [['dribbling', 1]]),
  jumpingReach: src([['jumping', 1]], [['physic', 1]]),
  pace: src([['sprintSpeed', 1]], [['pace', 1]]),
  stamina: src([['stamina', 1]], [['physic', 1]]),
  strength: src([['strength', 1]], [['physic', 1]]),
  aerialReach: src(
    [
      ['gkHandling', 0.6],
      ['jumping', 0.4],
    ],
    [],
  ),
  commandOfArea: src(
    [
      ['gkPositioning', 0.5],
      ['gkHandling', 0.5],
    ],
    [],
  ),
  handling: src([['gkHandling', 1]], []),
  kicking: src([['gkKicking', 1]], []),
  oneOnOnes: src(
    [
      ['gkDiving', 0.4],
      ['gkReflexes', 0.4],
      ['gkSpeed', 0.2],
    ],
    [],
  ),
  reflexes: src([['gkReflexes', 1]], []),
  rushingOut: src([['gkSpeed', 1]], []),
};

export interface DeriveContext {
  rng: Rng;
  /** Already-mapped 1-20 values (source rules run first). */
  attrs: number[];
  isGoalkeeper: boolean;
  age: number | null;
  heightCm: number | null;
  skillMoves: number | null;
  workRate: [string, string] | null;
  internationalReputation: number | null;
}

const at = (ctx: DeriveContext, k: AttributeKey) => ctx.attrs[A[k]] ?? 10;
const workLevel = (w: string | undefined) =>
  w?.toLowerCase().startsWith('h') ? 1 : w?.toLowerCase().startsWith('l') ? -1 : 0;

/** Attributes with no source equivalent: seeded, correlated with related mapped values. */
const DERIVED_RULES: Partial<Record<AttributeKey, (ctx: DeriveContext) => number>> = {
  longThrows: (c) => at(c, 'strength') * 0.5 + c.rng.normal(4, 3),
  bravery: (c) =>
    (at(c, 'aggression') + at(c, 'strength') + at(c, 'heading')) / 3 + c.rng.normal(0.5, 2),
  concentration: (c) =>
    (at(c, 'anticipation') + at(c, 'composure') + at(c, 'marking')) / 3 + c.rng.normal(0, 1.8),
  determination: (c) => 11 + ((c.internationalReputation ?? 1) - 1) * 0.8 + c.rng.normal(0, 3),
  leadership: (c) =>
    7 + ((c.age ?? 25) - 23) * 0.35 + (c.internationalReputation ?? 1) * 0.6 + c.rng.normal(0, 3),
  teamwork: (c) =>
    11 + workLevel(c.workRate?.[1]) * 1.5 + workLevel(c.workRate?.[0]) * 0.5 + c.rng.normal(0, 2.5),
  workRate: (c) =>
    c.workRate
      ? 11 + (workLevel(c.workRate[0]) + workLevel(c.workRate[1])) * 2.5 + c.rng.normal(0, 1)
      : at(c, 'stamina') * 0.7 + c.rng.normal(3, 2),
  flair: (c) => (c.skillMoves ? 3 + c.skillMoves * 2.6 : at(c, 'dribbling')) + c.rng.normal(0, 1.5),
  naturalFitness: (c) => (at(c, 'stamina') + at(c, 'strength')) / 2 + c.rng.normal(0.5, 2),
  communication: (c) => (c.isGoalkeeper ? at(c, 'commandOfArea') : 6) + c.rng.normal(0, 2.5),
  eccentricity: (c) => c.rng.normal(c.isGoalkeeper ? 8 : 3, c.isGoalkeeper ? 4 : 1.5),
  punching: (c) => c.rng.normal(c.isGoalkeeper ? 10 : 3, c.isGoalkeeper ? 4 : 1.5),
  throwing: (c) => at(c, 'kicking') + c.rng.normal(0, 2),
};

export interface MappingInput {
  ratings: Ratings;
  primaryPosition: number;
  age: number | null;
  heightCm: number | null;
  skillMoves: number | null;
  workRate: [string, string] | null;
  internationalReputation: number | null;
  rng: Rng;
  /** Calibration offset in 1-20 units (see calibrate.ts). */
  offset?: number;
}

export type AttributeOrigin = 'S' | 'F' | 'D';

export interface MappedAttributes {
  attributes: number[];
  /** One character per attribute in ATTRIBUTE_KEYS order. */
  origin: string;
}

function weighted(ratings: Ratings, rule: Weighted): number | null {
  let sum = 0;
  let wsum = 0;
  for (const [key, w] of rule) {
    const v = ratings[key];
    if (v !== undefined) {
      sum += v * w;
      wsum += w;
    }
  }
  return wsum > 0 ? sum / wsum : null;
}

export function mapAttributes(input: MappingInput): MappedAttributes {
  const offset = input.offset ?? 0;
  const isGoalkeeper = input.primaryPosition === P.GK;
  const raw = new Array<number>(ATTRIBUTE_COUNT).fill(Number.NaN);
  const origin = new Array<AttributeOrigin>(ATTRIBUTE_COUNT).fill('D');

  // 1) Source rules.
  for (const key of ATTRIBUTE_KEYS) {
    const rule = SOURCE_RULES[key];
    if (!rule) continue;
    // Goalkeepers' positioning is their goalkeeping positioning.
    const detailed: Weighted =
      key === 'positioning' && isGoalkeeper ? [['gkPositioning', 1]] : rule.detailed;
    const d = weighted(input.ratings, detailed);
    if (d !== null) {
      raw[A[key]] = scaleRating(d, offset);
      origin[A[key]] = 'S';
      continue;
    }
    const f = weighted(input.ratings, rule.face);
    if (f !== null) {
      raw[A[key]] = scaleRating(f, offset);
      origin[A[key]] = 'F';
    }
  }
  // 2) Anything still missing: a seeded estimate around the player's mapped average.
  const known = raw.filter((v) => !Number.isNaN(v));
  const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 10;
  const attrs = raw.map((v) => (Number.isNaN(v) ? Number.NaN : clamp(v, 1, 20)));
  const ctx: DeriveContext = {
    rng: input.rng,
    attrs: attrs.map((v) => (Number.isNaN(v) ? mean : v)),
    isGoalkeeper,
    age: input.age,
    heightCm: input.heightCm,
    skillMoves: input.skillMoves,
    workRate: input.workRate,
    internationalReputation: input.internationalReputation,
  };
  for (const key of ATTRIBUTE_KEYS) {
    const i = A[key];
    if (!Number.isNaN(attrs[i]!)) continue;
    const derive = DERIVED_RULES[key];
    const value = derive
      ? derive(ctx)
      : isGoalkeeperOnly(key) && !isGoalkeeper
        ? input.rng.normal(2.5, 1)
        : mean + input.rng.normal(0, 2);
    attrs[i] = value;
    ctx.attrs[i] = clamp(value, 1, 20);
  }
  // Height helps aerial reach for keepers (source-backed input, so origin stays as mapped).
  if (isGoalkeeper && input.heightCm)
    attrs[A.aerialReach] = attrs[A.aerialReach]! + (input.heightCm - 188) * 0.12;

  return {
    attributes: attrs.map((v) => roundClamp(v, 1, 20)),
    origin: origin.join(''),
  };
}

const GK_ONLY = new Set<AttributeKey>([
  'aerialReach',
  'commandOfArea',
  'communication',
  'eccentricity',
  'handling',
  'kicking',
  'oneOnOnes',
  'punching',
  'reflexes',
  'rushingOut',
  'throwing',
]);
const isGoalkeeperOnly = (k: AttributeKey) => GK_ONLY.has(k);

/** Attribute keys whose value never comes from the source (documentation and tests). */
export const ALWAYS_DERIVED: readonly AttributeKey[] = ATTRIBUTE_KEYS.filter(
  (k) => !SOURCE_RULES[k],
);
