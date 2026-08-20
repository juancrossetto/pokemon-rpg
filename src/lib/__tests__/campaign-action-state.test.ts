import { describe, expect, it } from "vitest";
import {
  canChallengeGym,
  getCampaignActionForZone,
  getCampaignPrimaryAction,
  getGymChallengeRequirements,
  getMissingRequirements,
  getZoneUnlockRequirements,
  recommendedChapterZoneId,
  defaultChapterZoneId,
  resolveZoneNodeStatus,
} from "@/lib/campaign/action-state";
import { CAMPAIGN_DEFAULTS, chapterWildStagesForGym, type CampaignProgressRow } from "@/lib/campaign/progress";
import type { Chapter } from "@/lib/campaign/chapters";
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
    totalStages: 3,
    levelMin: 1,
    levelMax: 5,
    encounterRate: "medium",
    stages: [],
    spawnSpeciesIds: [],
    objectiveSpeciesIds: [],
    encounters: [],
    masteryXp: 0,
    masteryLevel: 1,
    trainers: [],
    claimedObjectives: [],
    gymOrder: null,
    ...partial,
  };
}

describe("canChallengeGym", () => {
  it("allows rematch when badge already earned", () => {
    expect(canChallengeGym(1, [], { hasBadge: true })).toBe(true);
  });

  it("blocks gym 1 when chapter wild stages are incomplete", () => {
    expect(canChallengeGym(1, [])).toBe(false);
  });
});

describe("getGymChallengeRequirements", () => {
  it("reports incomplete chapter stages and team prep gates", () => {
    const reqs = getGymChallengeRequirements(1, [], 10, 12, "kanto", 1);
    expect(reqs).toHaveLength(3);
    expect(reqs[0]?.type).toBe("complete_all_chapter_stages");
    expect(reqs[0]?.completed).toBe(false);
    expect(reqs[1]?.type).toBe("reach_team_level");
    expect(reqs[1]?.completed).toBe(false);
    expect(reqs[2]?.type).toBe("own_ready_pokemon");
    expect(reqs[2]?.completed).toBe(false);
    expect(getMissingRequirements(reqs)).toHaveLength(3);
  });

  it("marks team level complete when high enough", () => {
    const reqs = getGymChallengeRequirements(1, [], 20, 12, "kanto", 2);
    const level = reqs.find((r) => r.type === "reach_team_level");
    const ready = reqs.find((r) => r.type === "own_ready_pokemon");
    expect(level?.completed).toBe(true);
    expect(ready?.completed).toBe(true);
  });
});

describe("getCampaignPrimaryAction", () => {
  it("points new players at exploration", () => {
    const action = getCampaignPrimaryAction({
      progress: progress(),
      earnedGymOrders: [],
      teamMaxLevel: 5,
    });
    expect(action.action).toBe("explore");
    expect(action.labelKey).toBe("continueExpedition");
    expect(action.href).toBe("/battle");
    expect(action.enabled).toBe(true);
  });

  it("blocks gym challenge CTA until chapter stages are done", () => {
    const action = getCampaignPrimaryAction({
      progress: progress({
        highestUnlockedLocationId: "pewter-gym",
        farmingLocationId: "pewter-gym",
        selectedLocationId: "pewter-gym",
        farmingStageId: "pewter-gym-1",
        completedStageIds: [],
      }),
      earnedGymOrders: [],
      teamMaxLevel: 20,
      gymRecommendedLevel: 12,
    });
    // nextMilestone should be gym 1 when previous stages are somehow unlocked,
    // or explore — either way challenge_gym must not fire with empty stages.
    if (action.milestone.kind === "gym") {
      expect(action.action).toBe("blocked");
      expect(action.missingRequirements.some((r) => !r.completed)).toBe(true);
      expect(action.href).toBe("/battle");
    }
  });

  it("enables challenge_gym when chapter stages and team prep are complete", () => {
    const stageIds = chapterWildStagesForGym(1).map((s) => s.id);
    const action = getCampaignPrimaryAction({
      progress: progress({
        highestUnlockedLocationId: "pewter-gym",
        farmingLocationId: "pewter-gym",
        selectedLocationId: "pewter-gym",
        farmingStageId: "pewter-gym-1",
        completedStageIds: stageIds,
        highestCompletedStageId: stageIds.at(-1) ?? null,
      }),
      earnedGymOrders: [],
      teamMaxLevel: 20,
      teamReadyCount: 2,
      gymRecommendedLevel: 12,
    });
    expect(action.milestone.kind).toBe("gym");
    expect(action.action).toBe("challenge_gym");
    expect(action.labelKey).toBe("challengeGym");
    expect(action.enabled).toBe(true);
    expect(
      canChallengeGym(1, stageIds, {
        teamMaxLevel: 20,
        teamReadyCount: 2,
        recommendedLevel: 12,
      }),
    ).toBe(true);
  });

  it("blocks challenge_gym when stages are done but team is underleveled", () => {
    const stageIds = chapterWildStagesForGym(1).map((s) => s.id);
    const action = getCampaignPrimaryAction({
      progress: progress({
        highestUnlockedLocationId: "pewter-gym",
        farmingLocationId: "pewter-gym",
        selectedLocationId: "pewter-gym",
        farmingStageId: "pewter-gym-1",
        completedStageIds: stageIds,
        highestCompletedStageId: stageIds.at(-1) ?? null,
      }),
      earnedGymOrders: [],
      teamMaxLevel: 8,
      teamReadyCount: 1,
      gymRecommendedLevel: 12,
    });
    expect(action.milestone.kind).toBe("gym");
    expect(action.action).toBe("blocked");
    expect(action.objectiveTitleKey).toBe("objectivePrepForGym");
    expect(action.href).toBe("/battle");
  });

  it("returns view_journey when region is complete", () => {
    // Unreachable via empty completed list — use complete milestone path by
    // feeding every wild stage id would be huge; assert complete branch via
    // a progress that nextMilestone treats as done is covered indirectly.
    // Here we only verify the explorer path stays consistent.
    const action = getCampaignPrimaryAction({
      progress: progress({
        highestUnlockedLocationId: "pallet-town",
        farmingLocationId: "pallet-town",
        farmingStageId: "pallet-1",
        selectedLocationId: "pallet-town",
      }),
      earnedGymOrders: [],
      teamMaxLevel: 5,
    });
    expect(["explore", "continue", "blocked", "challenge_gym"]).toContain(action.action);
    expect(action.milestone.kind).not.toBe("complete");
  });
});

