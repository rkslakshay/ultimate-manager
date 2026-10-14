import type { Position } from '../players/positions';

export interface FormationSlot {
  position: Position;
  /** Base shape coordinates in the team's own frame: x 0 own goal → 1 opponent goal; y 0-1. */
  x: number;
  y: number;
}

/** Slot 0 is always the goalkeeper. */
export const FORMATIONS = {
  '4-4-2': [
    { position: 'GK', x: 0.03, y: 0.5 },
    { position: 'DL', x: 0.2, y: 0.12 },
    { position: 'DC', x: 0.17, y: 0.38 },
    { position: 'DC', x: 0.17, y: 0.62 },
    { position: 'DR', x: 0.2, y: 0.88 },
    { position: 'ML', x: 0.45, y: 0.12 },
    { position: 'MC', x: 0.42, y: 0.38 },
    { position: 'MC', x: 0.42, y: 0.62 },
    { position: 'MR', x: 0.45, y: 0.88 },
    { position: 'ST', x: 0.68, y: 0.4 },
    { position: 'ST', x: 0.68, y: 0.6 },
  ],
  '4-2-3-1': [
    { position: 'GK', x: 0.03, y: 0.5 },
    { position: 'DL', x: 0.2, y: 0.12 },
    { position: 'DC', x: 0.17, y: 0.38 },
    { position: 'DC', x: 0.17, y: 0.62 },
    { position: 'DR', x: 0.2, y: 0.88 },
    { position: 'DM', x: 0.34, y: 0.4 },
    { position: 'DM', x: 0.34, y: 0.6 },
    { position: 'AML', x: 0.58, y: 0.14 },
    { position: 'AMC', x: 0.56, y: 0.5 },
    { position: 'AMR', x: 0.58, y: 0.86 },
    { position: 'ST', x: 0.72, y: 0.5 },
  ],
  '4-3-3': [
    { position: 'GK', x: 0.03, y: 0.5 },
    { position: 'DL', x: 0.2, y: 0.12 },
    { position: 'DC', x: 0.17, y: 0.38 },
    { position: 'DC', x: 0.17, y: 0.62 },
    { position: 'DR', x: 0.2, y: 0.88 },
    { position: 'DM', x: 0.33, y: 0.5 },
    { position: 'MC', x: 0.45, y: 0.32 },
    { position: 'MC', x: 0.45, y: 0.68 },
    { position: 'AML', x: 0.64, y: 0.14 },
    { position: 'AMR', x: 0.64, y: 0.86 },
    { position: 'ST', x: 0.72, y: 0.5 },
  ],
  '4-1-4-1': [
    { position: 'GK', x: 0.03, y: 0.5 },
    { position: 'DL', x: 0.2, y: 0.12 },
    { position: 'DC', x: 0.17, y: 0.38 },
    { position: 'DC', x: 0.17, y: 0.62 },
    { position: 'DR', x: 0.2, y: 0.88 },
    { position: 'DM', x: 0.32, y: 0.5 },
    { position: 'ML', x: 0.48, y: 0.12 },
    { position: 'MC', x: 0.46, y: 0.38 },
    { position: 'MC', x: 0.46, y: 0.62 },
    { position: 'MR', x: 0.48, y: 0.88 },
    { position: 'ST', x: 0.7, y: 0.5 },
  ],
  '3-5-2': [
    { position: 'GK', x: 0.03, y: 0.5 },
    { position: 'DC', x: 0.17, y: 0.28 },
    { position: 'DC', x: 0.15, y: 0.5 },
    { position: 'DC', x: 0.17, y: 0.72 },
    { position: 'WBL', x: 0.4, y: 0.08 },
    { position: 'DM', x: 0.34, y: 0.5 },
    { position: 'MC', x: 0.46, y: 0.34 },
    { position: 'MC', x: 0.46, y: 0.66 },
    { position: 'WBR', x: 0.4, y: 0.92 },
    { position: 'ST', x: 0.68, y: 0.4 },
    { position: 'ST', x: 0.68, y: 0.6 },
  ],
  '5-3-2': [
    { position: 'GK', x: 0.03, y: 0.5 },
    { position: 'WBL', x: 0.26, y: 0.08 },
    { position: 'DC', x: 0.16, y: 0.3 },
    { position: 'DC', x: 0.15, y: 0.5 },
    { position: 'DC', x: 0.16, y: 0.7 },
    { position: 'WBR', x: 0.26, y: 0.92 },
    { position: 'MC', x: 0.4, y: 0.3 },
    { position: 'MC', x: 0.38, y: 0.5 },
    { position: 'MC', x: 0.4, y: 0.7 },
    { position: 'ST', x: 0.64, y: 0.4 },
    { position: 'ST', x: 0.64, y: 0.6 },
  ],
} as const satisfies Record<string, readonly FormationSlot[]>;

export type FormationId = keyof typeof FORMATIONS;
export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];
