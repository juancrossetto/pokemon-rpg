"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateMaxHp,
  MAX_POKEMON_LEVEL,
  UNSPENT_POINTS_PER_LEVEL,
  xpForLevel,
} from "@/lib/stats";
import { blockIfInCombat } from "@/lib/battle-lock";
import {
  resolveLevelUpEffects,
  type EvolveOffer,
  type LevelUpMoveInfo,
} from "@/lib/level-up";

export type UseRareCandyResult =
  | {
      ok: true;
      itemName: string;
      pokemonName: string;
      fromSpriteUrl: string;
      isShiny: boolean;
      newLevel: number;
      previousLevel: number;
      currentHp: number;
      maxHp: number;
      autoTaught: LevelUpMoveInfo[];
      pendingMoves: LevelUpMoveInfo[];
      evolveOffer: EvolveOffer | null;
      knownMoves: { slot: number; name: string }[];
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "not_found"
        | "no_candy"
        | "max_level"
        | "in_combat";
    };

/**
 * Consume un Rare Candy y sube 1 nivel (curva Medium Fast, como en los juegos).
 * También enseña movimientos de ese nivel y ofrece evolución si corresponde.
 */
export async function useRareCandy(
  instanceId: string,
  locale: string,
): Promise<UseRareCandyResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    include: {
      species: { select: { baseHp: true, id: true, name: true, spriteUrl: true } },
    },
  });
  if (!instance) return { ok: false, error: "not_found" };
  if (instance.level >= MAX_POKEMON_LEVEL) {
    return { ok: false, error: "max_level" };
  }

  const candy = await prisma.inventoryItem.findFirst({
    where: {
      userId,
      quantity: { gt: 0 },
      item: { name: "Rare Candy" },
    },
    include: { item: { select: { id: true, name: true } } },
  });
  if (!candy) return { ok: false, error: "no_candy" };

  const previousLevel = instance.level;
  const newLevel = instance.level + 1;
  const newXp = xpForLevel(newLevel);
  const previousMaxHp = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  const newMaxHp = calculateMaxHp(
    instance.species.baseHp,
    newLevel,
    instance.ptConstitution,
  );
  const newCurrentHp = Math.min(
    newMaxHp,
    instance.currentHp + (newMaxHp - previousMaxHp),
  );

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId: candy.itemId } },
      data: { quantity: { decrement: 1 } },
    }),
    prisma.pokemonInstance.update({
      where: { id: instance.id },
      data: {
        level: newLevel,
        xp: newXp,
        unspentPoints: { increment: UNSPENT_POINTS_PER_LEVEL },
        currentHp: newCurrentHp,
      },
    }),
  ]);

  if (candy.quantity <= 1) {
    await prisma.inventoryItem.deleteMany({
      where: { userId, itemId: candy.itemId, quantity: { lte: 0 } },
    });
  }

  let autoTaught: LevelUpMoveInfo[] = [];
  let pendingMoves: LevelUpMoveInfo[] = [];
  let evolveOffer: EvolveOffer | null = null;
  try {
    const effects = await resolveLevelUpEffects(
      instance.id,
      instance.speciesId,
      previousLevel,
      newLevel,
    );
    autoTaught = effects.autoTaught;
    pendingMoves = effects.pendingMoves;
    evolveOffer = effects.evolveOffer;
  } catch (err) {
    // El nivel ya subió; no fallar el caramelo si falla el lookup de moves/evo.
    console.error("[useRareCandy] resolveLevelUpEffects", err);
  }

  const known = await prisma.pokemonMove.findMany({
    where: { pokemonInstanceId: instance.id },
    include: { move: { select: { name: true } } },
    orderBy: { slot: "asc" },
  });

  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}`);

  return {
    ok: true,
    itemName: candy.item.name,
    pokemonName: instance.nickname?.trim() || instance.species.name,
    fromSpriteUrl: instance.species.spriteUrl,
    isShiny: instance.isShiny,
    newLevel,
    previousLevel,
    currentHp: newCurrentHp,
    maxHp: newMaxHp,
    autoTaught,
    pendingMoves,
    evolveOffer,
    knownMoves: known.map((m) => ({ slot: m.slot, name: m.move.name })),
  };
}
