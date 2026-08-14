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
  safariRank,
  safariRarity,
  safariSpeciesSprite,
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
  const [species, attemptsUsed, activeRun, lastRun, leaders, weeklyScores] = await Promise.all([
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
      include: {
        bestSpecies: true,
        captured: {
          include: { species: { select: { id: true, name: true } } },
          orderBy: { caughtAt: "asc" },
        },
      },
      orderBy: { endedAt: "desc" },
    }),
    prisma.safariRun.findMany({
      where: { weekKey: currentWeek, status: "COMPLETED", bestScore: { gt: 0 } },
      include: { user: { select: { username: true, avatarId: true } }, bestSpecies: true },
      orderBy: [{ bestScore: "desc" }, { endedAt: "asc" }],
      take: 100,
    }),
    prisma.safariRun.groupBy({
      by: ["userId"],
      where: { weekKey: currentWeek, status: "COMPLETED", bestScore: { gt: 0 } },
      _max: { bestScore: true },
    }),
  ]);
  const speciesById = new Map(species.map((item) => [item.id, item]));
  const weeklyLeaders = leaders
    .filter((row, index, all) => all.findIndex((candidate) => candidate.userId === row.userId) === index)
    .slice(0, 10);
  const rankedScores = weeklyScores
    .map((row) => ({ userId: row.userId, score: row._max.bestScore ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const playerRankIndex = rankedScores.findIndex((row) => row.userId === userId);

  const data: SafariViewData = {
    attemptsRemaining: Math.max(0, SAFARI_WEEKLY_RUNS - attemptsUsed),
    attemptsMax: SAFARI_WEEKLY_RUNS,
    playerRank: playerRankIndex >= 0
      ? { position: playerRankIndex + 1, score: rankedScores[playerRankIndex]!.score }
      : null,
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
                  id: activeRun.bestSpecies.id,
                  name: activeRun.bestSpecies.name,
                  spriteUrl: safariSpeciesSprite(activeRun.bestSpecies.id, activeRun.bestIsShiny),
                  level: activeRun.bestLevel,
                  isShiny: activeRun.bestIsShiny,
                }
              : null,
          encounter:
            activeRun.encounterSpecies && activeRun.encounterLevel != null
              ? {
                  id: activeRun.encounterSpecies.id,
                  name: activeRun.encounterSpecies.name,
                  spriteUrl: safariSpeciesSprite(activeRun.encounterSpecies.id, activeRun.encounterIsShiny),
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
          id: lastRun.id,
          bestScore: lastRun.bestScore,
          rank: safariRank(lastRun.bestScore),
          rewardCoins: lastRun.rewardCoins,
          rewardGems: lastRun.rewardGems,
          catches: lastRun.catches,
          best:
            lastRun.bestSpecies && lastRun.bestLevel != null
              ? {
                  id: lastRun.bestSpecies.id,
                  name: lastRun.bestSpecies.name,
                  spriteUrl: safariSpeciesSprite(lastRun.bestSpecies.id, lastRun.bestIsShiny),
                  level: lastRun.bestLevel,
                  isShiny: lastRun.bestIsShiny,
                }
              : null,
          captured: lastRun.captured.map((item) => ({
            id: item.species.id,
            name: item.species.name,
            spriteUrl: safariSpeciesSprite(item.species.id, item.isShiny),
            level: item.level,
            isShiny: item.isShiny,
          })),
        }
      : null,
    leaderboard: weeklyLeaders.map((row, index) => ({
      rank: index + 1,
      username: row.user.username,
      avatarId: row.user.avatarId,
      score: row.bestScore,
      speciesId: row.bestSpecies?.id ?? null,
      speciesName: row.bestSpecies?.name ?? null,
      speciesSpriteUrl: row.bestSpecies
        ? safariSpeciesSprite(row.bestSpecies.id, row.bestIsShiny)
        : null,
      isShiny: row.bestIsShiny,
    })),
  };

  return <SafariExpedition locale={locale} data={data} />;
}
