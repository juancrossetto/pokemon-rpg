"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockIfInCombat } from "@/lib/battle-lock";

/** Asigna slots PvP (1-6) a instancias del jugador. `null` saca del preset. */
export async function setPvpTeam(
  locale: string,
  slots: Array<{ instanceId: string; pvpSlot: number | null }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "auth" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const cleaned = slots
    .filter((s) => s.pvpSlot == null || (s.pvpSlot >= 1 && s.pvpSlot <= 6))
    .slice(0, 12);

  const ids = cleaned.map((s) => s.instanceId);
  const owned = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, id: { in: ids } },
    select: { id: true },
  });
  if (owned.length !== new Set(ids).size) {
    return { ok: false, error: "invalid" };
  }

  const used = new Set<number>();
  for (const s of cleaned) {
    if (s.pvpSlot == null) continue;
    if (used.has(s.pvpSlot)) return { ok: false, error: "duplicate_slot" };
    used.add(s.pvpSlot);
  }

  await prisma.$transaction(async (tx) => {
    // Primero limpia todos los pvpSlot del usuario para evitar unique conflicts.
    await tx.pokemonInstance.updateMany({
      where: { ownerId: userId, pvpSlot: { not: null } },
      data: { pvpSlot: null },
    });
    for (const s of cleaned) {
      if (s.pvpSlot == null) continue;
      await tx.pokemonInstance.update({
        where: { id: s.instanceId },
        data: { pvpSlot: s.pvpSlot },
      });
    }
  });

  revalidatePath(`/${locale}/pvp`);
  revalidatePath(`/${locale}/team`);
  return { ok: true };
}
