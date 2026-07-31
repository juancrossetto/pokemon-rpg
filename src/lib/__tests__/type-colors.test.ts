import { describe, expect, it } from "vitest";
import { TYPE_COLORS, neonTypeColor, typeColor } from "@/lib/type-colors";

const HEX = /^#[0-9a-f]{6}$/;

describe("neonTypeColor", () => {
  it("devuelve un hex válido para todos los tipos", () => {
    for (const type of Object.keys(TYPE_COLORS)) {
      expect(neonTypeColor(type)).toMatch(HEX);
    }
  });

  it("cae al color por defecto con un tipo desconocido, sin romper", () => {
    expect(neonTypeColor("no-existe")).toMatch(HEX);
    expect(typeColor("no-existe")).toBe("#68A090");
  });

  it("aclara los tipos oscuros — `dark` es un marrón que no lee como neón", () => {
    // #705848 tiene una luz de ~0.36; el piso flúor la sube a 0.58.
    const before = luminanceOf(typeColor("dark"));
    const after = luminanceOf(neonTypeColor("dark"));
    expect(after).toBeGreaterThan(before);
  });

  it("no oscurece ni desatura los tipos que ya son vivos", () => {
    const after = luminanceOf(neonTypeColor("electric"));
    // El techo de luz es 0.68: `electric` (#F8D030) baja apenas, no se apaga.
    expect(after).toBeGreaterThan(0.55);
  });

  it("hueShift cambia el matiz, que es lo que arma el degradé mono-tipo", () => {
    expect(neonTypeColor("water", 35)).not.toBe(neonTypeColor("water"));
  });

  it("es determinístico: el mismo tipo da siempre el mismo color", () => {
    expect(neonTypeColor("fire")).toBe(neonTypeColor("fire"));
  });
});

function luminanceOf(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
