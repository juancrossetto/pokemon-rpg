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
import { avatarById } from "@/lib/avatars";
import { findNavItem } from "@/lib/navigation";
import { dayKey, serverNow } from "@/lib/events/time";
import type {
  HomeIdentity,
  HomeObjective,
  HomeQuickLink,
  HomeRailPvp,
  HomeRailPvpMatch,
} from "@/lib/home-hub";
import type { HomeHubLabels } from "@/components/home/home-game-hub";
import { tierForRating } from "@/lib/pvp/tiers";

const TEAM_SIZE = 6;

const HOME_QUICK_LINK_IDS = [
  "pvp",
  "gyms",
  "friends",
  "market",
  "clans",
  "pokedex",
] as const;

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
          className="mt-2 rounded-md bg-pokeball-red px-6 py-2 text-label-md text-white transition-colors hover:bg-pokeball-red/80"
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
    tNav,
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
    getTranslations("nav"),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        avatarId: true,
        country: true,
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
  const isDev = process.env.NODE_ENV === "development";

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
          restorePp: t("squadMenu.restorePp"),
          rareCandy: t("squadMenu.rareCandy"),
        },
      };
    });

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
  const railPvp: HomeRailPvp = {
    rating: trainerStats.pvpRating,
    wins: trainerStats.pvpWins,
    losses: trainerStats.pvpLosses,
    tier: tierForRating(trainerStats.pvpRating),
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
  };

  const farmingZone =
    mapLocations.find((l) => l.id === progress.farmingLocationId) ??
    mapLocations.find((l) => l.id === expedition?.location.id) ??
    null;
  const zoneObjectives = farmingZone
    ? evaluateObjectives(farmingZone, new Set(farmingZone.claimedObjectives))
    : [];
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

  const quickLinks: HomeQuickLink[] = HOME_QUICK_LINK_IDS.flatMap((id) => {
    const item = findNavItem(id);
    if (!item?.iconSrc) return [];
    return [{ id, href: item.href, iconSrc: item.iconSrc, labelKey: id }];
  });

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
  const rankKeys = [
    "bronze",
    "silver",
    "gold",
    "diamond",
    "master",
    "champion",
  ] as const;
  const achievementLabelEntries = Object.fromEntries(
    achievements.map((a) => [a.id, tProfile(`achievements.${a.id}.name`)]),
  );

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
      ranks: Object.fromEntries(rankKeys.map((k) => [k, tProfile(`rank.${k}`)])),
      lastAchievement: t("hub.identity.lastAchievement"),
      achievements: achievementLabelEntries,
    },
    quickAccess: {
      title: t("hub.quickAccess.title"),
      items: Object.fromEntries(
        HOME_QUICK_LINK_IDS.map((id) => [id, tNav(id)]),
      ),
    },
    objectives: {
      title: t("hub.objectives.title"),
      empty: t("hub.objectives.empty"),
      rewards: t("hub.objectives.rewards"),
      claimable: t("hub.objectives.claimable"),
      claimed: t("hub.objectives.claimed"),
      go: t("hub.objectives.go"),
      openCampaign: t("hub.objectives.openCampaign"),
      objectiveLabels: {
        stages: t("hub.objectives.stages"),
        pokedex: t("hub.objectives.pokedex"),
        trainers: t("hub.objectives.trainers"),
      },
    },
  };

  return (
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
        clanWars: {
          clanId: userRow.clanMembership?.clan.id ?? null,
          clanName: userRow.clanMembership?.clan.name ?? null,
          clanTag: userRow.clanMembership?.clan.tag ?? null,
          clanEmblem: userRow.clanMembership?.clan.emblem ?? null,
        },
        top: railTop,
      }}
      identity={identity}
      objectives={homeObjectives}
      objectiveZoneName={objectiveZoneName}
      quickLinks={quickLinks}
      hubLabels={hubLabels}
      isDev={isDev}
    />
  );
}
