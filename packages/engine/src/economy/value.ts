import { clamp, roundMoney } from '../core/math';

export interface ValueInput {
  ca: number;
  pa: number;
  age: number;
  /** Years left on contract (0 when out of contract). */
  contractYearsLeft: number;
  /** Reputation (1-100) of the player's current club or league context. */
  reputation: number;
}

function ageFactor(age: number, ca: number, pa: number): number {
  const upside = Math.max(0, pa - ca);
  if (age <= 21) return 1 + upside / 55;
  if (age <= 24) return 1 + upside / 90;
  if (age <= 27) return 1;
  if (age <= 29) return 0.82;
  if (age <= 31) return 0.6;
  if (age <= 33) return 0.38;
  return 0.2;
}

/** Estimated transfer value. Exponential in ability: elite players are worth vastly more. */
export function marketValue({ ca, pa, age, contractYearsLeft, reputation }: ValueInput): number {
  const base = 900 * Math.exp(ca / 16.5);
  const contract =
    contractYearsLeft <= 0 ? 0.35 : contractYearsLeft < 1 ? 0.65 : contractYearsLeft < 2 ? 0.85 : 1;
  const prestige = 0.7 + clamp(reputation, 1, 100) / 220;
  return roundMoney(base * ageFactor(age, ca, pa) * contract * prestige);
}

/** Weekly wage a player of this ability/age would expect at a club of this reputation. */
export function expectedWage(ca: number, age: number, clubReputation: number): number {
  const base = 32 * Math.exp(ca / 23);
  const veteran = age >= 32 ? 0.85 : 1;
  const youth = age <= 19 ? 0.6 : 1;
  const club = clamp(0.35 + clubReputation / 75, 0.4, 1.6);
  return Math.max(150, roundMoney(base * veteran * youth * club));
}
