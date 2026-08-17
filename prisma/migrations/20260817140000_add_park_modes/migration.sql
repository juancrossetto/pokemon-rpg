-- Parque: pensión, trueque, huerto, mina, recinto.

CREATE TABLE "DaycareDeposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "pokemonInstanceId" TEXT NOT NULL,
    "depositedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DaycareDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DaycareDeposit_pokemonInstanceId_key" ON "DaycareDeposit"("pokemonInstanceId");
CREATE UNIQUE INDEX "DaycareDeposit_userId_slot_key" ON "DaycareDeposit"("userId", "slot");
CREATE INDEX "DaycareDeposit_userId_idx" ON "DaycareDeposit"("userId");

ALTER TABLE "DaycareDeposit" ADD CONSTRAINT "DaycareDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DaycareDeposit" ADD CONSTRAINT "DaycareDeposit_pokemonInstanceId_fkey" FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WonderTradeOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pokemonInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),
    CONSTRAINT "WonderTradeOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WonderTradeOffer_pokemonInstanceId_key" ON "WonderTradeOffer"("pokemonInstanceId");
CREATE INDEX "WonderTradeOffer_matchedAt_createdAt_idx" ON "WonderTradeOffer"("matchedAt", "createdAt");
CREATE INDEX "WonderTradeOffer_userId_matchedAt_idx" ON "WonderTradeOffer"("userId", "matchedAt");

ALTER TABLE "WonderTradeOffer" ADD CONSTRAINT "WonderTradeOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WonderTradeOffer" ADD CONSTRAINT "WonderTradeOffer_pokemonInstanceId_fkey" FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BerryPlot" (
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "berryItemId" TEXT,
    "plantedAt" TIMESTAMP(3),
    CONSTRAINT "BerryPlot_pkey" PRIMARY KEY ("userId","slot")
);

ALTER TABLE "BerryPlot" ADD CONSTRAINT "BerryPlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BerryPlot" ADD CONSTRAINT "BerryPlot_berryItemId_fkey" FOREIGN KEY ("berryItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ParkMine" (
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "grid" JSONB NOT NULL,
    "bag" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParkMine_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ParkMine" ADD CONSTRAINT "ParkMine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FrontierAttempt" (
    "userId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "lastWon" BOOLEAN NOT NULL DEFAULT false,
    "lastLog" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FrontierAttempt_pkey" PRIMARY KEY ("userId","facility","dayKey")
);

ALTER TABLE "FrontierAttempt" ADD CONSTRAINT "FrontierAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
