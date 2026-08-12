import { describe, expect, it } from "vitest";
import {
  capWildLevelForEarlyGame,
  earlyGameBattleMode,
  earlyGamePowerMultiplier,
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

describe("earlyGamePowerMultiplier", () => {
  it("sin efecto a partir del tope", () => {
    expect(earlyGamePowerMultiplier(12, "player", "wild")).toBe(1);
    expect(earlyGamePowerMultiplier(15, "wild", "wild")).toBe(1);
  });

  it("suaviza salvajes y ayuda al jugador en Lv.5", () => {
    const player = earlyGamePowerMultiplier(5, "player", "wild");
    const wild = earlyGamePowerMultiplier(5, "wild", "wild");
    expect(player).toBeGreaterThan(1);
    expect(wild).toBeLessThan(1);
  });

  it("tutorial es más indulgente", () => {
    expect(earlyGamePowerMultiplier(5, "wild", "tutorial")).toBeLessThan(
      earlyGamePowerMultiplier(5, "wild", "wild"),
    );
  });
});

describe("capWildLevelForEarlyGame", () => {
  it("capa en zonas bajas", () => {
    expect(capWildLevelForEarlyGame(7, 5, 5)).toBe(6);
    expect(capWildLevelForEarlyGame(4, 5, 5)).toBe(4);
  });

  it("no capa en zonas altas", () => {
    expect(capWildLevelForEarlyGame(12, 5, 12)).toBe(12);
  });
});
