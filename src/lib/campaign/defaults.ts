import { DEFAULT_REGION_ID, REGIONS } from "@/lib/regions";

const kanto = REGIONS.kanto.defaults;

/**
 * Defaults de progreso de campaña (región jugable inicial = Kanto).
 * Separado de `progress.ts` para que `ensure` / register puedan importarlos
 * sin arrastrar el resto del dominio.
 */
export const CAMPAIGN_DEFAULTS = {
  currentRegionId: DEFAULT_REGION_ID,
  highestUnlockedLocationId: kanto.highestUnlockedLocationId,
  selectedLocationId: kanto.selectedLocationId,
  farmingLocationId: kanto.farmingLocationId,
  farmingStageId: kanto.farmingStageId,
  highestCompletedStageId: null as string | null,
  completedStageIds: [] as string[],
  stageClearCounts: {} as Record<string, number>,
  lastMilestoneId: null as string | null,
} as const;
