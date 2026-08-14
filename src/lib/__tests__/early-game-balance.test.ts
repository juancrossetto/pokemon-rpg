import { describe, expect, it } from "vitest";
import {
  capWildLevelForEarlyGame,
  earlyGameBattleMode,
  earlyGamePowerMultiplier,
  levelAdvantageMultiplier,
} from "@/lib/early-game-balance";
import { TUTORIAL_BATTLE_ID } from "@/lib/battle-tutorial";

describe("earlyGameBattleMode", () => {
  it("wild encounter sin entrenador", () => {
    expect(earlyGameBattleMode({})).toBe("wild");
  });

  it("tutorial por routeTrainerId", () => {
    expect(earlyGameBattleMode({ routeTrainerId: TUTORIAL_BATTLE_ID })).toBe("tutorial");
  });

  it("no aplica en PvP ni ruta", () => {
    expect(earlyGameBattleMode({ pvpMatchId: "x" })).toBeNull();
    expect(earlyGameBattleMode({ routeTrainerId: "route-trainer-1" })).toBeNull();
  });
});

describe("levelAdvantageMultiplier", () => {
  it("no cambia nada si el salvaje iguala o supera al jugador", () => {
    expect(levelAdvantageMultiplier(14, 14, "player")).toBe(1);
    expect(levelAdvantageMultiplier(14, 20, "wild")).toBe(1);
  });

  it("premia sacarle niveles al rival", () => {
    expect(levelAdvantageMultiplier(19, 14, "player")).toBeCloseTo(1.3);
    expect(levelAdvantageMultiplier(19, 14, "wild")).toBeCloseTo(0.75);
  });

  it("satura: 20 niveles no pegan más que 5", () => {
    expect(levelAdvantageMultiplier(34, 14, "player")).toBeCloseTo(
      levelAdvantageMultiplier(19, 14, "player"),
    );
  });
});

describe("earlyGamePowerMultiplier", () => {
  it("sin ayuda de onboarding ni ventaja de nivel, no toca nada", () => {
    expect(earlyGamePowerMultiplier(30, 30, "player", "wild")).toBe(1);
    expect(earlyGamePowerMultiplier(30, 32, "wild", "wild")).toBe(1);
  });

  it("suaviza salvajes y ayuda al jugador en Lv.5", () => {
    expect(earlyGamePowerMultiplier(5, 5, "player", "wild")).toBeGreaterThan(1);
    expect(earlyGamePowerMultiplier(5, 5, "wild", "wild")).toBeLessThan(1);
  });

  it("el caso reportado: Lv.19 contra un salvaje Lv.14 queda a favor", () => {
    const player = earlyGamePowerMultiplier(19, 14, "player", "wild");
    const wild = earlyGamePowerMultiplier(19, 14, "wild", "wild");
    // Antes daba 1.02 / 0.98: la ventaja de 5 niveles no se notaba.
    expect(player).toBeGreaterThan(1.3);
    expect(wild).toBeLessThan(0.75);
  });

  it("tutorial es más indulgente", () => {
    expect(earlyGamePowerMultiplier(5, 5, "wild", "tutorial")).toBeLessThan(
      earlyGamePowerMultiplier(5, 5, "wild", "wild"),
    );
  });
});

describe("capWildLevelForEarlyGame", () => {
  it("capa en zonas bajas", () => {
    expect(capWildLevelForEarlyGame(7, 5, 5)).toBe(6);
    expect(capWildLevelForEarlyGame(4, 5, 5)).toBe(4);
  });

  it("extiende la protección hasta Ciudad Celeste", () => {
    expect(capWildLevelForEarlyGame(18, 14, 16)).toBe(15);
  });

  it("no capa después del recorrido inicial", () => {
    expect(capWildLevelForEarlyGame(18, 14, 19)).toBe(18);
  });
});
