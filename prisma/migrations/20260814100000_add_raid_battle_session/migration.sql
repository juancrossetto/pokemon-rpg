-- Incursión semanal como combate real: la sesión de batalla se ata al intento.
-- `raidWeekKey` se congela al arrancar para que un combate que cruza el reinicio
-- del domingo acredite el daño a la semana en la que empezó.
ALTER TABLE "BattleSession" ADD COLUMN "raidWeekKey" TEXT;
ALTER TABLE "BattleSession" ADD COLUMN "raidTurnsLeft" INTEGER;
