"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockIfInCombat } from "@/lib/battle-lock";

export type EquipHeldItemResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "no_item" | "in_combat" };

/**
 * Exp. Share (y futuros unique-held): un solo Pokémon del jugador puede
 * llevarlo. Al equipar en otro, se traslada sin duplicar en la mochila.
 */
function isUniqueHeldEffect(effect: string | null): boolean {
  return effect === "EXP_SHARE";
}

/**
 * Equipa un objeto (sale de la mochila, pasa a estar puesto en el Pokémon).
 * Si ya tenía otro equipado, ese vuelve a la mochila en la misma transacción.
 * Si el ítem es único (Exp. Share), se quita de cualquier otro holder primero.
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

  const [instance, inventoryItem, item] = await Promise.all([
    prisma.pokemonInstance.findFirst({
      where: { id: pokemonInstanceId, ownerId: userId },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    }),
    prisma.item.findUnique({ where: { id: itemId } }),
  ]);
  if (!instance) return { ok: false, error: "not_found" };
  if (!item || item.heldEffect === null) return { ok: false, error: "no_item" };

  const unique = isUniqueHeldEffect(item.heldEffect);
  const otherHolders = unique
    ? await prisma.pokemonInstance.findMany({
        where: {
          ownerId: userId,
          heldItemId: itemId,
          id: { not: pokemonInstanceId },
        },
        select: { id: true },
      })
    : [];

  const bagQty = inventoryItem?.quantity ?? 0;
  const canTakeFromBag = bagQty >= 1;
  const canTransfer = otherHolders.length > 0;
  if (!canTakeFromBag && !canTransfer) {
    return { ok: false, error: "no_item" };
  }

  // Ya lo tiene este mon: no-op.
  if (instance.heldItemId === itemId) return { ok: true };

  await prisma.$transaction(async (tx) => {
    // Unique: sacar de otros holders. Si además hay en mochila, devolver esos
    // a la bag (había duplicados); si no, es un traslado y no sumamos.
    if (otherHolders.length > 0) {
      await tx.pokemonInstance.updateMany({
        where: { id: { in: otherHolders.map((h) => h.id) } },
        data: { heldItemId: null },
      });
      if (canTakeFromBag) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId } },
          create: { userId, itemId, quantity: otherHolders.length },
          update: { quantity: { increment: otherHolders.length } },
        });
      }
    }

    // El held anterior del target vuelve a la mochila.
    if (instance.heldItemId) {
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: instance.heldItemId } },
        create: { userId, itemId: instance.heldItemId, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
    }

    if (canTakeFromBag) {
      await tx.inventoryItem.update({
        where: { userId_itemId: { userId, itemId } },
        data: { quantity: { decrement: 1 } },
      });
    }
    // Si no había en bag y venía de otro holder: el clear de arriba ya dejó
    // el ítem "libre" y lo asignamos sin tocar inventario.

    await tx.pokemonInstance.update({
      where: { id: pokemonInstanceId },
      data: { heldItemId: itemId },
    });
  });

  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/inventory`);
  revalidatePath(`/${locale}`);
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
  revalidatePath(`/${locale}/inventory`);
  revalidatePath(`/${locale}`);
  return { ok: true };
}
