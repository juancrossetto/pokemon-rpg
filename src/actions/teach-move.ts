"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockIfInCombat } from "@/lib/battle-lock";
import { consumeInventoryItem } from "@/lib/inventory-consume";

export type TeachMoveResult =
  | { ok: true; moveName: string }
  | {
      ok: false;
      error: "unauthorized" | "not_found" | "no_tm" | "incompatible" | "already_known" | "in_combat";
    };

/**
 * Enseña un movimiento vía MT/MO — reemplaza el que ocupa `slot` (1-4).
 * Requiere: el ítem sea una MT/MO real en la mochila del jugador, y la
 * especie sea compatible con ese movimiento (SpeciesMove method=MACHINE).
 * Se consume 1 unidad del ítem siempre que la enseñanza se concrete.
 */
export async function teachMove(
  pokemonInstanceId: string,
  itemId: string,
  slot: number,
  locale: string,
): Promise<TeachMoveResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
    return { ok: false, error: "not_found" };
  }

  const [instance, inventoryItem] = await Promise.all([
    prisma.pokemonInstance.findFirst({
      where: { id: pokemonInstanceId, ownerId: userId },
      include: { moves: true },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),
  ]);
  if (!instance) return { ok: false, error: "not_found" };

  if (
    !inventoryItem ||
    inventoryItem.quantity < 1 ||
    inventoryItem.item.type !== "MACHINE" ||
    inventoryItem.item.moveId === null
  ) {
    return { ok: false, error: "no_tm" };
  }
  const moveId = inventoryItem.item.moveId;

  if (instance.moves.some((m) => m.moveId === moveId)) {
    return { ok: false, error: "already_known" };
  }

  const compatible = await prisma.speciesMove.findUnique({
    where: {
      speciesId_moveId_method: { speciesId: instance.speciesId, moveId, method: "MACHINE" },
    },
  });
  if (!compatible) return { ok: false, error: "incompatible" };

  const move = await prisma.move.findUniqueOrThrow({ where: { id: moveId } });

  // La MT se descuenta con guarda de cantidad: sin eso, dos envíos seguidos
  // enseñaban el movimiento dos veces gastando una sola copia.
  const consumed = await prisma.$transaction(async (tx) => {
    if (!(await consumeInventoryItem(tx, { userId, itemId }))) return false;
    await tx.pokemonMove.upsert({
      where: { pokemonInstanceId_slot: { pokemonInstanceId, slot } },
      create: { pokemonInstanceId, slot, moveId, currentPp: move.pp },
      update: { moveId, currentPp: move.pp },
    });
    return true;
  });
  if (!consumed) return { ok: false, error: "no_tm" };

  revalidatePath(`/${locale}/team`);
  return { ok: true, moveName: move.name };
}
