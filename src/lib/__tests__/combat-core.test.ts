import { describe, expect, it } from "vitest";
import { attemptCapture } from "@/lib/capture";
import { effectivePp } from "@/lib/battle";
import { fleeOdds, rollFlee } from "@/lib/flee";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { unspentPointsForLevel } from "@/lib/stats";

describe("effectivePp", () => {
  it("treats null/undefined as full (legacy)", () => {
    expect(effectivePp(null, 15)).toBe(15);
    expect(effectivePp(undefined, 20)).toBe(20);
  });

  it("treats 0 as empty", () => {
    expect(effectivePp(0, 15)).toBe(0);
  });

  it("clamps to max", () => {
    expect(effectivePp(99, 10)).toBe(10);
    expect(effectivePp(5, 10)).toBe(5);
  });
});

describe("fleeOdds / rollFlee", () => {
  it("guarantees escape when odds >= 256", () => {
    expect(fleeOdds(100, 1, 0)).toBeGreaterThanOrEqual(256);
    expect(rollFlee(100, 1, 0, () => 0.99)).toBe(true);
  });

  it("increases with failed attempts", () => {
    expect(fleeOdds(40, 40, 2)).toBeGreaterThan(fleeOdds(40, 40, 0));
  });

  it("respects rng threshold", () => {
    const odds = fleeOdds(50, 50, 0); // 128
    expect(rollFlee(50, 50, 0, () => 0)).toBe(true); // roll 0
    expect(rollFlee(50, 50, 0, () => (odds - 0.5) / 256)).toBe(true);
    expect(rollFlee(50, 50, 0, () => odds / 256)).toBe(false);
  });
});

describe("attemptCapture", () => {
  it("Master Ball always catches with 4 shakes", () => {
    expect(attemptCapture(100, 100, 3, 255)).toEqual({ caught: true, shakes: 4 });
  });

  it("guarantees catch when a >= 255", () => {
    // Full catch rate, 1 HP, ball x1 → a is high for catchRate 255
    expect(attemptCapture(1, 100, 255, 1)).toEqual({ caught: true, shakes: 4 });
  });

  it("never exceeds 4 shakes", () => {
    const r = attemptCapture(50, 100, 45, 1);
    expect(r.shakes).toBeGreaterThanOrEqual(0);
    expect(r.shakes).toBeLessThanOrEqual(4);
    expect(r.caught).toBe(r.shakes === 4);
  });
});

describe("type effectiveness", () => {
  it("Water vs Fire is super effective", () => {
    expect(getTypeEffectiveness("water", ["fire"])).toBe(2);
    expect(getTypeEffectiveness("Water", ["Fire"])).toBe(2);
  });

  it("Electric vs Ground is immune", () => {
    expect(getTypeEffectiveness("electric", ["ground"])).toBe(0);
  });

  it("stacks dual types", () => {
    expect(getTypeEffectiveness("fighting", ["rock", "steel"])).toBe(4);
  });
});

describe("unspentPointsForLevel", () => {
  it("gives 0 at level 1 and 3 per level after", () => {
    expect(unspentPointsForLevel(1)).toBe(0);
    expect(unspentPointsForLevel(5)).toBe(12);
    expect(unspentPointsForLevel(100)).toBe(297);
  });
});
