import { SHINY_ODDS } from "@/lib/shiny";

export const SAFARI_WEEKLY_RUNS = 5;
export const SAFARI_ENCOUNTERS_PER_RUN = 10;
export const SAFARI_BALLS_PER_RUN = 15;

export type SafariRarity = "common" | "uncommon" | "rare" | "epic";

export type SafariBiome = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  accent: string;
  levelMin: number;
  levelMax: number;
  species: Array<{ speciesId: number; weight: number; rarity: SafariRarity }>;
};

export const SAFARI_BIOMES: SafariBiome[] = [
  {
    id: "verdant",
    nameKey: "biomes.verdant.name",
    descriptionKey: "biomes.verdant.description",
    accent: "#62d987",
    levelMin: 10,
    levelMax: 18,
    species: [
      { speciesId: 10, weight: 24, rarity: "common" },
      { speciesId: 13, weight: 24, rarity: "common" },
      { speciesId: 43, weight: 18, rarity: "uncommon" },
      { speciesId: 46, weight: 15, rarity: "uncommon" },
      { speciesId: 48, weight: 10, rarity: "rare" },
      { speciesId: 123, weight: 5, rarity: "epic" },
      { speciesId: 127, weight: 4, rarity: "epic" },
    ],
  },
  {
    id: "wetlands",
    nameKey: "biomes.wetlands.name",
    descriptionKey: "biomes.wetlands.description",
    accent: "#65d9dc",
    levelMin: 12,
    levelMax: 20,
    species: [
      { speciesId: 60, weight: 24, rarity: "common" },
      { speciesId: 54, weight: 21, rarity: "common" },
      { speciesId: 79, weight: 18, rarity: "uncommon" },
      { speciesId: 116, weight: 16, rarity: "uncommon" },
      { speciesId: 72, weight: 11, rarity: "rare" },
      { speciesId: 131, weight: 6, rarity: "epic" },
      { speciesId: 147, weight: 4, rarity: "epic" },
    ],
  },
  {
    id: "badlands",
    nameKey: "biomes.badlands.name",
    descriptionKey: "biomes.badlands.description",
    accent: "#f3a95f",
    levelMin: 14,
    levelMax: 22,
    species: [
      { speciesId: 27, weight: 24, rarity: "common" },
      { speciesId: 74, weight: 22, rarity: "common" },
      { speciesId: 111, weight: 18, rarity: "uncommon" },
      { speciesId: 104, weight: 15, rarity: "uncommon" },
      { speciesId: 95, weight: 11, rarity: "rare" },
      { speciesId: 115, weight: 6, rarity: "epic" },
      { speciesId: 142, weight: 4, rarity: "epic" },
    ],
  },
];

const RARITY_SCORE: Record<SafariRarity, number> = {
  common: 100,
  uncommon: 180,
  rare: 320,
  epic: 520,
};

export function safariBiome(id: string): SafariBiome | null {
  return SAFARI_BIOMES.find((biome) => biome.id === id) ?? null;
}

export function safariRarity(biomeId: string, speciesId: number): SafariRarity {
  return safariBiome(biomeId)?.species.find((entry) => entry.speciesId === speciesId)?.rarity ?? "common";
}

export function rollSafariSpawn(
  biome: SafariBiome,
  random: () => number = Math.random,
): { speciesId: number; level: number; rarity: SafariRarity; isShiny: boolean } {
  const total = biome.species.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.min(0.999999, Math.max(0, random())) * total;
  let chosen = biome.species[0]!;
  for (const entry of biome.species) {
    cursor -= entry.weight;
    if (cursor < 0) {
      chosen = entry;
      break;
    }
  }
  const levelRoll = Math.min(0.999999, Math.max(0, random()));
  const level = biome.levelMin + Math.floor(levelRoll * (biome.levelMax - biome.levelMin + 1));
  const isShiny = Math.floor(Math.min(0.999999, Math.max(0, random())) * SHINY_ODDS) === 0;
  return { speciesId: chosen.speciesId, level, rarity: chosen.rarity, isShiny };
}

/** Safari no usa HP: especies difíciles siguen siendo valiosas, pero no imposibles. */
export function safariCatchChance(captureRate: number, rarity: SafariRarity): number {
  const rate = Math.min(255, Math.max(3, captureRate));
  const rarityPenalty = { common: 0, uncommon: 0.04, rare: 0.09, epic: 0.14 }[rarity];
  return Math.min(0.82, Math.max(0.16, 0.2 + (rate / 255) * 0.62 - rarityPenalty));
}

export function rollSafariCatch(
  captureRate: number,
  rarity: SafariRarity,
  random: () => number = Math.random,
): boolean {
  return random() < safariCatchChance(captureRate, rarity);
}

export function safariCatchScore(input: {
  rarity: SafariRarity;
  level: number;
  captureRate: number;
  isShiny: boolean;
}): number {
  const difficulty = Math.max(0, 255 - input.captureRate);
  return RARITY_SCORE[input.rarity] + input.level * 8 + difficulty + (input.isShiny ? 1_200 : 0);
}

export function safariReward(score: number): { coins: number; gems: number; tier: "none" | "bronze" | "silver" | "gold" } {
  if (score >= 900) return { coins: 1_500, gems: 2, tier: "gold" };
  if (score >= 550) return { coins: 900, gems: 1, tier: "silver" };
  if (score >= 250) return { coins: 500, gems: 0, tier: "bronze" };
  return { coins: 150, gems: 0, tier: "none" };
}

export function safariRank(score: number): "S" | "A" | "B" | "C" {
  if (score >= 1_400) return "S";
  if (score >= 900) return "A";
  if (score >= 550) return "B";
  return "C";
}
