import { describe, expect, it } from "vitest";
import { daycareCollectFee, pendingDaycareLevels, xpForDaycareLevels } from "@/lib/park/daycare";
import { rollFishingEncounter } from "@/lib/park/fishing";
import { cornerPayout, spinCorner } from "@/lib/park/corner";
import { farmReady, farmYield } from "@/lib/park/farm";
import { FOSSIL_SPECIES, generateMineGrid, mineDigsLeft, parseMineBag } from "@/lib/park/mine";
import { palaceWinPayout } from "@/lib/park/frontier";
import { wonderNpcLevel, wonderNpcSpecies } from "@/lib/park/wonder";
import { xpForLevel } from "@/lib/stats";

function sequence(...rolls: number[]) {
  let i = 0;
  return () => rolls[Math.min(i++, rolls.length - 1)]!;
}

describe("daycare", () => {
  it("grants one level every two hours, capped per stay", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const twoHours = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const twoDays = new Date(start.getTime() + 48 * 60 * 60 * 1000);
    expect(pendingDaycareLevels(20, start, twoHours)).toBe(1);
    expect(pendingDaycareLevels(20, start, twoDays)).toBe(8);
    expect(pendingDaycareLevels(99, start, twoDays)).toBe(1);
    expect(pendingDaycareLevels(100, start, twoDays)).toBe(0);
  });

  it("pays XP as the delta to the target level", () => {
    expect(xpForDaycareLevels(xpForLevel(10), 10, 2)).toBe(xpForLevel(12) - xpForLevel(10));
    expect(daycareCollectFee(3)).toBe(120);
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
    expect(cornerPayout(["seven", "seven", "seven"])).toBe(2500);
    expect(cornerPayout(["ball", "berry", "star"])).toBe(0);
    const forced = spinCorner(sequence(0, 0, 0));
    expect(forced.reels).toEqual(["ball", "ball", "ball"]);
    expect(forced.payout).toBe(80);
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
});

describe("frontier / wonder", () => {
  it("scales palace payout with streak", () => {
    expect(palaceWinPayout(1)).toBe(80);
    expect(palaceWinPayout(3)).toBe(110);
  });

  it("picks an NPC species and nearby level", () => {
    expect(wonderNpcSpecies(0)).toBeGreaterThan(0);
    expect(wonderNpcLevel(20, 0.5)).toBeGreaterThanOrEqual(18);
  });
});
