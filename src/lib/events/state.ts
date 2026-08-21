import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DAILY_CYCLE, nextDay, slotForDay, type DailyRewardVariant } from "./daily";
import { WEEKLY_CHALLENGE, weeklyPercent, type WeeklyObjectiveId } from "./weekly";
import { activeLimitedEvent, isMissionComplete, missionProgress } from "./limited";
import type { LimitedMetric } from "./limited";
import { dayKey, nextDailyReset, nextWeeklyReset, serverNow, weekKey, weekStart } from "./time";
import type { RewardBundle } from "./rewards";

export type DailyDayState = {
  day: number;
  rewards: RewardBundle;
  variant: DailyRewardVariant;
  status: "claimed" | "today" | "upcoming";
};

export type DailyState = {
  cycleId: string;
  length: number;
  /** Posición que toca reclamar ahora. */
  currentDay: number;
  claimedCount: number;
  canClaim: boolean;
  /** ISO. El cliente lo usa para la cuenta regresiva, no para decidir. */
  nextResetAt: string;
  days: DailyDayState[];
};

export type WeeklyObjectiveState = {
  id: WeeklyObjectiveId;
  current: number;
  target: number;
  href: string | null;
};

export type WeeklyMilestoneState = {
  percent: number;
  rewards: RewardBundle;
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
};

export type WeeklyState = {
  weekKey: string;
  percent: number;
  objectives: WeeklyObjectiveState[];
  milestones: WeeklyMilestoneState[];
  nextResetAt: string;
};

export type LimitedMissionState = {
  id: string;
  metric: LimitedMetric;
  current: number;
  target: number;
  rewards: RewardBundle;
  href: string | null;
  claimed: boolean;
  claimable: boolean;
};

export type LimitedEventState = {
  /** `<id>@<semana>` — lo que el cliente manda al reclamar. */
  code: string;
  nameKey: string;
  taglineKey: string;
  /** Nombre canónico de ítem para el PNG HD del encabezado. */
  iconItem: string;
  accent: string;
  /** ISO. El cliente lo usa para la cuenta regresiva, no para decidir. */
  endsAt: string;
  missions: LimitedMissionState[];
};

export type EventsSummary = {
  daily: DailyState;
  weekly: WeeklyState;
  limited: LimitedEventState;
  /** Acciones reclamables ahora — alimenta el badge de navegación. */
  pendingCount: number;
};

/**
 * Estado completo de recompensas de un jugador, en una sola pasada.
 *
 * Todas las consultas van en paralelo y agregadas: el brief pedía no consultar
 * el progreso de cada evento por separado, y además el badge de navegación
 * necesita este mismo cálculo en cada render del layout.
 */
