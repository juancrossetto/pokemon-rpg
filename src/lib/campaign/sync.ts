import { prisma } from "@/lib/prisma";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  applyGymBadgeUnlock,
  applyStageCompletion,
  getKantoLocation,
  getKantoStage,
  isStageUnlocked,
} from "@/lib/campaign";

/** Mark farming stage complete after a wild win; unlock next location/stage. */
export async function completeFarmingStageOnWildWin(userId: string): Promise<void> {
  const progress = await ensureCampaignProgress(userId);
  const stage = getKantoStage(progress.farmingStageId);
  if (!stage || stage.isGymMilestone) return;

  const patch = applyStageCompletion(progress, stage.id);
  if (!Object.keys(patch).length) return;

  const merged = { ...progress, ...patch };
  const location = getKantoLocation(merged.farmingLocationId);
  let farmingStageId = merged.farmingStageId;
  let farmingLocationId = merged.farmingLocationId;
  let selectedLocationId = merged.selectedLocationId;

  if (location) {
    const nextInLoc = location.stages.find(
      (s) => s.order > stage.order && isStageUnlocked(s, merged),
    );
    if (nextInLoc) {
      farmingStageId = nextInLoc.id;
    } else if (patch.highestUnlockedLocationId) {
      const unlocked = getKantoLocation(patch.highestUnlockedLocationId);
      const first = unlocked?.stages[0];
      if (unlocked && first && unlocked.id !== location.id) {
        farmingLocationId = unlocked.id;
        selectedLocationId = unlocked.id;
        farmingStageId = first.id;
      }
    }
  }

  await prisma.campaignProgress.update({
    where: { userId },
    data: {
      ...patch,
      farmingStageId,
      farmingLocationId,
      selectedLocationId,
    },
  });
}

/** After earning a gym badge, sync campaign unlocks (does not change Gym.order math). */
export async function syncCampaignAfterGymBadge(
  userId: string,
  gymOrder: number,
): Promise<void> {
  const progress = await ensureCampaignProgress(userId);
  const patch = applyGymBadgeUnlock(progress, gymOrder);
  if (!Object.keys(patch).length) return;

  const merged = { ...progress, ...patch };
  let farmingStageId = merged.farmingStageId;
  let farmingLocationId = merged.farmingLocationId;
  let selectedLocationId = merged.selectedLocationId;

  if (patch.highestUnlockedLocationId) {
    const unlocked = getKantoLocation(patch.highestUnlockedLocationId);
    const first = unlocked?.stages.find((s) => !s.isGymMilestone) ?? unlocked?.stages[0];
    if (unlocked && first) {
      farmingLocationId = unlocked.id;
      selectedLocationId = unlocked.id;
      farmingStageId = first.id;
    }
  }

  await prisma.campaignProgress.update({
    where: { userId },
    data: {
      ...patch,
      farmingStageId,
      farmingLocationId,
      selectedLocationId,
    },
  });
}
