import type { Player, WorldState } from '@um/engine';

export interface PackDiff {
  previousVersion: string;
  players: {
    added: number;
    removed: number;
    clubChanged: number;
    abilityChanged: number;
    valueChanged: number;
    contractChanged: number;
  };
  clubs: { added: number; removed: number; renamed: number };
  /** A few examples per change type, for the report. */
  examples: string[];
}

const keyOf = (p: Player) => p.source?.key ?? null;
const nameOf = (p: Player) => `${p.firstName} ${p.lastName}`.trim();

/** Compare imported (real) entities between two pack versions by their stable source keys. */
export function diffWorlds(prev: WorldState, next: WorldState, previousVersion: string): PackDiff {
  const prevPlayers = new Map(
    prev.players.filter((p) => p.origin === 'imported' && keyOf(p)).map((p) => [keyOf(p)!, p]),
  );
  const nextPlayers = new Map(
    next.players.filter((p) => p.origin === 'imported' && keyOf(p)).map((p) => [keyOf(p)!, p]),
  );
  const prevClub = new Map(prev.clubs.map((c) => [c.id, c]));
  const nextClub = new Map(next.clubs.map((c) => [c.id, c]));
  const d: PackDiff = {
    previousVersion,
    players: {
      added: 0,
      removed: 0,
      clubChanged: 0,
      abilityChanged: 0,
      valueChanged: 0,
      contractChanged: 0,
    },
    clubs: { added: 0, removed: 0, renamed: 0 },
    examples: [],
  };
  const example = (s: string) => d.examples.length < 30 && d.examples.push(s);
  for (const [key, n] of nextPlayers) {
    const p = prevPlayers.get(key);
    if (!p) {
      d.players.added++;
      example(`+ player ${nameOf(n)}`);
      continue;
    }
    if (p.clubId !== n.clubId) {
      d.players.clubChanged++;
      example(
        `~ ${nameOf(n)}: ${prevClub.get(p.clubId ?? -1)?.name ?? 'none'} → ${nextClub.get(n.clubId ?? -1)?.name ?? 'none'}`,
      );
    }
    if (Math.abs(p.ca - n.ca) >= 3) d.players.abilityChanged++;
    if (p.value > 0 && Math.abs(n.value - p.value) / p.value > 0.1) d.players.valueChanged++;
    if (p.contract?.endDay !== n.contract?.endDay) d.players.contractChanged++;
  }
  for (const [key, p] of prevPlayers) {
    if (!nextPlayers.has(key)) {
      d.players.removed++;
      example(`- player ${nameOf(p)}`);
    }
  }
  for (const [id, c] of nextClub) {
    const p = prevClub.get(id);
    if (!p) d.clubs.added++;
    else if (p.name !== c.name) d.clubs.renamed++;
  }
  for (const id of prevClub.keys()) if (!nextClub.has(id)) d.clubs.removed++;
  return d;
}
