import { prisma } from "@/lib/prisma";
import { weekKey } from "@/lib/events/time";
import { SAFARI_WEEKLY_RUNS, safariSpeciesSprite } from "@/lib/safari";

/** Resumen deliberadamente chico para el carrusel del home. */
export async function loadSafariHomeCard(userId: string) {
  const key = weekKey();
  const [attemptsUsed, activeRun, lastRun, fallbackSpecies] = await Promise.all([
    prisma.safariRun.count({ where: { userId, weekKey: key } }),
    prisma.safariRun.findFirst({
      where: { userId, weekKey: key, status: "ACTIVE" },
      include: { bestSpecies: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.safariRun.findFirst({
      where: { userId, weekKey: key, status: "COMPLETED" },
      include: { bestSpecies: { select: { id: true, name: true } } },
      orderBy: { endedAt: "desc" },
    }),
    prisma.species.findUnique({
      where: { id: 123 },
      select: { id: true, name: true },
    }),
  ]);

  const source = activeRun ?? lastRun;
  const featured = source?.bestSpecies ?? fallbackSpecies ?? { id: 123, name: "scyther" };
  const featuredShiny = source?.bestSpecies ? source.bestIsShiny : false;

  return {
    attemptsLeft: Math.max(0, SAFARI_WEEKLY_RUNS - attemptsUsed),
    attemptsTotal: SAFARI_WEEKLY_RUNS,
    active: activeRun !== null,
    encountersUsed: activeRun?.encountersUsed ?? 0,
    catches: activeRun?.catches ?? lastRun?.catches ?? 0,
    score: activeRun?.bestScore ?? lastRun?.bestScore ?? 0,
    featured: {
      speciesId: featured.id,
      name: featured.name,
      spriteUrl: safariSpeciesSprite(featured.id, featuredShiny),
      isShiny: featuredShiny,
    },
  };
}
