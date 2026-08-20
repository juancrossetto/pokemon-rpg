"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  CAMPAIGN_DEFAULTS,
  findLocation,
  findStage,
  isLocationUnlocked,
  isStageUnlocked,
  journeyProgressPercent,
} from "@/lib/campaign";
import { regionDefaults } from "@/lib/regions";
import { lockUsers } from "@/lib/db-locks";

export type CampaignActionResult =
  | { success: true }
  | { success: false; error: "unauthorized" | "locked" | "invalid" | "dev_only" };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function revalidateCampaign(locale?: string) {
  if (locale) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/battle`);
    revalidatePath(`/${locale}/campaign`);
  } else {
    revalidatePath("/");
    revalidatePath("/battle");
    revalidatePath("/campaign");
  }
}

export async function selectLocation(
  locationId: string,
  locale: string,
): Promise<CampaignActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "unauthorized" };

  const location = findLocation(locationId)?.location;
  if (!location) return { success: false, error: "invalid" };

  const progress = await ensureCampaignProgress(userId);
  if (!isLocationUnlocked(locationId, progress)) {
    return { success: false, error: "locked" };
  }

  const firstStage =
    location.stages.find((s) => !s.isGymMilestone) ?? location.stages[0];
  if (!firstStage) return { success: false, error: "invalid" };

  // Gym hubs: select location for UI, but farm stays on previous wild stage if this is gym-only.
  if (firstStage.isGymMilestone) {
    await prisma.campaignProgress.update({
      where: { userId },
      data: { selectedLocationId: locationId },
    });
    revalidateCampaign(locale);
    return { success: true };
  }

  await prisma.campaignProgress.update({
    where: { userId },
    data: {
      selectedLocationId: locationId,
      farmingLocationId: locationId,
      farmingStageId: firstStage.id,
    },
  });

  revalidateCampaign(locale);
  return { success: true };
}

export async function setFarmingStage(
  stageId: string,
  locale: string,
): Promise<CampaignActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "unauthorized" };

  const stage = findStage(stageId)?.stage;
  if (!stage) return { success: false, error: "invalid" };

  if (stage.isGymMilestone) return { success: false, error: "invalid" };

  const progress = await ensureCampaignProgress(userId);
  if (!isStageUnlocked(stage, progress)) {
    return { success: false, error: "locked" };
  }

  await prisma.campaignProgress.update({
    where: { userId },
    data: {
      selectedLocationId: stage.locationId,
      farmingLocationId: stage.locationId,
      farmingStageId: stage.id,
    },
  });

  revalidateCampaign(locale);
  return { success: true };
}

/** Abre la segunda liga una vez completado el recorrido y las 8 medallas de Kanto. */
export async function startJohto(locale: string): Promise<CampaignActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "unauthorized" };
  await ensureCampaignProgress(userId);
  let unlocked = false;
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const [progress, badges] = await Promise.all([
      tx.campaignProgress.findUniqueOrThrow({ where: { userId } }),
      tx.badge.count({ where: { userId, gym: { regionId: "kanto", isElite: false } } }),
    ]);
    if (progress.currentRegionId !== "kanto" || badges < 8 || journeyProgressPercent(progress) < 100) return;
    const defaults = regionDefaults("johto");
    await tx.campaignProgress.update({
      where: { userId },
      data: { currentRegionId: "johto", ...defaults, lastMilestoneId: "region:johto" },
    });
    unlocked = true;
  });
  if (!unlocked) return { success: false, error: "locked" };
  revalidateCampaign(locale);
  return { success: true };
}

export async function startJohtoFromForm(locale: string, formData: FormData): Promise<void> {
  void formData;
  await startJohto(locale);
}

export async function devSetCampaignProgress(
  patch: Partial<{
    highestUnlockedLocationId: string;
    selectedLocationId: string;
    farmingLocationId: string;
    farmingStageId: string;
    completedStageIds: string[];
    highestCompletedStageId: string | null;
    reset: boolean;
  }>,
  locale: string,
): Promise<CampaignActionResult> {
  if (process.env.NODE_ENV !== "development") {
    return { success: false, error: "dev_only" };
  }

  const userId = await requireUserId();
  if (!userId) return { success: false, error: "unauthorized" };

  await ensureCampaignProgress(userId);

  if (patch.reset) {
    await prisma.campaignProgress.update({
      where: { userId },
      data: { ...CAMPAIGN_DEFAULTS },
    });
    revalidateCampaign(locale);
    return { success: true };
  }

  const data: Record<string, unknown> = {};
  if (patch.highestUnlockedLocationId) {
    if (!findLocation(patch.highestUnlockedLocationId)) {
      return { success: false, error: "invalid" };
    }
    data.highestUnlockedLocationId = patch.highestUnlockedLocationId;
  }
  if (patch.selectedLocationId) {
    if (!findLocation(patch.selectedLocationId)) {
      return { success: false, error: "invalid" };
    }
    data.selectedLocationId = patch.selectedLocationId;
  }
  if (patch.farmingLocationId) {
    if (!findLocation(patch.farmingLocationId)) {
      return { success: false, error: "invalid" };
    }
    data.farmingLocationId = patch.farmingLocationId;
  }
  if (patch.farmingStageId) {
    if (!findStage(patch.farmingStageId)) {
      return { success: false, error: "invalid" };
    }
    data.farmingStageId = patch.farmingStageId;
  }
  if (patch.completedStageIds) {
    data.completedStageIds = patch.completedStageIds;
  }
  if (patch.highestCompletedStageId !== undefined) {
    data.highestCompletedStageId = patch.highestCompletedStageId;
  }

  await prisma.campaignProgress.update({ where: { userId }, data });
  revalidateCampaign(locale);
  return { success: true };
}

// Ojo: este archivo es "use server". Un `export type { X }` re-exportando un
// binding importado sobrevive como referencia de runtime en el loader de server
// actions y tira "X is not defined" al evaluar el módulo. El tipo ya se exporta
// desde `@/lib/campaign` — importalo de ahí.
