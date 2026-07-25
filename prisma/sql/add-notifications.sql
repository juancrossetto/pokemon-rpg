-- Notifications inbox (Trading Hub / gyms / PvP)
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'MARKET_SOLD',
    'MARKET_EXPIRED',
    'GYM_WON',
    'GYM_LOST',
    'PVP_WON',
    'PVP_LOST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx"
  ON "Notification"("userId", "readAt");

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
