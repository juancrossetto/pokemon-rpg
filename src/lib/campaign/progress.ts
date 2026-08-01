import {
  DEFAULT_FARMING_LOCATION_ID,
  DEFAULT_FARMING_STAGE_ID,
  DEFAULT_REGION_ID,
  DEFAULT_SELECTED_LOCATION_ID,
  DEFAULT_UNLOCKED_LOCATION_ID,
  KANTO_REGION,
  allKantoStages,
  getKantoLocation,
  getKantoStage,
} from "./kanto";
import { campaignMapSrc } from "./maps";
import { regionMapSrc } from "./regions";
import { pickWeightedSpecies } from "./rarity";
import type {
  CampaignLocation,
  CampaignMilestone,
  CampaignRegion,
  CampaignRegionId,
  CampaignStage,
} from "./types";

export type CampaignProgressRow = {
  currentRegionId: string;
  highestUnlockedLocationId: string;
  selectedLocationId: string;
  farmingLocationId: string;
  farmingStageId: string;
  highestCompletedStageId: string | null;
  completedStageIds: string[];
  lastMilestoneId: string | null;
};

export const CAMPAIGN_DEFAULTS = {
  currentRegionId: DEFAULT_REGION_ID,
  highestUnlockedLocationId: DEFAULT_UNLOCKED_LOCATION_ID,
  selectedLocationId: DEFAULT_SELECTED_LOCATION_ID,
  farmingLocationId: DEFAULT_FARMING_LOCATION_ID,
  farmingStageId: DEFAULT_FARMING_STAGE_ID,
  highestCompletedStageId: null as string | null,
  completedStageIds: [] as string[],
  lastMilestoneId: null as string | null,
} as const;

/**
 * Locations de una región. Hoy solo Kanto tiene contenido; el resto devuelve
 * una región vacía en vez de mentir con las locations de Kanto — cuando se
 * carguen sus stages, se agregan acá.
 */
export function getRegion(regionId: CampaignRegionId = "kanto"): CampaignRegion {
  if (regionId === "kanto") return KANTO_REGION;
  return { id: regionId, nameKey: `regions.${regionId}`, locations: [] };
}

export function locationOrderIndex(locationId: string): number {
  const loc = getKantoLocation(locationId);
  return loc?.order ?? -1;
}

export function isLocationUnlocked(
  locationId: string,
  progress: Pick<CampaignProgressRow, "highestUnlockedLocationId">,
): boolean {
  const highest = getKantoLocation(progress.highestUnlockedLocationId);
  const target = getKantoLocation(locationId);
  if (!highest || !target) return false;
  return target.order <= highest.order;
}

export function isStageCompleted(
  stageId: string,
  progress: Pick<CampaignProgressRow, "completedStageIds">,
): boolean {
  return progress.completedStageIds.includes(stageId);
}

/** Stage is farmable if its location is unlocked and all prior stages in that location are done (or it is the first). */
export function isStageUnlocked(
  stage: CampaignStage,
  progress: Pick<CampaignProgressRow, "highestUnlockedLocationId" | "completedStageIds">,
): boolean {
  if (!isLocationUnlocked(stage.locationId, progress)) return false;
  const location = getKantoLocation(stage.locationId);
  if (!location) return false;
  const prior = location.stages.filter((s) => s.order < stage.order);
  return prior.every((s) => progress.completedStageIds.includes(s.id));
}

export function journeyProgressPercent(
  progress: Pick<CampaignProgressRow, "completedStageIds">,
): number {
  const stages = allKantoStages().filter((s) => !s.isGymMilestone);
  if (stages.length === 0) return 0;
  const done = stages.filter((s) => progress.completedStageIds.includes(s.id)).length;
  return Math.round((done / stages.length) * 100);
}

