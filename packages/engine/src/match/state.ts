import { clamp } from '../core/math';
import { A, H } from '../players/attributes';
import { P } from '../players/positions';
import { createRng, type Rng } from '../rng/rng';
import { K } from './calibration';
import { FORMATIONS } from './formations';
import type {
  MatchEvent,
  MatchEventType,
  MatchInput,
  MatchPlayer,
  PlayerMatchStats,
  Side,
  Tactic,
  TeamMatchStats,
  TeamSheet,
} from './types';

export interface PlayerState {
  p: MatchPlayer;
  side: Side;
  /** Formation slot while on the pitch. */
  slot: number;
  /** POSITIONS index of the slot. */
  pos: number;
  /** Base shape coordinates in the team's own frame. */
  bx: number;
  by: number;
  condition: number;
  /** Per-match multiplier: consistency wobble, morale, sharpness, home advantage. */
  form: number;
  onPitch: boolean;
  sentOff: boolean;
  injured: boolean;
  yellows: number;
  stats: PlayerMatchStats;
}

export interface TeamState {
  side: Side;
  sheet: TeamSheet;
  tactic: Tactic;
  players: PlayerState[];
  bench: PlayerState[];
  subsUsed: number;
  stats: TeamMatchStats;
  /** AI game-state adjustment to mentality (e.g. chasing a goal late on). */
  mentalityShift: number;
}

export interface MatchState {
  input: MatchInput;
  rng: Rng;
  detail: 'full' | 'key';
  period: 1 | 2;
  /** Seconds elapsed in the current period. */
  t: number;
  /** Stoppage accumulated in the current period (seconds). */
  stoppage: number;
  addedTime: [number, number];
  periodLength: number;
  possession: Side;
  carrier: PlayerState;
  /** Ball position in the home frame. */
  ballX: number;
  ballY: number;
  teams: [TeamState, TeamState];
  events: MatchEvent[];
  /** Last completed pass (for assists and key passes). */
  lastPass: { from: PlayerState; at: number } | null;
  /** Who kicks off the second half. */
  secondHalfKickOff: Side;
  nextAiCheck: number;
  finished: boolean;
}

export const emptyTeamStats = (): TeamMatchStats => ({
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  xg: 0,
  passes: 0,
  passesCompleted: 0,
  possessionSeconds: 0,
  tackles: 0,
  tacklesWon: 0,
  interceptions: 0,
  fouls: 0,
  corners: 0,
  offsides: 0,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
  crosses: 0,
  dribbles: 0,
});

function emptyPlayerStats(playerId: number, side: Side, started: boolean): PlayerMatchStats {
  return {
    playerId,
    side,
    started,
    minuteOn: started ? 0 : -1,
    minuteOff: -1,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    passes: 0,
    passesCompleted: 0,
    keyPasses: 0,
    dribbles: 0,
    tackles: 0,
    interceptions: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    goalsConceded: 0,
    injured: false,
    condition: 0,
    rating: 6,
  };
}

function buildTeam(sheet: TeamSheet, side: Side, rng: Rng, home: boolean): TeamState {
  const byId = new Map(sheet.players.map((p) => [p.id, p]));
  const slots = FORMATIONS[sheet.tactic.formation];
  if (sheet.starters.length !== 11) throw new Error(`${sheet.name}: exactly 11 starters required`);
  const make = (id: number, slot: number, started: boolean): PlayerState => {
    const p = byId.get(id);
    if (!p) throw new Error(`${sheet.name}: unknown player ${id}`);
    const s = slots[Math.max(0, slot)]!;
    const consistency = p.hidden[H.consistency] ?? 10;
    const wobble = rng.normal(0, K.inconsistency * (1.6 - consistency / 20));
    const form =
      1 +
      wobble +
      (p.morale - 50) / 1000 +
      (p.sharpness - 70) / 1500 +
      (home ? K.homeAdvantage : 0);
    return {
      p,
      side,
      slot,
      pos: P[s.position],
      bx: s.x,
      by: s.y,
      condition: p.condition,
      form,
      onPitch: started,
      sentOff: false,
      injured: false,
      yellows: 0,
      stats: emptyPlayerStats(p.id, side, started),
    };
  };
  return {
    side,
    sheet,
    tactic: sheet.tactic,
    players: sheet.starters.map((id, slot) => make(id, slot, true)),
    bench: sheet.bench.map((id) => make(id, -1, false)),
    subsUsed: 0,
    stats: emptyTeamStats(),
    mentalityShift: 0,
  };
}

