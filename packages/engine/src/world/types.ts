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

/**
 * Where a value came from. A real player can mix statuses: his name is source-backed while his
 * hidden attributes are derived. Never label a whole record verified because one field is.
 */
export type Provenance = 'source_backed' | 'derived' | 'simulated' | 'unverified' | 'unknown';

/** generated = created by the engine; imported = from a real-world data pack; custom = added in the editor. */
export type EntityOrigin = 'generated' | 'imported' | 'custom';

export interface NamePool {
  firstNames: string[];
  lastNames: string[];
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
  /** Names for newly generated players (regens) of this nationality; null = use the flavour. */
  namePool: NamePool | null;
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
  /** generated, imported (real league), or simulated (e.g. a national cup the data lacks). */
  origin: EntityOrigin | 'simulated';
}

export interface Stadium {
  id: number;
  name: string;
  city: string | null;
  capacity: number;
}

export interface Club {
  id: number;
  name: string;
  shortName: string;
  /** Three-letter code for compact displays. */
  code: string;
  nationId: number;
  /** null when the data pack doesn't know it. */
  city: string | null;
  founded: number | null;
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
  origin: EntityOrigin;
  /** Key of a user-supplied crest image (data-packs/assets/crests/<key>.png), if any. */
  crestKey: string | null;
  source: EntitySource<ClubField> | null;
}

export type ClubField =
  'name' | 'league' | 'stadium' | 'capacity' | 'colors' | 'reputation' | 'finances' | 'facilities';

export type PlayerField =
  | 'name'
  | 'birthDay'
  | 'nationality'
  | 'height'
  | 'weight'
  | 'foot'
  | 'positions'
  | 'traits'
  | 'club'
  | 'shirtNumber'
  | 'contractEnd'
  | 'contractStart'
  | 'wage'
  | 'releaseClause'
  | 'value'
  | 'ability';

export interface EntitySource<F extends string> {
  /** Stable source key, e.g. "ea:20801|tm:8198". */
  key: string;
  fields: Partial<Record<F, Provenance>>;
}

export interface PlayerSource extends EntitySource<PlayerField> {
  /** Source overall/potential ratings (0-99), kept for future remapping. */
  overall: number | null;
  potential: number | null;
  /** One character per attribute (ATTRIBUTE_KEYS order): S source, F coarse source, D derived. */
  attributeOrigin: string;
  /** One character per hidden attribute: S or D. */
  hiddenOrigin: string;
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
  origin: EntityOrigin;
  shirtNumber: number | null;
  source: PlayerSource | null;
}
