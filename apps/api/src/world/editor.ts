import { ageOn, ATTRIBUTE_KEYS, currentAbility, marketValue, type AttributeKey } from '@um/engine';
import {
  clubUpdateSchema,
  parseCsvObjects,
  playerUpdateSchema,
  toCsv,
  type ClubUpdate,
  type ImportEntity,
  type PlayerUpdate,
} from '@um/shared';
import type { Db } from '../db';
import type { Club, Player, Prisma } from '../generated/prisma/client';
import { dateToDay } from './convert';

type Tx = Prisma.TransactionClient | Db;

/** Index of the highest familiarity, preferring the current primary position on ties. */
function bestPosition(positions: number[], current: number): number {
  let best = current;
  positions.forEach((f, i) => {
    if (f > (positions[best] ?? 0)) best = i;
  });
  return best;
}

/**
 * Turn an editor update into DB changes, recomputing the derived fields (primary position,
 * Current Ability, Potential floor and market value) with the engine's own rules.
 */
export function playerChanges(
  player: Player,
  update: PlayerUpdate,
  today: number,
  clubReputation: number,
): Prisma.PlayerUpdateInput {
  const attributes = update.attributes ?? player.attributes;
  const positions = update.positions ?? player.positions;
  const primaryPosition = update.positions
    ? bestPosition(positions, player.primaryPosition)
    : player.primaryPosition;
  const ca = currentAbility(attributes, primaryPosition);
  const pa = Math.max(update.pa ?? player.pa, ca);
  const contractYearsLeft = player.contractEnd ? (dateToDay(player.contractEnd) - today) / 365 : 0;
  const value = marketValue({
    ca,
    pa,
    age: ageOn(dateToDay(player.birthDate), today),
    contractYearsLeft,
    reputation: clubReputation,
  });
  return {
    ...(update.firstName !== undefined && { firstName: update.firstName }),
    ...(update.lastName !== undefined && { lastName: update.lastName }),
    ...(update.hidden && { hidden: update.hidden }),
    attributes,
    positions,
    primaryPosition,
    ca,
    pa,
    value,
  };
}

export async function updatePlayer(
  tx: Tx,
  saveId: string,
  player: Player,
  update: PlayerUpdate,
  today: number,
) {
  const club = player.clubId
    ? await tx.club.findUnique({
        where: { saveId_id: { saveId, id: player.clubId } },
        select: { reputation: true },
      })
    : null;
  return tx.player.update({
    where: { saveId_id: { saveId, id: player.id } },
    data: playerChanges(player, update, today, club?.reputation ?? 40),
  });
}

// ------------------------------------------------------------------ export

const CLUB_FIELDS = [
  'id',
  'name',
  'shortName',
  'code',
  'city',
  'primaryColor',
  'secondaryColor',
] as const;

function clubExportRow(c: Club) {
  return Object.fromEntries(CLUB_FIELDS.map((f) => [f, c[f]]));
}

function playerExportRow(p: Player) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    pa: p.pa,
    ...Object.fromEntries(ATTRIBUTE_KEYS.map((k, i) => [k, p.attributes[i]])),
  };
}

export async function exportEntity(
  db: Db,
  saveId: string,
  entity: ImportEntity,
  format: 'json' | 'csv',
) {
  const rows =
    entity === 'clubs'
      ? (await db.club.findMany({ where: { saveId }, orderBy: { id: 'asc' } })).map(clubExportRow)
      : (
          await db.player.findMany({ where: { saveId, retired: false }, orderBy: { id: 'asc' } })
        ).map(playerExportRow);
  if (format === 'json') return JSON.stringify(rows, null, 2);
  const header =
    entity === 'clubs'
      ? [...CLUB_FIELDS]
      : ['id', 'firstName', 'lastName', 'pa', ...ATTRIBUTE_KEYS];
  return toCsv([
    header,
    ...rows.map((r) => header.map((h) => (r as Record<string, unknown>)[h] as string | number)),
  ]);
}

