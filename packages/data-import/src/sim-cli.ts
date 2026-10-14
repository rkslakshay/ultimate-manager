#!/usr/bin/env node
/**
 * Headless multi-season DEVELOPMENT simulation (no matches yet; playing time is synthetic).
 *   npm run sim:development -- --pack fictional|sample|real [--seasons 20] [--seed x]
 * Writes data-packs/reports/development-<pack>.md and .json with per-season stats and the
 * stability checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  checkStability,
  generateWorld,
  simulateSeasons,
  type SeasonStats,
  type WorldState,
} from '@um/engine';
import { readPack } from './pack-format';
import { packPaths } from './paths';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};

const pack = arg('pack', 'fictional');
const seasons = Number(arg('seasons', '20'));
const seed = arg('seed', 'dev-sim');
const paths = packPaths();

let world: WorldState;
let valueModel = null;
if (pack === 'fictional') {
  world = generateWorld(seed);
} else {
  const data = readPack(paths.processed, pack);
  world = data.world;
  valueModel = data.valueModel?.model ?? null;
}

const started = Date.now();
const { stats } = simulateSeasons(world, {
  seasons,
  seed,
  valueModel,
  onSeason: (s) =>
    process.stdout.write(
      `season ${s.season}: ${s.activePlayers} players, mean CA ${s.ca.mean}, elite ${s.elite}\r`,
    ),
});
const ms = Date.now() - started;
const checks = checkStability(stats);

const row = (s: SeasonStats) =>
  `| ${s.season} | ${s.date} | ${s.activePlayers} | ${s.imported}/${s.generated} | ${s.ca.mean} | ${s.ca.p90} | ${s.ca.max} | ${s.elite} | ${Object.values(s.caByAge).join(' / ')} | ${s.retired} | ${s.regens} | ${s.freeAgents} | ${s.youthGrowth} | ${s.veteranDecline} | €${(s.valueMean / 1e6).toFixed(2)}M | ${s.squadMin}-${s.squadMax} |`;
const md = [
  `# Development simulation: ${pack}, ${seasons} seasons`,
  '',
  `Seed \`${seed}\` · ${(ms / 1000).toFixed(1)} s · starting players ${world.players.length}.`,
  '',
  '> Matches are not simulated yet (Phase 2/3). Playing time, ratings and injuries are SYNTHETIC',
  '> stand-ins (squad rank, relative ability, injury proneness). This checks that progression,',
  '> retirements, contracts and youth intakes keep the world stable; it does not predict careers.',
  '',
  '## Stability checks',
  '',
  ...checks.map((c) => `- ${c.ok ? '✅' : '❌'} **${c.name}**: ${c.detail}`),
  '',
  '## Per season',
  '',
  '| Season | Date | Active | Imported/Generated | Mean CA | P90 CA | Max | Elite (≥160) | CA by age <21 / 21-25 / 26-29 / 30-33 / 34+ | Retired | Regens | Free agents | Youth growth | Veteran change | Mean value | Squads |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...stats.map(row),
].join('\n');
fs.mkdirSync(paths.reports, { recursive: true });
const base = path.join(paths.reports, `development-${pack}`);
fs.writeFileSync(`${base}.md`, md);
fs.writeFileSync(
  `${base}.json`,
  JSON.stringify({ pack, seasons, seed, ms, checks, stats }, null, 2),
);
console.log(
  `\n${checks.filter((c) => c.ok).length}/${checks.length} stability checks passed in ${(ms / 1000).toFixed(1)} s`,
);
for (const c of checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}: ${c.detail}`);
console.log(`Report: ${path.relative(process.cwd(), base)}.md`);
process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
