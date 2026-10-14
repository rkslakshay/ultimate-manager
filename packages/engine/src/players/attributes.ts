/**
 * Player attributes (1-20). Stored as a flat number array in this fixed order so the world
 * state stays compact and allocation-light; use the `A` index map to read them:
 * `player.attributes[A.finishing]`.
 *
 * Changing the order is a breaking change for saved worlds: append only.
 */

export const TECHNICAL = [
  'corners',
  'crossing',
  'dribbling',
  'finishing',
  'firstTouch',
  'freeKicks',
  'heading',
  'longShots',
  'longThrows',
  'marking',
  'passing',
  'penaltyTaking',
  'tackling',
  'technique',
] as const;

export const MENTAL = [
  'aggression',
  'anticipation',
  'bravery',
  'composure',
  'concentration',
  'decisions',
  'determination',
  'flair',
  'leadership',
  'offTheBall',
  'positioning',
  'teamwork',
  'vision',
  'workRate',
] as const;

export const PHYSICAL = [
  'acceleration',
  'agility',
  'balance',
  'jumpingReach',
  'naturalFitness',
  'pace',
  'stamina',
  'strength',
] as const;

export const GOALKEEPING = [
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
] as const;

export const ATTRIBUTE_KEYS = [...TECHNICAL, ...MENTAL, ...PHYSICAL, ...GOALKEEPING] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export const ATTRIBUTE_COUNT = ATTRIBUTE_KEYS.length;

export type AttributeGroup = 'technical' | 'mental' | 'physical' | 'goalkeeping';
export const ATTRIBUTE_GROUPS: Record<AttributeGroup, readonly AttributeKey[]> = {
  technical: TECHNICAL,
  mental: MENTAL,
  physical: PHYSICAL,
  goalkeeping: GOALKEEPING,
};

/** Attribute index lookup: `A.pace` → position in the attributes array. */
export const A = Object.fromEntries(ATTRIBUTE_KEYS.map((k, i) => [k, i])) as Record<
  AttributeKey,
  number
>;

/** Hidden attributes (1-20), never shown directly to the user. Append only. */
export const HIDDEN_KEYS = [
  'consistency',
  'injuryProneness',
  'importantMatches',
  'versatility',
  'professionalism',
  'ambition',
  'loyalty',
  'temperament',
  'pressure',
  'sportsmanship',
  'adaptability',
] as const;
export type HiddenKey = (typeof HIDDEN_KEYS)[number];
export const H = Object.fromEntries(HIDDEN_KEYS.map((k, i) => [k, i])) as Record<HiddenKey, number>;

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  corners: 'Corners',
  crossing: 'Crossing',
  dribbling: 'Dribbling',
  finishing: 'Finishing',
  firstTouch: 'First Touch',
  freeKicks: 'Free Kick Taking',
  heading: 'Heading',
  longShots: 'Long Shots',
  longThrows: 'Long Throws',
  marking: 'Marking',
  passing: 'Passing',
  penaltyTaking: 'Penalty Taking',
  tackling: 'Tackling',
  technique: 'Technique',
  aggression: 'Aggression',
  anticipation: 'Anticipation',
  bravery: 'Bravery',
  composure: 'Composure',
  concentration: 'Concentration',
  decisions: 'Decisions',
  determination: 'Determination',
  flair: 'Flair',
  leadership: 'Leadership',
  offTheBall: 'Off the Ball',
  positioning: 'Positioning',
  teamwork: 'Teamwork',
  vision: 'Vision',
  workRate: 'Work Rate',
  acceleration: 'Acceleration',
  agility: 'Agility',
  balance: 'Balance',
  jumpingReach: 'Jumping Reach',
  naturalFitness: 'Natural Fitness',
  pace: 'Pace',
  stamina: 'Stamina',
  strength: 'Strength',
  aerialReach: 'Aerial Reach',
  commandOfArea: 'Command of Area',
  communication: 'Communication',
  eccentricity: 'Eccentricity',
  handling: 'Handling',
  kicking: 'Kicking',
  oneOnOnes: 'One on Ones',
  punching: 'Punching (Tendency)',
  reflexes: 'Reflexes',
  rushingOut: 'Rushing Out (Tendency)',
  throwing: 'Throwing',
};

/**
 * Attributes that matter in every outfield position and to goalkeepers alike; the remaining
 * group (goalkeeping for outfielders, outfield technical for keepers) is mostly irrelevant.
 */
export const UNIVERSAL_KEYS: readonly AttributeKey[] = [...MENTAL, ...PHYSICAL];
