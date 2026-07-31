-- Pausar el ascenso: salir a Aventura sin abandonar (HP/PP del intento quedan en teamSnapshot).
ALTER TABLE "TowerRun" ADD COLUMN "parkedAt" TIMESTAMP(3);
