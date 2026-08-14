import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { nextWeeklyReset, weekKey } from "@/lib/events/time";
import {
  SAFARI_BIOMES,
  SAFARI_ENCOUNTERS_PER_RUN,
  SAFARI_WEEKLY_RUNS,
  safariCatchChance,
  safariRarity,
} from "@/lib/safari";
import { SafariExpedition, type SafariViewData } from "@/components/safari/safari-expedition";

export default async function SafariPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  await redirectIfInBattle(session.user.id, locale);
  const userId = session.user.id;
  const currentWeek = weekKey();

  const speciesIds = [...new Set(SAFARI_BIOMES.flatMap((biome) => biome.species.map((entry) => entry.speciesId)))];
  const [species, attemptsUsed, activeRun, lastRun, leaders] = await Promise.all([
    prisma.species.findMany({
      where: { id: { in: speciesIds } },
      select: { id: true, name: true, spriteUrl: true },
    }),
    prisma.safariRun.count({ where: { userId, weekKey: currentWeek } }),
    prisma.safariRun.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { encounterSpecies: true, bestSpecies: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.safariRun.findFirst({
      where: { userId, status: "COMPLETED" },
      include: { bestSpecies: true },
      orderBy: { endedAt: "desc" },
    }),
    prisma.safariRun.findMany({
      where: { weekKey: currentWeek, status: "COMPLETED", bestScore: { gt: 0 } },
      include: { user: { select: { username: true } }, bestSpecies: true },
      orderBy: [{ bestScore: "desc" }, { endedAt: "asc" }],
      take: 100,
    }),
  ]);
  const speciesById = new Map(species.map((item) => [item.id, item]));
  const weeklyLeaders = leaders
    .filter((row, index, all) => all.findIndex((candidate) => candidate.userId === row.userId) === index)
    .slice(0, 10);

  const data: SafariViewData = {
    attemptsRemaining: Math.max(0, SAFARI_WEEKLY_RUNS - attemptsUsed),
    attemptsMax: SAFARI_WEEKLY_RUNS,
    resetAt: nextWeeklyReset().toISOString(),
    biomes: SAFARI_BIOMES.map((biome) => ({
      id: biome.id,
      accent: biome.accent,
      levelMin: biome.levelMin,
      levelMax: biome.levelMax,
      species: biome.species.flatMap((entry) => {
        const item = speciesById.get(entry.speciesId);
        return item
          ? [{ ...item, spriteUrl: `/safari/species/${item.id}.png`, rarity: entry.rarity }]
          : [];
      }),
    })),
    activeRun: activeRun
      ? {
          id: activeRun.id,
          biomeId: activeRun.biomeId,
          encountersUsed: activeRun.encountersUsed,
          encountersMax: SAFARI_ENCOUNTERS_PER_RUN,
          ballsRemaining: activeRun.ballsRemaining,
          catches: activeRun.catches,
          bestScore: activeRun.bestScore,
          best:
            activeRun.bestSpecies && activeRun.bestLevel != null
              ? {
                  name: activeRun.bestSpecies.name,
                  spriteUrl: activeRun.bestSpecies.spriteUrl,
                  level: activeRun.bestLevel,
                  isShiny: activeRun.bestIsShiny,
                }
              : null,
          encounter:
            activeRun.encounterSpecies && activeRun.encounterLevel != null
              ? {
                  name: activeRun.encounterSpecies.name,
                  spriteUrl: activeRun.encounterSpecies.spriteUrl,
                  level: activeRun.encounterLevel,
                  isShiny: activeRun.encounterIsShiny,
                  rarity: safariRarity(activeRun.biomeId, activeRun.encounterSpecies.id),
                  catchChance: Math.round(
                    safariCatchChance(
                      activeRun.encounterSpecies.captureRate,
                      safariRarity(activeRun.biomeId, activeRun.encounterSpecies.id),
                    ) * 100,
                  ),
                }
              : null,
        }
      : null,
    lastRun: lastRun
      ? {
          bestScore: lastRun.bestScore,
          rewardCoins: lastRun.rewardCoins,
          rewardGems: lastRun.rewardGems,
          catches: lastRun.catches,
          best:
            lastRun.bestSpecies && lastRun.bestLevel != null
              ? {
                  name: lastRun.bestSpecies.name,
                  spriteUrl: lastRun.bestSpecies.spriteUrl,
                  level: lastRun.bestLevel,
                  isShiny: lastRun.bestIsShiny,
                }
              : null,
        }
      : null,
    leaderboard: weeklyLeaders.map((row, index) => ({
      rank: index + 1,
      username: row.user.username,
      score: row.bestScore,
      speciesName: row.bestSpecies?.name ?? null,
      isShiny: row.bestIsShiny,
    })),
  };

  return <SafariExpedition locale={locale} data={data} />;
}
