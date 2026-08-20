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
import { isZoneStoryCleared } from "./objectives";
import { trainersForLocation } from "./trainers";
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
  | "own_ready_pokemon"
  | "own_previous_badge"
  | "complete_stage"
  | "defeat_trainers"
  | "visit_location";

/** Cuántos Pokémon del equipo deben llegar al nivel de preparación del gym. */
export const GYM_READY_TEAM_SIZE = 2;

/** Nivel pedido por Pokémon listo: recommendedLevel − 2 (mín. 1). */
export function gymReadyLevel(recommendedLevel: number): number {
  return Math.max(1, recommendedLevel - 2);
}

export function countTeamReadyAtLevel(
  teamLevels: readonly number[],
  readyLevel: number,
): number {
  return teamLevels.filter((level) => level >= readyLevel).length;
}

export type CampaignPrimaryActionKind =
  | "explore"
  | "continue"
  | "challenge_gym"
  | "view_journey"
  | "blocked"
  /** Viajar a una zona (cambia farming); el CTA usa onClick, no href. */
  | "travel";

export type CampaignActionLabelKey =
  | "challengeGym"
  /** Mismo destino que `challengeGym`, distinto texto: nodos del Alto Mando. */
  | "challengeElite"
  | "continueExpedition"
  | "viewJourney"
  | "exploreLocation"
  | "startExploring";

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
  /** Pokémon del equipo en o por encima del nivel de preparación del gym. */
  teamReadyCount?: number;
  /** Capítulo activo (opcional: mejora progress del objetivo). */
  chapter?: Chapter | null;
  /** Nivel recomendado del gimnasio del milestone, si aplica. */
  gymRecommendedLevel?: number | null;
  /** Entrenadores de ruta ya vencidos — sin esto el CTA no espera por ellos. */
  defeatedTrainerIds?: readonly string[];
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
  teamReadyCount: number = 0,
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
    const readyLevel = gymReadyLevel(recommendedLevel);
    reqs.push({
      id: `gym-${gymOrder}-team-level`,
      type: "reach_team_level",
      requiredAmount: recommendedLevel,
      currentAmount: teamMaxLevel,
      completed: teamMaxLevel >= recommendedLevel,
      descriptionKey: "reqLevel",
      descriptionParams: { level: recommendedLevel },
    });
    reqs.push({
      id: `gym-${gymOrder}-ready-team`,
      type: "own_ready_pokemon",
      requiredAmount: GYM_READY_TEAM_SIZE,
      currentAmount: teamReadyCount,
      completed: teamReadyCount >= GYM_READY_TEAM_SIZE,
      descriptionKey: "reqTeamReady",
      descriptionParams: { count: GYM_READY_TEAM_SIZE, level: readyLevel },
    });
  }

  return reqs;
}

export function canChallengeGym(
  gymOrder: number,
  completedStageIds: readonly string[],
  opts?: {
    hasBadge?: boolean;
    regionId?: string;
    teamMaxLevel?: number;
    teamReadyCount?: number;
    recommendedLevel?: number | null;
  },
): boolean {
  if (opts?.hasBadge) return true;
  if (
    !areChapterStagesCompleteForGym(
      gymOrder,
      completedStageIds,
      opts?.regionId ?? "kanto",
    )
  ) {
    return false;
  }

  const rec = opts?.recommendedLevel;
  if (rec != null && rec > 0) {
    if ((opts?.teamMaxLevel ?? 0) < rec) return false;
    if ((opts?.teamReadyCount ?? 0) < GYM_READY_TEAM_SIZE) return false;
  }
  return true;
}

/**
 * CTA + próximo objetivo a partir del progreso real.
 * Nivel y equipo listo son hard-gate (igual que los stages del capítulo).
 */
