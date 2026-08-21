"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowUserAction } from "@/lib/rate-limit";
import { lockUsers } from "@/lib/db-locks";
import { MAX_PURCHASE_QUANTITY } from "@/lib/shop";

export type BuyItemGemsResult =
  | { ok: true; gemsLeft: number; quantity: number; ownedAfter: number }
  | {
      ok: false;
      error:
        | "rate_limited"
        | "unauthorized" | "not_found" | "no_gems" | "invalid_quantity";
      missing?: number;
    };

/**
 * Compra en la tienda oficial pagando gemas (hoy: Cordón Unión).
 * Misma serialización que `buyItem`: lock por jugador, precio recalculado
 * en el servidor.
 */
export async function buyItemWithGems(
  itemId: string,
  locale: string,
  quantity = 1,
): Promise<BuyItemGemsResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  // Sin límite, un bucle de reintentos martilla la base gratis.
  if (!(await allowUserAction("purchase", "shop:buyGems", userId))) {
    return { ok: false, error: "rate_limited" };
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PURCHASE_QUANTITY) {
    return { ok: false, error: "invalid_quantity" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, gemPrice: true },
  });
  if (!item || item.gemPrice == null || item.gemPrice <= 0) {
    return { ok: false, error: "not_found" };
  }

  const total = item.gemPrice * quantity;
  let failure: BuyItemGemsResult | null = null;
  let gemsLeft = 0;
  let ownedAfter = 0;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { gems: true },
    });
    if (!user) {
      failure = { ok: false, error: "not_found" };
      return;
    }
    if (user.gems < total) {
      failure = { ok: false, error: "no_gems", missing: total - user.gems };
      return;
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { gems: { decrement: total } },
      select: { gems: true },
    });
    const inventory = await tx.inventoryItem.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantity },
      update: { quantity: { increment: quantity } },
      select: { quantity: true },
    });

    gemsLeft = updated.gems;
    ownedAfter = inventory.quantity;
  });

  if (failure) return failure;

  revalidatePath(`/${locale}/shop`);
  revalidatePath(`/${locale}/market`);
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, gemsLeft, quantity, ownedAfter };
}
