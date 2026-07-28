-- One-shot: filas con currentPp=0 eran ambiguas (legacy “lleno” vs agotado).
-- Tras el fix de effectivePp, 0 = vacío. Rellenamos al máximo del move.
UPDATE "PokemonMove" AS pm
SET "currentPp" = m.pp
FROM "Move" AS m
WHERE m.id = pm."moveId"
  AND pm."currentPp" = 0
  AND m.pp > 0;
