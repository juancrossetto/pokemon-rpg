import { describe, expect, it } from "vitest";
import {
  BATTLE_BACK_SPRITE_SCALE,
  BATTLE_FRONT_SPRITE_SCALE,
  spriteBoxFromNatural,
} from "@/lib/battle-sprite-scale";
import { spriteNaturalPx } from "@/lib/battle-sprite-natural";

/** Sin tope: aísla el factor del recorte por tamaño de pantalla. */
const SIN_TOPE = 10_000;

describe("spriteBoxFromNatural", () => {
  it("dibuja el sprite de frente 1:1, como Showdown", () => {
    expect(BATTLE_FRONT_SPRITE_SCALE).toBe(1);
    // Totodile: 58px nativo → Showdown lo renderiza a 58px.
    expect(spriteBoxFromNatural(58, "front", SIN_TOPE)).toBe(58);
  });

  it("agranda el de espalda 1.5×, como Showdown", () => {
    expect(BATTLE_BACK_SPRITE_SCALE).toBe(1.5);
    // Cyndaquil: 45px nativo → Showdown mide 67px (1.49×).
    expect(spriteBoxFromNatural(45, "back", SIN_TOPE)).toBe(68);
  });

  it("conserva la proporción entre especies que trae el arte", () => {
    // El arte ya codifica el tamaño: no hace falta escalar por altura.
    const charizard = spriteBoxFromNatural(172, "back", SIN_TOPE);
    const cyndaquil = spriteBoxFromNatural(45, "back", SIN_TOPE);
    expect(charizard).toBeGreaterThan(cyndaquil * 3);
  });

  it("respeta el tope en pantallas chicas", () => {
    expect(spriteBoxFromNatural(172, "back", 120)).toBe(120);
    expect(spriteBoxFromNatural(45, "back", 120)).toBe(68); // no llega al tope
  });

  it("nunca devuelve menos de 1px", () => {
    expect(spriteBoxFromNatural(45, "back", 0)).toBe(1);
  });
});

describe("spriteNaturalPx", () => {
  it("distingue frente y espalda", () => {
    expect(spriteNaturalPx("cyndaquil", "back")).toBe(45);
    expect(spriteNaturalPx("charizard", "back")).toBe(172);
  });

  it("es case-insensitive y tolera espacios", () => {
    expect(spriteNaturalPx("  Pikachu ", "back")).toBe(spriteNaturalPx("pikachu", "back"));
  });

  it("devuelve null para una especie que no está en la tabla", () => {
    expect(spriteNaturalPx("no-existe-tal-pokemon", "front")).toBeNull();
  });

  it("cubre las 251 especies seedeadas, frente y espalda", () => {
    for (const name of ["bulbasaur", "mew", "chikorita", "celebi", "ho-oh"]) {
      expect(spriteNaturalPx(name, "front")).toBeGreaterThan(0);
      expect(spriteNaturalPx(name, "back")).toBeGreaterThan(0);
    }
  });
});
