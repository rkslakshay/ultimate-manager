import { DEFAULT_START_DATE, generateWorld, WORLD_SCHEMA_VERSION } from '@um/engine';
import {
  MAX_SAVES_PER_USER,
  chooseClubRequestSchema,
  createSaveRequestSchema,
  updateSaveRequestSchema,
  type SaveGameDto,
} from '@um/shared';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import type { Prisma, SaveGame } from '../generated/prisma/client';
import { AppError, notFound, parseInput } from '../lib/errors';
import { insertWorld } from '../world/world-repo';

/** Every new career starts at the beginning of the 2026/27 pre-season. */
export const CAREER_START_DATE = DEFAULT_START_DATE;

const idParamsSchema = z.object({ saveId: z.string().min(1).max(64) });

export function toSaveDto(save: SaveGame): SaveGameDto {
  return {
    id: save.id,
    name: save.name,
    managerName: save.managerName,
    seed: save.seed,
    gameDate: save.gameDate.toISOString().slice(0, 10),
    clubName: save.clubName,
    managerClubId: save.managerClubId,
    hasWorld: save.worldVersion !== null,
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString(),
    lastPlayedAt: save.lastPlayedAt.toISOString(),
  };
}

/** Generate the save's world from its seed, store it and mark the save as having one. */
async function createWorld(
  tx: Prisma.TransactionClient,
  saveId: string,
  seed: string,
): Promise<SaveGame> {
  // Pure CPU (~60 ms) followed by bulk inserts (~250 ms).
  const world = generateWorld(seed, { startDate: CAREER_START_DATE });
  await insertWorld(tx, saveId, world);
  return tx.saveGame.update({
    where: { id: saveId },
    data: { worldVersion: WORLD_SCHEMA_VERSION },
  });
}

export async function saveRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /** Load a save owned by the current user, or 404 (never reveal other users' saves). */
  async function findOwnedSave(userId: string, rawParams: unknown): Promise<SaveGame> {
    const { saveId } = parseInput(idParamsSchema, rawParams);
    const save = await db.saveGame.findFirst({ where: { id: saveId, userId } });
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
    const seed = input.seed ?? randomBytes(8).toString('hex');
    const save = await db.$transaction(
      async (tx) => {
        const created = await tx.saveGame.create({
          data: {
            userId,
            name: input.name,
            managerName: input.managerName,
            seed,
            gameDate: new Date(`${CAREER_START_DATE}T00:00:00Z`),
          },
        });
        return createWorld(tx, created.id, seed);
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return reply.status(201).send(toSaveDto(save));
  });

  app.get('/:saveId', async (request) => {
    const { userId } = await app.authenticate(request);
    return toSaveDto(await findOwnedSave(userId, request.params));
  });

  /** Mark a save as loaded (bumps lastPlayedAt so it sorts first). */
  app.post('/:saveId/load', async (request) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    const updated = await db.saveGame.update({
      where: { id: save.id },
      data: { lastPlayedAt: new Date() },
    });
    return toSaveDto(updated);
  });

  /** Generate the world for a save created before worlds existed (no-op otherwise). */
  app.post('/:saveId/world', async (request) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    if (save.worldVersion !== null) return toSaveDto(save);
    const updated = await db.$transaction((tx) => createWorld(tx, save.id, save.seed), {
      timeout: 60_000,
      maxWait: 10_000,
    });
    return toSaveDto(updated);
  });

  /** Take charge of a club. Allowed once, while the manager is unemployed. */
  app.post('/:saveId/club', async (request) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    const { clubId } = parseInput(chooseClubRequestSchema, request.body);
    if (save.managerClubId !== null) {
      throw new AppError('CONFLICT', 'You already manage a club in this save');
    }
    const club = await db.club.findUnique({
      where: { saveId_id: { saveId: save.id, id: clubId } },
    });
    if (!club || club.leagueId === null) throw notFound('Club');
    const updated = await db.saveGame.update({
      where: { id: save.id },
      data: { managerClubId: club.id, clubName: club.name },
    });
    return toSaveDto(updated);
  });

  app.patch('/:saveId', async (request) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    const input = parseInput(updateSaveRequestSchema, request.body);
    const updated = await db.saveGame.update({
      where: { id: save.id },
      data: { name: input.name },
    });
    return toSaveDto(updated);
  });

  app.delete('/:saveId', async (request, reply) => {
    const { userId } = await app.authenticate(request);
    const save = await findOwnedSave(userId, request.params);
    await db.saveGame.delete({ where: { id: save.id } });
    return reply.status(204).send();
  });
}
