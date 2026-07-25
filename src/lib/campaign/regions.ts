import type { CampaignRegionId } from "./types";

/**
 * Registro de regiones del juego.
 *
 * El mapa de la región es lo que ve el jugador en el dashboard, y la región
 * define qué locations/stages existen — y por lo tanto qué Pokémon salvajes
 * aparecen en batalla (cada stage trae sus `spawnSpeciesIds`).
 *
 * `playable: false` = el arte ya está pero todavía no hay locations cargadas.
 * Cuando se agreguen, alcanza con poner la región en `true` y sumar su archivo
 * de locations al lado de `kanto.ts`.
 */
export type RegionMeta = {
  id: CampaignRegionId;
  /** Orden canónico de generaciones: Kanto 1, Johto 2, Hoenn 3, Sinnoh 4. */
  order: number;
  nameKey: string;
  mapSrc: string;
  playable: boolean;
};

export const REGIONS: Record<CampaignRegionId, RegionMeta> = {
  kanto: {
    id: "kanto",
    order: 1,
    nameKey: "regions.kanto",
    mapSrc: "/campaign/maps/regions/kanto.webp",
    playable: true,
  },
  johto: {
    id: "johto",
    order: 2,
    nameKey: "regions.johto",
    mapSrc: "/campaign/maps/regions/johto.webp",
    playable: false,
  },
  hoenn: {
    id: "hoenn",
    order: 3,
    nameKey: "regions.hoenn",
    mapSrc: "/campaign/maps/regions/hoenn.webp",
    playable: false,
  },
  sinnoh: {
    id: "sinnoh",
    order: 4,
    nameKey: "regions.sinnoh",
    mapSrc: "/campaign/maps/regions/sinnoh.webp",
    playable: false,
  },
};

export const REGION_IDS = Object.keys(REGIONS) as CampaignRegionId[];

export function isCampaignRegionId(value: string): value is CampaignRegionId {
  return value in REGIONS;
}

/** Metadata de una región; cae a Kanto si el id guardado quedó inválido. */
export function regionMeta(regionId: string): RegionMeta {
  return isCampaignRegionId(regionId) ? REGIONS[regionId] : REGIONS.kanto;
}

/** Mapa de la región, para el fondo de la card de ubicación. */
export function regionMapSrc(regionId: string): string {
  return regionMeta(regionId).mapSrc;
}

/** Todas las regiones en orden de generación (incluye las no jugables). */
export function listRegions(): RegionMeta[] {
  return REGION_IDS.map((id) => REGIONS[id]).sort((a, b) => a.order - b.order);
}

/** Solo las que ya tienen contenido cargado. */
export function listPlayableRegions(): RegionMeta[] {
  return listRegions().filter((region) => region.playable);
}
