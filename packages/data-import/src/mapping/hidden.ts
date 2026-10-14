/**
 * Hidden attributes (consistency, injury proneness, professionalism, …). No supported source
 * provides them, so they are DERIVED: drawn from a generator seeded by the player's stable
 * source key (identical on every re-import), with correlations documented here:
 *   consistency        ↑ with overall rating (better players are steadier)
 *   injuryProneness    random; forced high when the source lists an injury-prone trait (S)
 *   importantMatches   ↑ with composure
 *   versatility        ↑ with the number of positions the source lists
 *   professionalism    ↑ with determination
 *   ambition           ↑ with international reputation
 *   loyalty, sportsmanship, adaptability: random around the population mean
 *   temperament        ↓ with aggression
 *   pressure           ↑ with composure
 */
import { A, H, HIDDEN_KEYS, roundClamp, type Rng } from '@um/engine';

export interface HiddenInput {
  rng: Rng;
  attributes: readonly number[];
  overall: number;
  positionsListed: number;
  internationalReputation: number | null;
  traits: readonly string[];
}

export interface MappedHidden {
  hidden: number[];
  /** One character per HIDDEN_KEYS entry: 'S' or 'D'. */
  origin: string;
}

export function deriveHidden({
  rng,
  attributes,
  overall,
  positionsListed,
  internationalReputation,
  traits,
}: HiddenInput): MappedHidden {
  const a = (i: number) => attributes[i] ?? 10;
  const hidden = HIDDEN_KEYS.map(() => 10);
  const origin = HIDDEN_KEYS.map(() => 'D');
  hidden[H.consistency] = rng.normal(8 + (overall - 55) / 6, 3);
  hidden[H.injuryProneness] = rng.normal(9, 4);
  hidden[H.importantMatches] = (a(A.composure) + rng.normal(10, 3)) / 2;
  hidden[H.versatility] = rng.normal(7 + positionsListed * 2.5, 3);
  hidden[H.professionalism] = (a(A.determination) + rng.normal(11, 3.5)) / 2 + rng.normal(0, 1.5);
  hidden[H.ambition] = rng.normal(9 + (internationalReputation ?? 1) * 1.2, 3.5);
  hidden[H.loyalty] = rng.normal(10, 4);
  hidden[H.temperament] = rng.normal(15 - a(A.aggression) * 0.35, 3);
  hidden[H.pressure] = (a(A.composure) + rng.normal(10, 3)) / 2;
  hidden[H.sportsmanship] = rng.normal(12, 3.5);
  hidden[H.adaptability] = rng.normal(11, 3.5);
  if (traits.some((t) => /injury\s*prone/i.test(t))) {
    hidden[H.injuryProneness] = rng.int(16, 19);
    origin[H.injuryProneness] = 'S';
  }
  if (traits.some((t) => /solid player/i.test(t))) {
    hidden[H.injuryProneness] = rng.int(2, 5);
    origin[H.injuryProneness] = 'S';
  }
  return { hidden: hidden.map((v) => roundClamp(v, 1, 20)), origin: origin.join('') };
}
