/** Datos y helpers de la Pokédex de investigación — sin Prisma (usable en client). */

import { listRegions, type GameRegionId } from "@/lib/regions";
import { REGION_CONTENT } from "@/lib/campaign/content";

export type DexStatus = "unseen" | "seen" | "caught";

export type DexRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythical"
  | "ultraBeast"
  | "paradox";

export type DexQuickFilter =
  | "all"
  | "seen"
  | "caught"
  | "missing"
  | "favorites"
  | "shiny"
  | "legendary"
  | "mythical"
  | "starter"
  | "pseudo";

export type DexSort = "number" | "name" | "rarity";

export type DexView = "grid" | "list";

export type PokedexRegionId =
  | GameRegionId
  | "unova"
  | "kalos"
  | "alola"
  | "galar"
  | "paldea";

export type PokedexRegionDef = {
  id: PokedexRegionId;
  generation: number;
  /** Hay especies en la DB para esta generación. */
  available: boolean;
  /**
   * La liga está jugable (campaña/capturas). Si hay especies pero no es
   * jugable, la Pokédex las muestra bloqueadas (siluetas fijas).
   */
  playable: boolean;
};

/** Regiones post-Sinnoh: solo Pokédex, aún no en el registro de ligas. */
const EXTRA_POKEDEX_REGIONS: PokedexRegionDef[] = [
  { id: "unova", generation: 5, available: false, playable: false },
  { id: "kalos", generation: 6, available: false, playable: false },
  { id: "alola", generation: 7, available: false, playable: false },
  { id: "galar", generation: 8, available: false, playable: false },
  { id: "paldea", generation: 9, available: false, playable: false },
];

/**
 * Kanto–Sinnoh salen de `@/lib/regions` (`speciesAvailable` / `playable`) para
 * no discrepar con campaña/gyms. El resto queda Coming Soon acá.
 */
export const POKEDEX_REGIONS: PokedexRegionDef[] = [
  ...listRegions().map((r) => ({
    id: r.id as PokedexRegionId,
    generation: r.generation,
    available: r.speciesAvailable,
    playable: r.playable,
  })),
  ...EXTRA_POKEDEX_REGIONS,
];

/** Legendarios (no míticos) por dex #. */
export const LEGENDARY_IDS = new Set([
  144, 145, 146, 150, // Kanto
  243, 244, 245, 249, 250, // Johto
  377, 378, 379, 380, 381, 382, 383, 384, // Hoenn
  480, 481, 482, 483, 484, 485, 486, 487, 488, // Sinnoh
]);

export const MYTHICAL_IDS = new Set([
  151, // Mew
  251, // Celebi
  385, 386, // Jirachi, Deoxys
  489, 490, 491, 492, 493, // Manaphy line + Arceus
]);

/** Starters (3 líneas × 3) por gen 1–4. */
export const STARTER_IDS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9,
  152, 153, 154, 155, 156, 157, 158, 159, 160,
  252, 253, 254, 255, 256, 257, 258, 259, 260,
  387, 388, 389, 390, 391, 392, 393, 394, 395,
]);

/** Pseudo-legendarios (finales de línea). */
export const PSEUDO_IDS = new Set([
  149, // Dragonite
  248, // Tyranitar
  373, // Salamence
  376, // Metagross
  445, // Garchomp
]);

export const RARITY_ORDER: Record<DexRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythical: 4,
  ultraBeast: 5,
  paradox: 6,
};

export const RARITY_STYLES: Record<
  DexRarity,
  { text: string; border: string; label: string }
> = {
  common: { text: "text-on-surface-variant", border: "border-white/15", label: "C" },
  rare: { text: "text-sky-300", border: "border-sky-400/40", label: "R" },
  epic: { text: "text-violet-300", border: "border-violet-400/45", label: "E" },
  legendary: { text: "text-electric-yellow", border: "border-electric-yellow/50", label: "L" },
  mythical: { text: "text-pink-300", border: "border-pink-400/45", label: "M" },
  ultraBeast: { text: "text-emerald-300", border: "border-emerald-400/45", label: "UB" },
  paradox: { text: "text-amber-300", border: "border-amber-400/45", label: "P" },
};

export function speciesRarity(input: {
  id: number;
  captureRate: number;
}): DexRarity {
  if (MYTHICAL_IDS.has(input.id)) return "mythical";
  if (LEGENDARY_IDS.has(input.id)) return "legendary";
  if (input.captureRate <= 3) return "legendary";
  if (input.captureRate <= 45) return "epic";
  if (input.captureRate <= 90) return "rare";
  return "common";
}

export function regionForGeneration(gen: number): PokedexRegionId | null {
  return POKEDEX_REGIONS.find((r) => r.generation === gen)?.id ?? null;
}

export function isLegendarySpecies(id: number): boolean {
  return LEGENDARY_IDS.has(id) || MYTHICAL_IDS.has(id);
}

export type DexEncounterLocation = {
  id: string;
  nameKey: string;
  regionId: GameRegionId;
};

const ENCOUNTER_LOCATIONS = (() => {
  const index = new Map<number, Map<string, DexEncounterLocation>>();
  for (const region of Object.values(REGION_CONTENT)) {
    for (const location of region.locations) {
      for (const speciesId of new Set(location.stages.flatMap((stage) => stage.spawnSpeciesIds))) {
        const locations = index.get(speciesId) ?? new Map<string, DexEncounterLocation>();
        locations.set(location.id, {
          id: location.id,
          nameKey: location.nameKey,
          regionId: location.regionId,
        });
        index.set(speciesId, locations);
      }
    }
  }
  return index;
})();

/** Zonas jugables donde una especie puede aparecer, sin Prisma. */
export function encounterLocationsForSpecies(speciesId: number): DexEncounterLocation[] {
  return [...(ENCOUNTER_LOCATIONS.get(speciesId)?.values() ?? [])];
}

export type PokedexSpeciesCard = {
  id: number;
  name: string;
  types: string[];
  spriteUrl: string;
  generation: number;
  captureRate: number;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpeed: number;
  evolvesFromId: number | null;
  evolvesToIds: number[];
  status: DexStatus;
  rarity: DexRarity;
  isStarter: boolean;
  isPseudo: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  /** El entrenador tiene al menos un shiny de esta especie. */
  hasShiny: boolean;
  /** El entrenador marcó favorito algún ejemplar. */
  isFavorite: boolean;
  /** Ejemplares reales: equipo + PC. */
  ownedCount: number;
  teamCount: number;
  pcCount: number;
  shinyCount: number;
  /** Fuentes de captura conocidas dentro de las campañas jugables. */
  encounterLocations: Array<{
    id: string;
    name: string;
    regionId: GameRegionId;
  }>;
};

export type RegionProgress = {
  id: PokedexRegionId;
  generation: number;
  available: boolean;
  /** false = especies sembradas pero liga cerrada (siluetas fijas). */
  playable: boolean;
  total: number;
  seen: number;
  caught: number;
};

export type PokedexProgress = {
  total: number;
  seen: number;
  caught: number;
  completion: number;
  shiny: number;
  legendary: number;
  regions: RegionProgress[];
};
