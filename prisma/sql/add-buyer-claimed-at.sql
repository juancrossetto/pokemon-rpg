-- Entregas pendientes en la mochila del mercado.
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "buyerClaimedAt" TIMESTAMP(3);

-- Compras anteriores ya entregaron el bien al instante: marcarlas como reclamadas.
UPDATE "MarketListing"
SET "buyerClaimedAt" = COALESCE("soldAt", NOW())
WHERE status = 'SOLD' AND "buyerClaimedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "MarketListing_buyerId_status_buyerClaimedAt_idx"
  ON "MarketListing" ("buyerId", status, "buyerClaimedAt");
