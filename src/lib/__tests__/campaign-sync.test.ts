import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DEFAULTS,
  applyFarmingClear,
  applyStageCompletion,
  resolveFarmingAfterStageComplete,
} from "@/lib/campaign";

describe("resolveFarmingAfterStageComplete", () => {
  it("does not park farming on a gym milestone after unlocking a gym hub", () => {
    const before = {
      ...CAMPAIGN_DEFAULTS,
      highestUnlockedLocationId: "pewter-city",
      selectedLocationId: "pewter-city",
      farmingLocationId: "pewter-city",
      farmingStageId: "pewter-1",
      completedStageIds: ["pallet-1"],
    };
    const patch = applyStageCompletion(before, "pewter-1");
    expect(patch.highestUnlockedLocationId).toBe("pewter-gym");

    const farming = resolveFarmingAfterStageComplete(before, "pewter-1", patch);
    expect(farming.farmingStageId).not.toMatch(/gym/);
    expect(farming.farmingStageId).toBe("pewter-1");
    expect(farming.selectedLocationId).toBe("pewter-gym");
  });

  it("advances to the next wild stage in the same location when available", () => {
    const before = {
      ...CAMPAIGN_DEFAULTS,
      highestUnlockedLocationId: "route-1",
      selectedLocationId: "route-1",
      farmingLocationId: "route-1",
      farmingStageId: "r1-1",
      completedStageIds: ["pallet-1"],
    };
    const patch = applyStageCompletion(before, "r1-1");
    const farming = resolveFarmingAfterStageComplete(before, "r1-1", patch);
    expect(farming.farmingStageId).toBe("r1-2");
    expect(farming.farmingLocationId).toBe("route-1");
  });
});

describe("applyFarmingClear", () => {
  it("tracks partial clears until clearsRequired is met", () => {
    const before = {
      ...CAMPAIGN_DEFAULTS,
      farmingStageId: "r1-1",
      highestUnlockedLocationId: "route-1",
      farmingLocationId: "route-1",
      selectedLocationId: "route-1",
      completedStageIds: ["pallet-1"] as string[],
    };
    const first = applyFarmingClear(before, "r1-1");
    expect(first.completed).toBe(false);
    expect(first.clears).toBe(1);
    expect(first.required).toBe(2);
    expect(first.patch.stageClearCounts?.["r1-1"]).toBe(1);
    expect(first.patch.completedStageIds).toBeUndefined();

    const second = applyFarmingClear(
      { ...before, stageClearCounts: first.patch.stageClearCounts! },
      "r1-1",
    );
    expect(second.completed).toBe(true);
    expect(second.patch.completedStageIds).toContain("r1-1");
    expect(second.patch.stageClearCounts?.["r1-1"]).toBeUndefined();
  });
});