export function nextMilestone(
  progress: CampaignProgressRow,
  earnedGymOrders: number[],
): CampaignMilestone {
  const gymSet = new Set(earnedGymOrders);

  for (const loc of KANTO_REGION.locations) {
    if (!isLocationUnlocked(loc.id, progress)) {
      return {
        kind: "stage",
        id: `unlock-${loc.id}`,
        locationId: loc.id,
        stageId: loc.stages[0]?.id ?? loc.id,
        nameKey: loc.nameKey,
      };
    }

    if (loc.kind === "gym" && loc.requiresGymOrder != null) {
      if (!gymSet.has(loc.requiresGymOrder)) {
        return {
          kind: "gym",
          id: `gym-${loc.requiresGymOrder}`,
          locationId: loc.id,
          gymOrder: loc.requiresGymOrder,
          nameKey: loc.nameKey,
        };
      }
    }

    for (const stage of loc.stages) {
      if (stage.isGymMilestone) {
        if (stage.gymOrder != null && !gymSet.has(stage.gymOrder)) {
          return {
            kind: "gym",
            id: `gym-${stage.gymOrder}`,
            locationId: loc.id,
            gymOrder: stage.gymOrder,
            nameKey: stage.nameKey,
          };
        }
        continue;
      }
      if (!progress.completedStageIds.includes(stage.id)) {
        return {
          kind: "stage",
          id: stage.id,
          locationId: loc.id,
          stageId: stage.id,
          nameKey: stage.nameKey,
        };
      }
    }
  }

  return { kind: "complete", id: "region-complete", nameKey: "milestones.region_complete" };
}

export function resolveSpawn(stage: CampaignStage): { speciesId: number; level: number } {
  // Ponderado por rareza: antes todas las especies del stage salían igual, así
  // que un Pikachu aparecía tanto como un Rattata y no había nada que "buscar".
  const speciesId = pickWeightedSpecies(stage.spawnSpeciesIds) ?? 16;
  const span = Math.max(0, stage.levelMax - stage.levelMin);
  const level = stage.levelMin + Math.floor(Math.random() * (span + 1));
  return { speciesId, level: Math.max(2, level) };
}

export function unlockLocationIdAfter(
  currentHighestId: string,
  candidateId: string | undefined,
): string {
  if (!candidateId) return currentHighestId;
  const current = getKantoLocation(currentHighestId);
  const next = getKantoLocation(candidateId);
  if (!current || !next) return currentHighestId;
  return next.order > current.order ? candidateId : currentHighestId;
}

/**
 * Stages salvajes del capítulo que cierra el gimnasio `gymOrder`.
 * Misma partición que `buildChapters`: cada medalla 1–8 corta el tramo;
 * el Alto Mando (orden > 8) no resetea el buffer entre sí.
 */
export function chapterWildStagesForGym(gymOrder: number): CampaignStage[] {
  let current: CampaignLocation[] = [];
  for (const loc of KANTO_REGION.locations) {
    current.push(loc);
    if (loc.kind !== "gym" || loc.requiresGymOrder == null) continue;
    const order = loc.requiresGymOrder;
    if (order === gymOrder) {
      return current
        .filter((z) => z.id !== loc.id)
        .flatMap((z) => z.stages.filter((s) => !s.isGymMilestone));
    }
    if (order <= 8) current = [];
  }
  return [];
}

/** Sin stages salvajes pendientes en el capítulo → se puede desafiar el gimnasio. */
export function areChapterStagesCompleteForGym(
  gymOrder: number,
  completedStageIds: readonly string[],
): boolean {
  const stages = chapterWildStagesForGym(gymOrder);
  if (stages.length === 0) return true;
  const done = new Set(completedStageIds);
  return stages.every((s) => done.has(s.id));
}

export function applyStageCompletion(
  progress: CampaignProgressRow,
  stageId: string,
): Partial<CampaignProgressRow> {
  const stage = getKantoStage(stageId);
  if (!stage || progress.completedStageIds.includes(stageId)) {
    return {};
  }

  const completedStageIds = [...progress.completedStageIds, stageId];
  let highestCompletedStageId = progress.highestCompletedStageId;
  const prev = highestCompletedStageId ? getKantoStage(highestCompletedStageId) : null;
  if (!prev || stage.order >= prev.order) {
    highestCompletedStageId = stageId;
  }

  const highestUnlockedLocationId = unlockLocationIdAfter(
    progress.highestUnlockedLocationId,
    stage.unlocksLocationId,
  );

  return {
    completedStageIds,
    highestCompletedStageId,
    highestUnlockedLocationId,
    lastMilestoneId: stageId,
  };
}

/** Primer stage farmeable (no milestone de gym) de una ubicación. */
export function firstFarmableStage(locationId: string): CampaignStage | null {
  const loc = getKantoLocation(locationId);
  return loc?.stages.find((s) => !s.isGymMilestone) ?? null;
}

/**
 * Tras completar un stage, elige farming/selection siguientes.
 * Nunca apunta a un gym milestone (esas pelea van por `/gyms`).
 */
export function resolveFarmingAfterStageComplete(
  progress: CampaignProgressRow,
  completedStageId: string,
  patch: Partial<CampaignProgressRow>,
): Pick<
  CampaignProgressRow,
  "farmingStageId" | "farmingLocationId" | "selectedLocationId"
