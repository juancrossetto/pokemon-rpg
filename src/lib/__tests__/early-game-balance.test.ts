import { describe, expect, it } from "vitest";
import {
  capWildLevelForEarlyGame,
  earlyGameBattleMode,
  earlyGamePowerMultiplier,
  levelAdvantageMultiplier,
  raiseWildLevelForPlayer,
} from "@/lib/early-game-balance";
import { TUTORIAL_BATTLE_ID } from "@/lib/battle-tutorial";

describe("earlyGameBattleMode", () => {
  it("wild encounter sin entrenador", () => {
    expect(earlyGameBattleMode({})).toBe("wild");
  });

  it("tutorial por routeTrainerId", () => {
    expect(earlyGameBattleMode({ routeTrainerId: TUTORIAL_BATTLE_ID })).toBe("tutorial");
  });

  it("entrenador de ruta tiene su propio modo", () => {
    expect(earlyGameBattleMode({ routeTrainerId: "route-trainer-1" })).toBe("trainer");
  });

  it("no aplica en PvP, gimnasio ni guerra de clan", () => {
    expect(earlyGameBattleMode({ pvpMatchId: "x" })).toBeNull();
    expect(earlyGameBattleMode({ gymRunId: "x" })).toBeNull();
    expect(earlyGameBattleMode({ clanWarBattleId: "x" })).toBeNull();
  });
});

describe("levelAdvantageMultiplier", () => {
  it("no cambia nada si el salvaje iguala o supera al jugador", () => {
    expect(levelAdvantageMultiplier(14, 14, "player")).toBe(1);
    expect(levelAdvantageMultiplier(14, 20, "wild")).toBe(1);
  });

  it("premia sacarle niveles al rival", () => {
    // 5 de 8 niveles de saturación.
    expect(levelAdvantageMultiplier(19, 14, "player")).toBeCloseTo(1 + 0.55 * (5 / 8));
    expect(levelAdvantageMultiplier(19, 14, "wild")).toBeCloseTo(1 - 0.45 * (5 / 8));
  });

  it("una ventaja chica pesa más que en la versión anterior (0.06/0.05 por nivel)", () => {
    // Ampliar la saturación sin subir los coeficientes habría empeorado justo
    // el caso más común de la aventura: 3 niveles arriba.
    expect(levelAdvantageMultiplier(16, 13, "player")).toBeGreaterThan(1 + 0.06 * 3);
    expect(levelAdvantageMultiplier(16, 13, "wild")).toBeLessThan(1 - 0.05 * 3);
  });

  it("sigue creciendo más allá de 5 niveles (tramo pre-Misty)", () => {
    expect(levelAdvantageMultiplier(22, 14, "player")).toBeGreaterThan(
      levelAdvantageMultiplier(19, 14, "player"),
    );
  });

  it("satura: 20 niveles no pegan más que 8", () => {
    expect(levelAdvantageMultiplier(34, 14, "player")).toBeCloseTo(
      levelAdvantageMultiplier(22, 14, "player"),
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

  it("entrenador de ruta: sólo ventaja de nivel, sin ayuda de onboarding", () => {
    expect(earlyGamePowerMultiplier(5, 5, "player", "trainer")).toBe(1);
    expect(earlyGamePowerMultiplier(5, 5, "wild", "trainer")).toBe(1);
    expect(earlyGamePowerMultiplier(18, 14, "player", "trainer")).toBeCloseTo(
      levelAdvantageMultiplier(18, 14, "player"),
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

describe("raiseWildLevelForPlayer", () => {
  it("levanta el piso hacia el jugador sin pasar el techo de la zona", () => {
    // Monte Moon (10-14) con un equipo Nv.18: sale 14, no 10.
    expect(raiseWildLevelForPlayer(10, 18, 14)).toBe(14);
    expect(raiseWildLevelForPlayer(12, 16, 16)).toBe(13);
  });

  it("no baja un salvaje que ya salió alto", () => {
    expect(raiseWildLevelForPlayer(16, 12, 16)).toBe(16);
  });

  it("no toca nada cuando el jugador va parejo o por debajo", () => {
    expect(raiseWildLevelForPlayer(12, 10, 16)).toBe(12);
  });
});
