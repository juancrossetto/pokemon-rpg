import { describe, expect, it } from "vitest";
import {
  pokemonSpriteCandidates,
  speciesIdFromSpriteUrl,
  uiSpriteUrl,
} from "@/lib/sprites";

describe("pokemon sprite fallbacks", () => {
  it("infers a species id from known PokeAPI URLs", () => {
    expect(speciesIdFromSpriteUrl(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
    )).toBe(94);
  });

  it("uses the same-origin artwork cache for common and shiny", () => {
    const fromDb =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/27.png";
    expect(uiSpriteUrl(fromDb, false)).toBe(
      "/api/pokemon-art/normal/27.png",
    );
    expect(uiSpriteUrl(fromDb, true)).toBe(
      "/api/pokemon-art/shiny/27.png",
    );
  });

  it("prefers same-origin art and keeps the DB URL as a remote fallback", () => {
    const original =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png";
    const sources = pokemonSpriteCandidates({
      src: original,
      speciesName: "gengar",
    });

    expect(sources[0]).toBe("/api/pokemon-art/normal/94.png");
    expect(sources).toContain(original);
    expect(sources).not.toContain(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png",
    );
    expect(sources.some((url) => url.includes("/other/home/"))).toBe(false);
    expect(sources.some((url) => url.includes("assets.pokemon.com"))).toBe(false);
    expect(sources.some((url) => url.includes("play.pokemonshowdown.com"))).toBe(false);
  });

  it("keeps shiny on official-artwork/shiny", () => {
    const sources = pokemonSpriteCandidates({
      src: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/27.png",
      speciesId: 27,
      isShiny: true,
    });

    expect(sources[0]).toBe("/api/pokemon-art/shiny/27.png");
    expect(sources).toContain(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/27.png",
    );
  });

  it("keeps local safari sprites ahead of remote art", () => {
    const sources = pokemonSpriteCandidates({
      src: "/safari/species/123.png",
      speciesId: 123,
    });
    expect(sources[0]).toBe("/safari/species/123.png");
  });
});