async function buildEventsSummary(userId: string): Promise<EventsSummary> {
  const now = serverNow();
  const today = dayKey(now);
  const currentWeek = weekKey(now);
  const since = weekStart(now);

  // El evento limitado corre exactamente la semana de juego (`activeLimitedEvent`
  // deriva su ventana de `weekStart`/`nextWeeklyReset`), así que comparte el
  // mismo `since` que el desafío semanal en vez de repetir tres conteos.
  const limited = activeLimitedEvent(now);

  type MetricsRow = {
    dailyClaims: bigint;
    todayDayIndex: number | null;
    weeklyMilestones: number[];
    wins: bigint;
    catches: bigint;
    shinies: bigint;
    zoneObjectives: bigint;
    gymWins: bigint;
    limitedMissionIds: string[];
    loginDays: bigint;
  };

  /*
   * Antes eran diez viajes independientes a Supabase. Aunque salieran en
   * paralelo, cada uno ocupaba un slot del pool y multiplicaba la latencia del
   * header/home. PostgreSQL puede calcular todos los escalares y arrays en una
   * sola sentencia; los valores siguen parametrizados por Prisma.
   */
  const [metrics] = await prisma.$queryRaw<MetricsRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "DailyRewardClaim"
        WHERE "userId" = ${userId} AND "cycleId" = ${DAILY_CYCLE.id}) AS "dailyClaims",
      (SELECT MAX("dayIndex") FROM "DailyRewardClaim"
        WHERE "userId" = ${userId} AND "dayKey" = ${today}) AS "todayDayIndex",
      COALESCE((SELECT ARRAY_AGG("milestone" ORDER BY "milestone") FROM "WeeklyRewardClaim"
        WHERE "userId" = ${userId} AND "weekKey" = ${currentWeek}), ARRAY[]::INTEGER[]) AS "weeklyMilestones",
      (SELECT COUNT(*) FROM "BattleLog"
        WHERE "userId" = ${userId} AND "userWon" = TRUE AND "createdAt" >= ${since}) AS "wins",
      (SELECT COUNT(*) FROM "PokemonInstance"
        WHERE "ownerId" = ${userId} AND "caughtAt" >= ${since}) AS "catches",
      (SELECT COUNT(*) FROM "PokemonInstance"
        WHERE "ownerId" = ${userId} AND "isShiny" = TRUE AND "caughtAt" >= ${since}) AS "shinies",
      (SELECT COUNT(*) FROM "ZoneObjectiveClaim"
        WHERE "userId" = ${userId} AND "claimedAt" >= ${since}) AS "zoneObjectives",
      (SELECT COUNT(*) FROM "GymAttempt"
        WHERE "userId" = ${userId} AND "won" = TRUE AND "attemptedAt" >= ${since}) AS "gymWins",
      COALESCE((SELECT ARRAY_AGG("missionId") FROM "EventMissionClaim"
        WHERE "userId" = ${userId} AND "eventCode" = ${limited.code}), ARRAY[]::TEXT[]) AS "limitedMissionIds",
      (SELECT COUNT(DISTINCT "dayKey") FROM "DailyRewardClaim"
        WHERE "userId" = ${userId} AND "claimedAt" >= ${since}) AS "loginDays"
  `;

  if (!metrics) throw new Error("events_metrics_unavailable");

  const dailyClaims = Number(metrics.dailyClaims);
  const wins = Number(metrics.wins);
  const catches = Number(metrics.catches);
  const shinies = Number(metrics.shinies);
  const zoneObjectives = Number(metrics.zoneObjectives);
  const gymWins = Number(metrics.gymWins);
  const claimedToday = metrics.todayDayIndex !== null;
  const currentDay = claimedToday
    ? metrics.todayDayIndex!
    : nextDay(DAILY_CYCLE, dailyClaims);

  const days: DailyDayState[] = DAILY_CYCLE.slots.map((slot) => {
    // Con política acumulativa, "reclamado" es toda posición por debajo de la
    // cantidad de reclamos del ciclo actual.
    const positionInCycle = dailyClaims % DAILY_CYCLE.length;
    const claimed = slot.day <= positionInCycle;
    return {
      day: slot.day,
      rewards: slot.rewards,
      variant: slot.variant,
      status: claimed ? "claimed" : slot.day === currentDay && !claimedToday ? "today" : "upcoming",
    };
  });

  const progress: Record<WeeklyObjectiveId, number> = {
    logins: Number(metrics.loginDays),
    battles: wins,
    catches,
    zones: zoneObjectives,
    shinies,
    gyms: gymWins,
  };
  const percent = weeklyPercent(WEEKLY_CHALLENGE, progress);
  const claimedMilestones = new Set(metrics.weeklyMilestones);

  const milestones: WeeklyMilestoneState[] = WEEKLY_CHALLENGE.milestones.map((milestone) => {
    const unlocked = percent >= milestone.percent;
    const claimed = claimedMilestones.has(milestone.percent);
    return {
      percent: milestone.percent,
      rewards: milestone.rewards,
      unlocked,
      claimed,
      claimable: unlocked && !claimed,
    };
  });

  const daily: DailyState = {
    cycleId: DAILY_CYCLE.id,
    length: DAILY_CYCLE.length,
    currentDay,
    claimedCount: dailyClaims,
    canClaim: !claimedToday && slotForDay(DAILY_CYCLE, currentDay) !== null,
    nextResetAt: nextDailyReset(now).toISOString(),
    days,
  };

  const weekly: WeeklyState = {
    weekKey: currentWeek,
    percent,
    objectives: WEEKLY_CHALLENGE.objectives.map((objective) => ({
      id: objective.id,
      current: progress[objective.id],
      target: objective.target,
      href: objective.href,
    })),
    milestones,
    nextResetAt: nextWeeklyReset(now).toISOString(),
  };

  const limitedMetrics: Record<LimitedMetric, number> = {
    battles: wins,
    catches,
    shinies,
    zones: zoneObjectives,
  };
  const claimedMissionIds = new Set(metrics.limitedMissionIds);

  const limitedState: LimitedEventState = {
    code: limited.code,
    nameKey: limited.def.nameKey,
    taglineKey: limited.def.taglineKey,
    iconItem: limited.def.iconItem,
    accent: limited.def.accent,
    endsAt: limited.endsAt.toISOString(),
    missions: limited.def.missions.map((mission) => {
      const raw = limitedMetrics[mission.metric];
      const claimed = claimedMissionIds.has(mission.id);
      return {
        id: mission.id,
        metric: mission.metric,
        current: missionProgress(mission, raw),
        target: mission.target,
        rewards: mission.rewards,
        href: mission.href,
        claimed,
        claimable: isMissionComplete(mission, raw) && !claimed,
      };
    }),
  };

  return {
    daily,
    weekly,
    limited: limitedState,
    pendingCount:
      (daily.canClaim ? 1 : 0) +
      milestones.filter((milestone) => milestone.claimable).length +
      limitedState.missions.filter((mission) => mission.claimable).length,
  };
}

/**
 * Header y página principal consumen exactamente el mismo resumen. Memoizarlo
 * por request evita repetir la consulta consolidada cuando ambos se renderizan
 * en el mismo árbol, sin dejar progreso personal persistido entre requests.
 */
export const loadEventsSummary = cache(buildEventsSummary);

/** Solo el contador de pendientes — lo que necesita el badge del navbar. */
export async function countPendingRewards(userId: string): Promise<number> {
  const summary = await loadEventsSummary(userId);
  return summary.pendingCount;
}
