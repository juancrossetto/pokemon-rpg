import { prisma } from "@/lib/prisma";
import { CAMPAIGN_DEFAULTS, type CampaignProgressRow } from "@/lib/campaign";

function toRow(row: {
  currentRegionId: string;
  highestUnlockedLocationId: string;
  selectedLocationId: string;
  farmingLocationId: string;
  farmingStageId: string;
  highestCompletedStageId: string | null;
  completedStageIds: string[];
  lastMilestoneId: string | null;
}): CampaignProgressRow {
  return {
    currentRegionId: row.currentRegionId,
    highestUnlockedLocationId: row.highestUnlockedLocationId,
    selectedLocationId: row.selectedLocationId,
    farmingLocationId: row.farmingLocationId,
    farmingStageId: row.farmingStageId,
    highestCompletedStageId: row.highestCompletedStageId,
    completedStageIds: row.completedStageIds,
    lastMilestoneId: row.lastMilestoneId,
  };
}

/** Ensure every user has a CampaignProgress row (lazy backfill for pre-campaign accounts). */
export async function ensureCampaignProgress(userId: string): Promise<CampaignProgressRow> {
  const row = await prisma.campaignProgress.upsert({
    where: { userId },
    create: { userId, ...CAMPAIGN_DEFAULTS },
    // No-op on race / already exists — keep player progress.
    update: {},
  });
  return toRow(row);
}