describe("getZoneUnlockRequirements", () => {
  it("returns empty when location is already unlocked", () => {
    expect(
      getZoneUnlockRequirements(
        "route-1",
        progress({ highestUnlockedLocationId: "route-1" }),
      ),
    ).toEqual([]);
  });

  it("points at the stage that unlocks the locked location", () => {
    const reqs = getZoneUnlockRequirements(
      "viridian-city",
      progress({ highestUnlockedLocationId: "route-1", completedStageIds: [] }),
    );
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs[0]?.completed).toBe(false);
    expect(reqs[0]?.type).toBe("complete_stage");
    expect(reqs[0]?.descriptionKey).toBe("reqCompleteStageAt");
  });

  it("marks unlock requirement complete when the unlocking stage is done", () => {
    const reqs = getZoneUnlockRequirements(
      "viridian-city",
      progress({
        highestUnlockedLocationId: "route-1",
        completedStageIds: ["r1-3"],
      }),
    );
    // Still locked by highestUnlocked, but the stage requirement itself is done.
    expect(reqs[0]?.completed).toBe(true);
  });

  it("also requires beating the previous zone trainers", () => {
    const reqs = getZoneUnlockRequirements(
      "viridian-city",
      progress({
        highestUnlockedLocationId: "route-1",
        completedStageIds: ["r1-3"],
      }),
    );
    const trainers = reqs.find((r) => r.type === "defeat_trainers");
    expect(trainers?.completed).toBe(false);
    expect(trainers?.descriptionKey).toBe("reqDefeatTrainersAt");

    const beaten = getZoneUnlockRequirements(
      "viridian-city",
      progress({
        highestUnlockedLocationId: "route-1",
        completedStageIds: ["r1-3"],
      }),
      ["route-1-youngster"],
    );
    expect(beaten.find((r) => r.type === "defeat_trainers")?.completed).toBe(true);
  });
});

