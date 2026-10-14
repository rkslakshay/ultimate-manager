import { ATTRIBUTE_COUNT, HIDDEN_KEYS, POSITION_COUNT, type WorldState } from '@um/engine';

/** Structural checks on a built world. Returns human-readable problems (empty = valid). */
export function validateWorld(world: WorldState): string[] {
  const problems: string[] = [];
  const unique = (label: string, ids: number[]) => {
    if (new Set(ids).size !== ids.length) problems.push(`${label}: duplicate ids`);
  };
  unique(
    'nations',
    world.nations.map((n) => n.id),
  );
  unique(
    'competitions',
    world.competitions.map((c) => c.id),
  );
  unique(
    'clubs',
    world.clubs.map((c) => c.id),
  );
  unique(
    'stadiums',
    world.stadiums.map((s) => s.id),
  );
  unique(
    'players',
    world.players.map((p) => p.id),
  );
  const nations = new Set(world.nations.map((n) => n.id));
  const clubs = new Set(world.clubs.map((c) => c.id));
  const stadiums = new Set(world.stadiums.map((s) => s.id));
  const comps = new Set(world.competitions.map((c) => c.id));
  for (const c of world.clubs) {
    if (!nations.has(c.nationId)) problems.push(`club ${c.name}: unknown nation ${c.nationId}`);
    if (!stadiums.has(c.stadiumId)) problems.push(`club ${c.name}: unknown stadium ${c.stadiumId}`);
    if (c.leagueId !== null && !comps.has(c.leagueId))
      problems.push(`club ${c.name}: unknown league ${c.leagueId}`);
  }
  for (const comp of world.competitions) {
    for (const id of comp.clubIds)
      if (!clubs.has(id)) problems.push(`competition ${comp.name}: unknown club ${id}`);
  }
  const squad = new Map<number, number>();
  for (const p of world.players) {
    const label = `player ${p.firstName} ${p.lastName} (${p.id})`;
    if (!nations.has(p.nationId)) problems.push(`${label}: unknown nation`);
    if (p.clubId !== null) {
      if (!clubs.has(p.clubId)) problems.push(`${label}: unknown club`);
      squad.set(p.clubId, (squad.get(p.clubId) ?? 0) + 1);
    }
    if (
      p.attributes.length !== ATTRIBUTE_COUNT ||
      p.attributes.some((v) => !Number.isInteger(v) || v < 1 || v > 20)
    )
      problems.push(`${label}: invalid attributes`);
    if (p.hidden.length !== HIDDEN_KEYS.length || p.hidden.some((v) => v < 1 || v > 20))
      problems.push(`${label}: invalid hidden attributes`);
    if (p.positions.length !== POSITION_COUNT || p.positions[p.primaryPosition] !== 20)
      problems.push(`${label}: invalid positions`);
    if (p.ca < 1 || p.ca > 200 || p.pa < p.ca || p.pa > 200)
      problems.push(`${label}: invalid CA/PA ${p.ca}/${p.pa}`);
    if (p.clubId !== null && !p.contract) problems.push(`${label}: at a club without a contract`);
    if (!Number.isFinite(p.value) || p.value < 0) problems.push(`${label}: invalid value`);
  }
  for (const c of world.clubs) {
    if ((squad.get(c.id) ?? 0) < 16)
      problems.push(`club ${c.name}: only ${squad.get(c.id) ?? 0} players`);
  }
  return problems.slice(0, 200);
}
