/**
 * Ligas del hub de gimnasios — reexport del registro unificado.
 * Fuente de verdad: `@/lib/regions`.
 */

import {
  DEFAULT_REGION_ID,
  listRegions,
  regionDef,
  type GameRegionId,
  type RegionDef,
} from "@/lib/regions";

export type GymRegionId = GameRegionId;

export type GymRegionDef = {
  id: GymRegionId;
  order: number;
  badgeTarget: number;
  /** Hay gimnasios sembrados / visibles en el hub. */
  available: boolean;
  /** Se pueden desafiar (liga abierta). */
  playable: boolean;
};

export const DEFAULT_GYM_REGION_ID: GymRegionId = DEFAULT_REGION_ID;

export function toGymRegionDef(region: RegionDef): GymRegionDef {
  return {
    id: region.id,
    order: region.order,
    badgeTarget: region.badgeTarget,
    available: region.gymsAvailable,
    playable: region.playable && region.gymsAvailable,
  };
}

export const GYM_REGIONS: GymRegionDef[] = listRegions().map(toGymRegionDef);

export function gymRegionDef(id: string): GymRegionDef {
  return toGymRegionDef(regionDef(id));
}

export function listGymRegions(): GymRegionDef[] {
  return listRegions().map(toGymRegionDef);
}
