import { type DayNumber, ageOn, parseIsoDate } from '../core/date';
import { clamp, roundClamp, roundMoney, sum } from '../core/math';
import { marketValue } from '../economy/value';
import {
  generateClubName,
  generateTownNames,
  clubCode,
  generatePersonName,
} from '../names/generate';
import { generatePlayer } from '../players/generate-player';
import { P, POSITIONS } from '../players/positions';
import { createRng, type Rng } from '../rng/rng';
import { CLUB_COLOURS, DEFAULT_NATIONS, DIVISION_NAMES, type NationDefinition } from './nations';
import { generateSquad } from './squads';
import type { Club, Competition, Nation, Player, Stadium, WorldState } from './types';

/** v2: origins, provenance, shirt numbers, crests, nation name pools, nullable club city/founded. */
export const WORLD_SCHEMA_VERSION = 2;
export const DEFAULT_START_DATE = '2026-07-01';

export interface GenerateWorldOptions {
  /** Career start (ISO date). Defaults to 1 July 2026. */
  startDate?: string;
  nations?: NationDefinition[];
  /** Unattached players available at the start. */
  freeAgents?: number;
}

/** Reputation for the club ranked `rank` (0 = biggest) of `count` in a division. */
function clubReputation(
  rng: Rng,
  nationRep: number,
  tier: number,
  rank: number,
  count: number,
): number {
  const t = count > 1 ? rank / (count - 1) : 0;
  const rep =
    tier === 1
      ? nationRep + 8 - 38 * t ** 0.85 + rng.normal(0, 1.5)
      : nationRep - 34 - 22 * t + rng.normal(0, 1.5);
  return roundClamp(rep, 5, 99);
}

function stadiumName(rng: Rng, nation: Nation, town: string): string {
  const pattern = rng.weighted(['town', 'person', 'arena', 'park'], [4, 2, 2, 1]);
  if (pattern === 'person') return `${generatePersonName(rng, nation.flavour).lastName} Stadium`;
  if (pattern === 'arena') return `${town} Arena`;
  if (pattern === 'park') return `${town} Park`;
  return `${town} Stadium`;
}

/**
 * Generate a complete fictional world from a seed. Pure and deterministic: the same seed and
 * options always produce an identical world.
 */
