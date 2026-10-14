/**
 * Player progression: applyProgression(player, context) → new player + attribute changes.
 *
 * Deterministic for identical inputs (all randomness comes from the context RNG). Inputs that
 * will come from the match engine and training (minutes, ratings, injuries) are explicit in
 * the context; until Phases 2-5 exist, only tests and the headless simulator provide them.
 *
 * Hard rules:
 *  - attributes stay 1-20; per review an attribute moves at most 1 point (monthly) or 2 (season)
 *  - CA change per review is capped (MONTHLY_CAP / SEASON_CAP) and growth never exceeds PA
 *  - PA never changes here (it only floors at CA if an edit pushed CA above it)
 *  - form/morale are not inputs to long-term attributes except through bounded modifiers
 */
import { ageOn, type DayNumber } from '../core/date';
import { clamp } from '../core/math';
import { currentAbility } from '../players/ability';
import {
  A,
  ATTRIBUTE_COUNT,
  GOALKEEPING,
  H,
  MENTAL,
  PHYSICAL,
  TECHNICAL,
  type AttributeGroup,
} from '../players/attributes';
import { P, POSITION_WEIGHTS } from '../players/positions';
import type { Rng } from '../rng/rng';
import type { Player } from '../world/types';
import { expectedSeasonChange, type DevelopmentCurve } from './curves';

export type ReviewKind = 'monthly' | 'season';

export interface ProgressionContext {
  today: DayNumber;
  kind: ReviewKind;
  rng: Rng;
  /** Share of available match minutes played in the period, 0-1. */
  minutesShare: number;
  /** Average match rating in the period (1-10), null when he didn't play. */
  averageRating: number | null;
  /** Quality of coaching and facilities, 1-20. */
  trainingQuality: number;
  /** Attribute group emphasised in individual training, if any. */
  trainingFocus?: AttributeGroup | null;
  /** Days injured during the period. */
  injuredDays: number;
  /** Average CA of the players he competes with (team/league level), for "playing level". */
  levelCa: number;
  curve?: DevelopmentCurve;
}

export interface AttributeChange {
  attribute: number;
  from: number;
  to: number;
  reason: 'growth' | 'decline' | 'training';
}

export interface ProgressionResult {
  player: Player;
  changes: AttributeChange[];
  caBefore: number;
  caAfter: number;
  /** Expected CA change before rounding (for diagnostics and tests). */
  expected: number;
}

/** Share of a season's expected change applied at each review. */
export const MONTHLY_SHARE = 0.05; // 12 months → 60 %
export const SEASON_SHARE = 0.4;
export const MONTHLY_CAP = 3;
export const SEASON_CAP = 10;

const GROUP_INDEXES: Record<AttributeGroup, number[]> = {
  technical: TECHNICAL.map((k) => A[k]),
  mental: MENTAL.map((k) => A[k]),
  physical: PHYSICAL.map((k) => A[k]),
  goalkeeping: GOALKEEPING.map((k) => A[k]),
};
const EXPLOSIVE = new Set([
  A.pace,
  A.acceleration,
  A.agility,
  A.stamina,
  A.naturalFitness,
  A.balance,
  A.jumpingReach,
]);
const EXPERIENCE = new Set([
  A.decisions,
  A.positioning,
  A.anticipation,
  A.composure,
  A.concentration,
  A.leadership,
  A.teamwork,
  A.vision,
]);

/** Multiplier on growth from the period's playing time, performance, training and personality. */
export function growthModifier(player: Player, ctx: ProgressionContext): number {
  // Teenagers also develop through youth and reserve football, so first-team minutes matter less.
  const age = ageOn(player.birthDay, ctx.today);
  const base = age < 19 ? 0.65 : age < 21 ? 0.5 : 0.35;
  const minutes = base + (1 - base) * clamp(ctx.minutesShare, 0, 1);
  const rating =
    ctx.averageRating === null ? 0 : clamp((ctx.averageRating - 6.7) * 0.25, -0.25, 0.3);
  const training = 0.8 + (clamp(ctx.trainingQuality, 1, 20) / 20) * 0.4;
  const professionalism = 0.85 + ((player.hidden[H.professionalism] ?? 10) / 20) * 0.3;
  const periodDays = ctx.kind === 'monthly' ? 30 : 365;
  const injury = 1 - clamp(ctx.injuredDays / periodDays, 0, 1) * 0.7;
  // Playing against stronger players helps a little; being far above the level stalls growth.
  const level = clamp(1 + (ctx.levelCa - player.ca) / 200, 0.85, 1.15);
  return Math.max(0, (minutes + rating) * training * professionalism * injury * level);
}

/** Multiplier on decline: fitness and professionalism slow it, injuries speed it up. */
function declineModifier(player: Player, ctx: ProgressionContext): number {
  const fitness = 1.2 - ((player.attributes[A.naturalFitness] ?? 10) / 20) * 0.4;
  const professionalism = 1.1 - ((player.hidden[H.professionalism] ?? 10) / 20) * 0.2;
  const periodDays = ctx.kind === 'monthly' ? 30 : 365;
  const injury = 1 + clamp(ctx.injuredDays / periodDays, 0, 1) * 0.5;
  return fitness * professionalism * injury;
}

