/**
 * Resolver de contenido de campaña por región.
 *
 * Las lookups del hot path (`progress`, actions, UI) pasan por acá en vez de
 * importar `kanto.ts` directo — así sumar Johto es registrar un pack, no
 * tocar cada call site.
 */

import { REGIONS, isGameRegionId, regionDef, type GameRegionId } from "@/lib/regions";
import { JOHTO_REGION } from "./johto";
import { KANTO_REGION } from "./kanto";
import type {
  CampaignLocation,
  CampaignRegion,
  CampaignRegionId,
  CampaignStage,
} from "./types";

const EMPTY_REGIONS: Partial<Record<CampaignRegionId, CampaignRegion>> = {
  johto: JOHTO_REGION,
  hoenn: { id: "hoenn", nameKey: "regions.hoenn", locations: [] },
  sinnoh: { id: "sinnoh", nameKey: "regions.sinnoh", locations: [] },
};

export const REGION_CONTENT: Record<CampaignRegionId, CampaignRegion> = {
  kanto: KANTO_REGION,
  johto: EMPTY_REGIONS.johto!,
  hoenn: EMPTY_REGIONS.hoenn!,
  sinnoh: EMPTY_REGIONS.sinnoh!,
};

export function regionContent(regionId: string): CampaignRegion {
  const id = isGameRegionId(regionId) ? regionId : "kanto";
  return REGION_CONTENT[id];
}

export function getLocation(
  regionId: string,
  id: string,
): CampaignLocation | undefined {
  return regionContent(regionId).locations.find((l) => l.id === id);
}

export function getStage(regionId: string, id: string): CampaignStage | undefined {
  return allStages(regionId).find((s) => s.id === id);
}

export function allStages(regionId: string): CampaignStage[] {
  return regionContent(regionId)
    .locations.flatMap((l) => l.stages)
    .sort((a, b) => a.order - b.order);
}

/** Busca una location por id en todas las regiones (ids son globales únicos). */
export function findLocation(
  id: string,
): { regionId: GameRegionId; location: CampaignLocation } | undefined {
  for (const regionId of Object.keys(REGION_CONTENT) as GameRegionId[]) {
    const location = REGION_CONTENT[regionId].locations.find((l) => l.id === id);
    if (location) return { regionId, location };
  }
  return undefined;
}

/** Busca un stage por id en todas las regiones. */
export function findStage(
  id: string,
): { regionId: GameRegionId; stage: CampaignStage } | undefined {
  for (const regionId of Object.keys(REGION_CONTENT) as GameRegionId[]) {
    const stage = allStages(regionId).find((s) => s.id === id);
    if (stage) return { regionId, stage };
  }
  return undefined;
}

/**
 * Región efectiva para un progress row: usa `currentRegionId` si es válido;
 * si apunta a una location conocida de otra región, corrige al pack dueño.
 */
export function resolveProgressRegionId(progress: {
  currentRegionId: string;
  farmingLocationId?: string;
  selectedLocationId?: string;
}): GameRegionId {
  if (isGameRegionId(progress.currentRegionId)) {
    return progress.currentRegionId;
  }
  const tip = progress.farmingLocationId ?? progress.selectedLocationId;
  if (tip) {
    const found = findLocation(tip);
    if (found) return found.regionId;
  }
  return "kanto";
}

export function regionBadgeTargetFor(regionId: string): number {
  return regionDef(regionId).badgeTarget;
}

/** Alias deprecados — migrar call sites a `getLocation` / `allStages`. */
export function getKantoLocation(id: string): CampaignLocation | undefined {
  return getLocation("kanto", id);
}

export function getKantoStage(id: string): CampaignStage | undefined {
  return getStage("kanto", id);
}

export function allKantoStages(): CampaignStage[] {
  return allStages("kanto");
}

// Re-export para que `REGIONS.playable` siga visible desde content.
export { REGIONS };
