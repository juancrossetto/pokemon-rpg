-- Desbloquea capítulos 6–9 (Azafrán → Canela → Verde → Alto Mando)
-- para poder navegarlos e ilustrar zonas.
--
-- Antes de correr: reemplazá el email en user_email.
-- Ejecutá en el SQL editor de Supabase / psql contra tu DATABASE_URL.

BEGIN;

-- ─── 1) Usuario target ───────────────────────────────────────────────
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

-- ─── 2) CampaignProgress: abrir hasta champion + completar caps. 1–5 ─
-- highestUnlockedLocationId = 'champion' → zonas de caps. 6–9 navegables
-- completedStageIds = stages salvajes de medallas 1–5
-- farming en route-15 (arranque del cap. 6)

INSERT INTO "CampaignProgress" (
  "userId",
  "currentRegionId",
  "highestUnlockedLocationId",
  "selectedLocationId",
  "farmingLocationId",
  "farmingStageId",
  "highestCompletedStageId",
  "completedStageIds",
  "lastMilestoneId",
  "updatedAt"
)
SELECT
  t."userId",
  'kanto',
  'champion',
  'route-15',
  'route-15',
  'r15-1',
  'fuchsia-city-1',
  ARRAY[
    'pallet-1',
    'r1-1', 'r1-2', 'r1-3',
    'viridian-1',
    'r2-1', 'r2-2', 'r2-3',
    'vf-e-1', 'vf-e-2', 'vf-m-1', 'vf-m-2', 'vf-d-1', 'vf-d-2',
    'pewter-1',
    'r3-1', 'r3-2', 'r3-3',
    'mm-1', 'mm-2', 'mm-3', 'mm-4',
    'cerulean-1',
    'r5-1', 'r5-2', 'r5-3',
    'vermilion-city-1',
    'r11-1', 'r11-2', 'r11-3',
    'rt-1', 'rt-2', 'rt-3', 'rt-4',
    'lavender-town-1',
    'r8-1', 'r8-2', 'r8-3',
    'celadon-city-1',
    'r16-1', 'r16-2', 'r16-3',
    'fuchsia-city-1'
  ]::text[],
  NULL,
  NOW()
FROM _target t
ON CONFLICT ("userId") DO UPDATE SET
  "highestUnlockedLocationId" = EXCLUDED."highestUnlockedLocationId",
  "selectedLocationId"        = EXCLUDED."selectedLocationId",
  "farmingLocationId"         = EXCLUDED."farmingLocationId",
  "farmingStageId"            = EXCLUDED."farmingStageId",
  "highestCompletedStageId"   = EXCLUDED."highestCompletedStageId",
  "completedStageIds"         = EXCLUDED."completedStageIds",
  "updatedAt"                 = NOW();

-- ─── 3) Medallas 1–5 (caps. 1–5 cerrados en la UI) ──────────────────
INSERT INTO "Badge" (id, "userId", "gymId", "earnedAt")
SELECT
  gen_random_uuid()::text,
  t."userId",
  g.id,
  NOW()
FROM _target t
CROSS JOIN "Gym" g
WHERE g."order" BETWEEN 1 AND 5
  AND g."isElite" = false
ON CONFLICT ("userId", "gymId") DO NOTHING;

COMMIT;

-- Verificación rápida:
-- SELECT "highestUnlockedLocationId", "farmingLocationId", cardinality("completedStageIds")
-- FROM "CampaignProgress" WHERE "userId" = (SELECT "userId" FROM _target);
-- SELECT g."order", g.name FROM "Badge" b JOIN "Gym" g ON g.id = b."gymId"
-- WHERE b."userId" = (SELECT "userId" FROM _target) ORDER BY g."order";
