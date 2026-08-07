-- AlterTable
ALTER TABLE "PokemonInstance" ADD COLUMN "declinedMoveIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
