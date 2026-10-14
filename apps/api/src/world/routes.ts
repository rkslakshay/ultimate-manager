import { addYears, P, seasonEndDay } from '@um/engine';
import {
  paginate,
  playerSearchQuerySchema,
  type ClubDetailDto,
  type CompetitionDetailDto,
  type PlayerHistoryDto,
  type PlayerSearchQuery,
  type WorldOverviewDto,
} from '@um/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import type { Prisma, SaveGame } from '../generated/prisma/client';
import { notFound, parseInput } from '../lib/errors';
import { idParam, ownedSave, playerContext } from './context';
import { dateToDay, dayToDate, isoDate } from './convert';
import {
  squadStats,
  toClubSummary,
  toCompetitionDto,
  toNationDto,
  toPlayerDetail,
  toPlayerSummary,
  toStadiumDto,
} from './dto';

/** Squad size/strength for many clubs with one query. */
async function statsForClubs(db: Db, saveId: string, clubIds: number[]) {
  const rows = await db.player.findMany({
    where: { saveId, clubId: { in: clubIds }, retired: false },
    select: { clubId: true, ca: true },
  });
  const byClub = new Map<number, number[]>(clubIds.map((id) => [id, []]));
  for (const r of rows) byClub.get(r.clubId!)?.push(r.ca);
  return (id: number) => squadStats(byClub.get(id) ?? []);
}

const SORT_FIELDS: Record<
  PlayerSearchQuery['sort'],
  (o: 'asc' | 'desc') => Prisma.PlayerOrderByWithRelationInput[]
> = {
  name: (o) => [{ lastName: o }, { firstName: o }],
  // Ascending age = most recent birth date first.
  age: (o) => [{ birthDate: o === 'asc' ? 'desc' : 'asc' }],
  ca: (o) => [{ ca: o }],
  pa: (o) => [{ pa: o }],
  value: (o) => [{ value: o }],
  wage: (o) => [{ wage: { sort: o, nulls: 'last' } }],
  contractEnd: (o) => [{ contractEnd: { sort: o, nulls: 'last' } }],
};

