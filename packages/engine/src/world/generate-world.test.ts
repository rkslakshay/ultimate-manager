import { beforeAll, describe, expect, it } from 'vitest';
import { ageOn } from '../core/date';
import { mean } from '../core/math';
import { currentAbility } from '../players/ability';
import { ATTRIBUTE_COUNT, HIDDEN_KEYS } from '../players/attributes';
import { P, POSITION_COUNT, POSITION_GROUP, POSITIONS } from '../players/positions';
import { generateWorld } from './generate-world';
import type { WorldState } from './types';

let world: WorldState;
let elapsedMs = 0;

beforeAll(() => {
  const t0 = performance.now();
  world = generateWorld('test-seed');
  elapsedMs = performance.now() - t0;
});

const signed = () => world.players.filter((p) => p.clubId !== null);
const percentile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * q)]!;
};

describe('generateWorld', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(generateWorld('test-seed')).toEqual(world);
    const other = generateWorld('another-seed');
    expect(other.clubs.map((c) => c.name)).not.toEqual(world.clubs.map((c) => c.name));
  });

  it('is fast enough to run when a save is created', () => {
    expect(elapsedMs).toBeLessThan(3000);
  });

  it('builds 3 playable nations with two divisions of 16-20 clubs each', () => {
    const leagues = world.competitions.filter((c) => c.kind === 'league');
    expect(world.nations.filter((n) => n.playable)).toHaveLength(3);
    expect(leagues).toHaveLength(6);
    for (const league of leagues) {
      expect(league.clubIds.length).toBeGreaterThanOrEqual(16);
      expect(league.clubIds.length).toBeLessThanOrEqual(20);
    }
    expect(world.competitions.filter((c) => c.kind === 'cup')).toHaveLength(3);
    expect(world.nations.length).toBeGreaterThanOrEqual(8);
  });

  it('has unique, well-formed ids and references', () => {
    for (const list of [
      world.nations,
      world.competitions,
      world.clubs,
      world.stadiums,
      world.players,
    ]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const clubIds = new Set(world.clubs.map((c) => c.id));
    const stadiumIds = new Set(world.stadiums.map((s) => s.id));
    for (const club of world.clubs) expect(stadiumIds.has(club.stadiumId)).toBe(true);
    for (const p of world.players) if (p.clubId !== null) expect(clubIds.has(p.clubId)).toBe(true);
    // Club names are unique within the world.
    expect(new Set(world.clubs.map((c) => c.name)).size).toBe(world.clubs.length);
  });

  it('generates roughly 3,000+ players with valid attributes', () => {
    expect(world.players.length).toBeGreaterThanOrEqual(3000);
    for (const p of world.players) {
      expect(p.attributes).toHaveLength(ATTRIBUTE_COUNT);
      expect(p.hidden).toHaveLength(HIDDEN_KEYS.length);
      expect(p.positions).toHaveLength(POSITION_COUNT);
      expect(p.positions[p.primaryPosition]).toBe(20);
      for (const v of [...p.attributes, ...p.hidden, ...p.positions]) {
        expect(Number.isInteger(v) && v >= 1 && v <= 20).toBe(true);
      }
      expect(p.ca).toBe(currentAbility(p.attributes, p.primaryPosition));
      expect(p.pa).toBeGreaterThanOrEqual(p.ca);
      expect(p.pa).toBeLessThanOrEqual(200);
      expect(p.firstName.length).toBeGreaterThan(1);
      expect(p.lastName.length).toBeGreaterThan(1);
    }
  });

  it('has realistic age, ability and squad distributions', () => {
    const ages = signed().map((p) => ageOn(p.birthDay, world.startDay));
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...ages)).toBeLessThanOrEqual(38);
    expect(mean(ages)).toBeGreaterThan(24);
    expect(mean(ages)).toBeLessThan(27.5);

    const cas = world.players.map((p) => p.ca);
    expect(percentile(cas, 0.5)).toBeGreaterThan(70);
    expect(percentile(cas, 0.5)).toBeLessThan(120);
    expect(Math.max(...cas)).toBeGreaterThan(150);
    expect(Math.max(...cas)).toBeLessThanOrEqual(195);

    // Every club can field a full side: at least 2 GKs and enough in each line.
    for (const club of world.clubs) {
      const squad = world.players.filter((p) => p.clubId === club.id);
      expect(squad.length).toBeGreaterThanOrEqual(24);
      const groups = squad.map((p) => POSITION_GROUP[POSITIONS[p.primaryPosition]!]);
      expect(groups.filter((g) => g === 'GK').length).toBeGreaterThanOrEqual(2);
      expect(groups.filter((g) => g === 'DEF').length).toBeGreaterThanOrEqual(7);
      expect(groups.filter((g) => g === 'MID').length).toBeGreaterThanOrEqual(5);
      expect(groups.filter((g) => g === 'ATT').length).toBeGreaterThanOrEqual(5);
    }
  });

  it('makes bigger clubs stronger and richer', () => {
    const sortedClubs = [...world.clubs].sort((a, b) => b.reputation - a.reputation);
    const avgCa = (clubId: number) =>
      mean(world.players.filter((p) => p.clubId === clubId).map((p) => p.ca));
    const top = sortedClubs.slice(0, 10);
    const bottom = sortedClubs.slice(-10);
    expect(mean(top.map((c) => avgCa(c.id)))).toBeGreaterThan(
      mean(bottom.map((c) => avgCa(c.id))) + 40,
    );
    expect(mean(top.map((c) => c.balance))).toBeGreaterThan(
      mean(bottom.map((c) => c.balance)) * 10,
    );
  });

  it('gives contracts, wages and values that scale with ability', () => {
    for (const p of signed()) {
      expect(p.contract).not.toBeNull();
      expect(p.contract!.wage).toBeGreaterThan(0);
      expect(p.contract!.endDay).toBeGreaterThan(world.startDay);
      expect(p.value).toBeGreaterThan(0);
    }
    const free = world.players.filter((p) => p.clubId === null);
    expect(free.length).toBeGreaterThan(100);
    for (const p of free) expect(p.contract).toBeNull();

    const best = [...signed()].sort((a, b) => b.ca - a.ca).slice(0, 20);
    const worst = [...signed()].sort((a, b) => a.ca - b.ca).slice(0, 20);
    expect(mean(best.map((p) => p.contract!.wage))).toBeGreaterThan(
      mean(worst.map((p) => p.contract!.wage)) * 20,
    );
    expect(mean(best.map((p) => p.value))).toBeGreaterThan(5_000_000);
  });

  it('keeps players mostly domestic with some foreigners', () => {
    const club = world.clubs[0]!;
    const all = signed().filter(
      (p) => world.clubs.find((c) => c.id === p.clubId)!.nationId === club.nationId,
    );
    const domestic = all.filter((p) => p.nationId === club.nationId).length / all.length;
    expect(domestic).toBeGreaterThan(0.55);
    expect(domestic).toBeLessThan(0.95);
  });

  it('gives goalkeepers goalkeeping attributes and outfielders not', () => {
    const gks = world.players.filter((p) => p.primaryPosition === P.GK);
    const outfield = world.players.filter((p) => p.primaryPosition !== P.GK);
    expect(gks.length).toBeGreaterThan(200);
    expect(outfield.every((p) => p.positions[P.GK] === 1)).toBe(true);
  });
});
