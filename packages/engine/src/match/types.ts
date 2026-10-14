import type { Foot } from '../world/types';
import type { TraitId } from '../players/traits';
import type { FormationId } from './formations';

/** 0 = home, 1 = away. */
export type Side = 0 | 1;

/** Everything the engine needs to know about one player for a match. */
export interface MatchPlayer {
  id: number;
  name: string;
  attributes: readonly number[];
  hidden: readonly number[];
  positions: readonly number[];
  traits: readonly TraitId[];
  foot: Foot;
  weakFoot: number;
  heightCm: number;
  /** Physical condition at kick-off, 0-100. */
  condition: number;
  /** 0-100; 50 is neutral. */
  morale: number;
  /** Match sharpness 0-100. */
  sharpness: number;
}

export type Mentality = -2 | -1 | 0 | 1 | 2;

/**
 * Team instructions. Sliders are 0-1 with 0.5 as the neutral default. Phase 4 adds roles,
 * duties and individual instructions on top of this.
 */
export interface Tactic {
  formation: FormationId;
  mentality: Mentality;
  /** Speed of ball circulation: higher = quicker, riskier play. */
  tempo: number;
  /** Width in possession. */
  width: number;
  /** Passing directness: higher = more long and forward passes. */
  directness: number;
  /** Pressing intensity out of possession. */
  pressing: number;
  /** Defensive line height. */
  defensiveLine: number;
}

export interface TeamSheet {
  id: number;
  name: string;
  tactic: Tactic;
  /** Exactly 11 player ids in formation slot order (slot 0 = goalkeeper). */
  starters: number[];
  /** Substitutes, in order of preference. */
  bench: number[];
  /** All players referenced by starters and bench. */
  players: MatchPlayer[];
  /** Set-piece takers (default: best qualified player on the pitch). */
  takers?: { penalties?: number; freeKicks?: number; corners?: number };
  /** Whether the AI may make substitutions and late tactical tweaks. */
  aiControlled?: boolean;
}

export type Weather = 'clear' | 'rain' | 'heavyRain' | 'snow' | 'wind' | 'hot';

export interface MatchInput {
  /** Seed for this match; same seed + inputs ⇒ identical match. */
  seed: string;
  home: TeamSheet;
  away: TeamSheet;
  /** No home advantage (cup finals at neutral grounds). */
  neutralVenue?: boolean;
  weather?: Weather;
  /** Pitch quality 0-1 (1 = perfect). */
  pitch?: number;
  /** 'full' records every touch for the live view; 'key' keeps only key events (quick-sim). */
  detail?: 'full' | 'key';
}

export type MatchEventType =
  | 'kickOff'
  | 'halfTime'
  | 'fullTime'
  | 'pass'
  | 'dribble'
  | 'tackle'
  | 'interception'
  | 'cross'
  | 'shot'
  | 'goal'
  | 'save'
  | 'miss'
  | 'block'
  | 'woodwork'
  | 'foul'
  | 'yellowCard'
  | 'redCard'
  | 'corner'
  | 'freeKick'
  | 'penalty'
  | 'offside'
  | 'throwIn'
  | 'goalKick'
  | 'substitution'
  | 'injury';

export interface MatchEvent {
  /** Seconds since kick-off of the period plus 45 min for the second half (match clock). */
  t: number;
  period: 1 | 2;
  type: MatchEventType;
  side: Side;
  playerId?: number;
  /** Assister, fouled player, substitute coming on… depending on type. */
  otherPlayerId?: number;
  /** Ball position in home-team frame (x: home goal 0 → away goal 1; y: 0-1). */
  x: number;
  y: number;
  xg?: number;
  /** Extra info: shot body part, card reason, set-piece kind. */
  detail?: string;
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  passes: number;
  passesCompleted: number;
  /** Seconds in possession (for possession %). */
  possessionSeconds: number;
  tackles: number;
  tacklesWon: number;
  interceptions: number;
  fouls: number;
  corners: number;
  offsides: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  crosses: number;
  dribbles: number;
}

export interface PlayerMatchStats {
  playerId: number;
  side: Side;
  started: boolean;
  /** Minute he came on (0 for starters). */
  minuteOn: number;
  /** Minute he went off (90 if he finished). */
  minuteOff: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  passes: number;
  passesCompleted: number;
  keyPasses: number;
  dribbles: number;
  tackles: number;
  interceptions: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  goalsConceded: number;
  injured: boolean;
  /** Condition at the end of the match (0-100). */
  condition: number;
  /** Match rating 1-10. */
  rating: number;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  stats: [TeamMatchStats, TeamMatchStats];
  players: PlayerMatchStats[];
  events: MatchEvent[];
  /** Total stoppage time added (seconds) per half. */
  addedTime: [number, number];
  engineVersion: string;
}
