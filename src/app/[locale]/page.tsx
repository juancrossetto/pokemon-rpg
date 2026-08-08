import { getTranslations, getLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spriteFor } from "@/lib/shiny";
import { calculateMaxHp, calculateStat, xpForLevel, xpToNextLevel } from "@/lib/stats";
import { effectivePp } from "@/lib/battle";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { buildExpeditionView } from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import { loadEventsSummary } from "@/lib/events/state";
import { getNextStep, isEliteMilestone } from "@/lib/next-step";
import { HomeGameHub } from "@/components/home/home-game-hub";
import { NextStepCard } from "@/components/home/next-step-card";
import { PvpRankUpHost } from "@/components/pvp/pvp-rank-up-host";
import type { HomeSquadMember } from "@/components/home/squad-types";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { loadEvolutionChainsForTeam, loadOwnedEvolutionItems } from "@/lib/evolution-chain";
import { loadCombatPowerBoard } from "@/lib/ranking-boards";
import { loadTrainerStats } from "@/lib/achievements/stats";
import {
  buildAchievements,
  rankProgress,
  trainerTitle,
} from "@/lib/trainer-profile";
import { pokemonPower } from "@/lib/ranking";
import { regionMeta } from "@/lib/campaign/regions";
import { regionBadgeTarget } from "@/lib/regions";
import { resolveItemDisplayName } from "@/lib/shop";
import { evaluateObjectives } from "@/lib/campaign/objectives";
import { buildAdventureGuide } from "@/lib/adventure-guide";
import { avatarById } from "@/lib/avatars";
import { findNavItem } from "@/lib/navigation";
import { dayKey, serverNow } from "@/lib/events/time";
import {
  healCooldownMsLeft,
  healRushCost,
  isPokemonCenterFree,
  minutesLeft,
} from "@/lib/healing";
import type {
  HomeDailyAction,
  HomeIdentity,
  HomeObjective,
  HomeRailPvp,
  HomeRailPvpMatch,
} from "@/lib/home-hub";
import type { HomeHubLabels } from "@/components/home/home-game-hub";
import { rankForRating, type PvpTier } from "@/lib/pvp/tiers";

const TEAM_SIZE = 6;

/** Racha de días consecutivos con reclamo diario (hoy o ayer como ancla). */
async function loadLoginStreak(userId: string): Promise<number> {
  const rows = await prisma.dailyRewardClaim.findMany({
    where: { userId },
    select: { dayKey: true },
    distinct: ["dayKey"],
    orderBy: { dayKey: "desc" },
    take: 60,
  });
  if (rows.length === 0) return 0;
  const keys = new Set(rows.map((r) => r.dayKey));
  const today = dayKey(serverNow());
  const yesterdayDate = new Date(serverNow().getTime() - 86_400_000);
  const yesterday = dayKey(yesterdayDate);

  let anchor = "";
  if (keys.has(today)) anchor = today;
  else if (keys.has(yesterday)) anchor = yesterday;
  else return 0;

  let streak = 0;
  let current = anchor;
  while (keys.has(current)) {
    streak += 1;
    const parts = current.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const previous = new Date(Date.UTC(year, month - 1, day - 1));
    current = previous.toISOString().slice(0, 10);
  }
  return streak;
}

export default async function Home() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);
  return <Dashboard username={session.user.name ?? ""} userId={session.user.id} />;
}

