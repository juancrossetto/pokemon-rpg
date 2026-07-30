-- AlterEnum
CREATE TYPE "BattleFormat" AS ENUM ('SINGLE', 'DOUBLE');

-- AlterTable
ALTER TABLE "BattleSession" ADD COLUMN "format" "BattleFormat" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "BattleSession" ADD COLUMN "pokemonInstanceBId" TEXT;
ALTER TABLE "BattleSession" ADD COLUMN "fieldB" JSONB;

-- AddForeignKey
ALTER TABLE "BattleSession" ADD CONSTRAINT "BattleSession_pokemonInstanceBId_fkey" FOREIGN KEY ("pokemonInstanceBId") REFERENCES "PokemonInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
