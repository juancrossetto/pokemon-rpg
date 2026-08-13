import { describe, expect, it } from "vitest";
import { pickWeightedSpecies } from "@/lib/campaign/rarity";
import { SHINY_ODDS } from "@/lib/shiny";

describe("variedad de encuentros salvajes", () => {
  it("penaliza repetir inmediatamente una especie cuando hay alternativas", () => {
    const picked = pickWeightedSpecies([16, 19], {
      recentSpeciesIds: [16],
      random: () => 0.2,
    });

    expect(picked).toBe(19);
  });

  it("favorece moderadamente especies aún no vistas sin ignorar su rareza", () => {
    const picked = pickWeightedSpecies([16, 25], {
      seenSpeciesIds: new Set([16]),
      random: () => 0.8,
    });

    expect(picked).toBe(25);
  });

  it("mantiene una especie única como resultado válido", () => {
    expect(
      pickWeightedSpecies([19], {
        recentSpeciesIds: [19, 19, 19],
        random: () => 0.99,
      }),
    ).toBe(19);
  });

  it("usa una probabilidad shiny de uno cada cincuenta encuentros", () => {
    expect(SHINY_ODDS).toBe(50);
  });
});
