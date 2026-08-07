import { describe, expect, it } from "vitest";
import { isTutorialBattle, TUTORIAL_BATTLE_ID } from "@/lib/battle-tutorial";

describe("isTutorialBattle", () => {
  it("detecta el marcador durable en routeTrainerId", () => {
    expect(isTutorialBattle({ routeTrainerId: TUTORIAL_BATTLE_ID, log: [] })).toBe(true);
  });

  it("detecta batallas viejas solo con el log", () => {
    expect(
      isTutorialBattle({
        routeTrainerId: null,
        log: ["appear:Bulbasaur", "tutorial"],
      }),
    ).toBe(true);
  });

  it("no marca encuentros salvajes normales", () => {
    expect(
      isTutorialBattle({
        routeTrainerId: null,
        log: ["appear:Pidgey"],
      }),
    ).toBe(false);
  });
});
