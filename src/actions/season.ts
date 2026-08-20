"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import { currentSeasonKey } from "@/lib/pvp/seasons";
import { computeSeasonActivity, SEASON_MILESTONES } from "@/lib/season-journey";

export async function claimSeasonReward(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;
  if (!allowAction(`season:claim:${userId}`, 10, 60_000)) return;
  const xp = Number(formData.get("milestone"));
  const milestone = SEASON_MILESTONES.find((entry) => entry.xp === xp);
  if (!milestone) return;
  const seasonKey = currentSeasonKey();

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const activity = await computeSeasonActivity(userId, tx);
    if (activity.xp < milestone.xp) return;
    const inserted = await tx.seasonRewardClaim.createMany({
      data: [{ userId, seasonKey, milestone: milestone.xp }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return;
    const result = await grantRewards(tx, userId, milestone.rewards);
    await writeLedger(tx, { userId, source: "season", sourceRef: `${seasonKey}:${milestone.xp}`, result });
  });
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/season`);
}
