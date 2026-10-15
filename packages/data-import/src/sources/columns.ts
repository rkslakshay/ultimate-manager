/**
 * Column specifications for every supported source table. This is the ONLY place source
 * column names appear: adapters read rows through the resolved mapping, so supporting a new
 * dataset release with renamed columns means adding an alias here.
 *
 * Header matching ignores case and punctuation ("HeadingAccuracy" = "heading_accuracy").
 */

export interface ColumnSpec {
  aliases: readonly string[];
  required?: boolean;
}
export type TableSpec = Record<string, ColumnSpec>;

const col = (aliases: string[], required = false): ColumnSpec => ({ aliases, required });

/** EA FC / FIFA-style player ratings table (one row per player, 0-99 ratings). */
export const EA_PLAYERS = {
  sourceId: col(['player_id', 'sofifa_id', 'id'], true),
  shortName: col(['short_name', 'name', 'known_as']),
  longName: col(['long_name', 'full_name']),
  positions: col(['player_positions', 'positions', 'best_position'], true),
  overall: col(['overall', 'overall_rating'], true),
  potential: col(['potential'], true),
  valueEur: col(['value_eur']),
  wageEur: col(['wage_eur']),
  age: col(['age']),
  dob: col(['dob', 'date_of_birth', 'birth_date']),
  heightCm: col(['height_cm']),
  weightKg: col(['weight_kg']),
  clubId: col(['club_team_id', 'club_id', 'team_id']),
  clubName: col(['club_name', 'club']),
  leagueId: col(['league_id']),
  leagueName: col(['league_name', 'league']),
  leagueLevel: col(['league_level']),
  jersey: col(['club_jersey_number', 'jersey_number', 'shirt_number']),
  contractUntil: col([
    'club_contract_valid_until_year',
    'club_contract_valid_until',
    'contract_valid_until',
  ]),
  joined: col(['club_joined_date', 'club_joined', 'joined']),
  nationality: col(['nationality_name', 'nationality']),
  foot: col(['preferred_foot']),
  weakFoot: col(['weak_foot']),
  skillMoves: col(['skill_moves']),
  internationalReputation: col(['international_reputation']),
  workRate: col(['work_rate']),
  traits: col(['player_traits', 'traits']),
  tags: col(['player_tags']),
  releaseClause: col(['release_clause_eur']),
  version: col(['fifa_version', 'fc_version', 'version']),
  update: col(['fifa_update', 'update']),
  // Face stats (used only when detailed ratings are absent).
  pace: col(['pace', 'pac']),
  shooting: col(['shooting', 'sho']),
  passing: col(['passing', 'pas']),
  dribbling: col(['dribbling', 'dri']),
  defending: col(['defending', 'def']),
  physic: col(['physic', 'physical', 'phy']),
  // Detailed ratings.
  crossing: col(['attacking_crossing', 'crossing']),
  finishing: col(['attacking_finishing', 'finishing']),
  headingAccuracy: col(['attacking_heading_accuracy', 'heading_accuracy']),
  shortPassing: col(['attacking_short_passing', 'short_passing']),
  volleys: col(['attacking_volleys', 'volleys']),
  skillDribbling: col(['skill_dribbling']),
  curve: col(['skill_curve', 'curve']),
  fkAccuracy: col(['skill_fk_accuracy', 'fk_accuracy', 'free_kick_accuracy']),
  longPassing: col(['skill_long_passing', 'long_passing']),
  ballControl: col(['skill_ball_control', 'ball_control']),
  acceleration: col(['movement_acceleration', 'acceleration']),
  sprintSpeed: col(['movement_sprint_speed', 'sprint_speed']),
  agility: col(['movement_agility', 'agility']),
  reactions: col(['movement_reactions', 'reactions']),
  balance: col(['movement_balance', 'balance']),
  shotPower: col(['power_shot_power', 'shot_power']),
  jumping: col(['power_jumping', 'jumping']),
  stamina: col(['power_stamina', 'stamina']),
  strength: col(['power_strength', 'strength']),
  longShots: col(['power_long_shots', 'long_shots']),
  aggression: col(['mentality_aggression', 'aggression']),
  interceptions: col(['mentality_interceptions', 'interceptions']),
  positioning: col(['mentality_positioning', 'positioning', 'att_position']),
  vision: col(['mentality_vision', 'vision']),
  penalties: col(['mentality_penalties', 'penalties']),
  composure: col(['mentality_composure', 'composure']),
  markingAwareness: col([
    'defending_marking_awareness',
    'defending_marking',
    'marking',
    'defensive_awareness',
  ]),
  standingTackle: col(['defending_standing_tackle', 'standing_tackle']),
  slidingTackle: col(['defending_sliding_tackle', 'sliding_tackle']),
  gkDiving: col(['goalkeeping_diving', 'gk_diving']),
  gkHandling: col(['goalkeeping_handling', 'gk_handling']),
  gkKicking: col(['goalkeeping_kicking', 'gk_kicking']),
  gkPositioning: col(['goalkeeping_positioning', 'gk_positioning']),
  gkReflexes: col(['goalkeeping_reflexes', 'gk_reflexes']),
  gkSpeed: col(['goalkeeping_speed', 'gk_speed']),
} satisfies TableSpec;

