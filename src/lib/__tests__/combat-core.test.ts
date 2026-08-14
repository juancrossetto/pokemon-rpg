import { describe, expect, it } from "vitest";
import { attemptCapture } from "@/lib/capture";
import { effectivePp, xpForVictory } from "@/lib/battle";
import { fleeOdds, fleeChancePercent, rollFlee } from "@/lib/flee";
import {
  multiHitSpec,
  rollMultiHitCount,
  rollRangeHits,
} from "@/lib/multi-hit";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { unspentPointsForLevel, xpForLevel } from "@/lib/stats";

/** Peleas necesarias para pasar de `level` a `level + 1` contra rivales `foeLevel`. */
function battlesPerLevel(level: number, foeLevel = level): number {
  return (xpForLevel(level + 1) - xpForLevel(level)) / xpForVictory(foeLevel);
}

describe("xpForVictory", () => {
  it("mantiene el ritmo parejo en vez de estirarse con el nivel", () => {
    // Antes: 1.2 peleas por nivel a Lv.5 y 4.7 a Lv.17 (premio lineal contra
    // curva cúbica). El tope de 3 es la garantía de que no vuelve a pasar.
    for (const level of [5, 10, 17, 25, 40, 60]) {
      expect(battlesPerLevel(level)).toBeLessThan(3);
    }
  });

  it("el tramo previo al segundo gimnasio deja de ser un muro", () => {
    // Equipo Nv.18 farmeando rivales Nv.13 (Monte Moon / Celeste).
    expect(battlesPerLevel(18, 13)).toBeLessThan(3.5);
  });

  it("premia al rival más fuerte", () => {
    expect(xpForVictory(20)).toBeGreaterThan(xpForVictory(10) * 2);
  });
});

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

  it("exposes a UI-friendly percent", () => {
    expect(fleeChancePercent(50, 50, 0)).toBe(50);
    expect(fleeChancePercent(100, 1, 0)).toBe(100);
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

describe("multi-hit", () => {
  it("maps fixed and range moves by name", () => {
    expect(multiHitSpec("double-kick")).toEqual({ kind: "fixed", hits: 2 });
    expect(multiHitSpec("Triple Kick")).toEqual({ kind: "fixed", hits: 3 });
    expect(multiHitSpec("pin-missile")).toEqual({ kind: "range", min: 2, max: 5 });
    expect(multiHitSpec("tackle")).toBeNull();
  });

  it("rolls fixed counts as-is", () => {
    expect(rollMultiHitCount({ kind: "fixed", hits: 2 })).toBe(2);
    expect(rollMultiHitCount({ kind: "fixed", hits: 3 })).toBe(3);
  });

  it("uses Gen III+ 2–5 distribution", () => {
    expect(rollRangeHits(2, 5, () => 0)).toBe(2);
    expect(rollRangeHits(2, 5, () => 3 / 8 - 0.001)).toBe(2);
    expect(rollRangeHits(2, 5, () => 3 / 8)).toBe(3);
    expect(rollRangeHits(2, 5, () => 6 / 8)).toBe(4);
    expect(rollRangeHits(2, 5, () => 7 / 8)).toBe(5);
  });
});
