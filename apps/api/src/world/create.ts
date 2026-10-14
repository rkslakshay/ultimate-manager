import {
  ageOn,
  createRng,
  currentAbility,
  expectedWage,
  generatePlayer,
  marketValue,
  P,
  parseIsoDate,
  roundClamp,
  roundMoney,
  seasonEndDay,
  type NameFlavour,
  type Player,
} from '@um/engine';
import {
  clubCreateSchema,
  playerCreateSchema,
  type ClubCreate,
  type PlayerCreate,
} from '@um/shared';
import type { Db } from '../db';
import type { Prisma, SaveGame } from '../generated/prisma/client';
import { AppError, notFound } from '../lib/errors';
import { dateToDay } from './convert';
import { bulkInsertPlayers } from './world-repo';

type Tx = Prisma.TransactionClient | Db;

async function nextId(
  tx: Tx,
  table: 'club' | 'player' | 'stadium',
  saveId: string,
): Promise<number> {
  const agg =
    table === 'club'
      ? await tx.club.aggregate({ where: { saveId }, _max: { id: true } })
      : table === 'player'
        ? await tx.player.aggregate({ where: { saveId }, _max: { id: true } })
        : await tx.stadium.aggregate({ where: { saveId }, _max: { id: true } });
  return (agg._max.id ?? 0) + 1;
}

/** Add a user-made club to a league, with a stadium and finances scaled to its reputation. */
export async function createClub(tx: Tx, save: SaveGame, raw: ClubCreate): Promise<number> {
  const input = clubCreateSchema.parse(raw);
  const league = await tx.competition.findUnique({
    where: { saveId_id: { saveId: save.id, id: input.leagueId } },
  });
  if (!league || league.kind !== 'league')
    throw new AppError('VALIDATION_ERROR', 'Unknown league', { leagueId: ['Unknown league'] });
  const clubId = await nextId(tx, 'club', save.id);
  const stadiumId = await nextId(tx, 'stadium', save.id);
  const rep = input.reputation ?? 40;
  await tx.stadium.create({
    data: {
      saveId: save.id,
      id: stadiumId,
      name: input.stadiumName ?? `${input.name} Stadium`,
      city: input.city ?? null,
      capacity: input.stadiumCapacity ?? roundMoney(3000 + rep ** 2 * 7),
    },
  });
  const balance = roundMoney(Math.exp(rep / 12) * 20000);
  await tx.club.create({
    data: {
      saveId: save.id,
      id: clubId,
      name: input.name,
      shortName: input.shortName ?? input.name,
      code: input.code,
      nationId: league.nationId,
      city: input.city ?? null,
      founded: null,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      reputation: rep,
      stadiumId,
      leagueId: league.id,
      balance,
      transferBudget: roundMoney(balance * 0.35),
      wageBudget: roundMoney(expectedWage(40 + rep * 1.3, 26, rep) * 26),
      trainingFacilities: roundClamp(rep / 6 + 2, 1, 20),
      youthFacilities: roundClamp(rep / 6 + 2, 1, 20),
      origin: 'custom',
    },
  });
  await tx.competition.update({
    where: { saveId_id: { saveId: save.id, id: league.id } },
    data: { clubIds: [...league.clubIds, clubId] },
  });
  // Cups of the same nation include every league club.
  const cups = await tx.competition.findMany({
    where: { saveId: save.id, kind: 'cup', nationId: league.nationId },
  });
  for (const cup of cups) {
    await tx.competition.update({
      where: { saveId_id: { saveId: save.id, id: cup.id } },
      data: { clubIds: [...cup.clubIds, clubId] },
    });
  }
  return clubId;
}

/** Add a user-made player. Without explicit attributes, the engine generates a consistent profile. */
export async function createPlayer(tx: Tx, save: SaveGame, raw: PlayerCreate): Promise<number> {
  const input = playerCreateSchema.parse(raw);
  const nation = await tx.nation.findUnique({
    where: { saveId_id: { saveId: save.id, id: input.nationId } },
  });
  if (!nation)
    throw new AppError('VALIDATION_ERROR', 'Unknown nation', { nationId: ['Unknown nation'] });
  const club = input.clubId
    ? await tx.club.findUnique({ where: { saveId_id: { saveId: save.id, id: input.clubId } } })
    : null;
  if (input.clubId && !club) throw notFound('Club');
  const today = dateToDay(save.gameDate);
  let birthDay: number;
  try {
    birthDay = parseIsoDate(input.birthDate);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid birth date', { birthDate: ['Invalid date'] });
  }
  const age = ageOn(birthDay, today);
  if (age < 14 || age > 45)
    throw new AppError('VALIDATION_ERROR', 'Players must be 14-45 years old', {
      birthDate: ['Age must be 14-45'],
    });

  const id = await nextId(tx, 'player', save.id);
  const position = P[input.position];
  const generated = generatePlayer(createRng(`custom:${save.id}:${id}`), {
    id,
    nationId: nation.id,
    flavour: nation.flavour as NameFlavour,
    position,
    age,
    targetCa: input.ability ?? 100,
    referenceDay: today,
  });
  const attributes = input.attributes ?? generated.attributes;
  const ca = currentAbility(attributes, position);
  const pa = Math.max(input.pa ?? generated.pa, ca);
  const reputation = club?.reputation ?? 40;
  const endDay = input.contractEnd ? parseIsoDate(input.contractEnd) : seasonEndDay(today, 2);
  if (club && endDay <= today)
    throw new AppError('VALIDATION_ERROR', 'Contract must end after today', {
      contractEnd: ['Must be in the future'],
    });
  const player: Player = {
    ...generated,
    firstName: input.firstName ?? '',
    lastName: input.lastName,
    birthDay,
    heightCm: input.heightCm ?? 180,
    foot: input.foot ?? 'right',
    attributes,
    ca,
    pa,
    clubId: club?.id ?? null,
    contract: club
      ? {
          wage: input.wage ?? expectedWage(ca, age, reputation),
          startDay: today,
          endDay,
          squadStatus: 'rotation',
          releaseClause: null,
        }
      : null,
    value: marketValue({
      ca,
      pa,
      age,
      contractYearsLeft: club ? (endDay - today) / 365 : 0,
      reputation,
    }),
    origin: 'custom',
    shirtNumber: input.shirtNumber ?? null,
    source: null,
  };
  await bulkInsertPlayers(tx, save.id, [player]);
  return id;
}
