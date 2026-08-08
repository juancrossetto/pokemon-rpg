"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { getActiveGymRun, revalidateCombatUi } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { isLocationUnlocked } from "@/lib/campaign";
import { getRouteTrainer } from "@/lib/campaign/trainers";
import { nextTurnDeadline } from "@/lib/battle-turn-timer";

export type StartTrainerResult =
  | { success: true }
  | {
      success: false;
      error:
        | "no_lead"
        | "fainted_lead"
        | "not_found"
        | "already_beaten"
        | "in_battle"
        | "locked";
    };

/**
 * Desafía a un entrenador de ruta.
 *
 * No cuesta energía: la energía limita el farmeo de salvajes, y un entrenador
 * es contenido finito que se pelea una sola vez. Cobrar energía por él sería
 * cobrar dos veces por el mismo progreso.
 */
export async function startTrainerBattle(
  trainerId: string,
  locale: string,
): Promise<StartTrainerResult | void> {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const existing = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) {
    redirect({ href: "/battle", locale });
    return;
  }

  const gymRun = await getActiveGymRun(userId);
  if (gymRun) {
    redirect({ href: `/gyms/${gymRun.gymId}/run`, locale });
    return;
  }

  const trainer = getRouteTrainer(trainerId);
  if (!trainer) return { success: false, error: "not_found" };

  const progress = await ensureCampaignProgress(userId);
  if (!isLocationUnlocked(trainer.locationId, progress)) {
    return { success: false, error: "locked" };
  }

  const beaten = await prisma.trainerDefeat.findUnique({
    where: { userId_trainerId: { userId, trainerId } },
    select: { trainerId: true },
  });
  if (beaten) return { success: false, error: "already_beaten" };

  const lead = await prisma.pokemonInstance.findFirst({
    where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
    select: { id: true },
    orderBy: { teamSlot: "asc" },
  });
  if (!lead) {
    const anyInTeam = await prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: { id: true },
    });
    return { success: false, error: anyInTeam ? "fainted_lead" : "no_lead" };
  }

  const species = await prisma.species.findUniqueOrThrow({ where: { id: trainer.speciesId } });
  const maxHp = calculateMaxHp(species.baseHp, trainer.level);
  const moveIds = await getMovesetForLevel(trainer.speciesId, trainer.level);
  const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });
  const tCampaign = await getTranslations("campaign");
  const trainerName = tCampaign(trainer.nameKey);

  await prisma.battleSession.create({
    data: {
      userId,
      pokemonInstanceId: lead.id,
      wildSpeciesId: trainer.speciesId,
      wildLevel: trainer.level,
      wildCurrentHp: maxHp,
      wildMaxHp: maxHp,
      wildMoveIds: moveIds,
      wildMovePp: moveIds.map((id) => moves.find((m) => m.id === id)?.pp ?? 20),
      routeTrainerId: trainer.id,
      participantIds: [lead.id],
      // Mismo patrón que gimnasio: desafío + sendOut (no "apareció un salvaje").
      log: [`challengeTrainer:${trainerName}`, `sendOut:${species.name}`],
      turnDeadlineAt: nextTurnDeadline(),
    },
  });

  revalidateCombatUi(locale);
  revalidatePath(`/${locale}/campaign`);
  redirect({ href: "/battle", locale });
}
