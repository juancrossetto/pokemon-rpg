import { prisma } from "@/lib/prisma";
import { compareTrainers, teamPower } from "@/lib/ranking";

const SPECIES_STATS_SELECT = {
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

export async function getClanRank(clanId: string): Promise<number> {
  const clans = await prisma.clan.findMany({
    select: {
      id: true,
      createdAt: true,
      members: {
        select: {
          user: {
            select: {
              _count: { select: { badges: true } },
              pokemon: {
                where: { teamSlot: { not: null } },
                select: {
                  level: true,
                  ptStrength: true,
                  ptDexterity: true,
                  ptIntelligence: true,
                  ptSpeed: true,
                  ptConstitution: true,
                  species: { select: SPECIES_STATS_SELECT },
                },
              },
            },
          },
        },
      },
    },
  });

  const ranked = clans
    .map((c) => {
      const badges = c.members.reduce((sum, m) => sum + m.user._count.badges, 0);
      const power = c.members.reduce((sum, m) => sum + teamPower(m.user.pokemon), 0);
      return { id: c.id, badges, power, createdAt: c.createdAt };
    })
    .sort((a, b) =>
      compareTrainers(
        { badges: a.badges, power: a.power, createdAt: a.createdAt },
        { badges: b.badges, power: b.power, createdAt: b.createdAt },
      ),
    );

  const index = ranked.findIndex((c) => c.id === clanId);
  return index >= 0 ? index + 1 : 0;
}