export function playerSearchWhere(save: SaveGame, q: PlayerSearchQuery): Prisma.PlayerWhereInput {
  const today = dateToDay(save.gameDate);
  const where: Prisma.PlayerWhereInput = { saveId: save.id, retired: false };
  const and: Prisma.PlayerWhereInput[] = [];
  if (q.q) {
    for (const term of q.q.split(/\s+/).filter(Boolean)) {
      and.push({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
  }
  if (q.position) where.primaryPosition = P[q.position];
  if (q.nationId) where.nationId = q.nationId;
  if (q.clubId) where.clubId = q.clubId;
  if (q.freeAgents) where.clubId = null;
  if (q.minCa) where.ca = { gte: q.minCa };
  if (q.maxValue !== undefined) where.value = { lte: q.maxValue };
  const birth: Prisma.DateTimeFilter = {};
  // Age >= minAge  ⇔  born on or before today minus minAge years.
  if (q.minAge) birth.lte = dayToDate(addYears(today, -q.minAge));
  // Age <= maxAge  ⇔  born after today minus (maxAge + 1) years.
  if (q.maxAge) birth.gt = dayToDate(addYears(today, -(q.maxAge + 1)));
  if (birth.lte || birth.gt) where.birthDate = birth;
  if (q.expiring) where.contractEnd = { lte: dayToDate(seasonEndDay(today, 0)) };
  if (and.length) where.AND = and;
  return where;
}

export async function worldRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/overview', async (request) => {
    const save = await ownedSave(app, db, request);
    const [nations, competitions] = await Promise.all([
      db.nation.findMany({ where: { saveId: save.id }, orderBy: { id: 'asc' } }),
      db.competition.findMany({ where: { saveId: save.id }, orderBy: { id: 'asc' } }),
    ]);
    const response: WorldOverviewDto = {
      nations: nations.map(toNationDto),
      competitions: competitions.map(toCompetitionDto),
    };
    return response;
  });

  app.get('/competitions/:id', async (request) => {
    const save = await ownedSave(app, db, request);
    const { id } = parseInput(idParam, request.params);
    const comp = await db.competition.findUnique({ where: { saveId_id: { saveId: save.id, id } } });
    if (!comp) throw notFound('Competition');
    const [nation, clubs] = await Promise.all([
      db.nation.findUniqueOrThrow({ where: { saveId_id: { saveId: save.id, id: comp.nationId } } }),
      db.club.findMany({ where: { saveId: save.id, id: { in: comp.clubIds } } }),
    ]);
    const stats = await statsForClubs(db, save.id, comp.clubIds);
    const response: CompetitionDetailDto = {
      ...toCompetitionDto(comp),
      nation: toNationDto(nation),
      clubs: clubs
        .map((c) => toClubSummary(c, stats(c.id)))
        .sort((a, b) => b.reputation - a.reputation),
    };
    return response;
  });

  app.get('/clubs', async (request) => {
    const save = await ownedSave(app, db, request);
    const { leagueId } = parseInput(
      z.object({ leagueId: z.coerce.number().int().positive().optional() }),
      request.query,
    );
    const clubs = await db.club.findMany({
      where: { saveId: save.id, ...(leagueId ? { leagueId } : { leagueId: { not: null } }) },
      orderBy: [{ reputation: 'desc' }, { name: 'asc' }],
    });
    const stats = await statsForClubs(
      db,
      save.id,
      clubs.map((c) => c.id),
    );
    return { items: clubs.map((c) => toClubSummary(c, stats(c.id))) };
  });

  app.get('/clubs/:id', async (request) => {
    const save = await ownedSave(app, db, request);
    const { id } = parseInput(idParam, request.params);
    const club = await db.club.findUnique({ where: { saveId_id: { saveId: save.id, id } } });
    if (!club) throw notFound('Club');
    const [stadium, nation, league, squad] = await Promise.all([
      db.stadium.findUniqueOrThrow({
        where: { saveId_id: { saveId: save.id, id: club.stadiumId } },
      }),
      db.nation.findUniqueOrThrow({ where: { saveId_id: { saveId: save.id, id: club.nationId } } }),
      club.leagueId
        ? db.competition.findUnique({
            where: { saveId_id: { saveId: save.id, id: club.leagueId } },
          })
        : null,
      db.player.findMany({
        where: { saveId: save.id, clubId: club.id, retired: false },
        orderBy: [{ primaryPosition: 'asc' }, { ca: 'desc' }],
      }),
    ]);
    const ctx = await playerContext(db, save, [club.id]);
    const response: ClubDetailDto = {
      ...toClubSummary(club, squadStats(squad.map((p) => p.ca))),
      founded: club.founded,
      sourceFields:
        (club.source as { fields?: ClubDetailDto['sourceFields'] } | null)?.fields ?? null,
      trainingFacilities: club.trainingFacilities,
      youthFacilities: club.youthFacilities,
      wageBill: squad.reduce((sum, p) => sum + (p.wage ?? 0), 0),
      stadium: toStadiumDto(stadium),
      nation: toNationDto(nation),
      league: league ? toCompetitionDto(league) : null,
      squad: squad.map((p) => toPlayerSummary(p, ctx)),
    };
    return response;
  });

  app.get('/players', async (request) => {
    const save = await ownedSave(app, db, request);
    const query = parseInput(playerSearchQuerySchema, request.query);
    const where = playerSearchWhere(save, query);
    const [rows, total] = await Promise.all([
      db.player.findMany({
        where,
        orderBy: [...SORT_FIELDS[query.sort](query.order), { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.player.count({ where }),
    ]);
    const ctx = await playerContext(
      db,
      save,
      rows.map((r) => r.clubId),
    );
    return paginate(
      rows.map((p) => toPlayerSummary(p, ctx)),
      total,
      query,
    );
  });

  /** Real-world transfer and market-value history from the save's data pack. */
  app.get('/players/:id/history', async (request) => {
    const save = await ownedSave(app, db, request);
    const { id } = parseInput(idParam, request.params);
    const player = await db.player.findUnique({
      where: { saveId_id: { saveId: save.id, id } },
      select: { id: true, origin: true },
    });
    if (!player) throw notFound('Player');
    const empty: PlayerHistoryDto = {
      transfers: [],
      valuations: [],
      dataPack: save.dataPack,
      packVersion: save.packVersion,
    };
    // Only imported players have real history; generated and custom players never do.
    if (player.origin !== 'imported' || !save.packVersion) return empty;
    const where = { pack: save.dataPack, version: save.packVersion, playerId: id };
    const [transfers, valuations] = await Promise.all([
      db.historicalTransfer.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
      db.historicalValuation.findMany({ where, orderBy: { date: 'asc' } }),
    ]);
    const response: PlayerHistoryDto = {
      ...empty,
      transfers: transfers.map((t) => ({
        date: isoDate(t.date),
        season: t.season,
        fromClub: { id: t.fromClubId, name: t.fromClubName },
        toClub: { id: t.toClubId, name: t.toClubName },
        feeEur: t.feeEur,
        feeStatus: t.feeStatus as PlayerHistoryDto['transfers'][number]['feeStatus'],
        marketValueEur: t.marketValueEur,
        type: t.type,
        source: t.source,
      })),
      valuations: valuations.map((v) => ({
        date: isoDate(v.date),
        valueEur: v.valueEur,
        source: v.source,
      })),
    };
    return response;
  });

  app.get('/players/:id', async (request) => {
    const save = await ownedSave(app, db, request);
    const { id } = parseInput(idParam, request.params);
    const { hidden } = parseInput(
      z.object({ hidden: z.enum(['true', 'false']).optional() }),
      request.query,
    );
    const player = await db.player.findUnique({ where: { saveId_id: { saveId: save.id, id } } });
    if (!player) throw notFound('Player');
    const [ctx, nation] = await Promise.all([
      playerContext(db, save, [player.clubId]),
      db.nation.findUniqueOrThrow({
        where: { saveId_id: { saveId: save.id, id: player.nationId } },
      }),
    ]);
    return toPlayerDetail(player, ctx, nation, hidden === 'true');
  });
}
