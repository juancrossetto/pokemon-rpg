import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DEFAULTS,
  journeyProgressPercent,
  listLocationsForUi,
  repairCampaignProgressPatch,
  type CampaignProgressRow,
} from "@/lib/campaign/progress";
import { regionContent, resolveProgressRegionId } from "@/lib/campaign/content";
import { REGIONS } from "@/lib/regions";
import { buildMapLocations } from "@/lib/campaign/map-selection";

function row(partial: Partial<CampaignProgressRow> = {}): CampaignProgressRow {
  return { ...CAMPAIGN_DEFAULTS, ...partial };
}

describe("multi-region campaign seams", () => {
  it("keeps Johto non-playable with empty content pack", () => {
    expect(REGIONS.johto.playable).toBe(false);
    expect(REGIONS.johto.gymsAvailable).toBe(false);
    expect(regionContent("johto").locations).toHaveLength(0);
  });

  it("does not report 100% journey when currentRegionId is johto", () => {
    const progress = row({
      currentRegionId: "johto",
      completedStageIds: ["pallet-1", "route-1-1"],
    });
    expect(journeyProgressPercent(progress)).toBe(0);
    expect(listLocationsForUi(progress)).toHaveLength(0);
  });

  it("resolveProgressRegionId prefers currentRegionId", () => {
    expect(
      resolveProgressRegionId({
        currentRegionId: "johto",
        farmingLocationId: "pallet-town",
      }),
    ).toBe("johto");
  });

  it("repair does not yank a valid Kanto farming pointer", () => {
    const patch = repairCampaignProgressPatch(row());
    expect(patch).toBeNull();
  });

  it("buildMapLocations never drops zones without explicit pins", () => {
    const locations = buildMapLocations(row());
    expect(locations.length).toBeGreaterThan(0);
    expect(locations.every((l) => Number.isFinite(l.x) && Number.isFinite(l.y))).toBe(
      true,
    );
  });
});
