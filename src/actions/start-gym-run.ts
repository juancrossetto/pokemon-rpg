"use server";

import { redirect } from "@/i18n/navigation";
import { isGymOpenAt } from "@/lib/gym-status";
import {
  areChapterStagesCompleteForGym,
  canChallengeGym,
  countTeamReadyAtLevel,
  gymReadyLevel,
} from "@/lib/campaign";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { regionDef } from "@/lib/regions";

export type StartGymRunResult =
  | { success: true }
  | {
      success: false;
      error:
        | "no_lead"
        | "fainted_lead"
        | "locked"
        | "region_locked"
        | "on_cooldown"
        | "closed"
        | "stages_incomplete"
        | "team_not_ready";
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

  const gym = await prisma.gym.findUniqueOrThrow({
    where: { id: gymId },
    include: { team: { select: { level: true } } },
  });
  const region = regionDef(gym.regionId);
  if (!region.playable || !region.gymsAvailable) {
    return { success: false, error: "region_locked" };
  }

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

  // Primera medalla: stages del capítulo + nivel/equipo listo. Revancha libre.
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

    const recommendedLevel = Math.max(...gym.team.map((p) => p.level), 1);
    const team = await prisma.pokemonInstance.findMany({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: { level: true },
    });
    const teamLevels = team.map((p) => p.level);
    const teamMaxLevel = Math.max(...teamLevels, 1);
    const teamReadyCount = countTeamReadyAtLevel(
      teamLevels,
      gymReadyLevel(recommendedLevel),
    );
    if (
      !canChallengeGym(gym.order, progress.completedStageIds, {
        regionId: gym.regionId,
        teamMaxLevel,
        teamReadyCount,
        recommendedLevel,
      })
    ) {
      return { success: false, error: "team_not_ready" };
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
