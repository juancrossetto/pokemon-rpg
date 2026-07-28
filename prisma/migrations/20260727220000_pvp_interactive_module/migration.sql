-- CreateEnum
CREATE TYPE "PvpMatchMode" AS ENUM ('RANKED', 'QUICK');

-- CreateEnum
CREATE TYPE "PvpMatchStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FORFEIT');

-- AlterTable
ALTER TABLE "BattleSession" ADD COLUMN     "opponentSlot" INTEGER,
ADD COLUMN     "opponentUserId" TEXT,
ADD COLUMN     "pvpMatchId" TEXT,
ADD COLUMN     "wildChoiceLockMoveId" INTEGER,
ADD COLUMN     "wildHeldItemId" TEXT,
ADD COLUMN     "wildItemConsumed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PokemonInstance" ADD COLUMN     "pvpSlot" INTEGER;

-- AlterTable
ALTER TABLE "PvpMatch" ADD COLUMN     "challengerTeam" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "mode" "PvpMatchMode" NOT NULL DEFAULT 'QUICK',
ADD COLUMN     "opponentTeam" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seasonKey" TEXT,
ADD COLUMN     "status" "PvpMatchStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "turnLog" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "winnerId" DROP NOT NULL,
ALTER COLUMN "challengerRatingAfter" DROP NOT NULL,
ALTER COLUMN "opponentRatingAfter" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PvpSeasonStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PvpSeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PvpSeasonStats_seasonKey_rating_idx" ON "PvpSeasonStats"("seasonKey", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "PvpSeasonStats_userId_seasonKey_key" ON "PvpSeasonStats"("userId", "seasonKey");

-- CreateIndex
CREATE INDEX "BattleSession_pvpMatchId_idx" ON "BattleSession"("pvpMatchId");

-- CreateIndex
CREATE INDEX "PokemonInstance_ownerId_pvpSlot_idx" ON "PokemonInstance"("ownerId", "pvpSlot");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonInstance_ownerId_pvpSlot_key" ON "PokemonInstance"("ownerId", "pvpSlot");

-- CreateIndex
CREATE INDEX "PvpMatch_status_createdAt_idx" ON "PvpMatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PvpMatch_seasonKey_idx" ON "PvpMatch"("seasonKey");

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_pvpMatchId_fkey" FOREIGN KEY ("pvpMatchId") REFERENCES "PvpMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_opponentUserId_fkey" FOREIGN KEY ("opponentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_wildHeldItemId_fkey" FOREIGN KEY ("wildHeldItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PvpSeasonStats" ADD CONSTRAINT "PvpSeasonStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill completedAt for existing resolved matches
UPDATE "PvpMatch" SET "completedAt" = "createdAt" WHERE "completedAt" IS NULL AND "winnerId" IS NOT NULL;
