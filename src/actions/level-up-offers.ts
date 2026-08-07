"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { blockIfInCombat } from "@/lib/battle-lock";
import {
  declinePendingMove,
  evolvePokemonInstance,
  learnPendingMove,
} from "@/lib/level-up";

export async function confirmLearnMove(
  instanceId: string,
  moveId: number,
  replaceSlot: number | null,
  locale: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (await blockIfInCombat(session.user.id, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const result = await learnPendingMove({
    userId: session.user.id,
    instanceId,
    moveId,
    replaceSlot,
  });
  if (!result.ok) return result;

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/battle`);
  revalidatePath(`/${locale}/pc`);
  return { ok: true };
}

/** Rechazo permanente: no se vuelve a ofrecer este movimiento al subir de nivel. */
export async function confirmDeclineMove(
  instanceId: string,
  moveId: number,
  locale: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (await blockIfInCombat(session.user.id, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const result = await declinePendingMove({
    userId: session.user.id,
    instanceId,
    moveId,
  });
  if (!result.ok) return result;

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/battle`);
  revalidatePath(`/${locale}/pc`);
  return { ok: true };
}

export async function confirmEvolve(
  instanceId: string,
  locale: string,
): Promise<
  | {
      ok: true;
      fromName: string;
      fromSpriteUrl: string;
      toName: string;
      toSpriteUrl: string;
      level: number;
      currentHp: number;
      maxHp: number;
    }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (await blockIfInCombat(session.user.id, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const result = await evolvePokemonInstance({
    userId: session.user.id,
    instanceId,
  });
  if (!result.ok) return result;

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/battle`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/pokedex`);
  return result;
}
