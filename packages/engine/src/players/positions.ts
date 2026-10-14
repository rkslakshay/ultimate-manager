import { A, type AttributeKey, ATTRIBUTE_COUNT } from './attributes';

/** Pitch positions (slots). Order is stored in saved worlds: append only. */
export const POSITIONS = [
  'GK',
  'DL',
  'DC',
  'DR',
  'WBL',
  'WBR',
  'DM',
  'ML',
  'MC',
  'MR',
  'AML',
  'AMC',
  'AMR',
  'ST',
] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_COUNT = POSITIONS.length;
export const P = Object.fromEntries(POSITIONS.map((p, i) => [p, i])) as Record<Position, number>;

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goalkeeper',
  DL: 'Left Back',
  DC: 'Centre Back',
  DR: 'Right Back',
  WBL: 'Left Wing-Back',
  WBR: 'Right Wing-Back',
  DM: 'Defensive Midfielder',
  ML: 'Left Midfielder',
  MC: 'Central Midfielder',
  MR: 'Right Midfielder',
  AML: 'Left Winger',
  AMC: 'Attacking Midfielder',
  AMR: 'Right Winger',
  ST: 'Striker',
};

/**
 * Normalised pitch coordinates for each slot: x 0 (own goal) → 1 (opponent goal),
 * y 0 (left touchline) → 1 (right touchline). Used by the positions map and the match engine.
 */
export const POSITION_COORDS: Record<Position, { x: number; y: number }> = {
  GK: { x: 0.04, y: 0.5 },
  DL: { x: 0.2, y: 0.12 },
  DC: { x: 0.18, y: 0.5 },
  DR: { x: 0.2, y: 0.88 },
  WBL: { x: 0.34, y: 0.08 },
  WBR: { x: 0.34, y: 0.92 },
  DM: { x: 0.34, y: 0.5 },
  ML: { x: 0.5, y: 0.1 },
  MC: { x: 0.48, y: 0.5 },
  MR: { x: 0.5, y: 0.9 },
  AML: { x: 0.68, y: 0.12 },
  AMC: { x: 0.66, y: 0.5 },
  AMR: { x: 0.68, y: 0.88 },
  ST: { x: 0.84, y: 0.5 },
};

/** Coarse role family, used for squad composition and set-piece/AI logic. */
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';
export const POSITION_GROUP: Record<Position, PositionGroup> = {
  GK: 'GK',
  DL: 'DEF',
  DC: 'DEF',
  DR: 'DEF',
  WBL: 'DEF',
  WBR: 'DEF',
  DM: 'MID',
  ML: 'MID',
  MC: 'MID',
  MR: 'MID',
  AML: 'ATT',
  AMC: 'ATT',
  AMR: 'ATT',
  ST: 'ATT',
};

/**
 * Attribute importance per position (0 = irrelevant … 5 = key). These weights drive both
 * Current Ability (how valuable a player's attributes are for his position) and the 1-20
 * position rating. Physical speed is weighted heavily everywhere, as in real scouting.
 */
type Weights = Partial<Record<AttributeKey, number>>;

const OUTFIELD_BASE: Weights = {
  anticipation: 2,
  composure: 2,
  concentration: 2,
  decisions: 3,
  determination: 1,
  teamwork: 1,
  workRate: 1,
  acceleration: 3,
  agility: 1,
  balance: 1,
  naturalFitness: 1,
  pace: 3,
  stamina: 2,
  strength: 1,
  firstTouch: 1,
  passing: 1,
  technique: 1,
};

