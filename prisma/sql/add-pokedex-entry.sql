-- Pokédex: especies vistas por entrenador (captura se deriva de PokemonInstance).
CREATE TABLE IF NOT EXISTS "PokedexEntry" (
  "userId" TEXT NOT NULL,
  "speciesId" INTEGER NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PokedexEntry_pkey" PRIMARY KEY ("userId", "speciesId")
);

CREATE INDEX IF NOT EXISTS "PokedexEntry_userId_seenAt_idx"
  ON "PokedexEntry"("userId", "seenAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PokedexEntry_userId_fkey'
  ) THEN
    ALTER TABLE "PokedexEntry"
      ADD CONSTRAINT "PokedexEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PokedexEntry_speciesId_fkey'
  ) THEN
    ALTER TABLE "PokedexEntry"
      ADD CONSTRAINT "PokedexEntry_speciesId_fkey"
      FOREIGN KEY ("speciesId") REFERENCES "Species"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: capturas existentes cuentan como vistas.
INSERT INTO "PokedexEntry" ("userId", "speciesId")
SELECT DISTINCT "ownerId", "speciesId"
FROM "PokemonInstance"
ON CONFLICT DO NOTHING;

-- Backfill: encuentros / batallas previas.
INSERT INTO "PokedexEntry" ("userId", "speciesId")
SELECT DISTINCT "userId", "wildSpeciesId"
FROM "BattleSession"
WHERE "wildSpeciesId" IS NOT NULL
ON CONFLICT DO NOTHING;
