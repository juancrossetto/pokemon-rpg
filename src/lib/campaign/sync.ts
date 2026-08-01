import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  applyGymBadgeUnlock,
  applyStageCompletion,
  firstFarmableStage,
  getKantoLocation,
  getKantoStage,
  resolveFarmingAfterStageComplete,
  type CampaignProgressRow,
} from "@/lib/campaign";

function rowFromDb(row: {
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

/** Mark farming stage complete after a wild win/catch; unlock next location/stage. */
export async function completeFarmingStageOnWildWin(userId: string): Promise<void> {
  await ensureCampaignProgress(userId);

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const progress = rowFromDb(
      await tx.campaignProgress.findUniqueOrThrow({ where: { userId } }),
    );
    const stage = getKantoStage(progress.farmingStageId);
    if (!stage || stage.isGymMilestone) return;

    const patch = applyStageCompletion(progress, stage.id);
    if (!Object.keys(patch).length) return;

    const farming = resolveFarmingAfterStageComplete(progress, stage.id, patch);

    await tx.campaignProgress.update({
      where: { userId },
      data: {
        ...patch,
        ...farming,
      },
    });
  });
}

/** After earning a gym badge, sync campaign unlocks (does not change Gym.order math). */
export async function syncCampaignAfterGymBadge(
  userId: string,
  gymOrder: number,
): Promise<void> {
  await ensureCampaignProgress(userId);

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const progress = rowFromDb(
      await tx.campaignProgress.findUniqueOrThrow({ where: { userId } }),
    );
    const patch = applyGymBadgeUnlock(progress, gymOrder);
    if (!Object.keys(patch).length) return;

    const merged = { ...progress, ...patch };
    let farmingStageId = merged.farmingStageId;
    let farmingLocationId = merged.farmingLocationId;
    let selectedLocationId = merged.selectedLocationId;

    if (patch.highestUnlockedLocationId) {
      const unlocked = getKantoLocation(patch.highestUnlockedLocationId);
      const first = unlocked ? firstFarmableStage(unlocked.id) : null;
      if (unlocked && first) {
        farmingLocationId = unlocked.id;
        selectedLocationId = unlocked.id;
        farmingStageId = first.id;
      } else if (unlocked) {
        selectedLocationId = unlocked.id;
      }
    }

    await tx.campaignProgress.update({
      where: { userId },
      data: {
        ...patch,
        farmingStageId,
        farmingLocationId,
        selectedLocationId,
      },
    });
  });
}
