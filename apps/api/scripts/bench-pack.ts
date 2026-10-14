/**
 * Scale benchmark for the data-pack pipeline using a LARGE FICTIONAL dataset shaped like a
 * full real-world release (~18k rated players, ~120k valuations). Nothing here is real data.
 *   npx tsx apps/api/scripts/bench-pack.ts [leagues=36]
 * Requires the dev database (npm run db:start or npm run dev) for the save-creation timing.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRng, parseIsoDate, toIsoDate, addYears } from '@um/engine';
import { buildPack, writePack } from '@um/data-import';
import { toCsv } from '@um/shared';
import { config as loadEnv } from 'dotenv';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb } from '../src/db';

const LEAGUES = Number(process.argv[2] ?? 36);
const CLUBS = 18;
const PLAYERS = 28;
const RATING_COLS = [
  'attacking_crossing',
  'attacking_finishing',
  'attacking_heading_accuracy',
  'attacking_short_passing',
  'attacking_volleys',
  'skill_dribbling',
  'skill_curve',
  'skill_fk_accuracy',
  'skill_long_passing',
  'skill_ball_control',
  'movement_acceleration',
  'movement_sprint_speed',
  'movement_agility',
  'movement_reactions',
  'movement_balance',
  'power_shot_power',
  'power_jumping',
  'power_stamina',
  'power_strength',
  'power_long_shots',
  'mentality_aggression',
  'mentality_interceptions',
  'mentality_positioning',
  'mentality_vision',
  'mentality_penalties',
  'mentality_composure',
  'defending_marking_awareness',
  'defending_standing_tackle',
  'defending_sliding_tackle',
  'goalkeeping_diving',
  'goalkeeping_handling',
  'goalkeeping_kicking',
  'goalkeeping_positioning',
  'goalkeeping_reflexes',
  'goalkeeping_speed',
];
const POS = [
  'GK',
  'GK',
  'CB',
  'CB',
  'CB',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CDM',
  'CM',
  'CM',
  'CM',
  'LM',
  'RM',
  'CAM',
  'LW',
  'RW',
  'ST',
  'ST',
  'ST',
  'CB',
  'CM',
  'LB',
  'RB',
  'CAM',
  'ST',
  'GK',
];

function writeDataset(dir: string) {
  const rng = createRng('bench');
  const start = parseIsoDate('2026-07-01');
  const ea: (string | number)[][] = [
    [
      'player_id',
      'short_name',
      'long_name',
      'player_positions',
      'overall',
      'potential',
      'value_eur',
      'wage_eur',
      'dob',
      'height_cm',
      'weight_kg',
      'club_team_id',
      'club_name',
      'league_id',
      'league_name',
      'league_level',
      'club_jersey_number',
      'club_contract_valid_until_year',
      'nationality_name',
      'preferred_foot',
      'weak_foot',
      'skill_moves',
      'international_reputation',
      'work_rate',
      ...RATING_COLS,
    ],
  ];
  const tmP: (string | number)[][] = [
    [
      'player_id',
      'first_name',
      'last_name',
      'name',
      'date_of_birth',
      'country_of_citizenship',
      'current_club_id',
      'contract_expiration_date',
      'market_value_in_eur',
    ],
  ];
  const tmC: (string | number)[][] = [
    ['club_id', 'name', 'domestic_competition_id', 'stadium_name', 'stadium_seats'],
  ];
  const tmComp: (string | number)[][] = [['competition_id', 'name', 'country_name', 'type']];
  const vals: (string | number)[][] = [
    ['player_id', 'date', 'market_value_in_eur', 'current_club_id'],
  ];
  const trans: (string | number)[][] = [
    [
      'player_id',
      'transfer_date',
      'from_club_id',
      'to_club_id',
      'from_club_name',
      'to_club_name',
      'transfer_fee',
      'market_value_in_eur',
    ],
  ];
  let pid = 0;
  for (let l = 0; l < LEAGUES; l++) {
    const tier = (l % 2) + 1;
    const country = `Benchland ${Math.floor(l / 2) + 1}`;
    const base = 74 - tier * 6 - (l % 9);
    tmComp.push([`L${l}`, `Bench League ${l}`, country, 'domestic_league']);
    for (let c = 0; c < CLUBS; c++) {
      const clubId = l * 100 + c + 1;
      const clubName = `Bench Club ${l}-${c}`;
      tmC.push([clubId + 50000, clubName, `L${l}`, `${clubName} Ground`, rng.int(5, 60) * 1000]);
      for (let k = 0; k < PLAYERS; k++) {
        const id = ++pid;
        const pos = POS[k]!;
        const overall = Math.round(base + rng.normal(0, 6) - (c % 6));
        const age = rng.int(17, 35);
        const dob = toIsoDate(addYears(start, -age) - rng.int(1, 364));
        const value = Math.round(Math.exp(overall / 6.5) * 10);
        const first = `Benchfirst${id % 997}`;
        const last = `Benchlast${id}`;
        ea.push([
          id,
          `${first[0]}. ${last}`,
          `${first} ${last}`,
          pos,
          overall,
          overall + rng.int(0, 12),
          value,
          Math.round(value / 300),
          dob,
          rng.int(168, 196),
          rng.int(62, 92),
          clubId,
          clubName,
          1000 + l,
          `Bench League ${l}`,
          tier,
          k + 1,
          2027 + rng.int(0, 3),
          country,
          'Right',
          rng.int(1, 5),
          rng.int(1, 5),
          1,
          'Medium/Medium',
          ...RATING_COLS.map(() => Math.round(overall + rng.normal(0, 9))),
        ]);
        if (rng.chance(0.85)) {
          const tmId = id + 900000;
          tmP.push([
            tmId,
            first,
            last,
            `${first} ${last}`,
            dob,
            country,
            clubId + 50000,
            `${2027 + rng.int(0, 3)}-06-30`,
            value,
          ]);
          for (let v = 0; v < 8; v++)
            vals.push([
              tmId,
              toIsoDate(parseIsoDate('2022-01-01') + v * 180),
              Math.round(value * (0.5 + v * 0.07)),
              clubId + 50000,
            ]);
          if (rng.chance(0.6))
            trans.push([
              tmId,
              '2024-07-01',
              1,
              clubId + 50000,
              'Somewhere FC',
              clubName,
              rng.chance(0.3) ? '' : Math.round(value * 0.8),
            ]);
        }
      }
    }
  }
  const w = (rel: string, rows: (string | number)[][]) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), toCsv(rows));
  };
  w('raw/ratings/players.csv', ea);
  w('raw/tm/players.csv', tmP);
  w('raw/tm/clubs.csv', tmC);
  w('raw/tm/competitions.csv', tmComp);
  w('raw/tm/player_valuations.csv', vals);
  w('raw/tm/transfers.csv', trans);
  return {
    ratings: ea.length - 1,
    tmPlayers: tmP.length - 1,
    valuations: vals.length - 1,
    transfers: trans.length - 1,
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-bench-'));
try {
  let t = Date.now();
  const counts = writeDataset(root);
  console.log(`dataset written in ${Date.now() - t} ms:`, counts);

  t = Date.now();
  const { pack, report, identity } = await buildPack({ pack: 'real', root, configFile: null });
  console.log(`import (read + match + map + build): ${Date.now() - t} ms, status ${report.status}`);
  if (!pack || !identity) throw new Error(report.errors.join('\n'));
  t = Date.now();
  const file = writePack(root, pack, identity);
  console.log(
    `pack written in ${Date.now() - t} ms: ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB, ${pack.summary.players.total} players, ${pack.summary.clubs} clubs, ${pack.history.valuations.length} valuations`,
  );

  loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATA_PACKS_DIR: root,
    BCRYPT_ROUNDS: '4',
  });
  const db = createDb(config.DATABASE_URL);
  const app = await buildApp({ config, db });
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `bench-${Date.now()}@example.test`,
      password: 'benchmark1',
      displayName: 'Bench',
    },
  });
  const cookies = { um_session: reg.cookies.find((c) => c.name === 'um_session')!.value };
  for (const label of [
    'first save (installs pack history)',
    'second save (history already installed)',
  ]) {
    t = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/saves',
      cookies,
      payload: { name: 'bench', managerName: 'Bench', dataPack: 'real' },
    });
    console.log(`${label}: ${Date.now() - t} ms (status ${res.statusCode})`);
    if (res.statusCode === 201)
      await app.inject({ method: 'DELETE', url: `/api/saves/${res.json().id}`, cookies });
  }
  // Clean up the benchmark's pack history and user.
  await db.historicalTransfer.deleteMany({ where: { pack: 'real', version: pack.version } });
  await db.historicalValuation.deleteMany({ where: { pack: 'real', version: pack.version } });
  await db.dataPackVersion.deleteMany({ where: { pack: 'real', version: pack.version } });
  await db.user.deleteMany({ where: { email: { startsWith: 'bench-' } } });
  await app.close();
  await db.$disconnect();
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
