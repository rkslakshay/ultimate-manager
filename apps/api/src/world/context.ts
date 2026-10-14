import type { ClubRefDto } from '@um/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import type { SaveGame } from '../generated/prisma/client';
import { AppError, notFound, parseInput } from '../lib/errors';
import { dateToDay } from './convert';
import { toClubRef, type PlayerContext } from './dto';

const saveParams = z.object({ saveId: z.string().min(1).max(64) });

/** Authenticate and load the save named in the route, owned by the current user. */
export async function ownedSave(
  app: FastifyInstance,
  db: Db,
  request: FastifyRequest,
): Promise<SaveGame> {
  const { userId } = await app.authenticate(request);
  const { saveId } = parseInput(saveParams, request.params);
  const save = await db.saveGame.findFirst({ where: { id: saveId, userId } });
  if (!save) throw notFound('Save game');
  if (save.worldVersion === null) {
    throw new AppError('CONFLICT', 'This save has no world yet. Open it to generate one.');
  }
  return save;
}

/** Build the lookups needed to render players (nation codes, club refs, today's date). */
export async function playerContext(
  db: Db,
  save: SaveGame,
  clubIds: Iterable<number | null>,
): Promise<PlayerContext> {
  const ids = [...new Set([...clubIds].filter((id): id is number => id !== null))];
  const [nations, clubs] = await Promise.all([
    db.nation.findMany({ where: { saveId: save.id }, select: { id: true, code: true } }),
    ids.length ? db.club.findMany({ where: { saveId: save.id, id: { in: ids } } }) : [],
  ]);
  const codes = new Map(nations.map((n) => [n.id, n.code]));
  const refs = new Map<number, ClubRefDto>(clubs.map((c) => [c.id, toClubRef(c)]));
  return {
    today: dateToDay(save.gameDate),
    nationCode: (id) => codes.get(id) ?? '???',
    club: (id) => (id === null ? null : (refs.get(id) ?? null)),
  };
}

export const idParam = z.object({ id: z.coerce.number().int().positive() });
