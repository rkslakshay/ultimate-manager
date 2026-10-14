import { MAX_SAVES_PER_USER } from '@um/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerUser, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

const createSave = (cookies: Record<string, string>, payload: object) =>
  ctx.app.inject({ method: 'POST', url: '/api/saves', cookies, payload });

describe('save games', () => {
  it('requires authentication', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/saves' });
    expect(res.statusCode).toBe(401);
  });

  it('creates, lists, renames, loads and deletes saves', async () => {
    const { cookies } = await registerUser(ctx.app);

    const created = await createSave(cookies, { name: 'Road to Glory', managerName: 'Alex Ferro' });
    expect(created.statusCode).toBe(201);
    const save = created.json();
    expect(save).toMatchObject({
      name: 'Road to Glory',
      managerName: 'Alex Ferro',
      gameDate: '2026-07-01',
      clubName: null,
    });
    expect(save.seed).toMatch(/^[0-9a-f]{16}$/);

    const seeded = await createSave(cookies, {
      name: 'Seeded',
      managerName: 'Al',
      seed: 'my-seed',
    });
    expect(seeded.json().seed).toBe('my-seed');

    const list = await ctx.app.inject({ method: 'GET', url: '/api/saves', cookies });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(2);
    // Most recently played first.
    expect(list.json().items[0].name).toBe('Seeded');

    const loaded = await ctx.app.inject({
      method: 'POST',
      url: `/api/saves/${save.id}/load`,
      cookies,
    });
    expect(loaded.statusCode).toBe(200);
    const relist = await ctx.app.inject({ method: 'GET', url: '/api/saves', cookies });
    expect(relist.json().items[0].id).toBe(save.id);

    const renamed = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/saves/${save.id}`,
      cookies,
      payload: { name: 'Renamed' },
    });
    expect(renamed.json().name).toBe('Renamed');

    const del = await ctx.app.inject({ method: 'DELETE', url: `/api/saves/${save.id}`, cookies });
    expect(del.statusCode).toBe(204);
    const gone = await ctx.app.inject({ method: 'GET', url: `/api/saves/${save.id}`, cookies });
    expect(gone.statusCode).toBe(404);
  });

  it("never exposes or mutates another user's saves", async () => {
    const owner = await registerUser(ctx.app);
    const other = await registerUser(ctx.app);
    const save = (await createSave(owner.cookies, { name: 'Mine', managerName: 'Owner' })).json();

    for (const [method, url] of [
      ['GET', `/api/saves/${save.id}`],
      ['PATCH', `/api/saves/${save.id}`],
      ['DELETE', `/api/saves/${save.id}`],
      ['POST', `/api/saves/${save.id}/load`],
    ] as const) {
      const res = await ctx.app.inject({
        method,
        url,
        cookies: other.cookies,
        ...(method === 'PATCH' ? { payload: { name: 'Hacked' } } : {}),
      });
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
    const otherList = await ctx.app.inject({
      method: 'GET',
      url: '/api/saves',
      cookies: other.cookies,
    });
    expect(otherList.json().items).toHaveLength(0);
    const stillThere = await ctx.app.inject({
      method: 'GET',
      url: `/api/saves/${save.id}`,
      cookies: owner.cookies,
    });
    expect(stillThere.json().name).toBe('Mine');
  });

  it('enforces the per-user save limit', async () => {
    const { cookies } = await registerUser(ctx.app);
    for (let i = 0; i < MAX_SAVES_PER_USER; i++) {
      expect((await createSave(cookies, { name: `Save ${i}`, managerName: 'Al' })).statusCode).toBe(
        201,
      );
    }
    const over = await createSave(cookies, { name: 'One too many', managerName: 'Al' });
    expect(over.statusCode).toBe(409);
    expect(over.json().error.code).toBe('LIMIT_REACHED');
  });

  it('validates input', async () => {
    const { cookies } = await registerUser(ctx.app);
    const res = await createSave(cookies, { name: '', managerName: 'A', seed: 'bad seed!' });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().error.fieldErrors)).toEqual(
      expect.arrayContaining(['name', 'managerName', 'seed']),
    );
  });

  it('deletes saves when their owner is deleted (cascade)', async () => {
    const { cookies, user } = await registerUser(ctx.app);
    await createSave(cookies, { name: 'Doomed', managerName: 'Al' });
    await ctx.db.user.delete({ where: { id: user.id } });
    expect(await ctx.db.saveGame.count({ where: { userId: user.id } })).toBe(0);
  });
});
