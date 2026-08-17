import { SHINY_ODDS } from "@/lib/shiny";

export type FishingSpecies = {
  speciesId: number;
  weight: number;
  rarity: "common" | "uncommon" | "rare";
};

/**
 * Tabla de caña. Magikarp manda; Dratini/Gyarados son el premio.
 * Niveles los pone el lead del jugador al lance, no esta tabla.
 */
export const FISHING_TABLE: FishingSpecies[] = [
  { speciesId: 129, weight: 40, rarity: "common" }, // Magikarp
  { speciesId: 118, weight: 18, rarity: "common" }, // Goldeen
  { speciesId: 60, weight: 16, rarity: "common" }, // Poliwag
  { speciesId: 72, weight: 12, rarity: "uncommon" }, // Tentacool
  { speciesId: 116, weight: 8, rarity: "uncommon" }, // Horsea
  { speciesId: 130, weight: 4, rarity: "rare" }, // Gyarados
  { speciesId: 147, weight: 2, rarity: "rare" }, // Dratini
];

export const FISHING_CATCH_CHANCE: Record<FishingSpecies["rarity"], number> = {
  common: 0.72,
  uncommon: 0.55,
  rare: 0.32,
};

export function rollWeighted<T extends { weight: number }>(
  table: readonly T[],
  roll: number,
): T {
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const row of table) {
    cursor -= row.weight;
    if (cursor < 0) return row;
  }
  return table[table.length - 1]!;
}

export function rollFishingEncounter(
  random: () => number = Math.random,
): { speciesId: number; rarity: FishingSpecies["rarity"]; isShiny: boolean; caught: boolean } {
  const row = rollWeighted(FISHING_TABLE, random());
  const caught = random() < FISHING_CATCH_CHANCE[row.rarity];
  const isShiny = Math.floor(random() * SHINY_ODDS) === 0;
  return { speciesId: row.speciesId, rarity: row.rarity, isShiny, caught };
}

export function fishingLevelForLead(leadLevel: number): number {
  const base = Math.max(5, leadLevel - 2);
  return Math.min(60, base);
}
