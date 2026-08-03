-- Clan war interactive battles: IN_PROGRESS + team snaps + BattleSession link.

ALTER TYPE "ClanWarBattleStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TABLE "ClanWarBattle" ADD COLUMN IF NOT EXISTS "challengerTeam" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ClanWarBattle" ADD COLUMN IF NOT EXISTS "opponentTeam" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ClanWarBattle" ADD COLUMN IF NOT EXISTS "startedById" TEXT;

ALTER TABLE "BattleSession" ADD COLUMN IF NOT EXISTS "clanWarBattleId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "BattleSession_clanWarBattleId_key" ON "BattleSession"("clanWarBattleId");
CREATE INDEX IF NOT EXISTS "BattleSession_clanWarBattleId_idx" ON "BattleSession"("clanWarBattleId");

ALTER TABLE "BattleSession" DROP CONSTRAINT IF EXISTS "BattleSession_clanWarBattleId_fkey";
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_clanWarBattleId_fkey" FOREIGN KEY ("clanWarBattleId") REFERENCES "ClanWarBattle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
