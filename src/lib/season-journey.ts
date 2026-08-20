import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSeasonKey, nextSeasonReset } from "@/lib/pvp/seasons";
import type { RewardBundle } from "@/lib/events/rewards";

export type SeasonMilestone = { xp: number; rewards: RewardBundle };

export const SEASON_MILESTONES: readonly SeasonMilestone[] = [
  { xp: 100, rewards: [{ kind: "coins", amount: 1_000 }] },
  { xp: 250, rewards: [{ kind: "energy", amount: 5 }, { kind: "coins", amount: 1_500 }] },
  { xp: 500, rewards: [{ kind: "gems", amount: 2 }, { kind: "coins", amount: 2_000 }] },
  { xp: 850, rewards: [{ kind: "energy", amount: 10 }, { kind: "gems", amount: 3 }] },
  { xp: 1_250, rewards: [{ kind: "coins", amount: 5_000 }, { kind: "gems", amount: 5 }] },
] as const;

type SeasonDb = Prisma.TransactionClient | typeof prisma;

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function computeSeasonActivity(userId: string, db: SeasonDb = prisma) {
  const since = monthStart();
  const [wins, catches, gyms, pvp, raids] = await Promise.all([
    db.battleLog.count({ where: { userId, userWon: true, createdAt: { gte: since } } }),
    db.pokemonInstance.count({ where: { ownerId: userId, caughtAt: { gte: since } } }),
    db.gymAttempt.count({ where: { userId, won: true, attemptedAt: { gte: since } } }),
    db.pvpMatch.count({
      where: {
        status: { in: ["COMPLETED", "FORFEIT"] },
        createdAt: { gte: since },
        OR: [{ challengerId: userId }, { opponentId: userId }],
      },
    }),
    db.weeklyRaidScore.aggregate({
      where: { userId, updatedAt: { gte: since } },
      _sum: { attemptsUsed: true },
    }),
  ]);
  const raidAttempts = raids._sum.attemptsUsed ?? 0;
  return {
    wins,
    catches,
    gyms,
    pvp,
    raids: raidAttempts,
    xp: wins * 10 + catches * 15 + gyms * 120 + pvp * 80 + raidAttempts * 50,
  };
}

export async function loadSeasonJourney(userId: string) {
  const seasonKey = currentSeasonKey();
  const [activity, claims] = await Promise.all([
    computeSeasonActivity(userId),
    prisma.seasonRewardClaim.findMany({ where: { userId, seasonKey }, select: { milestone: true } }),
  ]);
  const claimed = new Set(claims.map((claim) => claim.milestone));
  return {
    seasonKey,
    endsAt: nextSeasonReset().toISOString(),
    activity,
    milestones: SEASON_MILESTONES.map((milestone) => ({
      ...milestone,
      claimed: claimed.has(milestone.xp),
      claimable: activity.xp >= milestone.xp && !claimed.has(milestone.xp),
    })),
  };
}
