-- Botín diferido: se acumula en el ascenso y se reclama al cerrar.
ALTER TABLE "TowerRun" ADD COLUMN IF NOT EXISTS "pendingLoot" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TowerRun" ADD COLUMN IF NOT EXISTS "lootClaimedAt" TIMESTAMP(3);
