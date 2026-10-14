import {
  addYears,
  ageOn,
  createRng,
  currentAbility,
  dayFromCivil,
  pickTraits,
  roundClamp,
  seasonEndDay,
  type DayNumber,
  type Foot,
  type Player,
  type PlayerField,
  type Provenance,
} from '@um/engine';
import { mapAttributes } from '../mapping/attributes';
import { potentialFor } from '../mapping/ability';
import { deriveHidden } from '../mapping/hidden';
import { mapEaPositions } from '../mapping/positions';
import { mapTraits } from '../mapping/traits';
import type { EaPlayer, TmPlayer } from '../sources/records';
import type { BuildContext, EaWithClub } from './context';

/** Our 1-20 weaker-foot scale from the source's 1-5 stars. */
const WEAK_FOOT: Record<number, number> = { 1: 3, 2: 7, 3: 11, 4: 15, 5: 19 };

/** Split a display name into first/last, preferring explicit fields from the source. */
export function splitName(
  ea: Pick<EaPlayer, 'name' | 'fullName'>,
  tm: Pick<TmPlayer, 'firstName' | 'lastName'> | null,
) {
  if (tm?.lastName) return { firstName: tm.firstName ?? '', lastName: tm.lastName };
  const initial = /^(\p{Lu})\.\s+(.+)$/u.exec(ea.name);
  if (initial) {
    const first = ea.fullName?.split(/\s+/)[0];
    return {
      firstName: first && first[0] === initial[1] ? first : `${initial[1]}.`,
      lastName: initial[2]!,
    };
  }
  const tokens = ea.name.trim().split(/\s+/);
  if (tokens.length === 1) return { firstName: '', lastName: tokens[0]! };
  return { firstName: tokens[0]!, lastName: tokens.slice(1).join(' ') };
}

export interface BuiltPlayer {
  player: Player;
  ea: EaPlayer;
  tm: TmPlayer | null;
  clubKey: string;
  /** Wage must be simulated once club reputations are known. */
  needsWage: boolean;
  /** Value must be estimated once the value model is fitted. */
  needsValue: boolean;
}

export interface PlayerBuildDeps {
  ctx: BuildContext;
  offset: number;
  nationId: (name: string) => number;
  /** Club key decided for the player, after cross-source checks (null = drop). */
  clubKeyFor: (p: EaWithClub, tm: TmPlayer | null) => string | null;
}

