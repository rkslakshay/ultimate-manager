import { type DayNumber, addYears } from '../core/date';
import { clamp, roundClamp } from '../core/math';
import type { NameFlavour } from '../names/flavours';
import { generatePersonName } from '../names/generate';
import type { Rng } from '../rng/rng';
import type { Foot, Player } from '../world/types';
import { abilityToScore, currentAbility } from './ability';
import { A, ATTRIBUTE_COUNT, GOALKEEPING, H, HIDDEN_KEYS, MENTAL, TECHNICAL } from './attributes';
import { P, POSITION_COUNT, POSITION_WEIGHTS, POSITIONS, RELATED_POSITIONS } from './positions';
import { pickTraits } from './traits';

export interface PlayerSpec {
  id: number;
  nationId: number;
  flavour: NameFlavour;
  /** Index into POSITIONS. */
  position: number;
  age: number;
  /** Target Current Ability (1-200); the result lands within a couple of points. */
  targetCa: number;
  /** Day the age is measured on (career start). */
  referenceDay: DayNumber;
  /** Chance (0-1) of an exceptional potential, for young players. */
  wonderkidChance?: number;
}

const GK_INDEXES = new Set(GOALKEEPING.map((k) => A[k]));
const OUTFIELD_TECH_INDEXES = new Set(TECHNICAL.map((k) => A[k]));
const MENTAL_INDEXES = MENTAL.map((k) => A[k]);

/** Expected potential headroom above current ability by age. */
function potentialHeadroom(rng: Rng, age: number): number {
  if (age <= 18) return rng.normal(38, 18);
  if (age <= 20) return rng.normal(28, 14);
  if (age <= 22) return rng.normal(16, 10);
  if (age <= 24) return rng.normal(8, 6);
  if (age <= 27) return rng.normal(2, 3);
  return 0;
}

function generateAttributes(rng: Rng, position: number, targetCa: number, age: number): number[] {
  const isGk = position === P.GK;
  const weights = POSITION_WEIGHTS[position] as readonly number[];
  const level = abilityToScore(targetCa);
  const attrs = new Array<number>(ATTRIBUTE_COUNT);
  for (let i = 0; i < ATTRIBUTE_COUNT; i++) {
    const w = weights[i] as number;
    if (!isGk && GK_INDEXES.has(i)) {
      attrs[i] = rng.int(1, 4);
    } else if (isGk && OUTFIELD_TECH_INDEXES.has(i)) {
      attrs[i] = rng.normal(level * 0.45, 1.5);
    } else if (w > 0) {
      attrs[i] = rng.normal(level + (w - 2) * 0.55, 1.6);
    } else {
      // Unweighted attributes (set pieces, leadership, flair…) vary more widely.
      attrs[i] = rng.normal(level - 1.5, 3);
    }
  }
  // Age shapes the profile: veterans lose explosiveness but read the game better.
  if (age >= 30) {
    const decline = (age - 29) * 0.55;
    for (const i of [A.pace, A.acceleration, A.agility, A.stamina])
      attrs[i] = (attrs[i] as number) - decline;
    for (const i of [A.decisions, A.positioning, A.anticipation, A.composure, A.leadership]) {
      attrs[i] = (attrs[i] as number) + Math.min(2.5, (age - 28) * 0.4);
    }
  } else if (age <= 19) {
    for (const i of MENTAL_INDEXES) attrs[i] = (attrs[i] as number) - 0.8;
  }
  for (let i = 0; i < ATTRIBUTE_COUNT; i++) attrs[i] = roundClamp(attrs[i] as number, 1, 20);

  // Nudge weighted attributes until the derived ability matches the target.
  for (let pass = 0; pass < 8; pass++) {
    const diff = targetCa - currentAbility(attrs, position);
    if (Math.abs(diff) <= 1) break;
    const step = diff / 10.5;
    for (let i = 0; i < ATTRIBUTE_COUNT; i++) {
      if ((weights[i] as number) > 0) {
        const jitter = rng.float(0.6, 1.4);
        attrs[i] = roundClamp((attrs[i] as number) + step * jitter, 1, 20);
      }
    }
  }
  return attrs;
}

