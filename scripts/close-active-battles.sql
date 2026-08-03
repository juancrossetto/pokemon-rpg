-- Cierra batallas ACTIVE para poder salir del lock de combate / cerrar sesión.
-- Email: gg@gmail.com

BEGIN;

UPDATE "BattleSession" b
SET status = 'FLED',
    "updatedAt" = now()
FROM "User" u
WHERE u.email = 'gg@gmail.com'
  AND b."userId" = u.id
  AND b.status = 'ACTIVE';

SELECT b.id, b.status, b."updatedAt"
FROM "BattleSession" b
JOIN "User" u ON u.id = b."userId"
WHERE u.email = 'gg@gmail.com'
ORDER BY b."updatedAt" DESC
LIMIT 10;

COMMIT;
