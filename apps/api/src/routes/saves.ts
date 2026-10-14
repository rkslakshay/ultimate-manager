import {
  MAX_SAVES_PER_USER,
  createSaveRequestSchema,
  updateSaveRequestSchema,
  type SaveGameDto,
} from '@um/shared';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import type { SaveGame } from '../generated/prisma/client';
import { AppError, notFound, parseInput } from '../lib/errors';

/** Every new career starts at the beginning of the 2026/27 pre-season. */
export const CAREER_START_DATE = '2026-07-01';

const idParamsSchema = z.object({ id: z.string().min(1).max(64) });

export function toSaveDto(save: SaveGame): SaveGameDto {
  return {
    id: save.id,
    name: save.name,
    managerName: save.managerName,
    seed: save.seed,
    gameDate: save.gameDate.toISOString().slice(0, 10),
    clubName: save.clubName,
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString(),
    lastPlayedAt: save.lastPlayedAt.toISOString(),
  };
}

export async function saveRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /** Load a save owned by the current user, or 404 (never reveal other users' saves). */
  async function findOwnedSave(userId: string, rawParams: unknown): Promise<SaveGame> {
    const { id } = parseInput(idParamsSchema, rawParams);
    const save = await db.saveGame.findFirst({ where: { id, userId } });
    if (!save) throw notFound('Save game');
    return save;
  }

  app.get('/', async (request) => {
    const { userId } = await app.authenticate(request);
    const saves = await db.saveGame.findMany({
      where: { userId },
      orderBy: { lastPlayedAt: 'desc' },
    });
    return { items: saves.map(toSaveDto), limit: MAX_SAVES_PER_USER };
  });

  app.post('/', async (request, reply) => {
    const { userId } = await app.authenticate(request);
    const input = parseInput(createSaveRequestSchema, request.body);
    const count = await db.saveGame.count({ where: { userId } });
    if (count >= MAX_SAVES_PER_USER) {
      throw new AppError(
        'LIMIT_REACHED',
        `You can have at most ${MAX_SAVES_PER_USER} save games. Delete one to start another.`,
      );
    }
    const save = await db.saveGame.create({
      data: {
        userId,
        name: input.name,
        managerName: input.managerName,
        seed: input.seed ?? randomBytes(8).toString('hex'),
        gameDate: new Date(`${CAREER_START_DATE}T00:00:00Z`),
      },
    });
    return reply.status(201).send(toSaveDto(save));
  });

  app.get('/:id', async (request) => {
    const { userId } = await app.authenticate(request);
    return toSaveDto(await findOwnedSave(userId, request.params));
  });

  /** Mark a save as loaded (bumps lastPlayedAt so it sorts first). */
  app.post('/:id/load', async (request) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    const updated = await db.saveGame.update({
      where: { id: save.id },
      data: { lastPlayedAt: new Date() },
    });
    return toSaveDto(updated);
  });

  app.patch('/:id', async (request) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    const input = parseInput(updateSaveRequestSchema, request.body);
    const updated = await db.saveGame.update({
      where: { id: save.id },
      data: { name: input.name },
    });
    return toSaveDto(updated);
  });

  app.delete('/:id', async (request, reply) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    await db.saveGame.delete({ where: { id: save.id } });
    return reply.status(204).send();
  });
}
