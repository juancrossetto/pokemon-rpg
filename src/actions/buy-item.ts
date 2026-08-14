"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowUserAction } from "@/lib/rate-limit";
import { lockUsers } from "@/lib/db-locks";
import { MAX_PURCHASE_QUANTITY } from "@/lib/shop";

export type BuyItemResult =
  | { ok: true; coinsLeft: number; quantity: number; ownedAfter: number }
  | {
      ok: false;
      error:
        | "rate_limited"
        | "unauthorized" | "not_found" | "no_coins" | "invalid_quantity";
      /** Cuánto falta, cuando el motivo es el saldo. Sirve para explicar el bloqueo. */
      missing?: number;
    };

/**
 * Compra en la tienda oficial.
 *
 * Dos cambios respecto de la versión anterior:
 *
 * - **Cantidad.** Cada llamada compraba exactamente una unidad, así que
 *   llevarse diez Poké Balls eran diez requests. Ahora la cantidad viaja en el
 *   pedido y se cobra en una sola operación.
 * - **Lock.** El chequeo de saldo y el descuento estaban fuera de la
 *   transacción: dos compras simultáneas leían el mismo saldo y las dos
 *   pasaban, dejando monedas en negativo. `lockUsers` serializa por jugador,
 *   igual que ya hace el mercado.
 *
 * El precio y el total se recalculan en el servidor: el cliente manda qué y
 * cuánto quiere, nunca cuánto cuesta.
 */
export async function buyItem(
  itemId: string,
  locale: string,
  quantity = 1,
): Promise<BuyItemResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  // Sin límite, un bucle de reintentos martilla la base gratis.
  if (!allowUserAction("purchase", "shop:buy", userId)) {
    return { ok: false, error: "rate_limited" };
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PURCHASE_QUANTITY) {
    return { ok: false, error: "invalid_quantity" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, buyPrice: true },
  });
  if (!item || item.buyPrice <= 0) return { ok: false, error: "not_found" };

  const total = item.buyPrice * quantity;
  let failure: BuyItemResult | null = null;
  let coinsLeft = 0;
  let ownedAfter = 0;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);

    const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
    if (!user) {
      failure = { ok: false, error: "not_found" };
      return;
    }
    if (user.coins < total) {
      failure = { ok: false, error: "no_coins", missing: total - user.coins };
      return;
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { coins: { decrement: total } },
      select: { coins: true },
    });
    const inventory = await tx.inventoryItem.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantity },
      update: { quantity: { increment: quantity } },
      select: { quantity: true },
    });

    coinsLeft = updated.coins;
    ownedAfter = inventory.quantity;
  });

  if (failure) return failure;

  revalidatePath(`/${locale}/shop`);
  revalidatePath(`/${locale}/market`);
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, coinsLeft, quantity, ownedAfter };
}
