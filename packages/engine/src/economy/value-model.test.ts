import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { fitValueModel, modelValue, type ValueModel } from './value-model';

const TRUE: ValueModel = {
  intercept: 4,
  ca: 0.075,
  age: -0.06,
  age2: -0.012,
  upside: 0.02,
  contract: 0.12,
  reputation: 0.01,
};

function sample(n: number, noise: number) {
  const rng = createRng('value-fit');
  return Array.from({ length: n }, () => {
    const ca = rng.int(60, 190);
    const f = {
      ca,
      pa: ca + rng.int(0, 40),
      age: rng.int(17, 36),
      contractYearsLeft: rng.float(0, 5),
      clubReputation: rng.int(20, 95),
    };
    return { ...f, value: modelValue(TRUE, f) * Math.exp(rng.normal(0, noise)) };
  });
}

describe('value model', () => {
  it('recovers known coefficients from noisy synthetic data', () => {
    const fit = fitValueModel(sample(3000, 0.15))!;
    expect(fit.r2).toBeGreaterThan(0.95);
    expect(fit.model.ca).toBeCloseTo(TRUE.ca, 2);
    expect(fit.model.contract).toBeCloseTo(TRUE.contract, 1);
    expect(fit.medianAbsPctError).toBeLessThan(0.15);
  });

  it('values rise with ability and contract length and fall for veterans', () => {
    const base = { ca: 140, pa: 150, age: 26, contractYearsLeft: 3, clubReputation: 70 };
    expect(modelValue(TRUE, { ...base, ca: 160 })).toBeGreaterThan(modelValue(TRUE, base));
    expect(modelValue(TRUE, { ...base, contractYearsLeft: 0.5 })).toBeLessThan(
      modelValue(TRUE, base),
    );
    expect(modelValue(TRUE, { ...base, age: 34 })).toBeLessThan(modelValue(TRUE, base));
  });

  it('refuses to fit tiny or degenerate samples', () => {
    expect(fitValueModel(sample(10, 0.1))).toBeNull();
    expect(fitValueModel(sample(100, 0.1).map((s) => ({ ...s, value: 0 })))).toBeNull();
  });
});
