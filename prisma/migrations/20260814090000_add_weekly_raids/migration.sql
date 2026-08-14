CREATE TABLE "WeeklyRaidScore" (
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "bossSpeciesId" INTEGER NOT NULL,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "totalDamage" INTEGER NOT NULL DEFAULT 0,
    "bestDamage" INTEGER NOT NULL DEFAULT 0,
    "rewardClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyRaidScore_pkey" PRIMARY KEY ("userId", "weekKey")
);

CREATE INDEX "WeeklyRaidScore_weekKey_totalDamage_idx" ON "WeeklyRaidScore"("weekKey", "totalDamage");
CREATE INDEX "WeeklyRaidScore_weekKey_bossSpeciesId_idx" ON "WeeklyRaidScore"("weekKey", "bossSpeciesId");
ALTER TABLE "WeeklyRaidScore" ADD CONSTRAINT "WeeklyRaidScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