const PROFILES: Record<Position, Weights> = {
  GK: {
    aerialReach: 3,
    commandOfArea: 3,
    communication: 2,
    handling: 4,
    kicking: 2,
    oneOnOnes: 4,
    reflexes: 5,
    rushingOut: 1,
    throwing: 1,
    anticipation: 2,
    composure: 2,
    concentration: 3,
    decisions: 3,
    positioning: 4,
    agility: 4,
    jumpingReach: 1,
    acceleration: 1,
    firstTouch: 1,
    passing: 1,
  },
  DC: {
    ...OUTFIELD_BASE,
    heading: 4,
    marking: 4,
    tackling: 4,
    positioning: 4,
    bravery: 2,
    jumpingReach: 3,
    strength: 3,
    concentration: 3,
    aggression: 1,
  },
  DL: { ...OUTFIELD_BASE, marking: 3, tackling: 3, positioning: 3, crossing: 2, dribbling: 1 },
  DR: { ...OUTFIELD_BASE, marking: 3, tackling: 3, positioning: 3, crossing: 2, dribbling: 1 },
  WBL: {
    ...OUTFIELD_BASE,
    crossing: 3,
    dribbling: 2,
    tackling: 2,
    marking: 2,
    stamina: 4,
    offTheBall: 2,
  },
  WBR: {
    ...OUTFIELD_BASE,
    crossing: 3,
    dribbling: 2,
    tackling: 2,
    marking: 2,
    stamina: 4,
    offTheBall: 2,
  },
  DM: {
    ...OUTFIELD_BASE,
    tackling: 4,
    marking: 3,
    positioning: 4,
    passing: 3,
    anticipation: 3,
    teamwork: 2,
    workRate: 2,
  },
  MC: {
    ...OUTFIELD_BASE,
    passing: 4,
    vision: 3,
    firstTouch: 3,
    technique: 3,
    tackling: 2,
    teamwork: 2,
    workRate: 2,
    longShots: 1,
    offTheBall: 1,
  },
  ML: {
    ...OUTFIELD_BASE,
    crossing: 4,
    dribbling: 3,
    passing: 2,
    technique: 2,
    workRate: 2,
    stamina: 3,
  },
  MR: {
    ...OUTFIELD_BASE,
    crossing: 4,
    dribbling: 3,
    passing: 2,
    technique: 2,
    workRate: 2,
    stamina: 3,
  },
  AMC: {
    ...OUTFIELD_BASE,
    passing: 4,
    vision: 4,
    technique: 4,
    firstTouch: 3,
    dribbling: 3,
    flair: 2,
    offTheBall: 2,
    longShots: 2,
    composure: 3,
  },
  AML: {
    ...OUTFIELD_BASE,
    dribbling: 4,
    crossing: 3,
    technique: 3,
    flair: 2,
    offTheBall: 2,
    finishing: 2,
    agility: 2,
  },
  AMR: {
    ...OUTFIELD_BASE,
    dribbling: 4,
    crossing: 3,
    technique: 3,
    flair: 2,
    offTheBall: 2,
    finishing: 2,
    agility: 2,
  },
  ST: {
    ...OUTFIELD_BASE,
    finishing: 5,
    offTheBall: 4,
    composure: 3,
    firstTouch: 3,
    heading: 2,
    dribbling: 2,
    technique: 2,
    strength: 2,
    anticipation: 3,
  },
};

/** Dense weight vectors (one number per attribute index) for fast weighted sums. */
export const POSITION_WEIGHTS: readonly (readonly number[])[] = POSITIONS.map((pos) => {
  const weights = new Array<number>(ATTRIBUTE_COUNT).fill(0);
  for (const [key, w] of Object.entries(PROFILES[pos])) weights[A[key as AttributeKey]] = w;
  return weights;
});

/** Sum of weights per position (precomputed denominator). */
export const POSITION_WEIGHT_TOTALS: readonly number[] = POSITION_WEIGHTS.map((w) =>
  w.reduce((a, b) => a + b, 0),
);

/**
 * Positions that naturally neighbour each other: a player gets partial familiarity in
 * these when generated (e.g. a right back can usually play right wing-back).
 */
export const RELATED_POSITIONS: Record<Position, readonly Position[]> = {
  GK: [],
  DL: ['WBL', 'DC', 'ML'],
  DC: ['DL', 'DR', 'DM'],
  DR: ['WBR', 'DC', 'MR'],
  WBL: ['DL', 'ML', 'AML'],
  WBR: ['DR', 'MR', 'AMR'],
  DM: ['MC', 'DC'],
  ML: ['AML', 'WBL', 'MC'],
  MC: ['DM', 'AMC', 'ML', 'MR'],
  MR: ['AMR', 'WBR', 'MC'],
  AML: ['ML', 'AMC', 'ST', 'AMR'],
  AMC: ['MC', 'ST', 'AML', 'AMR'],
  AMR: ['MR', 'AMC', 'ST', 'AML'],
  ST: ['AMC', 'AML', 'AMR'],
};
