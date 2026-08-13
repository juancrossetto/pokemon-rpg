import {
  allStages,
  findLocation,
  findStage,
  getLocation,
  getStage,
  regionBadgeTargetFor,
  regionContent,
  resolveProgressRegionId,
} from "./content";
import { CAMPAIGN_DEFAULTS as REGION_CAMPAIGN_DEFAULTS } from "./defaults";
import { campaignMapSrc } from "./maps";
import { regionMapSrc } from "./regions";
import { pickWeightedSpecies } from "./rarity";
import { areLocationTrainersDefeated } from "./trainers";
import type {
  CampaignLocation,
  CampaignMilestone,
  CampaignRegion,
  CampaignRegionId,
  CampaignStage,
} from "./types";

/** IDs de `TrainerDefeat` para decidir si una zona puede abrir la siguiente. */
export type CampaignUnlockContext = {
  defeatedTrainerIds?: readonly string[];
};

export type CampaignProgressRow = {
  currentRegionId: string;
  highestUnlockedLocationId: string;
  selectedLocationId: string;
  farmingLocationId: string;
  farmingStageId: string;
  highestCompletedStageId: string | null;
  completedStageIds: string[];
  /** Progreso parcial hacia `clearsRequired` del stage activo. */
  stageClearCounts: Record<string, number>;
  lastMilestoneId: string | null;
};

/** Victorias/capturas necesarias para completar un stage (mínimo 1). */
export function stageClearsRequired(stage: Pick<CampaignStage, "clearsRequired">): number {
  return Math.max(1, stage.clearsRequired ?? 1);
}

export function parseStageClearCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = Math.floor(value);
    }
  }
  return out;
}

/**
 * Suma una victoria/captura al stage de farming. Si llega a `clearsRequired`,
 * aplica el clear completo (unlocks, completedStageIds, etc.).
 */
export function applyFarmingClear(
  progress: CampaignProgressRow,
  stageId: string,
  unlock?: CampaignUnlockContext,
): {
  patch: Partial<CampaignProgressRow>;
  completed: boolean;
  clears: number;
  required: number;
} {
  const regionId = regionIdOf(progress);
  const stage = getStage(regionId, stageId) ?? findStage(stageId)?.stage;
  if (!stage || stage.isGymMilestone || progress.completedStageIds.includes(stageId)) {
    return { patch: {}, completed: false, clears: 0, required: 1 };
  }

  const required = stageClearsRequired(stage);
  const clears = (progress.stageClearCounts[stageId] ?? 0) + 1;

  if (clears < required) {
    return {
      patch: {
        stageClearCounts: { ...progress.stageClearCounts, [stageId]: clears },
      },
      completed: false,
      clears,
      required,
    };
  }

  const nextCounts = { ...progress.stageClearCounts };
  delete nextCounts[stageId];
  const completion = applyStageCompletion(
    { ...progress, stageClearCounts: nextCounts },
    stageId,
    unlock,
  );
  return {
    patch: { ...completion, stageClearCounts: nextCounts },
    completed: true,
    clears: required,
    required,
  };
}

export const CAMPAIGN_DEFAULTS = REGION_CAMPAIGN_DEFAULTS;

function regionIdOf(progress: Pick<CampaignProgressRow, "currentRegionId"> &
  Partial<Pick<CampaignProgressRow, "farmingLocationId" | "selectedLocationId">>): CampaignRegionId {
  return resolveProgressRegionId(progress);
}

/**
 * Locations de una región. Regiones sin pack cargado devuelven locations [].
 */
export function getRegion(regionId: CampaignRegionId = "kanto"): CampaignRegion {
  return regionContent(regionId);
}

export function locationOrderIndex(locationId: string): number {
  return findLocation(locationId)?.location.order ?? -1;
}

export function isLocationUnlocked(
  locationId: string,
  progress: Pick<CampaignProgressRow, "highestUnlockedLocationId" | "currentRegionId">,
): boolean {
  const regionId = regionIdOf(progress);
  const highest = getLocation(regionId, progress.highestUnlockedLocationId)
    ?? findLocation(progress.highestUnlockedLocationId)?.location;
  const target = getLocation(regionId, locationId) ?? findLocation(locationId)?.location;
  if (!highest || !target) return false;
  if (highest.regionId !== target.regionId) return false;
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
  progress: Pick<
    CampaignProgressRow,
    "highestUnlockedLocationId" | "completedStageIds" | "currentRegionId"
  >,
): boolean {
  if (!isLocationUnlocked(stage.locationId, progress)) return false;
  const regionId = regionIdOf(progress);
  const location =
    getLocation(regionId, stage.locationId) ?? findLocation(stage.locationId)?.location;
  if (!location) return false;
  const prior = location.stages.filter((s) => s.order < stage.order);
  return prior.every((s) => progress.completedStageIds.includes(s.id));
}

