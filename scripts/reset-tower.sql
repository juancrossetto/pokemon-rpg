-- Reinicia la Torre de Combate para un usuario (dev / QA).
--
-- Qué hace:
--   1. Cierra batallas ACTIVE ligadas a un TowerRun (sale del lock de combate).
--   2. Borra todos los TowerRun del usuario (activo + historial).
--   3. Borra TowerAttemptDay (vuelve el cupo semanal).
--   4. Resetea TowerProgress (mejor piso, first clears, guardianes).
--
-- Antes de correr: reemplazá el email en user_email.
-- Ejecutá en el SQL editor de Supabase / psql contra tu DATABASE_URL.
--
-- OJO: irreversible para ese usuario. No toca monedas/ítems ya reclamados
-- del botín; solo el progreso e intentos de Torre.

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

-- Estado previo (para auditar)
SELECT 'runs' AS kind, count(*)::int AS n
FROM "TowerRun" r
JOIN _target t ON t."userId" = r."userId"
UNION ALL
SELECT 'attempt_days', count(*)::int
FROM "TowerAttemptDay" d
JOIN _target t ON t."userId" = d."userId"
UNION ALL
SELECT 'progress', count(*)::int
FROM "TowerProgress" p
JOIN _target t ON t."userId" = p."userId"
UNION ALL
SELECT 'tower_battles_active', count(*)::int
FROM "BattleSession" b
JOIN _target t ON t."userId" = b."userId"
WHERE b.status = 'ACTIVE'
  AND b."towerRunId" IS NOT NULL;

-- 1) Salir del lock de combate de Torre
UPDATE "BattleSession" b
SET
  status = 'FLED',
  "updatedAt" = now()
FROM _target t
WHERE b."userId" = t."userId"
  AND b.status = 'ACTIVE'
  AND b."towerRunId" IS NOT NULL;

-- 2) Borrar ascensos (onDelete SetNull en BattleSession.towerRunId)
DELETE FROM "TowerRun" r
USING _target t
WHERE r."userId" = t."userId";

-- 3) Liberar intentos del período
DELETE FROM "TowerAttemptDay" d
USING _target t
WHERE d."userId" = t."userId";

-- 4) Progreso permanente / temporada
DELETE FROM "TowerProgress" p
USING _target t
WHERE p."userId" = t."userId";

COMMIT;

-- Verificación
SELECT
  u.email,
  (SELECT count(*) FROM "TowerRun" r WHERE r."userId" = u.id) AS runs_left,
  (SELECT count(*) FROM "TowerAttemptDay" d WHERE d."userId" = u.id) AS attempt_days_left,
  (SELECT count(*) FROM "TowerProgress" p WHERE p."userId" = u.id) AS progress_left,
  (
    SELECT count(*)
    FROM "BattleSession" b
    WHERE b."userId" = u.id
      AND b.status = 'ACTIVE'
      AND b."towerRunId" IS NOT NULL
  ) AS active_tower_battles
FROM "User" u
JOIN _target t ON t."userId" = u.id;
