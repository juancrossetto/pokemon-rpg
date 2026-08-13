import { describe, expect, it } from "vitest";
import {
  BATTLE_AUTO_UNLOCK_COUNT,
  BATTLE_AUTO_UNLOCK_LEVEL,
  isBattleAutoUnlocked,
  pickAutoSwitchCandidate,
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

describe("pickAutoSwitchCandidate", () => {
  const party = [
    { instanceId: "pidgey", level: 14, currentHp: 28, maxHp: 35, types: ["flying"] },
    { instanceId: "oddish", level: 16, currentHp: 36, maxHp: 40, types: ["grass", "poison"] },
    { instanceId: "rattata", level: 14, currentHp: 30, maxHp: 30, types: ["normal"] },
  ];

  it("cambia a una ventaja clara antes de sacrificar al activo", () => {
    expect(pickAutoSwitchCandidate(party, "pidgey", ["water"])?.instanceId).toBe("oddish");
  });

  it("no rota por diferencias neutrales", () => {
    expect(pickAutoSwitchCandidate(party, "pidgey", ["normal"])).toBeNull();
  });

  it("no abandona un matchup ya favorable", () => {
    expect(pickAutoSwitchCandidate(party, "oddish", ["water"])).toBeNull();
  });

  it("no manda a combatir un reemplazo casi debilitado", () => {
    const hurt = party.map((member) =>
      member.instanceId === "oddish" ? { ...member, currentHp: 10 } : member,
    );
    expect(pickAutoSwitchCandidate(hurt, "pidgey", ["water"])).toBeNull();
  });
});
