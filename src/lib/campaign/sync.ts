import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  applyFarmingClear,
  applyGymBadgeUnlock,
  firstFarmableStage,
  parseStageClearCounts,
  resolveFarmingAfterStageComplete,
  type CampaignProgressRow,
} from "@/lib/campaign";
import { findLocation, findStage } from "@/lib/campaign/content";
import type { Prisma } from "@/generated/prisma/client";

function rowFromDb(row: {
  currentRegionId: string;
  highestUnlockedLocationId: string;
  selectedLocationId: string;
  farmingLocationId: string;
  farmingStageId: string;
  highestCompletedStageId: string | null;
  completedStageIds: string[];
  stageClearCounts: unknown;
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
    stageClearCounts: parseStageClearCounts(row.stageClearCounts),
    lastMilestoneId: row.lastMilestoneId,
  };
}

/** Mark farming stage clear progress after a wild win/catch; unlock when ready. */
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
    const { patch, completed } = applyFarmingClear(progress, stage.id);
    if (!Object.keys(patch).length) return;

    const farming = completed
      ? resolveFarmingAfterStageComplete(progress, stage.id, patch)
      : {};

    const { stageClearCounts, ...restPatch } = patch;
    await tx.campaignProgress.update({
      where: { userId },
      data: {
        ...restPatch,
        ...farming,
        ...(stageClearCounts !== undefined
          ? { stageClearCounts: stageClearCounts as Prisma.InputJsonValue }
          : {}),
      },
    });

    // Primera etapa limpia: Oak te da balls (no al elegir inicial, para no
    // capturar en el tutorial). Sólo al completar de verdad el primer stage.
    if (wasEmpty && completed) {
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
