/**
 * Current/Potential Ability for imported players.
 *
 * Our CA is always computed from attributes with the engine's position weights (so CA, ratings
 * and attributes stay consistent, see DECISIONS D-015). To make imported CA track the source's
 * overall rating, a single global offset (in 1-20 attribute units) is fitted at import time:
 * the offset that makes the median of (our CA − target CA) zero, where
 *   target(rating) = (rating − 28) × 2.85   (source 94 → 188, 85 → 162, 75 → 134, 65 → 105).
 * PA keeps the source's potential headroom on top of our CA: PA = CA + target(potential) − target(overall).
 */
import { clamp, currentAbility, roundClamp } from '@um/engine';

export const targetAbility = (rating: number) => roundClamp((rating - 28) * 2.85, 1, 200);

export function potentialFor(ca: number, overall: number, potential: number): number {
  const headroom = Math.max(0, targetAbility(potential) - targetAbility(overall));
  return clamp(Math.round(ca + headroom), ca, 200);
}

export interface CalibrationSample {
  overall: number;
  primaryPosition: number;
  /** Map attributes for a given offset (deterministic per player). */
  attributesFor: (offset: number) => number[];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface CalibrationResult {
  offset: number;
  /** Median and mean absolute difference between our CA and the target after calibration. */
  medianError: number;
  meanAbsError: number;
  /** Pearson correlation between our CA and the source overall. */
  correlation: number;
  samples: number;
}

/** Fit the global offset by bisection on a sample (≤ 2,000 players is plenty). */
export function calibrateOffset(samples: CalibrationSample[]): CalibrationResult {
  if (!samples.length)
    return { offset: 0, medianError: 0, meanAbsError: 0, correlation: 0, samples: 0 };
  const residual = (offset: number) =>
    median(
      samples.map(
        (s) =>
          currentAbility(s.attributesFor(offset), s.primaryPosition) - targetAbility(s.overall),
      ),
    );
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) hi = mid;
    else lo = mid;
  }
  const offset = Math.round(((lo + hi) / 2) * 1000) / 1000;
  const cas = samples.map((s) => currentAbility(s.attributesFor(offset), s.primaryPosition));
  const targets = samples.map((s) => targetAbility(s.overall));
  const diffs = cas.map((c, i) => c - targets[i]!);
  return {
    offset,
    medianError: median(diffs),
    meanAbsError: diffs.reduce((a, d) => a + Math.abs(d), 0) / diffs.length,
    correlation: pearson(
      cas,
      samples.map((s) => s.overall),
    ),
    samples: samples.length,
  };
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}
