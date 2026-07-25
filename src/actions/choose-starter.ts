"use server";

import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp, xpForLevel } from "@/lib/stats";
import { STARTER_SPECIES_IDS, rivalStarterFor } from "@/lib/starters";
import { getMovesetForLevel } from "@/lib/moveset";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";

const STARTER_LEVEL = 5;
const STARTER_POKEBALL_COUNT = 5;
const STARTER_POTION_COUNT = 3;
const STARTER_BERRY_COUNT = 2;
const STARTER_COINS = 500;
const TUTORIAL_RIVAL_LEVEL = 4;

export async function chooseStarter(speciesId: number, locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  // Sesión JWT vieja (p. ej. post-migración de DB): el id ya no existe.
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!account) {
    redirect({ href: "/login", locale });
    return;
  }

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
  const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });

  const [pokeBall, potion, oranBerry] = await Promise.all([
    prisma.item.findUnique({ where: { name: "Poke Ball" } }),
    prisma.item.findUnique({ where: { name: "Potion" } }),
    prisma.item.findUnique({ where: { name: "Oran Berry" } }),
  ]);

  await ensureCampaignProgress(userId);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: STARTER_COINS } },
    }),
    prisma.pokemonInstance.create({
      data: {
        ownerId: userId,
        speciesId,
        level: STARTER_LEVEL,
        xp: xpForLevel(STARTER_LEVEL),
        currentHp,
        teamSlot: 1,
        moves: {
          create: moveIds.map((moveId, i) => {
            const m = moves.find((x) => x.id === moveId);
            return { moveId, slot: i + 1, currentPp: m?.pp ?? 20 };
          }),
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
    ...(oranBerry
      ? [
          prisma.inventoryItem.upsert({
            where: { userId_itemId: { userId, itemId: oranBerry.id } },
            create: { userId, itemId: oranBerry.id, quantity: STARTER_BERRY_COUNT },
            update: { quantity: { increment: STARTER_BERRY_COUNT } },
          }),
        ]
      : []),
  ]);

  // Combate tutorial (dossier: "3 iniciales + combate tutorial contra un
  // rival"). Reusa el motor de batalla tal cual: es una sesión normal, con el
  // inicial que te gana por tipo y un nivel por debajo para que sea ganable.
  const starterInstance = await prisma.pokemonInstance.findFirst({
    where: { ownerId: userId, teamSlot: 1 },
    select: { id: true },
  });

  if (starterInstance) {
    const rivalSpeciesId = rivalStarterFor(speciesId);
    const rival = await prisma.species.findUnique({ where: { id: rivalSpeciesId } });
    if (rival) {
      const rivalLevel = TUTORIAL_RIVAL_LEVEL;
      const rivalMaxHp = calculateMaxHp(rival.baseHp, rivalLevel);
      const rivalMoveIds = await getMovesetForLevel(rivalSpeciesId, rivalLevel);
      const rivalMoves = await prisma.move.findMany({ where: { id: { in: rivalMoveIds } } });

      await prisma.battleSession.create({
        data: {
          userId,
          pokemonInstanceId: starterInstance.id,
          wildSpeciesId: rivalSpeciesId,
          wildLevel: rivalLevel,
          wildCurrentHp: rivalMaxHp,
          wildMaxHp: rivalMaxHp,
          wildMoveIds: rivalMoveIds,
          wildMovePp: rivalMoveIds.map(
            (id) => rivalMoves.find((m) => m.id === id)?.pp ?? 20,
          ),
          participantIds: [starterInstance.id],
          log: [`appear:${rival.name}`, "tutorial"],
        },
      });

      redirect({ href: "/battle", locale });
      return;
    }
  }

  redirect({ href: "/team", locale });
}
