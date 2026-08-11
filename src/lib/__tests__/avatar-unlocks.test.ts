import { describe, expect, it } from "vitest";
import {
  assertAvatarUnlockCoverage,
  avatarRewardsForGymOrder,
  avatarSlugsInStoryOrder,
  isAvatarUnlocked,
  unlockedAvatarIds,
  AVATAR_STARTER_SLUGS,
} from "@/lib/avatar-unlocks";

describe("avatar-unlocks", () => {
  it("cubre todo el catálogo sin extras", () => {
    expect(assertAvatarUnlockCoverage()).toEqual({
      ok: true,
      missing: [],
      extra: [],
    });
  });

  it("sin medallas libera starters (incluye Oak y Ash)", () => {
    const set = unlockedAvatarIds([]);
    expect(set.size).toBe(AVATAR_STARTER_SLUGS.length);
    expect(isAvatarUnlocked("joven", [])).toBe(true);
    expect(isAvatarUnlocked("oak", [])).toBe(true);
    expect(isAvatarUnlocked("ash", [])).toBe(true);
    expect(isAvatarUnlocked("brock", [])).toBe(false);
    expect(isAvatarUnlocked("rojo", [])).toBe(false);
  });

  it("agrupa variantes del líder con su medalla", () => {
    expect(avatarRewardsForGymOrder(1)).toContain("brock");
    expect(avatarRewardsForGymOrder(1)).toContain("brockk");
    expect(avatarRewardsForGymOrder(1)).not.toContain("oak");
    expect(avatarRewardsForGymOrder(1)).not.toContain("ash");
    expect(isAvatarUnlocked("brock", [1])).toBe(true);
    expect(isAvatarUnlocked("misty", [1])).toBe(false);
    expect(isAvatarUnlocked("misty", [1, 2])).toBe(true);
  });

  it("el campeón libera rojo/azul/n juntos", () => {
    const set = unlockedAvatarIds([13]);
    for (const slug of ["rojo", "rojoa", "azul", "azulc", "n", "nb"]) {
      expect(set.has(slug)).toBe(true);
    }
    expect(set.has("joven")).toBe(true);
    expect(set.has("brock")).toBe(false);
  });

  it("el orden de historia: Oak/Ash → novatos → Brock", () => {
    const ordered = avatarSlugsInStoryOrder();
    expect(ordered.slice(0, AVATAR_STARTER_SLUGS.length)).toEqual([
      ...AVATAR_STARTER_SLUGS,
    ]);
    expect(ordered[0]).toBe("oak");
    expect(ordered[1]).toBe("ash");
    const afterStarters = ordered.slice(AVATAR_STARTER_SLUGS.length);
    expect(afterStarters.slice(0, 3)).toEqual(["chase", "brock", "brockk"]);
  });

  it("no ofrece clases de ruta (arte sólo-aventura) en el picker", () => {
    const ordered = avatarSlugsInStoryOrder();
    for (const slug of [
      "cazabichos",
      "chicaa",
      "criadora",
      "damisela",
      "hugo",
      "motorista",
      "pokemaniaco",
      "supernerd",
    ]) {
      expect(ordered).not.toContain(slug);
      expect(isAvatarUnlocked(slug, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])).toBe(
        false,
      );
    }
  });
});
