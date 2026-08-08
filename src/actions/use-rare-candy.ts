"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateMaxHp,
  MAX_POKEMON_LEVEL,
  UNSPENT_POINTS_PER_LEVEL,
  xpForLevel,
} from "@/lib/stats";
import { getCombatLock } from "@/lib/battle-lock";
import { redirect } from "@/i18n/navigation";
import {
  buildLevelUpEffects,
  toKnownMoveInfo,
  type EvolveOffer,
  type KnownMoveInfo,
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
      knownMoves: KnownMoveInfo[];
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

const MOVE_SELECT = {
  id: true,
  name: true,
  type: true,
  category: true,
  power: true,
  accuracy: true,
  pp: true,
  effectText: true,
} as const;

/**
 * Consume un Rare Candy y sube 1 nivel (curva Medium Fast, como en los juegos).
 * También enseña movimientos de ese nivel y ofrece evolución si corresponde.
 *
 * Optimizado para latencia: lecturas en paralelo, sin re-fetch de known post-update,
 * y revalidatePath diferido con `after()` para no bloquear la respuesta al cliente.
 */
export async function useRareCandy(
  instanceId: string,
  locale: string,
): Promise<UseRareCandyResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const [lock, instance, candy] = await Promise.all([
    getCombatLock(userId),
    prisma.pokemonInstance.findFirst({
      where: { id: instanceId, ownerId: userId },
      include: {
        species: {
          select: { baseHp: true, id: true, name: true, spriteUrl: true },
        },
        moves: {
          include: { move: { select: MOVE_SELECT } },
          orderBy: { slot: "asc" },
        },
      },
    }),
    prisma.inventoryItem.findFirst({
      where: {
        userId,
        quantity: { gt: 0 },
        item: { name: "Rare Candy" },
      },
      include: { item: { select: { id: true, name: true } } },
    }),
  ]);

  if (lock?.kind === "battle") {
    redirect({ href: "/battle", locale });
    return { ok: false, error: "in_combat" };
  }
  if (lock?.kind === "gym") {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
    return { ok: false, error: "in_combat" };
  }
  if (lock?.kind === "tower") {
    redirect({ href: "/tower", locale });
    return { ok: false, error: "in_combat" };
  }

  if (!instance) return { ok: false, error: "not_found" };
  if (instance.level >= MAX_POKEMON_LEVEL) {
    return { ok: false, error: "max_level" };
  }
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

  const knownMoves = instance.moves.map((m) => toKnownMoveInfo(m.slot, m.move));

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { userId_itemId: { userId, itemId: candy.itemId } },
      data: { quantity: { decrement: 1 } },
    });
    await tx.pokemonInstance.update({
      where: { id: instance.id },
      data: {
        level: newLevel,
        xp: newXp,
        unspentPoints: { increment: UNSPENT_POINTS_PER_LEVEL },
        currentHp: newCurrentHp,
      },
    });
    if (candy.quantity <= 1) {
      await tx.inventoryItem.deleteMany({
        where: { userId, itemId: candy.itemId, quantity: { lte: 0 } },
      });
    }
  });

  let autoTaught: LevelUpMoveInfo[] = [];
  let pendingMoves: LevelUpMoveInfo[] = [];
  let evolveOffer: EvolveOffer | null = null;
  try {
    const effects = await buildLevelUpEffects({
      speciesId: instance.speciesId,
      level: newLevel,
      fromLevel: previousLevel,
      knownMoves,
      declinedMoveIds: instance.declinedMoveIds,
    });
    autoTaught = effects.autoTaught;
    pendingMoves = effects.pendingMoves;
    evolveOffer = effects.evolveOffer;
  } catch (err) {
    // El nivel ya subió; no fallar el caramelo si falla el lookup de moves/evo.
    console.error("[useRareCandy] buildLevelUpEffects", err);
  }

  // No bloquear la respuesta: el cliente ya actualizó nivel/bag en optimistic UI.
  after(() => {
    revalidatePath(`/${locale}/team`);
    revalidatePath(`/${locale}/pc`);
    revalidatePath(`/${locale}`);
  });

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
    knownMoves,
  };
}
