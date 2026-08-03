"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { DAILY_CYCLE, nextDay, slotForDay } from "@/lib/events/daily";
import { WEEKLY_CHALLENGE, weeklyPercent } from "@/lib/events/weekly";
import {
  activeLimitedEvent,
  isMissionComplete,
  missionById,
  type LimitedMetric,
} from "@/lib/events/limited";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import { dayKey, serverNow, weekKey, weekStart } from "@/lib/events/time";
import type { RewardDef } from "@/lib/events/rewards";
import type { WeeklyObjectiveId } from "@/lib/events/weekly";

export type ClaimRewardResult =
  | { ok: true; granted: RewardDef[]; coinsDelta: number; energyDelta: number }
  | {
      ok: false;
      error: "unauthorized" | "already_claimed" | "not_available" | "invalid";
    };

/** Postgres: violación de restricción única. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Reclama el regalo diario.
 *
 * El cliente no manda qué día ni qué recompensa: manda "quiero reclamar" y el
 * servidor resuelve la posición del ciclo y el contenido. Tres barreras contra
 * el doble reclamo, de afuera hacia adentro:
 *
 * 1. `lockUsers` serializa por jugador — dos pestañas se ordenan en fila.
 * 2. La lectura del reclamo de hoy ocurre **dentro** del lock, así que la
 *    segunda en entrar ya ve el de la primera.
 * 3. El índice único `[userId, dayKey]` es la red final: si algo se colara
 *    igual, la base lo rechaza y se traduce a `already_claimed`.
 *
 * La fecha sale de `serverNow()` en UTC; el reloj del navegador no participa.
 */
export async function claimDailyReward(locale: string): Promise<ClaimRewardResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const today = dayKey(serverNow());
  let outcome: ClaimRewardResult | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const claimedToday = await tx.dailyRewardClaim.findFirst({
        where: { userId, dayKey: today },
        select: { dayIndex: true },
      });
      if (claimedToday) {
        outcome = { ok: false, error: "already_claimed" };
        return;
      }

      const claimedCount = await tx.dailyRewardClaim.count({
        where: { userId, cycleId: DAILY_CYCLE.id },
      });
      const day = nextDay(DAILY_CYCLE, claimedCount);
      const slot = slotForDay(DAILY_CYCLE, day);
      if (!slot) {
        outcome = { ok: false, error: "invalid" };
        return;
      }

      await tx.dailyRewardClaim.create({
        data: { userId, cycleId: DAILY_CYCLE.id, dayIndex: day, dayKey: today },
      });

      const result = await grantRewards(tx, userId, slot.rewards);
      await writeLedger(tx, {
        userId,
        source: "daily",
        sourceRef: `${DAILY_CYCLE.id}:${day}`,
        result,
      });

      outcome = {
        ok: true,
        granted: result.granted,
        coinsDelta: result.coinsDelta,
        energyDelta: result.energyDelta,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "already_claimed" };
    throw error;
  }

  // TypeScript estrecha `outcome` a `never` porque solo se asigna dentro del
  // callback de la transacción y el control de flujo no lo sigue hasta acá.
  const settled = outcome as ClaimRewardResult | null;
  if (settled?.ok) {
    await prisma.notification.updateMany({
      where: { userId, type: "DAILY_REWARD_READY", readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath(`/${locale}/events`);
    revalidatePath(`/${locale}`, "layout");
  }
  return settled ?? { ok: false, error: "invalid" };
}

/**
 * Reclama un hito semanal.
 *
 * El porcentaje se recalcula en el servidor a partir de las mismas tablas que
 * alimentan la pantalla: el cliente manda qué hito quiere, nunca cuánto
 * progreso tiene. La PK `[userId, weekKey, milestone]` impide cobrarlo dos
 * veces, y la semana ISO en UTC hace que el reinicio no dependa de la región.
 */
export async function claimWeeklyMilestone(
  locale: string,
  milestone: number,
): Promise<ClaimRewardResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const target = WEEKLY_CHALLENGE.milestones.find((m) => m.percent === milestone);
  if (!target) return { ok: false, error: "invalid" };

  const now = serverNow();
  const week = weekKey(now);
  const since = weekStart(now);
  let outcome: ClaimRewardResult | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const existing = await tx.weeklyRewardClaim.findUnique({
        where: { userId_weekKey_milestone: { userId, weekKey: week, milestone } },
        select: { milestone: true },
      });
      if (existing) {
        outcome = { ok: false, error: "already_claimed" };
        return;
      }

      const [wins, catches, zones, shinies, gymWins, loginRows] = await Promise.all([
        tx.battleLog.count({ where: { userId, userWon: true, createdAt: { gte: since } } }),
        tx.pokemonInstance.count({ where: { ownerId: userId, caughtAt: { gte: since } } }),
        tx.zoneObjectiveClaim.count({ where: { userId, claimedAt: { gte: since } } }),
        tx.pokemonInstance.count({
          where: { ownerId: userId, isShiny: true, caughtAt: { gte: since } },
        }),
        tx.gymAttempt.count({
          where: { userId, won: true, attemptedAt: { gte: since } },
        }),
        tx.dailyRewardClaim.findMany({
          where: { userId, claimedAt: { gte: since } },
          select: { dayKey: true },
          distinct: ["dayKey"],
        }),
      ]);

      const progress: Record<WeeklyObjectiveId, number> = {
        logins: loginRows.length,
        battles: wins,
        catches,
        zones,
        shinies,
        gyms: gymWins,
      };
      if (weeklyPercent(WEEKLY_CHALLENGE, progress) < milestone) {
        outcome = { ok: false, error: "not_available" };
        return;
      }

      await tx.weeklyRewardClaim.create({ data: { userId, weekKey: week, milestone } });

      const result = await grantRewards(tx, userId, target.rewards);
      await writeLedger(tx, {
        userId,
        source: "weekly",
        sourceRef: `${week}:${milestone}`,
        result,
      });

      outcome = {
        ok: true,
        granted: result.granted,
        coinsDelta: result.coinsDelta,
        energyDelta: result.energyDelta,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "already_claimed" };
    throw error;
  }

  // TypeScript estrecha `outcome` a `never` porque solo se asigna dentro del
  // callback de la transacción y el control de flujo no lo sigue hasta acá.
  const settled = outcome as ClaimRewardResult | null;
  if (settled?.ok) {
    revalidatePath(`/${locale}/events`);
    revalidatePath(`/${locale}`, "layout");
  }
  return settled ?? { ok: false, error: "invalid" };
}

