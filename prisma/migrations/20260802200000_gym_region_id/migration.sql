-- Gyms are scoped per league/region. `order` restarts at 1 within each region.
-- Existing rows become Kanto via the column default.

ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "regionId" TEXT NOT NULL DEFAULT 'kanto';

DROP INDEX IF EXISTS "Gym_order_key";

CREATE UNIQUE INDEX "Gym_regionId_order_key" ON "Gym"("regionId", "order");

CREATE INDEX "Gym_regionId_idx" ON "Gym"("regionId");
