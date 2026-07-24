"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getCombatLock } from "@/lib/battle-lock";

export async function healTeam(locale: string) {
  const session = await auth();
  if (!session?.user) return;

  // No se puede curar el equipo en combate ni durante un desafío de gym.
  const lock = await getCombatLock(session.user.id);
  if (lock?.kind === "battle") {
    redirect({ href: "/battle", locale });
    return;
  }
  if (lock?.kind === "gym") {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
    return;
  }

  const team = await prisma.pokemonInstance.findMany({
    where: { ownerId: session.user.id, teamSlot: { not: null } },
    include: { species: true },
  });

  await Promise.all(
    team.map((instance) =>
      prisma.pokemonInstance.update({
        where: { id: instance.id },
        data: { currentHp: calculateMaxHp(instance.species.baseHp, instance.level) },
      }),
    ),
  );

  revalidatePath(`/${locale}/team`);
}
