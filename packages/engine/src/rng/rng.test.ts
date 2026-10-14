import { describe, expect, it } from 'vitest';
import { Rng, createRng, hashString } from './rng';

const take = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => rng.nextUint32());

describe('Rng determinism', () => {
  it('produces identical sequences for identical seeds', () => {
    expect(take(createRng(42), 100)).toEqual(take(createRng(42), 100));
    expect(take(createRng('season-2026'), 100)).toEqual(take(createRng('season-2026'), 100));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(createRng(1), 10)).not.toEqual(take(createRng(2), 10));
    expect(take(createRng('a'), 10)).not.toEqual(take(createRng('b'), 10));
    // Large integers differing only above 2^32 must still differ.
    expect(take(createRng(0), 5)).not.toEqual(take(createRng(2 ** 32), 5));
  });

  it('matches a pinned reference sequence (guards against accidental algorithm changes)', () => {
    const rng = createRng('ultimate-manager');
    const first = take(rng, 5);
    // Regenerate deliberately (and bump ENGINE_VERSION) if the algorithm changes.
    expect(first).toMatchInlineSnapshot(`
      [
        4016019777,
        2701319761,
        2021107869,
        3932318511,
        2379908887,
      ]
    `);
  });

  it('round-trips state for exact replay', () => {
    const rng = createRng('replay');
    take(rng, 37);
    rng.normal();
    const state = rng.getState();
    const expected = [rng.next(), rng.int(1, 20), rng.normal(), rng.pick(['a', 'b', 'c'])];
    const restored = Rng.fromState(state);
    expect([
      restored.next(),
      restored.int(1, 20),
      restored.normal(),
      restored.pick(['a', 'b', 'c']),
    ]).toEqual(expected);
  });

  it('rejects invalid seeds and state', () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
    expect(() =>
      createRng(0).setState([1, 2, 3] as unknown as [number, number, number, number]),
    ).toThrow();
  });
});

describe('Rng ranges and distributions', () => {
  it('next() stays within [0, 1) and has mean ~0.5', () => {
    const rng = createRng(7);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it('int() is inclusive and roughly uniform (chi-square)', () => {
    const rng = createRng('dice');
    const counts = new Array<number>(20).fill(0);
    const n = 200_000;
    for (let i = 0; i < n; i++) {
      const v = rng.int(1, 20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
      counts[v - 1]! += 1;
    }
    const expected = n / 20;
    const chi2 = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
    // 19 degrees of freedom: p=0.001 critical value is ~43.8.
    expect(chi2).toBeLessThan(43.8);
  });

  it('int() handles single-value and rejects empty ranges', () => {
    const rng = createRng(1);
    expect(rng.int(5, 5)).toBe(5);
    expect(() => rng.int(6, 5)).toThrow(RangeError);
  });

  it('chance() matches its probability', () => {
    const rng = createRng(99);
    let hits = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) if (rng.chance(0.27)) hits++;
    expect(hits / n).toBeCloseTo(0.27, 2);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it('normal() has the requested mean and standard deviation', () => {
    const rng = createRng('gauss');
    const n = 100_000;
    const values = Array.from({ length: n }, () => rng.normal(10, 2));
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    expect(mean).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
  });

  it('normalClamped() respects bounds', () => {
    const rng = createRng(3);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.normalClamped(10, 10, 1, 20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it('weighted() follows weights and never picks zero-weight items', () => {
    const rng = createRng('weights');
    const counts = { a: 0, b: 0, c: 0 };
    const n = 60_000;
    for (let i = 0; i < n; i++) counts[rng.weighted(['a', 'b', 'c'] as const, [1, 2, 0])]++;
    expect(counts.c).toBe(0);
    expect(counts.b / n).toBeCloseTo(2 / 3, 2);
    expect(() => rng.weighted(['a'], [0])).toThrow(RangeError);
    expect(() => rng.weighted(['a', 'b'], [1])).toThrow(RangeError);
  });

  it('shuffle() returns a permutation without mutating input', () => {
    const rng = createRng(5);
    const input = Array.from({ length: 50 }, (_, i) => i);
    const copy = input.slice();
    const out = rng.shuffle(input);
    expect(input).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(out).not.toEqual(input);
  });

  it('pick() rejects empty arrays', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });
});

describe('Rng forking', () => {
  it('forks are deterministic and independent of each other', () => {
    const p1 = createRng('world');
    const p2 = createRng('world');
    const a1 = p1.fork('match:1');
    const a2 = p2.fork('match:1');
    expect(take(a1, 20)).toEqual(take(a2, 20));
    const b = createRng('world').fork('match:2');
    expect(take(createRng('world').fork('match:1'), 20)).not.toEqual(take(b, 20));
  });

  it('consuming a fork does not affect the parent stream', () => {
    const p1 = createRng('parent');
    const p2 = createRng('parent');
    const child = p1.fork('x');
    take(child, 1000);
    p2.fork('x');
    expect(take(p1, 10)).toEqual(take(p2, 10));
  });
});

describe('hashString', () => {
  it('is stable and returns unsigned 32-bit words', () => {
    const h = hashString('hello');
    expect(h).toEqual(hashString('hello'));
    for (const w of h) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(2 ** 32);
    }
    expect(hashString('hello')).not.toEqual(hashString('hellp'));
  });
});
