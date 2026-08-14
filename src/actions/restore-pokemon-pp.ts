"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { effectivePp } from "@/lib/battle";
import { blockIfInCombat } from "@/lib/battle-lock";
import { clearEmptyInventoryRow, consumeInventoryItem } from "@/lib/inventory-consume";
import { PP_RESTORE_ITEMS } from "@/lib/squad-bag";

export type RestorePpResult =
  | {
      ok: true;
      itemName: string;
      moveName: string;
      restoredBy: number;
      currentPp: number;
      maxPp: number;
      allMoves: boolean;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "not_found"
        | "no_leppa"
        | "full_pp"
        | "no_moves"
        | "in_combat";
    };

/**
 * Restaura PP con Ether / Leppa / Elixir (el más barato disponible).
 * Click derecho → "Restaurar PP".
 */
export async function restorePokemonPp(
  instanceId: string,
  locale: string,
): Promise<RestorePpResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    include: {
      moves: {
        include: { move: { select: { name: true, pp: true } } },
        orderBy: { slot: "asc" },
      },
    },
  });
  if (!instance) return { ok: false, error: "not_found" };
  if (instance.moves.length === 0) return { ok: false, error: "no_moves" };

  const depleted = instance.moves
    .map((m) => {
      const max = m.move.pp ?? 20;
      const current = effectivePp(m.currentPp, max);
      return { ...m, max, current, deficit: max - current };
    })
    .filter((m) => m.deficit > 0);

  if (depleted.length === 0) return { ok: false, error: "full_pp" };

  const stacks = await prisma.inventoryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      item: { name: { in: [...PP_RESTORE_ITEMS.map((i) => i.name)] } },
    },
    include: { item: { select: { id: true, name: true, buyPrice: true } } },
  });

  const usable = stacks
    .map((s) => {
      const spec = PP_RESTORE_ITEMS.find((i) => i.name === s.item.name);
      if (!spec) return null;
      return { ...s, spec };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => {
      // Preferir un solo movimiento, luego menor restore, luego más barato.
      if (a.spec.allMoves !== b.spec.allMoves) return a.spec.allMoves ? 1 : -1;
      if (a.spec.amount !== b.spec.amount) return a.spec.amount - b.spec.amount;
      return a.item.buyPrice - b.item.buyPrice;
    });

  const pick = usable[0];
  if (!pick) return { ok: false, error: "no_leppa" };

  const target = depleted.reduce((best, m) => (m.deficit > best.deficit ? m : best));

  if (pick.spec.allMoves) {
    // Guarda de cantidad en el descuento: sin ella, dos envíos simultáneos
    // restauraban el PP dos veces con un solo Elixir.
    const consumed = await prisma.$transaction(async (tx) => {
      if (!(await consumeInventoryItem(tx, { userId, itemId: pick.itemId }))) return false;
      for (const move of depleted) {
        await tx.pokemonMove.update({
          where: {
            pokemonInstanceId_slot: { pokemonInstanceId: instance.id, slot: move.slot },
          },
          data: { currentPp: Math.min(move.max, move.current + pick.spec.amount) },
        });
      }
      return true;
    });
    if (!consumed) return { ok: false, error: "no_leppa" };

    if (pick.quantity <= 1) {
      await clearEmptyInventoryRow(prisma, { userId, itemId: pick.itemId });
    }

    revalidatePaths(locale);
    const sample = depleted[0]!;
    const nextSample = Math.min(sample.max, sample.current + pick.spec.amount);
    return {
      ok: true,
      itemName: pick.item.name,
      moveName: sample.move.name,
      restoredBy: nextSample - sample.current,
      currentPp: nextSample,
      maxPp: sample.max,
      allMoves: true,
    };
  }

  const nextPp = Math.min(target.max, target.current + pick.spec.amount);
  const restoredBy = nextPp - target.current;

  const consumed = await prisma.$transaction(async (tx) => {
    if (!(await consumeInventoryItem(tx, { userId, itemId: pick.itemId }))) return false;
    await tx.pokemonMove.update({
      where: {
        pokemonInstanceId_slot: {
          pokemonInstanceId: instance.id,
          slot: target.slot,
        },
      },
      data: { currentPp: nextPp },
    });
    return true;
  });
  if (!consumed) return { ok: false, error: "no_leppa" };

  if (pick.quantity <= 1) {
    await prisma.inventoryItem.deleteMany({
      where: { userId, itemId: pick.itemId, quantity: { lte: 0 } },
    });
  }

  revalidatePaths(locale);

  return {
    ok: true,
    itemName: pick.item.name,
    moveName: target.move.name,
    restoredBy,
    currentPp: nextPp,
    maxPp: target.max,
    allMoves: false,
  };
}

function revalidatePaths(locale: string) {
  revalidatePath(`/${locale}`);
}
