-- Borra el equipo (y PC) de un usuario para poder re-elegir inicial / tutorial.
-- También cierra batallas activas que referencian esos Pokémon.
--
-- Email: gg@gmail.com
-- Ejecutá en el SQL editor de Supabase / psql contra tu DATABASE_URL.
--
-- En el navegador, si querés re-ver el tutorial de recursos:
--   localStorage.removeItem('pokerpg:seen:starter-resources')

BEGIN;

CREATE TEMP TABLE _target AS
SELECT id AS "userId", email, username
FROM "User"
WHERE email = 'gg@gmail.com'
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _target) THEN
    RAISE EXCEPTION 'No encontré User con email gg@gmail.com';
  END IF;
END $$;

-- Preview
SELECT t."userId", t.email, t.username,
       (SELECT count(*) FROM "PokemonInstance" p WHERE p."ownerId" = t."userId") AS pokemon_count,
       (SELECT count(*) FROM "BattleSession" b WHERE b."userId" = t."userId" AND b.status = 'ACTIVE') AS active_battles
FROM _target t;

-- Publicaciones de mercado que apuntan a sus Pokémon (FK sin cascade)
UPDATE "MarketListing" m
SET "pokemonInstanceId" = NULL,
    status = 'CANCELLED'
FROM _target t
WHERE m."sellerId" = t."userId"
  AND m."pokemonInstanceId" IS NOT NULL;

-- Batallas del usuario (hay que sacarlas antes por FK a PokemonInstance)
DELETE FROM "BattleSession" b
USING _target t
WHERE b."userId" = t."userId";

-- Moves se borran en cascade con PokemonInstance
DELETE FROM "PokemonInstance" p
USING _target t
WHERE p."ownerId" = t."userId";

-- Confirmación
SELECT t.email,
       (SELECT count(*) FROM "PokemonInstance" p WHERE p."ownerId" = t."userId") AS pokemon_left,
       (SELECT count(*) FROM "BattleSession" b WHERE b."userId" = t."userId") AS battles_left
FROM _target t;

COMMIT;
