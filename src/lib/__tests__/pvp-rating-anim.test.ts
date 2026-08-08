import { describe, expect, it } from "vitest";
import { buildPvpRatingSegments, didPromoteRank } from "@/lib/pvp/rating-anim";
import { nextRankProgress, rankFloor, rankForRating } from "@/lib/pvp/tiers";

describe("buildPvpRatingSegments", () => {
  it("single segment within the same division", () => {
    const before = 1000;
    const after = 1020;
    const segs = buildPvpRatingSegments(before, after);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.rankUpAfter).toBe(false);
    expect(segs[0]!.to).toBeGreaterThan(segs[0]!.from);
  });

  it("fills to 100% then continues when crossing a division", () => {
    const standing = rankForRating(1000);
    const next = nextRankProgress(1000).next;
    expect(next).not.toBeNull();
    const floorNext = rankFloor(next!);
    const segs = buildPvpRatingSegments(1000, floorNext + 5);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0]!.to).toBe(1);
    expect(segs[0]!.rankUpAfter).toBe(true);
    expect(segs.at(-1)!.rankUpAfter).toBe(false);
    expect(standing.tier).toBeTruthy();
  });

  it("drains on rating loss within a division", () => {
    const segs = buildPvpRatingSegments(1020, 1005);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.to).toBeLessThan(segs[0]!.from);
  });

  it("resets the bar when dropping a division", () => {
    const next = nextRankProgress(1000).next;
    expect(next).not.toBeNull();
    const floorNext = rankFloor(next!);
    const segs = buildPvpRatingSegments(floorNext + 10, floorNext - 10);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0]!.to).toBe(0);
  });
});

describe("didPromoteRank", () => {
  it("detects league promotion at 1100", () => {
    expect(didPromoteRank(1099, 1100)).toBe(true);
    expect(didPromoteRank(1099, 1099)).toBe(false);
    expect(didPromoteRank(1100, 1090)).toBe(false);
  });
});