function generatePositions(rng: Rng, primary: number, versatility: number): number[] {
  const positions = new Array<number>(POSITION_COUNT).fill(1);
  positions[primary] = 20;
  if (primary === P.GK) return positions;
  const related = RELATED_POSITIONS[POSITIONS[primary]!];
  for (const pos of related) {
    if (rng.chance(0.35 + versatility / 50)) positions[P[pos]] = rng.int(8, 18);
  }
  // Occasionally a genuinely versatile player is natural in a second position.
  if (versatility >= 15 && related.length && rng.chance(0.4)) positions[P[rng.pick(related)]] = 20;
  return positions;
}

function generateBody(rng: Rng, position: number): { heightCm: number; weightKg: number } {
  const mean =
    position === P.GK
      ? 190
      : position === P.DC
        ? 187
        : position === P.ST
          ? 182
          : [P.AML, P.AMR, P.ML, P.MR].includes(position)
            ? 176
            : 180;
  const heightCm = roundClamp(rng.normal(mean, 5.5), 163, 203);
  const weightKg = roundClamp(heightCm - 104 + rng.normal(0, 4), 58, 100);
  return { heightCm, weightKg };
}

function generateFoot(rng: Rng, position: number): { foot: Foot; weakFoot: number } {
  const leftSided = [P.DL, P.WBL, P.ML, P.AMR].includes(position); // inverted wingers on the right
  const foot: Foot = rng.weighted<Foot>(
    ['right', 'left', 'either'],
    leftSided ? [30, 62, 8] : [74, 19, 7],
  );
  const weakFoot = foot === 'either' ? rng.int(16, 20) : roundClamp(rng.normal(8, 3.5), 1, 18);
  return { foot, weakFoot };
}

function generateHidden(rng: Rng, attrs: readonly number[]): number[] {
  const hidden = HIDDEN_KEYS.map(() => roundClamp(rng.normal(11, 3.8), 1, 20));
  // Professionalism tracks determination; consistency and big-match temperament track composure.
  hidden[H.professionalism] = roundClamp(
    ((hidden[H.professionalism] as number) + (attrs[A.determination] as number)) / 2 +
      rng.normal(0, 1.5),
    1,
    20,
  );
  hidden[H.consistency] = roundClamp(
    ((hidden[H.consistency] as number) + (attrs[A.composure] as number)) / 2,
    1,
    20,
  );
  hidden[H.importantMatches] = roundClamp(
    ((hidden[H.importantMatches] as number) + (attrs[A.composure] as number)) / 2,
    1,
    20,
  );
  return hidden;
}

/** Generate one player matching the spec. Deterministic for a given RNG state. */
export function generatePlayer(rng: Rng, spec: PlayerSpec): Player {
  const { firstName, lastName } = generatePersonName(rng, spec.flavour);
  const targetCa = clamp(Math.round(spec.targetCa), 20, 195);
  const attributes = generateAttributes(rng, spec.position, targetCa, spec.age);
  const hidden = generateHidden(rng, attributes);
  const positions = generatePositions(rng, spec.position, hidden[H.versatility] as number);
  const ca = currentAbility(attributes, spec.position);

  let pa = ca + Math.max(0, Math.round(potentialHeadroom(rng, spec.age)));
  if (spec.age <= 19 && rng.chance(spec.wonderkidChance ?? 0)) pa = Math.max(pa, rng.int(160, 192));
  pa = clamp(pa, ca, 200);

  // Birthday: `age` full years before the reference day, minus a random part of a year.
  const birthDay = addYears(spec.referenceDay, -spec.age) - rng.int(1, 364);

  return {
    id: spec.id,
    firstName,
    lastName,
    nationId: spec.nationId,
    birthDay,
    ...generateBody(rng, spec.position),
    ...generateFoot(rng, spec.position),
    attributes,
    hidden,
    positions,
    primaryPosition: spec.position,
    ca,
    pa,
    traits: pickTraits(rng, attributes, spec.position, spec.age),
    clubId: null,
    contract: null,
    value: 0,
    retired: false,
  };
}
