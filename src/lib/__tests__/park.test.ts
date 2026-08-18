import { describe, expect, it } from "vitest";
import {
  DAYCARE_MAX_LEVELS_PER_STAY,
  daycareCollectFee,
  daycareLevelCeiling,
  daycareMsUntilNext,
  pendingDaycareLevels,
  xpForDaycareLevels,
} from "@/lib/park/daycare";
import { FISHING_FREE_CASTS_PER_DAY, fishingCastsUsedToday, fishingEnergyCost, fishingFreeLeft, rollFishingEncounter } from "@/lib/park/fishing";
import { CORNER_FREE_SPINS_PER_DAY, cornerEnergyCost, cornerExpectedPayout, cornerFreeLeft, cornerPayout, cornerSpinsUsedToday, spinCorner } from "@/lib/park/corner";
import { CORNER_SPIN_ENERGY_COST, FISHING_ENERGY_COST, MINE_DIG_ENERGY_COST, WONDER_TRADE_ENERGY_COST } from "@/lib/energy";
import { farmReady, farmYield } from "@/lib/park/farm";
import { FOSSIL_SPECIES, generateMineGrid, MINE_COIN_DROP, MINE_DIGS_PER_DAY, MINE_DROP_SHOW, mineDigsLeft, parseMineBag } from "@/lib/park/mine";
import { palaceWinPayout, FRONTIER_DOME_CUP_COINS } from "@/lib/park/frontier";
import { parseParkTab, parkTabHref } from "@/lib/park/tabs";
import { FRONTIER_ENERGY_COST } from "@/lib/energy";
import { ENERGY_PACK_ENERGY, ENERGY_PACK_PRICE } from "@/lib/shop-energy-pack";
import { isWonderUnlocked, wonderEnergyCost, wonderFreeLeft, wonderNpcAllowed, wonderNpcLevel, wonderNpcSpecies, wonderTiersMatch, wonderTradeTier, wonderTradesUsedToday, WONDER_FREE_TRADES_PER_DAY, WONDER_MIN_BADGES } from "@/lib/park/wonder";
import { addTowardAssemble, assembledPokemonLevel, assembledPokemonLevelForSpecies, FISHING_FRAGMENT_YIELD, FRAGMENTS_TO_ASSEMBLE } from "@/lib/park/fragments";
import { xpForLevel } from "@/lib/stats";

function sequence(...rolls: number[]) {
  let i = 0;
  return () => rolls[Math.min(i++, rolls.length - 1)]!;
}

describe("daycare", () => {
  it("grants one level every four hours, capped per stay", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const fourHours = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const twoDays = new Date(start.getTime() + 48 * 60 * 60 * 1000);
    expect(pendingDaycareLevels(20, start, 8, fourHours)).toBe(1);
    expect(pendingDaycareLevels(20, start, 8, twoDays)).toBe(DAYCARE_MAX_LEVELS_PER_STAY);
    expect(pendingDaycareLevels(46, start, 8, twoDays)).toBe(1);
    expect(pendingDaycareLevels(47, start, 8, twoDays)).toBe(0);
    expect(pendingDaycareLevels(100, start, 8, twoDays)).toBe(0);
  });

  it("respects badge-based level ceiling", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const day = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    expect(daycareLevelCeiling(0)).toBe(15);
    expect(daycareLevelCeiling(8)).toBe(47);
    expect(pendingDaycareLevels(15, start, 0, day)).toBe(0);
    expect(pendingDaycareLevels(14, start, 0, day)).toBe(1);
  });

  it("pays XP as the delta to the target level", () => {
    expect(xpForDaycareLevels(xpForLevel(10), 10, 2)).toBe(xpForLevel(12) - xpForLevel(10));
    expect(daycareCollectFee(3)).toBe(180);
  });

  it("counts time until the next level and stops at the stay cap", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const twoHours = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const twelveHours = new Date(start.getTime() + 12 * 60 * 60 * 1000);
    expect(daycareMsUntilNext(20, start, 8, twoHours)).toBe(2 * 60 * 60 * 1000);
    expect(daycareMsUntilNext(20, start, 8, twelveHours)).toBe(0);
    expect(daycareMsUntilNext(100, start, 8, twoHours)).toBe(0);
  });
});

describe("fishing", () => {
  it("can miss a rare bite", () => {
    const miss = rollFishingEncounter(sequence(0.99, 0.99, 0.5));
    expect(miss.rarity).toBe("rare");
    expect(miss.caught).toBe(false);
  });
});

