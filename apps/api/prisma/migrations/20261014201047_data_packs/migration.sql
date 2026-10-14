-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "crestKey" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'generated',
ADD COLUMN     "source" JSONB,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "founded" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'generated';

-- AlterTable
ALTER TABLE "Nation" ADD COLUMN     "firstNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'generated',
ADD COLUMN     "shirtNumber" INTEGER,
ADD COLUMN     "source" JSONB;

-- AlterTable
ALTER TABLE "SaveGame" ADD COLUMN     "dataPack" TEXT NOT NULL DEFAULT 'fictional',
ADD COLUMN     "packVersion" TEXT,
ADD COLUMN     "valueModel" JSONB;

-- AlterTable
ALTER TABLE "Stadium" ALTER COLUMN "city" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DataPackVersion" (
    "pack" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "summary" JSONB NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataPackVersion_pkey" PRIMARY KEY ("pack","version")
);

-- CreateTable
CREATE TABLE "HistoricalTransfer" (
    "id" SERIAL NOT NULL,
    "pack" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "season" TEXT,
    "fromClubId" INTEGER,
    "toClubId" INTEGER,
    "fromClubName" TEXT,
    "toClubName" TEXT,
    "feeEur" DOUBLE PRECISION,
    "feeStatus" TEXT NOT NULL,
    "marketValueEur" DOUBLE PRECISION,
    "type" TEXT,
    "source" TEXT NOT NULL,

    CONSTRAINT "HistoricalTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalValuation" (
    "id" SERIAL NOT NULL,
    "pack" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "valueEur" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "HistoricalValuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalTransfer_pack_version_playerId_idx" ON "HistoricalTransfer"("pack", "version", "playerId");

-- CreateIndex
CREATE INDEX "HistoricalValuation_pack_version_playerId_idx" ON "HistoricalValuation"("pack", "version", "playerId");
