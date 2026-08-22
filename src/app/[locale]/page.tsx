import { getTranslations, getLocale } from "next-intl/server";
import { Suspense } from "react";
import { gymLeaderBustUrl, gymLeaderHeroArtKind, gymLeaderPortraitScale } from "@/lib/gym-art";
import { typeColor } from "@/lib/type-colors";
import { HomeRouteHero, type HomeNextChallenge } from "@/components/home/home-route-hero";
import { Link, redirect } from "@/i18n/navigation";
import { getAuthSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { spriteFor } from "@/lib/shiny";
import { calculateMaxHp, calculateStat, xpForLevel, xpToNextLevel } from "@/lib/stats";
import { effectivePp } from "@/lib/battle";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { buildExpeditionView } from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import { loadEventsSummary } from "@/lib/events/state";
import { rewardWeight } from "@/lib/events/rewards";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import { isEliteMilestone } from "@/lib/next-step";
import { HomeGameHub } from "@/components/home/home-game-hub";
import { PvpRankUpHost } from "@/components/pvp/pvp-rank-up-host";
import type { HomeSquadMember } from "@/components/home/squad-types";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { loadEvolutionChainsForTeam, loadOwnedEvolutionItems } from "@/lib/evolution-chain";
import { loadCombatPowerBoard } from "@/lib/ranking-boards";
import { regionBadgeTarget } from "@/lib/regions";
import { resolveItemDisplayName } from "@/lib/shop";
import { evaluateObjectives } from "@/lib/campaign/objectives";
import { buildAdventureGuide } from "@/lib/adventure-guide";
import {
  healCooldownMsLeft,
  healRushCost,
} from "@/lib/healing";
import type {
  HomeRailPvp,
  HomeRailPvpMatch,
} from "@/lib/home-hub";
import { rankForRating } from "@/lib/pvp/tiers";
import { loadRaidHomeCard } from "@/lib/raids/state";
import { loadSafariHomeCard } from "@/lib/safari-home";
import { loadTowerHomeCard } from "@/lib/tower-home";
import { getUserSnapshot } from "@/lib/user-snapshot";
import {
  HomeDesktopRail,
  type HomeRailRankEntry,
} from "@/components/home/home-desktop-rail";
import type { CurrentExpeditionProps } from "@/components/current-expedition";

const TEAM_SIZE = 6;

/** Iconos HD de las monedas del juego, para la vitrina de premios del banner. */
const REWARD_KIND_ICONS: Record<"coins" | "energy" | "gems", string> = {
  coins: "/items/hd/poke-coin.png",
  energy: "/items/hd/energy.png",
  gems: "/items/hd/gem.png",
};

export default async function Home() {
  const [session, locale] = await Promise.all([getAuthSession(), getLocale()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);
  return <Dashboard username={session.user.name ?? ""} userId={session.user.id} />;
}

type HomeUserSnapshot = NonNullable<Awaited<ReturnType<typeof getUserSnapshot>>>;

function HomeRailSkeleton() {
  return (
    <aside
      className="sticky top-4 hidden h-fit w-[16.5rem] shrink-0 animate-pulse flex-col gap-2 xl:flex 2xl:w-[17.5rem]"
      aria-hidden
    >
      <div className="h-44 rounded-2xl border border-white/8 bg-white/[0.035]" />
      <div className="h-52 rounded-2xl border border-white/8 bg-white/[0.035]" />
      <div className="h-24 rounded-2xl border border-white/8 bg-white/[0.035]" />
      <div className="h-52 rounded-2xl border border-white/8 bg-white/[0.035]" />
    </aside>
  );
}

/**
 * Isla secundaria del home. PvP, guerras y ranking no bloquean el banner, la
 * ruta actual ni el equipo: se consultan y transmiten dentro de su Suspense.
 */
async function HomeRailSection({
  userId,
  username,
  locale,
  user,
  expedition,
}: {
  userId: string;
  username: string;
  locale: string;
  user: HomeUserSnapshot;
  expedition: CurrentExpeditionProps | null;
}) {
  const clanId = user.clanMembership?.clan.id ?? null;
  const [recentPvpMatches, topBoard, activeClanWar] = await Promise.all([
    prisma.pvpMatch.findMany({
      where: {
        OR: [{ challengerId: userId }, { opponentId: userId }],
        status: { in: ["COMPLETED", "FORFEIT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        id: true,
        challengerId: true,
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
    loadCombatPowerBoard("", userId),
    clanId
      ? prisma.clanWar.findFirst({
          where: {
            status: { in: ["ACTIVE", "COMPLETED"] },
            OR: [{ clanAId: clanId }, { clanBId: clanId }],
          },
          orderBy: { matchedAt: "desc" },
          include: {
            clanA: { select: { id: true, name: true, tag: true, emblem: true } },
            clanB: { select: { id: true, name: true, tag: true, emblem: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const dateLabel = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" });
  const recent: HomeRailPvpMatch[] = recentPvpMatches.map((match) => {
    const asChallenger = match.challengerId === userId;
    const foe = asChallenger ? match.opponent : match.challenger;
    const before = asChallenger
      ? match.challengerRatingBefore
      : match.opponentRatingBefore;
    const after = asChallenger
      ? match.challengerRatingAfter
      : match.opponentRatingAfter;
    return {
      id: match.id,
      won: match.winnerId === userId,
      opponentName: foe.username,
      opponentCountry: foe.country ?? "",
      opponentAvatarId: foe.avatarId,
      mode: match.mode === "QUICK" ? "QUICK" : "RANKED",
      ratingDelta: (after ?? before ?? 0) - (before ?? 0),
      dateLabel: dateLabel.format(match.createdAt).replace(/\//g, "."),
    };
  });
  const standing = rankForRating(user.pvpRating);
  const pvp: HomeRailPvp = {
    rating: user.pvpRating,
    wins: user.pvpWins,
    losses: user.pvpLosses,
    tier: standing.tier,
    division: standing.division,
    selfName: user.username || username,
    selfAvatarId: user.avatarId,
    selfCountry: user.country ?? "",
    recent,
  };

  const selfIsA = activeClanWar?.clanAId === clanId;
  const rival = activeClanWar
    ? selfIsA
      ? activeClanWar.clanB
      : activeClanWar.clanA
    : null;
  const clanWars = {
    clanId,
    clanName: user.clanMembership?.clan.name ?? null,
    clanTag: user.clanMembership?.clan.tag ?? null,
    clanEmblem: user.clanMembership?.clan.emblem ?? null,
    scoreSelf: activeClanWar
      ? selfIsA
        ? activeClanWar.scoreA
        : activeClanWar.scoreB
      : null,
    scoreRival: activeClanWar
      ? selfIsA
        ? activeClanWar.scoreB
        : activeClanWar.scoreA
      : null,
    rivalName: rival?.name ?? null,
    rivalTag: rival?.tag ?? null,
    rivalEmblem: rival?.emblem ?? null,
    status: (activeClanWar?.status === "COMPLETED"
      ? "completed"
      : activeClanWar
        ? "active"
        : "none") as "none" | "active" | "completed",
  };
  const top: HomeRailRankEntry[] = topBoard.slice(0, 3).map((row) => ({
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

  return (
    <HomeDesktopRail
      pvp={pvp}
      clanWars={clanWars}
      top={top}
      expedition={expedition}
    />
  );
}

async function Dashboard({ username, userId }: { username: string; userId: string }) {
  /*
    Todo lo que no depende de `progress`/`pokemon` arranca junto. Antes el home
    hacía tres olas seriales y además llamaba `loadTrainerStats` (diez queries)
    para usar solamente rating/victorias/derrotas, campos que ya viven en User.
  */
  const [
    t,
    tt,
    tShop,
    locale,
    progress,
    badges,
    pokemon,
    bagCounts,
    ownedHeldItemsRows,
    eventsSummary,
    tEvents,
    tCampaign,
    tTypes,
    userRow,
    raidCard,
    safariCard,
    towerCard,
  ] = await Promise.all([
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
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, teamSlot: { not: null } },
      include: {
        species: true,
        heldItem: {
          select: {
            id: true,
            name: true,
            effectText: true,
            heldEffect: true,
          },
        },
        moves: {
          include: { move: { select: { name: true, type: true, pp: true } } },
          orderBy: { slot: "asc" },
        },
      },
      orderBy: { teamSlot: "asc" },
    }),
    loadSquadBagCounts(userId),
    prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 }, item: { type: "HELD" } },
      include: { item: true },
    }),
    loadEventsSummary(userId),
    getTranslations("events"),
    getTranslations("campaign"),
    getTranslations("pokedex.pokemonTypes"),
    getUserSnapshot(userId),
    loadRaidHomeCard(userId),
    loadSafariHomeCard(userId),
    loadTowerHomeCard(userId),
  ]);

  if (!userRow) {
    redirect({ href: "/login", locale });
    return null;
  }

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
  const bySlot = new Map(pokemon.map((p) => [p.teamSlot, p]));
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => bySlot.get(i + 1) ?? null);
  const regionBadges = badges.filter((b) => b.gym.regionId === progress.currentRegionId);
  const expedition = buildExpeditionView(
    progress,
    regionBadges.map((b) => b.gym.order),
  );
  const milestone = expedition?.milestone;
  const badgeTotal = regionBadgeTarget(progress.currentRegionId);
  const [
    evolutionChains,
    ownedEvolutionItems,
    mapLocations,
    spawnSpecies,
    eliteGym,
    milestoneGym,
  ] = await Promise.all([
    loadEvolutionChainsForTeam(userId, speciesIds),
    loadOwnedEvolutionItems(userId),
    loadMapLocations(userId, progress),
    expedition
      ? prisma.species.findMany({
        where: { id: { in: expedition.stage.spawnSpeciesIds } },
        select: { types: true },
      })
      : Promise.resolve([]),
    milestone && isEliteMilestone(milestone, badgeTotal)
      ? prisma.gym.findFirst({
          where: {
            order: milestone.gymOrder,
            regionId: progress.currentRegionId,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    milestone?.kind === "gym"
      ? prisma.gym.findFirst({
          where: { order: milestone.gymOrder, regionId: progress.currentRegionId },
          select: { leaderName: true, type: true },
        })
      : Promise.resolve(null),
  ]);
  const ownedEvolutionItemNames = [...ownedEvolutionItems];
  const wildTypes = Array.from(new Set(spawnSpecies.flatMap((s) => s.types))).slice(0, 4);

  const locationStages = expedition
    ? expedition.location.stages.filter((s) => !s.isGymMilestone)
    : [];
  const locationStagesDone = locationStages.filter((s) =>
    progress.completedStageIds.includes(s.id),
  ).length;

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
  const eliteGymHref = eliteGym ? `/gyms/${eliteGym.id}` : null;

  /*
    Líder del hito, para el panel "próximo desafío" del hero mobile. Es una
    consulta más sólo cuando el hito es un gimnasio; en rutas y región
    completa el panel no se dibuja.
  */
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
        isShiny: instance.isShiny,
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
        unspentPoints: instance.unspentPoints,
        points: {
          ptStrength: instance.ptStrength,
          ptDexterity: instance.ptDexterity,
          ptIntelligence: instance.ptIntelligence,
          ptSpeed: instance.ptSpeed,
          ptConstitution: instance.ptConstitution,
        },
        bases: {
          baseHp: instance.species.baseHp,
          baseAttack: instance.species.baseAttack,
          baseDefense: instance.species.baseDefense,
          baseSpAtk: instance.species.baseSpAtk,
          baseSpDef: instance.species.baseSpDef,
          baseSpeed: instance.species.baseSpeed,
        },
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
          allocatePoints: t("squadMenu.allocatePoints"),
          heldItem: t("squadMenu.heldItem"),
        },
        heldItem: instance.heldItem
          ? {
              itemId: instance.heldItem.id,
              name: instance.heldItem.name,
              displayName: resolveItemDisplayName(instance.heldItem.name, (key) => {
                const path = `names.${key}`;
                return tShop.has(path) ? tShop(path) : null;
              }),
              effectText: instance.heldItem.effectText,
            }
          : null,
      };
    });

  const itemLabel = (name: string) =>
    resolveItemDisplayName(name, (key) => {
      const path = `names.${key}`;
      return tShop.has(path) ? tShop(path) : null;
    });

  const ownedHeldById = new Map(
    ownedHeldItemsRows.map((inv) => [
      inv.itemId,
      {
        itemId: inv.itemId,
        name: inv.item.name,
        displayName: itemLabel(inv.item.name),
        effectText: inv.item.effectText,
        quantity: inv.quantity,
      },
    ]),
  );
  // Exp. Share equipado sigue disponible en el panel para moverlo a otro mon.
  for (const m of members) {
    if (
      m.heldItem &&
      !ownedHeldById.has(m.heldItem.itemId) &&
      pokemon.find((p) => p.id === m.id)?.heldItem?.heldEffect === "EXP_SHARE"
    ) {
      ownedHeldById.set(m.heldItem.itemId, {
        ...m.heldItem,
        quantity: 1,
      });
    }
  }
  const ownedHeldItems = [...ownedHeldById.values()];
  const heldLabels = {
    title: tt("drawer.heldItemTitle"),
    hint: tt("drawer.heldItemHint"),
    change: tt("drawer.equip"),
    noneOwned: tt("drawer.noHeldItems"),
    unequip: tt("drawer.unequip"),
    equipping: tt("drawer.equipping"),
    cancel: tt("drawer.cancel"),
    close: tt("drawer.close"),
    equipped: tt("drawer.equipped"),
    equipErrors: {
      unauthorized: tt("drawer.teachErrors.unauthorized"),
      not_found: tt("drawer.teachErrors.not_found"),
      no_item: tt("drawer.equipErrors.no_item"),
      in_combat: tt("drawer.teachErrors.in_combat"),
    },
  };

  const farmingZoneEarly =
    mapLocations.find((l) => l.id === progress.farmingLocationId) ??
    mapLocations.find((l) => l.id === expedition?.location.id) ??
    null;
  const zoneObjectivesEarly = farmingZoneEarly
    ? evaluateObjectives(farmingZoneEarly, new Set(farmingZoneEarly.claimedObjectives))
    : [];
  const claimableCount = zoneObjectivesEarly.filter((o) => o.claimable).length;

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
          eliteMilestone: isEliteMilestone(milestone, badgeTotal),
          guideSteps: buildAdventureGuide({
            milestoneKind: milestone.kind,
            stagesDone: locationStagesDone,
            stagesTotal: locationStages.length,
            claimableCount,
            gymHref: eliteGymHref,
          }),
        }
      : null;

  const nextChallenge: HomeNextChallenge | null = milestoneGym
    ? (() => {
        const imageUrl = gymLeaderBustUrl(milestoneGym.leaderName);
        return {
          title: milestoneGym.leaderName,
          // Agatha no lidera un "gimnasio fantasma": es el Alto Mando. El
          // modelo los guarda como gimnasios, el copy no tiene por qué.
          subtitle: tCampaign(
            isEliteMilestone(milestone ?? null, badgeTotal) ? "eliteOfType" : "gymOfType",
            { type: tTypes(milestoneGym.type.toLowerCase() as "normal") },
          ),
          imageUrl,
          imageKind: gymLeaderHeroArtKind(imageUrl),
          portraitScale: gymLeaderPortraitScale(milestoneGym.leaderName),
          accent: typeColor(milestoneGym.type),
        };
      })()
    : null;

  const teamMaxLevel = pokemon.reduce((max, p) => Math.max(max, p.level), 0);
  const hurtCount = pokemon.filter((p) => {
    const maxHp = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
    return p.currentHp < maxHp;
  }).length;
  const needsHealing = hurtCount > 0;
  const healCdMs = healCooldownMsLeft(userRow.lastHealAt);
  const healRush = healRushCost(hurtCount);


  /*
    Muestra de premios del evento para el banner del home.

    Se juntan las recompensas de todas las misiones de la edición, se suman las
    repetidas —tres misiones que dan monedas son una sola entrada— y se ordenan
    por `rewardWeight`, el mismo peso con el que el resto del juego decide qué
    premio es "el gordo". Se muestran las cuatro primeras: es una vitrina, no
    la lista completa, que vive en `/events`.
  */
  const rewardTotals = new Map<string, { icon: string; amount: number; weight: number }>();
  for (const mission of eventsSummary.limited.missions) {
    for (const reward of mission.rewards) {
      const key = reward.kind === "item" ? `item:${reward.itemName}` : reward.kind;
      const amount = reward.kind === "item" ? reward.quantity : reward.amount;
      const previous = rewardTotals.get(key);
      rewardTotals.set(key, {
        icon:
          reward.kind === "item"
            ? itemHdIconUrl(reward.itemName) ?? "/items/hd/potion.png"
            : REWARD_KIND_ICONS[reward.kind],
        amount: (previous?.amount ?? 0) + amount,
        weight: (previous?.weight ?? 0) + rewardWeight(reward),
      });
    }
  }
  const limitedRewardPreview = [...rewardTotals.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((reward) => ({ icon: reward.icon, label: `×${reward.amount}` }));

  return (
    <>
      <PvpRankUpHost />
      <HomeGameHub
      locale={locale}
      expedition={expeditionProps}
      routeHero={
        expeditionProps ? (
          <HomeRouteHero
            key="home-route-hero"
            expedition={expeditionProps}
            nextChallenge={nextChallenge}
            claimableCount={claimableCount}
          />
        ) : null
      }
      eventShowcase={{
        hero: {
          name: tEvents(`limited.catalog.${eventsSummary.limited.nameKey}`),
          tagline: tEvents(`limited.catalog.${eventsSummary.limited.taglineKey}`),
          accent: eventsSummary.limited.accent,
          endsAt: eventsSummary.limited.endsAt,
          progress: Math.round(
            eventsSummary.limited.missions.reduce(
              (sum, mission) => sum + Math.min(1, mission.current / Math.max(1, mission.target)),
              0,
            ) / Math.max(1, eventsSummary.limited.missions.length) * 100,
          ),
          claimable: eventsSummary.limited.missions.filter((mission) => mission.claimable).length,
          rewards: limitedRewardPreview,
        },
        raid: raidCard,
        safari: safariCard,
        tower: towerCard,
      }}
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
        ownedHeldItems,
        heldLabels,
        layoutKey: pokemon.map((p) => `${p.id}:${p.teamSlot}`).join("|"),
        title: t("activeSquad"),
        manageHref: "/team",
        manageLabel: t("manage"),
        heal: {
          needsHealing,
          cooldownMsLeft: healCdMs,
          rushCost: healRush,
          coins: userRow.coins,
          teamMaxLevel,
        },
      }}
      desktopRail={
        <Suspense key="home-desktop-rail" fallback={<HomeRailSkeleton />}>
          <HomeRailSection
            userId={userId}
            username={username}
            locale={locale}
            user={userRow}
            expedition={expeditionProps}
          />
        </Suspense>
      }
      showEnergyHint={badges.filter((b) => !b.gym.isElite).length < 3}
    />
    </>
  );
}
