import { prisma } from "@/lib/prisma";
import { DAILY_CYCLE, nextDay, slotForDay, type DailyRewardVariant } from "./daily";
import { WEEKLY_CHALLENGE, weeklyPercent, type WeeklyObjectiveId } from "./weekly";
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

export type EventsSummary = {
  daily: DailyState;
  weekly: WeeklyState;
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
export async function loadEventsSummary(userId: string): Promise<EventsSummary> {
  const now = serverNow();
  const today = dayKey(now);
  const currentWeek = weekKey(now);
  const since = weekStart(now);

  const [dailyClaims, todayClaim, weeklyClaims, wins, catches, zoneObjectives] =
    await Promise.all([
      prisma.dailyRewardClaim.count({ where: { userId, cycleId: DAILY_CYCLE.id } }),
      prisma.dailyRewardClaim.findFirst({
        where: { userId, dayKey: today },
        select: { dayIndex: true },
      }),
      prisma.weeklyRewardClaim.findMany({
        where: { userId, weekKey: currentWeek },
        select: { milestone: true },
      }),
      prisma.battleLog.count({ where: { userId, userWon: true, createdAt: { gte: since } } }),
      prisma.pokemonInstance.count({ where: { ownerId: userId, caughtAt: { gte: since } } }),
      prisma.zoneObjectiveClaim.count({ where: { userId, claimedAt: { gte: since } } }),
      ]);

  // Días de login de la semana = días distintos con reclamo diario. Es el dato
  // más honesto que existe: no hay tabla de sesiones.
  const loginRows = await prisma.dailyRewardClaim.findMany({
    where: { userId, claimedAt: { gte: since } },
    select: { dayKey: true },
    distinct: ["dayKey"],
  });

  const claimedToday = todayClaim !== null;
  const currentDay = claimedToday
    ? todayClaim.dayIndex
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
    logins: loginRows.length,
    battles: wins,
    catches,
    zones: zoneObjectives,
  };
  const percent = weeklyPercent(WEEKLY_CHALLENGE, progress);
  const claimedMilestones = new Set(weeklyClaims.map((row) => row.milestone));

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

  return {
    daily,
    weekly,
    pendingCount:
      (daily.canClaim ? 1 : 0) + milestones.filter((milestone) => milestone.claimable).length,
  };
}

/** Solo el contador de pendientes — lo que necesita el badge del navbar. */
export async function countPendingRewards(userId: string): Promise<number> {
  const summary = await loadEventsSummary(userId);
  return summary.pendingCount;
}
