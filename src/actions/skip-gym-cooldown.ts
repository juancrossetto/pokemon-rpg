"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { gymCooldownRemainingMs, gymCooldownSkipCost } from "@/lib/gym-cooldown";

export type SkipGymCooldownError =
  | "unauthorized"
  | "not_found"
  | "not_on_cooldown"
  | "no_gems"
  | "has_badge";

export type SkipGymCooldownResult =
  | { ok: true; cost: number; gemsLeft: number }
  | { ok: false; error: SkipGymCooldownError };

/**
 * Gasta gemas para anular el cooldown tras una derrota en un gimnasio.
 * Mueve el `attemptedAt` de la última derrota para que la espera ya haya
 * vencido (sin inventar una victoria falsa).
 */
export async function skipGymCooldown(
  gymId: string,
  locale: string,
): Promise<SkipGymCooldownResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, cooldownHours: true },
  });
  if (!gym) return { ok: false, error: "not_found" };

  const [badge, lastAttempt, user] = await Promise.all([
    prisma.badge.findUnique({
      where: { userId_gymId: { userId, gymId } },
      select: { id: true },
    }),
    prisma.gymAttempt.findFirst({
      where: { userId, gymId },
      orderBy: { attemptedAt: "desc" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { gems: true },
    }),
  ]);

  if (badge) return { ok: false, error: "has_badge" };
  if (!lastAttempt || lastAttempt.won) return { ok: false, error: "not_on_cooldown" };

  const remainingMs = gymCooldownRemainingMs({
    cooldownHours: gym.cooldownHours,
    attemptedAt: lastAttempt.attemptedAt,
  });
  if (remainingMs <= 0) return { ok: false, error: "not_on_cooldown" };

  const cost = gymCooldownSkipCost(remainingMs);
  if (user.gems < cost) return { ok: false, error: "no_gems" };

  const cooldownMs = gym.cooldownHours * 60 * 60 * 1000;
  let failure: SkipGymCooldownError | null = null;
  let gemsLeft = user.gems;

  await prisma.$transaction(async (tx) => {
    const paid = await tx.user.updateMany({
      where: { id: userId, gems: { gte: cost } },
      data: { gems: { decrement: cost } },
    });
    if (paid.count === 0) {
      failure = "no_gems";
      return;
    }

    await tx.gymAttempt.update({
      where: { id: lastAttempt.id },
      data: { attemptedAt: new Date(Date.now() - cooldownMs) },
    });

    const next = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { gems: true },
    });
    gemsLeft = next.gems;
  });

  if (failure) return { ok: false, error: failure };

  revalidatePath(`/${locale}/gyms`);
  revalidatePath(`/${locale}/gyms/${gymId}`);
  return { ok: true, cost, gemsLeft };
}
