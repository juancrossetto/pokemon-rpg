import { prisma } from "@/lib/prisma";
import { nextWeeklyReset, serverNow, weekKey } from "@/lib/events/time";
import { RAID_ATTEMPTS_PER_WEEK, RAID_COMMUNITY_HP, raidBossForWeek } from "@/lib/raids/config";

export async function loadWeeklyRaid(userId: string) {
  const now = serverNow();
  const key = weekKey(now);
  const bossDef = raidBossForWeek(key);
  const [boss, score, total, leaders, clanRows, membership] = await Promise.all([
    prisma.species.findUniqueOrThrow({ where: { id: bossDef.speciesId } }),
    prisma.weeklyRaidScore.findUnique({ where: { userId_weekKey: { userId, weekKey: key } } }),
    prisma.weeklyRaidScore.aggregate({ where: { weekKey: key }, _sum: { totalDamage: true } }),
    prisma.weeklyRaidScore.findMany({
      where: { weekKey: key }, orderBy: { totalDamage: "desc" }, take: 10,
      include: { user: { select: { username: true, avatarId: true, country: true } } },
    }),
    prisma.weeklyRaidScore.findMany({
      where: { weekKey: key, user: { clanMembership: { isNot: null } } },
      orderBy: { totalDamage: "desc" }, take: 200,
      include: { user: { select: { clanMembership: { include: { clan: { select: { id: true, name: true } } } } } } },
    }),
    prisma.clanMember.findUnique({ where: { userId }, select: { clanId: true } }),
  ]);
  const clanMap = new Map<string, { id: string; name: string; damage: number }>();
  for (const row of clanRows) {
    const clan = row.user.clanMembership?.clan;
    if (!clan) continue;
    const previous = clanMap.get(clan.id);
    clanMap.set(clan.id, { id: clan.id, name: clan.name, damage: (previous?.damage ?? 0) + row.totalDamage });
  }
  const clans = [...clanMap.values()].sort((a, b) => b.damage - a.damage).slice(0, 5);
  const communityDamage = total._sum.totalDamage ?? 0;
  return {
    weekKey: key,
    resetsAt: nextWeeklyReset(now).toISOString(),
    boss: { ...bossDef, name: boss.name, spriteUrl: boss.spriteUrl, types: boss.types },
    score: score ?? { attemptsUsed: 0, totalDamage: 0, bestDamage: 0, rewardClaimedAt: null },
    attemptsLeft: Math.max(0, RAID_ATTEMPTS_PER_WEEK - (score?.attemptsUsed ?? 0)),
    communityDamage,
    communityHp: RAID_COMMUNITY_HP,
    communityDefeated: communityDamage >= RAID_COMMUNITY_HP,
    leaders: leaders.map((row, index) => ({ position: index + 1, userId: row.userId, username: row.user.username, avatarId: row.user.avatarId, country: row.user.country, damage: row.totalDamage })),
    clans,
    userClanId: membership?.clanId ?? null,
  };
}
