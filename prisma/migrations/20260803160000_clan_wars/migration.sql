-- Clan wars v1: season registration + clan vs clan slots.

CREATE TYPE "ClanWarSeasonStatus" AS ENUM ('REGISTRATION', 'ACTIVE', 'SETTLED');
CREATE TYPE "ClanWarStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ClanWarBattleStatus" AS ENUM ('OPEN', 'COMPLETED', 'FORFEIT');

CREATE TABLE "ClanWarSeason" (
    "id" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "status" "ClanWarSeasonStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClanWarSeason_seasonKey_key" ON "ClanWarSeason"("seasonKey");

CREATE TABLE "ClanWarRegistration" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "roster" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClanWarRegistration_seasonId_clanId_key" ON "ClanWarRegistration"("seasonId", "clanId");
CREATE INDEX "ClanWarRegistration_seasonId_idx" ON "ClanWarRegistration"("seasonId");

CREATE TABLE "ClanWar" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "clanAId" TEXT NOT NULL,
    "clanBId" TEXT NOT NULL,
    "status" "ClanWarStatus" NOT NULL DEFAULT 'ACTIVE',
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "ratingABefore" INTEGER NOT NULL,
    "ratingBBefore" INTEGER NOT NULL,
    "ratingAAfter" INTEGER,
    "ratingBAfter" INTEGER,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ClanWar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClanWar_seasonId_status_idx" ON "ClanWar"("seasonId", "status");
CREATE INDEX "ClanWar_clanAId_status_idx" ON "ClanWar"("clanAId", "status");
CREATE INDEX "ClanWar_clanBId_status_idx" ON "ClanWar"("clanBId", "status");

CREATE TABLE "ClanWarBattle" (
    "id" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "fighterAId" TEXT,
    "fighterBId" TEXT,
    "status" "ClanWarBattleStatus" NOT NULL DEFAULT 'OPEN',
    "winnerClanId" TEXT,
    "winnerUserId" TEXT,
    "koLog" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ClanWarBattle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClanWarBattle_warId_slot_key" ON "ClanWarBattle"("warId", "slot");
CREATE INDEX "ClanWarBattle_warId_status_idx" ON "ClanWarBattle"("warId", "status");

ALTER TABLE "ClanWarRegistration" ADD CONSTRAINT "ClanWarRegistration_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ClanWarSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClanWarRegistration" ADD CONSTRAINT "ClanWarRegistration_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClanWar" ADD CONSTRAINT "ClanWar_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ClanWarSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClanWar" ADD CONSTRAINT "ClanWar_clanAId_fkey" FOREIGN KEY ("clanAId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClanWar" ADD CONSTRAINT "ClanWar_clanBId_fkey" FOREIGN KEY ("clanBId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClanWarBattle" ADD CONSTRAINT "ClanWarBattle_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClanWarBattle" ADD CONSTRAINT "ClanWarBattle_fighterAId_fkey" FOREIGN KEY ("fighterAId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClanWarBattle" ADD CONSTRAINT "ClanWarBattle_fighterBId_fkey" FOREIGN KEY ("fighterBId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
