import type { ImportConfig } from './config';
import { jaroWinkler, normalizeClubName, normalizeName } from './normalize';
import type { EaPlayer, TmClub, TmPlayer } from './sources/records';

export type PlayerMatchMethod =
  'approved' | 'full_name_dob' | 'name_dob' | 'name_tokens_dob' | 'surname_dob_nationality';

export interface PlayerPair {
  ea: EaPlayer;
  tm: TmPlayer;
  method: PlayerMatchMethod;
}

export interface PlayerMatching {
  pairs: PlayerPair[];
  /** Same date of birth and similar names: reported for manual review, never merged. */
  candidates: { ea: EaPlayer; tm: TmPlayer; score: number }[];
  ambiguous: { ea: EaPlayer; options: TmPlayer[]; level: PlayerMatchMethod }[];
  /** Matched pairs whose other identity fields disagree (kept, reported). */
  conflicts: { ea: EaPlayer; tm: TmPlayer; field: string; eaValue: string; tmValue: string }[];
  eaUnmatched: EaPlayer[];
  tmUnmatched: TmPlayer[];
  /** Ratings rows that could not be matched safely because they lack a date of birth. */
  eaWithoutDob: number;
}

const lastToken = (s: string) => s.split(' ').at(-1) ?? s;
/** True when every token of `short` appears in `long` in the same order (`long` may have extra names). */
function isTokenSubsequence(short: string[], long: string[]): boolean {
  let i = 0;
  for (const t of long) if (t === short[i]) i++;
  return i === short.length;
}
const pairKey = (ea: string, tm: string) => `${ea}|${tm}`;

/** Match ratings-source players to Transfermarkt-style players. Conservative by design. */
export function matchPlayers(ea: EaPlayer[], tm: TmPlayer[], config: ImportConfig): PlayerMatching {
  const rejected = new Set(config.identity.reject.map((r) => pairKey(r.ea, r.tm)));
  const tmById = new Map(tm.map((p) => [p.sourceId, p]));
  const eaById = new Map(ea.map((p) => [p.sourceId, p]));
  const usedTm = new Set<string>();
  const usedEa = new Set<string>();
  const result: PlayerMatching = {
    pairs: [],
    candidates: [],
    ambiguous: [],
    conflicts: [],
    eaUnmatched: [],
    tmUnmatched: [],
    eaWithoutDob: 0,
  };

  for (const a of config.identity.approve) {
    const e = eaById.get(a.ea);
    const t = tmById.get(a.tm);
    if (e && t && !usedEa.has(e.sourceId) && !usedTm.has(t.sourceId)) {
      result.pairs.push({ ea: e, tm: t, method: 'approved' });
      usedEa.add(e.sourceId);
      usedTm.add(t.sourceId);
    }
  }

  const tmByDob = new Map<number, TmPlayer[]>();
  for (const p of tm) {
    if (p.dob === null) continue;
    const list = tmByDob.get(p.dob) ?? [];
    list.push(p);
    tmByDob.set(p.dob, list);
  }
  const tmNames = new Map(
    tm.map((p) => [
      p.sourceId,
      {
        full: normalizeName(p.name),
        firstLast:
          p.firstName || p.lastName
            ? normalizeName(`${p.firstName ?? ''} ${p.lastName ?? ''}`)
            : null,
        nat: p.nationality ? normalizeName(p.nationality) : null,
      },
    ]),
  );

  type Test = (e: EaPlayer, t: TmPlayer) => boolean;
  const levels: [PlayerMatchMethod, Test][] = [
    [
      'full_name_dob',
      (e, t) => {
        if (!e.fullName) return false;
        const n = normalizeName(e.fullName);
        const tn = tmNames.get(t.sourceId)!;
        return n === tn.full || n === tn.firstLast;
      },
    ],
    [
      'name_dob',
      (e, t) => {
        const n = normalizeName(e.name);
        const tn = tmNames.get(t.sourceId)!;
        return n === tn.full || n === tn.firstLast;
      },
    ],
    [
      // "Kylian Mbappé" vs "Kylian Mbappé Lottin": same first name, every token of the shorter name
      // present in order in the longer one (extra middle/maternal surnames), same birth date.
      'name_tokens_dob',
      (e, t) => {
        if (!e.fullName) return false;
        const a = normalizeName(e.fullName).split(' ');
        const b = tmNames.get(t.sourceId)!.full.split(' ');
        const [short, long] = a.length <= b.length ? [a, b] : [b, a];
        return short.length >= 2 && short[0] === long[0] && isTokenSubsequence(short, long);
      },
    ],
    [
      'surname_dob_nationality',
      (e, t) => {
        const tn = tmNames.get(t.sourceId)!;
        if (!e.nationality || !tn.nat || normalizeName(e.nationality) !== tn.nat) return false;
        const eSurname = lastToken(normalizeName(e.fullName ?? e.name));
        return eSurname.length > 1 && eSurname === lastToken(tn.full);
      },
    ],
  ];

  for (const [method, test] of levels) {
    // Proposals at this level; accept only one-to-one proposals.
    const proposals = new Map<string, TmPlayer[]>();
    const claims = new Map<string, string[]>();
    for (const e of ea) {
      if (usedEa.has(e.sourceId) || e.dob === null) continue;
      const options = (tmByDob.get(e.dob) ?? []).filter(
        (t) =>
          !usedTm.has(t.sourceId) && !rejected.has(pairKey(e.sourceId, t.sourceId)) && test(e, t),
      );
      if (!options.length) continue;
      proposals.set(e.sourceId, options);
      for (const t of options)
        claims.set(t.sourceId, [...(claims.get(t.sourceId) ?? []), e.sourceId]);
    }
    for (const [eaId, options] of proposals) {
      const e = eaById.get(eaId)!;
      if (options.length === 1 && claims.get(options[0]!.sourceId)!.length === 1) {
        const t = options[0]!;
        result.pairs.push({ ea: e, tm: t, method });
        usedEa.add(eaId);
        usedTm.add(t.sourceId);
      } else {
        result.ambiguous.push({ ea: e, options, level: method });
        usedEa.add(eaId); // don't let a weaker level pick one of several equally good options
      }
    }
  }

  for (const e of ea) {
    if (e.dob === null && !result.pairs.some((p) => p.ea === e)) result.eaWithoutDob++;
  }
  const matchedEa = new Set(result.pairs.map((p) => p.ea.sourceId));
  const matchedTm = new Set(result.pairs.map((p) => p.tm.sourceId));
  const ambiguousEa = new Set(result.ambiguous.map((a) => a.ea.sourceId));
  result.eaUnmatched = ea.filter((e) => !matchedEa.has(e.sourceId));
  result.tmUnmatched = tm.filter((t) => !matchedTm.has(t.sourceId));

  // Fuzzy candidates for review: same DOB, similar (but not equal) names, not matched.
  for (const e of result.eaUnmatched) {
    if (e.dob === null || ambiguousEa.has(e.sourceId)) continue;
    const n = normalizeName(e.fullName ?? e.name);
    for (const t of tmByDob.get(e.dob) ?? []) {
      if (matchedTm.has(t.sourceId)) continue;
      const score = jaroWinkler(n, tmNames.get(t.sourceId)!.full);
      if (score >= 0.85)
        result.candidates.push({ ea: e, tm: t, score: Math.round(score * 1000) / 1000 });
    }
  }

  // Identity conflicts among accepted pairs.
  for (const { ea: e, tm: t } of result.pairs) {
    if (
      e.nationality &&
      t.nationality &&
      normalizeName(e.nationality) !== normalizeName(t.nationality)
    ) {
      result.conflicts.push({
        ea: e,
        tm: t,
        field: 'nationality',
        eaValue: e.nationality,
        tmValue: t.nationality,
      });
    }
    if (e.heightCm && t.heightCm && Math.abs(e.heightCm - t.heightCm) > 4) {
      result.conflicts.push({
        ea: e,
        tm: t,
        field: 'height',
        eaValue: String(e.heightCm),
        tmValue: String(t.heightCm),
      });
    }
  }
  return result;
}

