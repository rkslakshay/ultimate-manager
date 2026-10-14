import { applyProgression, ATTRIBUTE_KEYS, createRng } from '@um/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dateToDay } from '../src/world/convert';
import { recordProgression } from '../src/world/development';
import { rowToPlayer } from '../src/world/world-repo';
import { createTestApp, registerUser, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('attribute development history', () => {
  it('records progression changes and serves them per player', async () => {
    const { cookies } = await registerUser(ctx.app);
    const save = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/saves',
        cookies,
        payload: { name: 'Dev', managerName: 'Tester', seed: 'dev-history' },
      })
    ).json();
    const url = (id: number) => `/api/saves/${save.id}/world/players/${id}/development`;

    // Pick a young, high-potential player and run one season-end review on him.
    const row = (
      await ctx.db.player.findMany({
        where: { saveId: save.id, clubId: { not: null } },
        orderBy: { pa: 'desc' },
        take: 50,
      })
    ).find((p) => p.pa - p.ca > 30)!;
    const player = rowToPlayer(row);
    const today = dateToDay(new Date(`${save.gameDate}T00:00:00Z`)) + 300;
    const result = applyProgression(player, {
      today,
      kind: 'season',
      rng: createRng('dev-history-review'),
      minutesShare: 0.9,
      averageRating: 7.4,
      trainingQuality: 16,
      injuredDays: 0,
      levelCa: player.ca,
    });
    expect(result.changes.length).toBeGreaterThan(0);
    await recordProgression(ctx.db, save.id, player.id, today, 'season', result);

    const res = await ctx.app.inject({ method: 'GET', url: url(player.id), cookies });
    expect(res.statusCode).toBe(200);
    const { changes } = res.json();
    expect(changes).toHaveLength(result.changes.length);
    for (const c of changes) {
      expect(ATTRIBUTE_KEYS).toContain(c.attribute);
      expect(c).toMatchObject({
        period: 'season',
        caBefore: result.caBefore,
        caAfter: result.caAfter,
      });
      expect(Math.abs(c.to - c.from)).toBeLessThanOrEqual(2);
    }

    // Other players have no history; unknown players 404; other users can't see it.
    const other = await ctx.db.player.findFirst({
      where: { saveId: save.id, id: { not: player.id } },
    });
    expect(
      (await ctx.app.inject({ method: 'GET', url: url(other!.id), cookies })).json().changes,
    ).toEqual([]);
    expect((await ctx.app.inject({ method: 'GET', url: url(999999), cookies })).statusCode).toBe(
      404,
    );
    const stranger = await registerUser(ctx.app);
    expect(
      (await ctx.app.inject({ method: 'GET', url: url(player.id), cookies: stranger.cookies }))
        .statusCode,
    ).toBe(404);
  });
});
