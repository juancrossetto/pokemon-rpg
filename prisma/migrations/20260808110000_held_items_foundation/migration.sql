-- El sistema de objetos equipados se incorporó originalmente con `db push`,
-- antes de que el historial de migraciones fuera la fuente de verdad. Esta
-- migración rellena ese hueco y es deliberadamente idempotente para las bases
-- existentes que ya recibieron el cambio.

ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'HELD';

DO $$
BEGIN
  CREATE TYPE "HeldEffect" AS ENUM (
    'LEFTOVERS',
    'CHOICE_LOCK',
    'LIFE_ORB',
    'FOCUS_SASH',
    'EVIOLITE',
    'FLINCH_CHANCE',
    'QUICK_CLAW',
    'SITRUS_BERRY',
    'LUM_BERRY',
    'TYPE_BOOST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "heldEffect" "HeldEffect",
  ADD COLUMN IF NOT EXISTS "heldValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "heldStat" TEXT,
  ADD COLUMN IF NOT EXISTS "heldBoostType" TEXT;

ALTER TABLE "PokemonInstance"
  ADD COLUMN IF NOT EXISTS "heldItemId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PokemonInstance_heldItemId_fkey'
      AND conrelid = '"PokemonInstance"'::regclass
  ) THEN
    ALTER TABLE "PokemonInstance"
      ADD CONSTRAINT "PokemonInstance_heldItemId_fkey"
      FOREIGN KEY ("heldItemId") REFERENCES "Item"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "BattleSession"
  ADD COLUMN IF NOT EXISTS "playerChoiceLockMoveId" INTEGER,
  ADD COLUMN IF NOT EXISTS "playerItemConsumed" BOOLEAN NOT NULL DEFAULT FALSE;
