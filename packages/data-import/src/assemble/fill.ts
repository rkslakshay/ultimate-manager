import {
  ageOn,
  createRng,
  expectedWage,
  generatePlayer,
  marketValue,
  P,
  POSITION_GROUP,
  POSITIONS,
  roundMoney,
  seasonEndDay,
  type Club,
  type DayNumber,
  type Nation,
  type Player,
  type Position,
  type PositionGroup,
} from '@um/engine';
import type { ImportLog } from '../log';

const GROUP_MIN: Record<PositionGroup, number> = { GK: 2, DEF: 6, MID: 6, ATT: 4 };
const GROUP_SLOTS: Record<PositionGroup, Position[]> = {
  GK: ['GK'],
  DEF: ['DC', 'DL', 'DR', 'DC'],
  MID: ['MC', 'DM', 'ML', 'MR'],
  ATT: ['ST', 'AML', 'AMR', 'AMC'],
};
const EXTRA_ROTATION: Position[] = ['MC', 'DC', 'ST', 'AMR', 'DR', 'AML', 'DL', 'DM'];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 80;
};

function signGenerated(p: Player, club: Club, startDay: DayNumber, rngKey: string): void {
  const rng = createRng(rngKey);
  const age = ageOn(p.birthDay, startDay);
  const endDay = seasonEndDay(startDay, rng.int(0, 2));
  p.clubId = club.id;
  p.contract = {
    wage: roundMoney(expectedWage(p.ca, age, club.reputation) * 0.8),
    startDay,
    endDay,
    squadStatus: 'backup',
    releaseClause: null,
  };
  p.value = marketValue({
    ca: p.ca,
    pa: p.pa,
    age,
    contractYearsLeft: (endDay - startDay) / 365,
    reputation: club.reputation,
  });
}

/**
 * Top up thin squads with generated players so every club can field a side and a bench.
 * Generated players are origin "generated" and never presented as real.
 */
export function fillSquads(
  clubs: Club[],
  players: Player[],
  nations: Map<number, Nation>,
  startDay: DayNumber,
  minSquad: number,
  nextId: () => number,
  log: ImportLog,
): Player[] {
  const added: Player[] = [];
  for (const club of clubs) {
    const squad = players.filter((p) => p.clubId === club.id);
    const nation = nations.get(club.nationId)!;
    const level = median(squad.map((p) => p.ca)) - 8;
    const counts: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    for (const p of squad) counts[POSITION_GROUP[POSITIONS[p.primaryPosition]!]]++;
    const wanted: Position[] = [];
    for (const g of Object.keys(GROUP_MIN) as PositionGroup[]) {
      for (let i = counts[g]; i < GROUP_MIN[g]; i++)
        wanted.push(GROUP_SLOTS[g][i % GROUP_SLOTS[g].length]!);
    }
    let r = 0;
    while (squad.length + wanted.length < minSquad)
      wanted.push(EXTRA_ROTATION[r++ % EXTRA_ROTATION.length]!);
    if (!wanted.length) continue;

    const rng = createRng(`fill:${club.id}`);
    for (const pos of wanted) {
      const p = generatePlayer(rng, {
        id: nextId(),
        nationId: nation.id,
        flavour: nation.flavour,
        namePool: nation.namePool,
        position: P[pos],
        age: rng.int(18, 31),
        targetCa: level + rng.normal(0, 6),
        referenceDay: startDay,
      });
      signGenerated(p, club, startDay, `fill-contract:${p.id}`);
      added.push(p);
    }
    log.count('fill.generated_squad_players', wanted.length);
    log.count('fill.clubs_topped_up');
  }
  return added;
}

/** Unattached generated players, weighted towards the nations most represented in the data. */
export function generateFreeAgents(
  count: number,
  players: Player[],
  nations: Nation[],
  startDay: DayNumber,
  nextId: () => number,
): Player[] {
  if (!count || !nations.length) return [];
  const rng = createRng('free-agents');
  const weight = new Map<number, number>();
  for (const p of players) weight.set(p.nationId, (weight.get(p.nationId) ?? 0) + 1);
  const pool = nations.filter((n) => weight.has(n.id));
  const cas = players.map((p) => p.ca).sort((a, b) => a - b);
  const low = cas[Math.floor(cas.length * 0.2)] ?? 70;
  return Array.from({ length: count }, () => {
    const nation = rng.weighted(
      pool,
      pool.map((n) => weight.get(n.id) ?? 1),
    );
    const age = rng.int(19, 34);
    const p = generatePlayer(rng, {
      id: nextId(),
      nationId: nation.id,
      flavour: nation.flavour,
      namePool: nation.namePool,
      position: rng.weighted(
        [...POSITIONS.keys()],
        POSITIONS.map((pos) => (pos === 'GK' ? 2 : pos.startsWith('WB') ? 0 : 1.5)),
      ),
      age,
      targetCa: low + rng.normal(0, 10),
      referenceDay: startDay,
    });
    p.value = marketValue({ ca: p.ca, pa: p.pa, age, contractYearsLeft: 0, reputation: 30 });
    return p;
  });
}
