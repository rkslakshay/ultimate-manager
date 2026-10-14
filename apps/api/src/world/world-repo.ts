import type {
  Club,
  Competition,
  Foot,
  Nation,
  NameFlavour,
  Player,
  SquadStatus,
  Stadium,
  TraitId,
  WorldState,
} from '@um/engine';
import type { Db } from '../db';
import type {
  Club as ClubRow,
  Competition as CompetitionRow,
  Nation as NationRow,
  Player as PlayerRow,
  Prisma,
  Stadium as StadiumRow,
} from '../generated/prisma/client';
import { chunk, dateToDay, dayToDate, isoDate } from './convert';

type Tx = Prisma.TransactionClient | Db;

// ------------------------------------------------------------------ engine → rows

export function playerToRow(saveId: string, p: Player): Prisma.PlayerCreateManyInput {
  return {
    saveId,
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    nationId: p.nationId,
    birthDate: dayToDate(p.birthDay),
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    foot: p.foot,
    weakFoot: p.weakFoot,
    attributes: p.attributes,
    hidden: p.hidden,
    positions: p.positions,
    primaryPosition: p.primaryPosition,
    ca: p.ca,
    pa: p.pa,
    traits: p.traits,
    clubId: p.clubId,
    wage: p.contract?.wage ?? null,
    contractStart: p.contract ? dayToDate(p.contract.startDay) : null,
    contractEnd: p.contract ? dayToDate(p.contract.endDay) : null,
    squadStatus: p.contract?.squadStatus ?? null,
    releaseClause: p.contract?.releaseClause ?? null,
    value: p.value,
    retired: p.retired,
  };
}

export function clubToRow(saveId: string, c: Club): Prisma.ClubCreateManyInput {
  return { saveId, ...c };
}

/** Insert a freshly generated world for a save (inside the caller's transaction). */
export async function insertWorld(tx: Tx, saveId: string, world: WorldState): Promise<void> {
  await tx.nation.createMany({ data: world.nations.map((n) => ({ saveId, ...n })) });
  await tx.competition.createMany({ data: world.competitions.map((c) => ({ saveId, ...c })) });
  await tx.stadium.createMany({ data: world.stadiums.map((s) => ({ saveId, ...s })) });
  await tx.club.createMany({ data: world.clubs.map((c) => clubToRow(saveId, c)) });
  await bulkInsertPlayers(tx, saveId, world.players);
}

/** Column name → Postgres type for the Player bulk insert (order matters). */
const PLAYER_COLUMNS: [string, string][] = [
  ['id', 'int'],
  ['firstName', 'text'],
  ['lastName', 'text'],
  ['nationId', 'int'],
  ['birthDate', 'date'],
  ['heightCm', 'int'],
  ['weightKg', 'int'],
  ['foot', 'text'],
  ['weakFoot', 'int'],
  ['attributes', 'int[]'],
  ['hidden', 'int[]'],
  ['positions', 'int[]'],
  ['primaryPosition', 'int'],
  ['ca', 'int'],
  ['pa', 'int'],
  ['traits', 'text[]'],
  ['clubId', 'int'],
  ['wage', 'float8'],
  ['contractStart', 'date'],
  ['contractEnd', 'date'],
  ['squadStatus', 'text'],
  ['releaseClause', 'float8'],
  ['value', 'float8'],
  ['retired', 'boolean'],
];
const quoted = PLAYER_COLUMNS.map(([c]) => `"${c}"`).join(', ');
const recordType = PLAYER_COLUMNS.map(([c, t]) => `"${c}" ${t}`).join(', ');
const PLAYER_INSERT_SQL = `INSERT INTO "Player" ("saveId", ${quoted})
  SELECT $1, ${quoted} FROM jsonb_to_recordset($2::jsonb) AS t(${recordType})`;

/**
 * Insert players with one statement per batch: the rows travel as a single JSON parameter and
 * Postgres expands them with jsonb_to_recordset. ~20x faster than Prisma createMany here, which
 * binds ~27 parameters per row.
 */
export async function bulkInsertPlayers(
  tx: Tx,
  saveId: string,
  players: readonly Player[],
): Promise<void> {
  for (const batch of chunk(players, 2000)) {
    const rows = batch.map((p) => {
      const row = playerToRow(saveId, p);
      return {
        ...row,
        birthDate: isoDate(row.birthDate as Date),
        contractStart: row.contractStart ? isoDate(row.contractStart as Date) : null,
        contractEnd: row.contractEnd ? isoDate(row.contractEnd as Date) : null,
      };
    });
    await tx.$executeRawUnsafe(PLAYER_INSERT_SQL, saveId, JSON.stringify(rows));
  }
}

// ------------------------------------------------------------------ rows → engine

export function rowToPlayer(r: PlayerRow): Player {
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    nationId: r.nationId,
    birthDay: dateToDay(r.birthDate),
    heightCm: r.heightCm,
    weightKg: r.weightKg,
    foot: r.foot as Foot,
    weakFoot: r.weakFoot,
    attributes: r.attributes,
    hidden: r.hidden,
    positions: r.positions,
    primaryPosition: r.primaryPosition,
    ca: r.ca,
    pa: r.pa,
    traits: r.traits as TraitId[],
    clubId: r.clubId,
    contract:
      r.wage !== null && r.contractStart && r.contractEnd
        ? {
            wage: r.wage,
            startDay: dateToDay(r.contractStart),
            endDay: dateToDay(r.contractEnd),
            squadStatus: (r.squadStatus ?? 'rotation') as SquadStatus,
            releaseClause: r.releaseClause,
          }
        : null,
    value: r.value,
    retired: r.retired,
  };
}

const rowToNation = ({ saveId: _s, ...n }: NationRow): Nation => ({
  ...n,
  flavour: n.flavour as NameFlavour,
});
const rowToCompetition = ({ saveId: _s, ...c }: CompetitionRow): Competition => ({
  ...c,
  kind: c.kind as Competition['kind'],
});
const rowToStadium = ({ saveId: _s, ...s }: StadiumRow): Stadium => s;
const rowToClub = ({ saveId: _s, ...c }: ClubRow): Club => c;

/** Load a save's complete world into engine form. */
export async function loadWorld(
  db: Tx,
  saveId: string,
  seed: string,
  startDay: number,
  schemaVersion: number,
): Promise<WorldState> {
  const where = { saveId };
  const orderBy = { id: 'asc' } as const;
  const [nations, competitions, stadiums, clubs, players] = await Promise.all([
    db.nation.findMany({ where, orderBy }),
    db.competition.findMany({ where, orderBy }),
    db.stadium.findMany({ where, orderBy }),
    db.club.findMany({ where, orderBy }),
    db.player.findMany({ where, orderBy }),
  ]);
  return {
    schemaVersion,
    seed,
    startDay,
    nations: nations.map(rowToNation),
    competitions: competitions.map(rowToCompetition),
    stadiums: stadiums.map(rowToStadium),
    clubs: clubs.map(rowToClub),
    players: players.map(rowToPlayer),
  };
}
