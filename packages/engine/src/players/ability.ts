import { clamp } from '../core/math';
import { POSITION_COUNT, POSITION_WEIGHT_TOTALS, POSITION_WEIGHTS } from './positions';

/** Weighted mean (1-20) of a player's attributes for a position. */
export function weightedAttributeScore(attributes: readonly number[], position: number): number {
  const weights = POSITION_WEIGHTS[position];
  const total = POSITION_WEIGHT_TOTALS[position];
  if (!weights || !total) throw new RangeError(`Unknown position index ${position}`);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] as number;
    if (w) acc += w * (attributes[i] as number);
  }
  return acc / total;
}

/** Map a 1-20 weighted score onto the 1-200 Current Ability scale. */
export const scoreToAbility = (score: number): number =>
  clamp(Math.round((score - 1) * 10.5), 1, 200);

/** Inverse of `scoreToAbility`: the weighted score that yields a given ability. */
export const abilityToScore = (ability: number): number => ability / 10.5 + 1;

/** Current Ability (1-200) for the player's natural position. */
export function currentAbility(attributes: readonly number[], primaryPosition: number): number {
  return scoreToAbility(weightedAttributeScore(attributes, primaryPosition));
}

/** Penalty multiplier for playing out of position, from familiarity 1-20. */
export function familiarityFactor(familiarity: number): number {
  // 20 → 1.0, 15 → 0.94, 10 → 0.8, 5 → 0.62, 1 → 0.5
  const f = clamp(familiarity, 1, 20);
  return 0.5 + 0.5 * (1 - ((20 - f) / 19) ** 1.6);
}

/**
 * How good the player is in a position on a 1-20 scale (one decimal), combining attribute
 * fit for that position with how familiar he is playing there.
 */
export function positionRating(
  attributes: readonly number[],
  positions: readonly number[],
  position: number,
): number {
  const score = weightedAttributeScore(attributes, position);
  const rating = score * familiarityFactor(positions[position] ?? 1);
  return Math.round(clamp(rating, 1, 20) * 10) / 10;
}

/** Ratings for all positions, in POSITIONS order. */
export function allPositionRatings(
  attributes: readonly number[],
  positions: readonly number[],
): number[] {
  return Array.from({ length: POSITION_COUNT }, (_, p) => positionRating(attributes, positions, p));
}

/** Star rating (0.5-5 in half steps) for an ability value on the 1-200 scale. */
export function abilityStars(ability: number): number {
  return clamp(Math.round((ability / 40) * 2) / 2, 0.5, 5);
}
