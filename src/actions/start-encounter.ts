"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { getCurrentEnergy } from "@/lib/energy";
import { getActiveGymRun, revalidateCombatUi } from "@/lib/battle-lock";

const ENCOUNTER_ENERGY_COST = 1;
const LEVEL_RANGE = 2;
const MAX_SEEDED_SPECIES_ID = 151;

export type StartEncounterResult =
  | { success: true }
  | { success: false; error: "no_lead" | "fainted_lead" | "no_energy" };

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

  const [user, lead] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: 1 },
      include: { species: true },
    }),
  ]);

  if (!lead) return { success: false, error: "no_lead" };
  if (lead.currentHp <= 0) return { success: false, error: "fainted_lead" };

  const currentEnergy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
  if (currentEnergy < ENCOUNTER_ENERGY_COST) return { success: false, error: "no_energy" };

  const wildLevel = Math.max(
    2,
    lead.level + Math.floor(Math.random() * (LEVEL_RANGE * 2 + 1)) - LEVEL_RANGE,
  );
  const wildSpeciesId = 1 + Math.floor(Math.random() * MAX_SEEDED_SPECIES_ID);
  const wildSpecies = await prisma.species.findUniqueOrThrow({ where: { id: wildSpeciesId } });
  const wildMaxHp = calculateMaxHp(wildSpecies.baseHp, wildLevel);
  const wildMoveIds = await getMovesetForLevel(wildSpeciesId, wildLevel);
  const wildMoves = await prisma.move.findMany({ where: { id: { in: wildMoveIds } } });
  const wildMovePp = wildMoveIds.map((id) => wildMoves.find((m) => m.id === id)?.pp ?? 20);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { energy: currentEnergy - ENCOUNTER_ENERGY_COST, energyUpdatedAt: new Date() },
    }),
    prisma.battleSession.create({
      data: {
        userId,
        pokemonInstanceId: lead.id,
        wildSpeciesId,
        wildLevel,
        wildCurrentHp: wildMaxHp,
        wildMaxHp,
        wildMoveIds,
        wildMovePp,
        log: [`appear:${wildSpecies.name}`],
        participantIds: [lead.id],
      },
    }),
  ]);

  revalidatePath(`/${locale}/battle`);
  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}
