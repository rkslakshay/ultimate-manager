import type { DayNumber } from '@um/engine';
import type { ImportConfig } from '../config';
import type { IdentityMap } from '../identity';
import type { ImportLog } from '../log';
import type { ClubMatching, PlayerMatching } from '../matching';
import type { EaPlayer, SourceData, TmClub, TmCompetition, TmPlayer } from '../sources/records';

export interface BuildContext {
  config: ImportConfig;
  log: ImportLog;
  ids: IdentityMap;
  startDay: DayNumber;
  data: SourceData;
  players: PlayerMatching;
  clubs: ClubMatching;
  /** Ratings player id → matched Transfermarkt-style player. */
  tmByEa: Map<string, TmPlayer>;
  tmClubById: Map<string, TmClub>;
  tmCompetitionById: Map<string, TmCompetition>;
  /** Transfermarkt club id → ratings club key (reverse of club matching). */
  eaClubKeyByTm: Map<string, string>;
}

/** A league chosen for the pack, before ids for clubs/players are final. */
export interface PlannedLeague {
  key: string;
  name: string;
  tier: number;
  nationName: string;
  /** How the league's nation was determined. */
  nationSource: 'config' | 'source' | 'derived_from_player_nationalities';
  tierSource: 'config' | 'source' | 'default';
  clubKeys: string[];
  rule: { promotionPlaces?: number; relegationPlaces?: number };
}

export type EaWithClub = EaPlayer & { clubKey: string };
