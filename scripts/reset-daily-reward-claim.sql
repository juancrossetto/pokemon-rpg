-- Vuelve a dejar el regalo diario reclamable HOY (UTC) para un usuario.
-- Sirve para reabrir el modal "Recompensa Diaria" en home.
--
-- Antes de correr: reemplazá el email en user_email.
-- Ejecutá en el SQL editor de Supabase / psql contra tu DATABASE_URL.
--
-- OJO: esto NO saca monedas/ítems ya otorgados; solo borra el reclamo de hoy
-- para que `canClaim` vuelva a true. Si reclamás de nuevo, cobrás otra vez.
--
-- Además, en el navegador borrá la marca de sesión (o abrí ventana privada):
--   sessionStorage.removeItem('pokerpg:daily-gift-seen')
-- Si no, el modal sigue oculto aunque el SQL haya corrido.

BEGIN;

CREATE TEMP TABLE _target AS
SELECT id AS "userId"
FROM "User"
WHERE email = 'REEMPLAZA_CON_TU_EMAIL@ejemplo.com'  -- ← editá esto
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _target) THEN
    RAISE EXCEPTION 'No encontré ese User.email — editá la query de _target';
  END IF;
END $$;

-- dayKey del servidor = fecha UTC YYYY-MM-DD
CREATE TEMP TABLE _today AS
SELECT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD') AS "dayKey";

-- Qué se va a borrar (para verlo en el resultado)
SELECT
  d."userId",
  d."cycleId",
  d."dayIndex",
  d."dayKey",
  d."claimedAt"
FROM "DailyRewardClaim" d
JOIN _target t ON t."userId" = d."userId"
CROSS JOIN _today today
WHERE d."dayKey" = today."dayKey";

DELETE FROM "DailyRewardClaim" d
USING _target t, _today today
WHERE d."userId" = t."userId"
  AND d."dayKey" = today."dayKey";

COMMIT;

-- Verificación
SELECT
  u.email,
  today."dayKey" AS "todayUtc",
  EXISTS (
    SELECT 1
    FROM "DailyRewardClaim" d
    WHERE d."userId" = u.id
      AND d."dayKey" = today."dayKey"
  ) AS "claimed_today_after"
FROM "User" u
JOIN _target t ON t."userId" = u.id
CROSS JOIN _today today;
