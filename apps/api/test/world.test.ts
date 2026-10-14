import { ATTRIBUTE_COUNT, ATTRIBUTE_KEYS, HIDDEN_KEYS } from '@um/engine';
import { parseCsvObjects, toCsv } from '@um/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerUser, type TestContext } from './helpers';

let ctx: TestContext;
let cookies: Record<string, string>;
let saveId: string;

const get = (url: string, c = cookies) => ctx.app.inject({ method: 'GET', url, cookies: c });
const w = (path: string) => `/api/saves/${saveId}/world${path}`;

beforeAll(async () => {
  ctx = await createTestApp();
  ({ cookies } = await registerUser(ctx.app));
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/saves',
    cookies,
    payload: { name: 'World test', managerName: 'Tester', seed: 'world-api' },
  });
  expect(res.statusCode).toBe(201);
  expect(res.json().hasWorld).toBe(true);
  saveId = res.json().id;
});
afterAll(async () => {
  await ctx.close();
});

describe('world browsing', () => {
  it('returns the overview of nations and competitions', async () => {
    const res = await get(w('/overview'));
    expect(res.statusCode).toBe(200);
    const { nations, competitions } = res.json();
    expect(nations).toHaveLength(9);
    expect(competitions.filter((c: { kind: string }) => c.kind === 'league')).toHaveLength(6);
  });

  it('lists a competition with club strength and a club with its squad', async () => {
    const comp = (await get(w('/competitions/1'))).json();
    expect(comp.clubs).toHaveLength(comp.clubCount);
    expect(comp.clubs[0].strength).toBeGreaterThan(comp.clubs.at(-1).strength);

    const club = (await get(w(`/clubs/${comp.clubs[0].id}`))).json();
    expect(club.squad.length).toBeGreaterThanOrEqual(24);
    expect(club.stadium.capacity).toBeGreaterThan(0);
    expect(club.league.id).toBe(1);
    expect(club.wageBill).toBeGreaterThan(0);
    expect((await get(w('/clubs/99999'))).statusCode).toBe(404);
  });

  it('searches players with filters, sorting and pagination', async () => {
    const page1 = (await get(w('/players?pageSize=25&sort=value&order=desc'))).json();
    expect(page1.items).toHaveLength(25);
    expect(page1.total).toBeGreaterThan(3000);
    const values = page1.items.map((p: { value: number }) => p.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    const page2 = (await get(w('/players?pageSize=25&sort=value&order=desc&page=2'))).json();
    expect(page2.items[0].value).toBeLessThanOrEqual(values.at(-1));

    const gks = (await get(w('/players?position=GK&minAge=20&maxAge=24&pageSize=200'))).json();
    expect(gks.items.length).toBeGreaterThan(0);
    for (const p of gks.items) {
      expect(p.position).toBe('GK');
      expect(p.age).toBeGreaterThanOrEqual(20);
      expect(p.age).toBeLessThanOrEqual(24);
    }

    const free = (await get(w('/players?freeAgents=true&pageSize=5'))).json();
    expect(free.items.every((p: { club: unknown }) => p.club === null)).toBe(true);

    const someone = page1.items[3];
    const byName = (await get(w(`/players?q=${encodeURIComponent(someone.lastName)}`))).json();
    expect(byName.items.map((p: { id: number }) => p.id)).toContain(someone.id);

    expect((await get(w('/players?position=XX'))).statusCode).toBe(400);
  });

  it('returns player detail, with hidden attributes only on request', async () => {
    const p = (await get(w('/players/1'))).json();
    expect(p.attributes).toHaveLength(ATTRIBUTE_COUNT);
    expect(p.hidden).toBeUndefined();
    expect(p.nation.code).toMatch(/^[A-Z]{3}$/);
    const withHidden = (await get(w('/players/1?hidden=true'))).json();
    expect(withHidden.hidden).toHaveLength(HIDDEN_KEYS.length);
  });

  it("hides one user's world from another", async () => {
    const other = await registerUser(ctx.app);
    expect((await get(w('/overview'), other.cookies)).statusCode).toBe(404);
    expect((await get(w('/players/1'), other.cookies)).statusCode).toBe(404);
  });
});

describe('choosing a club', () => {
  it('lets the manager take charge of a league club once', async () => {
    const bad = await ctx.app.inject({
      method: 'POST',
      url: `/api/saves/${saveId}/club`,
      cookies,
      payload: { clubId: 99999 },
    });
    expect(bad.statusCode).toBe(404);
    const ok = await ctx.app.inject({
      method: 'POST',
      url: `/api/saves/${saveId}/club`,
      cookies,
      payload: { clubId: 5 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().managerClubId).toBe(5);
    expect(ok.json().clubName).toBeTruthy();
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/api/saves/${saveId}/club`,
      cookies,
      payload: { clubId: 6 },
    });
    expect(again.statusCode).toBe(409);
  });
});

describe('database editor', () => {
  it('renames clubs and validates input', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: w('/clubs/2'),
      cookies,
      payload: { name: 'Edited FC', primaryColor: '#123456' },
    });
    expect(res.statusCode).toBe(200);
    expect((await get(w('/clubs/2'))).json().name).toBe('Edited FC');
    const bad = await ctx.app.inject({
      method: 'PATCH',
      url: w('/clubs/2'),
      cookies,
      payload: { primaryColor: 'red' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('recomputes ability when attributes are edited', async () => {
    const before = (await get(w('/players/10'))).json();
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: w('/players/10'),
      cookies,
      payload: { lastName: 'Renamed', attributes: new Array(ATTRIBUTE_COUNT).fill(20) },
    });
    expect(res.statusCode).toBe(200);
    const after = res.json();
    expect(after.lastName).toBe('Renamed');
    expect(after.ca).toBeGreaterThan(before.ca);
    expect(after.ca).toBe(200);
    expect(after.pa).toBeGreaterThanOrEqual(after.ca);
    expect(after.value).toBeGreaterThan(before.value);
  });

  it('exports and re-imports CSV, reporting bad rows', async () => {
    const exported = await get(w('/export?entity=clubs&format=csv'));
    expect(exported.headers['content-type']).toContain('text/csv');
    const rows = parseCsvObjects(exported.body);
    expect(rows.length).toBeGreaterThan(100);
    const header = Object.keys(rows[0]!);
    const edited: Record<string, string>[] = [
      { ...rows[2]!, name: 'Imported United' },
      { ...rows[3]!, id: '99999' },
      { ...rows[4]!, code: 'toolong!' },
    ];
    const res = await ctx.app.inject({
      method: 'POST',
      url: w('/import'),
      cookies,
      payload: {
        entity: 'clubs',
        format: 'csv',
        content: toCsv([header, ...edited.map((r) => header.map((h) => r[h]))]),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(1);
    expect(res.json().errors.map((e: { row: number }) => e.row)).toEqual([2, 3]);
    expect((await get(w(`/clubs/${rows[2]!.id}`))).json().name).toBe('Imported United');
  });

  it('imports player attributes from JSON', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: w('/import'),
      cookies,
      payload: {
        entity: 'players',
        format: 'json',
        content: JSON.stringify([
          { id: 20, firstName: 'Json', [ATTRIBUTE_KEYS[0]!]: 19 },
          { id: 21, pace: 99 },
        ]),
      },
    });
    expect(res.json().updated).toBe(1);
    expect(res.json().errors).toHaveLength(1);
    const p = (await get(w('/players/20'))).json();
    expect(p.firstName).toBe('Json');
    expect(p.attributes[0]).toBe(19);
  });
});

describe('legacy saves', () => {
  it('generates a world for saves created before worlds existed', async () => {
    const { user, cookies: c } = await registerUser(ctx.app);
    const legacy = await ctx.db.saveGame.create({
      data: {
        userId: user.id,
        name: 'Old',
        managerName: 'Old',
        seed: 'legacy',
        gameDate: new Date('2026-07-01'),
      },
    });
    expect((await get(`/api/saves/${legacy.id}/world/overview`, c)).statusCode).toBe(409);
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/saves/${legacy.id}/world`,
      cookies: c,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().hasWorld).toBe(true);
    expect((await get(`/api/saves/${legacy.id}/world/overview`, c)).statusCode).toBe(200);
  });
});
