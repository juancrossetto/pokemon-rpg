import type { CampaignRegion } from "./types";

/**
 * Stub del pack Johto. Cuando se carguen locations/stages, llenar este
 * archivo (espejo de `kanto.ts`) y poner `playable: true` en `@/lib/regions`.
 *
 * Ids deben ser globales únicos (prefijo `johto-` si hay colisión canónica
 * con Kanto, p.ej. Victory Road).
 */
export const JOHTO_REGION: CampaignRegion = {
  id: "johto",
  nameKey: "regions.johto",
  locations: [],
};
