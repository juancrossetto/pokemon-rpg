"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowUserAction } from "@/lib/rate-limit";
import { lockUsers } from "@/lib/db-locks";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import type { RewardDef } from "@/lib/events/rewards";
import { rewardsForAchievementRarity } from "@/lib/achievements/rewards";
import { loadTrainerStats } from "@/lib/achievements/stats";
import { ACHIEVEMENTS, buildAchievements } from "@/lib/trainer-profile";

export type ClaimAchievementResult =
  | {
      ok: true;
      granted: RewardDef[];
      coinsDelta: number;
      energyDelta: number;
      gemsDelta: number;
      claimedIds: string[];
    }
  | {
      ok: false;
      error:
        | "rate_limited"
        | "unauthorized" | "already_claimed" | "not_available" | "invalid";
    };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Reclama uno o todos los logros desbloqueados pendientes.
 *
 * El servidor recalcula unlock desde stats reales; el cliente solo manda el id
 * (o `"all"`). PK `[userId, achievementId]` + lock evitan doble cobro.
 */
export async function claimAchievement(
  locale: string,
  achievementId: string | "all",
): Promise<ClaimAchievementResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  // Sin límite, un bucle de reintentos martilla la base gratis.
  if (!(await allowUserAction("claim", "claim:achievement", userId))) {
    return { ok: false, error: "rate_limited" };
  }

  if (achievementId !== "all" && !ACHIEVEMENTS.some((a) => a.id === achievementId)) {
    return { ok: false, error: "invalid" };
  }

  let outcome: ClaimAchievementResult | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const stats = await loadTrainerStats(tx, userId);
      const achievements = buildAchievements(stats);
      const claimedRows = await tx.achievementClaim.findMany({
        where: { userId },
        select: { achievementId: true },
      });
      const already = new Set(claimedRows.map((r) => r.achievementId));

      const targets =
        achievementId === "all"
          ? achievements.filter((a) => a.unlocked && !already.has(a.id))
          : achievements.filter(
              (a) => a.id === achievementId && a.unlocked && !already.has(a.id),
            );

      if (targets.length === 0) {
        if (
          achievementId !== "all" &&
          achievements.some((a) => a.id === achievementId && a.unlocked) &&
          already.has(achievementId)
        ) {
          outcome = { ok: false, error: "already_claimed" };
          return;
        }
        outcome = { ok: false, error: "not_available" };
        return;
      }

      const grantedAll: RewardDef[] = [];
      let coinsDelta = 0;
      let energyDelta = 0;
      let gemsDelta = 0;
      const claimedIds: string[] = [];

      for (const ach of targets) {
        await tx.achievementClaim.create({
          data: { userId, achievementId: ach.id },
        });
        const bundle = rewardsForAchievementRarity(ach.rarity);
        const result = await grantRewards(tx, userId, bundle);
        await writeLedger(tx, {
          userId,
          source: "achievement",
          sourceRef: ach.id,
          result,
        });
        grantedAll.push(...result.granted);
        coinsDelta += result.coinsDelta;
        energyDelta += result.energyDelta;
        gemsDelta += result.gemsDelta;
        claimedIds.push(ach.id);
      }

      outcome = {
        ok: true,
        granted: grantedAll,
        coinsDelta,
        energyDelta,
        gemsDelta,
        claimedIds,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "already_claimed" };
    throw error;
  }

  const settled = outcome as ClaimAchievementResult | null;
  if (settled?.ok) {
    revalidatePath(`/${locale}/profile`);
    revalidatePath(`/${locale}`, "layout");
  }
  return settled ?? { ok: false, error: "invalid" };
}
