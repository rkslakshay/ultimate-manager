/**
 * Generates the FICTIONAL sample dataset used by tests and the "sample" pack.
 * Every name, club, league and number here is invented. Run:
 *   npx tsx data-packs/fixtures/sample/make-fixtures.ts
 * Output is deterministic and committed under data-packs/fixtures/sample/data/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng, toIsoDate, parseIsoDate, addYears } from '../../../packages/engine/src/index';
import { generatePersonName, generateTownNames } from '../../../packages/engine/src/names/generate';
import { toCsv } from '../../../packages/shared/src/csv';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'data');
const rng = createRng('sample-fixtures-v1');

interface League {
  eaId: number;
  name: string;
  level: number;
  tmId: string | null;
  country: string;
  clubs: number;
  overall: number;
}
const LEAGUES: League[] = [
  {
    eaId: 9001,
    name: 'Northland Premier',
    level: 1,
    tmId: 'NP1',
    country: 'Northland',
    clubs: 8,
    overall: 71,
  },
  {
    eaId: 9002,
    name: 'Northland Championship',
    level: 2,
    tmId: 'NC2',
    country: 'Northland',
    clubs: 8,
    overall: 62,
  },
  // No Transfermarkt-style competition: the importer must derive the country (and warn).
  {
    eaId: 9003,
    name: 'Southmoor Liga',
    level: 1,
    tmId: null,
    country: 'Southmoor',
    clubs: 8,
    overall: 66,
  },
  // Too small: excluded by minClubsPerLeague.
  {
    eaId: 9004,
    name: 'Tiny Island League',
    level: 1,
    tmId: null,
    country: 'Eastvale',
    clubs: 3,
    overall: 55,
  },
];
const NATIONS = [
  { name: 'Northland', flavour: 'anglo' as const },
  { name: 'Southmoor', flavour: 'latin' as const },
  { name: 'Eastvale', flavour: 'slavic' as const },
];
const POS_TEMPLATE = [
  'GK',
  'GK',
  'CB',
  'CB',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CM',
  'CM',
  'LW',
  'RW',
  'CAM',
  'ST',
];
const SECONDARY: Record<string, string[]> = {
  CB: ['CDM'],
  LB: ['LWB', 'LM'],
  RB: ['RWB', 'RM'],
  CDM: ['CM'],
  CM: ['CDM', 'CAM'],
  LW: ['LM', 'ST'],
  RW: ['RM'],
  CAM: ['CM'],
  ST: ['CF'],
  GK: [],
};

const r99 = (v: number) => Math.max(10, Math.min(97, Math.round(v)));
function ratings(pos: string, overall: number) {
  const gk = pos === 'GK';
  const att = ['ST', 'LW', 'RW', 'CAM'].includes(pos);
  const def = ['CB', 'LB', 'RB', 'CDM'].includes(pos);
  const n = (bias: number, sd = 6) => r99(overall + bias + rng.normal(0, sd));
  const low = () => r99(rng.normal(gk ? 25 : 12, 5));
  return {
    pace: gk ? '' : n(att ? 6 : 0),
    shooting: gk ? '' : n(att ? 4 : -15),
    passing: gk ? '' : n(0),
    dribbling: gk ? '' : n(att ? 4 : -5),
    defending: gk ? '' : n(def ? 4 : -20),
    physic: gk ? '' : n(def ? 3 : -2),
    attacking_crossing: gk ? low() : n(def ? -8 : 0),
    attacking_finishing: gk ? low() : n(att ? 5 : -18),
    attacking_heading_accuracy: gk ? low() : n(pos === 'CB' || pos === 'ST' ? 4 : -10),
    attacking_short_passing: gk ? low() + 15 : n(2),
    attacking_volleys: gk ? low() : n(att ? 0 : -15),
    skill_dribbling: gk ? low() : n(att ? 4 : -6),
    skill_curve: gk ? low() : n(-4),
    skill_fk_accuracy: gk ? low() : n(-8, 10),
    skill_long_passing: gk ? low() + 10 : n(-2),
    skill_ball_control: gk ? low() + 10 : n(2),
    movement_acceleration: n(att ? 6 : -2, 8),
    movement_sprint_speed: n(att ? 6 : -2, 8),
    movement_agility: n(att ? 4 : -3),
    movement_reactions: n(0, 4),
    movement_balance: n(-2),
    power_shot_power: gk ? low() + 20 : n(0),
    power_jumping: n(def ? 3 : -3),
    power_stamina: gk ? n(-20) : n(2),
    power_strength: n(def ? 4 : -2),
    power_long_shots: gk ? low() : n(att ? 0 : -12),
    mentality_aggression: n(def ? 4 : -6, 10),
    mentality_interceptions: gk ? low() : n(def ? 4 : -20),
    mentality_positioning: gk ? low() : n(att ? 4 : -16),
    mentality_vision: gk ? n(-15) : n(pos === 'CAM' || pos === 'CM' ? 4 : -6),
    mentality_penalties: gk ? low() : n(-6, 8),
    mentality_composure: n(0),
    defending_marking_awareness: gk ? low() : n(def ? 4 : -22),
    defending_standing_tackle: gk ? low() : n(def ? 4 : -24),
    defending_sliding_tackle: gk ? low() : n(def ? 2 : -26),
    goalkeeping_diving: gk ? n(2) : low(),
    goalkeeping_handling: gk ? n(0) : low(),
    goalkeeping_kicking: gk ? n(-4) : low(),
    goalkeeping_positioning: gk ? n(0) : low(),
    goalkeeping_reflexes: gk ? n(3) : low(),
    goalkeeping_speed: gk ? n(-10) : '',
  };
}

const startDay = parseIsoDate('2026-07-01');
const eaRows: Record<string, string | number>[] = [];
const tmPlayers: Record<string, string | number>[] = [];
const tmClubs: Record<string, string | number>[] = [];
const tmComps: Record<string, string | number>[] = [];
const transfers: Record<string, string | number>[] = [];
const valuations: Record<string, string | number>[] = [];

let eaId = 500000;
let tmId = 800000;
let clubSeq = 7000;
const allClubs: { eaClubId: number; tmClubId: number | null; name: string; league: League }[] = [];

for (const l of LEAGUES) {
  if (l.tmId)
    tmComps.push({
      competition_id: l.tmId,
      name: l.name,
      country_name: l.country,
      type: 'domestic_league',
      sub_type: l.level === 1 ? 'first_tier' : 'second_tier',
    });
  const nation = NATIONS.find((n) => n.name === l.country)!;
  const towns = generateTownNames(rng, nation.flavour, l.clubs);
  for (const town of towns) {
    const eaClubId = ++clubSeq;
    const name = `${town} ${rng.pick(['Athletic', 'Rovers', 'United', 'Town', 'City'])}`;
    const tmClubId = l.tmId ? eaClubId + 100000 : null;
    if (tmClubId) {
      // Transfermarkt-style names sometimes carry "FC": the matcher must still pair them.
      tmClubs.push({
        club_id: tmClubId,
        name: rng.chance(0.4) ? `${name} FC` : name,
        domestic_competition_id: l.tmId!,
        stadium_name: `${town} Ground`,
        stadium_seats: rng.int(4, 40) * 1000,
        squad_size: 14,
      });
    }
    allClubs.push({ eaClubId, tmClubId, name, league: l });
  }
}
allClubs.push({
  eaClubId: 6999,
  tmClubId: 106999,
  name: 'Old Harbour FC',
  league: { ...LEAGUES[0]!, eaId: -1 },
}); // only in transfer history
tmClubs.push({
  club_id: 106999,
  name: 'Old Harbour FC',
  domestic_competition_id: 'XX9',
  stadium_name: '',
  stadium_seats: '',
  squad_size: '',
});

const ACCENT_SWAPS: [string, string][] = [
  ['Jose', 'José'],
  ['Andres', 'Andrés'],
  ['Nicolas', 'Nicolás'],
];

for (const club of allClubs.filter((c) => c.league.eaId > 0)) {
  const l = club.league;
  const nation = NATIONS.find((n) => n.name === l.country)!;
  for (const pos of POS_TEMPLATE) {
    const nat = rng.chance(0.8) ? nation : rng.pick(NATIONS);
    const { firstName, lastName } = generatePersonName(rng, nat.flavour);
    const age = rng.int(18, 34);
    const dob = addYears(startDay, -age) - rng.int(1, 364);
    const overall = Math.round(l.overall + rng.normal(0, 5) + (pos === 'GK' ? -1 : 0));
    const potential = Math.max(
      overall,
      overall + Math.max(0, Math.round(rng.normal(age < 23 ? 10 : 1, 4))),
    );
    const id = ++eaId;
    const positions = [pos, ...(SECONDARY[pos] ?? []).filter(() => rng.chance(0.5))].join(', ');
    const value = Math.round(Math.exp(overall / 7.2) * (age < 24 ? 1.6 : age > 30 ? 0.5 : 1)) * 10;
    eaRows.push({
      player_id: id,
      fifa_version: 26,
      fifa_update: 1,
      short_name: `${firstName[0]}. ${lastName}`,
      long_name: `${firstName} ${lastName}`,
      player_positions: positions,
      overall,
      potential,
      value_eur: value,
      wage_eur: Math.round(value / 400 / 50) * 50 + 500,
      age,
      dob: toIsoDate(dob),
      height_cm: pos === 'GK' ? rng.int(185, 198) : rng.int(168, 194),
      weight_kg: rng.int(64, 92),
      club_team_id: club.eaClubId,
      club_name: club.name,
      league_id: l.eaId,
      league_name: l.name,
      league_level: l.level,
      club_jersey_number: POS_TEMPLATE.indexOf(pos) + 1 + (eaRows.length % 3) * 20,
      club_contract_valid_until_year: 2027 + rng.int(0, 3),
      club_joined_date: toIsoDate(addYears(startDay, -rng.int(1, 4))),
      nationality_name: nat.name,
      preferred_foot: rng.chance(0.75) ? 'Right' : 'Left',
      weak_foot: rng.int(1, 5),
      skill_moves: rng.int(1, 5),
      international_reputation: rng.weighted([1, 2, 3], [80, 15, 5]),
      work_rate: `${rng.pick(['High', 'Medium', 'Low'])}/${rng.pick(['High', 'Medium', 'Low'])}`,
      player_traits: rng.chance(0.3)
        ? rng.pick([
            'Long Shot Taker (AI)',
            'Flair',
            'Playmaker (AI)',
            'Injury Prone',
            'Leadership',
            'Finesse Shot',
          ])
        : '',
      release_clause_eur: rng.chance(0.3) ? value * 2 : '',
      ...ratings(pos, overall),
    });
    if (!club.tmClubId) continue;
    // Transfermarkt-style record for the same (fictional) person.
    const tId = ++tmId;
    let tmFirst = firstName;
    const swap = ACCENT_SWAPS.find(([plain]) => plain === firstName);
    if (swap && rng.chance(0.7)) tmFirst = swap[1];
    tmPlayers.push({
      player_id: tId,
      first_name: tmFirst,
      last_name: lastName,
      name: `${tmFirst} ${lastName}`,
      last_season: 2026,
      current_club_id: club.tmClubId,
      country_of_citizenship: nat.name,
      date_of_birth: `${toIsoDate(dob)} 00:00:00`,
      position:
        pos === 'GK'
          ? 'Goalkeeper'
          : ['CB', 'LB', 'RB'].includes(pos)
            ? 'Defender'
            : ['CDM', 'CM', 'CAM'].includes(pos)
              ? 'Midfield'
              : 'Attack',
      sub_position: '',
      foot: '',
      height_in_cm: '',
      contract_expiration_date: rng.chance(0.85) ? `${2027 + rng.int(0, 3)}-06-30 00:00:00` : '',
      market_value_in_eur: value,
      current_club_name: club.name,
      current_club_domestic_competition_id: l.tmId!,
    });
    let v = value * rng.float(0.5, 0.9);
    for (let k = 0; k < rng.int(3, 6); k++) {
      valuations.push({
        player_id: tId,
        date: toIsoDate(parseIsoDate('2023-01-15') + k * 180 + rng.int(0, 20)),
        market_value_in_eur: Math.round(v / 1000) * 1000,
        current_club_id: club.tmClubId,
      });
      v *= rng.float(0.9, 1.3);
    }
    for (let k = 0; k < rng.int(0, 2); k++) {
      const fee = rng.weighted<number | ''>(
        ['', 0, Math.round((value * rng.float(0.3, 1.2)) / 1000) * 1000],
        [3, 2, 5],
      );
      transfers.push({
        player_id: tId,
        transfer_date: toIsoDate(parseIsoDate('2022-07-01') + k * 365 + rng.int(0, 60)),
        transfer_season: `${22 + k}/${23 + k}`,
        from_club_id: 106999,
        to_club_id: club.tmClubId,
        from_club_name: 'Old Harbour FC',
        to_club_name: club.name,
        transfer_fee: fee,
        market_value_in_eur: Math.round(value * 0.8),
        player_name: `${tmFirst} ${lastName}`,
      });
    }
  }
}

// ---- deliberate edge cases (all fictional) -------------------------------------------------
const first = eaRows[2]!;
// 1) Same player in an older game version: must be ignored in favour of the newest version.
eaRows.push({ ...first, fifa_version: 25, overall: 55, potential: 60 });
// 2) Duplicate row in the newest version with a later update: the later update wins.
eaRows.push({ ...eaRows[3]!, fifa_update: 2, overall: Number(eaRows[3]!.overall) + 1 });
// 3) Malformed rows: rejected with a reason.
eaRows.push({ ...eaRows[4]!, player_id: 599001, overall: 'abc' });
eaRows.push({ ...eaRows[5]!, player_id: 599002, player_positions: '' });
// 4) Two different people with the same name and birth date at different clubs, one TM record:
//    the matcher must flag this as ambiguous and merge neither.
const twinA = eaRows.find((r) => r.league_id === 9001 && r.player_positions === 'ST')!;
const twinClub = allClubs.find((c) => c.league.eaId === 9002)!;
eaRows.push({
  ...twinA,
  player_id: 599003,
  club_team_id: twinClub.eaClubId,
  club_name: twinClub.name,
  league_id: 9002,
  league_name: 'Northland Championship',
  league_level: 2,
  overall: 60,
  potential: 64,
});
// 5) Fuzzy lookalike: TM spells the surname differently: candidate only, not merged.
const fuzzyEa = eaRows.find((r) => r.league_id === 9001 && r.player_positions === 'CAM')!;
const fuzzyTm = tmPlayers.find(
  (t) =>
    t.date_of_birth === `${fuzzyEa.dob} 00:00:00` &&
    t.last_name === String(fuzzyEa.long_name).split(' ').slice(1).join(' '),
)!;
fuzzyTm.last_name = `${fuzzyTm.last_name}e`;
fuzzyTm.name = `${fuzzyTm.first_name} ${fuzzyTm.last_name}`;
// 6) A nationality conflict on an otherwise exact match (kept, reported).
const conflict = tmPlayers[10]!;
conflict.country_of_citizenship =
  conflict.country_of_citizenship === 'Northland' ? 'Southmoor' : 'Northland';
// 7) A player whose contract already expired before the career start.
const expired = tmPlayers[12]!;
expired.contract_expiration_date = '2025-06-30 00:00:00';
// 8) A loan with an explicit type, and a Transfermarkt-only player with no ratings.
transfers.push({
  player_id: tmPlayers[1]!.player_id,
  transfer_date: '2025-01-31',
  transfer_season: '24/25',
  from_club_id: 106999,
  to_club_id: tmPlayers[1]!.current_club_id,
  from_club_name: 'Old Harbour FC',
  to_club_name: String(tmPlayers[1]!.current_club_name),
  transfer_fee: '',
  market_value_in_eur: 250000,
  player_name: String(tmPlayers[1]!.name),
  transfer_type: 'loan',
});
tmPlayers.push({
  ...tmPlayers[0]!,
  player_id: 899999,
  first_name: 'Unrated',
  last_name: 'Prospect',
  name: 'Unrated Prospect',
  date_of_birth: '2008-03-03 00:00:00',
});

const write = (rel: string, rows: Record<string, string | number>[]) => {
  const header = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
  fs.writeFileSync(
    path.join(out, rel),
    toCsv([header, ...rows.map((r) => header.map((h) => r[h] ?? ''))]) + '\r\n',
  );
};
write('ratings/players.csv', eaRows);
write('transfermarkt/players.csv', tmPlayers);
write('transfermarkt/clubs.csv', tmClubs);
write('transfermarkt/competitions.csv', tmComps);
write(
  'transfermarkt/transfers.csv',
  transfers.map((t) => ({ transfer_type: '', ...t })),
);
write('transfermarkt/player_valuations.csv', valuations);
console.log(
  `ratings ${eaRows.length}, tm players ${tmPlayers.length}, clubs ${tmClubs.length}, transfers ${transfers.length}, valuations ${valuations.length}`,
);
