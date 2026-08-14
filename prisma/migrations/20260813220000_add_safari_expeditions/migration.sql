-- CreateEnum
CREATE TYPE "SafariRunStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "SafariRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "biomeId" TEXT NOT NULL,
    "status" "SafariRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "encountersUsed" INTEGER NOT NULL DEFAULT 0,
    "ballsRemaining" INTEGER NOT NULL DEFAULT 15,
    "encounterSpeciesId" INTEGER,
    "encounterLevel" INTEGER,
    "encounterIsShiny" BOOLEAN NOT NULL DEFAULT false,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "bestSpeciesId" INTEGER,
    "bestLevel" INTEGER,
    "bestIsShiny" BOOLEAN NOT NULL DEFAULT false,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardGems" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafariRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafariCatch" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "pokemonInstanceId" TEXT,
    "speciesId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "isShiny" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL,
    "caughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafariCatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafariRun_userId_status_idx" ON "SafariRun"("userId", "status");
CREATE INDEX "SafariRun_userId_weekKey_idx" ON "SafariRun"("userId", "weekKey");
CREATE INDEX "SafariRun_weekKey_bestScore_idx" ON "SafariRun"("weekKey", "bestScore");
CREATE UNIQUE INDEX "SafariCatch_pokemonInstanceId_key" ON "SafariCatch"("pokemonInstanceId");
CREATE INDEX "SafariCatch_runId_score_idx" ON "SafariCatch"("runId", "score");
CREATE INDEX "SafariCatch_speciesId_idx" ON "SafariCatch"("speciesId");

-- AddForeignKey
ALTER TABLE "SafariRun" ADD CONSTRAINT "SafariRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SafariRun" ADD CONSTRAINT "SafariRun_encounterSpeciesId_fkey"
FOREIGN KEY ("encounterSpeciesId") REFERENCES "Species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SafariRun" ADD CONSTRAINT "SafariRun_bestSpeciesId_fkey"
FOREIGN KEY ("bestSpeciesId") REFERENCES "Species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SafariCatch" ADD CONSTRAINT "SafariCatch_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "SafariRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SafariCatch" ADD CONSTRAINT "SafariCatch_pokemonInstanceId_fkey"
FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SafariCatch" ADD CONSTRAINT "SafariCatch_speciesId_fkey"
FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
