import {
  areChapterStagesCompleteForGym,
  chapterWildStagesForGym,
  isLocationUnlocked,
  type CampaignProgressRow,
} from "./progress";
import { allStages, findLocation, regionContent, resolveProgressRegionId } from "./content";
import type { CampaignMilestone } from "./types";
import type { Chapter } from "./chapters";
import type { MapLocation } from "./map-selection";
import { nextMilestone } from "./progress";
import { milestoneCtaKey, milestoneHref } from "@/lib/journey-ux";

/** Estado visual de un nodo del recorrido del capítulo. */
export type CampaignNodeStatus =
  | "locked"
  | "available"
  | "current"
  | "in_progress"
  | "completed"
  | "reward_pending";

export type CampaignRequirementType =
  | "complete_all_chapter_stages"
  | "reach_team_level"
  | "own_previous_badge"
  | "complete_stage"
  | "visit_location";

export type CampaignPrimaryActionKind =
  | "explore"
  | "continue"
  | "challenge_gym"
  | "view_journey"
  | "blocked";

export type CampaignActionLabelKey =
  | "challengeGym"
  | "continueExpedition"
  | "viewJourney"
  | "exploreLocation";

/**
 * Condición evaluada con datos reales.
 * `descriptionKey` apunta a `campaign.*` (i18n); no hardcodear copy en UI.
 */
export type CampaignRequirement = {
  id: string;
  type: CampaignRequirementType;
  targetId?: string;
  requiredAmount?: number;
  currentAmount?: number;
  completed: boolean;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
};

export type CampaignActionState = {
  action: CampaignPrimaryActionKind;
  labelKey: CampaignActionLabelKey;
  enabled: boolean;
  href: string;
  milestone: CampaignMilestone;
  /** Título del bloque "próximo objetivo" (`campaign.*`). */
  objectiveTitleKey: string;
  /** Si el título necesita el nombre de zona: clave `campaign.*` / location key. */
  locationNameKey?: string;
  progress?: { current: number; target: number };
  missingRequirements: CampaignRequirement[];
  recommendedLevel?: number;
  gymOrder?: number;
};

export type CampaignActionContext = {
  progress: CampaignProgressRow;
  earnedGymOrders: number[];
  teamMaxLevel: number;
  /** Capítulo activo (opcional: mejora progress del objetivo). */
  chapter?: Chapter | null;
  /** Nivel recomendado del gimnasio del milestone, si aplica. */
  gymRecommendedLevel?: number | null;
};

/**
 * Requisitos faltantes / cumplidos para desafiar un gimnasio (primera medalla).
 * La revancha (medalla ya obtenida) no aplica este gate.
 */
export function getGymChallengeRequirements(
  gymOrder: number,
  completedStageIds: readonly string[],
  teamMaxLevel: number,
  recommendedLevel?: number | null,
  regionId: string = "kanto",
): CampaignRequirement[] {
  const wild = chapterWildStagesForGym(gymOrder, regionId);
  const doneSet = new Set(completedStageIds);
  const stagesDone = wild.filter((s) => doneSet.has(s.id)).length;
  const stagesTotal = wild.length;
  const stagesComplete = stagesTotal === 0 || stagesDone >= stagesTotal;

  const reqs: CampaignRequirement[] = [
    {
      id: `gym-${gymOrder}-chapter-stages`,
      type: "complete_all_chapter_stages",
      targetId: `gym-order-${gymOrder}`,
      requiredAmount: stagesTotal,
      currentAmount: stagesDone,
      completed: stagesComplete,
      descriptionKey: "reqStagesDetail",
      descriptionParams: { done: stagesDone, total: stagesTotal },
    },
  ];

  if (recommendedLevel != null && recommendedLevel > 0) {
    reqs.push({
      id: `gym-${gymOrder}-team-level`,
      type: "reach_team_level",
      requiredAmount: recommendedLevel,
      currentAmount: teamMaxLevel,
      completed: teamMaxLevel >= recommendedLevel,
      descriptionKey: "reqLevel",
      descriptionParams: { level: recommendedLevel },
    });
  }

  return reqs;
}

export function canChallengeGym(
  gymOrder: number,
  completedStageIds: readonly string[],
  opts?: { hasBadge?: boolean; regionId?: string },
): boolean {
  if (opts?.hasBadge) return true;
  return areChapterStagesCompleteForGym(
    gymOrder,
    completedStageIds,
    opts?.regionId ?? "kanto",
  );
}

/**
 * CTA + próximo objetivo a partir del progreso real.
 * Soft-gate de nivel: aparece en requisitos pero no deshabilita el CTA
 * (misma política que `startGymRun` hoy).
 */
