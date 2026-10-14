import { describe, expect, it } from 'vitest';
import { generateWorld } from '../world/generate-world';
import { checkStability, simulateSeasons } from './headless';

// A small world (one nation, one 10-club league) keeps a 20-season run fast in unit tests;
// `npm run sim:development` runs the full-size worlds.
const small = () =>
  generateWorld('headless-test', {
    nations: [
      {
        name: 'Testland',
        adjective: 'Testish',
        code: 'TST',
        flavour: 'anglo',
        reputation: 75,
        divisions: [10],
      },
      {
        name: 'Otherland',
        adjective: 'Otherish',
        code: 'OTH',
        flavour: 'latin',
        reputation: 70,
        divisions: [],
      },
    ],
    freeAgents: 40,
  });

describe('headless multi-season development', () => {
  it('is deterministic', () => {
    const a = simulateSeasons(small(), { seasons: 2, seed: 's' });
    const b = simulateSeasons(small(), { seasons: 2, seed: 's' });
    expect(a.stats).toEqual(b.stats);
  });

  it('keeps the population stable over 20 seasons', () => {
    const { stats, world } = simulateSeasons(small(), { seasons: 20, seed: 'stability' });
    expect(stats).toHaveLength(20);
    const failures = checkStability(stats).filter((c) => !c.ok);
    expect(failures).toEqual([]);
    // History is preserved: retired players stay in the world, marked retired.
    expect(world.players.some((p) => p.retired)).toBe(true);
    expect(stats.every((s) => s.regens > 0 && s.retired > 0)).toBe(true);
    // Generated players gradually replace the starting generation.
    expect(stats.at(-1)!.regenCaMean).toBeGreaterThan(40);
  }, 60_000);
});
