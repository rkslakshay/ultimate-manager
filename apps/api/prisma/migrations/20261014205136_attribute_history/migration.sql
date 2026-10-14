-- CreateTable
CREATE TABLE "PlayerAttributeChange" (
    "id" SERIAL NOT NULL,
    "saveId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "period" TEXT NOT NULL,
    "attribute" INTEGER NOT NULL,
    "fromValue" INTEGER NOT NULL,
    "toValue" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "caBefore" INTEGER NOT NULL,
    "caAfter" INTEGER NOT NULL,

    CONSTRAINT "PlayerAttributeChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAttributeChange_saveId_playerId_date_idx" ON "PlayerAttributeChange"("saveId", "playerId", "date");

-- AddForeignKey
ALTER TABLE "PlayerAttributeChange" ADD CONSTRAINT "PlayerAttributeChange_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "SaveGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
