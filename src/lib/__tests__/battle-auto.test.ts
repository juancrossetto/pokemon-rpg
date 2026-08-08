import { describe, expect, it } from "vitest";
import {
  BATTLE_AUTO_UNLOCK_COUNT,
  BATTLE_AUTO_UNLOCK_LEVEL,
  isBattleAutoUnlocked,
} from "@/lib/battle-auto";

describe("isBattleAutoUnlocked", () => {
  it("bloquea sin Pokémon", () => {
    expect(isBattleAutoUnlocked([])).toBe(false);
  });

  it("bloquea con menos de 3 a nivel umbral", () => {
    expect(isBattleAutoUnlocked([10, 10, 9])).toBe(false);
    expect(isBattleAutoUnlocked([15, 20])).toBe(false);
  });

  it("desbloquea con exactamente 3 a nivel umbral", () => {
    expect(
      isBattleAutoUnlocked([
        BATTLE_AUTO_UNLOCK_LEVEL,
        BATTLE_AUTO_UNLOCK_LEVEL,
        BATTLE_AUTO_UNLOCK_LEVEL,
      ]),
    ).toBe(true);
  });

  it("ignora los que están por debajo del umbral", () => {
    const levels = Array.from({ length: BATTLE_AUTO_UNLOCK_COUNT }, () => 9);
    expect(isBattleAutoUnlocked(levels)).toBe(false);
  });

  it("acepta niveles por encima del umbral", () => {
    expect(isBattleAutoUnlocked([12, 40, 10, 5])).toBe(true);
  });
});
