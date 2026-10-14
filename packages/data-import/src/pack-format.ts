import fs from 'node:fs';
import path from 'node:path';
import type { ValueFit, WorldState } from '@um/engine';
import type { CalibrationResult } from './mapping/ability';

export const PACK_FORMAT_VERSION = 1;
export const IMPORTER_VERSION = '1.0.0';

/**
 * paid          a positive fee was reported
 * zero_reported the source reports a fee of 0 (usually a free transfer, but the source does
 *               not say so explicitly: shown as "€0 / free (as reported)")
 * unknown       no fee reported (undisclosed or missing). Never converted to 0.
 */
export type FeeStatus = 'paid' | 'zero_reported' | 'unknown';

/** A real, historical transfer from a source. Never mixed with in-game (simulated) transfers. */
export interface HistoricalTransfer {
  playerId: number;
  date: string;
  season: string | null;
  fromClubId: number | null;
  toClubId: number | null;
  fromClubName: string | null;
  toClubName: string | null;
  feeEur: number | null;
  feeStatus: FeeStatus;
  /** Source market value at the time of the transfer (not the fee). */
  marketValueEur: number | null;
  /** Source transfer type if it states one (e.g. loan); null when not stated. */
  type: string | null;
  source: string;
}

export interface HistoricalValuation {
  playerId: number;
  date: string;
  valueEur: number;
  source: string;
}

export interface PackLeagueSummary {
  id: number;
  name: string;
  nation: string;
  tier: number;
  clubs: number;
  importedPlayers: number;
  generatedPlayers: number;
}

export interface PackSummary {
  nations: number;
  leagues: PackLeagueSummary[];
  clubs: number;
  players: { total: number; imported: number; generated: number };
  transfers: number;
  valuations: number;
}

export interface SourceFileInfo {
  path: string;
  table: string;
  rows: number;
  accepted: number;
  encoding: string;
  sha256: string;
}

export interface DataPack {
  format: 'um-data-pack';
  formatVersion: number;
  /** Pack id: "real", "sample", … ("fictional" is generated at runtime, never a file). */
  pack: string;
  /** Content hash: same inputs and importer ⇒ same version. */
  version: string;
  createdAt: string;
  importerVersion: string;
  baseCurrency: 'EUR';
  startDate: string;
  /** Short human label shown in the new-save dialog. */
  label: string;
  sources: SourceFileInfo[];
  calibration: CalibrationResult & { sourceLow: number; sourceHigh: number };
  valueModel: ValueFit | null;
  world: WorldState;
  history: { transfers: HistoricalTransfer[]; valuations: HistoricalValuation[] };
  summary: PackSummary;
}

/** Small file next to the packs: which version is current, and its summary (for listing). */
export interface PackManifest {
  pack: string;
  label: string;
  version: string;
  file: string;
  startDate: string;
  createdAt: string;
  summary: PackSummary;
}

export const packDir = (processedDir: string, pack: string) => path.join(processedDir, pack);
export const manifestFile = (processedDir: string, pack: string) =>
  path.join(packDir(processedDir, pack), 'current.json');

/** Available processed packs (excluding the built-in fictional generator). */
export function listPacks(processedDir: string): PackManifest[] {
  if (!fs.existsSync(processedDir)) return [];
  return fs
    .readdirSync(processedDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => manifestFile(processedDir, d.name))
    .filter((f) => fs.existsSync(f))
    .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')) as PackManifest)
    .sort((a, b) => a.pack.localeCompare(b.pack));
}

/** Load a pack version (default: current) and check its envelope. */
export function readPack(processedDir: string, pack: string, version?: string): DataPack {
  const manifest = JSON.parse(
    fs.readFileSync(manifestFile(processedDir, pack), 'utf8'),
  ) as PackManifest;
  const file = path.join(packDir(processedDir, pack), version ? `${version}.json` : manifest.file);
  if (!fs.existsSync(file))
    throw new Error(`Data pack ${pack} version ${version ?? manifest.version} not found`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as DataPack;
  if (data.format !== 'um-data-pack' || data.formatVersion !== PACK_FORMAT_VERSION) {
    throw new Error(`${file}: unsupported pack format ${data.format}/${data.formatVersion}`);
  }
  if (!Array.isArray(data.world?.players) || !Array.isArray(data.world?.clubs)) {
    throw new Error(`${file}: pack has no world`);
  }
  return data;
}
