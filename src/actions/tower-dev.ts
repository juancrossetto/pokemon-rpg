"use server";

import { redirect } from "@/i18n/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  COMBAT_TOWER_CONFIG,
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_TOWER_ID,
  buildTowerTeamSnapshot,
  TOWER_TEAM_INCLUDE,
  primeTeamForTowerRun,
  towerTeamSnapshotJson,
} from "@/lib/tower";
import { towerPeriodKey } from "@/lib/tower/week";
import { currentSeasonKey } from "@/lib/pvp/seasons";

function assertDev() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Tower dev actions only in development");
  }
}

export async function devTowerUnlock(locale: string) {
  assertDev();
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  const gyms = await prisma.gym.findMany({
    orderBy: { order: "asc" },
    take: COMBAT_TOWER_CONFIG.unlock.minBadges,
    select: { id: true },
  });
  for (const g of gyms) {
    await prisma.badge.upsert({
      where: { userId_gymId: { userId, gymId: g.id } },
      create: { userId, gymId: g.id },
      update: {},
    });
  }
  revalidatePath(`/${locale}/tower`);
  redirect({ href: "/tower", locale });
}

export async function devTowerResetAttempts(locale: string) {
  assertDev();
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;
  const periodKey = towerPeriodKey();
  const { currentTowerPeriodStart } = await import("@/lib/tower/week");
  const periodStart = currentTowerPeriodStart();

  await prisma.$transaction([
    prisma.towerAttemptDay.upsert({
      where: { userId_dayKey: { userId, dayKey: periodKey } },
      create: { userId, dayKey: periodKey, attemptsUsed: 0 },
      update: { attemptsUsed: 0 },
    }),
    // Para que el contador por runs no bloquee el reset de dev.
    prisma.towerRun.updateMany({
      where: { userId, startedAt: { gte: periodStart } },
      data: { attemptsConsumed: 0 },
    }),
  ]);
  revalidatePath(`/${locale}/tower`);
  redirect({ href: "/tower", locale });
}

export async function devTowerSetFloor(floor: number, locale: string) {
  assertDev();
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;
  const clamped = Math.max(1, Math.min(COMBAT_TOWER_CONFIG.totalFloors, floor));

  const teamRows = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    include: TOWER_TEAM_INCLUDE,
    orderBy: { teamSlot: "asc" },
  });
  if (teamRows.length === 0) {
    redirect({ href: "/tower?err=no_team", locale });
    return;
  }
  const snapshot = buildTowerTeamSnapshot(teamRows);

  await prisma.$transaction(
    async (tx) => {
      await tx.towerRun.updateMany({
        where: {
          userId,
          status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] },
        },
        data: { status: "ABANDONED", endedAt: new Date() },
      });
      await tx.towerProgress.upsert({
        where: {
          userId_towerId_difficultyId: {
            userId,
            towerId: DEFAULT_TOWER_ID,
            difficultyId: DEFAULT_DIFFICULTY_ID,
          },
        },
        create: {
          userId,
          towerId: DEFAULT_TOWER_ID,
          difficultyId: DEFAULT_DIFFICULTY_ID,
          seasonKey: currentSeasonKey(),
          highestFloorAllTime: Math.max(0, clamped - 1),
          highestFloorSeason: Math.max(0, clamped - 1),
        },
        update: {
          highestFloorAllTime: Math.max(0, clamped - 1),
          highestFloorSeason: Math.max(0, clamped - 1),
        },
      });
      await tx.towerRun.create({
        data: {
          userId,
          towerId: DEFAULT_TOWER_ID,
          difficultyId: DEFAULT_DIFFICULTY_ID,
          status: "ACTIVE",
          currentFloor: clamped,
          teamSnapshot: towerTeamSnapshotJson(snapshot),
          teamChangesRemaining: COMBAT_TOWER_CONFIG.rules.teamChangesAllowed,
          attemptsConsumed: 0,
        },
      });
      await primeTeamForTowerRun(tx, snapshot);
    },
    { timeout: 20_000 },
  );

  revalidatePath(`/${locale}/tower`);
  redirect({ href: "/tower", locale });
}
