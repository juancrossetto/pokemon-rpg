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
import type { CampaignDockMember } from "@/components/campaign-party-dock";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { calculateMaxHp } from "@/lib/stats";
import { spriteFor } from "@/lib/shiny";
import {
  healCooldownMsLeft,
  healRushCost,
  isPokemonCenterFree,
} from "@/lib/healing";

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

  const [tHome, , progress] = await Promise.all([
    getTranslations("home"),
    getTranslations("ux"),
    ensureCampaignProgress(userId),
  ]);

  const [zones, badges, gyms, team, shinies, bagCounts, userHeal] = await Promise.all([
    loadMapLocations(userId, progress),
    prisma.badge.findMany({
      where: { userId, gym: { regionId: progress.currentRegionId } },
      include: { gym: { select: { order: true } } },
    }),
    // El nivel recomendado sale del equipo real del líder, no de un número fijo.
    prisma.gym.findMany({
      where: { regionId: progress.currentRegionId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        regionId: true,
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
      select: {
        id: true,
        level: true,
        currentHp: true,
        ptConstitution: true,
        nickname: true,
        isFavorite: true,
        isTradeLocked: true,
        isShiny: true,
        species: { select: { name: true, spriteUrl: true, baseHp: true } },
      },
      orderBy: { teamSlot: "asc" },
    }),
    prisma.pokemonInstance.count({ where: { ownerId: userId, isShiny: true } }),
    loadSquadBagCounts(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { coins: true, lastHealAt: true },
    }),
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

  const teamMaxLevel = Math.max(...team.map((p) => p.level), 1);
  const dockMembers: CampaignDockMember[] = team.map((p) => {
    const maxHp = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
    return {
      id: p.id,
      speciesName: p.species.name,
      nickname: p.nickname,
      spriteUrl: spriteFor(p.species.spriteUrl, p.isShiny),
      level: p.level,
      currentHp: Math.min(p.currentHp, maxHp),
      maxHp,
      isFavorite: p.isFavorite,
      isTradeLocked: p.isTradeLocked,
    };
  });
  const hurtCount = dockMembers.filter((m) => m.currentHp < m.maxHp).length;
  const needsHealing = hurtCount > 0;
  const healCdMs = isPokemonCenterFree(teamMaxLevel)
    ? 0
    : healCooldownMsLeft(userHeal.lastHealAt);

  const allSpecies = new Map(zones.flatMap((z) => z.encounters).map((e) => [e.speciesId, e]));
  const summary: JourneySummary = {
    badges: earnedOrders.filter((o) => !eliteOrders.has(o)).length,
    // Los sellos del Alto Mando no son medallas de gimnasio.
    badgesTotal:
      gyms.filter((g) => !g.isElite && g.regionId === progress.currentRegionId).length ||
      8,
    speciesCaught: [...allSpecies.values()].filter((e) => e.caught).length,
    speciesTotal: allSpecies.size,
    zonesUnlocked: zones.filter((z) => z.unlocked).length,
    zonesTotal: zones.length,
    shinies,
    journeyPercent: journeyProgressPercent(progress),
    teamMaxLevel,
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
          party={{
            members: dockMembers,
            bagCounts,
            heal: {
              needsHealing,
              cooldownMsLeft: healCdMs,
              rushCost: healRushCost(hurtCount),
              coins: userHeal.coins,
              teamMaxLevel,
            },
            menuLabels: {
              favoriteOn: tHome("squadMenu.favoriteOn"),
              favoriteOff: tHome("squadMenu.favoriteOff"),
              lockOn: tHome("squadMenu.lockOn"),
              lockOff: tHome("squadMenu.lockOff"),
              viewTeam: tHome("squadMenu.viewTeam"),
              depositToPc: tHome("squadMenu.depositToPc"),
              depositLastBlocked: tHome("squadMenu.depositLastBlocked"),
              depositLockedBlocked: tHome("squadMenu.depositLockedBlocked"),
              hint: tHome("squadMenu.hint"),
              heal: tHome("squadMenu.heal"),
              revive: tHome("squadMenu.revive"),
              restorePp: tHome("squadMenu.restorePp"),
              rareCandy: tHome("squadMenu.rareCandy"),
            },
          }}
        />
      </div>
    </div>
  );
}
