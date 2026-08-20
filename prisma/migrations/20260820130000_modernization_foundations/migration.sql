-- Alertas del mercado, Web Push y recompensas del pase mensual.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_WATCH';

CREATE TABLE "MarketWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "label" TEXT NOT NULL,
    "targetPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketWatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonRewardClaim" (
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonRewardClaim_pkey" PRIMARY KEY ("userId", "seasonKey", "milestone")
);

CREATE UNIQUE INDEX "MarketWatch_userId_targetKey_key" ON "MarketWatch"("userId", "targetKey");
CREATE INDEX "MarketWatch_targetKey_targetPrice_idx" ON "MarketWatch"("targetKey", "targetPrice");
CREATE INDEX "MarketWatch_userId_createdAt_idx" ON "MarketWatch"("userId", "createdAt");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "SeasonRewardClaim_userId_claimedAt_idx" ON "SeasonRewardClaim"("userId", "claimedAt");

ALTER TABLE "MarketWatch" ADD CONSTRAINT "MarketWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonRewardClaim" ADD CONSTRAINT "SeasonRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
