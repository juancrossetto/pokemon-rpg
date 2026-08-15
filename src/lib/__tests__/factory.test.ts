import { describe, expect, it } from "vitest";
import {
  FACTORY_EXCHANGE,
  canAffordAnyExchange,
  deterministicShuffle,
  factoryExchangeEntry,
  factoryPointsForWins,
  opponentDifficulty,
} from "@/lib/factory";

describe("battle factory", () => {
  it("gives every player the same daily order", () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(deterministicShuffle(pool, "2026-08-14")).toEqual(
      deterministicShuffle(pool, "2026-08-14"),
    );
    expect(deterministicShuffle(pool, "2026-08-15")).not.toEqual(
      deterministicShuffle(pool, "2026-08-14"),
    );
  });

  it("adds the completion bonus only at seven wins", () => {
    expect(factoryPointsForWins(0)).toBe(0);
    expect(factoryPointsForWins(6)).toBe(72);
    expect(factoryPointsForWins(7)).toBe(120);
    expect(factoryPointsForWins(99)).toBe(120);
  });

  it("ramps opponents without a difficulty cliff", () => {
    expect(opponentDifficulty(1)).toBeLessThan(1);
    expect(opponentDifficulty(7)).toBeGreaterThan(1);
    expect(opponentDifficulty(7) - opponentDifficulty(6)).toBeLessThan(0.05);
  });
});

describe("canje de puntos", () => {
  it("sólo acepta nombres del catálogo", () => {
    // El nombre llega del cliente: si no matchea una entrada, no se busca en
    // `Item` ni se descuenta nada.
    expect(factoryExchangeEntry("Rare Candy")).not.toBeNull();
    expect(factoryExchangeEntry("Master Ball")).toBeNull();
    expect(factoryExchangeEntry("")).toBeNull();
  });

  it("el catálogo tiene costos y cantidades sanos", () => {
    for (const entry of FACTORY_EXCHANGE) {
      expect(entry.cost, entry.itemName).toBeGreaterThan(0);
      expect(entry.quantity, entry.itemName).toBeGreaterThan(0);
      expect(Number.isInteger(entry.cost), entry.itemName).toBe(true);
    }
  });

  it("una corrida perfecta alcanza para al menos un canje", () => {
    // Si el canje más barato costara más que la corrida máxima, el panel
    // nacería inalcanzable y la moneda seguiría sin salida.
    const best = factoryPointsForWins(99);
    expect(canAffordAnyExchange(best)).toBe(true);
    expect(canAffordAnyExchange(0)).toBe(false);
  });

  it("los nombres no se repiten", () => {
    const names = FACTORY_EXCHANGE.map((entry) => entry.itemName);
    expect(new Set(names).size).toBe(names.length);
  });
});
