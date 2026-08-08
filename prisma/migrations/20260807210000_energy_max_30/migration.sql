-- Default energy pool: 20 → 30. Existing accounts on the stock cap get the
-- same bump; custom energyMax (e.g. admin/test accounts) is left alone.
ALTER TABLE "User" ALTER COLUMN "energy" SET DEFAULT 30;
ALTER TABLE "User" ALTER COLUMN "energyMax" SET DEFAULT 30;

UPDATE "User"
SET "energyMax" = 30
WHERE "energyMax" = 20;
