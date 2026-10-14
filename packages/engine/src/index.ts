export { Rng, createRng, hashString } from './rng/rng';
export type { RngSeed, RngState } from './rng/rng';
export { ENGINE_VERSION } from './version';

export * from './core/date';
export * from './core/math';

export * from './players/attributes';
export * from './players/positions';
export * from './players/ability';
export { TRAITS, pickTraits, type TraitId } from './players/traits';
export { generatePlayer, type PlayerSpec } from './players/generate-player';

export * from './economy/value';

export { NAME_FLAVOURS, type NameFlavour } from './names/flavours';
export {
  generateNameFromPool,
  generateNationName,
  generatePersonName,
  clubCode,
} from './names/generate';

export type * from './world/types';
export { DEFAULT_NATIONS, type NationDefinition } from './world/nations';
export {
  generateWorld,
  WORLD_SCHEMA_VERSION,
  DEFAULT_START_DATE,
  type GenerateWorldOptions,
} from './world/generate-world';
export { seasonEndDay, squadAbilityFor } from './world/squads';
export * from './economy/value-model';

export * from './development/curves';
export * from './development/progression';
export * from './development/lifecycle';
export * from './development/headless';
