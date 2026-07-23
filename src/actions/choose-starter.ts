"use server";

import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp, xpForLevel } from "@/lib/stats";
import { STARTER_SPECIES_IDS } from "@/lib/starters";
import { getMovesetForLevel } from "@/lib/moveset";

const STARTER_LEVEL = 5;
const STARTER_POKEBALL_COUNT = 5;
const STARTER_POTION_COUNT = 3;

export async function chooseStarter(speciesId: number, locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (!STARTER_SPECIES_IDS.includes(speciesId as (typeof STARTER_SPECIES_IDS)[number])) {
    throw new Error("Especie inicial inválida");
  }

  const alreadyHasTeam = await prisma.pokemonInstance.findFirst({
    where: { ownerId: userId },
  });
  if (alreadyHasTeam) {
    redirect({ href: "/team", locale });
    return;
  }

  const species = await prisma.species.findUniqueOrThrow({ where: { id: speciesId } });
  const currentHp = calculateMaxHp(species.baseHp, STARTER_LEVEL);
  const moveIds = await getMovesetForLevel(speciesId, STARTER_LEVEL);

  const [pokeBall, potion] = await Promise.all([
    prisma.item.findUnique({ where: { name: "Poke Ball" } }),
    prisma.item.findUnique({ where: { name: "Potion" } }),
  ]);

  await prisma.$transaction([
    prisma.pokemonInstance.create({
      data: {
        ownerId: userId,
        speciesId,
        level: STARTER_LEVEL,
        xp: xpForLevel(STARTER_LEVEL),
        currentHp,
        teamSlot: 1,
        moves: {
          create: moveIds.map((moveId, i) => ({ moveId, slot: i + 1 })),
        },
      },
    }),
    ...(pokeBall
      ? [
          prisma.inventoryItem.upsert({
            where: { userId_itemId: { userId, itemId: pokeBall.id } },
            create: { userId, itemId: pokeBall.id, quantity: STARTER_POKEBALL_COUNT },
            update: { quantity: { increment: STARTER_POKEBALL_COUNT } },
          }),
        ]
      : []),
    ...(potion
      ? [
          prisma.inventoryItem.upsert({
            where: { userId_itemId: { userId, itemId: potion.id } },
            create: { userId, itemId: potion.id, quantity: STARTER_POTION_COUNT },
            update: { quantity: { increment: STARTER_POTION_COUNT } },
          }),
        ]
      : []),
  ]);

  redirect({ href: "/team", locale });
}
