import { positionRating } from '../players/ability';
import { P } from '../players/positions';
import { FORMATION_IDS, FORMATIONS, type FormationId } from './formations';
import type { MatchPlayer, Tactic, TeamSheet } from './types';

export const DEFAULT_TACTIC: Tactic = {
  formation: '4-2-3-1',
  mentality: 0,
  tempo: 0.5,
  width: 0.5,
  directness: 0.5,
  pressing: 0.5,
  defensiveLine: 0.5,
};

/** How effective a player is right now in a slot: position fit scaled by condition. */
export function slotScore(player: MatchPlayer, position: number): number {
  const fit = positionRating(player.attributes, player.positions, position);
  return fit * (0.6 + 0.4 * (player.condition / 100));
}

export interface Selection {
  starters: number[];
  bench: number[];
  /** Sum of slot scores of the XI (for comparing formations). */
  score: number;
}

/**
 * Pick the best XI for a formation: fill slots in order of how few good candidates they have,
 * greedily taking the best available player for each. Fast and close to optimal for squads.
 */
export function selectLineup(
  players: MatchPlayer[],
  formation: FormationId,
  benchSize = 9,
): Selection {
  const slots = FORMATIONS[formation];
  const available = players.filter((p) => p.condition >= 40);
  const pool = available.length >= 11 ? available : players;
  const used = new Set<number>();
  const starters = new Array<number>(slots.length);
  let score = 0;

  // Rank slots by scarcity: the fewer candidates rated ≥ 12 there, the earlier we fill it.
  const order = slots
    .map((s, i) => ({
      i,
      pos: P[s.position],
      good: pool.filter((p) => slotScore(p, P[s.position]) >= 12).length,
    }))
    .sort((a, b) => a.good - b.good || a.i - b.i);

  for (const { i, pos } of order) {
    let best: MatchPlayer | undefined;
    let bestScore = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const s = slotScore(p, pos);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    if (!best) throw new Error('Not enough players to field a team');
    used.add(best.id);
    starters[i] = best.id;
    score += bestScore;
  }

  // Bench: a goalkeeper first, then the best remaining outfielders by their best-position fit.
  const rest = pool.filter((p) => !used.has(p.id));
  const keeper = rest
    .filter((p) => p.positions[P.GK] === 20)
    .sort((a, b) => slotScore(b, P.GK) - slotScore(a, P.GK))[0];
  const outfield = rest
    .filter((p) => p !== keeper)
    .map((p) => ({
      p,
      s: Math.max(...p.positions.map((_, pos) => (pos === P.GK ? 0 : slotScore(p, pos)))),
    }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
  const bench = [...(keeper ? [keeper] : []), ...outfield].slice(0, benchSize).map((p) => p.id);
  return { starters, bench, score };
}

/** Choose the formation that gets the most out of a squad (AI managers). */
export function bestFormation(players: MatchPlayer[]): FormationId {
  let best: FormationId = DEFAULT_TACTIC.formation;
  let bestScore = -Infinity;
  for (const id of FORMATION_IDS) {
    const { score } = selectLineup(players, id, 0);
    if (score > bestScore + 0.5) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

/** Build a complete AI team sheet: formation suited to the squad, best XI and bench. */
export function autoTeamSheet(
  id: number,
  name: string,
  players: MatchPlayer[],
  tactic: Partial<Tactic> = {},
): TeamSheet {
  const formation = tactic.formation ?? bestFormation(players);
  const { starters, bench } = selectLineup(players, formation);
  return {
    id,
    name,
    tactic: { ...DEFAULT_TACTIC, ...tactic, formation },
    starters,
    bench,
    players,
    aiControlled: true,
  };
}
