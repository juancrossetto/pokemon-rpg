import { describe, expect, it } from "vitest";
import { diffNewlyCaught } from "@/lib/dex-new-entries";

describe("diffNewlyCaught", () => {
  it("no marca nada en la primera visita", () => {
    // Sin foto anterior toda la colección sería 'nueva': ese era justo el
    // defecto del pulso original, que salía en cada capturada en cada carga.
    expect(diffNewlyCaught(null, [1, 4, 7])).toEqual([]);
    expect(diffNewlyCaught(undefined, [1, 4, 7])).toEqual([]);
  });

  it("devuelve sólo lo capturado desde la visita anterior", () => {
    expect(diffNewlyCaught([1, 4], [1, 4, 7])).toEqual([7]);
  });

  it("trata el set vacío como visita válida, no como primera vez", () => {
    // Un jugador que abrió la Pokédex sin nada capturado y después atrapó su
    // primer Pokémon tiene que ver el sello.
    expect(diffNewlyCaught([], [1])).toEqual([1]);
  });

  it("no devuelve nada si no cambió", () => {
    expect(diffNewlyCaught([1, 4, 7], [1, 4, 7])).toEqual([]);
  });

  it("ignora especies que ya no están en la lista actual", () => {
    expect(diffNewlyCaught([1, 4, 7], [1, 4])).toEqual([]);
  });

  it("no depende del orden de la foto anterior", () => {
    expect(diffNewlyCaught([7, 1, 4], [1, 4, 7, 25])).toEqual([25]);
  });

  it("descarta un storage corrupto sin marcar todo como nuevo", () => {
    // `readDexSeenCaught` devuelve null ante JSON inválido; acá se verifica
    // que ese null no derive en marcar la colección entera.
    expect(diffNewlyCaught(null, [1, 2, 3])).toEqual([]);
  });
});
