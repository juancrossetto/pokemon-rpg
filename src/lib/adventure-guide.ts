/**
 * Pasos guiados de la aventura (puro, sin Prisma).
 *
 * Prioridad del paso actual: cobrar recompensas → gym → explorar.
 * Curar no va acá: el Centro Pokémon del home ya es el CTA de heal, y
 * hijackear el botón de expedición con "Curar equipo" (href `/`) dejaba
 * un CTA muerto encima del mapa cuando el equipo estaba herido.
 */

export type AdventureGuideStepId =
  | "explore"
  | "clear_zone"
  | "claim_rewards"
  | "challenge_gym";

export type AdventureGuideStepStatus = "done" | "current" | "upcoming";

export type AdventureGuideStep = {
  id: AdventureGuideStepId;
  status: AdventureGuideStepStatus;
  href: string;
};

export type AdventureGuideContext = {
  milestoneKind: "stage" | "gym" | "complete";
  stagesDone: number;
  stagesTotal: number;
  claimableCount: number;
  gymHref?: string | null;
};

export function buildAdventureGuide(
  ctx: AdventureGuideContext,
): AdventureGuideStep[] {
  const zoneDone = ctx.stagesTotal > 0 && ctx.stagesDone >= ctx.stagesTotal;
  const gymReady = ctx.milestoneKind === "gym";
  const gymHref = ctx.gymHref ?? "/gyms";

  let currentId: AdventureGuideStepId;
  if (ctx.claimableCount > 0) currentId = "claim_rewards";
  else if (gymReady) currentId = "challenge_gym";
  else currentId = "explore";

  const steps: AdventureGuideStep[] = [
    {
      id: "explore",
      href: "/battle",
      status:
        currentId === "explore"
          ? "current"
          : zoneDone || gymReady
            ? "done"
            : "upcoming",
    },
    {
      id: "clear_zone",
      href: "/campaign",
      status: zoneDone ? "done" : "upcoming",
    },
    {
      id: "claim_rewards",
      href: "/campaign",
      status:
        currentId === "claim_rewards"
          ? "current"
          : ctx.claimableCount === 0 && zoneDone
            ? "done"
            : "upcoming",
    },
  ];

  if (gymReady || ctx.milestoneKind === "complete") {
    steps.push({
      id: "challenge_gym",
      href: gymHref,
      status:
        currentId === "challenge_gym"
          ? "current"
          : ctx.milestoneKind === "complete"
            ? "done"
            : "upcoming",
    });
  }

  return steps;
}
