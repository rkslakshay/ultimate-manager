import { ageOn, POSITIONS } from '@um/engine';
import type {
  ClubRefDto,
  ClubSummaryDto,
  CompetitionDto,
  OriginDto,
  PlayerSourceDto,
  NationDto,
  PlayerDetailDto,
  PlayerSummaryDto,
  StadiumDto,
} from '@um/shared';
import type { Club, Competition, Nation, Player, Stadium } from '../generated/prisma/client';
import { dateToDay, isoDate } from './convert';

export const toNationDto = (n: Nation): NationDto => ({
  id: n.id,
  name: n.name,
  adjective: n.adjective,
  code: n.code,
  reputation: n.reputation,
  playable: n.playable,
});

export const toCompetitionDto = (c: Competition): CompetitionDto => ({
  id: c.id,
  nationId: c.nationId,
  name: c.name,
  shortName: c.shortName,
  kind: c.kind as CompetitionDto['kind'],
  tier: c.tier,
  reputation: c.reputation,
  clubCount: c.clubIds.length,
  promotionPlaces: c.promotionPlaces,
  relegationPlaces: c.relegationPlaces,
});

export const toStadiumDto = (s: Stadium): StadiumDto => ({
  id: s.id,
  name: s.name,
  city: s.city,
  capacity: s.capacity,
});

export const toClubRef = (c: Club): ClubRefDto => ({
  id: c.id,
  name: c.name,
  code: c.code,
  primaryColor: c.primaryColor,
  secondaryColor: c.secondaryColor,
  crestKey: c.crestKey,
  origin: c.origin as OriginDto,
});

export interface SquadStats {
  size: number;
  strength: number;
}

/** Squad size and strength (mean CA of the best 18) from a club's players' abilities. */
export function squadStats(abilities: number[]): SquadStats {
  const best = [...abilities].sort((a, b) => b - a).slice(0, 18);
  const strength = best.length ? Math.round(best.reduce((a, b) => a + b, 0) / best.length) : 0;
  return { size: abilities.length, strength };
}

export const toClubSummary = (c: Club, stats: SquadStats): ClubSummaryDto => ({
  ...toClubRef(c),
  shortName: c.shortName,
  city: c.city,
  nationId: c.nationId,
  leagueId: c.leagueId,
  reputation: c.reputation,
  balance: c.balance,
  transferBudget: c.transferBudget,
  wageBudget: c.wageBudget,
  squadSize: stats.size,
  strength: stats.strength,
});

export interface PlayerContext {
  /** Engine day number of the current in-game date (for ages). */
  today: number;
  nationCode: (nationId: number) => string;
  club: (clubId: number | null) => ClubRefDto | null;
}

export function toPlayerSummary(p: Player, ctx: PlayerContext): PlayerSummaryDto {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    nationId: p.nationId,
    nationCode: ctx.nationCode(p.nationId),
    birthDate: isoDate(p.birthDate),
    age: ageOn(dateToDay(p.birthDate), ctx.today),
    position: POSITIONS[p.primaryPosition] ?? 'MC',
    ca: p.ca,
    pa: p.pa,
    club: ctx.club(p.clubId),
    value: p.value,
    wage: p.wage,
    contractEnd: p.contractEnd ? isoDate(p.contractEnd) : null,
    squadStatus: p.squadStatus,
    origin: p.origin as OriginDto,
    shirtNumber: p.shirtNumber,
  };
}

function toPlayerSource(source: unknown): PlayerSourceDto | null {
  if (!source || typeof source !== 'object') return null;
  const s = source as PlayerSourceDto;
  return {
    key: s.key,
    overall: s.overall ?? null,
    potential: s.potential ?? null,
    attributeOrigin: s.attributeOrigin ?? '',
    fields: s.fields ?? {},
  };
}

export function toPlayerDetail(
  p: Player,
  ctx: PlayerContext,
  nation: Nation,
  includeHidden: boolean,
): PlayerDetailDto {
  return {
    ...toPlayerSummary(p, ctx),
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    foot: p.foot as PlayerDetailDto['foot'],
    weakFoot: p.weakFoot,
    attributes: p.attributes,
    positions: p.positions,
    traits: p.traits,
    contractStart: p.contractStart ? isoDate(p.contractStart) : null,
    releaseClause: p.releaseClause,
    nation: toNationDto(nation),
    ...(includeHidden ? { hidden: p.hidden } : {}),
    source: toPlayerSource(p.source),
  };
}
