import { describe, expect, it } from "vitest";
import {
  resolveDoubleTurn,
  doublesWon,
  doublesLost,
  type DoubleField,
} from "@/lib/doubles/resolve-turn";
import { emptyStages, type SideBattleState } from "@/lib/resolve-action";
import type { MoveSnapshot } from "@/lib/battle";

function mon(
  name: string,
  hp: number,
  speed: number,
  overrides: Partial<SideBattleState> = {},
): SideBattleState {
  return {
    hp,
    maxHp: Math.max(hp, 1),
    status: null,
    sleepTurns: 0,
    stages: emptyStages(),
    name,
    baseStats: {
      level: 30,
      types: ["normal"],
      atk: 50,
      def: 50,
      spAtk: 50,
      spDef: 50,
      speed,
    },
    ...overrides,
  };
}

const tackle: MoveSnapshot = {
  id: 1,
  name: "tackle",
  type: "normal",
  category: "PHYSICAL",
  power: 40,
  accuracy: 100,
  priority: 0,
  target: "selected-pokemon",
};

const earthquake: MoveSnapshot = {
  id: 89,
  name: "earthquake",
  type: "ground",
  category: "PHYSICAL",
  power: 100,
  accuracy: 100,
  priority: 0,
  target: "all-other-pokemon",
};

const rockSlide: MoveSnapshot = {
  id: 157,
  name: "rock-slide",
  type: "rock",
  category: "PHYSICAL",
  power: 75,
  accuracy: 90,
  priority: 0,
  target: "all-opponents",
};

