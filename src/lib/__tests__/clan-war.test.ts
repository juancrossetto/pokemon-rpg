import { describe, expect, it } from "vitest";
import {
  canRegisterForWar,
  clanLevelFromBadges,
  pickWarOpponent,
  settleClanWarRatings,
  warIsComplete,
  warScoreAfterBattle,
  warWinnerSide,
} from "@/lib/clan-war";

describe("clanLevelFromBadges", () => {
  it("maps badge totals to levels", () => {
    expect(clanLevelFromBadges(0)).toBe(1);
    expect(clanLevelFromBadges(8)).toBe(2);
    expect(clanLevelFromBadges(20)).toBe(5);
  });
});

describe("canRegisterForWar", () => {
  it("requires 10 members and level 5", () => {
    expect(canRegisterForWar({ memberCount: 9, totalBadges: 20 }).ok).toBe(false);
    expect(canRegisterForWar({ memberCount: 10, totalBadges: 19 }).ok).toBe(false);
    expect(canRegisterForWar({ memberCount: 10, totalBadges: 20 })).toEqual({ ok: true });
  });
});

describe("war scoring", () => {
  it("increments the winner side and detects completion", () => {
    expect(warScoreAfterBattle(0, 0, "A")).toEqual({ scoreA: 1, scoreB: 0 });
    expect(warWinnerSide(3, 2)).toBe("A");
    expect(warWinnerSide(2, 2)).toBe("draw");
    expect(warIsComplete(5)).toBe(true);
    expect(warIsComplete(4)).toBe(false);
  });
});

describe("pickWarOpponent", () => {
  it("picks nearest rating when rng is fixed", () => {
    const me = { clanId: "a", registrationId: "ra", rating: 1000 };
    const others = [
      { clanId: "b", registrationId: "rb", rating: 1400 },
      { clanId: "c", registrationId: "rc", rating: 1010 },
    ];
    expect(pickWarOpponent(me, others, () => 0)?.clanId).toBe("c");
  });
});

describe("settleClanWarRatings", () => {
  it("moves elo toward the winner", () => {
    const settled = settleClanWarRatings({
      ratingA: 1000,
      ratingB: 1000,
      scoreA: 3,
      scoreB: 2,
    });
    expect(settled.winner).toBe("A");
    expect(settled.ratingAAfter).toBeGreaterThan(1000);
    expect(settled.ratingBAfter).toBeLessThan(1000);
  });
});
