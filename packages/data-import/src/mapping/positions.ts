import { P, POSITION_COUNT, RELATED_POSITIONS, POSITIONS, type Position } from '@um/engine';

/** EA-style position codes → our slots. "CF" covers both striker and attacking midfield. */
const EA_CODES: Record<string, Position[]> = {
  GK: ['GK'],
  CB: ['DC'],
  LB: ['DL'],
  RB: ['DR'],
  LWB: ['WBL'],
  RWB: ['WBR'],
  CDM: ['DM'],
  CM: ['MC'],
  LM: ['ML'],
  RM: ['MR'],
  CAM: ['AMC'],
  LW: ['AML'],
  RW: ['AMR'],
  LF: ['AML', 'ST'],
  RF: ['AMR', 'ST'],
  CF: ['ST', 'AMC'],
  ST: ['ST'],
};

/** Transfermarkt-style sub-position labels → our slots (used when no ratings source has them). */
const TM_SUB_POSITIONS: Record<string, Position> = {
  goalkeeper: 'GK',
  'centre-back': 'DC',
  'left-back': 'DL',
  'right-back': 'DR',
  'defensive midfield': 'DM',
  'central midfield': 'MC',
  'left midfield': 'ML',
  'right midfield': 'MR',
  'attacking midfield': 'AMC',
  'left winger': 'AML',
  'right winger': 'AMR',
  'second striker': 'ST',
  'centre-forward': 'ST',
};
const TM_POSITIONS: Record<string, Position> = {
  goalkeeper: 'GK',
  defender: 'DC',
  midfield: 'MC',
  attack: 'ST',
};

export interface MappedPositions {
  primary: number;
  /** Familiarity 1-20 per slot. */
  familiarity: number[];
  /** Source codes we could not map. */
  unknown: string[];
}

/**
 * Familiarity from a source's ordered position list: first listed = natural (20), then 18, 16
 * (all source-backed); neighbouring slots of the primary get a modest derived familiarity.
 */
export function mapEaPositions(codes: readonly string[]): MappedPositions {
  const familiarity = new Array<number>(POSITION_COUNT).fill(1);
  const unknown: string[] = [];
  let primary = -1;
  codes.forEach((code, rank) => {
    const slots = EA_CODES[code];
    if (!slots) {
      unknown.push(code);
      return;
    }
    slots.forEach((slot, j) => {
      const value = Math.max(20 - rank * 2 - j * 3, 12);
      const idx = P[slot];
      if (value > (familiarity[idx] ?? 1)) familiarity[idx] = value;
      if (primary < 0) primary = idx;
    });
  });
  if (primary < 0) primary = P.MC;
  familiarity[primary] = 20;
  if (primary !== P.GK) {
    for (const rel of RELATED_POSITIONS[POSITIONS[primary]!]) {
      const idx = P[rel];
      if ((familiarity[idx] ?? 1) < 8) familiarity[idx] = 8;
    }
  }
  return { primary, familiarity, unknown };
}

export function mapTmPosition(
  position: string | null,
  subPosition: string | null,
): MappedPositions {
  const sub = subPosition ? TM_SUB_POSITIONS[subPosition.trim().toLowerCase()] : undefined;
  const main = position ? TM_POSITIONS[position.trim().toLowerCase()] : undefined;
  const slot = sub ?? main ?? 'MC';
  const mapped = mapEaPositions([OURS_TO_EA[slot]]);
  return { ...mapped, unknown: sub || main ? [] : [subPosition ?? position ?? '?'] };
}

const OURS_TO_EA: Record<Position, string> = {
  GK: 'GK',
  DL: 'LB',
  DC: 'CB',
  DR: 'RB',
  WBL: 'LWB',
  WBR: 'RWB',
  DM: 'CDM',
  ML: 'LM',
  MC: 'CM',
  MR: 'RM',
  AML: 'LW',
  AMC: 'CAM',
  AMR: 'RW',
  ST: 'ST',
};

export const isGoalkeeperSlot = (slot: number) => slot === P.GK;
