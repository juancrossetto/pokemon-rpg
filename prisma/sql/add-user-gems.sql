-- Moneda premium del jugador (PC / economía especial).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gems" INTEGER NOT NULL DEFAULT 0;
