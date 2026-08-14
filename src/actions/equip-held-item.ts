"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { consumeInventoryItem } from "@/lib/inventory-consume";
import { blockIfInCombat } from "@/lib/battle-lock";

export type EquipHeldItemResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "no_item" | "in_combat" };

/**
 * Exp. Share (y futuros unique-held): un solo Pokémon del jugador puede
 * llevarlo. La propiedad queda en la mochila (no se consume al equipar) y al
 * ponerselo a otro mon se traslada sin duplicar ni vaciar el stack.
 */
function isUniqueHeldEffect(effect: string | null): boolean {
  return effect === "EXP_SHARE";
}

/**
 * Equipa un objeto. Held normales: salen de la mochila. Unique (Exp. Share):
 * siguen en la mochila y sólo marcan qué Pokémon lo lleva; si ya estaba en
 * otro, se mueve.
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
  // Unique: basta con tenerlo en mochila o ya equipado en otro mon.
  if (!canTakeFromBag && !canTransfer) {
    return { ok: false, error: "no_item" };
  }

  // Ya lo tiene este mon: no-op.
  if (instance.heldItemId === itemId) return { ok: true };

  // La transacción devuelve si pudo tomar el objeto: las acciones de este
  // repo informan lo esperable con una unión discriminada, no con excepción.
  const equipped = await prisma.$transaction(async (tx) => {
    if (otherHolders.length > 0) {
      await tx.pokemonInstance.updateMany({
        where: { id: { in: otherHolders.map((h) => h.id) } },
        data: { heldItemId: null },
      });
    }

    // El held anterior del target vuelve a la mochila (si no es el mismo
    // unique que estamos moviendo — ese no se sacó de la bag).
    if (instance.heldItemId && instance.heldItemId !== itemId) {
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: instance.heldItemId } },
        create: { userId, itemId: instance.heldItemId, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
    }

    if (unique) {
      // Propiedad en mochila: no decrementar. Si el stack quedó en 0 por un
      // equip viejo, restaurarlo para que siga visible y re-equipable.
      if (bagQty < 1) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId } },
          create: { userId, itemId, quantity: 1 },
          update: { quantity: 1 },
        });
      }
    } else if (canTakeFromBag) {
      // Guarda de cantidad: equipar el mismo objeto desde dos pestañas sacaba
      // una sola unidad de la mochila y lo dejaba equipado en los dos.
      if (!(await consumeInventoryItem(tx, { userId, itemId }))) return false;
    }

    await tx.pokemonInstance.update({
      where: { id: pokemonInstanceId },
      data: { heldItemId: itemId },
    });
    return true;
  });
  if (!equipped) return { ok: false, error: "no_item" };

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
    include: { heldItem: { select: { heldEffect: true } } },
  });
  if (!instance) return { ok: false, error: "not_found" };
  if (!instance.heldItemId) return { ok: true };

  const unique = isUniqueHeldEffect(instance.heldItem?.heldEffect ?? null);
  const heldItemId = instance.heldItemId;

  await prisma.$transaction(async (tx) => {
    if (unique) {
      // Ya vive en la mochila; sólo reponer si un equip antiguo lo dejó en 0.
      const bag = await tx.inventoryItem.findUnique({
        where: { userId_itemId: { userId, itemId: heldItemId } },
      });
      if ((bag?.quantity ?? 0) < 1) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId: heldItemId } },
          create: { userId, itemId: heldItemId, quantity: 1 },
          update: { quantity: 1 },
        });
      }
    } else {
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: heldItemId } },
        create: { userId, itemId: heldItemId, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
    }

    await tx.pokemonInstance.update({
      where: { id: pokemonInstanceId },
      data: { heldItemId: null },
    });
  });

  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/inventory`);
  revalidatePath(`/${locale}`);
  return { ok: true };
}
