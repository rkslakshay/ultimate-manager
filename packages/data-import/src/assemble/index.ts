import {
  ageOn,
  civilFromDay,
  clamp,
  clubCode,
  createRng,
  expectedWage,
  fitValueModel,
  hashString,
  marketValue,
  modelValue,
  roundClamp,
  roundMoney,
  toIsoDate,
  WORLD_SCHEMA_VERSION,
  type Club,
  type ClubField,
  type Competition,
  type Nation,
  type Player,
  type Provenance,
  type Stadium,
  type ValueFit,
  type WorldState,
} from '@um/engine';
import { calibrateOffset, type CalibrationResult } from '../mapping/ability';
import { mapAttributes, SOURCE_HIGH, SOURCE_LOW } from '../mapping/attributes';
import { mapEaPositions } from '../mapping/positions';
import { normalizeName } from '../normalize';
import type {
  FeeStatus,
  HistoricalTransfer,
  HistoricalValuation,
  PackSummary,
} from '../pack-format';
import type { TmPlayer } from '../sources/records';
import type { BuildContext, EaWithClub, PlannedLeague } from './context';
import { fillSquads, generateFreeAgents } from './fill';
import { planLeagues, promotionRules } from './leagues';
import { buildPlayer, type BuiltPlayer } from './players';

const PALETTE: [string, string][] = [
  ['#c8102e', '#ffffff'],
  ['#1d428a', '#ffffff'],
  ['#006a4e', '#ffffff'],
  ['#fdb913', '#1b1b1b'],
  ['#5b2c83', '#f2c300'],
  ['#000000', '#ffffff'],
  ['#ffffff', '#1d428a'],
  ['#e35205', '#1b1b1b'],
  ['#7a1f3d', '#7ec8e3'],
  ['#0f7fbf', '#f5d000'],
  ['#2e7d32', '#fdd835'],
  ['#b71c1c', '#1a237e'],
];

export interface BuildResult {
  world: WorldState;
  transfers: HistoricalTransfer[];
  valuations: HistoricalValuation[];
  calibration: CalibrationResult;
  valueFit: ValueFit | null;
  summary: PackSummary;
}

/** Reputation 1-99 from squad market value (EUR): ~€500M → 88, €40M → 61, €2M → 30. Derived. */
export const reputationFromSquadValue = (value: number) =>
  roundClamp(30 + 24.1 * (Math.log10(Math.max(value, 1)) - 6.3), 5, 99);

const slug = (s: string) => normalizeName(s).replace(/\s+/g, '-');

function uniqueCode(name: string, used: Set<string>): string {
  const letters = normalizeName(name)
    .replace(/[^a-z]/g, '')
    .toUpperCase();
  const candidates = [
    letters.slice(0, 3),
    letters[0]! + letters.slice(2, 4),
    letters.slice(0, 2) + letters.at(-1),
  ];
  for (const c of candidates) if (c.length === 3 && !used.has(c)) return (used.add(c), c);
  for (let i = 0; ; i++) {
    const c = `${letters.slice(0, 2)}${i}`;
    if (!used.has(c)) return (used.add(c), c);
  }
}

