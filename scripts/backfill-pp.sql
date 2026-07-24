UPDATE "PokemonMove" AS pm
SET "currentPp" = m.pp
FROM "Move" AS m
WHERE pm."moveId" = m.id AND pm."currentPp" = 0;