export function generateWorld(seed: string, options: GenerateWorldOptions = {}): WorldState {
  const startDay: DayNumber = parseIsoDate(options.startDate ?? DEFAULT_START_DATE);
  const definitions = options.nations ?? DEFAULT_NATIONS;
  const root = createRng(`world:${seed}`);

  const nations: Nation[] = definitions.map((d, i) => ({
    id: i + 1,
    name: d.name,
    adjective: d.adjective,
    code: d.code,
    flavour: d.flavour,
    reputation: d.reputation,
    playable: d.divisions.length > 0,
    namePool: null,
  }));

  const competitions: Competition[] = [];
  const clubs: Club[] = [];
  const stadiums: Stadium[] = [];
  const players: Player[] = [];
  let playerId = 0;
  const nextPlayerId = () => ++playerId;

  definitions.forEach((def, ni) => {
    if (!def.divisions.length) return;
    const nation = nations[ni]!;
    const rng = root.fork(`nation:${nation.id}`);
    const totalClubs = sum(def.divisions);
    const towns = generateTownNames(rng, nation.flavour, totalClubs);
    let townIndex = 0;
    const leagueIds: number[] = [];

    def.divisions.forEach((count, di) => {
      const tier = di + 1;
      const league: Competition = {
        id: competitions.length + 1,
        nationId: nation.id,
        name: `${nation.adjective} ${DIVISION_NAMES[di] ?? `Division ${tier}`}`,
        shortName: `${nation.code} ${tier}`,
        kind: 'league',
        tier,
        reputation: roundClamp(nation.reputation - di * 22, 1, 100),
        clubIds: [],
        promotionPlaces: di === 0 ? 0 : 3,
        relegationPlaces: di === def.divisions.length - 1 ? 0 : 3,
        origin: 'generated',
      };
      competitions.push(league);
      leagueIds.push(league.id);

      for (let rank = 0; rank < count; rank++) {
        const town = towns[townIndex++]!;
        const reputation = clubReputation(rng, nation.reputation, tier, rank, count);
        const stadium: Stadium = {
          id: stadiums.length + 1,
          name: stadiumName(rng, nation, town),
          city: town,
          capacity: roundMoney(
            clamp((3000 + reputation ** 2 * 7) * rng.float(0.8, 1.2), 1500, 95000),
          ),
        };
        stadiums.push(stadium);
        const [primaryColor, secondaryColor] = rng.pick(CLUB_COLOURS);
        const balance = roundMoney(Math.exp(reputation / 12) * 20000 * rng.float(0.6, 1.4));
        const club: Club = {
          id: clubs.length + 1,
          name: generateClubName(rng, nation.flavour, town),
          shortName: town,
          code: clubCode(town),
          nationId: nation.id,
          city: town,
          founded: rng.int(1872, 1978),
          primaryColor,
          secondaryColor,
          reputation,
          stadiumId: stadium.id,
          leagueId: league.id,
          balance,
          transferBudget: roundMoney(balance * rng.float(0.2, 0.45)),
          wageBudget: 0,
          trainingFacilities: roundClamp(reputation / 6 + rng.normal(2, 2), 1, 20),
          youthFacilities: roundClamp(reputation / 6 + rng.normal(2, 2.5), 1, 20),
          origin: 'generated',
          crestKey: null,
          source: null,
        };
        clubs.push(club);
        league.clubIds.push(club.id);

        const squad = generateSquad({
          rng: rng.fork(`squad:${club.id}`),
          club,
          nation,
          nations,
          startDay,
          nextPlayerId,
        });
        players.push(...squad);
        const wageBill = sum(squad.map((p) => p.contract?.wage ?? 0));
        club.wageBudget = roundMoney(wageBill * rng.float(1.02, 1.15));
      }
    });

    competitions.push({
      id: competitions.length + 1,
      nationId: nation.id,
      name: `${nation.name} Cup`,
      shortName: `${nation.code} Cup`,
      kind: 'cup',
      tier: null,
      reputation: roundClamp(nation.reputation - 10, 1, 100),
      clubIds: leagueIds.flatMap((id) => competitions.find((c) => c.id === id)!.clubIds),
      promotionPlaces: 0,
      relegationPlaces: 0,
      origin: 'generated',
    });
  });

  // Unattached players: mostly journeymen, a few decent ones waiting for a club.
  const faRng = root.fork('free-agents');
  for (let i = 0; i < (options.freeAgents ?? 160); i++) {
    const nation = faRng.weighted(
      nations,
      nations.map((n) => n.reputation),
    );
    const age = roundClamp(faRng.normal(27, 4.5), 18, 36);
    const position = faRng.weighted(
      POSITIONS.map((_, idx) => idx),
      POSITIONS.map((p) => (p === 'GK' ? 2 : ['WBL', 'WBR'].includes(p) ? 0.5 : 1.5)),
    );
    const player = generatePlayer(faRng, {
      id: nextPlayerId(),
      nationId: nation.id,
      flavour: nation.flavour,
      position: position === P.WBL || position === P.WBR ? P.DC : position,
      age,
      targetCa: faRng.normalClamped(78, 18, 40, 125),
      referenceDay: startDay,
    });
    player.value = marketValue({
      ca: player.ca,
      pa: player.pa,
      age: ageOn(player.birthDay, startDay),
      contractYearsLeft: 0,
      reputation: 40,
    });
    players.push(player);
  }

  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    seed,
    startDay,
    nations,
    competitions,
    clubs,
    stadiums,
    players,
  };
}
