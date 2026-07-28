"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockIfInCombat } from "@/lib/battle-lock";
import {
  MAX_NICKNAME_LENGTH,
  normalizeNickname,
  RENAME_COST,
} from "@/lib/nickname";

export type RenameError =
  | "unauthorized"
  | "not_found"
  | "no_coins"
  | "unchanged"
  | "in_combat"
  | "invalid";

export type RenamePokemonResult =
  | { ok: true; nickname: string | null; cost: number }
  | { ok: false; error: RenameError };

/**
 * Primer mote gratis (p. ej. al capturar). Solo si todavía no tiene nickname.
 */
export async function setPokemonNickname(
  instanceId: string,
  nickname: string,
  locale: string,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: session.user.id },
    select: { id: true, nickname: true },
  });
  if (!instance) return false;
  // Después del primer mote, hay que pasar por el Name Rater (pago).
  if (instance.nickname != null) return false;

  const next = normalizeNickname(nickname);
  if (next == null) return false;

  await prisma.pokemonInstance.update({
    where: { id: instance.id },
    data: { nickname: next },
  });

  revalidatePath(`/${locale}/team`);
  return true;
}

/**
 * Cambia o borra el mote pagando monedas (Name Rater).
 */
export async function renamePokemonPaid(
  instanceId: string,
  nickname: string,
  locale: string,
): Promise<RenamePokemonResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) {
    return { ok: false, error: "in_combat" };
  }

  if (nickname.length > MAX_NICKNAME_LENGTH + 8) {
    return { ok: false, error: "invalid" };
  }

  const next = normalizeNickname(nickname);
  let failure: RenameError | null = null;

  await prisma.$transaction(async (tx) => {
    const instance = await tx.pokemonInstance.findFirst({
      where: { id: instanceId, ownerId: userId },
      select: { id: true, nickname: true },
    });
    if (!instance) {
      failure = "not_found";
      return;
    }

    if (instance.nickname === next) {
      failure = "unchanged";
      return;
    }

    const paid = await tx.user.updateMany({
      where: { id: userId, coins: { gte: RENAME_COST } },
      data: { coins: { decrement: RENAME_COST } },
    });
    if (paid.count === 0) {
      failure = "no_coins";
      return;
    }

    await tx.pokemonInstance.update({
      where: { id: instance.id },
      data: { nickname: next },
    });
  });

  if (failure) return { ok: false, error: failure };

  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}`);
  return { ok: true, nickname: next, cost: RENAME_COST };
}
