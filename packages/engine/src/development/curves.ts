/**
 * Age curves for player development (configurable). Values are expected Current Ability change
 * per season for a player with plenty of potential headroom, average playing time and training.
 * Positions age differently: goalkeepers peak and decline later, wide/pacey players earlier.
 */
import { POSITION_GROUP, POSITIONS, P } from '../players/positions';

export interface DevelopmentCurve {
  /** [age, expected CA change per season] pairs; linear interpolation between points. */
  points: readonly (readonly [number, number])[];
}

export const DEFAULT_CURVE: DevelopmentCurve = {
  points: [
    [15, 16],
    [17, 14],
    [19, 11],
    [21, 8],
    [23, 5],
    [25, 2],
    [27, 0.5],
    [29, -1],
    [31, -3.5],
    [33, -7],
    [35, -11],
    [38, -16],
  ],
};

/** Years added to the curve's ages per position group (later peak = positive shift). */
export const POSITION_AGE_SHIFT: Record<'GK' | 'DEF' | 'MID' | 'ATT', number> = {
  GK: 3,
  DEF: 1,
  MID: 0.5,
  ATT: 0,
};

/** Extra early decline for players whose position relies on pace (wide players, strikers). */
const PACE_DEPENDENT = new Set([P.AML, P.AMR, P.ML, P.MR, P.WBL, P.WBR]);

export function expectedSeasonChange(
  age: number,
  position: number,
  curve: DevelopmentCurve = DEFAULT_CURVE,
): number {
  const group = POSITION_GROUP[POSITIONS[position]!];
  const shifted = age - POSITION_AGE_SHIFT[group] + (PACE_DEPENDENT.has(position) ? 0.7 : 0);
  const pts = curve.points;
  if (shifted <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [a1, v1] = pts[i]!;
    if (shifted <= a1) {
      const [a0, v0] = pts[i - 1]!;
      return v0 + ((v1 - v0) * (shifted - a0)) / (a1 - a0);
    }
  }
  return pts.at(-1)![1];
}
