import { describe, expect, it } from "vitest";
import { buildAdventureGuide } from "@/lib/adventure-guide";

describe("buildAdventureGuide", () => {
  it("prioriza reclamar recompensas sobre explorar", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "stage",
      stagesDone: 1,
      stagesTotal: 3,
      claimableCount: 2,
    });
    expect(steps.find((s) => s.status === "current")?.id).toBe("claim_rewards");
  });

  it("no mete curar como paso — eso es el Centro Pokémon", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "stage",
      stagesDone: 1,
      stagesTotal: 3,
      claimableCount: 0,
    });
    expect(steps.find((s) => s.id === "heal" as never)).toBeUndefined();
    expect(steps.find((s) => s.status === "current")?.id).toBe("explore");
  });

  it("apunta al gym cuando el hito es gimnasio", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "gym",
      stagesDone: 3,
      stagesTotal: 3,
      claimableCount: 0,
      gymHref: "/gyms/pewter",
    });
    const current = steps.find((s) => s.status === "current");
    expect(current?.id).toBe("challenge_gym");
    expect(current?.href).toBe("/gyms/pewter");
  });

  it("prioriza gym aunque la zona esté al 100%", () => {
    const steps = buildAdventureGuide({
      milestoneKind: "gym",
      stagesDone: 3,
      stagesTotal: 3,
      claimableCount: 0,
      gymHref: "/gyms/cerulean",
    });
    expect(steps.find((s) => s.status === "current")?.id).toBe("challenge_gym");
  });
});
