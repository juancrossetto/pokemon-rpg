import { describe, expect, it } from "vitest";
import { pickEventItemName, rollExplorationEvent } from "@/lib/campaign/events";
import { objectiveReward } from "@/lib/campaign/objectives";
import type { MapLocation } from "@/lib/campaign/map-selection";

function zone(kindKey: string, levelMax: number): MapLocation {
  return {
    id: "test-zone",
    nameKey: "locations.test",
    kindKey,
    unlocked: true,
    x: 0,
    y: 0,
    completedStages: 1,
    totalStages: 1,
    levelMin: 1,
    levelMax,
    encounterRate: "medium",
    stages: [],
    spawnSpeciesIds: [],
    objectiveSpeciesIds: [],
    encounters: [],
    masteryXp: 0,
    masteryLevel: 1,
    trainers: [],
    claimedObjectives: [],
    gymOrder: null,
  };
}

describe("campaign healing rewards", () => {
  it("adds tiered potions to every stage-completion reward", () => {
    expect(objectiveReward(zone("kinds.route", 8), "stages").items).toEqual([
      { itemName: "Poke Ball", quantity: 5 },
      { itemName: "Potion", quantity: 4 },
    ]);
    expect(objectiveReward(zone("kinds.dungeon", 25), "stages").items).toEqual([
      { itemName: "Great Ball", quantity: 5 },
      { itemName: "Super Potion", quantity: 3 },
    ]);
    expect(objectiveReward(zone("kinds.town", 45), "stages").items).toEqual([
      { itemName: "Ultra Ball", quantity: 5 },
      { itemName: "Hyper Potion", quantity: 2 },
    ]);
  });

  it("keeps single-item rewards for pokedex and trainers", () => {
    expect(objectiveReward(zone("kinds.route", 8), "pokedex").items).toEqual([
      { itemName: "Rare Candy", quantity: 1 },
    ]);
    expect(objectiveReward(zone("kinds.route", 8), "trainers").items).toEqual([
      { itemName: "Revive", quantity: 3 },
    ]);
  });

  it("makes item events more frequent and weights half toward healing", () => {
    expect(rollExplorationEvent({ zoneLevelMax: 10, roll: 0.1 })).toEqual({ kind: "item" });
    expect(pickEventItemName({ zoneLevelMax: 10, roll: 0.49 })).toBe("Potion");
    expect(pickEventItemName({ zoneLevelMax: 25, roll: 0.49 })).toBe("Super Potion");
    expect(pickEventItemName({ zoneLevelMax: 45, roll: 0.49 })).toBe("Hyper Potion");
    expect(pickEventItemName({ zoneLevelMax: 10, roll: 0.5 })).toBe("Poke Ball");
  });
});
