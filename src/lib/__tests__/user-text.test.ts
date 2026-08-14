import { describe, expect, it } from "vitest";
import {
  hasVisibleText,
  sanitizeUserText,
  sanitizeUserTextOrNull,
} from "@/lib/user-text";

const ZWSP = "\u200B";
const RLO = "\u202E";
const SOFT_HYPHEN = "\u00AD";
const BOM = "\uFEFF";
const COMBINING_ACUTE = "\u0301";

describe("sanitizeUserText", () => {
  it("conserva texto normal, acentos y emoji", () => {
    expect(sanitizeUserText("Pikachú ⚡", { max: 20 })).toBe("Pikachú ⚡");
  });

  it("borra los invisibles que el trim() no ve", () => {
    // Un nombre de puros anchos cero pasaba `trim()` y se guardaba en blanco.
    expect(sanitizeUserText(ZWSP + ZWSP + ZWSP, { max: 20 })).toBe("");
    expect(sanitizeUserText("a" + ZWSP + "b", { max: 20 })).toBe("ab");
    expect(sanitizeUserText(SOFT_HYPHEN + "Rex" + BOM, { max: 20 })).toBe("Rex");
  });

  it("borra los controles bidi que permiten suplantar un nombre", () => {
    expect(sanitizeUserText(RLO + "admin", { max: 20 })).toBe("admin");
  });

  it("borra los controles C0", () => {
    expect(sanitizeUserText("a\nb\tc", { max: 20 })).toBe("a b c");
  });

  it("colapsa corridas de espacios en vez de dejarlas estirar el layout", () => {
    expect(sanitizeUserText("Team          Rocket", { max: 40 })).toBe("Team Rocket");
    expect(sanitizeUserText("  hola  ", { max: 40 })).toBe("hola");
  });

  it("corta el apilado de combinantes pero deja una sola", () => {
    const zalgo = "a" + COMBINING_ACUTE.repeat(30);
    // Sobrevive una sola marca, y el NFC posterior la compone: "á" de una pieza.
    expect(sanitizeUserText(zalgo, { max: 40 })).toBe(
      ("a" + COMBINING_ACUTE).normalize("NFC"),
    );
    expect([...sanitizeUserText(zalgo, { max: 40 })]).toHaveLength(1);
  });

  it("normaliza a NFC para que compuesto y descompuesto sean lo mismo", () => {
    const decomposed = "e" + COMBINING_ACUTE;
    expect(sanitizeUserText(decomposed, { max: 10 })).toBe("é");
  });

  it("recorta por puntos de código, sin partir un emoji al medio", () => {
    // Con `slice` sobre UTF-16 esto devolvía media pareja sustituta.
    expect(sanitizeUserText("🔥🔥🔥", { max: 2 })).toBe("🔥🔥");
    expect([...sanitizeUserText("🔥🔥🔥", { max: 1 })]).toHaveLength(1);
  });

  it("recorta después de limpiar, no antes", () => {
    // Si el recorte fuera primero, los invisibles gastarían el presupuesto.
    expect(sanitizeUserText(ZWSP.repeat(10) + "Rex", { max: 3 })).toBe("Rex");
  });

  it("no deja espacio colgando tras el recorte", () => {
    expect(sanitizeUserText("ab cd", { max: 3 })).toBe("ab");
  });

  it("tolera max raro sin romper", () => {
    expect(sanitizeUserText("hola", { max: 0 })).toBe("");
    expect(sanitizeUserText("hola", { max: -5 })).toBe("");
    expect(sanitizeUserText("hola", { max: 2.9 })).toBe("ho");
  });
});

describe("sanitizeUserTextOrNull", () => {
  it("null cuando no queda nada visible", () => {
    expect(sanitizeUserTextOrNull(ZWSP + "  ", { max: 20 })).toBeNull();
    expect(sanitizeUserTextOrNull("Rex", { max: 20 })).toBe("Rex");
  });
});

describe("hasVisibleText", () => {
  it("distingue vacío real de vacío disfrazado", () => {
    expect(hasVisibleText("Rex")).toBe(true);
    expect(hasVisibleText("   ")).toBe(false);
    expect(hasVisibleText(ZWSP + BOM)).toBe(false);
  });
});
