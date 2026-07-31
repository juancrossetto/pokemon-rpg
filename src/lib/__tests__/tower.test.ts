import { describe, expect, it } from "vitest";
import {
  canChallengeFloor,
  getFloorStatus,
  getNextTowerAction,
  isTowerUnlocked,
  pickBlessingOffers,
  applyHealToSnapshot,
  applyReviveOne,
  livingCount,
  shouldOfferBlessing,
  recommendedPcForFloor,
  getTowerFloor,
  autoAscentShouldStop,
  COMBAT_TOWER_CONFIG,
} from "@/lib/tower";
import type { TowerRunCreature } from "@/lib/tower";

function member(partial: Partial<TowerRunCreature> & { instanceId: string }): TowerRunCreature {
  return {
    slot: 1,
    speciesId: 1,
    speciesName: "Bulbasaur",
    nickname: null,
    spriteUrl: "",
    level: 10,
    types: ["grass"],
    currentHp: 50,
    maxHp: 50,
    defeated: false,
    adventureHp: 50,
    adventurePp: [],
    ...partial,
  };
}

describe("tower unlock", () => {
  it("requires configured badge count", () => {
    expect(isTowerUnlocked(0)).toBe(false);
    expect(isTowerUnlocked(1)).toBe(false);
    expect(isTowerUnlocked(2)).toBe(true);
    expect(isTowerUnlocked(8)).toBe(true);
  });
});

describe("sequential floors", () => {
  it("only allows challenging the current floor", () => {
    expect(
      canChallengeFloor({
        unlocked: true,
        runStatus: "ACTIVE",
        currentFloor: 7,
        targetFloor: 7,
        hasLiving: true,
        inBattle: false,
      }),
    ).toBe(true);
    expect(
      canChallengeFloor({
        unlocked: true,
        runStatus: "ACTIVE",
        currentFloor: 7,
        targetFloor: 8,
        hasLiving: true,
        inBattle: false,
      }),
    ).toBe(false);
  });

  it("marks past floors completed and future locked", () => {
    expect(
      getFloorStatus({ floorNumber: 3, currentFloor: 5, highestCleared: 4, runActive: true }),
    ).toBe("completed");
    expect(
      getFloorStatus({ floorNumber: 5, currentFloor: 5, highestCleared: 4, runActive: true }),
    ).toBe("current");
    expect(
      getFloorStatus({ floorNumber: 9, currentFloor: 5, highestCleared: 4, runActive: true }),
    ).toBe("locked");
  });
});

describe("HP persistence helpers", () => {
  it("heals living units without reviving", () => {
    const team = [
      member({ instanceId: "a", currentHp: 10, maxHp: 100 }),
      member({ instanceId: "b", currentHp: 0, maxHp: 80, defeated: true }),
    ];
    const next = applyHealToSnapshot(team, 20);
    expect(next[0]!.currentHp).toBe(30);
    expect(next[1]!.defeated).toBe(true);
    expect(next[1]!.currentHp).toBe(0);
  });

  it("revives the first defeated unit", () => {
    const team = [
      member({ instanceId: "a", currentHp: 0, maxHp: 100, defeated: true }),
      member({ instanceId: "b", currentHp: 40, maxHp: 80 }),
    ];
    const next = applyReviveOne(team, 30);
    expect(next[0]!.defeated).toBe(false);
    expect(next[0]!.currentHp).toBe(30);
    expect(livingCount(next)).toBe(2);
  });
});

describe("blessings and CTA", () => {
  it("offers up to 3 distinct blessings", () => {
    const offers = pickBlessingOffers([], () => 0.1);
    expect(offers.length).toBeLessThanOrEqual(3);
    expect(new Set(offers).size).toBe(offers.length);
  });

  it("offers blessings on configured milestone floors", () => {
    expect(shouldOfferBlessing(5)).toBe(true);
    expect(shouldOfferBlessing(6)).toBe(false);
    expect(shouldOfferBlessing(10)).toBe(true);
  });

  it("resolves primary action for active combat floor", () => {
    const floor = getTowerFloor(1)!;
    const action = getNextTowerAction({
      unlocked: true,
      attemptsRemaining: 2,
      runStatus: "ACTIVE",
      inBattle: false,
      currentFloor: 1,
      floor,
      team: [member({ instanceId: "a" })],
    });
    expect(action.action).toBe("challenge_floor");
    expect(action.enabled).toBe(true);
  });

  it("locks start when out of attempts", () => {
    const action = getNextTowerAction({
      unlocked: true,
      attemptsRemaining: 0,
      runStatus: null,
      inBattle: false,
      currentFloor: 1,
      floor: getTowerFloor(1),
      team: null,
    });
    expect(action.enabled).toBe(false);
    expect(action.reasonKey).toBe("errors.noAttempts");
  });
});

describe("scaling and auto-ascent", () => {
  it("raises recommended PC across blocks without linear explosion", () => {
    const f1 = recommendedPcForFloor(1);
    const f15 = recommendedPcForFloor(15);
    const f30 = recommendedPcForFloor(30);
    expect(f15).toBeGreaterThan(f1);
    expect(f30).toBeGreaterThan(f15);
    expect(f30 / f1).toBeLessThan(6);
  });

  it("stops auto-ascent on boss or low HP", () => {
    const team = [member({ instanceId: "a", currentHp: 10, maxHp: 100 })];
    expect(
      autoAscentShouldStop({ floorType: "boss", team, awaitingBlessing: false }),
    ).toBe(true);
    expect(
      autoAscentShouldStop({ floorType: "normal", team, awaitingBlessing: false }),
    ).toBe(true);
    expect(
      autoAscentShouldStop({
        floorType: "normal",
        team: [member({ instanceId: "a", currentHp: 90, maxHp: 100 })],
        awaitingBlessing: false,
      }),
    ).toBe(false);
  });

  it("MVP config stays within planned scope", () => {
    expect(COMBAT_TOWER_CONFIG.totalFloors).toBe(30);
    expect(COMBAT_TOWER_CONFIG.resetType).toBe("weekly");
    // Un ascenso por período semanal (el campo se llama dailyAttempts por legado).
    expect(COMBAT_TOWER_CONFIG.rules.dailyAttempts).toBe(1);
    expect(COMBAT_TOWER_CONFIG.unlock.minBadges).toBe(2);
  });
});
