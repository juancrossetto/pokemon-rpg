import { describe, expect, it } from "vitest";
import {
  divisionForRating,
  divisionRoman,
  nextRank,
  nextRankProgress,
  rankFloor,
  rankForRating,
  tierForRating,
} from "@/lib/pvp/tiers";

describe("pvp rank divisions", () => {
  it("maps rating to tier thresholds", () => {
    expect(tierForRating(0)).toBe("beginner");
    expect(tierForRating(999)).toBe("beginner");
    expect(tierForRating(1000)).toBe("beginner");
    expect(tierForRating(1099)).toBe("beginner");
    expect(tierForRating(1100)).toBe("rising");
    expect(tierForRating(2000)).toBe("legendary");
  });

  it("splits each league into III → II → I", () => {
    // beginner: 0–1100 → thirds of ~366.7; starter Elo 1000 → Beginner I
    expect(divisionForRating(0)).toBe(3);
    expect(divisionForRating(400)).toBe(2);
    expect(divisionForRating(800)).toBe(1);
    expect(rankForRating(1000)).toEqual({ tier: "beginner", division: 1 });
    expect(rankForRating(1092)).toEqual({ tier: "beginner", division: 1 });

    // rising: 1100–1200
    expect(divisionForRating(1100)).toBe(3);
    expect(divisionForRating(1135)).toBe(2);
    expect(divisionForRating(1170)).toBe(1);
    expect(rankForRating(1170)).toEqual({ tier: "rising", division: 1 });
  });

  it("uses 100-pt legendary bands", () => {
    expect(divisionForRating(2000)).toBe(3);
    expect(divisionForRating(2099)).toBe(3);
    expect(divisionForRating(2100)).toBe(2);
    expect(divisionForRating(2200)).toBe(1);
    expect(divisionForRating(2500)).toBe(1);
  });

  it("advances division then league", () => {
    expect(nextRank({ tier: "rising", division: 3 })).toEqual({
      tier: "rising",
      division: 2,
    });
    expect(nextRank({ tier: "rising", division: 1 })).toEqual({
      tier: "advanced",
      division: 3,
    });
    expect(nextRank({ tier: "legendary", division: 1 })).toBeNull();
  });

  it("computes progress toward next division floor", () => {
    const floorIii = rankFloor({ tier: "rising", division: 3 });
    const floorIi = rankFloor({ tier: "rising", division: 2 });
    expect(floorIii).toBe(1100);
    expect(floorIi).toBeCloseTo(1100 + 100 / 3, 5);

    const mid = nextRankProgress(1100);
    expect(mid.current.division).toBe(3);
    expect(mid.next?.division).toBe(2);
    expect(mid.pct).toBe(0);

    const almost = nextRankProgress(floorIi - 0.01);
    expect(almost.current.division).toBe(3);
    expect(almost.pct).toBeGreaterThan(90);
  });

  it("formats roman numerals", () => {
    expect(divisionRoman(1)).toBe("I");
    expect(divisionRoman(2)).toBe("II");
    expect(divisionRoman(3)).toBe("III");
  });
});
