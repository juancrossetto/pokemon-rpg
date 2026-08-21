-- La primera versión de la campaña expandida también llegó mediante `db push`.
-- Se restaura el cambio en el historial para que una base vacía pueda ejecutar
-- las migraciones posteriores (en particular, la evolución de Crobat).

ALTER TABLE "Species"
  ADD COLUMN IF NOT EXISTS "evolveTrigger" TEXT,
  ADD COLUMN IF NOT EXISTS "evolveItem" TEXT,
  ADD COLUMN IF NOT EXISTS "evolveMinLevel" INTEGER;

ALTER TABLE "Gym"
  ADD COLUMN IF NOT EXISTS "isElite" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "BattleSession"
  ADD COLUMN IF NOT EXISTS "routeTrainerId" TEXT;

CREATE TABLE IF NOT EXISTS "ZoneMastery" (
  "userId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ZoneMastery_pkey" PRIMARY KEY ("userId", "locationId"),
  CONSTRAINT "ZoneMastery_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ZoneMastery_userId_idx"
  ON "ZoneMastery"("userId");

CREATE TABLE IF NOT EXISTS "SeenSpecies" (
  "userId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "speciesId" INTEGER NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeenSpecies_pkey" PRIMARY KEY ("userId", "locationId", "speciesId"),
  CONSTRAINT "SeenSpecies_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeenSpecies_speciesId_fkey" FOREIGN KEY ("speciesId")
    REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SeenSpecies_userId_locationId_idx"
  ON "SeenSpecies"("userId", "locationId");

CREATE TABLE IF NOT EXISTS "TrainerDefeat" (
  "userId" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "defeatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrainerDefeat_pkey" PRIMARY KEY ("userId", "trainerId"),
  CONSTRAINT "TrainerDefeat_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainerDefeat_userId_locationId_idx"
  ON "TrainerDefeat"("userId", "locationId");

CREATE TABLE IF NOT EXISTS "ZoneObjectiveClaim" (
  "userId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ZoneObjectiveClaim_pkey" PRIMARY KEY ("userId", "locationId", "objective"),
  CONSTRAINT "ZoneObjectiveClaim_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ZoneObjectiveClaim_userId_idx"
  ON "ZoneObjectiveClaim"("userId");
