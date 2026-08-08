import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  applyGymBadgeUnlock,
  applyStageCompletion,
  firstFarmableStage,
  resolveFarmingAfterStageComplete,
  type CampaignProgressRow,
} from "@/lib/campaign";
import { findLocation, findStage } from "@/lib/campaign/content";

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
    const stage = findStage(progress.farmingStageId)?.stage;
    if (!stage || stage.isGymMilestone) return;

    const wasEmpty = progress.completedStageIds.length === 0;
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

    // Primera etapa limpia: Oak te da balls (no al elegir inicial, para no
    // capturar en el tutorial).
    if (wasEmpty) {
      const pokeBall = await tx.item.findUnique({
        where: { name: "Poke Ball" },
        select: { id: true },
      });
      if (pokeBall) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId: pokeBall.id } },
          create: { userId, itemId: pokeBall.id, quantity: 5 },
          update: { quantity: { increment: 5 } },
        });
      }
    }
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
      const unlocked = findLocation(patch.highestUnlockedLocationId)?.location;
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
