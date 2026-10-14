import {
  DEFAULT_START_DATE,
  generateWorld,
  WORLD_SCHEMA_VERSION,
  type WorldState,
} from '@um/engine';
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
import { FICTIONAL_PACK, type PackService } from '../packs/service';
import { dayToDate } from '../world/convert';
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
    dataPack: save.dataPack,
    packVersion: save.packVersion,
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString(),
    lastPlayedAt: save.lastPlayedAt.toISOString(),
  };
}

/** The world a new save starts from: generated from its seed, or a copy of an imported pack. */
interface WorldSource {
  world: WorldState;
  packVersion: string | null;
  valueModel: Prisma.InputJsonValue | undefined;
}

function worldFor(
  packs: PackService,
  dataPack: string,
  seed: string,
  packVersion?: string | null,
): WorldSource {
  if (dataPack === FICTIONAL_PACK) {
    // Pure CPU, ~60 ms.
    return {
      world: generateWorld(seed, { startDate: CAREER_START_DATE }),
      packVersion: null,
      valueModel: undefined,
    };
  }
  const pack = packs.load(dataPack, packVersion ?? undefined);
  return {
    world: pack.world,
    packVersion: pack.version,
    valueModel: (pack.valueModel?.model ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

/**
 * Store the save's own copy of its world and mark the save as having one. The save never
 * references pack data again except the immutable history tables, so re-importing a pack
 * cannot change an ongoing career.
 */
async function storeWorld(
  tx: Prisma.TransactionClient,
  saveId: string,
  source: WorldSource,
): Promise<SaveGame> {
  await insertWorld(tx, saveId, source.world);
  return tx.saveGame.update({
    where: { id: saveId },
    data: {
      worldVersion: WORLD_SCHEMA_VERSION,
      packVersion: source.packVersion,
      gameDate: dayToDate(source.world.startDay),
      ...(source.valueModel ? { valueModel: source.valueModel } : {}),
    },
  });
}

export async function saveRoutes(
  app: FastifyInstance,
  { db, packs }: { db: Db; packs: PackService },
) {
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
    const dataPack = input.dataPack ?? FICTIONAL_PACK;
    if (!packs.has(dataPack)) {
      throw new AppError('VALIDATION_ERROR', `Data pack "${dataPack}" is not installed`, {
        dataPack: ['This data pack is not available. Run the importer first.'],
      });
    }
    const started = Date.now();
    const source = worldFor(packs, dataPack, seed);
    if (dataPack !== FICTIONAL_PACK) await packs.ensureInstalled(db, packs.load(dataPack));
    const save = await db.$transaction(
      async (tx) => {
        const created = await tx.saveGame.create({
          data: {
            userId,
            name: input.name,
            managerName: input.managerName,
            seed,
            dataPack,
            gameDate: dayToDate(source.world.startDay),
          },
        });
        return storeWorld(tx, created.id, source);
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    request.log.info(
      { dataPack, players: source.world.players.length, ms: Date.now() - started },
      'Created save world',
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
    const source = worldFor(packs, save.dataPack, save.seed, save.packVersion);
    const updated = await db.$transaction((tx) => storeWorld(tx, save.id, source), {
      timeout: 120_000,
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
