-- CreateTable
CREATE TABLE "AchievementClaim" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementClaim_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateIndex
CREATE INDEX "AchievementClaim_userId_claimedAt_idx" ON "AchievementClaim"("userId", "claimedAt");

-- AddForeignKey
ALTER TABLE "AchievementClaim" ADD CONSTRAINT "AchievementClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
