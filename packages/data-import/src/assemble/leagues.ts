import { normalizeName } from '../normalize';
import { eaClubKey } from '../matching';
import type { BuildContext, EaWithClub, PlannedLeague } from './context';

const majority = <T>(counts: Map<T, number>): T | null => {
  let best: T | null = null;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
};
const bump = <T>(m: Map<T, number>, k: T) => m.set(k, (m.get(k) ?? 0) + 1);

interface LeagueAcc {
  name: string;
  levels: Map<number, number>;
  clubs: Set<string>;
  nationalities: Map<string, number>;
  tmCountries: Map<string, number>;
}

/**
 * Decide which leagues the pack contains and assign each player to a club key.
 * Returns the planned leagues and the players that belong to them; everyone else is dropped
 * with a counted reason.
 */
export function planLeagues(ctx: BuildContext): {
  leagues: PlannedLeague[];
  players: EaWithClub[];
} {
  const { log, config } = ctx;
  const acc = new Map<string, LeagueAcc>();
  const playerLeague = new Map<string, string>();

  for (const p of ctx.data.ea) {
    const clubKey = eaClubKey(p);
    if (!clubKey) {
      log.count('drop.player_without_club');
      continue;
    }
    let leagueKey: string | null = null;
    let leagueName: string | null = null;
    if (p.leagueSourceId || p.leagueName) {
      leagueKey = p.leagueSourceId
        ? `id:${p.leagueSourceId}`
        : `name:${normalizeName(p.leagueName!)}`;
      leagueName = p.leagueName ?? `League ${p.leagueSourceId}`;
    } else {
      // Fall back to the matched Transfermarkt-style club's competition.
      const tmClub = ctx.clubs.byEaClub.get(clubKey)?.tm;
      const comp = tmClub?.competitionId
        ? ctx.tmCompetitionById.get(tmClub.competitionId)
        : undefined;
      if (comp) {
        leagueKey = `tm:${comp.sourceId}`;
        leagueName = comp.name;
      }
    }
    if (!leagueKey || !leagueName) {
      log.count('drop.player_without_league');
      continue;
    }
    const a = acc.get(leagueKey) ?? {
      name: leagueName,
      levels: new Map(),
      clubs: new Set(),
      nationalities: new Map(),
      tmCountries: new Map(),
    };
    if (p.leagueLevel !== null) bump(a.levels, p.leagueLevel);
    a.clubs.add(clubKey);
    if (p.nationality) bump(a.nationalities, p.nationality);
    const tmClub = ctx.clubs.byEaClub.get(clubKey)?.tm;
    const country = tmClub?.competitionId
      ? ctx.tmCompetitionById.get(tmClub.competitionId)?.country
      : null;
    if (country) bump(a.tmCountries, country);
    acc.set(leagueKey, a);
    playerLeague.set(p.sourceId, leagueKey);
  }

  const leagues: PlannedLeague[] = [];
  const included = new Set<string>();
  for (const [key, a] of [...acc.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    const rule = config.leagues[a.name] ?? {};
    if (rule.exclude || (config.includeLeagues && !config.includeLeagues.includes(a.name))) {
      log.info('league.excluded_by_config', `${a.name}: excluded by config`);
      continue;
    }
    if (a.clubs.size < config.minClubsPerLeague) {
      log.info(
        'league.too_small',
        `${a.name}: only ${a.clubs.size} clubs in the data (min ${config.minClubsPerLeague})`,
      );
      continue;
    }
    const sourceTier = majority(a.levels);
    const tier = rule.tier ?? sourceTier ?? 1;
    if (rule.tier === undefined && sourceTier === null) {
      log.warn(
        'league.tier_defaulted',
        `${a.name}: no tier in the data; assumed tier 1 (set leagues["${a.name}"].tier in config)`,
      );
    }
    let nationName = rule.nation ?? majority(a.tmCountries);
    let nationSource: PlannedLeague['nationSource'] = rule.nation ? 'config' : 'source';
    if (!nationName) {
      nationName = majority(a.nationalities) ?? 'Unknown';
      nationSource = 'derived_from_player_nationalities';
      log.warn(
        'league.nation_derived',
        `${a.name}: country not in the data; using the most common player nationality (${nationName}). Set leagues["${a.name}"].nation to fix.`,
      );
    }
    leagues.push({
      key,
      name: a.name,
      tier,
      nationName,
      nationSource,
      tierSource: rule.tier !== undefined ? 'config' : sourceTier !== null ? 'source' : 'default',
      clubKeys: [...a.clubs].sort(),
      rule: { promotionPlaces: rule.promotionPlaces, relegationPlaces: rule.relegationPlaces },
    });
    included.add(key);
  }

  const players: EaWithClub[] = [];
  for (const p of ctx.data.ea) {
    const lk = playerLeague.get(p.sourceId);
    if (!lk) continue;
    if (!included.has(lk)) {
      log.count('drop.player_league_not_included');
      continue;
    }
    players.push({ ...p, clubKey: eaClubKey(p)! });
  }
  return { leagues, players };
}

/**
 * Promotion/relegation between consecutive tiers of one nation. Config wins; otherwise a
 * labelled simulation default: min(3, floor(smaller league size / 6)).
 */
export function promotionRules(leagues: PlannedLeague[], sizeOf: (l: PlannedLeague) => number) {
  const out = new Map<string, { promotion: number; relegation: number; defaulted: boolean }>();
  const byNation = new Map<string, PlannedLeague[]>();
  for (const l of leagues) byNation.set(l.nationName, [...(byNation.get(l.nationName) ?? []), l]);
  for (const list of byNation.values()) {
    const sorted = [...list].sort((a, b) => a.tier - b.tier);
    for (const l of sorted) out.set(l.key, { promotion: 0, relegation: 0, defaulted: false });
    for (let i = 0; i + 1 < sorted.length; i++) {
      const upper = sorted[i]!;
      const lower = sorted[i + 1]!;
      if (lower.tier !== upper.tier + 1) continue;
      const fallback = Math.min(3, Math.floor(Math.min(sizeOf(upper), sizeOf(lower)) / 6));
      const relegation = upper.rule.relegationPlaces ?? lower.rule.promotionPlaces ?? fallback;
      const u = out.get(upper.key)!;
      const d = out.get(lower.key)!;
      u.relegation = relegation;
      d.promotion = lower.rule.promotionPlaces ?? relegation;
      const defaulted =
        upper.rule.relegationPlaces === undefined && lower.rule.promotionPlaces === undefined;
      u.defaulted ||= defaulted;
      d.defaulted ||= defaulted;
    }
  }
  return out;
}