describe("resolveDoubleTurn", () => {
  it("orders by speed across four slots", () => {
    const field: DoubleField = {
      playerA: mon("A", 100, 40),
      playerB: mon("B", 100, 90),
      wildA: mon("WA", 100, 50),
      wildB: mon("WB", 100, 20),
    };
    const { events } = resolveDoubleTurn(
      field,
      [
        { slot: "playerA", move: tackle },
        { slot: "playerB", move: tackle },
        { slot: "wildA", move: tackle },
        { slot: "wildB", move: tackle },
      ],
      false,
      false,
    );
    const actors = events
      .filter((e) => e.hit || e.damage > 0 || e.moveName === "tackle")
      .map((e) => e.side + (e.fieldSlot ?? ""));
    expect(actors[0]).toBe("playerB");
  });

  it("tags targetFieldSlot on redirect when preferred foe is fainted", () => {
    const field: DoubleField = {
      playerA: mon("A", 100, 80),
      playerB: mon("B", 100, 10),
      wildA: mon("WA", 0, 50),
      wildB: mon("WB", 100, 50),
    };
    const { events, field: after } = resolveDoubleTurn(
      field,
      [{ slot: "playerA", move: tackle, targetLane: "A" }],
      false,
      false,
    );
    const hit = events.find((e) => e.hit && e.damage > 0);
    expect(hit?.fieldSlot).toBe("A");
    expect(hit?.targetFieldSlot).toBe("B");
    expect(after.wildA.hp).toBe(0);
    expect(after.wildB!.hp).toBeLessThan(100);
  });

  it("respects explicit cross-lane target", () => {
    const field: DoubleField = {
      playerA: mon("A", 100, 80),
      playerB: mon("B", 100, 10),
      wildA: mon("WA", 100, 50),
      wildB: mon("WB", 100, 50),
    };
    const { events, field: after } = resolveDoubleTurn(
      field,
      [{ slot: "playerA", move: tackle, targetLane: "B" }],
      false,
      false,
    );
    const hit = events.find((e) => e.hit && e.damage > 0);
    expect(hit?.targetFieldSlot).toBe("B");
    expect(after.wildA.hp).toBe(100);
    expect(after.wildB!.hp).toBeLessThan(100);
  });

  it("rock-slide hits both foes", () => {
    const field: DoubleField = {
      playerA: mon("A", 100, 80),
      playerB: mon("B", 100, 10),
      wildA: mon("WA", 100, 50),
      wildB: mon("WB", 100, 50),
    };
    const { field: after } = resolveDoubleTurn(
      field,
      [{ slot: "playerA", move: rockSlide }],
      false,
      false,
    );
    expect(after.wildA.hp).toBeLessThan(100);
    expect(after.wildB!.hp).toBeLessThan(100);
  });

  it("earthquake also damages the ally", () => {
    const field: DoubleField = {
      playerA: mon("A", 100, 80),
      playerB: mon("B", 100, 10),
      wildA: mon("WA", 100, 50),
      wildB: mon("WB", 100, 50),
    };
    const { field: after } = resolveDoubleTurn(
      field,
      [{ slot: "playerA", move: earthquake }],
      false,
      false,
    );
    expect(after.wildA.hp).toBeLessThan(100);
    expect(after.wildB!.hp).toBeLessThan(100);
    expect(after.playerB!.hp).toBeLessThan(100);
  });

  it("wins when both wilds faint", () => {
    const field: DoubleField = {
      playerA: mon("A", 100, 50),
      playerB: mon("B", 100, 50),
      wildA: mon("WA", 0, 50),
      wildB: mon("WB", 0, 50),
    };
    expect(doublesWon(field)).toBe(true);
    expect(doublesLost(field)).toBe(false);
  });

  it("loses when both players faint", () => {
    const field: DoubleField = {
      playerA: mon("A", 0, 50),
      playerB: mon("B", 0, 50),
      wildA: mon("WA", 100, 50),
      wildB: mon("WB", 100, 50),
    };
    expect(doublesLost(field)).toBe(true);
  });

  it("Fly: turno 1 se va, turno 2 vuelve y pega (slot A)", () => {
    const fly: MoveSnapshot = {
      id: 19,
      name: "fly",
      type: "flying",
      category: "PHYSICAL",
      power: 90,
      accuracy: 95,
      priority: 0,
      target: "selected-pokemon",
    };
    const startField: DoubleField = {
      playerA: mon("Charizard", 100, 80),
      playerB: mon("Partner", 100, 40),
      wildA: mon("WA", 100, 30),
      wildB: mon("WB", 100, 20),
    };
    const start = resolveDoubleTurn(
      startField,
      [
        { slot: "playerA", move: fly, targetLane: "A" },
        { slot: "playerB", move: tackle, targetLane: "B" },
        { slot: "wildA", move: tackle, targetLane: "A" },
        { slot: "wildB", move: tackle, targetLane: "B" },
      ],
      false,
      false,
    );
    expect(start.field.playerA.chargeMoveId).toBe(19);
    expect(start.field.playerA.semiInvuln).toBe("air");
    expect(start.events.some((e) => e.chargePhase === "start" && e.fieldSlot === "A")).toBe(
      true,
    );

    const finish = resolveDoubleTurn(
      {
        playerA: { ...start.field.playerA },
        playerB: start.field.playerB ? { ...start.field.playerB } : null,
        wildA: { ...start.field.wildA },
        wildB: start.field.wildB ? { ...start.field.wildB } : null,
      },
      [
        { slot: "playerA", move: fly, targetLane: "A" },
        { slot: "playerB", move: tackle, targetLane: "B" },
        { slot: "wildA", move: tackle, targetLane: "A" },
        { slot: "wildB", move: tackle, targetLane: "B" },
      ],
      false,
      false,
    );
    expect(finish.field.playerA.chargeMoveId).toBeNull();
    expect(finish.field.playerA.semiInvuln).toBeNull();
    expect(finish.events.some((e) => e.chargePhase === "finish" && e.fieldSlot === "A")).toBe(
      true,
    );
    expect(finish.field.wildA.hp).toBeLessThan(start.field.wildA.hp);
  });

  it("Fly: el target del turno 1 queda locked; si murió, el finish falla", () => {
    const fly: MoveSnapshot = {
      id: 19,
      name: "fly",
      type: "flying",
      category: "PHYSICAL",
      power: 90,
      accuracy: 95,
      priority: 0,
      target: "selected-pokemon",
    };
    const startField: DoubleField = {
      playerA: mon("Charizard", 100, 80),
      playerB: mon("Partner", 100, 99),
      wildA: mon("WA", 5, 30),
      wildB: mon("WB", 100, 20),
    };
    const start = resolveDoubleTurn(
      startField,
      [
        { slot: "playerA", move: fly, targetLane: "A" },
        { slot: "playerB", move: tackle, targetLane: "A" },
        { slot: "wildA", move: tackle, targetLane: "B" },
        { slot: "wildB", move: tackle, targetLane: "B" },
      ],
      false,
      false,
    );
    expect(start.field.playerA.chargeTargetLane).toBe("A");
    // Partner mató al wild A mientras Charizard volaba.
    expect(start.field.wildA.hp).toBe(0);

    const finish = resolveDoubleTurn(
      {
        playerA: { ...start.field.playerA },
        playerB: start.field.playerB ? { ...start.field.playerB } : null,
        wildA: { ...start.field.wildA },
        wildB: start.field.wildB ? { ...start.field.wildB } : null,
      },
      [
        { slot: "playerA", move: fly, targetLane: "B" }, // cliente manda otra calle: se ignora
        { slot: "playerB", move: tackle, targetLane: "B" },
        { slot: "wildB", move: tackle, targetLane: "B" },
      ],
      false,
      false,
    );
    const finishEv = finish.events.find(
      (e) => e.chargePhase === "finish" && e.fieldSlot === "A",
    );
    expect(finishEv).toBeTruthy();
    expect(finishEv?.hit).toBe(false);
    expect(finish.field.playerA.chargeMoveId).toBeNull();
    expect(finish.field.playerA.semiInvuln).toBeNull();
    // Fly no redirigió: ningún daño del finish.
    expect(
      finish.events.some(
        (e) => e.chargePhase === "finish" && e.fieldSlot === "A" && e.hit && e.damage > 0,
      ),
    ).toBe(false);
  });
});
