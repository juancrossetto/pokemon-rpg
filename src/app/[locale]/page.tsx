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
import { HomeGameHub } from "@/components/home/home-game-hub";
import type { HomeSquadMember } from "@/components/home/squad-types";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { loadEvolutionChainsForTeam, loadOwnedEvolutionItems } from "@/lib/evolution-chain";

const TEAM_SIZE = 6;

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
  const [t, tc, tt, locale, progress, badges] = await Promise.all([
    getTranslations("home"),
    getTranslations("campaign"),
    getTranslations("team"),
    getLocale(),
    ensureCampaignProgress(userId),
    prisma.badge.findMany({
      where: { userId },
      include: { gym: { select: { order: true } } },
    }),
  ]);

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    include: {
      species: true,
      moves: {
        include: { move: { select: { name: true, type: true, pp: true } } },
        orderBy: { slot: "asc" },
      },
    },
    orderBy: { teamSlot: "asc" },
  });
  const bagCounts = await loadSquadBagCounts(userId);

  const eventsSummary = await loadEventsSummary(userId);
  const tEvents = await getTranslations("events");
  const tNav = await getTranslations("nav");
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
    rewards: {
      coins: tEvents("rewards.coins"),
      energy: tEvents("rewards.energy"),
      item: tEvents("rewards.item"),
    },
  };

  if (pokemon.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-8 text-center">
        <p className="text-label-md text-pokeball-red uppercase tracking-widest">
          {t("greeting", { username })}
        </p>
        <h1 className="max-w-xl text-headline-lg md:text-display-lg text-white">
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

  const speciesIds = [...new Set(pokemon.map((p) => p.speciesId))];
  const [evolutionChains, ownedEvolutionItems] = await Promise.all([
    loadEvolutionChainsForTeam(userId, speciesIds),
    loadOwnedEvolutionItems(userId),
  ]);
  const ownedEvolutionItemNames = [...ownedEvolutionItems];

  const bySlot = new Map(pokemon.map((p) => [p.teamSlot, p]));
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => bySlot.get(i + 1) ?? null);
  const expedition = buildExpeditionView(
    progress,
    badges.map((b) => b.gym.order),
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
        }
      : null;

  return (
    <HomeGameHub
      locale={locale}
      expedition={expeditionProps}
      events={{
        daily: eventsSummary.daily,
        weekly: eventsSummary.weekly,
        pendingCount: eventsSummary.pendingCount,
        showDailyModal: eventsSummary.daily.canClaim,
      }}
      giftLabels={giftLabels}
      idleLabels={{
        title: t("rewards.title"),
        claim: t("rewards.claim"),
        claiming: t("rewards.claiming"),
        claimed: t("rewards.claimed"),
        empty: t("rewards.empty"),
        seeEvents: t("rewards.seeEvents"),
        pendingWeekly: t("rewards.pendingWeekly"),
        dailyReady: t("rewards.dailyReady"),
      }}
      squad={{
        members,
        emptySlotLabel: t("emptySlot"),
        leadLabel: tt("lead"),
        slotLabels: Array.from({ length: TEAM_SIZE }, (_, i) =>
          tt("slotLabel", { slot: i + 1 }),
        ),
        manageLabel: t("manage"),
        title: t("activeSquad"),
        bagCounts,
        layoutKey: pokemon.map((p) => `${p.id}:${p.teamSlot}`).join("|"),
      }}
      quickTitle={t("quickActions")}
      quickActions={[
        {
          id: "events",
          href: "/events",
          icon: "redeem",
          label: tNav("events") || t("quick.events"),
          badge: eventsSummary.pendingCount,
          attention: eventsSummary.pendingCount > 0,
        },
        {
          id: "gyms",
          href: "/gyms",
          icon: "military_tech",
          label: tNav("gyms"),
          attention: milestone?.kind === "gym",
        },
        {
          id: "campaign",
          href: "/campaign",
          icon: "map",
          label: tNav("campaign"),
        },
        {
          id: "pvp",
          href: "/pvp",
          icon: "swords",
          label: tNav("pvp"),
        },
      ]}
      isDev={isDev}
    />
  );
}
