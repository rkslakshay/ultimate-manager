import fs from 'node:fs';
import { z } from 'zod';

/**
 * Optional per-pack import configuration (data-packs/config/import.json for the real pack).
 * Everything has a documented default; nothing here is required to run an import.
 * Real-world facts the datasets lack (promotion counts, league countries) can be supplied here
 * by the user; otherwise the importer uses labelled simulation defaults.
 */
const leagueRule = z.object({
  /** Override or supply the league's tier (1 = top). */
  tier: z.number().int().min(1).max(10).optional(),
  /** Country the league belongs to (when the data can't tell). */
  nation: z.string().min(1).optional(),
  promotionPlaces: z.number().int().min(0).max(10).optional(),
  relegationPlaces: z.number().int().min(0).max(10).optional(),
  /** Exclude this league from the pack. */
  exclude: z.boolean().optional(),
});

export const importConfigSchema = z.object({
  /** Career start date for the pack (ISO). Default: inferred from the newest valuation date. */
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Only include leagues with at least this many clubs present in the data. */
  minClubsPerLeague: z.number().int().min(2).default(8),
  /** When set, only these leagues (by source name) are included. */
  includeLeagues: z.array(z.string()).optional(),
  /** Keyed by source league name. */
  leagues: z.record(z.string(), leagueRule).default({}),
  /** Which source decides a player's current club when sources disagree. */
  primaryClubSource: z.enum(['ea', 'tm']).default('ea'),
  /** Include players that have no ratings source (attributes fully derived). Default false. */
  includeUnrated: z.boolean().default(false),
  /** Generated players are added to clubs with fewer than this many real players. */
  minSquadSize: z.number().int().min(16).max(30).default(20),
  /** Generated free agents added to the world (the data has no unattached players). */
  generatedFreeAgents: z.number().int().min(0).max(1000).default(80),
  /** Extra club name aliases: ratings-source name → Transfermarkt-style name. */
  clubAliases: z.record(z.string(), z.string()).default({}),
  identity: z
    .object({
      /** Manually approved player matches (ratings id ↔ Transfermarkt id). */
      approve: z.array(z.object({ ea: z.string(), tm: z.string() })).default([]),
      /** Pairs that must never be matched. */
      reject: z.array(z.object({ ea: z.string(), tm: z.string() })).default([]),
    })
    .default({ approve: [], reject: [] }),
  /** Exchange rates to EUR for sources declaring another currency, e.g. { "GBP": 1.17 }. */
  fxRatesToEur: z.record(z.string(), z.number().positive()).default({}),
  /** Currency of each source (both supported sources publish EUR columns). */
  sourceCurrency: z
    .object({ ea: z.string().default('EUR'), tm: z.string().default('EUR') })
    .default({ ea: 'EUR', tm: 'EUR' }),
});
export type ImportConfig = z.infer<typeof importConfigSchema>;

export function loadImportConfig(file: string | null): ImportConfig {
  if (!file || !fs.existsSync(file)) return importConfigSchema.parse({});
  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parsed = importConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid import config ${file}:\n${issues}`);
  }
  return parsed.data;
}

/** Convert an amount in `currency` to EUR, or throw if no rate is configured. */
export function toEur(
  amount: number | null,
  currency: string,
  config: ImportConfig,
): number | null {
  if (amount === null) return null;
  if (currency.toUpperCase() === 'EUR') return amount;
  const rate = config.fxRatesToEur[currency.toUpperCase()];
  if (!rate) throw new Error(`No exchange rate for ${currency} → EUR in config.fxRatesToEur`);
  return amount * rate;
}
