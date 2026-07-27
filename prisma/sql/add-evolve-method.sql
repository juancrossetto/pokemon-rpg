-- Requisito de evolución del lado del hijo (ver comentario en schema.prisma).
-- Aditivo y nullable: no toca `Species.evolveLevel`, que sigue manejando las
-- ofertas de evolución por nivel en `src/lib/level-up.ts`.
ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveTrigger" TEXT;
ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveItem" TEXT;
ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveMinLevel" INTEGER;
