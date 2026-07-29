import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
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
import { CampaignDevPanel } from "@/components/campaign-dev-panel";
import {
  CampaignJourney,
  type GymRequirement,
  type JourneySummary,
} from "@/components/campaign-journey";
import { HubRoleHint } from "@/components/hub-role-hint";

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

  const [t, tUx, progress] = await Promise.all([
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

  const isDev = process.env.NODE_ENV === "development";
  const milestone = nextMilestone(progress, earnedOrders);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6 md:py-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
              {t("eyebrow")}
            </p>
            <h1 className="text-headline-lg tracking-tight text-white md:text-display-lg">
              {t("title")}
            </h1>
            <HubRoleHint>{tUx("role.campaign")}</HubRoleHint>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-label-md text-on-surface hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[18px]!">arrow_back</span>
            {t("backHome")}
          </Link>
        </header>

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
        />

        {isDev && (
          <div className="mt-4">
            <CampaignDevPanel locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}