describe("game corner", () => {
  it("pays jackpot on three sevens and nothing on a mix", () => {
    expect(cornerPayout(["seven", "seven", "seven"])).toBe(90);
    expect(cornerPayout(["ball", "berry", "star"])).toBe(0);
    const forced = spinCorner(sequence(0, 0, 0));
    expect(forced.reels).toEqual(["ball", "ball", "ball"]);
    expect(forced.payout).toBe(24);
  });

  /*
    Las parejas no dependen de la posición. La estrella exigía que fuera en los
    dos primeros rodillos y el siete no, así que `★-x-★` no pagaba y `7-x-7` sí.
  */
  it("pays pairs in any position", () => {
    for (const reels of [
      ["star", "star", "ball"],
      ["star", "ball", "star"],
      ["ball", "star", "star"],
    ] as const) {
      expect(cornerPayout(reels)).toBe(10);
    }
    for (const reels of [
      ["seven", "seven", "ball"],
      ["seven", "ball", "seven"],
      ["ball", "seven", "seven"],
    ] as const) {
      expect(cornerPayout(reels)).toBe(16);
    }
  });

  it("pays a modest expected value in coins; energy and daily frees gate grinding", () => {
    const packGoldPerEnergy = ENERGY_PACK_PRICE / ENERGY_PACK_ENERGY;
    expect(cornerExpectedPayout()).toBeLessThan(packGoldPerEnergy);
    expect(cornerPayout(["seven", "seven", "seven"])).toBeLessThan(ENERGY_PACK_PRICE);
  });

  it("gives three free spins per day, then charges energy", () => {
    expect(cornerSpinsUsedToday(null, "2026-08-17")).toBe(0);
    expect(cornerSpinsUsedToday({ dayKey: "2026-08-16", spins: 9 }, "2026-08-17")).toBe(0);
    expect(cornerSpinsUsedToday({ dayKey: "2026-08-17", spins: 2 }, "2026-08-17")).toBe(2);
    expect(cornerFreeLeft(0)).toBe(CORNER_FREE_SPINS_PER_DAY);
    expect(cornerEnergyCost(0)).toBe(0);
    expect(cornerEnergyCost(2)).toBe(0);
    expect(cornerEnergyCost(3)).toBe(CORNER_SPIN_ENERGY_COST);
    expect(cornerFreeLeft(3)).toBe(0);
  });
});

describe("fishing quota", () => {
  it("gives five free casts then charges energy", () => {
    expect(fishingFreeLeft(0)).toBe(FISHING_FREE_CASTS_PER_DAY);
    expect(fishingEnergyCost(0)).toBe(0);
    expect(fishingEnergyCost(4)).toBe(0);
    expect(fishingEnergyCost(5)).toBe(FISHING_ENERGY_COST);
    expect(fishingFreeLeft(5)).toBe(0);
    expect(fishingCastsUsedToday({ dayKey: "2026-08-17", casts: 3 }, "2026-08-17")).toBe(3);
    expect(fishingCastsUsedToday({ dayKey: "2026-08-16", casts: 5 }, "2026-08-17")).toBe(0);
  });
});

describe("farm", () => {
  it("is ready after two hours and yields 2 or 3 berries", () => {
    const planted = new Date("2026-01-01T00:00:00Z");
    expect(farmReady(planted, new Date("2026-01-01T01:59:00Z"))).toBe(false);
    expect(farmReady(planted, new Date("2026-01-01T02:00:00Z"))).toBe(true);
    expect(farmYield(0.1)).toBe(2);
    expect(farmYield(0.9)).toBe(3);
  });
});

describe("mine", () => {
  it("is deterministic per player-day and caps digs", () => {
    const a = generateMineGrid("u1", "2026-08-17");
    const b = generateMineGrid("u1", "2026-08-17");
    expect(a).toEqual(b);
    expect(a).toHaveLength(25);
    expect(mineDigsLeft(a)).toBe(8);
    a[0]!.dug = true;
    expect(mineDigsLeft(a)).toBe(7);
    expect(FOSSIL_SPECIES.helix).toBe(138);
    expect(parseMineBag({ helix: 2 }).helix).toBe(2);
  });

  it("lists the real prizes, not only coins, and does not charge energy", () => {
    expect(MINE_DROP_SHOW).toEqual(["coins", "potion", "stone", "helix", "dome", "amber"]);
    expect(MINE_DIG_ENERGY_COST).toBe(0);
    expect(MINE_COIN_DROP * MINE_DIGS_PER_DAY).toBeLessThan(ENERGY_PACK_PRICE);
  });
});

