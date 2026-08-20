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
import { encounterLocationsForSpecies } from "@/lib/pokedex";

function row(partial: Partial<CampaignProgressRow> = {}): CampaignProgressRow {
  return { ...CAMPAIGN_DEFAULTS, ...partial };
}

describe("multi-region campaign seams", () => {
  it("ships Johto as a complete playable eight-gym campaign", () => {
    expect(REGIONS.johto.playable).toBe(true);
    expect(REGIONS.johto.gymsAvailable).toBe(true);
    expect(REGIONS.johto.speciesAvailable).toBe(true);
    const locations = regionContent("johto").locations;
    expect(locations).toHaveLength(41);
    expect(locations.filter((location) => location.kind === "gym")).toHaveLength(8);
    expect(locations[0]?.id).toBe("johto-new-bark");
    expect(locations.at(-1)?.id).toBe("johto-blackthorn-gym");
    expect(REGIONS.johto.defaults).toMatchObject({
      highestUnlockedLocationId: "johto-new-bark",
      selectedLocationId: "johto-new-bark",
      farmingLocationId: "johto-new-bark",
      farmingStageId: "johto-new-bark-1",
    });
  });

  it("gives every Johto stage its real location identity", () => {
    const locations = regionContent("johto").locations;
    const stages = locations.flatMap((location) => location.stages);

    expect(stages).toHaveLength(locations.length);
    expect(stages.every((stage) => stage.nameKey !== "stages.johto_route")).toBe(true);
    expect(
      locations.every((location) =>
        location.stages.every((stage) => stage.nameKey === location.nameKey),
      ),
    ).toBe(true);
  });

  it("indexes campaign habitats for the Pokédex detail", () => {
    expect(encounterLocationsForSpecies(163)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "johto-new-bark", regionId: "johto" }),
        expect.objectContaining({ id: "johto-violet-city", regionId: "johto" }),
      ]),
    );
    expect(encounterLocationsForSpecies(999_999)).toEqual([]);
  });

  it("does not report 100% journey when currentRegionId is johto", () => {
    const progress = row({
      currentRegionId: "johto",
      completedStageIds: ["pallet-1", "route-1-1"],
    });
    expect(journeyProgressPercent(progress)).toBe(0);
    expect(listLocationsForUi(progress)).toHaveLength(41);
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
