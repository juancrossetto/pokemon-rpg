import { prisma } from "@/lib/prisma";
import { nextWeeklyReset, serverNow, weekKey } from "@/lib/events/time";
import {
  RAID_ATTEMPTS_PER_WEEK,
  RAID_BOSSES,
  RAID_COMMUNITY_HP,
  raidBossForWeek,
  raidWeekIndex,
} from "@/lib/raids/config";

export async function loadWeeklyRaid(userId: string) {
  const now = serverNow();
  const key = weekKey(now);
  const bossDef = raidBossForWeek(key);
  // Una sola query para toda la escalera: el rail necesita nombre y sprite de
  // los 11, y pedirlos de a uno serían 11 viajes por render de la página.
  const [boss, ladderRows, score, total, leaders, clanRows, membership, teamTop] = await Promise.all([
    prisma.species.findUniqueOrThrow({ where: { id: bossDef.speciesId } }),
    prisma.species.findMany({
      where: { id: { in: RAID_BOSSES.map((b) => b.speciesId) } },
      select: { id: true, name: true, spriteUrl: true },
    }),
    prisma.weeklyRaidScore.findUnique({ where: { userId_weekKey: { userId, weekKey: key } } }),
    prisma.weeklyRaidScore.aggregate({ where: { weekKey: key }, _sum: { totalDamage: true } }),
    prisma.weeklyRaidScore.findMany({
      where: { weekKey: key }, orderBy: { totalDamage: "desc" }, take: 10,
      include: { user: { select: { username: true, avatarId: true, country: true } } },
    }),
    prisma.weeklyRaidScore.findMany({
      where: { weekKey: key, user: { clanMembership: { isNot: null } } },
      orderBy: { totalDamage: "desc" }, take: 200,
      include: {
        user: {
          select: {
            clanMembership: {
              include: {
                clan: { select: { id: true, name: true, tag: true, emblem: true } },
              },
            },
          },
        },
      },
    }),
    prisma.clanMember.findUnique({ where: { userId }, select: { clanId: true } }),
    prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null } },
      orderBy: { level: "desc" },
      select: { level: true },
    }),
  ]);
  const clanMap = new Map<
    string,
    { id: string; name: string; tag: string; emblem: unknown; damage: number; members: number }
  >();
  for (const row of clanRows) {
    const clan = row.user.clanMembership?.clan;
    if (!clan) continue;
    const previous = clanMap.get(clan.id);
    clanMap.set(clan.id, {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      emblem: clan.emblem,
      damage: (previous?.damage ?? 0) + row.totalDamage,
      // Cuántos miembros aportaron: el ranking de clanes no decía si un clan
      // llegó con un jugador o con veinte.
      members: (previous?.members ?? 0) + 1,
    });
  }
  const clans = [...clanMap.values()].sort((a, b) => b.damage - a.damage).slice(0, 5);
  const communityDamage = total._sum.totalDamage ?? 0;
  return {
    weekKey: key,
    resetsAt: nextWeeklyReset(now).toISOString(),
    boss: { ...bossDef, name: boss.name, spriteUrl: boss.spriteUrl, types: boss.types },
    /**
     * Escalera completa con el escalón vigente marcado. `step` es la posición
     * dentro del ciclo, no el número de semana: al dar la vuelta (semana 12) el
     * rail vuelve a arrancar del principio y los "pasados" se recalculan solos.
     */
    ladder: RAID_BOSSES.map((entry, index) => {
      const species = ladderRows.find((row) => row.id === entry.speciesId);
      return {
        speciesId: entry.speciesId,
        name: species?.name ?? "",
        spriteUrl: species?.spriteUrl ?? "",
        level: entry.level,
        accent: entry.accent,
        step: index,
      };
    }),
    ladderStep:
      ((raidWeekIndex(key) % RAID_BOSSES.length) + RAID_BOSSES.length) % RAID_BOSSES.length,
    teamTopLevel: teamTop?.level ?? 0,
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
