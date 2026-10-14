import {
  A,
  ATTRIBUTE_COUNT,
  ATTRIBUTE_KEYS,
  createRng,
  currentAbility,
  H,
  HIDDEN_KEYS,
  P,
} from '@um/engine';
import { describe, expect, it } from 'vitest';
import { potentialFor, targetAbility, calibrateOffset } from '../src/mapping/ability';
import { ALWAYS_DERIVED, mapAttributes, scaleRating } from '../src/mapping/attributes';
import { deriveHidden } from '../src/mapping/hidden';
import { mapEaPositions, mapTmPosition } from '../src/mapping/positions';
import { mapTraits } from '../src/mapping/traits';
import { RATING_KEYS, type Ratings } from '../src/sources/records';

const fullRatings = (v: number): Ratings => Object.fromEntries(RATING_KEYS.map((k) => [k, v]));
const input = (ratings: Ratings, position = P.ST, seed = 'p1') => ({
  ratings,
  primaryPosition: position,
  age: 25,
  heightCm: 182,
  skillMoves: 3,
  workRate: ['High', 'Medium'] as [string, string],
  internationalReputation: 2,
  rng: createRng(seed),
});

describe('rating scale', () => {
  it('maps 25 → 1 and 95 → 20 linearly, with an offset', () => {
    expect(scaleRating(25)).toBeCloseTo(1);
    expect(scaleRating(95)).toBeCloseTo(20);
    expect(scaleRating(60)).toBeCloseTo(10.5);
    expect(scaleRating(60, 1.5)).toBeCloseTo(12);
  });
});

describe('mapAttributes', () => {
  it('produces 47 integers in 1-20 and is deterministic per seed', () => {
    const a = mapAttributes(input(fullRatings(80)));
    const b = mapAttributes(input(fullRatings(80)));
    expect(a).toEqual(b);
    expect(a.attributes).toHaveLength(ATTRIBUTE_COUNT);
    for (const v of a.attributes) expect(Number.isInteger(v) && v >= 1 && v <= 20).toBe(true);
    expect(mapAttributes(input(fullRatings(80), P.ST, 'other')).attributes).not.toEqual(
      a.attributes,
    );
  });

  it('never assigns one overall value to every attribute: detailed ratings drive each one', () => {
    const r = fullRatings(60);
    r.finishing = 95;
    r.slidingTackle = 20;
    r.standingTackle = 20;
    const m = mapAttributes(input(r));
    expect(m.attributes[A.finishing]).toBeGreaterThanOrEqual(19);
    expect(m.attributes[A.tackling]).toBeLessThanOrEqual(2);
    expect(m.attributes[A.passing]).toBe(Math.round(scaleRating(60)));
  });

  it('records provenance: S for source, F for face-stat fallback, D for derived', () => {
    const detailed = mapAttributes(input(fullRatings(70)));
    for (const key of ATTRIBUTE_KEYS) {
      expect(detailed.origin[A[key]]).toBe(ALWAYS_DERIVED.includes(key) ? 'D' : 'S');
    }
    const face = mapAttributes(
      input({ pace: 90, shooting: 80, passing: 70, dribbling: 75, defending: 40, physic: 65 }),
    );
    expect(face.origin[A.pace]).toBe('F');
    expect(face.attributes[A.pace]).toBeGreaterThan(face.attributes[A.tackling]!);
    const none = mapAttributes(input({}));
    expect([...none.origin].every((c) => c === 'D')).toBe(true);
  });

  it('uses goalkeeping positioning for goalkeepers and outfield positioning otherwise', () => {
    const r = fullRatings(50);
    r.gkPositioning = 90;
    r.markingAwareness = 30;
    r.interceptions = 30;
    expect(mapAttributes(input(r, P.GK)).attributes[A.positioning]).toBeGreaterThan(17);
    expect(mapAttributes(input(r, P.DC)).attributes[A.positioning]).toBeLessThan(6);
  });

  it('keeps derived attributes plausible for missing data', () => {
    const m = mapAttributes(input({}, P.MC));
    expect(Math.min(...m.attributes.filter((_, i) => i < A.aerialReach))).toBeGreaterThanOrEqual(1);
    // Outfield players without goalkeeping data get low goalkeeping attributes.
    expect(m.attributes[A.reflexes]).toBeLessThanOrEqual(6);
  });
});

