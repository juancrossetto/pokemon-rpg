-- Friends graph: requests, friendships, blocks + presence
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "FriendRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FriendRequest" (
  "id" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FriendRequest_fromUserId_toUserId_key"
  ON "FriendRequest"("fromUserId", "toUserId");
CREATE INDEX IF NOT EXISTS "FriendRequest_toUserId_status_idx"
  ON "FriendRequest"("toUserId", "status");
CREATE INDEX IF NOT EXISTS "FriendRequest_fromUserId_status_idx"
  ON "FriendRequest"("fromUserId", "status");

DO $$ BEGIN
  ALTER TABLE "FriendRequest"
    ADD CONSTRAINT "FriendRequest_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FriendRequest"
    ADD CONSTRAINT "FriendRequest_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Friendship" (
  "id" TEXT NOT NULL,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "favoriteForA" BOOLEAN NOT NULL DEFAULT false,
  "favoriteForB" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_userAId_userBId_key"
  ON "Friendship"("userAId", "userBId");
CREATE INDEX IF NOT EXISTS "Friendship_userAId_idx" ON "Friendship"("userAId");
CREATE INDEX IF NOT EXISTS "Friendship_userBId_idx" ON "Friendship"("userBId");

DO $$ BEGIN
  ALTER TABLE "Friendship"
    ADD CONSTRAINT "Friendship_userAId_fkey"
    FOREIGN KEY ("userAId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Friendship"
    ADD CONSTRAINT "Friendship_userBId_fkey"
    FOREIGN KEY ("userBId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key"
  ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

DO $$ BEGIN
  ALTER TABLE "UserBlock"
    ADD CONSTRAINT "UserBlock_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserBlock"
    ADD CONSTRAINT "UserBlock_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
