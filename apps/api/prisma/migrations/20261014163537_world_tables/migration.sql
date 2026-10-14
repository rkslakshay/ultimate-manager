-- AlterTable
ALTER TABLE "SaveGame" ADD COLUMN     "managerClubId" INTEGER,
ADD COLUMN     "worldVersion" INTEGER;

-- CreateTable
CREATE TABLE "Nation" (
    "saveId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "adjective" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "flavour" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL,
    "playable" BOOLEAN NOT NULL,

    CONSTRAINT "Nation_pkey" PRIMARY KEY ("saveId","id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "saveId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "nationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tier" INTEGER,
    "reputation" INTEGER NOT NULL,
    "clubIds" INTEGER[],
    "promotionPlaces" INTEGER NOT NULL,
    "relegationPlaces" INTEGER NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("saveId","id")
);

-- CreateTable
CREATE TABLE "Stadium" (
    "saveId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "Stadium_pkey" PRIMARY KEY ("saveId","id")
);

-- CreateTable
CREATE TABLE "Club" (
    "saveId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nationId" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "founded" INTEGER NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL,
    "stadiumId" INTEGER NOT NULL,
    "leagueId" INTEGER,
    "balance" DOUBLE PRECISION NOT NULL,
    "transferBudget" DOUBLE PRECISION NOT NULL,
    "wageBudget" DOUBLE PRECISION NOT NULL,
    "trainingFacilities" INTEGER NOT NULL,
    "youthFacilities" INTEGER NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("saveId","id")
);

-- CreateTable
CREATE TABLE "Player" (
    "saveId" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationId" INTEGER NOT NULL,
    "birthDate" DATE NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "foot" TEXT NOT NULL,
    "weakFoot" INTEGER NOT NULL,
    "attributes" INTEGER[],
    "hidden" INTEGER[],
    "positions" INTEGER[],
    "primaryPosition" INTEGER NOT NULL,
    "ca" INTEGER NOT NULL,
    "pa" INTEGER NOT NULL,
    "traits" TEXT[],
    "clubId" INTEGER,
    "wage" DOUBLE PRECISION,
    "contractStart" DATE,
    "contractEnd" DATE,
    "squadStatus" TEXT,
    "releaseClause" DOUBLE PRECISION,
    "value" DOUBLE PRECISION NOT NULL,
    "retired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("saveId","id")
);

-- CreateIndex
CREATE INDEX "Club_saveId_leagueId_idx" ON "Club"("saveId", "leagueId");

-- CreateIndex
CREATE INDEX "Player_saveId_clubId_idx" ON "Player"("saveId", "clubId");

-- CreateIndex
CREATE INDEX "Player_saveId_ca_idx" ON "Player"("saveId", "ca");

-- CreateIndex
CREATE INDEX "Player_saveId_value_idx" ON "Player"("saveId", "value");

-- CreateIndex
CREATE INDEX "Player_saveId_primaryPosition_idx" ON "Player"("saveId", "primaryPosition");

-- CreateIndex
CREATE INDEX "Player_saveId_lastName_idx" ON "Player"("saveId", "lastName");

-- AddForeignKey
ALTER TABLE "Nation" ADD CONSTRAINT "Nation_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "SaveGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "SaveGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stadium" ADD CONSTRAINT "Stadium_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "SaveGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "SaveGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "SaveGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
