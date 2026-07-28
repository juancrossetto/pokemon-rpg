-- Clan system Phase 1: identity, join policy, applications, invites, notifications

DO $$ BEGIN
  CREATE TYPE "ClanJoinPolicy" AS ENUM ('OPEN', 'REQUEST', 'INVITE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClanFocus" AS ENUM (
    'CASUAL', 'COMPETITIVE', 'PVE', 'PVP', 'COLLECTION', 'EVENTS', 'SOCIAL', 'MIXED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClanAffinity" AS ENUM (
    'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'ROCK', 'GROUND',
    'PSYCHIC', 'DARK', 'STEEL', 'DRAGON', 'FAIRY', 'FIGHTING', 'GHOST'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClanApplicationStatus" AS ENUM (
    'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastClanLeftAt" TIMESTAMP(3);

ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "normalizedName" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "normalizedTag" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "motto" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "announcement" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "joinPolicy" "ClanJoinPolicy" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "focus" "ClanFocus" NOT NULL DEFAULT 'MIXED';
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "affinity" "ClanAffinity" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "minPlayerLevel" INTEGER;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "emblem" JSONB NOT NULL DEFAULT '{"kind":"preset","presetId":"guild-1"}'::jsonb;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Clan"
SET "normalizedName" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g')),
    "normalizedTag" = upper(trim("tag"))
WHERE "normalizedName" IS NULL OR "normalizedTag" IS NULL;

DO $$ BEGIN
  ALTER TABLE "Clan" ALTER COLUMN "normalizedName" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Clan" ALTER COLUMN "normalizedTag" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Clan_normalizedName_key" ON "Clan"("normalizedName");
CREATE UNIQUE INDEX IF NOT EXISTS "Clan_normalizedTag_key" ON "Clan"("normalizedTag");

CREATE TABLE IF NOT EXISTS "ClanApplication" (
  "id" TEXT NOT NULL,
  "clanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT,
  "status" "ClanApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "ClanApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClanApplication_clanId_userId_key"
  ON "ClanApplication"("clanId", "userId");
CREATE INDEX IF NOT EXISTS "ClanApplication_userId_status_idx"
  ON "ClanApplication"("userId", "status");
CREATE INDEX IF NOT EXISTS "ClanApplication_clanId_status_idx"
  ON "ClanApplication"("clanId", "status");

DO $$ BEGIN
  ALTER TABLE "ClanApplication"
    ADD CONSTRAINT "ClanApplication_clanId_fkey"
    FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClanApplication"
    ADD CONSTRAINT "ClanApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClanInvite" (
  "id" TEXT NOT NULL,
  "clanId" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "status" "ClanApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "ClanInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClanInvite_clanId_toUserId_key"
  ON "ClanInvite"("clanId", "toUserId");
CREATE INDEX IF NOT EXISTS "ClanInvite_toUserId_status_idx"
  ON "ClanInvite"("toUserId", "status");

DO $$ BEGIN
  ALTER TABLE "ClanInvite"
    ADD CONSTRAINT "ClanInvite_clanId_fkey"
    FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClanInvite"
    ADD CONSTRAINT "ClanInvite_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClanInvite"
    ADD CONSTRAINT "ClanInvite_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'CLAN_INVITE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'CLAN_APPLICATION'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'CLAN_ACCEPTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'CLAN_KICKED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'CLAN_ROLE_CHANGED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
