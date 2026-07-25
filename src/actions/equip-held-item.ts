"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockIfInCombat } from "@/lib/battle-lock";

export type EquipHeldItemResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "no_item" | "in_combat" };

/**
 * Equipa un objeto (sale de la mochila, pasa a estar puesto en el Pokémon).
 * Si ya tenía otro equipado, ese vuelve a la mochila en la misma transacción.
 */
export async function equipHeldItem(
  pokemonInstanceId: string,
  itemId: string,
  locale: string,
): Promise<EquipHeldItemResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const [instance, inventoryItem] = await Promise.all([
    prisma.pokemonInstance.findFirst({
      where: { id: pokemonInstanceId, ownerId: userId },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),
  ]);
  if (!instance) return { ok: false, error: "not_found" };
  if (!inventoryItem || inventoryItem.quantity < 1 || inventoryItem.item.heldEffect === null) {
    return { ok: false, error: "no_item" };
  }

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: { decrement: 1 } },
    }),
    ...(instance.heldItemId
      ? [
          prisma.inventoryItem.upsert({
            where: { userId_itemId: { userId, itemId: instance.heldItemId } },
            create: { userId, itemId: instance.heldItemId, quantity: 1 },
            update: { quantity: { increment: 1 } },
          }),
        ]
      : []),
    prisma.pokemonInstance.update({
      where: { id: pokemonInstanceId },
      data: { heldItemId: itemId },
    }),
  ]);

  revalidatePath(`/${locale}/team`);
  return { ok: true };
}

export async function unequipHeldItem(
  pokemonInstanceId: string,
  locale: string,
): Promise<EquipHeldItemResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: pokemonInstanceId, ownerId: userId },
  });
  if (!instance) return { ok: false, error: "not_found" };
  if (!instance.heldItemId) return { ok: true };

  await prisma.$transaction([
    prisma.inventoryItem.upsert({
      where: { userId_itemId: { userId, itemId: instance.heldItemId } },
      create: { userId, itemId: instance.heldItemId, quantity: 1 },
      update: { quantity: { increment: 1 } },
    }),
    prisma.pokemonInstance.update({
      where: { id: pokemonInstanceId },
      data: { heldItemId: null },
    }),
  ]);

  revalidatePath(`/${locale}/team`);
  return { ok: true };
}
