import {
  clubUpdateSchema,
  IMPORT_ENTITIES,
  playerUpdateSchema,
  worldImportRequestSchema,
  type WorldImportResult,
} from '@um/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import { AppError, notFound, parseInput } from '../lib/errors';
import { idParam, ownedSave, playerContext } from './context';
import { dateToDay } from './convert';
import { toClubRef, toPlayerDetail } from './dto';
import { exportEntity, importRecords, readRecords, updatePlayer } from './editor';

const exportQuery = z.object({
  entity: z.enum(IMPORT_ENTITIES),
  format: z.enum(['json', 'csv']).default('json'),
});

/** Database editor: rename/edit clubs and players, bulk import/export (JSON or CSV). */
export async function editorRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.patch('/clubs/:id', async (request) => {
    const save = await ownedSave(app, db, request);
    const { id } = parseInput(idParam, request.params);
    const input = parseInput(clubUpdateSchema, request.body);
    const club = await db.club.findUnique({ where: { saveId_id: { saveId: save.id, id } } });
    if (!club) throw notFound('Club');
    const updated = await db.club.update({
      where: { saveId_id: { saveId: save.id, id } },
      data: input,
    });
    if (input.name && save.managerClubId === id) {
      await db.saveGame.update({ where: { id: save.id }, data: { clubName: input.name } });
    }
    return toClubRef(updated);
  });

  app.patch('/players/:id', async (request) => {
    const save = await ownedSave(app, db, request);
    const { id } = parseInput(idParam, request.params);
    const input = parseInput(playerUpdateSchema, request.body);
    const player = await db.player.findUnique({ where: { saveId_id: { saveId: save.id, id } } });
    if (!player) throw notFound('Player');
    const updated = await updatePlayer(db, save.id, player, input, dateToDay(save.gameDate));
    const [ctx, nation] = await Promise.all([
      playerContext(db, save, [updated.clubId]),
      db.nation.findUniqueOrThrow({
        where: { saveId_id: { saveId: save.id, id: updated.nationId } },
      }),
    ]);
    return toPlayerDetail(updated, ctx, nation, true);
  });

  app.get('/export', async (request, reply) => {
    const save = await ownedSave(app, db, request);
    const { entity, format } = parseInput(exportQuery, request.query);
    const content = await exportEntity(db, save.id, entity, format);
    return reply
      .header(
        'content-type',
        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      )
      .header('content-disposition', `attachment; filename="${entity}.${format}"`)
      .send(content);
  });

  app.post('/import', { bodyLimit: 6 * 1024 * 1024 }, async (request) => {
    const save = await ownedSave(app, db, request);
    const { entity, format, content } = parseInput(worldImportRequestSchema, request.body);
    let records: Record<string, unknown>[];
    try {
      records = readRecords(format, content);
    } catch (err) {
      throw new AppError(
        'BAD_REQUEST',
        `Could not read ${format.toUpperCase()}: ${(err as Error).message}`,
      );
    }
    const result: WorldImportResult = await importRecords(
      db,
      save.id,
      entity,
      records,
      dateToDay(save.gameDate),
    );
    return result;
  });
}