> {
  const merged = { ...progress, ...patch };
  const stage = getKantoStage(completedStageId);
  const location = stage ? getKantoLocation(merged.farmingLocationId) : null;

  let farmingStageId = merged.farmingStageId;
  let farmingLocationId = merged.farmingLocationId;
  let selectedLocationId = merged.selectedLocationId;

  if (location && stage) {
    const nextInLoc = location.stages.find(
      (s) => s.order > stage.order && !s.isGymMilestone && isStageUnlocked(s, merged),
    );
    if (nextInLoc) {
      farmingStageId = nextInLoc.id;
    } else if (patch.highestUnlockedLocationId) {
      const unlocked = getKantoLocation(patch.highestUnlockedLocationId);
      const first = unlocked ? firstFarmableStage(unlocked.id) : null;
      if (unlocked && first && unlocked.id !== location.id) {
        farmingLocationId = unlocked.id;
        selectedLocationId = unlocked.id;
        farmingStageId = first.id;
      } else if (unlocked && unlocked.id !== location.id) {
        // Gym hub u otra zona sin salvajes: seleccioná la zona, seguí farmeando acá.
        selectedLocationId = unlocked.id;
      }
    }
  }

  return { farmingStageId, farmingLocationId, selectedLocationId };
}

/**
 * Patch de reparación si el progreso apunta a contenido inexistente o a un
 * gym milestone. Usado por `ensureCampaignProgress` y testeable sin Prisma.
 */
export function repairCampaignProgressPatch(
  progress: CampaignProgressRow,
): Partial<CampaignProgressRow> | null {
  const location = getKantoLocation(progress.farmingLocationId);
  const stage = getKantoStage(progress.farmingStageId);
  if (location && stage && stage.locationId === location.id && !stage.isGymMilestone) {
    return null;
  }

  for (let i = progress.completedStageIds.length - 1; i >= 0; i--) {
    const done = getKantoStage(progress.completedStageIds[i]!);
    if (done && !done.isGymMilestone) {
      return {
        farmingLocationId: done.locationId,
        farmingStageId: done.id,
        selectedLocationId: progress.selectedLocationId,
      };
    }
  }

  const fallbackLocation =
    (location?.stages.some((s) => !s.isGymMilestone) ? location : null) ??
    getKantoLocation(CAMPAIGN_DEFAULTS.farmingLocationId);
  const fallbackStage = fallbackLocation?.stages.find((s) => !s.isGymMilestone) ?? null;

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
    selectedLocationId: progress.selectedLocationId || fallbackLocation.id,
  };
}

/** After earning a gym badge, mark gym milestone stage complete and unlock next. */
export function applyGymBadgeUnlock(
  progress: CampaignProgressRow,
  gymOrder: number,
): Partial<CampaignProgressRow> {
  const stage = allKantoStages().find((s) => s.isGymMilestone && s.gymOrder === gymOrder);
  if (!stage) return {};
  return applyStageCompletion(progress, stage.id);
}

export type ExpeditionView = {
  regionId: string;
  location: CampaignLocation;
  stage: CampaignStage;
  /** Mapa de la location (detalle). */
  mapSrc: string;
  /** Mapa de la región completa — el que se ve en el dashboard. */
  regionMapSrc: string;
  journeyPercent: number;
  milestone: CampaignMilestone;
  selectedLocation: CampaignLocation;
};

export function buildExpeditionView(
  progress: CampaignProgressRow,
  earnedGymOrders: number[],
): ExpeditionView | null {
  const location = getKantoLocation(progress.farmingLocationId);
  const stage = getKantoStage(progress.farmingStageId);
  const selectedLocation = getKantoLocation(progress.selectedLocationId);
  if (!location || !stage || !selectedLocation) return null;

  return {
    regionId: progress.currentRegionId,
    location,
    stage,
    mapSrc: campaignMapSrc(location.id),
    regionMapSrc: regionMapSrc(progress.currentRegionId),
    journeyPercent: journeyProgressPercent(progress),
    milestone: nextMilestone(progress, earnedGymOrders),
    selectedLocation,
  };
}

export function listLocationsForUi(progress: CampaignProgressRow) {
  return KANTO_REGION.locations.map((loc) => ({
    location: loc,
    unlocked: isLocationUnlocked(loc.id, progress),
    completedStages: loc.stages.filter((s) => progress.completedStageIds.includes(s.id)).length,
    totalStages: loc.stages.filter((s) => !s.isGymMilestone).length || loc.stages.length,
  }));
}
