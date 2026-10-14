import type { TraitId } from '@um/engine';

/**
 * Source trait text → our traits, by keyword (source wording varies between releases).
 * Source traits with no counterpart are ignored and counted in the report.
 */
const RULES: [RegExp, TraitId][] = [
  [/long\s*shot/i, 'shootsFromDistance'],
  [/flair/i, 'triesTricks'],
  [/technical\s*dribbler|speed\s*dribbler/i, 'runsWithBallOften'],
  [/playmaker|long\s*passer/i, 'triesKillerBalls'],
  [/finesse\s*shot/i, 'placesShots'],
  [/power\s*free|power\s*shot/i, 'powersShots'],
  [/outside\s*foot/i, 'triesTricks'],
  [/dives\s*into\s*tackles/i, 'divesIntoTackles'],
  [/rushes\s*out|sweeper/i, 'comesForCrosses'],
];

export interface MappedTraits {
  traits: TraitId[];
  unmapped: string[];
}

export function mapTraits(source: readonly string[]): MappedTraits {
  const traits = new Set<TraitId>();
  const unmapped: string[] = [];
  for (const raw of source) {
    // "One Club Player" / "Leadership" are personality cues, not on-ball habits: ignore them.
    if (/one\s*club|leadership/i.test(raw)) {
      unmapped.push(raw);
      continue;
    }
    const rule = RULES.find(([re]) => re.test(raw));
    if (rule) traits.add(rule[1]);
    else unmapped.push(raw);
  }
  return { traits: [...traits].slice(0, 4), unmapped };
}
