import { prisma } from "@/lib/prisma";
import {
  CAMPAIGN_DEFAULTS,
  getKantoLocation,
  getKantoStage,
  type CampaignProgressRow,
} from "@/lib/campaign";

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

/**
 * Ensure every user has a CampaignProgress row (lazy backfill for pre-campaign
 * accounts) **y que apunte a contenido que todavía existe**.
 *
 * Rebalancear una zona borra stages, y un jugador podía quedar farmeando un id
 * que ya no está: explorar respondía "no hay stage válido" y no había forma de
 * salir desde la UI. La reparación es silenciosa y va al primer stage disponible
 * de la zona (o al arranque del juego si la zona entera desapareció).
 */
export async function ensureCampaignProgress(userId: string): Promise<CampaignProgressRow> {
  const row = await prisma.campaignProgress.upsert({
    where: { userId },
    create: { userId, ...CAMPAIGN_DEFAULTS },
    // No-op on race / already exists — keep player progress.
    update: {},
  });

  const repair = repairPatch(toRow(row));
  if (!repair) return toRow(row);

  const fixed = await prisma.campaignProgress.update({
    where: { userId },
    data: repair,
  });
  return toRow(fixed);
}

/** Devuelve el patch necesario si el progreso apunta a contenido inexistente. */
function repairPatch(progress: CampaignProgressRow): Partial<CampaignProgressRow> | null {
  const location = getKantoLocation(progress.farmingLocationId);
  const stage = getKantoStage(progress.farmingStageId);
  if (location && stage && stage.locationId === location.id) return null;

  const fallbackLocation = location ?? getKantoLocation(CAMPAIGN_DEFAULTS.farmingLocationId);
  const fallbackStage =
    fallbackLocation?.stages.find((s) => !s.isGymMilestone) ?? fallbackLocation?.stages[0];

  if (!fallbackLocation || !fallbackStage) {
    return {
      farmingLocationId: CAMPAIGN_DEFAULTS.farmingLocationId,
      farmingStageId: CAMPAIGN_DEFAULTS.farmingStageId,
      selectedLocationId: CAMPAIGN_DEFAULTS.selectedLocationId,
    };
  }

  return {
    farmingLocationId: fallbackLocation.id,
    farmingStageId: fallbackStage.id,
    selectedLocationId: fallbackLocation.id,
  };
}
