/**
 * Reexport del registro de regiones para el dominio campaña.
 * Fuente de verdad: `@/lib/regions`.
 */

import {
  DEFAULT_REGION_ID,
  REGION_IDS,
  REGIONS,
  isGameRegionId,
  listPlayableRegions,
  listRegions,
  regionDef,
  regionMapSrc,
  type GameRegionId,
  type RegionDef,
} from "@/lib/regions";

export type CampaignRegionId = GameRegionId;
export type RegionMeta = RegionDef;

export {
  REGIONS,
  REGION_IDS,
  DEFAULT_REGION_ID,
  listRegions,
  listPlayableRegions,
  regionMapSrc,
};

export function isCampaignRegionId(value: string): value is CampaignRegionId {
  return isGameRegionId(value);
}

/** Metadata de una región; cae a Kanto si el id guardado quedó inválido. */
export function regionMeta(regionId: string): RegionMeta {
  return regionDef(regionId);
}
