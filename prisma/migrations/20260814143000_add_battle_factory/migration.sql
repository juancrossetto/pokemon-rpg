ALTER TABLE "User" ADD COLUMN "factoryPoints" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "FactoryRunStatus" AS ENUM ('DRAFTING', 'ACTIVE', 'AWAITING_SWAP', 'WON', 'LOST');

CREATE TABLE "FactoryRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "status" "FactoryRunStatus" NOT NULL DEFAULT 'DRAFTING',
    "round" INTEGER NOT NULL DEFAULT 0,
    "draftPool" JSONB NOT NULL,
    "team" JSONB NOT NULL DEFAULT '[]',
    "lastOpponent" JSONB NOT NULL DEFAULT '[]',
    "battleHistory" JSONB NOT NULL DEFAULT '[]',
    "totalTurns" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "rewardClaimedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FactoryRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FactoryRun_userId_dayKey_key" ON "FactoryRun"("userId", "dayKey");
CREATE INDEX "FactoryRun_dayKey_round_totalTurns_idx" ON "FactoryRun"("dayKey", "round", "totalTurns");
CREATE INDEX "FactoryRun_userId_status_idx" ON "FactoryRun"("userId", "status");

ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