/**
 * Reclama una misión del evento por tiempo limitado.
 *
 * El cliente manda el id de la misión, nunca el evento ni el progreso: el
 * servidor resuelve cuál es la edición vigente con su propio reloj. Si la
 * semana cambió entre que se pintó la pantalla y el jugador tocó el botón, el
 * `eventCode` ya es otro y el reclamo no encuentra la misión completa — que es
 * el comportamiento correcto para algo que caduca.
 */
export async function claimEventMission(
  locale: string,
  missionId: string,
): Promise<ClaimRewardResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const now = serverNow();
  const event = activeLimitedEvent(now);
  const mission = missionById(event.def, missionId);
  if (!mission) return { ok: false, error: "invalid" };

  const since = event.startsAt;
  let missionOutcome: ClaimRewardResult | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const existing = await tx.eventMissionClaim.findUnique({
        where: {
          userId_eventCode_missionId: { userId, eventCode: event.code, missionId },
        },
        select: { missionId: true },
      });
      if (existing) {
        missionOutcome = { ok: false, error: "already_claimed" };
        return;
      }

      const [wins, catches, shinies, zones] = await Promise.all([
        tx.battleLog.count({ where: { userId, userWon: true, createdAt: { gte: since } } }),
        tx.pokemonInstance.count({ where: { ownerId: userId, caughtAt: { gte: since } } }),
        tx.pokemonInstance.count({
          where: { ownerId: userId, isShiny: true, caughtAt: { gte: since } },
        }),
        tx.zoneObjectiveClaim.count({ where: { userId, claimedAt: { gte: since } } }),
      ]);

      const metrics: Record<LimitedMetric, number> = {
        battles: wins,
        catches,
        shinies,
        zones,
      };
      if (!isMissionComplete(mission, metrics[mission.metric])) {
        missionOutcome = { ok: false, error: "not_available" };
        return;
      }

      await tx.eventMissionClaim.create({
        data: { userId, eventCode: event.code, missionId },
      });

      const result = await grantRewards(tx, userId, mission.rewards);
      await writeLedger(tx, {
        userId,
        source: "event_mission",
        sourceRef: `${event.code}:${missionId}`,
        result,
      });

      missionOutcome = {
        ok: true,
        granted: result.granted,
        coinsDelta: result.coinsDelta,
        energyDelta: result.energyDelta,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "already_claimed" };
    throw error;
  }

  const settledMission = missionOutcome as ClaimRewardResult | null;
  if (settledMission?.ok) {
    revalidatePath(`/${locale}/events`);
    revalidatePath(`/${locale}`, "layout");
  }
  return settledMission ?? { ok: false, error: "invalid" };
}