export function getCampaignPrimaryAction(ctx: CampaignActionContext): CampaignActionState {
  const milestone = nextMilestone(ctx.progress, ctx.earnedGymOrders);
  const href = milestoneHref(milestone);
  const baseLabel = milestoneCtaKey(milestone);

  if (milestone.kind === "complete") {
    return {
      action: "view_journey",
      labelKey: "viewJourney",
      enabled: true,
      href,
      milestone,
      objectiveTitleKey: "milestones.region_complete",
      missingRequirements: [],
    };
  }

  if (milestone.kind === "gym" && milestone.gymOrder != null) {
    const hasBadge = ctx.earnedGymOrders.includes(milestone.gymOrder);
    const reqs = getGymChallengeRequirements(
      milestone.gymOrder,
      ctx.progress.completedStageIds,
      ctx.teamMaxLevel,
      ctx.gymRecommendedLevel,
    );
    const stagesReq = reqs.find((r) => r.type === "complete_all_chapter_stages");
    const canFight = canChallengeGym(milestone.gymOrder, ctx.progress.completedStageIds, {
      hasBadge,
    });

    if (!canFight) {
      // Todavía faltan stages: el CTA lleva a explorar, no al gimnasio.
      return {
        action: "blocked",
        labelKey: "continueExpedition",
        enabled: true,
        href: "/battle",
        milestone,
        objectiveTitleKey: "objectiveClearChapterStages",
        locationNameKey: milestone.nameKey,
        progress:
          stagesReq && stagesReq.requiredAmount != null
            ? {
                current: stagesReq.currentAmount ?? 0,
                target: stagesReq.requiredAmount,
              }
            : undefined,
        missingRequirements: reqs,
        recommendedLevel: ctx.gymRecommendedLevel ?? undefined,
        gymOrder: milestone.gymOrder,
      };
    }

    return {
      action: "challenge_gym",
      labelKey: "challengeGym",
      enabled: true,
      href,
      milestone,
      objectiveTitleKey: "objectiveChallengeGym",
      locationNameKey: milestone.nameKey,
      progress: stagesReq
        ? {
            current: stagesReq.currentAmount ?? 0,
            target: stagesReq.requiredAmount ?? 0,
          }
        : undefined,
      missingRequirements: reqs,
      recommendedLevel: ctx.gymRecommendedLevel ?? undefined,
      gymOrder: milestone.gymOrder,
    };
  }

  // Milestone de stage / unlock de zona.
  const chapter = ctx.chapter;
  const progress =
    chapter && chapter.stagesTotal > 0
      ? { current: chapter.stagesDone, target: chapter.stagesTotal }
      : undefined;

  return {
    action: milestone.kind === "stage" ? "explore" : "continue",
    labelKey: baseLabel === "challengeGym" ? "continueExpedition" : baseLabel,
    enabled: true,
    href,
    milestone,
    objectiveTitleKey: "objectiveExploreStage",
    locationNameKey: milestone.nameKey,
    progress,
    missingRequirements: [],
  };
}

/** Estado de un nodo del path del capítulo. */
export function resolveZoneNodeStatus(opts: {
  zone: MapLocation;
  farmingLocationId: string;
  selectedZoneId: string | null;
  chapter: Chapter;
  badgeEarned: boolean;
}): CampaignNodeStatus {
  const { zone, farmingLocationId, selectedZoneId, chapter, badgeEarned } = opts;
  const isGym = zone.kindKey === "kinds.gym";

  if (!zone.unlocked) return "locked";

  if (isGym) {
    if (badgeEarned && chapter.stagesDone >= chapter.stagesTotal) return "completed";
    if (badgeEarned) return "reward_pending";
    if (zone.id === farmingLocationId || zone.id === selectedZoneId) {
      return chapter.stagesDone < chapter.stagesTotal ? "in_progress" : "current";
    }
    return chapter.stagesDone < chapter.stagesTotal ? "available" : "current";
  }

  const done = zone.totalStages > 0 && zone.completedStages >= zone.totalStages;
  if (done) return "completed";
  if (zone.id === farmingLocationId) return "in_progress";
  if (zone.id === selectedZoneId) return "current";
  if (zone.completedStages > 0) return "in_progress";
  return "available";
}

export function getMissingRequirements(reqs: CampaignRequirement[]): CampaignRequirement[] {
  return reqs.filter((r) => !r.completed);
}

/**
 * Por qué una zona está bloqueada — generado desde datos de campaña.
 * La UI traduce `descriptionKey` + params (sin copy hardcodeado en el componente).
 */
export function getZoneUnlockRequirements(
  locationId: string,
  progress: CampaignProgressRow,
): CampaignRequirement[] {
  if (isLocationUnlocked(locationId, progress)) return [];

  const regionId = resolveProgressRegionId(progress);
  const target =
    findLocation(locationId)?.location ??
    regionContent(regionId).locations.find((l) => l.id === locationId);
  if (!target) {
    return [
      {
        id: `unlock-${locationId}-unknown`,
        type: "visit_location",
        targetId: locationId,
        completed: false,
        descriptionKey: "zoneLocked",
      },
    ];
  }

  const unlockStage = allStages(target.regionId).find(
    (s) => s.unlocksLocationId === locationId,
  );
  if (unlockStage) {
    const from = findLocation(unlockStage.locationId)?.location;
    const done = progress.completedStageIds.includes(unlockStage.id);
    return [
      {
        id: `unlock-${locationId}-via-${unlockStage.id}`,
        type: "complete_stage",
        targetId: unlockStage.id,
        requiredAmount: 1,
        currentAmount: done ? 1 : 0,
        completed: done,
        descriptionKey: "reqCompleteStageAt",
        descriptionParams: {
          stage: unlockStage.nameKey,
          location: from?.nameKey ?? unlockStage.locationId,
        },
      },
    ];
  }

  const prior = regionContent(target.regionId)
    .locations.filter((l) => l.order < target.order)
    .sort((a, b) => b.order - a.order)[0];

  if (prior) {
    return [
      {
        id: `unlock-${locationId}-prior-${prior.id}`,
        type: "visit_location",
        targetId: prior.id,
        completed: isLocationUnlocked(prior.id, progress),
        descriptionKey: "reqReachLocation",
        descriptionParams: { location: prior.nameKey },
      },
    ];
  }

  return [
    {
      id: `unlock-${locationId}-generic`,
      type: "visit_location",
      targetId: locationId,
      completed: false,
      descriptionKey: "zoneLocked",
    },
  ];
}