/** Turn one ratings-source player (plus its matched Transfermarkt-style record) into a game player. */
export function buildPlayer(p: EaWithClub, deps: PlayerBuildDeps): BuiltPlayer | null {
  const { ctx, offset } = deps;
  const { log, startDay } = ctx;
  const tm = ctx.tmByEa.get(p.sourceId) ?? null;
  const fields: Partial<Record<PlayerField, Provenance>> = {};
  const S = 'source_backed' as const;

  // Identity.
  let birthDay: DayNumber | null = p.dob ?? tm?.dob ?? null;
  fields.birthDay = birthDay !== null ? S : 'derived';
  if (birthDay === null && p.age !== null) birthDay = addYears(startDay, -p.age) - 182;
  if (birthDay === null) return (log.count('drop.player_without_age'), null);
  const nationality = p.nationality ?? tm?.nationality ?? null;
  if (!nationality) return (log.count('drop.player_without_nationality'), null);
  fields.nationality = S;
  fields.name = S;
  const clubKey = deps.clubKeyFor(p, tm);
  if (!clubKey) return (log.count('drop.player_club_not_included'), null);
  fields.club = S;

  // Abilities.
  const positions = mapEaPositions(p.positions);
  if (positions.unknown.length) log.count('mapping.unknown_position_code');
  fields.positions = S;
  const age = ageOn(birthDay, startDay);
  const mapped = mapAttributes({
    ratings: p.ratings,
    primaryPosition: positions.primary,
    age,
    heightCm: p.heightCm ?? tm?.heightCm ?? null,
    skillMoves: p.skillMoves,
    workRate: p.workRate,
    internationalReputation: p.internationalReputation,
    rng: createRng(`attributes:${p.sourceId}`),
    offset,
  });
  const hidden = deriveHidden({
    rng: createRng(`hidden:${p.sourceId}`),
    attributes: mapped.attributes,
    overall: p.overall,
    positionsListed: p.positions.length,
    internationalReputation: p.internationalReputation,
    traits: p.traits,
  });
  const ca = currentAbility(mapped.attributes, positions.primary);
  const pa = potentialFor(ca, p.overall, p.potential);
  fields.ability = 'derived'; // CA/PA computed by our model from mapped attributes (see DATA_MAPPING.md)

  let traits;
  if (ctx.data.eaColumns.includes('traits')) {
    const t = mapTraits(p.traits);
    if (t.unmapped.length) log.count('mapping.unmapped_traits', t.unmapped.length);
    traits = t.traits;
    fields.traits = S;
  } else {
    traits = pickTraits(
      createRng(`traits:${p.sourceId}`),
      mapped.attributes,
      positions.primary,
      age,
    );
    fields.traits = 'derived';
  }

  // Body.
  const heightCm = p.heightCm ?? tm?.heightCm ?? null;
  fields.height = heightCm !== null ? S : 'derived';
  const weightKg = p.weightKg ?? null;
  fields.weight = weightKg !== null ? S : 'derived';
  let foot: Foot = p.foot ?? tm?.foot ?? 'right';
  if (p.weakFoot === 5) foot = 'either';
  fields.foot = p.foot || tm?.foot ? S : 'derived';

  // Contract.
  let endDay: DayNumber | null = tm?.contractEnd ?? null;
  if (endDay !== null) fields.contractEnd = S;
  else if (p.contractUntilYear) {
    endDay = dayFromCivil(p.contractUntilYear, 6, 30);
    fields.contractEnd = S; // the year is source-backed; the 30 June day is our convention
  }
  if (endDay === null || endDay <= startDay) {
    if (endDay !== null) log.count('contract.expired_before_start');
    else log.count('contract.missing_end');
    endDay = seasonEndDay(startDay, createRng(`contract:${p.sourceId}`).int(0, 2));
    fields.contractEnd = 'simulated';
  }
  const startContract =
    p.joined !== null && p.joined <= startDay ? p.joined : Math.min(startDay, endDay) - 365;
  fields.contractStart = p.joined !== null ? S : 'derived';
  const needsWage = !(p.wageEur && p.wageEur > 0);
  fields.wage = needsWage ? 'simulated' : S;
  fields.releaseClause = p.releaseClauseEur ? S : 'unknown';

  // Value: Transfermarkt-style current market value, else the ratings source's value.
  const value =
    tm?.marketValueEur && tm.marketValueEur > 0
      ? tm.marketValueEur
      : p.valueEur && p.valueEur > 0
        ? p.valueEur
        : null;
  fields.value = value !== null ? S : 'simulated';
  fields.shirtNumber = p.jersey !== null ? S : 'unknown';

  const keys = [`ea:${p.sourceId}`, ...(tm ? [`tm:${tm.sourceId}`] : [])];
  const id = ctx.ids.id('players', keys);
  const { firstName, lastName } = splitName(p, tm);

  const player: Player = {
    id,
    firstName,
    lastName,
    nationId: deps.nationId(nationality),
    birthDay,
    heightCm: heightCm ?? (positions.primary === 0 ? 189 : 181),
    weightKg: weightKg ?? roundClamp((heightCm ?? 181) - 104, 58, 100),
    foot,
    weakFoot: p.weakFoot !== null ? (WEAK_FOOT[p.weakFoot] ?? 8) : 8,
    attributes: mapped.attributes,
    hidden: hidden.hidden,
    positions: positions.familiarity,
    primaryPosition: positions.primary,
    ca,
    pa,
    traits,
    clubId: null, // set when clubs get ids
    contract: {
      wage: needsWage ? 0 : p.wageEur!,
      startDay: startContract,
      endDay,
      squadStatus: 'rotation',
      releaseClause: p.releaseClauseEur && p.releaseClauseEur > 0 ? p.releaseClauseEur : null,
    },
    value: value ?? 0,
    retired: false,
    origin: 'imported',
    shirtNumber: p.jersey,
    source: {
      key: keys.join('|'),
      fields,
      overall: p.overall,
      potential: p.potential,
      attributeOrigin: mapped.origin,
      hiddenOrigin: hidden.origin,
    },
  };
  return { player, ea: p, tm, clubKey, needsWage, needsValue: value === null };
}
