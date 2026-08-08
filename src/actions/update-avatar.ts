"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { avatarById } from "@/lib/avatars";
import { isAvatarUnlocked } from "@/lib/avatar-unlocks";

export type UpdateAvatarResult =
  | { ok: true; avatarId: string }
  | { ok: false; error: "unauthorized" | "invalid" | "locked" };

async function earnedGymOrdersFor(userId: string): Promise<number[]> {
  const badges = await prisma.badge.findMany({
    where: { userId },
    select: { gym: { select: { order: true } } },
  });
  return badges.map((b) => b.gym.order);
}

/**
 * Cambia el retrato del entrenador.
 *
 * Valida catálogo + desbloqueo por medallas (ver `avatar-unlocks.ts`).
 */
export async function updateAvatar(
  avatarId: string,
  locale: string,
): Promise<UpdateAvatarResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const option = avatarById(avatarId);
  if (!option) return { ok: false, error: "invalid" };

  const orders = await earnedGymOrdersFor(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarId: true },
  });
  const keepCurrent = user?.avatarId === option.id;
  if (!keepCurrent && !isAvatarUnlocked(option.slug, orders)) {
    return { ok: false, error: "locked" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarId: option.id },
  });

  revalidatePath(`/${locale}`, "layout");

  return { ok: true, avatarId: option.id };
}
