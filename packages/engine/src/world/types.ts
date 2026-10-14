import type { DayNumber } from '../core/date';
import type { NameFlavour } from '../names/flavours';
import type { TraitId } from '../players/traits';

/**
 * The complete, serialisable state of one save's game world. Plain data only (no classes,
 * Maps or functions) so it can be stored, sent to workers and diffed. IDs are small integers
 * unique within a save; the database keys rows by (saveId, id).
 */
export interface WorldState {
  /** Bumped when the shape of WorldState changes. */
  schemaVersion: number;
  seed: string;
  /** Day the career starts (pre-season). */
  startDay: DayNumber;
  nations: Nation[];
  competitions: Competition[];
  clubs: Club[];
  stadiums: Stadium[];
  players: Player[];
}

export interface Nation {
  id: number;
  name: string;
  /** Demonym / adjective, e.g. "Valdorian". */
  adjective: string;
  /** Three-letter code. */
  code: string;
  flavour: NameFlavour;
  /** 1-100: football strength / prestige. */
  reputation: number;
  /** Has a playable league system in this world. */
  playable: boolean;
}

export type CompetitionKind = 'league' | 'cup';

export interface Competition {
  id: number;
  nationId: number;
  name: string;
  shortName: string;
  kind: CompetitionKind;
  /** 1 = top division; null for cups. */
  tier: number | null;
  reputation: number;
  /** Member clubs (leagues). Cups draw from their nation's leagues. */
  clubIds: number[];
  /** Number of clubs promoted to the tier above (0 for top tier). */
  promotionPlaces: number;
  /** Number of clubs relegated to the tier below (0 for bottom tier). */
  relegationPlaces: number;
}

export interface Stadium {
  id: number;
  name: string;
  city: string;
  capacity: number;
}

export interface Club {
  id: number;
  name: string;
  shortName: string;
  /** Three-letter code for compact displays. */
  code: string;
  nationId: number;
  city: string;
  founded: number;
  primaryColor: string;
  secondaryColor: string;
  /** 1-100. */
  reputation: number;
  stadiumId: number;
  /** League the club plays in (null only for clubs outside the league system). */
  leagueId: number | null;
  /** Current bank balance. */
  balance: number;
  transferBudget: number;
  /** Weekly wage budget. */
  wageBudget: number;
  /** 1-20. */
  trainingFacilities: number;
  /** 1-20. */
  youthFacilities: number;
}

export type Foot = 'left' | 'right' | 'either';

export type SquadStatus = 'key' | 'firstTeam' | 'rotation' | 'backup' | 'prospect';

export interface Contract {
  /** Weekly wage. */
  wage: number;
  startDay: DayNumber;
  /** Contract ends on this day (always 30 June). */
  endDay: DayNumber;
  squadStatus: SquadStatus;
  /** Fee that compels the club to accept an offer; null when none. */
  releaseClause: number | null;
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  nationId: number;
  birthDay: DayNumber;
  heightCm: number;
  weightKg: number;
  foot: Foot;
  /** Weaker foot ability 1-20. */
  weakFoot: number;
  /** 1-20 values in `ATTRIBUTE_KEYS` order (index with `A.*`). */
  attributes: number[];
  /** 1-20 values in `HIDDEN_KEYS` order (index with `H.*`). */
  hidden: number[];
  /** Familiarity 1-20 per slot in `POSITIONS` order (20 = natural). */
  positions: number[];
  /** Index into POSITIONS of the best/natural position. */
  primaryPosition: number;
  /** Current Ability 1-200 (derived from attributes; cached). */
  ca: number;
  /** Potential Ability 1-200. */
  pa: number;
  traits: TraitId[];
  clubId: number | null;
  contract: Contract | null;
  /** Estimated market value. */
  value: number;
  /** Retired players stay in the world for history. */
  retired: boolean;
}
