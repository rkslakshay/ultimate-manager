import { ATTRIBUTE_COUNT, ATTRIBUTE_KEYS } from '@um/engine';
import { toCsv } from '@um/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerUser, type TestContext } from './helpers';

let ctx: TestContext;
let cookies: Record<string, string>;
let saveId: string;
const w = (p: string) => `/api/saves/${saveId}/world${p}`;
const get = (url: string) => ctx.app.inject({ method: 'GET', url, cookies });
const post = (url: string, payload: object) =>
  ctx.app.inject({ method: 'POST', url, cookies, payload });

beforeAll(async () => {
  ctx = await createTestApp();
  ({ cookies } = await registerUser(ctx.app));
  saveId = (
    await post('/api/saves', { name: 'Editor', managerName: 'Tester', seed: 'editor-create' })
  ).json().id;
});
afterAll(async () => {
  await ctx.close();
});

describe('editor: adding clubs', () => {
  it('adds a custom club to a league and its national cup', async () => {
    const res = await post(w('/clubs'), {
      name: 'Custom Albion',
      code: 'CUS',
      primaryColor: '#112233',
      secondaryColor: '#ffffff',
      leagueId: 2,
      reputation: 35,
    });
    expect(res.statusCode).toBe(201);
    const club = res.json();
    expect(club.origin).toBe('custom');
    const comp = (await get(w('/competitions/2'))).json();
    expect(comp.clubs.map((c: { id: number }) => c.id)).toContain(club.id);
    const detail = (await get(w(`/clubs/${club.id}`))).json();
    expect(detail.stadium.name).toBe('Custom Albion Stadium');
    expect(detail.squad).toEqual([]);
    // The national cup holds every club of that nation's leagues (all divisions).
    const comps = (await get(w('/overview')))
      .json()
      .competitions.filter((c: { nationId: number }) => c.nationId === comp.nationId);
    const cup = comps.find((c: { kind: string }) => c.kind === 'cup');
    const leagueClubs = comps
      .filter((c: { kind: string }) => c.kind === 'league')
      .reduce((n: number, c: { clubCount: number }) => n + c.clubCount, 0);
    expect(cup.clubCount).toBe(leagueClubs);
  });

  it('validates the league', async () => {
    const res = await post(w('/clubs'), {
      name: 'Nowhere',
      code: 'NOW',
      primaryColor: '#112233',
      secondaryColor: '#ffffff',
      leagueId: 9999,
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('editor: adding players', () => {
  it('generates a consistent profile for a target ability', async () => {
    const res = await post(w('/players'), {
      lastName: 'Newman',
      firstName: 'Neil',
      nationId: 1,
      birthDate: '2004-03-01',
      position: 'ST',
      clubId: 1,
      ability: 150,
    });
    expect(res.statusCode).toBe(201);
    const p = res.json();
    expect(p).toMatchObject({
      origin: 'custom',
      lastName: 'Newman',
      position: 'ST',
      club: { id: 1 },
    });
    expect(Math.abs(p.ca - 150)).toBeLessThanOrEqual(4);
    expect(p.pa).toBeGreaterThanOrEqual(p.ca);
    expect(p.wage).toBeGreaterThan(0);
    expect(p.source).toBeNull();
  });

  it('uses explicit attributes and can create free agents', async () => {
    const res = await post(w('/players'), {
      lastName: 'Exact',
      nationId: 2,
      birthDate: '1999-01-01',
      position: 'GK',
      attributes: new Array(ATTRIBUTE_COUNT).fill(15),
    });
    const p = res.json();
    expect(p.club).toBeNull();
    expect(p.wage).toBeNull();
    expect(p.attributes.every((v: number) => v === 15)).toBe(true);
  });

  it('rejects impossible ages and unknown nations', async () => {
    expect(
      (
        await post(w('/players'), {
          lastName: 'Old',
          nationId: 1,
          birthDate: '1950-01-01',
          position: 'MC',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post(w('/players'), {
          lastName: 'Lost',
          nationId: 999,
          birthDate: '2000-01-01',
          position: 'MC',
        })
      ).statusCode,
    ).toBe(400);
  });
});

describe('editor: import can create entities', () => {
  it('creates players from rows without an id and reports bad rows', async () => {
    const header = [
      'id',
      'firstName',
      'lastName',
      'nationId',
      'birthDate',
      'position',
      'clubId',
      'ability',
      ...ATTRIBUTE_KEYS.slice(0, 2),
    ];
    const rows = [
      header,
      ['', 'Csv', 'Created', '1', '2001-05-05', 'DC', '3', '120', '', ''],
      ['', 'Half', 'Attributes', '1', '2001-05-05', 'DC', '3', '120', '12', '13'],
      ['', '', 'NoPosition', '1', '2001-05-05', '', '', '', '', ''],
    ];
    const res = await post(w('/import'), {
      entity: 'players',
      format: 'csv',
      content: toCsv(rows),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ created: 1, updated: 0 });
    expect(res.json().errors.map((e: { row: number }) => e.row)).toEqual([2, 3]);
    const found = (await get(w('/players?q=Created'))).json();
    expect(found.items[0]).toMatchObject({
      lastName: 'Created',
      origin: 'custom',
      club: { id: 3 },
    });
  });

  it('creates clubs from JSON rows without an id', async () => {
    const res = await post(w('/import'), {
      entity: 'clubs',
      format: 'json',
      content: JSON.stringify([
        {
          name: 'Json Town',
          code: 'JSN',
          primaryColor: '#000000',
          secondaryColor: '#ffffff',
          leagueId: 1,
        },
        { id: 99999, name: 'Ghost' },
      ]),
    });
    expect(res.json()).toMatchObject({ created: 1, updated: 0 });
    expect(res.json().errors[0].message).toMatch(/Unknown club id 99999/);
  });
});
