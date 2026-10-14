import { clamp } from '../core/math';
import { P } from '../players/positions';
import { mentality, toFrame, type MatchState, type PlayerState, type TeamState } from './state';

/**
 * Where a player stands right now, in his own team's attacking frame (x: own goal 0 →
 * opponent goal 1). Shapes stretch and shift with the ball; in possession the team pushes up and
 * spreads out, out of possession it compacts, drops to its defensive line and slides across.
 */
export function framePosition(
  state: MatchState,
  team: TeamState,
  ps: PlayerState,
): { x: number; y: number } {
  const hasBall = state.possession === team.side;
  const ballX = toFrame(team.side, state.ballX);
  const ballY = toFrame(team.side, state.ballY);
  const tactic = team.tactic;
  // Small deterministic sway so dots don't stand still and distances vary a little.
  const sway = 0.012 * Math.sin(state.t * 0.11 + ps.p.id * 1.7);

  if (ps.pos === P.GK) {
    const x = hasBall
      ? 0.04 + Math.max(0, ballX - 0.5) * 0.12
      : 0.025 + Math.max(0, ballX - 0.6) * 0.03;
    return { x, y: 0.5 + (ballY - 0.5) * 0.15 };
  }
  let x: number;
  let y: number;
  if (hasBall) {
    x = 0.1 + ps.bx * 0.72 + (ballX - 0.45) * 0.42 + mentality(team) * 0.025 + sway;
    y = 0.5 + (ps.by - 0.5) * (0.92 + tactic.width * 0.3) + sway;
  } else {
    const line = 0.05 + tactic.defensiveLine * 0.1;
    x = line + ps.bx * 0.55 + (ballX - 0.5) * 0.38 + sway;
    y = 0.5 + (ps.by - 0.5) * 0.75 + (ballY - 0.5) * 0.22 + sway;
  }
  return { x: clamp(x, 0.01, 0.97), y: clamp(y, 0.03, 0.97) };
}

/** Position in the frame of `viewSide` (e.g. defenders seen from the attacking team). */
export function positionIn(state: MatchState, team: TeamState, ps: PlayerState, viewSide: 0 | 1) {
  const f = framePosition(state, team, ps);
  return team.side === viewSide ? f : { x: 1 - f.x, y: 1 - f.y };
}

/** Home-frame coordinates of every player on the pitch (for rendering the live view). */
export function snapshot(state: MatchState): { id: number; side: 0 | 1; x: number; y: number }[] {
  const out: { id: number; side: 0 | 1; x: number; y: number }[] = [];
  for (const team of state.teams) {
    for (const ps of team.players) {
      if (!ps.onPitch) continue;
      const p = positionIn(state, team, ps, 0);
      out.push({ id: ps.p.id, side: team.side, x: p.x, y: p.y });
    }
  }
  return out;
}
