"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type BuyItemResult =
  | { ok: true; coinsLeft: number }
  | { ok: false; error: "unauthorized" | "not_found" | "no_coins" };

export async function buyItem(itemId: string, locale: string): Promise<BuyItemResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const [user, item] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { coins: true } }),
    prisma.item.findUnique({ where: { id: itemId } }),
  ]);
  if (!user || !item) return { ok: false, error: "not_found" };
  if (user.coins < item.buyPrice) return { ok: false, error: "no_coins" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { coins: { decrement: item.buyPrice } } }),
    prisma.inventoryItem.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantity: 1 },
      update: { quantity: { increment: 1 } },
    }),
  ]);

  revalidatePath(`/${locale}/shop`);
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, coinsLeft: user.coins - item.buyPrice };
}
