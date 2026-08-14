"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { isDatabaseBusyError } from "@/lib/db-errors";
import { reportActionTiming } from "@/lib/action-metrics";
import { weekKey } from "@/lib/events/time";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import { calculateRaidDamage, RAID_ATTEMPTS_PER_WEEK, RAID_REWARD, raidBossForWeek } from "@/lib/raids/config";

export type RaidActionResult = { ok: true; damage: number; attemptsUsed: number; totalDamage: number; coins?: number } | { ok: false; error: "unauthorized" | "no_team" | "team_fainted" | "no_attempts" | "not_ready" | "claimed" | "busy" };

export async function attackWeeklyRaid(locale: string): Promise<RaidActionResult> {
  const startedAt = performance.now();
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  const key = weekKey();
  const boss = raidBossForWeek(key);
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const [current, team] = await Promise.all([
        tx.weeklyRaidScore.findUnique({ where: { userId_weekKey: { userId, weekKey: key } } }),
        tx.pokemonInstance.findMany({ where: { ownerId: userId, teamSlot: { not: null } }, orderBy: { teamSlot: "asc" }, include: { species: true } }),
      ]);
      if (team.length === 0) return { ok: false, error: "no_team" } as const;
      if (!team.some((member) => member.currentHp > 0)) return { ok: false, error: "team_fainted" } as const;
      const attemptsUsed = current?.attemptsUsed ?? 0;
      if (attemptsUsed >= RAID_ATTEMPTS_PER_WEEK) return { ok: false, error: "no_attempts" } as const;
      const damage = calculateRaidDamage(team, key, attemptsUsed + 1);
      const next = await tx.weeklyRaidScore.upsert({
        where: { userId_weekKey: { userId, weekKey: key } },
        create: { userId, weekKey: key, bossSpeciesId: boss.speciesId, attemptsUsed: 1, totalDamage: damage, bestDamage: damage },
        update: { attemptsUsed: { increment: 1 }, totalDamage: { increment: damage }, bestDamage: Math.max(current?.bestDamage ?? 0, damage) },
      });
      return { ok: true, damage, attemptsUsed: next.attemptsUsed, totalDamage: next.totalDamage } as const;
    }, { maxWait: 10_000, timeout: 20_000 });
    revalidatePath(`/${locale}/raids`);
    reportActionTiming("attackWeeklyRaid", startedAt, { ok: result.ok });
    return result;
  } catch (error) {
    reportActionTiming("attackWeeklyRaid", startedAt, { ok: false });
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}

export async function claimWeeklyRaidReward(locale: string): Promise<RaidActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  const key = weekKey();
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);
      const score = await tx.weeklyRaidScore.findUnique({ where: { userId_weekKey: { userId, weekKey: key } } });
      if (!score || score.attemptsUsed < RAID_ATTEMPTS_PER_WEEK) return { ok: false, error: "not_ready" } as const;
      if (score.rewardClaimedAt) return { ok: false, error: "claimed" } as const;
      const membership = await tx.clanMember.findUnique({ where: { userId }, select: { clanId: true } });
      const rewards = membership ? [...RAID_REWARD, { kind: "coins", amount: 250 } as const] : RAID_REWARD;
      await tx.weeklyRaidScore.update({ where: { userId_weekKey: { userId, weekKey: key } }, data: { rewardClaimedAt: new Date() } });
      const granted = await grantRewards(tx, userId, rewards);
      await writeLedger(tx, { userId, source: "raid", sourceRef: key, result: granted });
      return { ok: true, damage: 0, attemptsUsed: score.attemptsUsed, totalDamage: score.totalDamage, coins: granted.coinsDelta } as const;
    }, { maxWait: 10_000, timeout: 20_000 });
    revalidatePath(`/${locale}`, "layout");
    revalidatePath(`/${locale}/raids`);
    return result;
  } catch (error) {
    if (isDatabaseBusyError(error)) return { ok: false, error: "busy" };
    throw error;
  }
}
