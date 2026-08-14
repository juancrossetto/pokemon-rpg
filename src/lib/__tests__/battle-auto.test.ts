import { describe, expect, it } from "vitest";
import {
  BATTLE_AUTO_POTION_HP_PERCENT,
  BATTLE_AUTO_UNLOCK_COUNT,
  BATTLE_AUTO_UNLOCK_LEVEL,
  isBattleAutoUnlocked,
  pickAutoPotion,
  pickAutoSwitchCandidate,
  shouldStopAutoBattle,
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

describe("pickAutoPotion", () => {
  const potions = [
    { itemId: "potion", quantity: 3, healAmount: 20, kind: "heal" as const },
    { itemId: "super", quantity: 2, healAmount: 50, kind: "heal" as const },
    { itemId: "hyper", quantity: 1, healAmount: 200, kind: "heal" as const },
    { itemId: "revive", quantity: 4, healAmount: 0, kind: "revive" as const },
  ];

  it("no gasta pociones por encima del umbral", () => {
    expect(pickAutoPotion(potions, BATTLE_AUTO_POTION_HP_PERCENT + 1, 100)).toBeNull();
  });

  it("actua exactamente en el umbral", () => {
    expect(pickAutoPotion(potions, BATTLE_AUTO_POTION_HP_PERCENT, 100)?.itemId).toBe("hyper");
  });

  it("elige la cura mÃ¡s chica que cubre los PS faltantes", () => {
    expect(pickAutoPotion(potions, 20, 60)?.itemId).toBe("super");
  });

  it("usa la mÃ¡s potente si ninguna alcanza", () => {
    const limited = potions.filter((stack) => stack.itemId !== "hyper");
    expect(pickAutoPotion(limited, 10, 100)?.itemId).toBe("super");
  });

  it("ignora revivir, stacks vacÃ­os y PokÃ©mon debilitados", () => {
    const unusable = [
      { itemId: "empty", quantity: 0, healAmount: 200, kind: "heal" as const },
      { itemId: "revive", quantity: 2, healAmount: 0, kind: "revive" as const },
    ];
    expect(pickAutoPotion(unusable, 20, 100)).toBeNull();
    expect(pickAutoPotion(potions, 0, 100)).toBeNull();
  });
});

describe("AUTO profiles", () => {
  it("heals earlier in conservative mode and later in aggressive mode", () => {
    const potions = [{ itemId: "potion", quantity: 2, healAmount: 20, kind: "heal" as const }];
    expect(pickAutoPotion(potions, 50, 100, "conservative")).not.toBeNull();
    expect(pickAutoPotion(potions, 50, 100, "balanced")).toBeNull();
    expect(pickAutoPotion(potions, 25, 100, "aggressive")).toBeNull();
  });

  it("stops only at the configured threshold when no healing item exists", () => {
    expect(shouldStopAutoBattle(15, 100, 15, false)).toBe(true);
    expect(shouldStopAutoBattle(15, 100, 15, true)).toBe(false);
    expect(shouldStopAutoBattle(5, 100, 0, false)).toBe(false);
  });
});
