import { describe, expect, it } from "vitest";
import { resolveMoveFx } from "@/lib/showdown-fx";

describe("resolveMoveFx", () => {
  it("families SPECIAL tipadas sólidas", () => {
    expect(resolveMoveFx("fire", "SPECIAL", "unknown-blaze")).toMatchObject({
      style: "stream",
      file: "fireball.png",
      glow: "fire",
    });
    expect(resolveMoveFx("water", "SPECIAL")).toMatchObject({
      style: "stream",
      glow: "water",
    });
    expect(resolveMoveFx("electric", "SPECIAL")).toMatchObject({ style: "bolt" });
    expect(resolveMoveFx("grass", "SPECIAL")).toMatchObject({ style: "scatter" });
    expect(resolveMoveFx("poison", "SPECIAL")).toMatchObject({
      style: "stream",
      glow: "poison",
    });
    expect(resolveMoveFx("psychic", "SPECIAL")).toMatchObject({ style: "stream" });
  });

  it("overrides de moves frecuentes", () => {
    expect(resolveMoveFx("normal", "PHYSICAL", "tackle")).toMatchObject({
      style: "contact",
    });
    expect(resolveMoveFx("poison", "SPECIAL", "acid")).toMatchObject({
      style: "stream",
      count: 4,
    });
    expect(resolveMoveFx("flying", "SPECIAL", "gust")).toMatchObject({
      style: "scatter",
    });
    expect(resolveMoveFx("fire", "SPECIAL", "flamethrower")).toMatchObject({
      style: "stream",
      count: 6,
      glow: "fire",
    });
    expect(resolveMoveFx("grass", "PHYSICAL", "razor-leaf")).toMatchObject({
      style: "scatter",
    });
    expect(resolveMoveFx("dark", "PHYSICAL", "bite")).toMatchObject({
      style: "slash",
      file: "topbite.png",
    });
  });

  it("drenaje automático por nombre", () => {
    expect(resolveMoveFx("grass", "SPECIAL", "mega-drain")).toMatchObject({
      style: "drain",
    });
    expect(resolveMoveFx("bug", "PHYSICAL", "leech-life")).toMatchObject({
      style: "drain",
    });
  });
});
