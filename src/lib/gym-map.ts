// Posiciones de las 8 ciudades de gimnasio sobre el mapa de región de Kanto.
// Las coordenadas viven en `campaign/region-map.ts` — una sola tabla para el
// mapa de gimnasios y el selector de zona del inicio.
import { KANTO_GYM_POINTS, REGION_MAP_ASPECT } from "@/lib/campaign/region-map";
import { regionMapSrc } from "@/lib/campaign/regions";

export interface GymMapPoint {
  order: number;
  city: string;
  x: number;
  y: number;
}

const GYM_CITIES: Record<number, string> = {
  1: "Pewter City",
  2: "Cerulean City",
  3: "Vermilion City",
  4: "Celadon City",
  5: "Fuchsia City",
  6: "Saffron City",
  7: "Cinnabar Island",
  8: "Viridian City",
};

export const GYM_MAP_POINTS: GymMapPoint[] = Object.entries(GYM_CITIES).map(
  ([order, city]) => {
    const point = KANTO_GYM_POINTS[Number(order)];
    return { order: Number(order), city, x: point.x, y: point.y };
  },
);

export const KANTO_MAP_IMAGE = regionMapSrc("kanto");
export const KANTO_MAP_ASPECT = REGION_MAP_ASPECT;

const LEADER_BY_ORDER: Record<number, string> = {
  1: "brock",
  2: "misty",
  3: "ltsurge",
  4: "erika",
  5: "koga",
  6: "sabrina",
  7: "blaine",
  8: "giovanni",
};

/** Sprite pixel del líder por gymOrder (Kanto). `null` si no hay arte. */
export function gymLeaderSpriteByOrder(order: number): string | null {
  const slug = LEADER_BY_ORDER[order];
  return slug ? `/gyms/leaders/${slug}.png` : null;
}
