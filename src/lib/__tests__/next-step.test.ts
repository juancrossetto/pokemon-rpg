import { describe, expect, it } from "vitest";
import { getNextStep, isEliteMilestone, resolvePlayerStage } from "@/lib/next-step";
import type { NextStepContext } from "@/lib/next-step";
import type { CampaignMilestone } from "@/lib/campaign/types";

const stageMilestone: CampaignMilestone = {
  kind: "stage",
  id: "route-1-a",
  locationId: "route-1",
  stageId: "route-1-a",
  nameKey: "stages.route_1_a",
};

const gymMilestone = (gymOrder: number): CampaignMilestone => ({
  kind: "gym",
  id: `gym-${gymOrder}`,
  locationId: "pewter-city",
  gymOrder,
  nameKey: "locations.pewter_city",
});

const completeMilestone: CampaignMilestone = {
  kind: "complete",
  id: "region-complete",
  nameKey: "milestones.region_complete",
};

const base: NextStepContext = {
  teamSize: 3,
  badgeCount: 2,
  totalBadges: 8,
  milestone: stageMilestone,
};

describe("resolvePlayerStage", () => {
  it("sin equipo, la etapa es novato aunque haya progreso", () => {
    expect(resolvePlayerStage({ ...base, teamSize: 0, badgeCount: 8 })).toBe("rookie");
  });

  it("con historia en curso, la etapa es aventura", () => {
    expect(resolvePlayerStage(base)).toBe("adventuring");
  });

  it("con las 8 medallas y el hito en el Alto Mando, la etapa es élite", () => {
    expect(
      resolvePlayerStage({ ...base, badgeCount: 8, milestone: gymMilestone(9) }),
    ).toBe("elite");
  });

  it("con las 8 medallas pero stages de historia pendientes, sigue siendo aventura", () => {
    // Entre la octava medalla y Lorelei está Calle Victoria: hasta cruzarla, el
    // hero de expedición manda y la card no debe contradecirlo.
    expect(
      resolvePlayerStage({ ...base, badgeCount: 8, milestone: stageMilestone }),
    ).toBe("adventuring");
  });

  it("con la región completa, la etapa es campeón", () => {
    expect(
      resolvePlayerStage({ ...base, badgeCount: 8, milestone: completeMilestone }),
    ).toBe("champion");
  });
});

describe("isEliteMilestone", () => {
  it("distingue un gimnasio de medalla de uno del Alto Mando", () => {
    expect(isEliteMilestone(gymMilestone(8), 8)).toBe(false);
    expect(isEliteMilestone(gymMilestone(9), 8)).toBe(true);
  });

  it("un hito que no es gimnasio nunca es élite", () => {
    expect(isEliteMilestone(stageMilestone, 8)).toBe(false);
    expect(isEliteMilestone(null, 8)).toBe(false);
  });
});

describe("getNextStep", () => {
  it("durante la historia no dibuja card: el hero de expedición ya es el CTA", () => {
    const step = getNextStep(base);
    expect(step.id).toBe("story");
    expect(step.standalone).toBe(false);
  });

  it("sin equipo manda a elegir inicial", () => {
    const step = getNextStep({ ...base, teamSize: 0 });
    expect(step.href).toBe("/starter");
    expect(step.standalone).toBe(true);
  });

  it("con las 8 medallas linkea directo al gimnasio del Alto Mando", () => {
    const step = getNextStep({
      ...base,
      badgeCount: 8,
      milestone: gymMilestone(9),
      eliteGymHref: "/gyms/elite-lorelei",
    });
    expect(step.id).toBe("elite_four");
    expect(step.href).toBe("/gyms/elite-lorelei");
    expect(step.standalone).toBe(true);
  });

  it("sin ruta élite resuelta cae al viaje, que sí muestra esos nodos", () => {
    const step = getNextStep({ ...base, badgeCount: 8, milestone: gymMilestone(9) });
    expect(step.href).toBe("/campaign");
  });

  it("el campeón recibe Torre como principal y PvP como alternativa", () => {
    const step = getNextStep({
      ...base,
      badgeCount: 8,
      milestone: completeMilestone,
    });
    expect(step.href).toBe("/tower");
    expect(step.secondary?.href).toBe("/pvp");
    expect(step.standalone).toBe(true);
  });
});
