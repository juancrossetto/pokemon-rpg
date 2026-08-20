import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  CAMPAIGN_DEFAULTS,
  parseStageClearCounts,
  repairCampaignProgressPatch,
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
  stageClearCounts?: unknown;
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

/**
 * Ensure every user has a CampaignProgress row (lazy backfill for pre-campaign
 * accounts) **y que apunte a contenido que todavía existe**.
 *
 * Rebalancear una zona borra stages, y un jugador podía quedar farmeando un id
 * que ya no está: explorar respondía "no hay stage válido" y no había forma de
 * salir desde la UI. La reparación es silenciosa y va al primer stage disponible
 * de la zona (o al arranque del juego si la zona entera desapareció).
 */
async function loadCampaignProgress(userId: string): Promise<CampaignProgressRow> {
  let row = await prisma.campaignProgress.findUnique({ where: { userId } });

  if (!row) {
    // Backfill único para cuentas antiguas. `createMany + skipDuplicates`
    // conserva la seguridad ante dos requests iniciales simultáneos sin
    // convertir cada lectura normal en un UPSERT (escritura + lock).
    await prisma.campaignProgress.createMany({
      data: [{ userId, ...CAMPAIGN_DEFAULTS }],
      skipDuplicates: true,
    });
    row = await prisma.campaignProgress.findUniqueOrThrow({ where: { userId } });
  }

  const repair = repairCampaignProgressPatch(toRow(row));
  if (!repair) return toRow(row);

  const fixed = await prisma.campaignProgress.update({
    where: { userId },
    data: repair,
  });
  return toRow(fixed);
}

/** Una sola lectura por usuario y request, aunque layout y página la pidan. */
export const ensureCampaignProgress = cache(loadCampaignProgress);
