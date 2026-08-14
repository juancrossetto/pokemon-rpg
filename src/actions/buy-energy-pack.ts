"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowUserAction } from "@/lib/rate-limit";
import { lockUsers } from "@/lib/db-locks";
import { getCurrentEnergy } from "@/lib/energy";
import { MAX_PURCHASE_QUANTITY } from "@/lib/shop";
import {
  ENERGY_PACK_ENERGY,
  ENERGY_PACK_PRICE,
} from "@/lib/shop-energy-pack";

export type BuyEnergyPackResult =
  | {
      ok: true;
      coinsLeft: number;
      quantity: number;
      energyDelta: number;
      energyAfter: number;
    }
  | {
      ok: false;
      error:
        | "rate_limited"
        | "unauthorized"
        | "no_coins"
        | "invalid_quantity"
        | "energy_full";
      missing?: number;
    };

/**
 * Compra paquetes de energía en la tienda oficial.
 * Cada unidad cuesta `ENERGY_PACK_PRICE` y otorga `ENERGY_PACK_ENERGY`
 * (acotado a energyMax, igual que las recompensas de eventos).
 */
export async function buyEnergyPack(
  locale: string,
  quantity = 1,
): Promise<BuyEnergyPackResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  // Sin límite, un bucle de reintentos martilla la base gratis.
  if (!allowUserAction("purchase", "shop:energy", userId)) {
    return { ok: false, error: "rate_limited" };
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PURCHASE_QUANTITY) {
    return { ok: false, error: "invalid_quantity" };
  }

  const total = ENERGY_PACK_PRICE * quantity;
  const energyWanted = ENERGY_PACK_ENERGY * quantity;
  let failure: BuyEnergyPackResult | null = null;
  let coinsLeft = 0;
  let energyDelta = 0;
  let energyAfter = 0;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        coins: true,
        energy: true,
        energyMax: true,
        energyUpdatedAt: true,
      },
    });
    if (!user) {
      failure = { ok: false, error: "unauthorized" };
      return;
    }
    if (user.coins < total) {
      failure = { ok: false, error: "no_coins", missing: total - user.coins };
      return;
    }

    const current = getCurrentEnergy(
      user.energy,
      user.energyMax,
      user.energyUpdatedAt,
    );
    if (current >= user.energyMax) {
      failure = { ok: false, error: "energy_full" };
      return;
    }

    const nextEnergy = Math.min(user.energyMax, current + energyWanted);
    const applied = nextEnergy - current;
    if (applied <= 0) {
      failure = { ok: false, error: "energy_full" };
      return;
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        coins: { decrement: total },
        energy: nextEnergy,
        energyUpdatedAt: new Date(),
      },
      select: { coins: true, energy: true },
    });

    coinsLeft = updated.coins;
    energyDelta = applied;
    energyAfter = updated.energy;
  });

  if (failure) return failure;

  revalidatePath(`/${locale}/shop`);
  revalidatePath(`/${locale}/market`);
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, coinsLeft, quantity, energyDelta, energyAfter };
}
