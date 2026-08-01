import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DEFAULTS,
  applyStageCompletion,
  isLocationUnlocked,
  repairCampaignProgressPatch,
  resolveFarmingAfterStageComplete,
  type CampaignProgressRow,
} from "@/lib/campaign";
import {
  campaignClaimErrorKey,
  campaignTrainerErrorKey,
} from "@/lib/campaign/client-errors";
import { evaluateObjective } from "@/lib/campaign/objectives";
import { getRouteTrainer } from "@/lib/campaign/trainers";
import type { MapLocation } from "@/lib/campaign/map-selection";

function progress(partial: Partial<CampaignProgressRow> = {}): CampaignProgressRow {
  return { ...CAMPAIGN_DEFAULTS, ...partial };
}

function zone(partial: Partial<MapLocation> & Pick<MapLocation, "id">): MapLocation {
  return {
    nameKey: "locations.test",
    kindKey: "kinds.route",
    unlocked: true,
    x: 0,
    y: 0,
    completedStages: 0,
    totalStages: 1,
    levelMin: 1,
    levelMax: 5,
    encounterRate: "medium",
    stages: [],
    spawnSpeciesIds: [16],
    encounters: [],
    masteryXp: 0,
    masteryLevel: 1,
    trainers: [],
    claimedObjectives: [],
    gymOrder: null,
    ...partial,
  };
}

describe("campaignClaimErrorKey", () => {
  it("maps claim codes to distinct i18n keys", () => {
    expect(campaignClaimErrorKey("not_done")).toBe("rewardClaimNotDone");
    expect(campaignClaimErrorKey("already_claimed")).toBe("rewardClaimAlready");
    expect(campaignClaimErrorKey("missing_item")).toBe("rewardClaimMissingItem");
    expect(campaignClaimErrorKey("invalid")).toBe("rewardClaimFailed");
    expect(campaignClaimErrorKey("unauthorized")).toBe("rewardClaimFailed");
  });
});

describe("campaignTrainerErrorKey", () => {
  it("maps trainer start codes to distinct i18n keys", () => {
    expect(campaignTrainerErrorKey("locked")).toBe("trainerErrorLocked");
    expect(campaignTrainerErrorKey("already_beaten")).toBe("trainerErrorBeaten");
    expect(campaignTrainerErrorKey("no_lead")).toBe("trainerErrorNoLead");
    expect(campaignTrainerErrorKey("fainted_lead")).toBe("trainerErrorFaintedLead");
    expect(campaignTrainerErrorKey("not_found")).toBe("trainerErrorNotFound");
    expect(campaignTrainerErrorKey("in_battle")).toBe("trainerErrorInBattle");
  });
});

describe("repairCampaignProgressPatch", () => {
  it("returns null when farming a valid wild stage", () => {
    expect(
      repairCampaignProgressPatch(
        progress({
          farmingLocationId: "pallet-town",
          farmingStageId: "pallet-1",
        }),
      ),
    ).toBeNull();
  });

  it("repairs gym-milestone farming back to last completed wild stage", () => {
    const patch = repairCampaignProgressPatch(
      progress({
        farmingLocationId: "pewter-gym",
        farmingStageId: "pewter-gym-milestone",
        selectedLocationId: "pewter-gym",
        completedStageIds: ["pallet-1", "pewter-1"],
      }),
    );
    expect(patch).toEqual({
      farmingLocationId: "pewter-city",
      farmingStageId: "pewter-1",
      selectedLocationId: "pewter-gym",
    });
  });

  it("falls back to defaults when stage id is unknown", () => {
    const patch = repairCampaignProgressPatch(
      progress({
        farmingLocationId: "ghost-zone",
        farmingStageId: "ghost-stage",
        completedStageIds: [],
      }),
    );
    expect(patch?.farmingStageId).toBe(CAMPAIGN_DEFAULTS.farmingStageId);
    expect(patch?.farmingLocationId).toBe(CAMPAIGN_DEFAULTS.farmingLocationId);
  });
});

describe("trainer zone unlock gate", () => {
  it("keeps late-route trainers locked until the location unlocks", () => {
    const early = progress({ highestUnlockedLocationId: "route-1" });
    const trainer = getRouteTrainer("route-21-fisherman");
    expect(trainer).toBeDefined();
    expect(isLocationUnlocked(trainer!.locationId, early)).toBe(false);

    const late = progress({ highestUnlockedLocationId: "route-21" });
    expect(isLocationUnlocked(trainer!.locationId, late)).toBe(true);
  });
});

describe("evaluateObjective pokedex", () => {
  it("requires caught (owned+seen-in-zone), not just owned elsewhere", () => {
    const z = zone({
      id: "route-1",
      encounters: [
        {
          speciesId: 16,
          name: "Pidgey",
          spriteUrl: "",
          types: ["flying"],
          caught: false,
          seen: true,
          rarity: "common",
        },
        {
          speciesId: 19,
          name: "Rattata",
          spriteUrl: "",
          types: ["normal"],
          caught: true,
          seen: true,
          rarity: "common",
        },
      ],
    });
    const state = evaluateObjective(z, "pokedex", new Set());
    expect(state?.current).toBe(1);
    expect(state?.target).toBe(2);
    expect(state?.done).toBe(false);
  });

  it("marks stages claimable when complete and unclaimed", () => {
    const z = zone({
      id: "pallet-town",
      completedStages: 1,
      totalStages: 1,
      encounters: [],
    });
    const state = evaluateObjective(z, "stages", new Set());
    expect(state?.done).toBe(true);
    expect(state?.claimable).toBe(true);

    const claimed = evaluateObjective(z, "stages", new Set(["stages"]));
    expect(claimed?.claimable).toBe(false);
    expect(claimed?.claimed).toBe(true);
  });
});

describe("catch-equivalent stage completion farming pointer", () => {
  it("keeps a farmable stage after pewter-1 unlocks the gym (KO or catch path)", () => {
    const before = progress({
      highestUnlockedLocationId: "pewter-city",
      selectedLocationId: "pewter-city",
      farmingLocationId: "pewter-city",
      farmingStageId: "pewter-1",
      completedStageIds: ["pallet-1"],
    });
    const patch = applyStageCompletion(before, "pewter-1");
    const farming = resolveFarmingAfterStageComplete(before, "pewter-1", patch);
    expect(farming.farmingStageId).toBe("pewter-1");
    expect(farming.selectedLocationId).toBe("pewter-gym");
  });
});