/** Expected CA change for this review (unrounded). */
export function expectedChange(player: Player, ctx: ProgressionContext): number {
  const age = ageOn(player.birthDay, ctx.today);
  const base = expectedSeasonChange(age, player.primaryPosition, ctx.curve);
  const share = ctx.kind === 'monthly' ? MONTHLY_SHARE : SEASON_SHARE;
  if (base > 0) {
    const headroom = Math.max(0, player.pa - player.ca);
    // Growth slows as a player approaches his potential, and is faster for players with a lot
    // of untapped potential (wonderkids develop quicker than average prospects).
    const headroomFactor = clamp((headroom / 35) ** 0.6, 0, 1.6);
    return Math.min(headroom, base * share * headroomFactor * growthModifier(player, ctx));
  }
  return base * share * declineModifier(player, ctx);
}

/** Relative chance that an attribute is the one that changes, given age and direction. */
function attributeWeight(
  player: Player,
  index: number,
  growing: boolean,
  age: number,
  focus: AttributeGroup | null,
): number {
  const isGk = player.primaryPosition === P.GK;
  const positionWeight = (POSITION_WEIGHTS[player.primaryPosition]![index] ?? 0) + 0.6;
  if (!isGk && GROUP_INDEXES.goalkeeping.includes(index)) return 0;
  let w = positionWeight;
  if (growing) {
    if (EXPERIENCE.has(index)) w *= age < 21 ? 0.7 : 1.2;
    if (EXPLOSIVE.has(index)) w *= age < 21 ? 1.4 : age > 26 ? 0.2 : 0.8;
    if (focus && GROUP_INDEXES[focus].includes(index)) w *= 2.2;
  } else {
    // Physical decline first; experience attributes hold up (and can still improve, see below).
    if (EXPLOSIVE.has(index)) w *= 3;
    else if (EXPERIENCE.has(index)) w *= age < 33 ? 0.1 : 0.6;
  }
  return w;
}

export function applyProgression(player: Player, ctx: ProgressionContext): ProgressionResult {
  const caBefore = player.ca;
  const expected = expectedChange(player, ctx);
  const cap = ctx.kind === 'monthly' ? MONTHLY_CAP : SEASON_CAP;
  // Stochastic rounding keeps small monthly expectations unbiased over a season.
  const whole = Math.floor(Math.abs(expected));
  const target =
    Math.sign(expected) * (whole + (ctx.rng.chance(Math.abs(expected) - whole) ? 1 : 0));
  const targetCa = clamp(caBefore + clamp(target, -cap, cap), 1, Math.max(player.pa, caBefore));
  const perAttributeLimit = ctx.kind === 'monthly' ? 1 : 2;
  const age = ageOn(player.birthDay, ctx.today);
  const attrs = [...player.attributes];
  const moved = new Array<number>(ATTRIBUTE_COUNT).fill(0);
  const changes = new Map<number, AttributeChange>();
  const focus = ctx.trainingFocus ?? null;

  const step = (growing: boolean): boolean => {
    const candidates: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i < ATTRIBUTE_COUNT; i++) {
      const v = attrs[i]!;
      if (Math.abs(moved[i]!) >= perAttributeLimit) continue;
      if (growing ? v >= 20 : v <= 1) continue;
      const w = attributeWeight(player, i, growing, age, focus);
      if (w > 0) {
        candidates.push(i);
        weights.push(w);
      }
    }
    if (!candidates.length) return false;
    const i = ctx.rng.weighted(candidates, weights);
    const from = attrs[i]!;
    attrs[i] = from + (growing ? 1 : -1);
    moved[i]! += growing ? 1 : -1;
    const reason: AttributeChange['reason'] = growing
      ? focus && GROUP_INDEXES[focus].includes(i)
        ? 'training'
        : 'growth'
      : 'decline';
    const prev = changes.get(i);
    changes.set(i, {
      attribute: i,
      from: prev?.from ?? from,
      to: attrs[i]!,
      reason: prev?.reason ?? reason,
    });
    return true;
  };

  let ca = caBefore;
  let guard = 0;
  while (ca !== targetCa && guard++ < 60) {
    const growing = ca < targetCa;
    if (!step(growing)) break;
    ca = currentAbility(attrs, player.primaryPosition);
    // Stop if one step overshot the target in the growth direction past PA.
    if (growing && ca > Math.max(player.pa, caBefore)) {
      // undo the last change
      const last = [...changes.values()].at(-1)!;
      attrs[last.attribute] = attrs[last.attribute]! - 1;
      moved[last.attribute]! -= 1;
      if (attrs[last.attribute] === last.from) changes.delete(last.attribute);
      else changes.set(last.attribute, { ...last, to: attrs[last.attribute]! });
      ca = currentAbility(attrs, player.primaryPosition);
      break;
    }
  }
  // Experienced players keep refining decision-making even while physically declining.
  if (target < 0 && age >= 28 && age <= 33 && ctx.rng.chance(ctx.kind === 'season' ? 0.5 : 0.05)) {
    const pool = [A.decisions, A.positioning, A.anticipation, A.composure].filter(
      (i) => attrs[i]! < 20 && moved[i] === 0,
    );
    if (pool.length) {
      const i = ctx.rng.pick(pool);
      changes.set(i, { attribute: i, from: attrs[i]!, to: attrs[i]! + 1, reason: 'growth' });
      attrs[i] = attrs[i]! + 1;
      ca = currentAbility(attrs, player.primaryPosition);
    }
  }

  const caAfter = ca;
  return {
    player: { ...player, attributes: attrs, ca: caAfter, pa: Math.max(player.pa, caAfter) },
    changes: [...changes.values()]
      .filter((c) => c.from !== c.to)
      .sort((a, b) => a.attribute - b.attribute),
    caBefore,
    caAfter,
    expected,
  };
}
