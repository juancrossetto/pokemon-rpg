-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_TRADE';

-- CreateTable
CREATE TABLE "FriendTradeOffer" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "pokemonInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendTradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendTradeOffer_pokemonInstanceId_key" ON "FriendTradeOffer"("pokemonInstanceId");

-- CreateIndex
CREATE INDEX "FriendTradeOffer_toUserId_createdAt_idx" ON "FriendTradeOffer"("toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FriendTradeOffer_fromUserId_idx" ON "FriendTradeOffer"("fromUserId");

-- AddForeignKey
ALTER TABLE "FriendTradeOffer" ADD CONSTRAINT "FriendTradeOffer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendTradeOffer" ADD CONSTRAINT "FriendTradeOffer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendTradeOffer" ADD CONSTRAINT "FriendTradeOffer_pokemonInstanceId_fkey" FOREIGN KEY ("pokemonInstanceId") REFERENCES "PokemonInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
