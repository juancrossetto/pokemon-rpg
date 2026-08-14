import { describe, expect, it } from "vitest";
import {
  PVP_MIN_MATCHES,
  compareCombatPower,
  comparePvpRating,
  isCurrentPlayerInTop3,
  isPvpRankingEligible,
  pickRankingCategory,
  pvpMatchesPlayed,
  rankingHref,
  winRate,
} from "@/lib/ranking";

const day = (n: number) => new Date(`2024-01-${String(n).padStart(2, "0")}T00:00:00Z`);

describe("compareCombatPower", () => {
  it("orders by combat power descending", () => {
    const rows = [
      { id: "a", combatPower: 1000, medals: 0, createdAt: day(1) },
      { id: "b", combatPower: 1859, medals: 0, createdAt: day(2) },
      { id: "c", combatPower: 1400, medals: 8, createdAt: day(3) },
    ];
    const sorted = [...rows].sort(compareCombatPower);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by medals then createdAt then id", () => {
    const rows = [
      { id: "z", combatPower: 1500, medals: 2, createdAt: day(5) },
      { id: "a", combatPower: 1500, medals: 4, createdAt: day(5) },
      { id: "m", combatPower: 1500, medals: 4, createdAt: day(2) },
      { id: "b", combatPower: 1500, medals: 4, createdAt: day(2) },
    ];
    const sorted = [...rows].sort(compareCombatPower);
    expect(sorted.map((r) => r.id)).toEqual(["b", "m", "a", "z"]);
  });

  it("is stable for identical fields except id", () => {
    const a = { id: "aaa", combatPower: 10, medals: 1, createdAt: day(1) };
    const b = { id: "bbb", combatPower: 10, medals: 1, createdAt: day(1) };
    expect(compareCombatPower(a, b)).toBeLessThan(0);
    expect(compareCombatPower(b, a)).toBeGreaterThan(0);
    expect(compareCombatPower(a, a)).toBe(0);
  });
});

describe("PvP eligibility and Elo sort", () => {
  it(`requires at least ${PVP_MIN_MATCHES} matches`, () => {
    expect(pvpMatchesPlayed(3, 1)).toBe(4);
    expect(isPvpRankingEligible(3, 1)).toBe(false);
    expect(isPvpRankingEligible(4, 1)).toBe(true);
    expect(isPvpRankingEligible(5, 0)).toBe(true);
    expect(isPvpRankingEligible(0, 0)).toBe(false);
  });

  it("orders by Elo then wins", () => {
    const rows = [
      { id: "low", rating: 1000, wins: 20, losses: 5, createdAt: day(1) },
      { id: "hi", rating: 1400, wins: 5, losses: 5, createdAt: day(2) },
      { id: "mid", rating: 1200, wins: 10, losses: 5, createdAt: day(3) },
      { id: "hiMoreWins", rating: 1400, wins: 12, losses: 5, createdAt: day(4) },
    ];
    const eligible = rows.filter((r) => isPvpRankingEligible(r.wins, r.losses));
    const sorted = [...eligible].sort(comparePvpRating);
    expect(sorted.map((r) => r.id)).toEqual(["hiMoreWins", "hi", "mid", "low"]);
  });

  it("does not use combat power fields for PvP order", () => {
    // Ensure comparator only looks at rating/wins — no accidental PC mix.
    const a = { id: "a", rating: 1100, wins: 5, losses: 5, createdAt: day(1) };
    const b = { id: "b", rating: 1099, wins: 99, losses: 0, createdAt: day(1) };
    expect(comparePvpRating(a, b)).toBeLessThan(0);
  });
});

describe("winRate", () => {
  it("returns 0 with no games", () => {
    expect(winRate(0, 0)).toBe(0);
  });

  it("rounds percentage", () => {
    expect(winRate(1, 2)).toBe(33);
    expect(winRate(42, 8)).toBe(84);
  });
});

describe("pickRankingCategory", () => {
  it("maps legacy and new views", () => {
    expect(pickRankingCategory(undefined)).toBe("combat_power");
    expect(pickRankingCategory("trainers")).toBe("combat_power");
    expect(pickRankingCategory("combat_power")).toBe("combat_power");
    expect(pickRankingCategory("ladder")).toBe("pvp");
    expect(pickRankingCategory("pvp")).toBe("pvp");
    expect(pickRankingCategory("ranked")).toBe("ranked");
    expect(pickRankingCategory("collectors")).toBe("combat_power");
    expect(pickRankingCategory("pokedex")).toBe("combat_power");
    expect(pickRankingCategory("species")).toBe("combat_power");
  });
});

describe("rankingHref", () => {
  it("preserves the friends scope across ranking navigation", () => {
    expect(rankingHref("combat_power", "friends", undefined, 2)).toBe(
      "/ranking?view=combat_power&scope=friends&page=2",
    );
  });
});

describe("isCurrentPlayerInTop3", () => {
  it("marks top 3 for compact your-card", () => {
    expect(isCurrentPlayerInTop3(1)).toBe(true);
    expect(isCurrentPlayerInTop3(3)).toBe(true);
    expect(isCurrentPlayerInTop3(4)).toBe(false);
    expect(isCurrentPlayerInTop3(null)).toBe(false);
  });
});
