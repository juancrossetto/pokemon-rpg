import { describe, expect, it } from "vitest";
import { shinySpriteUrl, spriteFor } from "@/lib/shiny";

describe("shinySpriteUrl", () => {
  it("rewrites official-artwork paths", () => {
    expect(
      shinySpriteUrl(
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/25.png",
    );
  });

  it("rewrites home paths", () => {
    expect(
      shinySpriteUrl(
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/25.png",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/25.png",
    );
  });

  it("rewrites classic pixel paths", () => {
    expect(
      shinySpriteUrl(
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/25.png",
    );
  });

  it("does not double-apply /shiny/", () => {
    const already =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/25.png";
    expect(shinySpriteUrl(already)).toBe(already);
  });

  it("returns empty input unchanged", () => {
    expect(shinySpriteUrl("")).toBe("");
  });
});

describe("spriteFor", () => {
  const normal =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png";

  it("returns normal URL when not shiny", () => {
    expect(spriteFor(normal, false)).toBe(normal);
  });

  it("returns shiny URL when shiny", () => {
    expect(spriteFor(normal, true)).toContain("/official-artwork/shiny/6.png");
  });
});