/** Transfermarkt-style players table. */
export const TM_PLAYERS = {
  sourceId: col(['player_id'], true),
  name: col(['name', 'player_name'], true),
  firstName: col(['first_name']),
  lastName: col(['last_name']),
  dob: col(['date_of_birth', 'dob']),
  nationality: col(['country_of_citizenship', 'citizenship', 'nationality']),
  position: col(['position']),
  subPosition: col(['sub_position']),
  foot: col(['foot']),
  heightCm: col(['height_in_cm', 'height']),
  contractEnd: col(['contract_expiration_date', 'contract_expires']),
  marketValueEur: col(['market_value_in_eur', 'market_value']),
  clubId: col(['current_club_id']),
  clubName: col(['current_club_name']),
  competitionId: col(['current_club_domestic_competition_id']),
  lastSeason: col(['last_season']),
} satisfies TableSpec;

export const TM_CLUBS = {
  sourceId: col(['club_id'], true),
  name: col(['name', 'club_name'], true),
  code: col(['club_code']),
  competitionId: col(['domestic_competition_id']),
  stadiumName: col(['stadium_name']),
  stadiumSeats: col(['stadium_seats', 'stadium_capacity']),
  squadSize: col(['squad_size']),
  lastSeason: col(['last_season']),
} satisfies TableSpec;

export const TM_COMPETITIONS = {
  sourceId: col(['competition_id'], true),
  name: col(['name', 'competition_name'], true),
  country: col(['country_name', 'country']),
  type: col(['type']),
  subType: col(['sub_type']),
} satisfies TableSpec;

export const TM_TRANSFERS = {
  playerId: col(['player_id'], true),
  date: col(['transfer_date', 'date'], true),
  season: col(['transfer_season', 'season']),
  fromClubId: col(['from_club_id']),
  toClubId: col(['to_club_id']),
  fromClubName: col(['from_club_name']),
  toClubName: col(['to_club_name']),
  fee: col(['transfer_fee', 'fee']),
  marketValueEur: col(['market_value_in_eur']),
  type: col(['transfer_type', 'type']),
} satisfies TableSpec;

export const TM_VALUATIONS = {
  playerId: col(['player_id'], true),
  date: col(['date', 'datetime'], true),
  valueEur: col(['market_value_in_eur', 'market_value', 'value'], true),
  clubId: col(['current_club_id']),
} satisfies TableSpec;

export const TABLES = {
  eaPlayers: EA_PLAYERS,
  tmPlayers: TM_PLAYERS,
  tmClubs: TM_CLUBS,
  tmCompetitions: TM_COMPETITIONS,
  tmTransfers: TM_TRANSFERS,
  tmValuations: TM_VALUATIONS,
} as const;
export type TableKind = keyof typeof TABLES;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ResolvedColumns<S extends TableSpec> {
  /** Spec key → actual header (null when the dataset lacks it). */
  map: { [K in keyof S]: string | null };
  missingRequired: string[];
  missingOptional: string[];
  /** Headers in the file that no spec key uses. */
  unused: string[];
}

export function resolveColumns<S extends TableSpec>(
  header: readonly string[],
  spec: S,
): ResolvedColumns<S> {
  const bySquash = new Map(header.map((h) => [squash(h), h]));
  const used = new Set<string>();
  const map = {} as { [K in keyof S]: string | null };
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  for (const key of Object.keys(spec) as (keyof S & string)[]) {
    const found = spec[key]!.aliases.map((a) => bySquash.get(squash(a))).find(
      (h) => h !== undefined && !used.has(h),
    );
    map[key] = found ?? null;
    if (found) used.add(found);
    else (spec[key]!.required ? missingRequired : missingOptional).push(key);
  }
  return { map, missingRequired, missingOptional, unused: header.filter((h) => !used.has(h)) };
}

/**
 * Transfermarkt-style tables are recognised by FILE NAME (players.csv, clubs.csv,
 * competitions.csv, transfers.csv, player_valuations.csv), because other tables in the same
 * dataset (appearances, game_lineups, game_events…) share id/name columns and would otherwise be
 * mistaken for them. The ratings table is recognised by its distinctive header
 * (overall + potential + positions), whatever the file is called.
 */
const TM_FILE_NAMES: [RegExp, TableKind][] = [
  [/^players.csv$/, 'tmPlayers'],
  [/^clubs.csv$/, 'tmClubs'],
  [/^competitions.csv$/, 'tmCompetitions'],
  [/^transfers.csv$/, 'tmTransfers'],
  [/^(player_)?valuations.csv$/, 'tmValuations'],
];

/** Women's football tables are kept out of the (men's) world rather than mixed into it. */
export const isWomensTable = (fileName: string) =>
  /(^|[^a-z])(female|women|womens)([^a-z]|$)/i.test(fileName);

/** Which supported table a CSV is, or null. */
export function detectTable(fileName: string, header: readonly string[]): TableKind | null {
  const base = fileName.toLowerCase();
  if (resolveColumns(header, EA_PLAYERS).missingRequired.length === 0) {
    return isWomensTable(base) ? null : 'eaPlayers';
  }
  for (const [re, kind] of TM_FILE_NAMES) {
    if (re.test(base) && resolveColumns(header, TABLES[kind]).missingRequired.length === 0)
      return kind;
  }
  return null;
}