export function buildRealWorld(ctx: BuildContext): BuildResult {
  const { log, ids, startDay, config } = ctx;
  const plan = planLeagues(ctx);
  const includedClubKeys = new Set(plan.leagues.flatMap((l) => l.clubKeys));
  const leagueOfClub = new Map<string, PlannedLeague>();
  for (const l of plan.leagues) for (const k of l.clubKeys) leagueOfClub.set(k, l);

  // --- calibration of the attribute scale against the source overall
  const sorted = [...plan.players].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const step = Math.max(1, Math.floor(sorted.length / 2000));
  const calibration = calibrateOffset(
    sorted
      .filter((_, i) => i % step === 0)
      .map((p) => {
        const primary = mapEaPositions(p.positions).primary;
        return {
          overall: p.overall,
          primaryPosition: primary,
          attributesFor: (offset: number) =>
            mapAttributes({
              ratings: p.ratings,
              primaryPosition: primary,
              age: p.age,
              heightCm: p.heightCm,
              skillMoves: p.skillMoves,
              workRate: p.workRate,
              internationalReputation: p.internationalReputation,
              rng: createRng(`attributes:${p.sourceId}`),
              offset,
            }).attributes,
        };
      }),
  );

  // --- nations (ids now; objects once players are known)
  const nationIds = new Map<string, number>();
  const nationId = (name: string) => {
    const key = normalizeName(name);
    let id = nationIds.get(key);
    if (id === undefined) {
      id = ids.id('nations', [`nation:${key}`]);
      nationIds.set(key, id);
    }
    return id;
  };
  const nationNames = new Map<number, string>();
  const nameOf = (name: string) => {
    const id = nationId(name);
    if (!nationNames.has(id)) nationNames.set(id, name);
    return id;
  };

  // --- players
  // A Transfermarkt-style current club is only trusted when the player appeared in the source in
  // the career-start season (retired/inactive players keep a stale club).
  const startSeason = civilFromDay(startDay).year - (civilFromDay(startDay).month >= 7 ? 0 : 1);
  const clubKeyFor = (p: EaWithClub, tm: TmPlayer | null): string | null => {
    const current = tm?.clubSourceId && tm.lastSeason !== null && tm.lastSeason >= startSeason;
    if (tm?.clubSourceId && !current) log.count('tm.club_stale_ignored');
    const tmKey = current ? ctx.eaClubKeyByTm.get(tm.clubSourceId!) : undefined;
    if (tmKey && tmKey !== p.clubKey) log.count('conflict.current_club');
    const oldClub = ctx.clubs.byEaClub.get(p.clubKey)?.tm;
    const oldClubKnown = oldClub !== undefined;
    if (
      config.primaryClubSource === 'tm' &&
      tm &&
      !current &&
      (oldClub?.lastSeason ?? -1) >= startSeason
    ) {
      // The source tracked his old club's squad this season and he wasn't in it: he has left
      // (retired, or moved somewhere the source doesn't cover).
      log.count('tm.left_tracked_club');
      return null;
    }
    if (config.primaryClubSource === 'tm' && current && !tmKey && oldClubKnown) {
      // His club is identified in both sources, but he now plays (this season) for a club that
      // isn't in the pack: he has left the pack's clubs.
      log.count('tm.moved_to_club_outside_pack');
      return null;
    }
    const key = config.primaryClubSource === 'tm' && tmKey ? tmKey : p.clubKey;
    return includedClubKeys.has(key) ? key : null;
  };
  const built: BuiltPlayer[] = [];
  for (const p of sorted) {
    const b = buildPlayer(p, { ctx, offset: calibration.offset, nationId: nameOf, clubKeyFor });
    if (b) built.push(b);
  }
  for (const l of plan.leagues) nameOf(l.nationName);

  // --- competitions and clubs
  const competitionIdByLeague = new Map(
    plan.leagues.map((l) => [l.key, ids.id('competitions', [`league:${l.key}`])]),
  );
  // Named after the club's own ratings-source players (not whoever was moved there).
  const clubName = new Map<string, string>();
  for (const p of sorted)
    if (!clubName.has(p.clubKey) && p.clubName) clubName.set(p.clubKey, p.clubName);
  for (const p of plan.players)
    if (!clubName.has(p.clubKey) && p.clubName) clubName.set(p.clubKey, p.clubName);

  const clubs: Club[] = [];
  const stadiums: Stadium[] = [];
  const clubIdByKey = new Map<string, number>();
  const codes = new Set<string>();
  for (const key of [...includedClubKeys].sort()) {
    const tmClub = ctx.clubs.byEaClub.get(key)?.tm ?? null;
    const name = clubName.get(key) ?? tmClub?.name ?? key;
    const id = ids.id('clubs', [`club:${key}`, ...(tmClub ? [`tm-club:${tmClub.sourceId}`] : [])]);
    clubIdByKey.set(key, id);
    const league = leagueOfClub.get(key)!;
    const [primaryColor, secondaryColor] = PALETTE[hashString(key)[0] % PALETTE.length]!;
    const fields: Partial<Record<ClubField, Provenance>> = {
      name: 'source_backed',
      league: 'source_backed',
      stadium: tmClub?.stadiumName ? 'source_backed' : 'derived',
      capacity: tmClub?.stadiumSeats ? 'source_backed' : 'derived',
      colors: 'derived',
      reputation: 'derived',
      finances: 'derived',
      facilities: 'derived',
    };
    stadiums.push({
      id,
      name: tmClub?.stadiumName ?? `${name} Stadium`,
      city: null,
      capacity: tmClub?.stadiumSeats ?? 0,
    });
    const short = name
      .replace(/^(FC|AFC|CF|SC|AC|AS|SSC|SV|VfB|VfL|TSG|RC|OGC|1\.\s*FC)\s+/i, '')
      .replace(/\s+(FC|CF|AFC|SC)$/i, '');
    clubs.push({
      id,
      name,
      shortName: short,
      code: codes.has(clubCode(short))
        ? uniqueCode(short, codes)
        : (codes.add(clubCode(short)), clubCode(short)),
      nationId: nameOf(league.nationName),
      city: null,
      founded: null,
      primaryColor,
      secondaryColor,
      reputation: 50,
      stadiumId: id,
      leagueId: competitionIdByLeague.get(league.key)!,
      balance: 0,
      transferBudget: 0,
      wageBudget: 0,
      trainingFacilities: 10,
      youthFacilities: 10,
      origin: 'imported',
      crestKey: slug(name),
      source: { key: `club:${key}${tmClub ? `|tm-club:${tmClub.sourceId}` : ''}`, fields },
    });
  }
  for (const b of built) b.player.clubId = clubIdByKey.get(b.clubKey)!;
  const imported = built.map((b) => b.player);

  // --- nations
  const nations: Nation[] = [];
  const nationCodes = new Set<string>();
  const playableNations = new Set(plan.leagues.map((l) => nationId(l.nationName)));
  for (const [id, name] of [...nationNames.entries()].sort((a, b) => a[0] - b[0])) {
    const own = imported.filter((p) => p.nationId === id);
    const firsts = [
      ...new Set(own.map((p) => p.firstName).filter((f) => f.length > 2 && !f.endsWith('.'))),
    ].sort();
    const lasts = [...new Set(own.map((p) => p.lastName).filter((l) => l.length > 1))].sort();
    const top = own
      .map((p) => p.ca)
      .sort((a, b) => b - a)
      .slice(0, 23);
    const meanTop = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 60;
    nations.push({
      id,
      name,
      adjective: name,
      code: uniqueCode(name, nationCodes),
      flavour: 'anglo',
      reputation: roundClamp((meanTop - 40) / 1.3, 1, 99),
      playable: playableNations.has(id),
      namePool:
        firsts.length >= 5 && lasts.length >= 5 ? { firstNames: firsts, lastNames: lasts } : null,
    });
  }
  const nationById = new Map(nations.map((n) => [n.id, n]));

  // --- derived club reputation (from squad value, else squad ability)
  for (const club of clubs) {
    const squad = imported.filter((p) => p.clubId === club.id);
    const valued = built.filter((b) => b.player.clubId === club.id && !b.needsValue);
    const squadValue =
      valued.reduce((a, b) => a + b.player.value, 0) * (squad.length / Math.max(1, valued.length));
    const avgCa = squad.length ? squad.reduce((a, p) => a + p.ca, 0) / squad.length : 80;
    club.reputation =
      valued.length >= 5
        ? reputationFromSquadValue(squadValue)
        : roundClamp((avgCa - 40) / 1.3, 5, 99);
  }
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  // --- simulated wages where the source has none
  for (const b of built) {
    if (!b.needsWage) continue;
    const club = clubById.get(b.player.clubId!)!;
    b.player.contract!.wage = expectedWage(
      b.player.ca,
      ageOn(b.player.birthDay, startDay),
      club.reputation,
    );
  }

  // --- value model fitted on source-backed values; fills missing ones
  const yearsLeft = (p: Player) => ((p.contract?.endDay ?? startDay) - startDay) / 365;
  const valueFit = fitValueModel(
    built
      .filter((b) => !b.needsValue)
      .map((b) => ({
        ca: b.player.ca,
        pa: b.player.pa,
        age: ageOn(b.player.birthDay, startDay),
        contractYearsLeft: yearsLeft(b.player),
        clubReputation: clubById.get(b.player.clubId!)!.reputation,
        value: b.player.value,
      })),
  );
  for (const b of built) {
    if (!b.needsValue) continue;
    const f = {
      ca: b.player.ca,
      pa: b.player.pa,
      age: ageOn(b.player.birthDay, startDay),
      contractYearsLeft: yearsLeft(b.player),
      clubReputation: clubById.get(b.player.clubId!)!.reputation,
    };
    b.player.value = valueFit
      ? modelValue(valueFit.model, f)
      : marketValue({ ...f, reputation: f.clubReputation });
  }

  // --- generated squad fillers and free agents
  let nextPlayer = ids.maxId('players');
  const nextId = () => ++nextPlayer;
  const fillers = fillSquads(
    clubs,
    imported,
    nationById,
    startDay,
    config.minSquadSize,
    nextId,
    log,
  );
  const freeAgents = generateFreeAgents(
    config.generatedFreeAgents,
    imported,
    nations,
    startDay,
    nextId,
  );
  const players = [...imported, ...fillers, ...freeAgents].sort((a, b) => a.id - b.id);

  // --- finances, facilities and squad status (all derived)
  for (const club of clubs) {
    const squad = players.filter((p) => p.clubId === club.id);
    const squadValue = squad.reduce((a, p) => a + p.value, 0);
    const wageBill = squad.reduce((a, p) => a + (p.contract?.wage ?? 0), 0);
    club.balance = roundMoney(squadValue * 0.12 + 1_000_000);
    club.transferBudget = roundMoney(club.balance * 0.4);
    club.wageBudget = roundMoney(wageBill * 1.08);
    club.trainingFacilities = roundClamp(club.reputation / 5.5 + 2, 1, 20);
    club.youthFacilities = roundClamp(club.reputation / 6 + 3, 1, 20);
    const stadium = stadiums.find((s) => s.id === club.stadiumId)!;
    if (!stadium.capacity)
      stadium.capacity = roundMoney(clamp(3000 + club.reputation ** 2 * 7, 1500, 90000));
    const ranked = [...squad].sort((a, b) => b.ca - a.ca);
    ranked.forEach((p, i) => {
      if (!p.contract) return;
      const age = ageOn(p.birthDay, startDay);
      p.contract.squadStatus =
        i < 2
          ? 'key'
          : i < 11
            ? 'firstTeam'
            : age <= 20
              ? 'prospect'
              : i < 17
                ? 'rotation'
                : 'backup';
    });
  }

  // --- competitions
  const sizeOf = (l: PlannedLeague) =>
    clubs.filter((c) => c.leagueId === competitionIdByLeague.get(l.key)).length;
  const rules = promotionRules(plan.leagues, sizeOf);
  for (const [key, r] of rules)
    if (r.defaulted && (r.promotion || r.relegation))
      log.info(
        'league.promotion_defaulted',
        `${plan.leagues.find((l) => l.key === key)!.name}: promotion/relegation counts are a simulation default`,
      );
  const competitions: Competition[] = plan.leagues.map((l) => {
    const id = competitionIdByLeague.get(l.key)!;
    const members = clubs.filter((c) => c.leagueId === id);
    const strength = members.reduce((a, c) => a + c.reputation, 0) / Math.max(1, members.length);
    return {
      id,
      nationId: nationId(l.nationName),
      name: l.name,
      shortName: l.name.length > 22 ? l.name.slice(0, 20) + '…' : l.name,
      kind: 'league',
      tier: l.tier,
      reputation: roundClamp(strength, 1, 100),
      clubIds: members.map((c) => c.id).sort((a, b) => a - b),
      promotionPlaces: rules.get(l.key)!.promotion,
      relegationPlaces: rules.get(l.key)!.relegation,
      origin: 'imported',
    };
  });
  for (const nid of [...playableNations].sort((a, b) => a - b)) {
    const members = clubs
      .filter((c) => c.nationId === nid)
      .map((c) => c.id)
      .sort((a, b) => a - b);
    competitions.push({
      id: ids.id('competitions', [`cup:nation:${nid}`]),
      nationId: nid,
      name: `${nationById.get(nid)!.name} Cup`,
      shortName: `${nationById.get(nid)!.code} Cup`,
      kind: 'cup',
      tier: null,
      reputation: 50,
      clubIds: members,
      promotionPlaces: 0,
      relegationPlaces: 0,
      origin: 'simulated',
    });
  }
  competitions.sort((a, b) => a.id - b.id);

  // --- history (Transfermarkt-style data for included, matched players)
  const canonicalByTm = new Map(
    built.filter((b) => b.tm).map((b) => [b.tm!.sourceId, b.player.id]),
  );
  const clubByTm = (tmId: string | null) => {
    const key = tmId ? ctx.eaClubKeyByTm.get(tmId) : undefined;
    return key ? (clubIdByKey.get(key) ?? null) : null;
  };
  const transfers: HistoricalTransfer[] = ctx.data.tm.transfers
    .filter((t) => canonicalByTm.has(t.playerId))
    .map((t) => ({
      playerId: canonicalByTm.get(t.playerId)!,
      date: toIsoDate(t.date),
      season: t.season,
      fromClubId: clubByTm(t.fromClubId),
      toClubId: clubByTm(t.toClubId),
      fromClubName:
        t.fromClubName ?? (t.fromClubId ? (ctx.tmClubById.get(t.fromClubId)?.name ?? null) : null),
      toClubName:
        t.toClubName ?? (t.toClubId ? (ctx.tmClubById.get(t.toClubId)?.name ?? null) : null),
      feeEur: t.feeEur,
      feeStatus: (t.feeEur === null
        ? 'unknown'
        : t.feeEur > 0
          ? 'paid'
          : 'zero_reported') as FeeStatus,
      marketValueEur: t.marketValueEur,
      type: t.type,
      source: 'tm',
    }))
    .sort((a, b) => a.playerId - b.playerId || a.date.localeCompare(b.date));
  const valuations: HistoricalValuation[] = ctx.data.tm.valuations
    .filter((v) => canonicalByTm.has(v.playerId))
    .map((v) => ({
      playerId: canonicalByTm.get(v.playerId)!,
      date: toIsoDate(v.date),
      valueEur: v.valueEur,
      source: 'tm',
    }))
    .sort((a, b) => a.playerId - b.playerId || a.date.localeCompare(b.date));

  const world: WorldState = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    seed: 'real',
    startDay,
    nations,
    competitions,
    clubs: clubs.sort((a, b) => a.id - b.id),
    stadiums: stadiums.sort((a, b) => a.id - b.id),
    players,
  };
  const summary: PackSummary = {
    nations: nations.length,
    leagues: plan.leagues.map((l) => {
      const id = competitionIdByLeague.get(l.key)!;
      const clubIds = new Set(clubs.filter((c) => c.leagueId === id).map((c) => c.id));
      const inLeague = players.filter((p) => p.clubId !== null && clubIds.has(p.clubId));
      return {
        id,
        name: l.name,
        nation: l.nationName,
        tier: l.tier,
        clubs: clubIds.size,
        importedPlayers: inLeague.filter((p) => p.origin === 'imported').length,
        generatedPlayers: inLeague.filter((p) => p.origin === 'generated').length,
      };
    }),
    clubs: clubs.length,
    players: {
      total: players.length,
      imported: imported.length,
      generated: fillers.length + freeAgents.length,
    },
    transfers: transfers.length,
    valuations: valuations.length,
  };
  return { world, transfers, valuations, calibration: { ...calibration }, valueFit, summary };
}

export const SCALE = { sourceLow: SOURCE_LOW, sourceHigh: SOURCE_HIGH };