describe('ability', () => {
  it('maps source ratings onto the 1-200 scale monotonically', () => {
    expect(targetAbility(94)).toBeGreaterThan(targetAbility(85));
    expect(targetAbility(94)).toBeGreaterThanOrEqual(185);
    expect(targetAbility(50)).toBeLessThan(70);
    expect(targetAbility(5)).toBe(1);
  });

  it('keeps potential ≥ current and preserves the source headroom', () => {
    expect(potentialFor(120, 70, 70)).toBe(120);
    expect(potentialFor(120, 70, 80)).toBe(120 + targetAbility(80) - targetAbility(70));
    expect(potentialFor(195, 90, 99)).toBe(200);
  });

  it('calibrates the offset so CA tracks the source overall across positions', () => {
    const rng = createRng('calibration');
    const samples = Array.from({ length: 300 }, (_, i) => {
      const overall = rng.int(50, 90);
      const pos = [P.GK, P.DC, P.MC, P.ST, P.AML][i % 5]!;
      const ratings = Object.fromEntries(RATING_KEYS.map((k) => [k, overall + rng.normal(0, 4)]));
      return {
        overall,
        primaryPosition: pos,
        attributesFor: (offset: number) =>
          mapAttributes({ ...input(ratings, pos, `s${i}`), offset }).attributes,
      };
    });
    const result = calibrateOffset(samples);
    expect(Math.abs(result.medianError)).toBeLessThanOrEqual(2);
    expect(result.correlation).toBeGreaterThan(0.9);
    // No position is systematically far off after calibration.
    for (const pos of [P.GK, P.DC, P.MC, P.ST]) {
      const own = samples.filter((s) => s.primaryPosition === pos);
      const err =
        own.reduce(
          (a, s) =>
            a + currentAbility(s.attributesFor(result.offset), pos) - targetAbility(s.overall),
          0,
        ) / own.length;
      expect(Math.abs(err)).toBeLessThan(20);
    }
  });
});

describe('hidden attributes', () => {
  const attrs = new Array<number>(ATTRIBUTE_COUNT).fill(12);
  it('are derived deterministically and flagged D', () => {
    const a = deriveHidden({
      rng: createRng('h'),
      attributes: attrs,
      overall: 75,
      positionsListed: 2,
      internationalReputation: 2,
      traits: [],
    });
    const b = deriveHidden({
      rng: createRng('h'),
      attributes: attrs,
      overall: 75,
      positionsListed: 2,
      internationalReputation: 2,
      traits: [],
    });
    expect(a).toEqual(b);
    expect(a.hidden).toHaveLength(HIDDEN_KEYS.length);
    expect(a.origin).toBe('D'.repeat(HIDDEN_KEYS.length));
  });

  it('turn a source injury-prone trait into a source-backed high injury proneness', () => {
    const m = deriveHidden({
      rng: createRng('h'),
      attributes: attrs,
      overall: 75,
      positionsListed: 1,
      internationalReputation: 1,
      traits: ['Injury Prone'],
    });
    expect(m.hidden[H.injuryProneness]).toBeGreaterThanOrEqual(16);
    expect(m.origin[H.injuryProneness]).toBe('S');
  });
});

describe('positions and traits', () => {
  it('maps source position codes with familiarity by listed order', () => {
    const m = mapEaPositions(['RW', 'ST', 'XYZ']);
    expect(m.primary).toBe(P.AMR);
    expect(m.familiarity[P.AMR]).toBe(20);
    expect(m.familiarity[P.ST]).toBe(18);
    expect(m.unknown).toEqual(['XYZ']);
    expect(mapEaPositions(['GK']).familiarity.filter((f) => f > 1)).toEqual([20]);
    expect(mapTmPosition('Defender', 'Left-Back').primary).toBe(P.DL);
    expect(mapTmPosition('Attack', null).primary).toBe(P.ST);
  });

  it('maps known trait keywords and reports the rest', () => {
    const t = mapTraits(['Long Shot Taker (AI)', 'Flair', 'Leadership', 'Something New']);
    expect(t.traits).toEqual(['shootsFromDistance', 'triesTricks']);
    expect(t.unmapped).toEqual(['Leadership', 'Something New']);
  });
});