export function createState(input: MatchInput): MatchState {
  const rng = createRng(`match:${input.seed}`);
  const neutral = input.neutralVenue === true;
  const teams: [TeamState, TeamState] = [
    buildTeam(input.home, 0, rng, !neutral),
    buildTeam(input.away, 1, rng, false),
  ];
  const kickOff: Side = rng.chance(0.5) ? 0 : 1;
  const state: MatchState = {
    input,
    rng,
    detail: input.detail ?? 'key',
    period: 1,
    t: 0,
    stoppage: 0,
    addedTime: [0, 0],
    periodLength: K.halfSeconds,
    possession: kickOff,
    carrier: teams[kickOff].players[10]!,
    ballX: 0.5,
    ballY: 0.5,
    teams,
    events: [],
    lastPass: null,
    secondHalfKickOff: kickOff === 0 ? 1 : 0,
    nextAiCheck: 0,
    finished: false,
  };
  emit(state, 'kickOff', kickOff);
  return state;
}

// ------------------------------------------------------------------ helpers

/** Effective attribute: base value × form × condition. */
export function eff(ps: PlayerState, attr: number): number {
  const cond = 0.8 + 0.2 * (ps.condition / 100);
  return (ps.p.attributes[attr] ?? 10) * ps.form * cond * (ps.injured ? 0.75 : 1);
}

/** Centred attribute: 0 for an average (10.5) value, ±1 per 10 points. */
export const z = (value: number) => (value - 10.5) / 10;

export const mentality = (team: TeamState) =>
  clamp(team.tactic.mentality + team.mentalityShift, -2, 2);

/** Convert between the home frame and a side's attacking frame (symmetric). */
export const toFrame = (side: Side, v: number) => (side === 0 ? v : 1 - v);

export function emit(
  state: MatchState,
  type: MatchEventType,
  side: Side,
  extra: Partial<Omit<MatchEvent, 't' | 'period' | 'type' | 'side'>> = {},
): void {
  state.events.push({
    t: Math.round(state.t + (state.period === 2 ? K.halfSeconds : 0)),
    period: state.period,
    type,
    side,
    x: extra.x ?? state.ballX,
    y: extra.y ?? state.ballY,
    ...extra,
  });
}

/** Ball position in the attacking frame of the team in possession. */
export function attackBall(state: MatchState): { ax: number; ay: number } {
  return { ax: toFrame(state.possession, state.ballX), ay: toFrame(state.possession, state.ballY) };
}

/** Set the ball from attacking-frame coordinates of `side`. */
export function setBall(state: MatchState, side: Side, ax: number, ay: number): void {
  state.ballX = toFrame(side, clamp(ax, 0.005, 0.995));
  state.ballY = toFrame(side, clamp(ay, 0.01, 0.99));
}

export const metres = (dx: number, dy: number) => Math.hypot(dx * K.pitchLength, dy * K.pitchWidth);

export const activePlayers = (team: TeamState) => team.players.filter((p) => p.onPitch);

export const isGoalkeeper = (ps: PlayerState) => ps.pos === P.GK;

/** Best active player for a weighted set of attributes. */
export function bestBy(players: PlayerState[], attrs: number[]): PlayerState {
  let best = players[0]!;
  let bestScore = -Infinity;
  for (const p of players) {
    const s = attrs.reduce((acc, a) => acc + eff(p, a), 0);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

export const ATTR = A;
