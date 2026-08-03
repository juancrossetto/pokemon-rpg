"use server";

import { redirect } from "@/i18n/navigation";
import { isGymOpenAt } from "@/lib/gym-status";
import { areChapterStagesCompleteForGym } from "@/lib/campaign";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type StartGymRunResult =
  | { success: true }
  | {
      success: false;
      error: "no_lead" | "fainted_lead" | "locked" | "on_cooldown" | "closed" | "stages_incomplete";
      hoursLeft?: number;
      opensHour?: number;
      closesHour?: number;
    };

// Crea (o retoma) la corrida de un gimnasio y te manda al pasillo de
// entrenadores — todavía no arranca ninguna batalla, eso lo hace
// startGymRunBattle desde la pantalla del pasillo.
export async function startGymRun(gymId: string, locale: string): Promise<StartGymRunResult | void> {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const existingBattle = await prisma.battleSession.findFirst({ where: { userId, status: "ACTIVE" } });
  if (existingBattle) {
    redirect({ href: "/battle", locale });
    return;
  }

  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: gymId } });

  const lead = await prisma.pokemonInstance.findFirst({
    where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
    orderBy: { teamSlot: "asc" },
  });
  if (!lead) {
    const anyInTeam = await prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: { id: true },
    });
    return { success: false, error: anyInTeam ? "fainted_lead" : "no_lead" };
  }

  if (gym.order > 1) {
    const previousBadge = await prisma.badge.findFirst({
      where: { userId, gym: { order: gym.order - 1, regionId: gym.regionId } },
    });
    if (!previousBadge) return { success: false, error: "locked" };
  }

  // Horario de atención (dossier: "gimnasios con horarios"). El guard vive acá
  // y no sólo en la UI: si no, alcanzaba con postear el form fuera de hora.
  if (!isGymOpenAt(gym.opensHour, gym.closesHour, new Date().getHours())) {
    return {
      success: false,
      error: "closed",
      opensHour: gym.opensHour,
      closesHour: gym.closesHour,
    };
  }

  const existingRun = await prisma.gymRun.findFirst({ where: { userId, gymId, status: "ACTIVE" } });
  if (existingRun) {
    redirect({ href: `/gyms/${gymId}/run`, locale });
    return;
  }

  const [ownBadge, lastAttempt] = await Promise.all([
    prisma.badge.findUnique({ where: { userId_gymId: { userId, gymId } } }),
    prisma.gymAttempt.findFirst({ where: { userId, gymId }, orderBy: { attemptedAt: "desc" } }),
  ]);

  // Primera medalla: hay que terminar los stages del capítulo. Revancha libre.
  if (!ownBadge) {
    const progress = await ensureCampaignProgress(userId);
    if (
      !areChapterStagesCompleteForGym(
        gym.order,
        progress.completedStageIds,
        gym.regionId,
      )
    ) {
      return { success: false, error: "stages_incomplete" };
    }
  }

  if (!ownBadge && lastAttempt && !lastAttempt.won) {
    const cooldownMs = gym.cooldownHours * 60 * 60 * 1000;
    const elapsedMs = Date.now() - lastAttempt.attemptedAt.getTime();
    if (elapsedMs < cooldownMs) {
      const hoursLeft = Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000));
      return { success: false, error: "on_cooldown", hoursLeft };
    }
  }

  await prisma.gymRun.create({ data: { userId, gymId } });

  redirect({ href: `/gyms/${gymId}/run`, locale });
}
