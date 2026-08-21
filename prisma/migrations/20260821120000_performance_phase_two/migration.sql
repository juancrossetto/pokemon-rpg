-- Índices de las métricas semanales que alimentan home, eventos y header.
CREATE INDEX "PokemonInstance_ownerId_caughtAt_idx"
  ON "PokemonInstance"("ownerId", "caughtAt");

CREATE INDEX "PokemonInstance_ownerId_isShiny_caughtAt_idx"
  ON "PokemonInstance"("ownerId", "isShiny", "caughtAt");

CREATE INDEX "GymAttempt_userId_won_attemptedAt_idx"
  ON "GymAttempt"("userId", "won", "attemptedAt");

CREATE INDEX "ZoneObjectiveClaim_userId_claimedAt_idx"
  ON "ZoneObjectiveClaim"("userId", "claimedAt");

CREATE INDEX "BattleLog_userId_userWon_createdAt_idx"
  ON "BattleLog"("userId", "userWon", "createdAt");

-- Telemetría liviana: la ruta guarda fuera de la respuesta y aplica muestreo.
CREATE TABLE "WebVitalSample" (
  "id" TEXT NOT NULL,
  "metricId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "delta" DOUBLE PRECISION NOT NULL,
  "rating" TEXT NOT NULL,
  "navigationType" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "viewport" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebVitalSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebVitalSample_name_createdAt_idx"
  ON "WebVitalSample"("name", "createdAt");

CREATE INDEX "WebVitalSample_pathname_createdAt_idx"
  ON "WebVitalSample"("pathname", "createdAt");

CREATE INDEX "WebVitalSample_rating_createdAt_idx"
  ON "WebVitalSample"("rating", "createdAt");
