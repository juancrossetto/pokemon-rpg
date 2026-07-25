"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { blockIfInCombat } from "@/lib/battle-lock";

export type HealWithPotionResult =
  | { ok: true; healedBy: number; itemName: string; currentHp: number; maxHp: number }
  | {
      ok: false;
      error: "unauthorized" | "not_found" | "no_potions" | "full_hp" | "in_combat";
    };

/**
 * Cura un Pokémon del equipo con la poción más barata disponible (fuera de combate).
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

  // La más débil primero: no gastar Full Restore si alcanza una Potion.
  const potions = await prisma.inventoryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      item: { type: "POTION", healAmount: { not: null } },
    },
    include: { item: { select: { id: true, name: true, healAmount: true } } },
    orderBy: { item: { healAmount: "asc" } },
  });
  const stack = potions[0];
  if (!stack || stack.item.healAmount == null) {
    return { ok: false, error: "no_potions" };
  }

  const healAmount = stack.item.healAmount;
  const healedTo = Math.min(maxHp, instance.currentHp + healAmount);
  const healedBy = healedTo - instance.currentHp;

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId: stack.itemId } },
      data: { quantity: { decrement: 1 } },
    }),
    prisma.pokemonInstance.update({
      where: { id: instance.id },
      data: { currentHp: healedTo },
    }),
  ]);

  // Si llegó a 0, limpiar la fila vacía.
  if (stack.quantity <= 1) {
    await prisma.inventoryItem.deleteMany({
      where: { userId, itemId: stack.itemId, quantity: { lte: 0 } },
    });
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/inventory`);
  revalidatePath(`/${locale}/battle`);

  return {
    ok: true,
    healedBy,
    itemName: stack.item.name,
    currentHp: healedTo,
    maxHp,
  };
}
