import { describe, expect, it } from "vitest";
import { worldBgmKindForPath, worldBgmUrl } from "@/lib/world-bgm";

describe("world BGM routing", () => {
  it("uses the Safari track only on Safari routes", () => {
    expect(worldBgmKindForPath("/safari")).toBe("safari");
    expect(worldBgmKindForPath("/safari/")).toBe("safari");
    expect(worldBgmKindForPath("/safari/results")).toBe("safari");
    expect(worldBgmUrl("safari")).toBe("/audio/safari-music.mp3");
  });

  it("keeps the existing tracks on other routes", () => {
    expect(worldBgmKindForPath("/campaign")).toBe("home");
    expect(worldBgmKindForPath("/shop")).toBe("store");
    expect(worldBgmKindForPath("/battle")).toBeNull();
  });
});