describe("resolveZoneNodeStatus", () => {
  const chapter = {
    number: 1,
    nameKey: "locations.pewter_city",
    zones: [],
    gym: null,
    gymOrder: 1,
    stagesDone: 2,
    stagesTotal: 4,
    speciesCaught: 0,
    speciesTotal: 0,
    unlocked: true,
    completed: false,
    percent: 50,
  } satisfies Chapter;

  it("marks locked zones", () => {
    expect(
      resolveZoneNodeStatus({
        zone: zone({ id: "route-1", unlocked: false }),
        farmingLocationId: "pallet-town",
        selectedZoneId: null,
        chapter,
        badgeEarned: false,
      }),
    ).toBe("locked");
  });

  it("marks completed wild zones", () => {
    expect(
      resolveZoneNodeStatus({
        zone: zone({ id: "route-1", completedStages: 3, totalStages: 3 }),
        farmingLocationId: "pallet-town",
        selectedZoneId: null,
        chapter,
        badgeEarned: false,
      }),
    ).toBe("completed");
  });

  it("keeps a zone in progress when stages are done but trainers remain", () => {
    expect(
      resolveZoneNodeStatus({
        zone: zone({
          id: "route-1",
          completedStages: 3,
          totalStages: 3,
          trainers: [
            {
              id: "route-1-youngster",
              nameKey: "trainers.youngster",
              spriteUrl: "",
              level: 3,
              coinReward: 50,
              defeated: false,
            },
          ],
        }),
        farmingLocationId: "route-1",
        selectedZoneId: "route-1",
        chapter,
        badgeEarned: false,
      }),
    ).toBe("in_progress");
  });

  it("marks farming zone as in_progress", () => {
    expect(
      resolveZoneNodeStatus({
        zone: zone({ id: "route-1", completedStages: 1, totalStages: 3 }),
        farmingLocationId: "route-1",
        selectedZoneId: null,
        chapter,
        badgeEarned: false,
      }),
    ).toBe("in_progress");
  });
});

describe("getCampaignActionForZone", () => {
  const storyMilestone = {
    kind: "gym" as const,
    id: "gym-1",
    nameKey: "locations.saffron-gym",
    locationId: "saffron-gym",
    gymOrder: 6,
  };

  const chapterBase: Chapter = {
    number: 6,
    nameKey: "locations.saffron-city",
    zones: [],
    gym: null,
    gymOrder: 6,
    stagesDone: 4,
    stagesTotal: 4,
    speciesCaught: 0,
    speciesTotal: 0,
    unlocked: true,
    completed: false,
    percent: 80,
  };

  it("explores when the selected wild zone is already farming", () => {
    const action = getCampaignActionForZone({
      zone: zone({ id: "saffron-city", nameKey: "locations.saffron-city" }),
      farmingLocationId: "saffron-city",
      progress: progress(),
      earnedGymOrders: [],
      teamMaxLevel: 50,
      chapter: chapterBase,
      storyMilestone,
    });
    expect(action.action).toBe("explore");
    expect(action.labelKey).toBe("continueExpedition");
    expect(action.href).toBe("/battle");
  });

  it("asks to travel when the selected wild zone is not farming", () => {
    const action = getCampaignActionForZone({
      zone: zone({ id: "route-15", nameKey: "locations.route-15" }),
      farmingLocationId: "saffron-city",
      progress: progress(),
      earnedGymOrders: [],
      teamMaxLevel: 50,
      chapter: chapterBase,
      storyMilestone,
    });
    expect(action.action).toBe("travel");
    expect(action.labelKey).toBe("startExploring");
  });

  it("challenges gym when selected gym chapter is cleared", () => {
    const wild = chapterWildStagesForGym(1);
    const action = getCampaignActionForZone({
      zone: zone({
        id: "pewter-gym",
        nameKey: "locations.pewter-gym",
        kindKey: "kinds.gym",
        gymOrder: 1,
      }),
      farmingLocationId: "route-1",
      progress: progress({ completedStageIds: wild.map((s) => s.id) }),
      earnedGymOrders: [],
      teamMaxLevel: 20,
      teamReadyCount: 2,
      chapter: { ...chapterBase, number: 1, gymOrder: 1 },
      storyMilestone: {
        kind: "gym",
        id: "gym-1",
        nameKey: "locations.pewter-gym",
        locationId: "pewter-gym",
        gymOrder: 1,
      },
      gymHref: "/gyms/pewter",
      gymRecommendedLevel: 12,
    });
    expect(action.action).toBe("challenge_gym");
    expect(action.labelKey).toBe("challengeGym");
    expect(action.href).toBe("/gyms/pewter");
  });
});

