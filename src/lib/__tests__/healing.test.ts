import { describe, expect, it } from "vitest";
import { HEAL_FREE_UNTIL_LEVEL, isPokemonCenterFree } from "@/lib/healing";

describe("isPokemonCenterFree", () => {
  it("mantiene el centro gratis durante todo el onboarding", () => {
    expect(HEAL_FREE_UNTIL_LEVEL).toBe(20);
    expect(isPokemonCenterFree(16)).toBe(true);
    expect(isPokemonCenterFree(20)).toBe(true);
  });

  it("activa el cooldown después del onboarding", () => {
    expect(isPokemonCenterFree(21)).toBe(false);
  });
});
