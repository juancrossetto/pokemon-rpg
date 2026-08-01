import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DEFAULTS,
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