export function getCampaignPrimaryAction(ctx: CampaignActionContext): CampaignActionState {
  const milestone = nextMilestone(
    ctx.progress,
    ctx.earnedGymOrders,
    ctx.defeatedTrainerIds,
  );
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
    const regionId = ctx.progress.currentRegionId;
    const reqs = getGymChallengeRequirements(
      milestone.gymOrder,
      ctx.progress.completedStageIds,
      ctx.teamMaxLevel,
      ctx.gymRecommendedLevel,
      regionId,
      ctx.teamReadyCount ?? 0,
    );
    const stagesReq = reqs.find((r) => r.type === "complete_all_chapter_stages");
    const canFight = canChallengeGym(milestone.gymOrder, ctx.progress.completedStageIds, {
      hasBadge,
      regionId,
      teamMaxLevel: ctx.teamMaxLevel,
      teamReadyCount: ctx.teamReadyCount ?? 0,
      recommendedLevel: ctx.gymRecommendedLevel,
    });

    if (!canFight) {
      const missing = reqs.filter((r) => !r.completed);
      const onlyPrep =
        stagesReq?.completed &&
        missing.every((r) => r.type === "reach_team_level" || r.type === "own_ready_pokemon");
      // Faltan stages o nivel: el CTA lleva a explorar, no al gimnasio.
      return {
        action: "blocked",
        labelKey: "continueExpedition",
        enabled: true,
        href: "/battle",
        milestone,
        objectiveTitleKey: onlyPrep
          ? "objectivePrepForGym"
          : "objectiveClearChapterStages",
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

/**
 * CTA de la barra cuando el jugador eligió un nodo del recorrido.
 * No reemplaza el milestone de historia: sólo contextualiza el botón.
 */
export function getCampaignActionForZone(opts: {
  zone: MapLocation;
  farmingLocationId: string;
  progress: CampaignProgressRow;
  earnedGymOrders: number[];
  teamMaxLevel: number;
  teamReadyCount?: number;
  chapter: Chapter;
  /** Milestone de historia (se reusa en el shape; la UI contextualiza título/CTA). */
  storyMilestone: CampaignMilestone;
  gymRecommendedLevel?: number | null;
  /** `/gyms/{id}` cuando el nodo es el gimnasio del capítulo. */
  gymHref?: string | null;
  defeatedTrainerIds?: readonly string[];
}): CampaignActionState {
  const {
    zone,
    farmingLocationId,
    progress,
    earnedGymOrders,
    teamMaxLevel,
    teamReadyCount = 0,
    chapter,
    storyMilestone,
    gymRecommendedLevel,
    gymHref,
    defeatedTrainerIds,
  } = opts;
  const milestone = storyMilestone;
  const isGym = zone.kindKey === "kinds.gym";

  if (!zone.unlocked) {
    return {
      action: "blocked",
      labelKey: "continueExpedition",
      enabled: false,
      href: "/battle",
      milestone,
      objectiveTitleKey: "objectiveExploreStage",
      locationNameKey: zone.nameKey,
      missingRequirements: getZoneUnlockRequirements(
        zone.id,
        progress,
        defeatedTrainerIds,
      ),
    };
  }

  if (isGym) {
    const gymOrder = chapter.gymOrder ?? zone.gymOrder;
    if (gymOrder == null) {
      return {
        action: "blocked",
        labelKey: "continueExpedition",
        enabled: false,
        href: "/battle",
        milestone,
        objectiveTitleKey: "objectiveChallengeGym",
        locationNameKey: zone.nameKey,
        missingRequirements: [],
      };
    }

    const hasBadge = earnedGymOrders.includes(gymOrder);
    const reqs = getGymChallengeRequirements(
      gymOrder,
      progress.completedStageIds,
      teamMaxLevel,
      gymRecommendedLevel,
      progress.currentRegionId,
      teamReadyCount,
    );
    const stagesReq = reqs.find((r) => r.type === "complete_all_chapter_stages");
    const canFight = canChallengeGym(gymOrder, progress.completedStageIds, {
      hasBadge,
      regionId: progress.currentRegionId,
      teamMaxLevel,
      teamReadyCount,
      recommendedLevel: gymRecommendedLevel,
    });

    if (!canFight) {
      const missing = reqs.filter((r) => !r.completed);
      const onlyPrep =
        stagesReq?.completed &&
        missing.every((r) => r.type === "reach_team_level" || r.type === "own_ready_pokemon");
      return {
        action: "blocked",
        labelKey: "continueExpedition",
        enabled: true,
        href: "/battle",
        milestone,
        objectiveTitleKey: onlyPrep
          ? "objectivePrepForGym"
          : "objectiveClearChapterStages",
        locationNameKey: zone.nameKey,
        progress:
          stagesReq && stagesReq.requiredAmount != null
            ? {
                current: stagesReq.currentAmount ?? 0,
                target: stagesReq.requiredAmount,
              }
            : undefined,
        missingRequirements: reqs,
        recommendedLevel: gymRecommendedLevel ?? undefined,
        gymOrder,
      };
    }

    return {
      action: "challenge_gym",
      labelKey: "challengeGym",
      enabled: true,
      href: gymHref ?? milestoneHref(milestone),
      milestone,
      objectiveTitleKey: "objectiveChallengeGym",
      locationNameKey: zone.nameKey,
      progress: stagesReq
        ? {
            current: stagesReq.currentAmount ?? 0,
            target: stagesReq.requiredAmount ?? 0,
          }
        : undefined,
      missingRequirements: reqs,
      recommendedLevel: gymRecommendedLevel ?? undefined,
      gymOrder,
    };
  }

  // Ruta / ciudad / bosque…
  const progressBar =
    chapter.stagesTotal > 0
      ? { current: chapter.stagesDone, target: chapter.stagesTotal }
      : zone.totalStages > 0
        ? { current: zone.completedStages, target: zone.totalStages }
        : undefined;

  if (zone.id === farmingLocationId) {
    return {
      action: "explore",
      labelKey: "continueExpedition",
      enabled: true,
      href: "/battle",
      milestone,
      objectiveTitleKey: "objectiveExploreStage",
      locationNameKey: zone.nameKey,
      progress: progressBar,
      missingRequirements: [],
    };
  }

  return {
    action: "travel",
    labelKey: "startExploring",
    enabled: true,
    href: "/battle",
    milestone,
    objectiveTitleKey: "objectiveExploreStage",
    locationNameKey: zone.nameKey,
    progress: progressBar,
    missingRequirements: [],
  };
}

/**
 * El único nodo del capítulo que el jugador debería tocar ahora.
 *
 * El recorrido dibuja hasta ~7 cards y todas se ven igual de accionables, así
 * que sin esto un jugador nuevo no tiene de dónde deducir el orden. Reglas, en
 * orden de prioridad:
 *
 * 1. La zona donde ya está parado, si todavía le quedan stages.
 * 2. La primera zona desbloqueada sin terminar, en el orden del capítulo.
 * 3. El gimnasio, cuando no queda ninguna zona salvaje pendiente.
 * 4. El destino de la historia, aunque siga bloqueado: si no queda nada
 *    jugable en el capítulo el jugador está trabado, y tocar ese nodo es lo
 *    que le muestra qué le falta para abrirlo.
 *
 * `null` = capítulo terminado: no hay nada que señalar.
 */
export function recommendedChapterZoneId(opts: {
  chapter: Chapter;
  farmingLocationId: string;
  earnedGymOrders: number[];
  /** `milestone.locationId` del hito de historia vigente. */
  milestoneLocationId?: string | null;
}): string | null {
  const { chapter, farmingLocationId, earnedGymOrders, milestoneLocationId } = opts;

  const pending = chapter.zones.filter(
    (z) => z.kindKey !== "kinds.gym" && z.unlocked && !isZoneStoryCleared(z),
  );

  if (pending.some((z) => z.id === farmingLocationId)) return farmingLocationId;
  if (pending.length > 0) return pending[0].id;

  const gym = chapter.gym;
  const badgeWon = chapter.gymOrder != null && earnedGymOrders.includes(chapter.gymOrder);
  if (gym?.unlocked && !badgeWon) return gym.id;

  if (
    !badgeWon &&
    milestoneLocationId &&
    chapter.zones.some((z) => z.id === milestoneLocationId)
  ) {
    return milestoneLocationId;
  }

  return null;
}

/**
 * Zona que el panel y el path deben enfocar al abrir un capítulo.
 *
 * `recommendedChapterZoneId` puede ser `null` (capítulo cerrado). El panel
 * igual tiene que mostrar algo, y no puede ser `zones[0]` si esa parada ya
 * está hecha: eso era abrir Alto Mando y ver Calle Victoria.
 */
export function defaultChapterZoneId(opts: {
  chapter: Chapter;
  farmingLocationId: string;
  earnedGymOrders: number[];
  milestoneLocationId?: string | null;
}): string | null {
  const rec = recommendedChapterZoneId(opts);
  if (rec) return rec;
  const standing = opts.chapter.zones.find((z) => z.id === opts.farmingLocationId);
  if (standing) return standing.id;
  const unlocked = opts.chapter.zones.filter((z) => z.unlocked);
  return unlocked.at(-1)?.id ?? opts.chapter.zones[0]?.id ?? null;
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

  const done = isZoneStoryCleared(zone);
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
  defeatedTrainerIds: readonly string[] = [],
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
    const reqs: CampaignRequirement[] = [
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

    const routeTrainers = trainersForLocation(unlockStage.locationId);
    if (routeTrainers.length > 0) {
      const beaten = routeTrainers.filter((t) =>
        defeatedTrainerIds.includes(t.id),
      ).length;
      reqs.push({
        id: `unlock-${locationId}-trainers-${unlockStage.locationId}`,
        type: "defeat_trainers",
        targetId: unlockStage.locationId,
        requiredAmount: routeTrainers.length,
        currentAmount: beaten,
        completed: beaten >= routeTrainers.length,
        descriptionKey: "reqDefeatTrainersAt",
        descriptionParams: {
          location: from?.nameKey ?? unlockStage.locationId,
        },
      });
    }

    return reqs;
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
