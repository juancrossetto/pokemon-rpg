"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { calculateMaxHp } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { getCurrentEnergy, WILD_ENCOUNTER_ENERGY_COST } from "@/lib/energy";
import { getActiveGymRun, revalidateCombatUi } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { findStage, isStageUnlocked, resolveSpawn } from "@/lib/campaign";
import { rollShiny } from "@/lib/shiny";
import { recordSeenSpecies } from "@/lib/zone-progress";
import { pickEventItemName, rollExplorationEvent } from "@/lib/campaign/events";
import { markSpeciesSeen } from "@/lib/pokedex-seen";

export type StartEncounterResult =
  | { success: true }
  | {
      success: false;
      error: "no_lead" | "fainted_lead" | "no_energy" | "no_stage" | "locked";
    };

export async function startEncounter(locale: string): Promise<StartEncounterResult | void> {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const existing = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    revalidatePath(`/${locale}/battle`);
    redirect({ href: "/battle", locale });
    return;
  }

  const gymRun = await getActiveGymRun(userId);
  if (gymRun) {
    redirect({ href: `/gyms/${gymRun.gymId}/run`, locale });
    return;
  }

  const progress = await ensureCampaignProgress(userId);
  const stage = findStage(progress.farmingStageId)?.stage;
  if (!stage || stage.isGymMilestone) return { success: false, error: "no_stage" };
  if (!isStageUnlocked(stage, progress)) return { success: false, error: "locked" };

  const energyCost = stage.energyCost ?? WILD_ENCOUNTER_ENERGY_COST;

  const lead = await prisma.pokemonInstance.findFirst({
    where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
    include: { species: true },
    orderBy: { teamSlot: "asc" },
  });

  if (!lead) {
    const anyInTeam = await prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: { id: true },
    });
    return { success: false, error: anyInTeam ? "fainted_lead" : "no_lead" };
  }

  const { speciesId: wildSpeciesId, level: baseLevel } = resolveSpawn(stage);
  const event = rollExplorationEvent();
  const wildLevel = event.kind === "alpha" ? baseLevel + event.levelBonus : baseLevel;
  const wildSpecies = await prisma.species.findUniqueOrThrow({ where: { id: wildSpeciesId } });
  const wildMaxHp = calculateMaxHp(wildSpecies.baseHp, wildLevel);
  const wildMoveIds = await getMovesetForLevel(wildSpeciesId, wildLevel);
  const wildMoves = await prisma.move.findMany({ where: { id: { in: wildMoveIds } } });
  const wildMovePp = wildMoveIds.map((id) => wildMoves.find((m) => m.id === id)?.pp ?? 20);
  const wildIsShiny = rollShiny();

  const foundItem =
    event.kind === "item"
      ? await prisma.item.findFirst({ where: { name: pickEventItemName() } })
      : null;

  const started = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);

    const stillActive = await tx.battleSession.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (stillActive) return { ok: false as const, reason: "in_battle" as const };

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const currentEnergy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
    if (currentEnergy < energyCost) return { ok: false as const, reason: "no_energy" as const };

    await tx.user.update({
      where: { id: userId },
      data: { energy: currentEnergy - energyCost, energyUpdatedAt: new Date() },
    });

    if (foundItem) {
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: foundItem.id } },
        create: { userId, itemId: foundItem.id, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
    }

    await tx.battleSession.create({
      data: {
        userId,
        pokemonInstanceId: lead.id,
        wildSpeciesId,
        wildLevel,
        wildCurrentHp: wildMaxHp,
        wildMaxHp,
        wildMoveIds,
        wildMovePp,
        wildIsShiny,
        log: [
          ...(event.kind === "alpha" ? ["alpha"] : []),
          ...(wildIsShiny ? ["shiny"] : []),
          `appear:${wildSpecies.name}`,
        ],
        participantIds: [lead.id],
        turnDeadlineAt: null,
      },
    });

    return { ok: true as const };
  });

  if (!started.ok) {
    if (started.reason === "no_energy") return { success: false, error: "no_energy" };
    revalidatePath(`/${locale}/battle`);
    redirect({ href: "/battle", locale });
    return;
  }

  await recordSeenSpecies(userId, progress.farmingLocationId, wildSpeciesId);
  await markSpeciesSeen(userId, wildSpeciesId);

  revalidatePath(`/${locale}/battle`);
  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}
