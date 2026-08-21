import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { COMBAT_TOWER_CONFIG } from "./config";
import { abandonTowerRunInTx } from "./settle";
import { currentTowerPeriodStart, towerPeriodKey } from "./week";

const ACTIVE_STATUSES = ["ACTIVE", "AWAITING_BLESSING", "RESTING"] as const;

export type TowerAttemptState = {
  periodKey: string;
  periodStart: Date;
  attemptsMax: number;
  attemptsUsed: number;
  attemptsRemaining: number;
};

type PeriodRunRow = {
  id: string;
  status: string;
  startedAt: Date;
  currentFloor: number;
  attemptsConsumed: number;
};

/**
 * Intentos del período semanal.
 *
 * No alcanza con `TowerAttemptDay`: al migrar de dayKey UTC → periodKey
 * semanal un jugador podía gastar el intento en `2026-07-30` y arrancar otro
 * bajo `2026-07-26`. Se toma el máximo entre el contador y la cantidad de
 * ascensos del período que ya consumieron intento.
 */
export async function getTowerAttemptState(
  userId: string,
  at: Date = new Date(),
): Promise<TowerAttemptState & { periodRuns: PeriodRunRow[] }> {
  const periodKey = towerPeriodKey(at);
  const periodStart = currentTowerPeriodStart(at);
  const attemptsMax = COMBAT_TOWER_CONFIG.rules.dailyAttempts;

  const [day, periodRuns] = await Promise.all([
    prisma.towerAttemptDay.findUnique({
      where: { userId_dayKey: { userId, dayKey: periodKey } },
    }),
    prisma.towerRun.findMany({
      where: {
        userId,
        startedAt: { gte: periodStart },
        attemptsConsumed: { gt: 0 },
      },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        currentFloor: true,
        attemptsConsumed: true,
      },
    }),
  ]);

  const attemptsUsed = Math.min(
    attemptsMax,
    Math.max(day?.attemptsUsed ?? 0, periodRuns.length),
  );

  return {
    periodKey,
    periodStart,
    attemptsMax,
    attemptsUsed,
    attemptsRemaining: Math.max(0, attemptsMax - attemptsUsed),
    periodRuns,
  };
}

/**
 * Cierra ascensos ACTIVE de más cuando el período ya gastó su cupo
 * (p. ej. segundo run por dayKey viejo). Deja vivos solo los primeros
 * `attemptsMax` por `startedAt`.
 */
export async function reconcileTowerPeriodAttempts(
  userId: string,
  at: Date = new Date(),
): Promise<TowerAttemptState> {
  const state = await getTowerAttemptState(userId, at);
  const extras = state.periodRuns
    .slice(state.attemptsMax)
    .filter((r) => (ACTIVE_STATUSES as readonly string[]).includes(r.status));

  if (extras.length > 0) {
    await prisma.$transaction(
      async (tx) => {
        for (const run of extras) {
          await abandonTowerRunInTx(tx, run.id, userId);
        }
        await syncAttemptDayInTx(tx, userId, state.periodKey, state.attemptsMax);
      },
      { timeout: 20_000 },
    );
    const next = await getTowerAttemptState(userId, at);
    return {
      periodKey: next.periodKey,
      periodStart: next.periodStart,
      attemptsMax: next.attemptsMax,
      attemptsUsed: next.attemptsUsed,
      attemptsRemaining: next.attemptsRemaining,
    };
  }

  await prisma.towerAttemptDay.upsert({
    where: { userId_dayKey: { userId, dayKey: state.periodKey } },
    create: {
      userId,
      dayKey: state.periodKey,
      attemptsUsed: state.attemptsUsed,
    },
    update: {
      attemptsUsed: Math.max(state.attemptsUsed, 0),
    },
  });

  return {
    periodKey: state.periodKey,
    periodStart: state.periodStart,
    attemptsMax: state.attemptsMax,
    attemptsUsed: state.attemptsUsed,
    attemptsRemaining: state.attemptsRemaining,
  };
}

async function syncAttemptDayInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  periodKey: string,
  attemptsUsed: number,
) {
  await tx.towerAttemptDay.upsert({
    where: { userId_dayKey: { userId, dayKey: periodKey } },
    create: { userId, dayKey: periodKey, attemptsUsed },
    update: { attemptsUsed },
  });
}

/** Consume un intento del período actual; lanza si ya no quedan. */
export async function consumeTowerAttemptInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  at: Date = new Date(),
): Promise<{ periodKey: string }> {
  const periodKey = towerPeriodKey(at);
  const periodStart = currentTowerPeriodStart(at);
  const attemptsMax = COMBAT_TOWER_CONFIG.rules.dailyAttempts;

  const periodRuns = await tx.towerRun.count({
    where: {
      userId,
      startedAt: { gte: periodStart },
      attemptsConsumed: { gt: 0 },
    },
  });
  if (periodRuns >= attemptsMax) {
    throw new Error("NO_ATTEMPTS");
  }

  const day = await tx.towerAttemptDay.upsert({
    where: { userId_dayKey: { userId, dayKey: periodKey } },
    create: { userId, dayKey: periodKey, attemptsUsed: 0 },
    update: {},
  });
  if (day.attemptsUsed >= attemptsMax || periodRuns >= attemptsMax) {
    throw new Error("NO_ATTEMPTS");
  }

  await tx.towerAttemptDay.update({
    where: { id: day.id },
    data: { attemptsUsed: { increment: 1 } },
  });

  return { periodKey };
}
