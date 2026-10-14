import type { Rng } from '../rng/rng';
import type { NamePool } from '../world/types';
import { FLAVOUR_DATA, type NameFlavour, words } from './flavours';

export interface PersonName {
  firstName: string;
  lastName: string;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Join two morphemes, dropping a doubled letter at the seam ("Berg" + "gaard" → "Bergaard"). */
function joinMorphemes(prefix: string, suffix: string): string {
  const lower = suffix.toLowerCase();
  if (prefix.slice(-1).toLowerCase() === lower.charAt(0)) return prefix + lower.slice(1);
  return prefix + lower;
}

export function generatePersonName(rng: Rng, flavour: NameFlavour): PersonName {
  const data = FLAVOUR_DATA[flavour];
  const firstName = rng.pick(words(data.firstNames));
  const lastName = rng.chance(0.25)
    ? rng.pick(words(data.surnames))
    : capitalise(
        joinMorphemes(rng.pick(words(data.surnamePrefixes)), rng.pick(words(data.surnameSuffixes))),
      );
  return { firstName, lastName };
}

export function generateTownName(rng: Rng, flavour: NameFlavour): string {
  const data = FLAVOUR_DATA[flavour];
  return capitalise(
    joinMorphemes(rng.pick(words(data.townPrefixes)), rng.pick(words(data.townSuffixes))),
  );
}

/** Generate `count` distinct town names for a nation. */
export function generateTownNames(rng: Rng, flavour: NameFlavour, count: number): string[] {
  const towns = new Set<string>();
  let guard = 0;
  while (towns.size < count) {
    towns.add(generateTownName(rng, flavour));
    if (++guard > count * 200) throw new Error(`Name pool too small for ${count} ${flavour} towns`);
  }
  return [...towns];
}

export function generateClubName(rng: Rng, flavour: NameFlavour, town: string): string {
  return rng.pick(FLAVOUR_DATA[flavour].clubPatterns).replace('{town}', town);
}

/** Up to three letters for scoreboards: initials of a multi-word town, else its first three. */
export function clubCode(town: string): string {
  const letters = town.normalize('NFD').replace(/[^\p{L}]/gu, '');
  return letters.slice(0, 3).toUpperCase();
}

/**
 * Name from a nation's own pool (built from that nationality's players in a real data pack).
 * First and last names are drawn independently, so results are new combinations; a combination
 * can coincide with a real person, which is why generated players are always marked generated.
 */
export function generateNameFromPool(rng: Rng, pool: NamePool): PersonName {
  return { firstName: rng.pick(pool.firstNames), lastName: rng.pick(pool.lastNames) };
}

/** Name for a player of a nation: its pool when it has one, otherwise its flavour. */
export function generateNationName(
  rng: Rng,
  nation: { flavour: NameFlavour; namePool: NamePool | null },
): PersonName {
  const pool = nation.namePool;
  return pool && pool.firstNames.length && pool.lastNames.length
    ? generateNameFromPool(rng, pool)
    : generatePersonName(rng, nation.flavour);
}
