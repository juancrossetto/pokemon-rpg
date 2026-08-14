import { describe, expect, it } from "vitest";
import {
  pokemonSpriteCandidates,
  speciesIdFromSpriteUrl,
} from "@/lib/sprites";

describe("pokemon sprite fallbacks", () => {
  it("infers a species id from known PokeAPI URLs", () => {
    expect(speciesIdFromSpriteUrl(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
    )).toBe(94);
  });

  it("preserves the original sprite family before trying fallbacks", () => {
    const original =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png";
    const sources = pokemonSpriteCandidates({
      src: original,
      speciesName: "gengar",
    });

    expect(sources[0]).toBe(original);
    expect(sources[1]).toContain("retry=1");
    expect(sources).toContain(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png",
    );
    expect(sources.at(-1)).toBe(
      "https://play.pokemonshowdown.com/sprites/gen5/gengar.png",
    );
  });

  it("keeps shiny variants throughout the fallback chain", () => {
    const sources = pokemonSpriteCandidates({
      speciesId: 25,
      speciesName: "pikachu",
      isShiny: true,
    });

    expect(sources.every((source) => source.includes("shiny"))).toBe(true);
  });
});
