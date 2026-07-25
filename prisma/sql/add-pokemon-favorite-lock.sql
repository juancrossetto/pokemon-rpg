-- Favorito (emblema de ranking) y bloqueo de venta en el mercado.
ALTER TABLE "PokemonInstance" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PokemonInstance" ADD COLUMN IF NOT EXISTS "isTradeLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "PokemonInstance_ownerId_isFavorite_idx"
  ON "PokemonInstance" ("ownerId", "isFavorite");
