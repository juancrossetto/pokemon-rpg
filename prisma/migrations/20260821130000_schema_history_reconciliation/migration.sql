-- Reconciliación final del período en que el schema se actualizaba con
-- `prisma db push`. Todo es idempotente: en Supabase estas estructuras ya
-- existen; en una base vacía de CI deben quedar representadas por migraciones.

DO $$ BEGIN
  CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClanJoinPolicy" AS ENUM ('OPEN', 'REQUEST', 'INVITE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClanFocus" AS ENUM ('CASUAL', 'COMPETITIVE', 'PVE', 'PVP', 'COLLECTION', 'EVENTS', 'SOCIAL', 'MIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClanAffinity" AS ENUM ('NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'ROCK', 'GROUND', 'PSYCHIC', 'DARK', 'STEEL', 'DRAGON', 'FAIRY', 'FIGHTING', 'GHOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClanApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GYM_TM_REWARD';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLAN_INVITE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLAN_APPLICATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLAN_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLAN_KICKED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLAN_ROLE_CHANGED';
ALTER TYPE "StatusCondition" ADD VALUE IF NOT EXISTS 'FREEZE';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "gems" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastClanLeftAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "Species"
  ADD COLUMN IF NOT EXISTS "evolveLevel" INTEGER;

ALTER TABLE "Gym"
  ALTER COLUMN "cooldownHours" SET DEFAULT 4;

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "gemPrice" INTEGER;

ALTER TABLE "Clan"
  ADD COLUMN IF NOT EXISTS "normalizedName" TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS "normalizedTag" TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "motto" TEXT,
  ADD COLUMN IF NOT EXISTS "announcement" TEXT,
  ADD COLUMN IF NOT EXISTS "joinPolicy" "ClanJoinPolicy" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "focus" "ClanFocus" NOT NULL DEFAULT 'MIXED',
  ADD COLUMN IF NOT EXISTS "affinity" "ClanAffinity" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "minPlayerLevel" INTEGER,
  ADD COLUMN IF NOT EXISTS "emblem" JSONB NOT NULL,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Clan_normalizedName_key"
  ON "Clan"("normalizedName");
CREATE UNIQUE INDEX IF NOT EXISTS "Clan_normalizedTag_key"
  ON "Clan"("normalizedTag");

CREATE TABLE IF NOT EXISTS "PokedexEntry" (
  "userId" TEXT NOT NULL,
  "speciesId" INTEGER NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PokedexEntry_pkey" PRIMARY KEY ("userId", "speciesId"),
  CONSTRAINT "PokedexEntry_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PokedexEntry_speciesId_fkey" FOREIGN KEY ("speciesId")
    REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PokedexEntry_userId_seenAt_idx"
  ON "PokedexEntry"("userId", "seenAt");

CREATE TABLE IF NOT EXISTS "FriendRequest" (
  "id" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendRequest_toUserId_fkey" FOREIGN KEY ("toUserId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FriendRequest_fromUserId_toUserId_key"
  ON "FriendRequest"("fromUserId", "toUserId");
CREATE INDEX IF NOT EXISTS "FriendRequest_toUserId_status_idx"
  ON "FriendRequest"("toUserId", "status");
CREATE INDEX IF NOT EXISTS "FriendRequest_fromUserId_status_idx"
  ON "FriendRequest"("fromUserId", "status");

CREATE TABLE IF NOT EXISTS "Friendship" (
  "id" TEXT NOT NULL,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "favoriteForA" BOOLEAN NOT NULL DEFAULT FALSE,
  "favoriteForB" BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_userAId_userBId_key"
  ON "Friendship"("userAId", "userBId");
CREATE INDEX IF NOT EXISTS "Friendship_userAId_idx" ON "Friendship"("userAId");
CREATE INDEX IF NOT EXISTS "Friendship_userBId_idx" ON "Friendship"("userBId");

CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key"
  ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

CREATE TABLE IF NOT EXISTS "ClanApplication" (
  "id" TEXT NOT NULL,
  "clanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT,
  "status" "ClanApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "ClanApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClanApplication_clanId_fkey" FOREIGN KEY ("clanId")
    REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClanApplication_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClanApplication_clanId_userId_key"
  ON "ClanApplication"("clanId", "userId");
CREATE INDEX IF NOT EXISTS "ClanApplication_userId_status_idx"
  ON "ClanApplication"("userId", "status");
CREATE INDEX IF NOT EXISTS "ClanApplication_clanId_status_idx"
  ON "ClanApplication"("clanId", "status");

CREATE TABLE IF NOT EXISTS "ClanInvite" (
  "id" TEXT NOT NULL,
  "clanId" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "status" "ClanApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "ClanInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClanInvite_clanId_fkey" FOREIGN KEY ("clanId")
    REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClanInvite_fromUserId_fkey" FOREIGN KEY ("fromUserId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClanInvite_toUserId_fkey" FOREIGN KEY ("toUserId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClanInvite_clanId_toUserId_key"
  ON "ClanInvite"("clanId", "toUserId");
CREATE INDEX IF NOT EXISTS "ClanInvite_toUserId_status_idx"
  ON "ClanInvite"("toUserId", "status");

CREATE TABLE IF NOT EXISTS "DailyRewardClaim" (
  "userId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "dayKey" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyRewardClaim_pkey" PRIMARY KEY ("userId", "cycleId", "dayIndex"),
  CONSTRAINT "DailyRewardClaim_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyRewardClaim_userId_dayKey_key"
  ON "DailyRewardClaim"("userId", "dayKey");
CREATE INDEX IF NOT EXISTS "DailyRewardClaim_userId_claimedAt_idx"
  ON "DailyRewardClaim"("userId", "claimedAt");

CREATE TABLE IF NOT EXISTS "WeeklyRewardClaim" (
  "userId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "milestone" INTEGER NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeeklyRewardClaim_pkey" PRIMARY KEY ("userId", "weekKey", "milestone"),
  CONSTRAINT "WeeklyRewardClaim_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WeeklyRewardClaim_userId_claimedAt_idx"
  ON "WeeklyRewardClaim"("userId", "claimedAt");

CREATE TABLE IF NOT EXISTS "EventMissionClaim" (
  "userId" TEXT NOT NULL,
  "eventCode" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EventMissionClaim_pkey" PRIMARY KEY ("userId", "eventCode", "missionId"),
  CONSTRAINT "EventMissionClaim_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EventMissionClaim_userId_claimedAt_idx"
  ON "EventMissionClaim"("userId", "claimedAt");

CREATE TABLE IF NOT EXISTS "RewardLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RewardLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardLedger_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RewardLedger_userId_createdAt_idx"
  ON "RewardLedger"("userId", "createdAt");
