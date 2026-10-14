/**
 * Seeded, deterministic pseudo-random number generator.
 *
 * Core algorithm: SFC32 (Small Fast Counting, 32-bit). It is fast, has a 128-bit state,
 * passes PractRand/BigCrush for our purposes, and only uses 32-bit integer math, so it
 * produces bit-identical sequences in Node and in every browser.
 *
 * Seeds may be numbers or strings. Strings are hashed with cyrb128 into the 128-bit state;
 * numbers are expanded with splitmix32. The full state is serialisable (`getState` /
 * `setState`) so a match can be replayed exactly from seed + inputs.
 */

export type RngSeed = number | string;

/** Serialisable RNG state: four unsigned 32-bit integers. */
export type RngState = readonly [number, number, number, number];

/** Hash an arbitrary string into four 32-bit words (cyrb128). */
export function hashString(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Expand a 32-bit number into four well-mixed words (splitmix32). */
function expandNumber(seed: number): [number, number, number, number] {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  return [next(), next(), next(), next()];
}

function seedToState(seed: RngSeed): [number, number, number, number] {
  if (typeof seed === 'string') return hashString(seed);
  if (!Number.isFinite(seed)) throw new RangeError(`Invalid RNG seed: ${seed}`);
  // Fold the high bits of large integers in so e.g. 2**32 and 0 differ.
  const folded = (Math.floor(seed) ^ Math.floor(seed / 4294967296)) >>> 0;
  return expandNumber(folded);
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: RngSeed) {
    [this.a, this.b, this.c, this.d] = seedToState(seed);
    // Warm up: discard the first outputs so similar seeds diverge quickly.
    for (let i = 0; i < 15; i++) this.nextUint32();
  }

  /** Restore an RNG from a previously captured state. */
  static fromState(state: RngState): Rng {
    const rng = new Rng(0);
    rng.setState(state);
    return rng;
  }

  /** Next raw unsigned 32-bit integer. */
  nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (both inclusive), without modulo bias. */
  int(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) throw new RangeError(`int(): empty range [${min}, ${max}]`);
    const range = hi - lo + 1;
    if (range > 4294967296) throw new RangeError('int(): range exceeds 2^32');
    // Rejection sampling to remove modulo bias.
    const limit = 4294967296 - (4294967296 % range);
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return lo + (x % range);
  }

  /** True with probability p (clamped to [0, 1]). */
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }

  /**
   * Normally distributed value (Box-Muller). The paired value is intentionally discarded
   * so that `getState()` always captures the complete generator state.
   */
  normal(mean = 0, stdDev = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Normal value clamped to [min, max]. */
  normalClamped(mean: number, stdDev: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, this.normal(mean, stdDev)));
  }

  /** Pick a uniformly random element. Throws on empty arrays. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick(): empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Pick an element with probability proportional to its weight. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new RangeError('weighted(): items and weights must be non-empty and equal length');
    }
    let total = 0;
    for (const w of weights) {
      if (w < 0 || !Number.isFinite(w)) throw new RangeError('weighted(): invalid weight');
      total += w;
    }
    if (total <= 0) throw new RangeError('weighted(): weights sum to zero');
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Fisher-Yates shuffle into a new array (input is not mutated). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /**
   * Derive an independent child RNG for a named sub-system (e.g. "match:123").
   * The child depends on this RNG's current state and the label, and advances the parent
   * by exactly one step, so adding forks elsewhere doesn't shift unrelated streams.
   */
  fork(label: string): Rng {
    const salt = this.nextUint32();
    return new Rng(`${label}#${salt}#${this.a}#${this.d}`);
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(state: RngState): void {
    if (state.length !== 4 || state.some((n) => !Number.isInteger(n))) {
      throw new RangeError('setState(): state must be four integers');
    }
    [this.a, this.b, this.c, this.d] = [state[0] | 0, state[1] | 0, state[2] | 0, state[3] | 0];
  }
}

export function createRng(seed: RngSeed): Rng {
  return new Rng(seed);
}
