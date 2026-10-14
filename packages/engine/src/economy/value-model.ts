import { roundMoney } from '../core/math';

/**
 * Log-linear market value model, fitted to real valuations when a data pack has them:
 *   ln(value) = intercept + ca·CA + age·(age−26) + age2·(age−26)² + upside·max(0, PA−CA)
 *               + contract·min(yearsLeft, 4) + reputation·clubReputation
 * Values are in the pack's base currency (EUR). This estimates what a player is *worth*; it is
 * not an asking price or a transfer fee (those are separate concepts, see DECISIONS).
 */
export interface ValueModel {
  intercept: number;
  ca: number;
  age: number;
  age2: number;
  upside: number;
  contract: number;
  reputation: number;
}

export interface ValueFeatures {
  ca: number;
  pa: number;
  age: number;
  contractYearsLeft: number;
  clubReputation: number;
}

const features = (f: ValueFeatures): number[] => [
  1,
  f.ca,
  f.age - 26,
  (f.age - 26) ** 2,
  Math.max(0, f.pa - f.ca),
  Math.min(Math.max(f.contractYearsLeft, 0), 4),
  f.clubReputation,
];

export function modelValue(model: ValueModel, f: ValueFeatures): number {
  const x = features(f);
  const c = [
    model.intercept,
    model.ca,
    model.age,
    model.age2,
    model.upside,
    model.contract,
    model.reputation,
  ];
  const ln = x.reduce((acc, v, i) => acc + v * c[i]!, 0);
  return roundMoney(Math.exp(Math.min(ln, 25)));
}

export interface ValueFit {
  model: ValueModel;
  /** Coefficient of determination on ln(value). */
  r2: number;
  /** Median absolute percentage error on value. */
  medianAbsPctError: number;
  samples: number;
}

/** Ordinary least squares on ln(value) (ridge-stabilised so tiny samples can't blow up). */
export function fitValueModel(samples: (ValueFeatures & { value: number })[]): ValueFit | null {
  const rows = samples.filter((s) => s.value > 0);
  if (rows.length < 30) return null;
  const k = 7;
  const xtx = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  for (const s of rows) {
    const x = features(s);
    const y = Math.log(s.value);
    for (let i = 0; i < k; i++) {
      xty[i]! += x[i]! * y;
      for (let j = 0; j < k; j++) xtx[i]![j]! += x[i]! * x[j]!;
    }
  }
  for (let i = 1; i < k; i++) xtx[i]![i]! += 1e-3 * rows.length; // light ridge (not on intercept)
  const c = solve(xtx, xty);
  if (!c) return null;
  const model: ValueModel = {
    intercept: c[0]!,
    ca: c[1]!,
    age: c[2]!,
    age2: c[3]!,
    upside: c[4]!,
    contract: c[5]!,
    reputation: c[6]!,
  };
  const ys = rows.map((s) => Math.log(s.value));
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  const pct: number[] = [];
  rows.forEach((s, i) => {
    const pred = features(s).reduce((acc, v, j) => acc + v * c[j]!, 0);
    ssRes += (ys[i]! - pred) ** 2;
    ssTot += (ys[i]! - mean) ** 2;
    pct.push(Math.abs(Math.exp(pred) - s.value) / s.value);
  });
  pct.sort((a, b) => a - b);
  return {
    model,
    r2: ssTot ? 1 - ssRes / ssTot : 0,
    medianAbsPctError: pct[Math.floor(pct.length / 2)] ?? 0,
    samples: rows.length,
  };
}

/** Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}
