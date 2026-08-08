import { describe, expect, it } from "vitest";
import { buildAdventureGuide } from "@/lib/adventure-guide";

describe("buildAdventureGuide", () => {
  it("prioriza reclamar recompensas sobre explorar", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "stage",
      stagesDone: 1,
      stagesTotal: 3,
      claimableCount: 2,
      needsHealing: false,
    });
    expect(steps.find((s) => s.status === "current")?.id).toBe("claim_rewards");
  });

  it("prioriza curar si no hay rewards pendientes", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "stage",
      stagesDone: 1,
      stagesTotal: 3,
      claimableCount: 0,
      needsHealing: true,
    });
    expect(steps.find((s) => s.status === "current")?.id).toBe("heal");
  });

  it("apunta al gym cuando el hito es gimnasio", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "gym",
      stagesDone: 3,
      stagesTotal: 3,
      claimableCount: 0,
      needsHealing: false,
      gymHref: "/gyms/pewter",
    });
    const current = steps.find((s) => s.status === "current");
    expect(current?.id).toBe("challenge_gym");
    expect(current?.href).toBe("/gyms/pewter");
  });
});
