-- Persist the encounter history used to reduce repeated Safari spawns.
ALTER TABLE "SafariRun"
ADD COLUMN "seenSpeciesIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
