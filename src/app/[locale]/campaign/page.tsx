import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { gymLeaderImageUrl } from "@/lib/gym-art";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  activeChapterIndex,
  buildChapters,
  journeyProgressPercent,
  nextMilestone,
  regionMapSrc,
} from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import {
  CampaignJourney,
  type GymRequirement,
  type JourneySummary,
} from "@/components/campaign-journey";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  await redirectIfInBattle(userId, locale);

  const [t, , progress] = await Promise.all([
    getTranslations("campaign"),
    getTranslations("ux"),
    ensureCampaignProgress(userId),
  ]);

  const [zones, badges, gyms, team, shinies] = await Promise.all([
    loadMapLocations(userId, progress),
    prisma.badge.findMany({
      where: { userId },
      include: { gym: { select: { order: true } } },
    }),
    // El nivel recomendado sale del equipo real del líder, no de un número fijo.
    prisma.gym.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        name: true,
        type: true,
        badgeName: true,
        leaderName: true,
        isElite: true,
        team: { select: { level: true } },
      },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: { level: true },
    }),
    prisma.pokemonInstance.count({ where: { ownerId: userId, isShiny: true } }),
  ]);

  // El match va por `gymOrder`, que la zona ya trae de la data de campaña: por
  // nombre fallaba con el Alto Mando ("elite-lorelei" vs "Elite Four Lorelei").
  const gymOrderByLocationId: Record<string, number> = {};
  const requirementByLocationId: Record<string, GymRequirement> = {};
  for (const zone of zones) {
    if (zone.kindKey !== "kinds.gym" || zone.gymOrder === null) continue;
    const matched = gyms.find((g) => g.order === zone.gymOrder);
    if (!matched) continue;
    gymOrderByLocationId[zone.id] = matched.order;
    requirementByLocationId[zone.id] = {
      gymId: matched.id,
      badgeName: matched.badgeName,
      badgeType: matched.type,
      recommendedLevel: Math.max(...matched.team.map((p) => p.level), 1),
      // Sprite pixel del líder: identifica el gimnasio mejor que una medalla
      // genérica repetida en los ocho nodos.
      leaderSpriteUrl: gymLeaderImageUrl(matched.leaderName),
    };
  }

  const earnedOrders = badges.map((b) => b.gym.order);
  const eliteOrders = new Set(gyms.filter((g) => g.isElite).map((g) => g.order));
  const chapters = buildChapters(zones, earnedOrders, gymOrderByLocationId, eliteOrders);
  const initialChapter = activeChapterIndex(chapters, progress.farmingLocationId);

  const allSpecies = new Map(zones.flatMap((z) => z.encounters).map((e) => [e.speciesId, e]));
  const summary: JourneySummary = {
    badges: earnedOrders.filter((o) => !eliteOrders.has(o)).length,
    // Los sellos del Alto Mando no son medallas de gimnasio.
    badgesTotal: gyms.filter((g) => !g.isElite).length || 8,
    speciesCaught: [...allSpecies.values()].filter((e) => e.caught).length,
    speciesTotal: allSpecies.size,
    zonesUnlocked: zones.filter((z) => z.unlocked).length,
    zonesTotal: zones.length,
    shinies,
    journeyPercent: journeyProgressPercent(progress),
    teamMaxLevel: Math.max(...team.map((p) => p.level), 1),
  };

  const milestone = nextMilestone(progress, earnedOrders);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-4 md:py-6">
      <div className="mx-auto max-w-[1400px]">
        <CampaignJourney
          locale={locale}
          chapters={chapters}
          initialChapter={initialChapter}
          farmingLocationId={progress.farmingLocationId}
          farmingStageId={progress.farmingStageId}
          summary={summary}
          gymRequirements={requirementByLocationId}
          regionMapSrc={regionMapSrc(progress.currentRegionId)}
          milestone={milestone}
          progress={progress}
          earnedGymOrders={earnedOrders}
        />
      </div>
    </div>
  );
}
