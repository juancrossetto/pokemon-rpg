import { describe, expect, it } from "vitest";
import { pickAutoPlayerMoveId, pickWildMove } from "@/lib/battle-ai";
import type { CombatantStats, MoveSnapshot } from "@/lib/battle";

const oddish: CombatantStats = {
  level: 10,
  types: ["grass", "poison"],
  atk: 40,
  def: 45,
  spAtk: 55,
  spDef: 55,
  speed: 30,
};

const absorb: MoveSnapshot = {
  id: 71,
  name: "absorb",
  type: "grass",
  category: "SPECIAL",
  power: 20,
  accuracy: 100,
  priority: 0,
  pp: 25,
};

const acid: MoveSnapshot = {
  id: 51,
  name: "acid",
  type: "poison",
  category: "SPECIAL",
  power: 40,
  accuracy: 100,
  priority: 0,
  pp: 30,
};

const growl: MoveSnapshot = {
  id: 45,
  name: "growl",
  type: "normal",
  category: "STATUS",
  power: null,
  accuracy: 100,
  priority: 0,
  pp: 40,
};

describe("pickWildMove anti-stall", () => {
  it("prefiere Acid antes que Absorber vs otro Oddish (espejo grass)", () => {
    // Sin ruido: varias muestras deben favorecer Acid (SE + no stall).
    let acidWins = 0;
    for (let i = 0; i < 20; i++) {
      const pick = pickWildMove(
        [absorb, acid, growl],
        oddish,
        oddish,
        40,
        [25, 30, 40],
        { attackerHp: 40, attackerMaxHp: 40 },
      );
      if (pick.id === acid.id) acidWins += 1;
    }
    expect(acidWins).toBeGreaterThanOrEqual(15);
  });

  it("rompe Absorber↔Absorber con Struggle tras usarlo 2 veces", () => {
    const pick = pickWildMove(
      [absorb, growl],
      oddish,
      oddish,
      40,
      [23, 40], // absorb usado 2 veces (25→23)
      { attackerHp: 38, attackerMaxHp: 40 },
    );
    expect(pick.name).toBe("struggle");
  });

  it("aún puede usar Absorber la primera vez si es el único ataque", () => {
    const pick = pickWildMove(
      [absorb, growl],
      oddish,
      oddish,
      40,
      [25, 40],
      { attackerHp: 40, attackerMaxHp: 40 },
    );
    expect(pick.id).toBe(absorb.id);
  });

  it("en auto, tras repetir Absorber el historial fuerza Struggle", () => {
    const id = pickAutoPlayerMoveId(
      [
        {
          moveId: 71,
          name: "absorb",
          type: "grass",
          category: "SPECIAL",
          power: 20,
          accuracy: 100,
          pp: 25,
        },
        {
          moveId: 45,
          name: "growl",
          type: "normal",
          category: "STATUS",
          power: null,
          accuracy: 100,
          pp: 40,
        },
      ],
      oddish,
      oddish,
      40,
      null,
      {
        attackerHp: 36,
        attackerMaxHp: 40,
        recentMoveIds: [71, 71],
      },
    );
    expect(id).toBe(-1); // STRUGGLE
  });
});
