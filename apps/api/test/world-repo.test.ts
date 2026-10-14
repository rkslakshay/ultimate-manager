import { generateWorld } from '@um/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertWorld, loadWorld } from '../src/world/world-repo';
import { createTestApp, registerUser, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('world repository', () => {
  it('round-trips a generated world through the database exactly', async () => {
    const { user } = await registerUser(ctx.app);
    const save = await ctx.db.saveGame.create({
      data: {
        userId: user.id,
        name: 'rt',
        managerName: 'rt',
        seed: 'round-trip',
        gameDate: new Date('2026-07-01'),
      },
    });
    const world = generateWorld('round-trip');
    // Names from every flavour (including characters outside Latin-1, e.g. "ć") must survive.
    const beyondLatin1 = (s: string) => [...s].some((ch) => ch.charCodeAt(0) > 0xff);
    expect(world.players.some((p) => beyondLatin1(p.lastName))).toBe(true);

    await ctx.db.$transaction((tx) => insertWorld(tx, save.id, world), { timeout: 60_000 });
    const loaded = await loadWorld(
      ctx.db,
      save.id,
      world.seed,
      world.startDay,
      world.schemaVersion,
    );
    expect(loaded).toStrictEqual(world);
  });
});