// ------------------------------------------------------------------ import

export interface ImportOutcome {
  updated: number;
  errors: { row: number; message: string }[];
}

const MAX_IMPORT_ROWS = 10_000;

/** Read JSON (array of objects) or CSV (header row) into plain records. */
export function readRecords(format: 'json' | 'csv', content: string): Record<string, unknown>[] {
  if (format === 'csv') return parseCsvObjects(content);
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) throw new Error('JSON import must be an array of objects');
  return parsed.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
}

const asNumber = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
const present = (v: unknown) => v !== undefined && v !== null && v !== '';
const firstIssue = (e: { issues: { path: PropertyKey[]; message: string }[] }) => {
  const i = e.issues[0];
  return i ? `${i.path.join('.') || 'row'}: ${i.message}` : 'Invalid row';
};

export async function importRecords(
  db: Db,
  saveId: string,
  entity: ImportEntity,
  records: Record<string, unknown>[],
  today: number,
): Promise<ImportOutcome> {
  const errors: ImportOutcome['errors'] = [];
  if (records.length > MAX_IMPORT_ROWS) {
    return { updated: 0, errors: [{ row: 0, message: `Too many rows (max ${MAX_IMPORT_ROWS})` }] };
  }
  const ids = records.map((r) => Number(asNumber(r.id)));
  const existing =
    entity === 'clubs'
      ? new Map(
          (
            await db.club.findMany({ where: { saveId, id: { in: ids.filter(Number.isInteger) } } })
          ).map((c) => [c.id, c]),
        )
      : new Map(
          (
            await db.player.findMany({
              where: { saveId, id: { in: ids.filter(Number.isInteger) } },
            })
          ).map((p) => [p.id, p]),
        );

  const clubUpdates: [number, ClubUpdate][] = [];
  const playerUpdates: [Player, PlayerUpdate][] = [];
  records.forEach((record, index) => {
    const row = index + 1;
    const id = ids[index]!;
    const target = existing.get(id);
    if (!Number.isInteger(id) || !target) {
      errors.push({
        row,
        message: `Unknown ${entity === 'clubs' ? 'club' : 'player'} id ${String(record.id)}`,
      });
      return;
    }
    if (entity === 'clubs') {
      const input = Object.fromEntries(
        CLUB_FIELDS.filter((f) => f !== 'id' && present(record[f])).map((f) => [f, record[f]]),
      );
      const parsed = clubUpdateSchema.safeParse(input);
      if (parsed.success) clubUpdates.push([id, parsed.data]);
      else errors.push({ row, message: firstIssue(parsed.error) });
      return;
    }
    const player = target as Player;
    const attributes = [...player.attributes];
    let attributesChanged = false;
    ATTRIBUTE_KEYS.forEach((key: AttributeKey, i) => {
      if (present(record[key])) {
        attributes[i] = asNumber(record[key]) as number;
        attributesChanged = true;
      }
    });
    const parsed = playerUpdateSchema.safeParse({
      ...(present(record.firstName) && { firstName: record.firstName }),
      ...(present(record.lastName) && { lastName: record.lastName }),
      ...(present(record.pa) && { pa: asNumber(record.pa) }),
      ...(attributesChanged ? { attributes } : {}),
    });
    if (parsed.success) playerUpdates.push([player, parsed.data]);
    else errors.push({ row, message: firstIssue(parsed.error) });
  });

  await db.$transaction(
    async (tx) => {
      for (const [id, data] of clubUpdates) {
        await tx.club.update({ where: { saveId_id: { saveId, id } }, data });
      }
      for (const [player, update] of playerUpdates)
        await updatePlayer(tx, saveId, player, update, today);
    },
    { timeout: 120_000 },
  );
  return { updated: clubUpdates.length + playerUpdates.length, errors };
}
