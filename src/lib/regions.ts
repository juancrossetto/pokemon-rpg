/**
 * Registro único de ligas / regiones jugables (Kanto–Sinnoh).
 *
 * Fuente de verdad para campaña, gimnasios y filtro generacional de la
 * Pokédex. Módulo puro (sin Prisma) — lo importan Server y Client Components.
 *
 * Habilitar una liga = `playable`/`gymsAvailable`/`speciesAvailable` en true
 * + pack de contenido (`campaign/<region>.ts`) + seed de gyms de esa región.
 */

export type GameRegionId = "kanto" | "johto" | "hoenn" | "sinnoh";

export type RegionDefaults = {
  highestUnlockedLocationId: string;
  selectedLocationId: string;
  farmingLocationId: string;
  farmingStageId: string;
};

export type RegionDef = {
  id: GameRegionId;
  /** Orden canónico de generaciones: Kanto 1, Johto 2, … */
  order: number;
  generation: number;
  nameKey: string;
  mapSrc: string;
  /** Medallas de gimnasio (sin Alto Mando). */
  badgeTarget: number;
  /** Rango inclusivo de dex # esperados al sembrar esa gen. */
  speciesRange: readonly [number, number];
  /** Hay locations/stages de campaña cargados. */
  playable: boolean;
  /** Hay gimnasios sembrados para esta liga. */
  gymsAvailable: boolean;
  /** Hay especies en DB para esta generación (Pokédex). */
  speciesAvailable: boolean;
  defaults: RegionDefaults;
};

const KANTO_DEFAULTS: RegionDefaults = {
  highestUnlockedLocationId: "route-1",
  selectedLocationId: "pallet-town",
  farmingLocationId: "pallet-town",
  farmingStageId: "pallet-1",
};

/** Defaults placeholder para regiones sin contenido — ids no deben colisionar con Kanto. */
const EMPTY_DEFAULTS: RegionDefaults = {
  highestUnlockedLocationId: "johto-new-bark",
  selectedLocationId: "johto-new-bark",
  farmingLocationId: "johto-new-bark",
  farmingStageId: "johto-new-bark-1",
};

export const REGIONS: Record<GameRegionId, RegionDef> = {
  kanto: {
    id: "kanto",
    order: 1,
    generation: 1,
    nameKey: "regions.kanto",
    mapSrc: "/campaign/maps/regions/kanto.webp",
    badgeTarget: 8,
    speciesRange: [1, 151],
    playable: true,
    gymsAvailable: true,
    speciesAvailable: true,
    defaults: KANTO_DEFAULTS,
  },
  johto: {
    id: "johto",
    order: 2,
    generation: 2,
    nameKey: "regions.johto",
    mapSrc: "/campaign/maps/regions/johto.webp",
    badgeTarget: 8,
    speciesRange: [152, 251],
    playable: true,
    // Catálogo sembrado y visible en el hub; playable false → bloqueado.
    gymsAvailable: true,
    // Especies en DB para la Pokédex; la liga sigue cerrada (sin campaña).
    speciesAvailable: true,
    defaults: EMPTY_DEFAULTS,
  },
  hoenn: {
    id: "hoenn",
    order: 3,
    generation: 3,
    nameKey: "regions.hoenn",
    mapSrc: "/campaign/maps/regions/hoenn.webp",
    badgeTarget: 8,
    speciesRange: [252, 386],
    playable: false,
    gymsAvailable: false,
    speciesAvailable: false,
    defaults: {
      highestUnlockedLocationId: "hoenn-littleroot",
      selectedLocationId: "hoenn-littleroot",
      farmingLocationId: "hoenn-littleroot",
      farmingStageId: "hoenn-littleroot-1",
    },
  },
  sinnoh: {
    id: "sinnoh",
    order: 4,
    generation: 4,
    nameKey: "regions.sinnoh",
    mapSrc: "/campaign/maps/regions/sinnoh.webp",
    badgeTarget: 8,
    speciesRange: [387, 493],
    playable: false,
    gymsAvailable: false,
    speciesAvailable: false,
    defaults: {
      highestUnlockedLocationId: "sinnoh-twinleaf",
      selectedLocationId: "sinnoh-twinleaf",
      farmingLocationId: "sinnoh-twinleaf",
      farmingStageId: "sinnoh-twinleaf-1",
    },
  },
};

export const REGION_IDS = Object.keys(REGIONS) as GameRegionId[];

export const DEFAULT_REGION_ID: GameRegionId = "kanto";

export function isGameRegionId(value: string): value is GameRegionId {
  return value in REGIONS;
}

/** Metadata de una región; cae a Kanto si el id guardado quedó inválido. */
export function regionDef(regionId: string): RegionDef {
  return isGameRegionId(regionId) ? REGIONS[regionId] : REGIONS.kanto;
}

export function regionMapSrc(regionId: string): string {
  return regionDef(regionId).mapSrc;
}

export function regionBadgeTarget(regionId: string): number {
  return regionDef(regionId).badgeTarget;
}

/** Todas las regiones en orden de generación. */
export function listRegions(): RegionDef[] {
  return REGION_IDS.map((id) => REGIONS[id]).sort((a, b) => a.order - b.order);
}

export function listPlayableRegions(): RegionDef[] {
  return listRegions().filter((region) => region.playable);
}

export function listGymAvailableRegions(): RegionDef[] {
  return listRegions().filter((region) => region.gymsAvailable);
}

/** Defaults de progreso para una región (o Kanto si el id es inválido). */
export function regionDefaults(regionId: string): RegionDefaults {
  return regionDef(regionId).defaults;
}
