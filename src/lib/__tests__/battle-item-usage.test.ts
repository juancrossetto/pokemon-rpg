import { describe, expect, it } from "vitest";
import { appendBattleItemUsage } from "@/lib/battle-item-usage";

const baseUse = {
  itemName: "Potion",
  targetInstanceId: "sandshrew-1",
  targetName: "Sandshrew",
  targetSpriteUrl: "/sandshrew.png",
  kind: "heal" as const,
  amount: 20,
  automatic: false,
};

describe("appendBattleItemUsage", () => {
  it("crea el primer uso", () => {
    expect(appendBattleItemUsage([], baseUse)).toEqual([
      expect.objectContaining({ quantity: 1, totalAmount: 20 }),
    ]);
  });

  it("agrupa objeto, objetivo y origen iguales", () => {
    const once = appendBattleItemUsage([], baseUse);
    const twice = appendBattleItemUsage(once, { ...baseUse, amount: 15 });
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ quantity: 2, totalAmount: 35 });
  });

  it("mantiene separados los usos de AUTO y manuales", () => {
    const manual = appendBattleItemUsage([], baseUse);
    const mixed = appendBattleItemUsage(manual, { ...baseUse, automatic: true });
    expect(mixed).toHaveLength(2);
  });
});
