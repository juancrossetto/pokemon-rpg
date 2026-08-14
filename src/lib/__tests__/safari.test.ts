import { describe, expect, it } from "vitest";
import {
  SAFARI_BIOMES,
  rollSafariCatch,
  rollSafariSpawn,
  safariCatchChance,
  safariCatchScore,
  safariReward,
  safariRewardProgress,
} from "@/lib/safari";

describe("safari encounters", () => {
  const biome = SAFARI_BIOMES[0]!;

  it("respects weighted boundaries and level limits", () => {
    const first = rollSafariSpawn(biome, sequence(0, 0, 0.5));
    const last = rollSafariSpawn(biome, sequence(0.999999, 0.999999, 0.5));

    expect(first.speciesId).toBe(biome.species[0]!.speciesId);
    expect(first.level).toBe(biome.levelMin);
    expect(last.speciesId).toBe(biome.species.at(-1)!.speciesId);
    expect(last.level).toBe(biome.levelMax);
  });

  it("uses the shared one-in-fifty shiny rate", () => {
    expect(rollSafariSpawn(biome, sequence(0.5, 0.5, 0)).isShiny).toBe(true);
    expect(rollSafariSpawn(biome, sequence(0.5, 0.5, 0.02)).isShiny).toBe(false);
  });

  it("reduces repeated species without removing them from the pool", () => {
    const repeated = rollSafariSpawn(biome, sequence(0.2, 0.5, 0.5), [biome.species[0]!.speciesId]);
    const allSeen = rollSafariSpawn(biome, sequence(0, 0.5, 0.5), biome.species.map((entry) => entry.speciesId));

    expect(repeated.speciesId).not.toBe(biome.species[0]!.speciesId);
    expect(allSeen.speciesId).toBe(biome.species[0]!.speciesId);
  });
});

describe("safari capture", () => {
  it("makes rarer species harder without making them impossible", () => {
    const common = safariCatchChance(45, "common");
    const epic = safariCatchChance(45, "epic");

    expect(common).toBeGreaterThan(epic);
    expect(epic).toBeGreaterThanOrEqual(0.16);
    expect(safariCatchChance(255, "common")).toBeLessThanOrEqual(0.82);
  });

  it("compares the roll against the computed probability", () => {
    const chance = safariCatchChance(120, "rare");
    expect(rollSafariCatch(120, "rare", () => chance - 0.001)).toBe(true);
    expect(rollSafariCatch(120, "rare", () => chance)).toBe(false);
  });
});

describe("safari score and rewards", () => {
  it("rewards rarity, level, capture difficulty and shiny finds", () => {
    const ordinary = safariCatchScore({ rarity: "common", level: 10, captureRate: 200, isShiny: false });
    const rare = safariCatchScore({ rarity: "rare", level: 18, captureRate: 45, isShiny: false });
    const shiny = safariCatchScore({ rarity: "common", level: 10, captureRate: 200, isShiny: true });

    expect(rare).toBeGreaterThan(ordinary);
    expect(shiny - ordinary).toBe(1_200);
  });

  it("uses stable reward thresholds", () => {
    expect(safariReward(249)).toEqual({ coins: 150, gems: 0, tier: "none" });
    expect(safariReward(250)).toEqual({ coins: 500, gems: 0, tier: "bronze" });
    expect(safariReward(550)).toEqual({ coins: 900, gems: 1, tier: "silver" });
    expect(safariReward(900)).toEqual({ coins: 1_500, gems: 2, tier: "gold" });
  });

  it("reports the live rank and distance to the next reward", () => {
    expect(safariRewardProgress(300)).toMatchObject({ rank: "B", pointsRemaining: 250, next: { rank: "A", score: 550 } });
    expect(safariRewardProgress(900)).toMatchObject({ rank: "S", pointsRemaining: 0, next: null });
  });
});

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
