-- Torre de Combate: progreso, intentos, vínculo en BattleSession.

CREATE TYPE "TowerRunStatus" AS ENUM ('ACTIVE', 'AWAITING_BLESSING', 'RESTING', 'FAILED', 'COMPLETED', 'ABANDONED');

ALTER TYPE "BattleKind" ADD VALUE IF NOT EXISTS 'PVE_TOWER';

CREATE TABLE "TowerProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "towerId" TEXT NOT NULL,
    "difficultyId" TEXT NOT NULL,
    "highestFloorAllTime" INTEGER NOT NULL DEFAULT 0,
    "highestFloorSeason" INTEGER NOT NULL DEFAULT 0,
    "seasonKey" TEXT NOT NULL,
    "claimedFirstClears" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guardiansDefeated" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TowerProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TowerRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "towerId" TEXT NOT NULL,
    "difficultyId" TEXT NOT NULL,
    "status" "TowerRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentFloor" INTEGER NOT NULL DEFAULT 1,
    "teamSnapshot" JSONB NOT NULL,
    "blessingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "offeredBlessingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teamChangesRemaining" INTEGER NOT NULL DEFAULT 1,
    "attemptsConsumed" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TowerRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TowerAttemptDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TowerAttemptDay_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BattleSession" ADD COLUMN IF NOT EXISTS "towerRunId" TEXT;

CREATE UNIQUE INDEX "TowerProgress_userId_towerId_difficultyId_key" ON "TowerProgress"("userId", "towerId", "difficultyId");
CREATE INDEX "TowerProgress_userId_idx" ON "TowerProgress"("userId");

CREATE INDEX "TowerRun_userId_status_idx" ON "TowerRun"("userId", "status");
CREATE INDEX "TowerRun_userId_towerId_difficultyId_idx" ON "TowerRun"("userId", "towerId", "difficultyId");

CREATE UNIQUE INDEX "TowerAttemptDay_userId_dayKey_key" ON "TowerAttemptDay"("userId", "dayKey");
CREATE INDEX "TowerAttemptDay_userId_idx" ON "TowerAttemptDay"("userId");

CREATE INDEX "BattleSession_towerRunId_idx" ON "BattleSession"("towerRunId");

ALTER TABLE "TowerProgress" ADD CONSTRAINT "TowerProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TowerRun" ADD CONSTRAINT "TowerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TowerAttemptDay" ADD CONSTRAINT "TowerAttemptDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_towerRunId_fkey" FOREIGN KEY ("towerRunId") REFERENCES "TowerRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
