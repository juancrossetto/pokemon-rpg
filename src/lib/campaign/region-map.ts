/**
 * Coordenadas sobre el mapa de región (`/campaign/maps/regions/<region>.webp`).
 *
 * Están en % del contenedor, así que sirven a cualquier tamaño de render.
 * Los valores salieron de detectar los nodos dibujados en el arte, no de
 * estimarlos: cada punto cae sobre un marcador real del mapa.
 *
 * Una sola fuente de verdad para las dos pantallas que dibujan encima del
 * mapa: el mapa de gimnasios (`/gyms/map`) y el selector de zona del inicio.
 */

import type { CampaignRegionId } from "./types";
import { findLocation } from "./content";

export type MapPoint = { x: number; y: number };

/** El arte de región es 1400×933 — mantener el aspecto evita que los pines se desalineen. */
export const REGION_MAP_ASPECT = "1400 / 933";

/**
 * Locations de campaña de Kanto. El arte respeta la disposición canónica:
 * Pueblo Paleta abajo a la izquierda, subiendo por Ciudad Verde hasta Plateada,
 * y hacia el este por Mt. Moon a Celeste.
 */
export const KANTO_LOCATION_POINTS: Record<string, MapPoint> = {
  "pallet-town": { x: 19.6, y: 67.9 },
  "route-1": { x: 20.4, y: 57.0 },
  "viridian-city": { x: 20.8, y: 49.0 },
  "route-2": { x: 21.5, y: 33.7 },
  "viridian-forest": { x: 11.9, y: 28.1 },
  "pewter-city": { x: 22.2, y: 21.7 },
  "pewter-gym": { x: 22.2, y: 21.7 },
  "route-3": { x: 27.9, y: 28.1 },
  "mt-moon": { x: 42.5, y: 16.6 },
  "cerulean-city": { x: 61.0, y: 14.8 },

  // Medallas 2-8. Los gimnasios comparten punto con su ciudad; las rutas caen
  // sobre nodos del arte cuando hay uno cerca, o sobre el trazo que las une.
  "cerulean-gym": { x: 61.0, y: 14.8 },
  "route-5": { x: 61.0, y: 24.5 },
  "vermilion-city": { x: 61.0, y: 58.1 },
  "vermilion-gym": { x: 61.0, y: 58.1 },
  "route-11": { x: 70.0, y: 46.0 },
  "rock-tunnel": { x: 78.6, y: 34.3 },
  "lavender-town": { x: 74.0, y: 23.9 },
  "route-8": { x: 54.0, y: 34.2 },
  "celadon-city": { x: 46.3, y: 34.3 },
  "celadon-gym": { x: 46.3, y: 34.3 },
  "route-16": { x: 38.0, y: 58.0 },
  "fuchsia-city": { x: 49.0, y: 82.2 },
  "fuchsia-gym": { x: 49.0, y: 82.2 },
  "route-15": { x: 55.0, y: 70.0 },
  "saffron-city": { x: 61.1, y: 34.1 },
  "saffron-gym": { x: 61.1, y: 34.1 },
  "route-19": { x: 34.9, y: 93.9 },
  "cinnabar-island": { x: 18.5, y: 91.4 },
  "cinnabar-gym": { x: 18.5, y: 91.4 },
  "route-21": { x: 19.3, y: 75.3 },
  "viridian-gym": { x: 20.8, y: 49.0 },

  // Calle Victoria y Meseta Añil: el noroeste del mapa, el único tramo libre.
  "victory-road": { x: 16.0, y: 34.0 },
  "indigo-plateau": { x: 12.2, y: 16.8 },
  "elite-lorelei": { x: 12.2, y: 16.8 },
  "elite-bruno": { x: 12.2, y: 16.8 },
  "elite-agatha": { x: 12.2, y: 16.8 },
  "elite-lance": { x: 12.2, y: 16.8 },
  champion: { x: 12.2, y: 16.8 },
};

/** Las 8 ciudades con gimnasio, por `gym.order`. */
export const KANTO_GYM_POINTS: Record<number, MapPoint> = {
  1: { x: 22.2, y: 21.7 }, // Pewter City
  2: { x: 61.0, y: 14.8 }, // Cerulean City
  3: { x: 61.0, y: 58.1 }, // Vermilion City
  4: { x: 46.3, y: 34.3 }, // Celadon City
  5: { x: 49.0, y: 82.2 }, // Fuchsia City
  6: { x: 61.1, y: 34.1 }, // Saffron City
  7: { x: 18.5, y: 91.4 }, // Cinnabar Island
  8: { x: 20.8, y: 49.0 }, // Viridian City
};

/** Coordenadas anidadas por región — Johto/etc. se suman acá. */
export const REGION_LOCATION_POINTS: Record<
  CampaignRegionId,
  Record<string, MapPoint>
> = {
  kanto: KANTO_LOCATION_POINTS,
  johto: {},
  hoenn: {},
  sinnoh: {},
};

export const REGION_GYM_POINTS: Record<CampaignRegionId, Record<number, MapPoint>> = {
  kanto: KANTO_GYM_POINTS,
  // Aprox. sobre johto.webp — se afinan cuando la campaña de Johto abra.
  johto: {
    1: { x: 48, y: 28 }, // Violet
    2: { x: 38, y: 62 }, // Azalea
    3: { x: 32, y: 42 }, // Goldenrod
    4: { x: 46, y: 22 }, // Ecruteak
    5: { x: 12, y: 48 }, // Cianwood
    6: { x: 22, y: 36 }, // Olivine
    7: { x: 62, y: 30 }, // Mahogany
    8: { x: 78, y: 34 }, // Blackthorn
  },
  hoenn: {},
  sinnoh: {},
};

/**
 * Fallback determinístico cuando falta el pin en el arte: grilla 4×N para que
 * la zona aparezca en el mapa (aunque mal ubicada) en vez de desaparecer.
 */
export function fallbackLocationPoint(locationId: string, index: number): MapPoint {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: 18 + col * 20 + ((locationId.length * 3) % 7),
    y: 18 + row * 16,
  };
}

export function locationPoint(
  locationId: string,
  regionId?: CampaignRegionId,
): MapPoint | null {
  const resolved = regionId ?? findLocation(locationId)?.regionId ?? "kanto";
  return REGION_LOCATION_POINTS[resolved]?.[locationId] ?? null;
}

export function gymPoint(
  order: number,
  regionId: CampaignRegionId = "kanto",
): MapPoint | null {
  return REGION_GYM_POINTS[regionId]?.[order] ?? null;
}
