import { describe, expect, it } from "vitest";
import { forecastDamage } from "@/lib/damage-forecast";
import { resolveMoveUse } from "@/lib/battle";
import type { CombatantStats, MoveSnapshot } from "@/lib/battle";

const attacker = {
  level: 50,
  atk: 120,
  spAtk: 90,
  types: ["fire"],
  burned: false,
};

const defender = {
  def: 100,
  spDef: 110,
  types: ["grass"],
  maxHp: 200,
};

const physicalFire: Parameters<typeof forecastDamage>[2] = {
  type: "fire",
  power: 80,
  category: "PHYSICAL",
};

describe("forecastDamage", () => {
  it("returns null for status moves", () => {
    expect(
      forecastDamage(attacker, defender, { type: "normal", power: null, category: "STATUS" }, 200),
    ).toBeNull();
  });

  it("returns null when the move has no power", () => {
    expect(
      forecastDamage(attacker, defender, { type: "fire", power: null, category: "PHYSICAL" }, 200),
    ).toBeNull();
  });

  it("keeps min below max", () => {
    const forecast = forecastDamage(attacker, defender, physicalFire, 200)!;
    expect(forecast.minPct).toBeLessThanOrEqual(forecast.maxPct);
    expect(forecast.minPct).toBeGreaterThan(0);
  });

  it("brackets the real roll from resolveMoveUse", () => {
    const attackerStats: CombatantStats = {
      level: attacker.level,
      types: attacker.types,
      atk: attacker.atk,
      def: 1,
      spAtk: attacker.spAtk,
      spDef: 1,
      speed: 1,
    };
    const defenderStats: CombatantStats = {
      level: 50,
      types: defender.types,
      atk: 1,
      def: defender.def,
      spAtk: 1,
      spDef: defender.spDef,
      speed: 1,
    };
    const move: MoveSnapshot = {
      id: 1,
      name: "flame-punch",
      type: "fire",
      category: "PHYSICAL",
      power: 80,
      accuracy: 100,
      priority: 0,
    };

    const forecast = forecastDamage(attacker, defender, physicalFire, 200)!;
    // Sin críticos el daño real cae dentro del rango previsto (±1 por floor).
    for (let i = 0; i < 200; i++) {
      const result = resolveMoveUse(attackerStats, defenderStats, move, { forceHit: true });
      if (result.critical) continue;
      const pct = Math.round((result.damage / defender.maxHp) * 100);
      expect(pct).toBeGreaterThanOrEqual(forecast.minPct - 1);
      expect(pct).toBeLessThanOrEqual(forecast.maxPct + 1);
    }
  });

  it("halves physical output when the attacker is burned", () => {
    const healthy = forecastDamage(attacker, defender, physicalFire, 200)!;
    const burned = forecastDamage({ ...attacker, burned: true }, defender, physicalFire, 200)!;
    expect(burned.maxPct).toBeLessThan(healthy.maxPct);
  });

  it("ignores burn on special moves", () => {
    const special = { type: "fire", power: 80, category: "SPECIAL" } as const;
    const healthy = forecastDamage(attacker, defender, special, 200)!;
    const burned = forecastDamage({ ...attacker, burned: true }, defender, special, 200)!;
    expect(burned).toEqual(healthy);
  });

  it("flags a guaranteed KO when the low roll already finishes the foe", () => {
    const forecast = forecastDamage(attacker, defender, physicalFire, 1)!;
    expect(forecast.guaranteedKo).toBe(true);
  });

  it("does not flag a KO against a full-HP wall", () => {
    const forecast = forecastDamage(
      attacker,
      { ...defender, def: 400, maxHp: 400 },
      physicalFire,
      400,
    )!;
    expect(forecast.guaranteedKo).toBe(false);
  });

  it("caps percentages at 100", () => {
    const forecast = forecastDamage(
      { ...attacker, atk: 9999 },
      { ...defender, def: 1, maxHp: 10 },
      physicalFire,
      10,
    )!;
    expect(forecast.maxPct).toBe(100);
  });

  it("returns null when category is missing (never assume PHYSICAL)", () => {
    expect(
      forecastDamage(attacker, defender, { type: "water", power: 65 }, 200),
    ).toBeNull();
  });

  // Regresión: Seadra (mucho Atq, poco Atq.Esp) vs Rapidash del líder de
  // Cinnabar. Bubble Beam es SPECIAL — si el forecast usara Atq/Def (o
  // defaultara PHYSICAL), marcaría KO seguro; el daño real deja ~20% HP.
  it("does not mark KO for special water vs Rapidash when Atk >> SpAtk", () => {
    const seadra = {
      level: 45,
      atk: 107,
      spAtk: 90,
      types: ["water"],
      burned: false,
    };
    const rapidash = {
      def: 63,
      spDef: 72,
      types: ["fire"],
      maxHp: 106,
    };
    const bubbleBeam = { type: "water", power: 65, category: "SPECIAL" } as const;

    const special = forecastDamage(seadra, rapidash, bubbleBeam, 106)!;
    expect(special.guaranteedKo).toBe(false);
    expect(special.maxPct).toBeLessThan(100);

    const physical = forecastDamage(
      seadra,
      rapidash,
      { ...bubbleBeam, category: "PHYSICAL" },
      106,
    )!;
    expect(physical.guaranteedKo).toBe(true);
  });

  it("ignores Defense stage drops when forecasting special moves", () => {
    const seadra = {
      level: 45,
      atk: 107,
      spAtk: 90,
      types: ["water"],
      burned: false,
    };
    const arcanineFull = {
      def: 80,
      spDef: 80,
      types: ["fire"],
      maxHp: 141,
    };
    const arcanineLeered = { ...arcanineFull, def: 40 }; // −2 Def
    const bubbleBeam = { type: "water", power: 65, category: "SPECIAL" } as const;

    const before = forecastDamage(seadra, arcanineFull, bubbleBeam, 141)!;
    const after = forecastDamage(seadra, arcanineLeered, bubbleBeam, 141)!;
    expect(after).toEqual(before);
    expect(after.guaranteedKo).toBe(false);
  });
});
