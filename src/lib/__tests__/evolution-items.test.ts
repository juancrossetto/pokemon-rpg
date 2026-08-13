import { describe, expect, it } from "vitest";
import {
  evolutionRecipesForItem,
  isTradeSubstituteEvolution,
  LINKING_CORD,
  SPECIES_EVOLUTION_ITEM,
} from "@/lib/evolution-items";

describe("evolution items", () => {
  it("adapts Golbat's friendship evolution to the Linking Cord", () => {
    expect(SPECIES_EVOLUTION_ITEM[169]).toBe(LINKING_CORD);
    expect(evolutionRecipesForItem(LINKING_CORD)).toContainEqual({
      itemName: LINKING_CORD,
      fromId: 42,
      fromName: "Golbat",
      toId: 169,
      toName: "Crobat",
    });
    expect(isTradeSubstituteEvolution(LINKING_CORD, 169)).toBe(false);
    expect(isTradeSubstituteEvolution(LINKING_CORD, 65)).toBe(true);
  });
});
