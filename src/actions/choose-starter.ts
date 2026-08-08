"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp, unspentPointsForLevel, xpForLevel } from "@/lib/stats";
import { STARTER_SPECIES_IDS, rivalStarterFor } from "@/lib/starters";
import { getMovesetForLevel } from "@/lib/moveset";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { markSpeciesSeen } from "@/lib/pokedex-seen";
import { nextTurnDeadline } from "@/lib/battle-turn-timer";
import { TUTORIAL_BATTLE_ID } from "@/lib/battle-tutorial";

const STARTER_LEVEL = 5;
const STARTER_POTION_COUNT = 3;
const STARTER_BERRY_COUNT = 2;
const STARTER_COINS = 500;
const TUTORIAL_RIVAL_LEVEL = 4;

export type ChooseStarterResult =
  | { ok: true; href: "/battle" | "/team" | "/login" }
  | { ok: false; error: "auth" | "invalid" | "unknown" };

/**
 * Crea el inicial + combate tutorial. No usa `redirect()`: el cliente controla
 * la transición visual y navega al terminar (un redirect desde la action
 * dejaba el overlay de reveal trabado).
 */
export async function chooseStarter(
  speciesId: number,
  _locale: string,
): Promise<ChooseStarterResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "auth" };
  }
  const userId = session.user.id;

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!account) {
    return { ok: false, error: "auth" };
  }

  if (!STARTER_SPECIES_IDS.includes(speciesId as (typeof STARTER_SPECIES_IDS)[number])) {
    return { ok: false, error: "invalid" };
  }

  const alreadyHasTeam = await prisma.pokemonInstance.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (alreadyHasTeam) {
    const active = await prisma.battleSession.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
    });
    return { ok: true, href: active ? "/battle" : "/team" };
  }

  const species = await prisma.species.findUniqueOrThrow({ where: { id: speciesId } });
  const currentHp = calculateMaxHp(species.baseHp, STARTER_LEVEL);
  const moveIds = await getMovesetForLevel(speciesId, STARTER_LEVEL);
  const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });

  const [potion, oranBerry] = await Promise.all([
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
        unspentPoints: unspentPointsForLevel(STARTER_LEVEL),
        moves: {
          create: moveIds.map((moveId, i) => {
            const m = moves.find((x) => x.id === moveId);
            return { moveId, slot: i + 1, currentPp: m?.pp ?? 20 };
          }),
        },
      },
    }),
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

  await markSpeciesSeen(userId, speciesId);

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
          // No es un entrenador de ruta real: solo marca pelea tutorial
          // (sin captura ni huida). Ver `isTutorialBattle`.
          routeTrainerId: TUTORIAL_BATTLE_ID,
          participantIds: [starterInstance.id],
          log: [`appear:${rival.name}`, TUTORIAL_BATTLE_ID],
          turnDeadlineAt: nextTurnDeadline(),
        },
      });

      await markSpeciesSeen(userId, rivalSpeciesId);

      return { ok: true, href: "/battle" };
    }
  }

  return { ok: true, href: "/team" };
}
