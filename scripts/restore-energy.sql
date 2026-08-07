-- Recuperar energía (PostgreSQL / Supabase)
-- Tabla Prisma: "User"  |  columnas: energy, energyMax, energyUpdatedAt
--
-- Ejecutar en el SQL Editor de Supabase (o psql con DIRECT_URL).
-- Tras correrlo, recargá la app (o navegá) para ver la barra actualizada.

-- ═══════════════════════════════════════════════════════════
-- A) TODOS los jugadores → barra llena
-- ═══════════════════════════════════════════════════════════
UPDATE "User"
SET
  energy = "energyMax",
  "energyUpdatedAt" = NOW();

-- ═══════════════════════════════════════════════════════════
-- B) Un solo jugador (descomentá y editá)
-- ═══════════════════════════════════════════════════════════
-- UPDATE "User"
-- SET
--   energy = "energyMax",
--   "energyUpdatedAt" = NOW()
-- WHERE username = 'tu_username';
-- -- WHERE email = 'tu@email.com';

-- ═══════════════════════════════════════════════════════════
-- C) Tope de prueba más holgado (opcional, descomentá)
--    energyMax = 40 y llena la barra
-- ═══════════════════════════════════════════════════════════
-- UPDATE "User"
-- SET
--   "energyMax" = 40,
--   energy = 40,
--   "energyUpdatedAt" = NOW()
-- WHERE username = 'tu_username';

-- ═══════════════════════════════════════════════════════════
-- D) Verificar
-- ═══════════════════════════════════════════════════════════
-- SELECT username, email, energy, "energyMax", "energyUpdatedAt"
-- FROM "User"
-- ORDER BY "energyUpdatedAt" DESC
-- LIMIT 20;
