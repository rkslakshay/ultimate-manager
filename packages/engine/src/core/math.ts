export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Round to the nearest integer and clamp into [min, max]. */
export const roundClamp = (value: number, min: number, max: number): number =>
  clamp(Math.round(value), min, max);

/** Round to a "nice" figure for money: 2 significant digits above 10k, 3 below. */
export function roundMoney(value: number): number {
  if (value <= 0) return 0;
  const digits = value >= 10_000 ? 2 : 3;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - (digits - 1));
  return Math.round(value / magnitude) * magnitude;
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function mean(values: readonly number[]): number {
  return values.length ? sum(values) / values.length : 0;
}
