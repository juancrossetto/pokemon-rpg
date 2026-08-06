"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { blockIfInCombat } from "@/lib/battle-lock";

/** Bayas de curación del seed (no tienen healAmount en Item). */
const BERRY_HEAL: Record<string, number> = {
  "Oran Berry": 10,
  "Sitrus Berry": 30,
};

export type HealWithPotionResult =
  | { ok: true; healedBy: number; itemName: string; currentHp: number; maxHp: number }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "not_found"
        | "no_potions"
        | "full_hp"
        | "needs_revive"
        | "in_combat";
    };

/**
 * Cura un Pokémon (equipo o PC) con la poción más barata, o Oran/Sitrus si no hay.
 */
export async function healPokemonWithPotion(
  instanceId: string,
  locale: string,
): Promise<HealWithPotionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    include: { species: { select: { baseHp: true } } },
  });
  if (!instance) return { ok: false, error: "not_found" };

  const maxHp = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  if (instance.currentHp >= maxHp) return { ok: false, error: "full_hp" };
  // Las pociones no reaniman: hace falta Revive / Max Revive.
  if (instance.currentHp <= 0) return { ok: false, error: "needs_revive" };

  // Pociones primero (la más débil); si no hay, bayas Oran/Sitrus.
  // Excluir Revive/Max Revive (POTION sin healAmount no entran por el filtro).
  const potions = await prisma.inventoryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      item: { type: "POTION", healAmount: { not: null } },
    },
    include: { item: { select: { id: true, name: true, healAmount: true } } },
    orderBy: { item: { healAmount: "asc" } },
  });

  let itemId: string;
  let itemName: string;
  let healAmount: number;
  let quantity: number;

  const potion = potions[0];
  if (potion?.item.healAmount != null) {
    itemId = potion.itemId;
    itemName = potion.item.name;
    healAmount = potion.item.healAmount;
    quantity = potion.quantity;
  } else {
    const berries = await prisma.inventoryItem.findMany({
      where: {
        userId,
        quantity: { gt: 0 },
        item: { name: { in: Object.keys(BERRY_HEAL) } },
      },
      include: { item: { select: { id: true, name: true } } },
    });
    const ranked = berries
      .map((b) => ({
        ...b,
        heal: BERRY_HEAL[b.item.name] ?? 0,
      }))
      .filter((b) => b.heal > 0)
      .sort((a, b) => a.heal - b.heal);
    const berry = ranked[0];
    if (!berry) return { ok: false, error: "no_potions" };
    itemId = berry.itemId;
    itemName = berry.item.name;
    healAmount = berry.heal;
    quantity = berry.quantity;
  }

  const healedTo = Math.min(maxHp, instance.currentHp + healAmount);
  const healedBy = healedTo - instance.currentHp;

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: { decrement: 1 } },
    }),
    prisma.pokemonInstance.update({
      where: { id: instance.id },
      data: { currentHp: healedTo },
    }),
  ]);

  if (quantity <= 1) {
    await prisma.inventoryItem.deleteMany({
      where: { userId, itemId, quantity: { lte: 0 } },
    });
  }

  revalidatePath(`/${locale}`);
  // El cliente actualiza HP/mochila en optimista; no hace falta invalidar todo.

  return {
    ok: true,
    healedBy,
    itemName,
    currentHp: healedTo,
    maxHp,
  };
}
