"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { blockIfInCombat } from "@/lib/battle-lock";
import { clearEmptyInventoryRow, consumeInventoryItem } from "@/lib/inventory-consume";
import { REVIVE_ITEMS, reviveHpFraction } from "@/lib/squad-bag";

export type RevivePokemonResult =
  | {
      ok: true;
      itemName: string;
      currentHp: number;
      maxHp: number;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "not_found"
        | "no_revives"
        | "not_fainted"
        | "in_combat";
    };

/**
 * Reanima un Pokémon debilitado (`currentHp <= 0`) con Revive / Max Revive.
 * Revive → 50% HP máx.; Max Revive → 100%.
 */
export async function revivePokemon(
  instanceId: string,
  locale: string,
): Promise<RevivePokemonResult> {
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
  if (instance.currentHp > 0) return { ok: false, error: "not_fainted" };

  const stacks = await prisma.inventoryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      item: { name: { in: [...REVIVE_ITEMS.map((i) => i.name)] } },
    },
    include: { item: { select: { id: true, name: true } } },
  });

  // Preferir Revive (más barato) antes que Max Revive.
  const ranked = REVIVE_ITEMS.map((spec) =>
    stacks.find((s) => s.item.name === spec.name),
  ).filter((s): s is NonNullable<typeof s> => s != null);

  const pick = ranked[0];
  if (!pick) return { ok: false, error: "no_revives" };

  const fraction = reviveHpFraction(pick.item.name) ?? 0.5;
  const revivedTo = Math.max(1, Math.floor(maxHp * fraction));

  // El descuento guarda la condición de cantidad: si el revive se gastó en
  // otra pestaña entre la lectura y acá, no se revive gratis.
  const consumed = await prisma.$transaction(async (tx) => {
    if (!(await consumeInventoryItem(tx, { userId, itemId: pick.itemId }))) return false;
    await tx.pokemonInstance.update({
      where: { id: instance.id },
      data: { currentHp: revivedTo },
    });
    return true;
  });
  if (!consumed) return { ok: false, error: "no_revives" };

  if (pick.quantity <= 1) {
    await clearEmptyInventoryRow(prisma, { userId, itemId: pick.itemId });
  }

  revalidatePath(`/${locale}`);

  return {
    ok: true,
    itemName: pick.item.name,
    currentHp: revivedTo,
    maxHp,
  };
}
