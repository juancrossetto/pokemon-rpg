"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";

export async function healTeam(locale: string) {
  const session = await auth();
  if (!session?.user) return;

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