// ------------------------------------------------------------------ clubs

export type ClubMatchMethod = 'player_overlap' | 'exact_name' | 'alias' | 'name_tokens';

export interface ClubMatching {
  /** Ratings-source club key → Transfermarkt-style club and how it was matched. */
  byEaClub: Map<string, { tm: TmClub; method: ClubMatchMethod; evidence: string }>;
  unmatched: string[];
}

/** Stable key for a ratings-source club. */
export const eaClubKey = (p: Pick<EaPlayer, 'clubSourceId' | 'clubName'>) =>
  p.clubSourceId
    ? `id:${p.clubSourceId}`
    : p.clubName
      ? `name:${normalizeClubName(p.clubName)}`
      : null;

/**
 * Match ratings-source clubs to Transfermarkt-style clubs: first by a unique exact normalised name
 * or alias, then by where matched players actually play now (≥ 3 players, at least twice as many as
 * at any other club, and ≥ 25% of the squad).
 */
export function matchClubs(
  eaPlayers: EaPlayer[],
  tmClubs: TmClub[],
  pairs: PlayerPair[],
  config: ImportConfig,
): ClubMatching {
  const tmById = new Map(tmClubs.map((c) => [c.sourceId, c]));
  const eaNames = new Map<string, string>();
  for (const p of eaPlayers) {
    const key = eaClubKey(p);
    if (key && p.clubName && !eaNames.has(key)) eaNames.set(key, p.clubName);
  }
  const tally = new Map<string, Map<string, number>>();
  for (const { ea, tm } of pairs) {
    const key = eaClubKey(ea);
    if (!key || !tm.clubSourceId || !tmById.has(tm.clubSourceId)) continue;
    const t = tally.get(key) ?? new Map<string, number>();
    t.set(tm.clubSourceId, (t.get(tm.clubSourceId) ?? 0) + 1);
    tally.set(key, t);
  }
  const tmByName = new Map<string, TmClub[]>();
  for (const c of tmClubs) {
    // The formal name and the URL slug ("inter-miami-cf") both count as the club's name.
    const names = new Set([normalizeClubName(c.name)]);
    if (c.code) names.add(normalizeClubName(c.code.replace(/-/g, ' ')));
    for (const n of names) tmByName.set(n, [...(tmByName.get(n) ?? []), c]);
  }
  const aliases = new Map(
    Object.entries(config.clubAliases).map(([k, v]) => [
      normalizeClubName(k),
      normalizeClubName(v),
    ]),
  );

  const squadSize = new Map<string, number>();
  for (const p of eaPlayers) {
    const key = eaClubKey(p);
    if (key) squadSize.set(key, (squadSize.get(key) ?? 0) + 1);
  }
  const byEaClub: ClubMatching['byEaClub'] = new Map();
  const claimedTm = new Set<string>();
  // Pass 1: a unique exact name (or configured alias) match.
  const nameTarget = (name: string) => {
    const n = normalizeClubName(name);
    const alias = aliases.get(n);
    return { alias, options: tmByName.get(alias ?? n) ?? [] };
  };
  const nameClaims = new Map<string, number>();
  for (const name of eaNames.values())
    for (const c of nameTarget(name).options)
      nameClaims.set(c.sourceId, (nameClaims.get(c.sourceId) ?? 0) + 1);
  for (const [key, name] of eaNames) {
    const { alias, options } = nameTarget(name);
    if (options.length === 1 && nameClaims.get(options[0]!.sourceId) === 1) {
      byEaClub.set(key, {
        tm: options[0]!,
        method: alias ? 'alias' : 'exact_name',
        evidence: name,
      });
      claimedTm.add(options[0]!.sourceId);
    }
  }
  // Pass 2: where matched players actually play. Needs enough of the squad to be matched, so a
  // few players who moved on between snapshots can't drag a whole club to their new club.
  for (const [key] of eaNames) {
    if (byEaClub.has(key)) continue;
    const t = tally.get(key);
    if (t) {
      const total = [...t.values()].reduce((a, b) => a + b, 0);
      const ranked = [...t.entries()].sort((a, b) => b[1] - a[1]);
      const [bestId, count] = ranked[0]!;
      const runnerUp = ranked[1]?.[1] ?? 0;
      const coverage = count / (squadSize.get(key) ?? count);
      // Snapshots can be seasons apart, so many players have moved on: ask for a clear plurality
      // (twice the next club) rather than a majority.
      if (count >= 3 && count >= 2 * runnerUp && coverage >= 0.25 && !claimedTm.has(bestId)) {
        byEaClub.set(key, {
          tm: tmById.get(bestId)!,
          method: 'player_overlap',
          evidence: `${count}/${total} matched players`,
        });
        claimedTm.add(bestId);
      }
    }
  }
  // Pass 3: every word of one name appears in the other's name or URL slug ("Benfica" ↔
  // "SL Benfica", "Inter Miami" ↔ inter-miami-cf), unique both ways, and at least one matched
  // player of the club plays there now (guards against same-named clubs in other countries).
  const words = (s: string) => new Set(normalizeClubName(s.replace(/-/g, ' ')).split(' '));
  const within = (a: Set<string>, b: Set<string>) => [...a].every((w) => b.has(w));
  const open = tmClubs
    .filter((c) => !claimedTm.has(c.sourceId))
    .map((c) => ({ c, names: [words(c.name), ...(c.code ? [words(c.code)] : [])] }));
  const proposals = new Map<string, TmClub[]>();
  const claims = new Map<string, number>();
  for (const [key, name] of eaNames) {
    if (byEaClub.has(key)) continue;
    const w = words(name);
    const options = open
      .filter(({ names }) => names.some((n) => within(w, n) || within(n, w)))
      .map((o) => o.c);
    if (!options.length) continue;
    proposals.set(key, options);
    for (const c of options) claims.set(c.sourceId, (claims.get(c.sourceId) ?? 0) + 1);
  }
  for (const [key, options] of proposals) {
    const c = options[0]!;
    if (
      options.length === 1 &&
      claims.get(c.sourceId) === 1 &&
      (tally.get(key)?.get(c.sourceId) ?? 0) >= 1
    ) {
      byEaClub.set(key, {
        tm: c,
        method: 'name_tokens',
        evidence: `${eaNames.get(key)} ↔ ${c.name}`,
      });
      claimedTm.add(c.sourceId);
    }
  }
  const unmatched = [...eaNames].filter(([key]) => !byEaClub.has(key)).map(([, name]) => name);
  return { byEaClub, unmatched };
}
