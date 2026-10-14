import type { DayNumber } from '@um/engine';

/** Detailed 0-99 ratings an EA-style source can provide (keys from EA_PLAYERS). */
export const RATING_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physic',
  'crossing',
  'finishing',
  'headingAccuracy',
  'shortPassing',
  'volleys',
  'skillDribbling',
  'curve',
  'fkAccuracy',
  'longPassing',
  'ballControl',
  'acceleration',
  'sprintSpeed',
  'agility',
  'reactions',
  'balance',
  'shotPower',
  'jumping',
  'stamina',
  'strength',
  'longShots',
  'aggression',
  'interceptions',
  'positioning',
  'vision',
  'penalties',
  'composure',
  'markingAwareness',
  'standingTackle',
  'slidingTackle',
  'gkDiving',
  'gkHandling',
  'gkKicking',
  'gkPositioning',
  'gkReflexes',
  'gkSpeed',
] as const;
export type RatingKey = (typeof RATING_KEYS)[number];
export type Ratings = Partial<Record<RatingKey, number>>;

/** One player row from an EA-style ratings table. */
export interface EaPlayer {
  sourceId: string;
  name: string;
  fullName: string | null;
  dob: DayNumber | null;
  age: number | null;
  nationality: string | null;
  /** Source position codes in order of preference (e.g. ["ST", "LW"]). */
  positions: string[];
  overall: number;
  potential: number;
  valueEur: number | null;
  wageEur: number | null;
  releaseClauseEur: number | null;
  heightCm: number | null;
  weightKg: number | null;
  foot: 'left' | 'right' | null;
  weakFoot: number | null;
  skillMoves: number | null;
  internationalReputation: number | null;
  /** [attacking, defensive] work rate words, e.g. ["High", "Medium"]. */
  workRate: [string, string] | null;
  traits: string[];
  clubSourceId: string | null;
  clubName: string | null;
  leagueSourceId: string | null;
  leagueName: string | null;
  leagueLevel: number | null;
  jersey: number | null;
  contractUntilYear: number | null;
  joined: DayNumber | null;
  ratings: Ratings;
  version: string | null;
}

export interface TmPlayer {
  sourceId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  dob: DayNumber | null;
  nationality: string | null;
  position: string | null;
  subPosition: string | null;
  foot: 'left' | 'right' | 'either' | null;
  heightCm: number | null;
  contractEnd: DayNumber | null;
  marketValueEur: number | null;
  clubSourceId: string | null;
  clubName: string | null;
  competitionId: string | null;
}

export interface TmClub {
  sourceId: string;
  name: string;
  competitionId: string | null;
  stadiumName: string | null;
  stadiumSeats: number | null;
}

export interface TmCompetition {
  sourceId: string;
  name: string;
  country: string | null;
  type: string | null;
  subType: string | null;
}

export interface TmTransfer {
  playerId: string;
  date: DayNumber;
  season: string | null;
  fromClubId: string | null;
  toClubId: string | null;
  fromClubName: string | null;
  toClubName: string | null;
  /** null = not reported. 0 is kept as reported (see feeStatus rules). */
  feeEur: number | null;
  marketValueEur: number | null;
  type: string | null;
}

export interface TmValuation {
  playerId: string;
  date: DayNumber;
  valueEur: number;
  clubId: string | null;
}

export interface SourceData {
  ea: EaPlayer[];
  tm: {
    players: TmPlayer[];
    clubs: TmClub[];
    competitions: TmCompetition[];
    transfers: TmTransfer[];
    valuations: TmValuation[];
  };
  /** Spec keys of the ratings table that the data actually has (e.g. 'traits'). */
  eaColumns: string[];
  /** Files read, with row counts, for the report. */
  files: { path: string; table: string; rows: number; accepted: number; encoding: string }[];
}
