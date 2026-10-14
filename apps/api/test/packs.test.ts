import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runImport } from '@um/data-import';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerUser, type TestContext } from './helpers';

const REPO = path.resolve(import.meta.dirname, '..', '..', '..');
const FIXTURES = path.join(REPO, 'data-packs', 'fixtures', 'sample', 'data');
const FIXTURE_CONFIG = path.join(REPO, 'data-packs', 'fixtures', 'sample', 'import.json');

let root: string;
let ctx: TestContext;
let cookies: Record<string, string>;

const get = (url: string) => ctx.app.inject({ method: 'GET', url, cookies });
const createSave = (payload: object) =>
  ctx.app.inject({ method: 'POST', url: '/api/saves', cookies, payload });

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-packs-'));
  const ok = await runImport({
    pack: 'sample',
    root,
    sourceDir: FIXTURES,
    configFile: FIXTURE_CONFIG,
    quiet: true,
  });
  expect(ok).toBe(true);
  ctx = await createTestApp({ DATA_PACKS_DIR: root });
  ({ cookies } = await registerUser(ctx.app));
}, 120_000);
afterAll(async () => {
  await ctx.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('data packs', () => {
  it('lists the fictional generator and installed packs', async () => {
    const res = await get('/api/packs');
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.map((p: { id: string }) => p.id)).toEqual(['fictional', 'sample']);
    expect(items[1].summary.leagues).toHaveLength(3);
    expect(items[1].version).toMatch(/^v[0-9a-f]{12}$/);
  });

  it('rejects unknown packs', async () => {
    const res = await createSave({ name: 'X', managerName: 'Tester', dataPack: 'nope' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.fieldErrors.dataPack).toBeDefined();
  });

  it('creates a save from a pack quickly and records the pack and version', async () => {
    const started = Date.now();
    const res = await createSave({
      name: 'Sample career',
      managerName: 'Tester',
      dataPack: 'sample',
    });
    const ms = Date.now() - started;
    expect(res.statusCode).toBe(201);
    const save = res.json();
    const pack = (await get('/api/packs'))
      .json()
      .items.find((p: { id: string }) => p.id === 'sample');
    // The career starts on the pack's start date (inferred from the data's newest season).
    expect(save).toMatchObject({ dataPack: 'sample', hasWorld: true, gameDate: pack.startDate });
    expect(save.packVersion).toMatch(/^v/);
    expect(ms).toBeLessThan(5000);

    const overview = (await get(`/api/saves/${save.id}/world/overview`)).json();
    expect(
      overview.competitions
        .filter((c: { kind: string }) => c.kind === 'league')
        .map((c: { name: string }) => c.name)
        .sort(),
    ).toEqual(['Northland Championship', 'Northland Premier', 'Southmoor Liga']);
  });

  it('serves imported players with provenance and their real history; generated players have none', async () => {
    const save = (
      await createSave({ name: 'History', managerName: 'Tester', dataPack: 'sample' })
    ).json();
    const w = (p: string) => `/api/saves/${save.id}/world${p}`;
    const comp = (await get(w('/competitions/1'))).json();
    const club = (await get(w(`/clubs/${comp.clubs[0].id}`))).json();
    expect(club.origin).toBe('imported');
    expect(club.founded).toBeNull();
    expect(club.sourceFields.reputation).toBe('derived');
    const imported = club.squad.filter((p: { origin: string }) => p.origin === 'imported');
    const generated = club.squad.filter((p: { origin: string }) => p.origin === 'generated');
    expect(imported.length).toBeGreaterThan(10);
    expect(generated.length).toBeGreaterThan(0);

    // Find an imported player with transfer history.
    let found: {
      transfers: { feeStatus: string; feeEur: number | null }[];
      valuations: unknown[];
    } | null = null;
    for (const p of imported) {
      const h = (await get(w(`/players/${p.id}/history`))).json();
      if (h.transfers.length) {
        found = h;
        const detail = (await get(w(`/players/${p.id}`))).json();
        expect(detail.source.key).toMatch(/^ea:\d+\|tm:\d+$/);
        expect(detail.source.fields.birthDay).toBe('source_backed');
        expect(detail.source.attributeOrigin).toHaveLength(detail.attributes.length);
        break;
      }
    }
    expect(found).not.toBeNull();
    expect(found!.valuations.length).toBeGreaterThan(0);
    for (const t of found!.transfers) if (t.feeStatus === 'unknown') expect(t.feeEur).toBeNull();

    const gen = (await get(w(`/players/${generated[0].id}/history`))).json();
    expect(gen).toMatchObject({ transfers: [], valuations: [] });
    expect((await get(w(`/players/${generated[0].id}`))).json().source).toBeNull();
  });

  it('never changes an existing save when the pack is re-imported', async () => {
    const before = (
      await createSave({ name: 'Old version', managerName: 'Tester', dataPack: 'sample' })
    ).json();
    const players = async (saveId: string) =>
      (await get(`/api/saves/${saveId}/world/players?pageSize=200&sort=name&order=asc`)).json();
    const snapshot = await players(before.id);

    // A newer dataset: drop some ratings rows and re-import.
    const changed = path.join(root, 'changed');
    fs.cpSync(FIXTURES, changed, { recursive: true });
    const ratings = path.join(changed, 'ratings', 'players.csv');
    const lines = fs.readFileSync(ratings, 'utf8').split(/\r?\n/);
    fs.writeFileSync(
      ratings,
      [lines[0], ...lines.slice(1).filter((_, i) => i % 40 !== 3)].join('\n'),
    );
    expect(
      await runImport({
        pack: 'sample',
        root,
        sourceDir: changed,
        configFile: FIXTURE_CONFIG,
        quiet: true,
      }),
    ).toBe(true);
    const fresh = await createTestApp({ DATA_PACKS_DIR: root });
    try {
      const reloaded = (
        await fresh.app.inject({ method: 'GET', url: `/api/saves/${before.id}`, cookies })
      ).json();
      expect(reloaded.packVersion).toBe(before.packVersion);
      const after = (
        await fresh.app.inject({
          method: 'GET',
          url: `/api/saves/${before.id}/world/players?pageSize=200&sort=name&order=asc`,
          cookies,
        })
      ).json();
      expect(after.total).toBe(snapshot.total);
      expect(after.items).toEqual(snapshot.items);

      const newer = (
        await fresh.app.inject({
          method: 'POST',
          url: '/api/saves',
          cookies,
          payload: { name: 'New version', managerName: 'Tester', dataPack: 'sample' },
        })
      ).json();
      expect(newer.packVersion).not.toBe(before.packVersion);
      expect(
        (
          await fresh.app.inject({
            method: 'GET',
            url: `/api/saves/${newer.id}/world/players?pageSize=1`,
            cookies,
          })
        ).json().total,
      ).toBeLessThan(snapshot.total);
    } finally {
      await fresh.close();
    }
  });

  it("serves the user's own crest images and nothing else", async () => {
    const dir = path.join(root, 'assets', 'crests');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'example-club.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const ok = await get('/api/assets/crests/example-club');
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('image/png');
    expect((await get('/api/assets/crests/missing-club')).statusCode).toBe(404);
    expect((await get('/api/assets/crests/..%2F..%2Fsecret')).statusCode).toBe(400);
  });
});
