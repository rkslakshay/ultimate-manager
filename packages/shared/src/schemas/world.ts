import { ATTRIBUTE_COUNT, HIDDEN_KEYS, POSITION_COUNT, POSITIONS } from '@um/engine';
import { z } from 'zod';
import { paginationQuerySchema } from './common';

// ---------------------------------------------------------------- DTOs (API responses)

export interface NationDto {
  id: number;
  name: string;
  adjective: string;
  code: string;
  reputation: number;
  playable: boolean;
}

export interface CompetitionDto {
  id: number;
  nationId: number;
  name: string;
  shortName: string;
  kind: 'league' | 'cup';
  tier: number | null;
  reputation: number;
  clubCount: number;
  promotionPlaces: number;
  relegationPlaces: number;
}

export interface StadiumDto {
  id: number;
  name: string;
  city: string;
  capacity: number;
}

export interface ClubRefDto {
  id: number;
  name: string;
  code: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface ClubSummaryDto extends ClubRefDto {
  shortName: string;
  city: string;
  nationId: number;
  leagueId: number | null;
  reputation: number;
  balance: number;
  transferBudget: number;
  wageBudget: number;
  squadSize: number;
  /** Mean Current Ability of the 18 best players (squad strength indicator). */
  strength: number;
}

export interface PlayerSummaryDto {
  id: number;
  firstName: string;
  lastName: string;
  nationId: number;
  nationCode: string;
  birthDate: string;
  age: number;
  /** Primary position code, e.g. "MC". */
  position: string;
  ca: number;
  pa: number;
  club: ClubRefDto | null;
  value: number;
  wage: number | null;
  contractEnd: string | null;
  squadStatus: string | null;
}

export interface PlayerDetailDto extends PlayerSummaryDto {
  heightCm: number;
  weightKg: number;
  foot: 'left' | 'right' | 'either';
  weakFoot: number;
  /** 1-20 in engine ATTRIBUTE_KEYS order. */
  attributes: number[];
  /** Familiarity 1-20 per engine POSITIONS slot. */
  positions: number[];
  traits: string[];
  contractStart: string | null;
  releaseClause: number | null;
  nation: NationDto;
  /** Only returned to the database editor. */
  hidden?: number[];
}

export interface ClubDetailDto extends ClubSummaryDto {
  founded: number;
  trainingFacilities: number;
  youthFacilities: number;
  wageBill: number;
  stadium: StadiumDto;
  nation: NationDto;
  league: CompetitionDto | null;
  squad: PlayerSummaryDto[];
}

export interface WorldOverviewDto {
  nations: NationDto[];
  competitions: CompetitionDto[];
}

export interface CompetitionDetailDto extends CompetitionDto {
  nation: NationDto;
  clubs: ClubSummaryDto[];
}

// ---------------------------------------------------------------- Requests

export const PLAYER_SORT_FIELDS = [
  'name',
  'age',
  'ca',
  'pa',
  'value',
  'wage',
  'contractEnd',
] as const;
export type PlayerSortField = (typeof PLAYER_SORT_FIELDS)[number];

const booleanParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const playerSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(60).optional(),
  position: z.enum(POSITIONS).optional(),
  nationId: z.coerce.number().int().positive().optional(),
  clubId: z.coerce.number().int().positive().optional(),
  minAge: z.coerce.number().int().min(14).max(50).optional(),
  maxAge: z.coerce.number().int().min(14).max(50).optional(),
  minCa: z.coerce.number().int().min(1).max(200).optional(),
  maxValue: z.coerce.number().min(0).optional(),
  freeAgents: booleanParam,
  /** Contract ends within the current season. */
  expiring: booleanParam,
  sort: z.enum(PLAYER_SORT_FIELDS).default('ca'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PlayerSearchQuery = z.infer<typeof playerSearchQuerySchema>;
export type PlayerSearchParams = z.input<typeof playerSearchQuerySchema>;

export const chooseClubRequestSchema = z.object({ clubId: z.number().int().positive() });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #1d428a');
const nameField = (max: number) => z.string().trim().min(1).max(max);

export const clubUpdateSchema = z
  .object({
    name: nameField(50),
    shortName: nameField(30),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,4}$/, '2-4 letters or digits'),
    city: nameField(40),
    primaryColor: hexColor,
    secondaryColor: hexColor,
  })
  .partial();
export type ClubUpdate = z.infer<typeof clubUpdateSchema>;

const rating = z.number().int().min(1).max(20);

export const playerUpdateSchema = z
  .object({
    firstName: nameField(30),
    lastName: nameField(40),
    attributes: z.array(rating).length(ATTRIBUTE_COUNT),
    hidden: z.array(rating).length(HIDDEN_KEYS.length),
    positions: z.array(rating).length(POSITION_COUNT),
    pa: z.number().int().min(1).max(200),
  })
  .partial();
export type PlayerUpdate = z.infer<typeof playerUpdateSchema>;

export const IMPORT_ENTITIES = ['clubs', 'players'] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export const worldImportRequestSchema = z.object({
  entity: z.enum(IMPORT_ENTITIES),
  format: z.enum(['json', 'csv']),
  content: z.string().min(1).max(5_000_000),
});
export type WorldImportRequest = z.infer<typeof worldImportRequestSchema>;

export interface WorldImportResult {
  updated: number;
  errors: { row: number; message: string }[];
}