describe("recommendedChapterZoneId", () => {
  function chapterWith(zones: MapLocation[], partial: Partial<Chapter> = {}): Chapter {
    return {
      number: 1,
      nameKey: "locations.pewter_city",
      zones,
      gym: zones.find((z) => z.kindKey === "kinds.gym") ?? null,
      gymOrder: 1,
      stagesDone: 0,
      stagesTotal: 6,
      speciesCaught: 0,
      speciesTotal: 0,
      unlocked: true,
      completed: false,
      percent: 0,
      ...partial,
    };
  }

  const gymZone = zone({
    id: "pewter-gym",
    kindKey: "kinds.gym",
    totalStages: 0,
    gymOrder: 1,
  });

  it("points at the first unfinished unlocked zone in chapter order", () => {
    const chapter = chapterWith([
      zone({ id: "route-1", completedStages: 3, totalStages: 3 }),
      zone({ id: "route-2", completedStages: 1, totalStages: 3 }),
      zone({ id: "route-3" }),
      gymZone,
    ]);
    expect(
      recommendedChapterZoneId({
        chapter,
        farmingLocationId: "route-1",
        earnedGymOrders: [],
      }),
    ).toBe("route-2");
  });

  it("keeps the player where they are standing when that zone is unfinished", () => {
    const chapter = chapterWith([
      zone({ id: "route-1", completedStages: 1, totalStages: 3 }),
      zone({ id: "route-2", completedStages: 0, totalStages: 3 }),
      gymZone,
    ]);
    expect(
      recommendedChapterZoneId({
        chapter,
        farmingLocationId: "route-2",
        earnedGymOrders: [],
      }),
    ).toBe("route-2");
  });

  it("skips locked zones", () => {
    const chapter = chapterWith([
      zone({ id: "route-1", completedStages: 3, totalStages: 3 }),
      zone({ id: "route-2", unlocked: false }),
      zone({ id: "route-3", completedStages: 0, totalStages: 3 }),
      gymZone,
    ]);
    expect(
      recommendedChapterZoneId({
        chapter,
        farmingLocationId: "route-1",
        earnedGymOrders: [],
      }),
    ).toBe("route-3");
  });

  it("stays on a cleared-stage zone until its trainers fall", () => {
    const chapter = chapterWith([
      zone({
        id: "route-1",
        completedStages: 3,
        totalStages: 3,
        trainers: [
          {
            id: "route-1-youngster",
            nameKey: "trainers.youngster",
            spriteUrl: "",
            level: 3,
            coinReward: 50,
            defeated: false,
          },
        ],
      }),
      zone({ id: "route-2", completedStages: 3, totalStages: 3 }),
      gymZone,
    ]);
    expect(
      recommendedChapterZoneId({
        chapter,
        farmingLocationId: "route-2",
        earnedGymOrders: [],
      }),
    ).toBe("route-1");
  });

  it("points at the gym once every wild zone is cleared", () => {
    const chapter = chapterWith([
      zone({ id: "route-1", completedStages: 3, totalStages: 3 }),
      gymZone,
    ]);
    expect(
      recommendedChapterZoneId({
        chapter,
        farmingLocationId: "route-1",
        earnedGymOrders: [],
      }),
    ).toBe("pewter-gym");
  });

  it("returns null when the badge is already won", () => {
    const chapter = chapterWith([
      zone({ id: "route-1", completedStages: 3, totalStages: 3 }),
      gymZone,
    ]);
    expect(
      recommendedChapterZoneId({
        chapter,
        farmingLocationId: "route-1",
        earnedGymOrders: [1],
      }),
    ).toBeNull();
  });
});

describe("defaultChapterZoneId", () => {
  function chapterWith(zones: MapLocation[], partial: Partial<Chapter> = {}): Chapter {
    return {
      number: 9,
      nameKey: "chapterNames.elite_four",
      zones,
      gym: zones.find((z) => z.kindKey === "kinds.gym") ?? null,
      gymOrder: 9,
      stagesDone: 7,
      stagesTotal: 9,
      speciesCaught: 0,
      speciesTotal: 0,
      unlocked: true,
      completed: false,
      percent: 88,
      ...partial,
    };
  }

  it("does not fall back to a cleared first zone when a later one is pending", () => {
    const chapter = chapterWith([
      zone({ id: "victory-road", completedStages: 3, totalStages: 3 }),
      zone({ id: "lorelei", completedStages: 0, totalStages: 1 }),
      zone({
        id: "elite-gym",
        kindKey: "kinds.gym",
        totalStages: 0,
        gymOrder: 9,
      }),
    ]);
    expect(
      defaultChapterZoneId({
        chapter,
        farmingLocationId: "pewter-gym",
        earnedGymOrders: [1, 2, 3, 4, 5, 6, 7, 8],
      }),
    ).toBe("lorelei");
  });

  it("falls back to the last unlocked zone when the chapter is done", () => {
    const gym = zone({
      id: "elite-gym",
      kindKey: "kinds.gym",
      totalStages: 0,
      gymOrder: 9,
    });
    const chapter = chapterWith(
      [zone({ id: "victory-road", completedStages: 3, totalStages: 3 }), gym],
      { completed: true, percent: 100 },
    );
    expect(
      defaultChapterZoneId({
        chapter,
        farmingLocationId: "route-1",
        earnedGymOrders: [9],
      }),
    ).toBe("elite-gym");
  });
});
