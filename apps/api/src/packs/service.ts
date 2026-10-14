import { DEFAULT_START_DATE } from '@um/engine';
import { listPacks, packPaths, readPack, type DataPack } from '@um/data-import';
import type { DataPackDto } from '@um/shared';
import type { Db } from '../db';
import type { Prisma } from '../generated/prisma/client';
import { chunk } from '../world/convert';

type Tx = Prisma.TransactionClient | Db;

export const FICTIONAL_PACK = 'fictional';

/**
 * Data packs available to new saves: the built-in fictional generator plus every processed pack
 * under data-packs/processed. Pack files are read once and cached (they're immutable per version).
 */
export class PackService {
  private readonly cache = new Map<string, DataPack>();

  constructor(private readonly root: string) {}

  get processedDir(): string {
    return packPaths(this.root).processed;
  }

  get crestsDir(): string {
    return packPaths(this.root).crests;
  }

  list(): DataPackDto[] {
    const imported = listPacks(this.processedDir).map((m): DataPackDto => ({
      id: m.pack,
      label: m.label,
      version: m.version,
      startDate: m.startDate,
      kind: 'imported',
      summary: {
        nations: m.summary.nations,
        leagues: m.summary.leagues.map((l) => ({
          name: l.name,
          nation: l.nation,
          tier: l.tier,
          clubs: l.clubs,
          importedPlayers: l.importedPlayers,
        })),
        clubs: m.summary.clubs,
        players: m.summary.players.total,
        importedPlayers: m.summary.players.imported,
        transfers: m.summary.transfers,
      },
    }));
    return [
      {
        id: FICTIONAL_PACK,
        label: 'Fictional world (generated)',
        version: null,
        startDate: DEFAULT_START_DATE,
        kind: 'generated',
        summary: null,
      },
      ...imported,
    ];
  }

  has(pack: string): boolean {
    return pack === FICTIONAL_PACK || this.list().some((p) => p.id === pack);
  }

  /** Load a pack (current version unless one is given). */
  load(pack: string, version?: string): DataPack {
    const key = `${pack}@${version ?? 'current'}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const data = readPack(this.processedDir, pack, version);
    // Keep a couple of packs in memory; they can be tens of MB.
    if (this.cache.size >= 3) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, data);
    this.cache.set(`${pack}@${data.version}`, data);
    return data;
  }

  /** Install a pack version's immutable history into the shared tables (idempotent). */
  async ensureInstalled(db: Db, pack: DataPack): Promise<void> {
    const existing = await db.dataPackVersion.findUnique({
      where: { pack_version: { pack: pack.pack, version: pack.version } },
    });
    if (existing) return;
    await db.$transaction(
      async (tx) => {
        // Serialise concurrent installs of the same version.
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          `${pack.pack}@${pack.version}`,
        );
        const again = await tx.dataPackVersion.findUnique({
          where: { pack_version: { pack: pack.pack, version: pack.version } },
        });
        if (again) return;
        await insertHistory(tx, pack);
        await tx.dataPackVersion.create({
          data: {
            pack: pack.pack,
            version: pack.version,
            label: pack.label,
            startDate: new Date(`${pack.startDate}T00:00:00Z`),
            summary: pack.summary as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  }
}

async function insertHistory(tx: Tx, pack: DataPack): Promise<void> {
  for (const batch of chunk(pack.history.transfers, 5000)) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "HistoricalTransfer" ("pack","version","playerId","date","season","fromClubId","toClubId","fromClubName","toClubName","feeEur","feeStatus","marketValueEur","type","source")
       SELECT $1, $2, "playerId", "date", "season", "fromClubId", "toClubId", "fromClubName", "toClubName", "feeEur", "feeStatus", "marketValueEur", "type", "source"
       FROM jsonb_to_recordset($3::jsonb) AS t("playerId" int, "date" date, "season" text, "fromClubId" int, "toClubId" int, "fromClubName" text, "toClubName" text, "feeEur" float8, "feeStatus" text, "marketValueEur" float8, "type" text, "source" text)`,
      pack.pack,
      pack.version,
      JSON.stringify(batch),
    );
  }
  for (const batch of chunk(pack.history.valuations, 10000)) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "HistoricalValuation" ("pack","version","playerId","date","valueEur","source")
       SELECT $1, $2, "playerId", "date", "valueEur", "source"
       FROM jsonb_to_recordset($3::jsonb) AS t("playerId" int, "date" date, "valueEur" float8, "source" text)`,
      pack.pack,
      pack.version,
      JSON.stringify(batch),
    );
  }
}