async function Dashboard({ username, userId }: { username: string; userId: string }) {
  const [t, tt, tShop, locale, progress, badges] = await Promise.all([
    getTranslations("home"),
    getTranslations("team"),
    getTranslations("shop"),
    getLocale(),
    ensureCampaignProgress(userId),
    prisma.badge.findMany({
      where: { userId },
      include: {
        gym: { select: { order: true, badgeName: true, type: true, isElite: true, regionId: true } },
      },
    }),
  ]);

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    include: {
      species: true,
      heldItem: { select: { name: true } },
      moves: {
        include: { move: { select: { name: true, type: true, pp: true } } },
        orderBy: { slot: "asc" },
      },
    },
    orderBy: { teamSlot: "asc" },
  });
  const bagCounts = await loadSquadBagCounts(userId);

  if (pokemon.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-8 text-center">
        <p className="text-label-md text-pokeball-red uppercase tracking-widest">
          {t("greeting", { username })}
        </p>
        <h1 className="page-title max-w-xl text-headline-lg text-white md:text-display-lg">
          {t("noTeamTitle")}
        </h1>
        <p className="max-w-md text-body-lg text-on-surface-variant">{t("noTeamSubtitle")}</p>
        <Link
          href="/starter"
          className="ui-btn-primary mt-2 px-6 py-2 text-label-md"
        >
          {t("chooseStarterLink")}
        </Link>
      </div>
    );
  }

  const [
    eventsSummary,
    tEvents,
    tProfile,
    tCampaign,
    tPvp,
    userRow,
    trainerStats,
    achievementClaims,
    loginStreak,
    recentPvpMatches,
  ] = await Promise.all([
    loadEventsSummary(userId),
    getTranslations("events"),
    getTranslations("profile"),
    getTranslations("campaign"),
    getTranslations("pvp"),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        avatarId: true,
        homeBannerId: true,
        homeFrameId: true,
        country: true,
        coins: true,
        lastHealAt: true,
        clanMembership: {
          select: {
            clan: { select: { id: true, tag: true, name: true, emblem: true } },
          },
        },
      },
    }),
    loadTrainerStats(prisma, userId),
    prisma.achievementClaim.findMany({
      where: { userId },
      select: { achievementId: true },
    }),
    loadLoginStreak(userId),
    prisma.pvpMatch.findMany({
      where: {
        OR: [{ challengerId: userId }, { opponentId: userId }],
        status: { in: ["COMPLETED", "FORFEIT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
        winnerId: true,
        mode: true,
        createdAt: true,
        challengerRatingBefore: true,
        challengerRatingAfter: true,
        opponentRatingBefore: true,
        opponentRatingAfter: true,
        challenger: { select: { username: true, country: true, avatarId: true } },
        opponent: { select: { username: true, country: true, avatarId: true } },
      },
    }),
  ]);

  const giftLabels = {
    eyebrow: tEvents("eyebrow"),
    title: tEvents("giftTitle"),
    subtitle: tEvents("giftSubtitle"),
    progress: tEvents("giftProgress", { current: "{current}", total: "{total}" }),
    claim: tEvents("dailyClaim"),
    claiming: tEvents("bannerClaiming"),
    close: tEvents("close"),
    claimedTitle: tEvents("giftClaimedTitle"),
    continueLabel: tEvents("giftContinue"),
    reopen: tEvents("giftReopen"),
    dailyDay: tEvents("dailyDay", { day: "{day}" }),
    statusToday: tEvents("statusToday"),
    statusClaimed: tEvents("statusClaimed"),
    statusUpcoming: tEvents("statusUpcoming"),
    badgeSpecial: tEvents("badgeSpecial"),
    badgeRare: tEvents("badgeRare"),
    rewards: {
      coins: tEvents("rewards.coins"),
      energy: tEvents("rewards.energy"),
      item: tEvents("rewards.item"),
    },
  };

  const speciesIds = [...new Set(pokemon.map((p) => p.speciesId))];
  const [evolutionChains, ownedEvolutionItems] = await Promise.all([
    loadEvolutionChainsForTeam(userId, speciesIds),
    loadOwnedEvolutionItems(userId),
  ]);
  const ownedEvolutionItemNames = [...ownedEvolutionItems];

  const bySlot = new Map(pokemon.map((p) => [p.teamSlot, p]));
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => bySlot.get(i + 1) ?? null);
  const regionBadges = badges.filter((b) => b.gym.regionId === progress.currentRegionId);
  const expedition = buildExpeditionView(
    progress,
    regionBadges.map((b) => b.gym.order),
  );
  const mapLocations = await loadMapLocations(userId, progress);

  const spawnSpecies = expedition
    ? await prisma.species.findMany({
        where: { id: { in: expedition.stage.spawnSpeciesIds } },
        select: { types: true },
      })
    : [];
  const wildTypes = Array.from(new Set(spawnSpecies.flatMap((s) => s.types))).slice(0, 4);

  const locationStages = expedition
    ? expedition.location.stages.filter((s) => !s.isGymMilestone)
    : [];
  const locationStagesDone = locationStages.filter((s) =>
    progress.completedStageIds.includes(s.id),
  ).length;

  const milestone = expedition?.milestone;

  /**
   * Próximo paso del jugador.
   *
   * Solo cuentan las medallas regulares: los sellos del Alto Mando también son
   * filas de `Badge`, y contarlos haría que el jugador pareciera tener 9 de 8.
   *
   * El hub `/gyms` no lista los nodos élite (`computeGymStatuses` los filtra),
   * así que cuando el hito es uno de ellos hay que resolver su id y linkear
   * directo — si no, el CTA del hero aterriza en una pantalla que se ve
   * terminada y no ofrece a dónde seguir.
   */
  const badgeTotal = regionBadgeTarget(progress.currentRegionId);
  const regularBadgeCount = regionBadges.filter(
    (b) => !b.gym.isElite && b.gym.order <= badgeTotal,
  ).length;
  const eliteGym =
    milestone && isEliteMilestone(milestone, badgeTotal)
      ? await prisma.gym.findFirst({
          where: {
            order: milestone.gymOrder,
            regionId: progress.currentRegionId,
          },
          select: { id: true },
        })
      : null;
  const eliteGymHref = eliteGym ? `/gyms/${eliteGym.id}` : null;
  const nextStep = getNextStep({
    teamSize: pokemon.length,
    badgeCount: regularBadgeCount,
    totalBadges: badgeTotal,
    milestone: milestone ?? null,
    eliteGymHref,
  });
  const topBoard = await loadCombatPowerBoard("", userId);
  const railTop = topBoard.slice(0, 5).map((row) => ({
    position: row.position,
    playerId: row.playerId,
    playerName: row.playerName,
    countryCode: row.countryCode ?? "",
    avatarId: row.avatarId ?? null,
    combatPower: row.combatPower ?? 0,
    isCurrentPlayer: Boolean(row.isCurrentPlayer),
    featured: row.featuredCreature
      ? {
          name: row.featuredCreature.name,
          image: row.featuredCreature.image,
          isShiny: Boolean(row.featuredCreature.isShiny),
        }
      : null,
  }));

  const members: HomeSquadMember[] = slots
    .filter((instance): instance is NonNullable<typeof instance> => instance !== null)
    .map((instance): HomeSquadMember => {
      const maxHp = calculateMaxHp(
        instance.species.baseHp,
        instance.level,
        instance.ptConstitution,
      );
      const xpForCurrent = xpForLevel(instance.level);
      const xpToNext = xpToNextLevel(instance.xp, instance.level);
      const xpIntoLevel = instance.xp - xpForCurrent;
      const levelSpan = xpIntoLevel + xpToNext;
      const xpPct =
        levelSpan > 0 ? Math.max(0, Math.min(100, (xpIntoLevel / levelSpan) * 100)) : 0;

      const movesBySlot = new Map(instance.moves.map((m) => [m.slot, m]));
      const moves = Array.from({ length: 4 }, (_, slotIdx) => {
        const m = movesBySlot.get(slotIdx + 1);
        if (!m) return null;
        const maxPp = m.move.pp ?? 20;
        return {
          slot: slotIdx + 1,
          name: m.move.name,
          type: m.move.type,
          currentPp: effectivePp(m.currentPp, maxPp),
          maxPp,
        };
      });

      return {
        id: instance.id,
        speciesId: instance.speciesId,
        level: instance.level,
        isFavorite: instance.isFavorite,
        isTradeLocked: instance.isTradeLocked,
        nickname: instance.nickname,
        speciesName: instance.species.name,
        types: instance.species.types,
        spriteUrl: spriteFor(instance.species.spriteUrl, instance.isShiny),
        currentHp: instance.currentHp,
        maxHp,
        xpPct,
        xpToNextLabel: tt("expToNext", { xp: xpToNext }),
        levelLabel: tt("level", { level: instance.level }),
        atk: calculateStat(instance.species.baseAttack, instance.ptStrength, instance.level),
        def: calculateStat(instance.species.baseDefense, instance.ptDexterity, instance.level),
        spAtk: calculateStat(
          instance.species.baseSpAtk,
          instance.ptIntelligence,
          instance.level,
        ),
        spDef: calculateStat(
          instance.species.baseSpDef,
          instance.ptIntelligence,
          instance.level,
        ),
        speed: calculateStat(instance.species.baseSpeed, instance.ptSpeed, instance.level),
        evolutionChain: evolutionChains.get(instance.speciesId) ?? [],
        ownedEvolutionItems: ownedEvolutionItemNames,
        heldItemName: instance.heldItem
          ? resolveItemDisplayName(instance.heldItem.name, (key) => {
              const path = `names.${key}`;
              return tShop.has(path) ? tShop(path) : null;
            })
          : null,
        moves,
        labels: {
          hp: tt("stats.hp"),
          exp: tt("stats.exp"),
          atk: tt("stats.atk"),
          def: tt("stats.def"),
          spAtk: tt("stats.spAtk"),
          spDef: tt("stats.spDef"),
          speed: tt("stats.speed"),
          fainted: tt("fainted"),
          favorite: t("squadMenu.favoriteBadge"),
          tradeLocked: t("squadMenu.lockedBadge"),
          pp: tt("drawer.pp"),
          emptyMove: tt("drawer.emptySlotMove"),
          showDetails: tt("drawer.showDetails"),
          hideDetails: tt("drawer.hideDetails"),
          tabAbout: tt("drawer.tabAbout"),
          tabStats: tt("drawer.tabStats"),
          tabEvolutions: tt("drawer.tabEvolutions"),
          unknownSpecies: tt("drawer.unknownSpecies"),
          evolveAtLevel: tt("drawer.evolveAtLevel", { level: "{level}" }),
          evolveByTrade: tt("drawer.evolveByTrade"),
          evolveTradeItemHint: tt("drawer.evolveTradeItemHint"),
          evolveStones: tt.raw("drawer.evolveStones") as Record<string, string>,
          evolveReadyShort: tt("drawer.evolveReadyShort"),
          evolveNeedItem: tt("drawer.evolveNeedItem"),
          evolveNeedLevel: tt("drawer.evolveNeedLevel", { level: "{level}" }),
          evolveNow: tt("drawer.evolveNow"),
          evolveUseStone: tt("drawer.evolveUseStone", { item: "{item}" }),
          evolving: tt("drawer.evolving"),
          canEvolveBadge: tt("drawer.canEvolveBadge"),
        },
        menuLabels: {
          favoriteOn: t("squadMenu.favoriteOn"),
          favoriteOff: t("squadMenu.favoriteOff"),
          lockOn: t("squadMenu.lockOn"),
          lockOff: t("squadMenu.lockOff"),
          viewTeam: t("squadMenu.viewTeam"),
          depositToPc: t("squadMenu.depositToPc"),
          depositLastBlocked: t("squadMenu.depositLastBlocked"),
          depositLockedBlocked: t("squadMenu.depositLockedBlocked"),
          hint: t("squadMenu.hint"),
          heal: t("squadMenu.heal"),
          revive: t("squadMenu.revive"),
          restorePp: t("squadMenu.restorePp"),
          rareCandy: t("squadMenu.rareCandy"),
        },
      };
    });

  const farmingZoneEarly =
    mapLocations.find((l) => l.id === progress.farmingLocationId) ??
    mapLocations.find((l) => l.id === expedition?.location.id) ??
    null;
  const zoneObjectivesEarly = farmingZoneEarly
    ? evaluateObjectives(farmingZoneEarly, new Set(farmingZoneEarly.claimedObjectives))
    : [];
  const claimableCount = zoneObjectivesEarly.filter((o) => o.claimable).length;
  const teamHurtEarly = pokemon.filter((p) => {
    const maxHp = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
    return p.currentHp < maxHp;
  }).length;

  const expeditionProps =
    expedition && milestone
      ? {
          locationNameKey: expedition.location.nameKey,
          locationKindKey: `kinds.${expedition.location.kind}`,
          locationKind: expedition.location.kind,
          stageNameKey: expedition.stage.nameKey,
          mapSrc: expedition.regionMapSrc,
          milestone,
          regionNameKey: `regions.${expedition.regionId}`,
          wildTypes,
          levelMin: expedition.stage.levelMin,
          levelMax: expedition.stage.levelMax,
          locale,
          locations: mapLocations,
          farmingLocationId: progress.farmingLocationId,
          farmingStageId: progress.farmingStageId,
          stagesDone: locationStagesDone,
          stagesTotal: locationStages.length,
          gymHref: eliteGymHref,
          guideSteps: buildAdventureGuide({
            milestoneKind: milestone.kind,
            stagesDone: locationStagesDone,
            stagesTotal: locationStages.length,
            claimableCount,
            needsHealing: teamHurtEarly > 0,
            gymHref: eliteGymHref,
          }),
        }
      : null;

  const combatPower = pokemon.reduce(
    (sum, p) =>
      sum +
      pokemonPower({
        level: p.level,
        ptStrength: p.ptStrength,
        ptDexterity: p.ptDexterity,
        ptIntelligence: p.ptIntelligence,
        ptSpeed: p.ptSpeed,
        ptConstitution: p.ptConstitution,
        species: {
          baseHp: p.species.baseHp,
          baseAttack: p.species.baseAttack,
          baseDefense: p.species.baseDefense,
          baseSpAtk: p.species.baseSpAtk,
          baseSpDef: p.species.baseSpDef,
          baseSpeed: p.species.baseSpeed,
        },
      }),
    0,
  );

  const statsWithPower = { ...trainerStats, power: combatPower };
  const rank = rankProgress(statsWithPower.badges, statsWithPower.totalGyms);
  const titleId = trainerTitle(statsWithPower);
  const achievements = buildAchievements(
    statsWithPower,
    achievementClaims.map((c) => c.achievementId),
  );
  const lastAchievement =
    achievements.find((a) => a.unlocked)?.id ??
    achievements.find((a) => a.pct > 0)?.id ??
    null;

  const region = regionMeta(progress.currentRegionId);
  const avatar = avatarById(userRow.avatarId);
  const companion =
    members.find((m) => m.isFavorite) ?? members[0] ?? null;

  const dateLabelFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
  });
  const railPvpRecent: HomeRailPvpMatch[] = recentPvpMatches.map((m) => {
    const asChallenger = m.challengerId === userId;
    const foe = asChallenger ? m.opponent : m.challenger;
    const before = asChallenger ? m.challengerRatingBefore : m.opponentRatingBefore;
    const after = asChallenger ? m.challengerRatingAfter : m.opponentRatingAfter;
    return {
      id: m.id,
      won: m.winnerId === userId,
      opponentName: foe.username,
      opponentCountry: foe.country ?? "",
      opponentAvatarId: foe.avatarId,
      mode: m.mode === "QUICK" ? "QUICK" : "RANKED",
      ratingDelta: (after ?? before ?? 0) - (before ?? 0),
      dateLabel: dateLabelFmt.format(m.createdAt).replace(/\//g, "."),
    };
  });
  const pvpStanding = rankForRating(trainerStats.pvpRating);
  const railPvp: HomeRailPvp = {
    rating: trainerStats.pvpRating,
    wins: trainerStats.pvpWins,
    losses: trainerStats.pvpLosses,
    tier: pvpStanding.tier,
    division: pvpStanding.division,
    selfName: userRow.username || username,
    selfAvatarId: userRow.avatarId,
    selfCountry: userRow.country ?? "",
    recent: railPvpRecent,
  };

  const identity: HomeIdentity = {
    username: userRow.username || username,
    avatarId: userRow.avatarId,
    avatarSrc: avatar?.src ?? null,
    avatarProfileSrc: avatar?.profileSrc ?? null,
    avatarStageSrc: avatar?.stageSrc ?? null,
    level: statsWithPower.topLevel,
    titleId,
    rankTierId: rank.tier.id,
    pvpTier: pvpStanding.tier,
    pvpDivision: pvpStanding.division,
    pvpRating: trainerStats.pvpRating,
    regionId: region.id,
    regionLabel: tCampaign(`regions.${region.id}`),
    combatPower,
    clanTag: userRow.clanMembership?.clan.tag ?? null,
    clanName: userRow.clanMembership?.clan.name ?? null,
    clanEmblem: userRow.clanMembership?.clan.emblem ?? null,
    loginStreak,
    lastAchievementId: lastAchievement,
    country: userRow.country,
    companionTypes: companion?.types ?? [],
    homeBannerId: userRow.homeBannerId,
    homeFrameId: userRow.homeFrameId,
  };

  const myClanId = userRow.clanMembership?.clan.id ?? null;
  const activeClanWar = myClanId
    ? await prisma.clanWar.findFirst({
        where: {
          status: { in: ["ACTIVE", "COMPLETED"] },
          OR: [{ clanAId: myClanId }, { clanBId: myClanId }],
        },
        orderBy: { matchedAt: "desc" },
        include: {
          clanA: { select: { id: true, name: true, tag: true, emblem: true } },
          clanB: { select: { id: true, name: true, tag: true, emblem: true } },
        },
      })
    : null;
  const warIsSelfA = activeClanWar?.clanAId === myClanId;
  const warRival = activeClanWar
    ? warIsSelfA
      ? activeClanWar.clanB
      : activeClanWar.clanA
    : null;
  const clanWarsRail = {
    clanId: myClanId,
    clanName: userRow.clanMembership?.clan.name ?? null,
    clanTag: userRow.clanMembership?.clan.tag ?? null,
    clanEmblem: userRow.clanMembership?.clan.emblem ?? null,
    scoreSelf: activeClanWar
      ? warIsSelfA
        ? activeClanWar.scoreA
        : activeClanWar.scoreB
      : null,
    scoreRival: activeClanWar
      ? warIsSelfA
        ? activeClanWar.scoreB
        : activeClanWar.scoreA
      : null,
    rivalName: warRival?.name ?? null,
    rivalTag: warRival?.tag ?? null,
    rivalEmblem: warRival?.emblem ?? null,
    status: (activeClanWar?.status === "COMPLETED"
      ? "completed"
      : activeClanWar
        ? "active"
        : "none") as "none" | "active" | "completed",
  };

  const farmingZone = farmingZoneEarly;
  const zoneObjectives = zoneObjectivesEarly;
  const homeObjectives: HomeObjective[] = zoneObjectives.map((o) => ({
    id: o.id,
    labelKey: o.id,
    current: o.current,
    target: o.target,
    done: o.done,
    claimable: o.claimable,
    claimed: o.claimed,
    rewardCoins: o.reward.coins,
    rewardItem: o.reward.itemName,
    rewardQty: o.reward.quantity,
  }));
  const objectiveZoneName = farmingZone
    ? tCampaign(farmingZone.nameKey)
    : null;
  const objectiveZoneId = farmingZone?.id ?? null;

  const gymReady = milestone?.kind === "gym";
  const dailyCanClaim = eventsSummary.daily.canClaim;

  const teamMaxLevel = pokemon.reduce((max, p) => Math.max(max, p.level), 0);
  const hurtCount = pokemon.filter((p) => {
    const maxHp = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
    return p.currentHp < maxHp;
  }).length;
  const needsHealing = hurtCount > 0;
  const healCdMs = healCooldownMsLeft(userRow.lastHealAt);
  const healNoviceFree = isPokemonCenterFree(teamMaxLevel);
  const healReady = needsHealing && (healNoviceFree || healCdMs <= 0);
  const healRush = healRushCost(hurtCount);

  const dailyActions: HomeDailyAction[] = [
    {
      id: "daily",
      href: null,
      openDailyGift: true,
      iconSrc: "/nav/event-icon.png?v=4",
      labelKey: "daily",
      status: dailyCanClaim
        ? t("hub.dailyActions.statusAvailable")
        : t("hub.dailyActions.statusDone"),
      hot: dailyCanClaim,
    },
    {
      id: "pvp",
      href: findNavItem("pvp")?.href ?? "/pvp",
      iconSrc: findNavItem("pvp")?.iconSrc ?? "/nav/pvp-icon.png?v=4",
      labelKey: "pvp",
      status: t("hub.dailyActions.statusBadges", {
        count: railPvp.wins,
        total: Math.max(railPvp.wins + railPvp.losses, 1),
      }),
      hot: false,
    },
    {
      id: "gyms",
      href: findNavItem("gyms")?.href ?? "/gyms",
      iconSrc: findNavItem("gyms")?.iconSrc ?? "/nav/gym-icon.png?v=4",
      labelKey: "gyms",
      status: gymReady
        ? t("hub.dailyActions.statusReady")
        : t("hub.dailyActions.statusBadges", {
            count: regularBadgeCount,
            total: badgeTotal,
          }),
      hot: gymReady,
    },
    {
      id: "heal",
      href: null,
      iconSrc: "/nav/chansey-icon.png",
      labelKey: "heal",
      status: !needsHealing
        ? healCdMs > 0 && !healNoviceFree
          ? t("hub.dailyActions.statusHealthyCooldown", {
              time: `${minutesLeft(healCdMs)}:00`,
            })
          : t("hub.dailyActions.statusHealthy")
        : healReady
          ? t("hub.dailyActions.statusReady")
          : t("hub.dailyActions.statusRush", { cost: healRush }),
      hot:
        healReady ||
        (needsHealing &&
          !healNoviceFree &&
          healCdMs > 0 &&
          userRow.coins >= healRush),
      heal: {
        needsHealing,
        cooldownMsLeft: healCdMs,
        rushCost: healRush,
        coins: userRow.coins,
        teamMaxLevel,
      },
    },
    // Amigos y Mercado vivían acá sin `status`: no son acciones diarias sino
    // atajos, y el navbar ya los tiene (Comunidad / Comercio). Racha pasó al
    // banner de identidad; el 4º slot es el Centro Pokémon (curar desde home).
  ];

  const titleKeys = [
    "rookie",
    "trainer",
    "collector",
    "gymLeaderBane",
    "researcher",
    "duelist",
    "legendTamer",
    "shinyHunter",
    "mythKeeper",
    "champion",
  ] as const;
  const achievementLabelEntries = Object.fromEntries(
    achievements.map((a) => [a.id, tProfile(`achievements.${a.id}.name`)]),
  );

  const pvpTierKeys = [
    "beginner",
    "rising",
    "advanced",
    "elite",
    "bronzeMaster",
    "crystalMaster",
    "champion",
    "legendary",
  ] as const satisfies readonly PvpTier[];
  const hubLabels: HomeHubLabels = {
    identity: {
      level: t("hub.identity.level"),
      combatPower: t("hub.identity.combatPower"),
      clan: t("hub.identity.clan"),
      noClan: t("hub.identity.noClan"),
      streak: t("hub.identity.streak"),
      streakDays: t("hub.identity.streakDays", { n: "{n}" }),
      viewProfile: t("hub.identity.viewProfile"),
      titles: Object.fromEntries(titleKeys.map((k) => [k, tProfile(`titles.${k}`)])),
      pvpTiers: Object.fromEntries(
        pvpTierKeys.map((k) => [k, tPvp(`tiers.${k}`)]),
      ),
      lastAchievement: t("hub.identity.lastAchievement"),
      achievements: achievementLabelEntries,
    },
    dailyActions: {
      title: t("hub.dailyActions.title"),
      statusReady: t("hub.dailyActions.statusReady"),
      statusHealthy: t("hub.dailyActions.statusHealthy"),
      statusHealthyCooldown: t("hub.dailyActions.statusHealthyCooldown", {
        time: "{time}",
      }),
      statusRush: t("hub.dailyActions.statusRush", { cost: "{cost}" }),
      items: {
        daily: t("hub.dailyActions.items.daily"),
        pvp: t("hub.dailyActions.items.pvp"),
        gyms: t("hub.dailyActions.items.gyms"),
        heal: t("hub.dailyActions.items.heal"),
        streak: t("hub.dailyActions.items.streak"),
        friends: t("hub.dailyActions.items.friends"),
        market: t("hub.dailyActions.items.market"),
      },
    },
    eventsPanel: {
      progressTitle: t("hub.objectives.progressTitle"),
      emptyAdventure: t("hub.objectives.empty"),
      emptyWeekly: t("hub.objectives.emptyWeekly"),
      emptyEvent: t("hub.objectives.emptyEvent"),
      claimable: t("hub.objectives.claimable"),
      claimAction: t("hub.objectives.claimAction"),
      claimed: t("hub.objectives.claimed"),
      openCampaign: t("hub.objectives.openCampaign"),
      openEvents: t("hub.objectives.openEvents"),
      tabAdventure: t("hub.objectives.tabAdventure"),
      tabWeekly: t("hub.objectives.tabWeekly"),
      tabEvent: t("hub.objectives.tabEvent"),
      weeklyReady: t("hub.objectives.weeklyReady", { count: "{count}" }),
      objectiveLabels: {
        stages: t("hub.objectives.stages"),
        pokedex: t("hub.objectives.pokedex"),
        trainers: t("hub.objectives.trainers"),
      },
      weeklyLabels: {
        logins: tEvents("objectives.logins"),
        battles: tEvents("objectives.battles"),
        catches: tEvents("objectives.catches"),
        zones: tEvents("objectives.zones"),
        shinies: tEvents("objectives.shinies"),
        gyms: tEvents("objectives.gyms"),
      },
      missionLabels: Object.fromEntries(
        eventsSummary.limited.missions.map((mission) => [
          mission.id,
          tEvents(`limited.missions.${mission.id}`),
        ]),
      ),
    },
  };

  return (
    <>
      <PvpRankUpHost />
      <HomeGameHub
      locale={locale}
      expedition={expeditionProps}
      nextStep={nextStep.standalone ? <NextStepCard step={nextStep} /> : null}
      events={{
        daily: eventsSummary.daily,
        showDailyModal: eventsSummary.daily.canClaim,
      }}
      giftLabels={giftLabels}
      squad={{
        members,
        emptySlotLabel: t("emptySlot"),
        leadLabel: tt("lead"),
        slotLabels: Array.from({ length: TEAM_SIZE }, (_, i) =>
          tt("slotLabel", { slot: i + 1 }),
        ),
        bagCounts,
        layoutKey: pokemon.map((p) => `${p.id}:${p.teamSlot}`).join("|"),
        title: t("activeSquad"),
        manageHref: "/team",
        manageLabel: t("manage"),
      }}
      rail={{
        pvp: railPvp,
        clanWars: clanWarsRail,
        top: railTop,
      }}
      identity={identity}
      adventure={{
        zoneId: objectiveZoneId,
        zoneName: objectiveZoneName,
        objectives: homeObjectives,
      }}
      weekly={{
        percent: eventsSummary.weekly.percent,
        objectives: eventsSummary.weekly.objectives.map((o) => ({
          id: o.id,
          current: o.current,
          target: o.target,
          href: o.href,
        })),
        claimableMilestones: eventsSummary.weekly.milestones.filter((m) => m.claimable)
          .length,
      }}
      limited={{
        name: tEvents(`limited.catalog.${eventsSummary.limited.nameKey}`),
        missions: eventsSummary.limited.missions.map((m) => ({
          id: m.id,
          current: m.current,
          target: m.target,
          claimed: m.claimed,
          claimable: m.claimable,
          href: m.href,
        })),
      }}
      dailyActions={dailyActions}
      hubLabels={hubLabels}
    />
    </>
  );
}
