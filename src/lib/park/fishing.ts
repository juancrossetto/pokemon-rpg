import { FISHING_ENERGY_COST } from "@/lib/energy";
import { SHINY_ODDS } from "@/lib/shiny";

export type FishingSpecies = {
  speciesId: number;
  weight: number;
  rarity: "common" | "uncommon" | "rare";
};

/**
 * Tabla de caña. Magikarp manda; Dratini/Gyarados son el premio.
 * Un lance suma fragmentos (sin nivel). Al armar, el Pokémon sale
 * con `assembledPokemonLevel` según rareza — no escala con el lead.
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

/**
 * Los primeros `FISHING_FREE_CASTS_PER_DAY` lances del día son gratis.
 * El resto cobra `FISHING_ENERGY_COST`, igual que el casino después de los
 * giros libres. El cupo gratis vuelve con el reset diario.
 */
export const FISHING_FREE_CASTS_PER_DAY = 5;

export function fishingCastsUsedToday(
  row: { dayKey: string; casts: number } | null | undefined,
  today: string,
): number {
  if (!row || row.dayKey !== today) return 0;
  return Math.max(0, row.casts);
}

export function fishingEnergyCost(castsUsedToday: number): number {
  return castsUsedToday < FISHING_FREE_CASTS_PER_DAY ? 0 : FISHING_ENERGY_COST;
}

export function fishingFreeLeft(castsUsedToday: number): number {
  return Math.max(0, FISHING_FREE_CASTS_PER_DAY - castsUsedToday);
}