export function journeyProgressPercent(
  progress: Pick<CampaignProgressRow, "completedStageIds" | "currentRegionId">,
): number {
  const regionId = regionIdOf(progress);
  const stages = allStages(regionId).filter((s) => !s.isGymMilestone);
  if (stages.length === 0) return 0;
  const done = stages.filter((s) => progress.completedStageIds.includes(s.id)).length;
  return Math.round((done / stages.length) * 100);
}

export function nextMilestone(
  progress: CampaignProgressRow,
  earnedGymOrders: number[],
  defeatedTrainerIds?: readonly string[],
): CampaignMilestone {
  const gymSet = new Set(earnedGymOrders);
  const region = regionContent(regionIdOf(progress));

  for (const loc of region.locations) {
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

    // Stages limpios no cierran la zona si quedan entrenadores: el CTA
    // se queda acá en vez de saltar a la siguiente location.
    if (
      defeatedTrainerIds &&
      !areLocationTrainersDefeated(loc.id, defeatedTrainerIds)
    ) {
      const lastWild =
        [...loc.stages].reverse().find((s) => !s.isGymMilestone) ?? loc.stages.at(-1);
      return {
        kind: "stage",
        id: `trainers-${loc.id}`,
        locationId: loc.id,
        stageId: lastWild?.id ?? loc.id,
        nameKey: loc.nameKey,
      };
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
  const current = findLocation(currentHighestId)?.location;
  const next = findLocation(candidateId)?.location;
  if (!current || !next) return currentHighestId;
  if (current.regionId !== next.regionId) return currentHighestId;
  return next.order > current.order ? candidateId : currentHighestId;
}

/**
 * Stages salvajes del capítulo que cierra el gimnasio `gymOrder`.
 * Misma partición que `buildChapters`: cada medalla 1..badgeTarget corta el tramo;
 * el Alto Mando (orden > badgeTarget) no resetea el buffer entre sí.
 */
export function chapterWildStagesForGym(
  gymOrder: number,
  regionId: string = "kanto",
): CampaignStage[] {
  const badgeTarget = regionBadgeTargetFor(regionId);
  const region = regionContent(regionId);
  let current: CampaignLocation[] = [];
  for (const loc of region.locations) {
    current.push(loc);
    if (loc.kind !== "gym" || loc.requiresGymOrder == null) continue;
    const order = loc.requiresGymOrder;
    if (order === gymOrder) {
      return current
        .filter((z) => z.id !== loc.id)
        .flatMap((z) => z.stages.filter((s) => !s.isGymMilestone));
    }
    if (order <= badgeTarget) current = [];
  }
  return [];
}

/** Sin stages salvajes pendientes en el capítulo → se puede desafiar el gimnasio. */
export function areChapterStagesCompleteForGym(
  gymOrder: number,
  completedStageIds: readonly string[],
  regionId: string = "kanto",
): boolean {
  const stages = chapterWildStagesForGym(gymOrder, regionId);
  if (stages.length === 0) return true;
  const done = new Set(completedStageIds);
  return stages.every((s) => done.has(s.id));
}

export function applyStageCompletion(
  progress: CampaignProgressRow,
  stageId: string,
  unlock?: CampaignUnlockContext,
): Partial<CampaignProgressRow> {
  const regionId = regionIdOf(progress);
  const stage = getStage(regionId, stageId) ?? findStage(stageId)?.stage;
  if (!stage || progress.completedStageIds.includes(stageId)) {
    return {};
  }

  const completedStageIds = [...progress.completedStageIds, stageId];
  let highestCompletedStageId = progress.highestCompletedStageId;
  const prevId = highestCompletedStageId;
  const prev = prevId
    ? (getStage(regionId, prevId) ?? findStage(prevId)?.stage)
    : null;
  if (!prev || stage.order >= prev.order) {
    highestCompletedStageId = stageId;
  }

  const trainersCleared = areLocationTrainersDefeated(
    stage.locationId,
    unlock?.defeatedTrainerIds ?? [],
  );
  const highestUnlockedLocationId = trainersCleared
    ? unlockLocationIdAfter(
        progress.highestUnlockedLocationId,
        stage.unlocksLocationId,
      )
    : progress.highestUnlockedLocationId;

  return {
    completedStageIds,
    highestCompletedStageId,
    highestUnlockedLocationId,
    lastMilestoneId: stageId,
  };
}

/**
 * Tras vencer al último entrenador de una zona cuyos stages ya están hechos,
 * abre la location que el último stage tenía pendiente.
 */
export function applyTrainerVictoryUnlock(
  progress: CampaignProgressRow,
  locationId: string,
  defeatedTrainerIds: readonly string[],
): Partial<CampaignProgressRow> {
  if (!areLocationTrainersDefeated(locationId, defeatedTrainerIds)) {
    return {};
  }

  const loc = findLocation(locationId)?.location;
  if (!loc) return {};

  const wild = loc.stages.filter((s) => !s.isGymMilestone);
  if (wild.some((s) => !progress.completedStageIds.includes(s.id))) {
    return {};
  }

  const unlockStage = [...wild].reverse().find((s) => s.unlocksLocationId);
  if (!unlockStage?.unlocksLocationId) return {};

  const highestUnlockedLocationId = unlockLocationIdAfter(
    progress.highestUnlockedLocationId,
    unlockStage.unlocksLocationId,
  );
  if (highestUnlockedLocationId === progress.highestUnlockedLocationId) {
    return {};
  }

  return {
    highestUnlockedLocationId,
    lastMilestoneId: unlockStage.id,
  };
}

/** Primer stage farmeable (no milestone de gym) de una ubicación. */
export function firstFarmableStage(locationId: string): CampaignStage | null {
  const loc = findLocation(locationId)?.location;
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
  const regionId = regionIdOf(merged);
  const stage =
    getStage(regionId, completedStageId) ?? findStage(completedStageId)?.stage;
  const location = stage
    ? (getLocation(regionId, merged.farmingLocationId) ??
      findLocation(merged.farmingLocationId)?.location)
    : null;

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
      const unlocked =
        getLocation(regionId, patch.highestUnlockedLocationId) ??
        findLocation(patch.highestUnlockedLocationId)?.location;
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
  const regionId = regionIdOf(progress);
  const location =
    getLocation(regionId, progress.farmingLocationId) ??
    findLocation(progress.farmingLocationId)?.location;
  const stage =
    getStage(regionId, progress.farmingStageId) ??
    findStage(progress.farmingStageId)?.stage;
  if (location && stage && stage.locationId === location.id && !stage.isGymMilestone) {
    return null;
  }

  for (let i = progress.completedStageIds.length - 1; i >= 0; i--) {
    const doneId = progress.completedStageIds[i]!;
    const done = getStage(regionId, doneId) ?? findStage(doneId)?.stage;
    if (done && !done.isGymMilestone) {
      return {
        farmingLocationId: done.locationId,
        farmingStageId: done.id,
        selectedLocationId: progress.selectedLocationId,
      };
    }
  }

  const defaults = CAMPAIGN_DEFAULTS;
  const fallbackLocation =
    (location?.stages.some((s) => !s.isGymMilestone) ? location : null) ??
    getLocation(regionId, defaults.farmingLocationId) ??
    findLocation(defaults.farmingLocationId)?.location;
  const fallbackStage = fallbackLocation?.stages.find((s) => !s.isGymMilestone) ?? null;

  if (!fallbackLocation || !fallbackStage) {
    return {
      farmingLocationId: defaults.farmingLocationId,
      farmingStageId: defaults.farmingStageId,
      selectedLocationId: defaults.selectedLocationId,
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
  const regionId = regionIdOf(progress);
  const stage = allStages(regionId).find(
    (s) => s.isGymMilestone && s.gymOrder === gymOrder,
  );
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
  const regionId = regionIdOf(progress);
  const location =
    getLocation(regionId, progress.farmingLocationId) ??
    findLocation(progress.farmingLocationId)?.location;
  const stage =
    getStage(regionId, progress.farmingStageId) ??
    findStage(progress.farmingStageId)?.stage;
  const selectedLocation =
    getLocation(regionId, progress.selectedLocationId) ??
    findLocation(progress.selectedLocationId)?.location;
  if (!location || !stage || !selectedLocation) return null;

  return {
    regionId,
    location,
    stage,
    mapSrc: campaignMapSrc(location.id),
    regionMapSrc: regionMapSrc(regionId),
    journeyPercent: journeyProgressPercent(progress),
    milestone: nextMilestone(progress, earnedGymOrders),
    selectedLocation,
  };
}

export function listLocationsForUi(progress: CampaignProgressRow) {
  const region = regionContent(regionIdOf(progress));
  return region.locations.map((loc) => ({
    location: loc,
    unlocked: isLocationUnlocked(loc.id, progress),
    completedStages: loc.stages.filter((s) => progress.completedStageIds.includes(s.id)).length,
    totalStages: loc.stages.filter((s) => !s.isGymMilestone).length || loc.stages.length,
  }));
}