describe("park fragments", () => {
  it("assembles a Pokémon every ten fragments and yields more on rare bites", () => {
    expect(addTowardAssemble(9, 1)).toEqual({ quantity: 0, assembled: 1 });
    expect(addTowardAssemble(8, 5)).toEqual({ quantity: 3, assembled: 1 });
    expect(addTowardAssemble(2, 1, FRAGMENTS_TO_ASSEMBLE, false)).toEqual({ quantity: 3, assembled: 0 });
    expect(FISHING_FRAGMENT_YIELD.common).toBe(1);
    expect(FISHING_FRAGMENT_YIELD.uncommon).toBe(2);
    expect(FISHING_FRAGMENT_YIELD.rare).toBe(5);
  });

  it("assembles park Pokémon at a low fixed level, not the lead's", () => {
    expect(assembledPokemonLevel("common")).toBe(5);
    expect(assembledPokemonLevel("uncommon")).toBe(8);
    expect(assembledPokemonLevel("rare")).toBe(12);
    expect(assembledPokemonLevel("fossil")).toBe(10);
    expect(assembledPokemonLevelForSpecies(130)).toBe(12);
    expect(assembledPokemonLevelForSpecies(129)).toBe(5);
    expect(assembledPokemonLevelForSpecies(138)).toBe(10);
  });
});

describe("frontier / wonder", () => {
  it("scales palace payout with streak and caps it", () => {
    expect(palaceWinPayout(1)).toBe(22);
    expect(palaceWinPayout(3)).toBe(32);
    expect(palaceWinPayout(20)).toBe(42);
  });

  it("never pays more gold per energy than the shop pack", () => {
    const packGoldPerEnergy = ENERGY_PACK_PRICE / ENERGY_PACK_ENERGY;
    expect(palaceWinPayout(99) / FRONTIER_ENERGY_COST).toBeLessThan(packGoldPerEnergy);
    expect(FRONTIER_DOME_CUP_COINS / FRONTIER_ENERGY_COST).toBeLessThan(packGoldPerEnergy);
  });

  it("picks an NPC species in the same tier and never raises the level", () => {
    expect(wonderNpcSpecies(0, 0)).toBeGreaterThan(0);
    expect(wonderNpcSpecies(0, 0)).toBe(wonderNpcSpecies(0, 0.01));
    expect(wonderNpcLevel(20, 0.5)).toBeLessThanOrEqual(20);
    expect(wonderNpcLevel(20, 0.99)).toBe(20);
    expect(wonderNpcLevel(20, 0)).toBe(18);
  });

  it("gives three free trades then charges energy", () => {
    expect(wonderFreeLeft(0)).toBe(WONDER_FREE_TRADES_PER_DAY);
    expect(wonderEnergyCost(0)).toBe(0);
    expect(wonderEnergyCost(2)).toBe(0);
    expect(wonderEnergyCost(3)).toBe(WONDER_TRADE_ENERGY_COST);
    expect(wonderFreeLeft(3)).toBe(0);
    expect(wonderTradesUsedToday({ dayKey: "2026-08-17", trades: 2 }, "2026-08-17")).toBe(2);
    expect(wonderTradesUsedToday({ dayKey: "2026-08-16", trades: 3 }, "2026-08-17")).toBe(0);
  });

  it("unlocks after the first gym badge", () => {
    expect(isWonderUnlocked(0)).toBe(false);
    expect(isWonderUnlocked(WONDER_MIN_BADGES)).toBe(true);
  });

  it("keeps junk from matching a strong offer", () => {
    const magikarp = wonderTradeTier({ speciesId: 129, evolvesFromId: null, evolvesToCount: 1 });
    const charizard = wonderTradeTier({ speciesId: 6, evolvesFromId: 5, evolvesToCount: 0 });
    const dragonite = wonderTradeTier({ speciesId: 149, evolvesFromId: 148, evolvesToCount: 0 });
    const shinyRat = wonderTradeTier({
      speciesId: 19,
      evolvesFromId: null,
      evolvesToCount: 1,
      isShiny: true,
    });
    expect(magikarp).toBe(0);
    expect(charizard).toBe(3);
    expect(dragonite).toBe(3);
    expect(wonderTiersMatch(magikarp, charizard)).toBe(false);
    expect(wonderNpcAllowed(shinyRat)).toBe(false);
    expect(wonderNpcAllowed(magikarp)).toBe(true);
  });
});

describe("park tabs", () => {
  it("defaults to mine and keeps a known tab in the URL", () => {
    expect(parseParkTab(undefined)).toBe("mine");
    expect(parseParkTab("fishing")).toBe("fishing");
    expect(parseParkTab("nope")).toBe("mine");
    expect(parkTabHref("mine")).toBe("/park");
    expect(parkTabHref("fishing")).toBe("/park?tab=fishing");
  });
});
