-- Nivel mínimo de evolución por level-up (null = no aplica).
ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveLevel" INTEGER;
