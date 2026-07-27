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
import { CurrentExpedition } from "@/components/current-expedition";
import { CampaignDevPanel } from "@/components/campaign-dev-panel";
import { ActiveMission } from "@/components/active-mission";
import { DailyGiftModal } from "@/components/events/daily-gift-modal";
import { loadEventsSummary } from "@/lib/events/state";
import { SystemStatus } from "@/components/system-status";
import { CollapsibleOnMobile } from "@/components/collapsible-on-mobile";
import { HomeSquadGrid, type HomeSquadMember } from "@/components/home-squad-grid";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { loadEvolutionChainsForTeam, loadOwnedEvolutionItems } from "@/lib/evolution-chain";
import type { CampaignLocationKind } from "@/lib/campaign";

const TEAM_SIZE = 6;

/** Encabezado de "Equipo activo". Aparece en las dos ramas del layout. */
function SquadHeader({ t }: { t: (key: string) => string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-pokeball-red">group</span>
        <h2 className="text-headline-md text-white">{t("activeSquad")}</h2>
      </div>
      <Link
        href="/team"
        className="flex items-center gap-1 text-label-sm text-on-surface-variant transition-colors hover:text-white"
      >
        {t("manage")}
        <span className="material-symbols-outlined text-sm!">chevron_right</span>
      </Link>
    </div>
  );
}

/** Clima ambiental derivado del tipo de ubicación — determinista, sin datos falsos. */
const CLIMATE_ICON: Record<CampaignLocationKind, string> = {
  town: "sunny",
  route: "partly_cloudy_day",
  forest: "rainy",
  dungeon: "dark_mode",
  gym: "bolt",
};

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

  // Regalo diario pendiente: solo se arma el banner si de verdad hay algo que
  // reclamar, así la pantalla de inicio no gana una franja vacía.
  const eventsSummary = await loadEventsSummary(userId);
  const tEvents = await getTranslations("events");
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
          className="mt-2 rounded-md bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
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
  const missionTitle = milestone ? tc(milestone.nameKey) : "";
  const missionDescription = milestone
    ? milestone.kind === "gym"
      ? t("missionGym", { location: tc(milestone.nameKey) })
      : milestone.kind === "complete"
        ? t("missionComplete")
        : t("missionStage", { location: tc(milestone.nameKey) })
    : "";
  const missionHref =
    milestone?.kind === "gym" ? "/gyms" : milestone?.kind === "complete" ? "/campaign" : "/battle";

  // El grid se declara una vez y se usa en las dos ramas del layout
  // (con expedición y sin ella) para no duplicar 100 líneas de props.
  const squadGrid = (
        <HomeSquadGrid
          key={pokemon.map((p) => `${p.id}:${p.teamSlot}`).join("|")}
          locale={locale}
          emptySlotLabel={t("emptySlot")}
          leadLabel={tt("lead")}
          initialBagCounts={bagCounts}
          slotLabels={Array.from({ length: TEAM_SIZE }, (_, i) =>
            tt("slotLabel", { slot: i + 1 }),
          )}
          initialMembers={slots
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
                levelSpan > 0
                  ? Math.max(0, Math.min(100, (xpIntoLevel / levelSpan) * 100))
                  : 0;

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
            })}
        />
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="relative px-margin-mobile md:px-margin-desktop py-6">
        <div className="mx-auto max-w-6xl">
          {/*
            Va acá adentro y no en el contenedor con padding: el modal se
            renderiza en un portal, pero cuando queda cerrado sin reclamar
            deja un chip en flujo normal, y afuera del `max-w-6xl` ese chip
            arrancaba pegado al borde de la pantalla, desalineado de todo lo
            que tiene debajo.
          */}
          {eventsSummary.daily.canClaim && (
            <DailyGiftModal
              days={eventsSummary.daily.days}
              currentDay={eventsSummary.daily.currentDay}
              total={eventsSummary.daily.length}
              labels={giftLabels}
              locale={locale}
            />
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              {/* Verde y más chico: es un indicador de estado —"la partida está
                  sincronizada"—, no una alerta. En rojo y a `label-md` competía
                  con el saludo, que es el título real de la pantalla. */}
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-400/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("liveSync")}
              </p>
              <h1 className="mt-1 text-headline-lg md:text-display-lg text-white tracking-tight">
                {t("greeting", { username })}
              </h1>
            </div>
            {expedition && (
              <SystemStatus
                timeLabel={t("time")}
                climateLabel={t("climate")}
                climateValue={t(`climates.${expedition.location.kind}`)}
                climateIcon={CLIMATE_ICON[expedition.location.kind]}
              />
            )}
          </div>

          {/* Orden distinto por tamaño de pantalla. En mobile el jugador entraba
              y lo primero que veía era un mapa grande y un bloque largo de
              texto; ahora arranca por su equipo, que es lo que engancha, y el
              mapa y la misión quedan abajo. En lg vuelve al layout de dos
              columnas con el equipo debajo, que ahí sí tiene espacio. */}
          {expedition && milestone && (
            <div className="mt-5 flex flex-col gap-4 lg:mt-6 lg:grid lg:grid-cols-3 lg:items-stretch">
              <div className="order-1 lg:col-span-2 lg:min-h-0">
                <CurrentExpedition
                  locationNameKey={expedition.location.nameKey}
                  locationKindKey={`kinds.${expedition.location.kind}`}
                  stageNameKey={expedition.stage.nameKey}
                  mapSrc={expedition.regionMapSrc}
                  milestone={milestone}
                  regionNameKey={`regions.${expedition.regionId}`}
                  wildTypes={wildTypes}
                  levelMin={expedition.stage.levelMin}
                  levelMax={expedition.stage.levelMax}
                  locale={locale}
                  locations={mapLocations}
                  farmingLocationId={progress.farmingLocationId}
                  farmingStageId={progress.farmingStageId}
                />
              </div>
              <div className="order-3 min-h-0 lg:order-2">
                <CollapsibleOnMobile
                  title={t("activeMission")}
                  icon="assignment"
                  summary={missionTitle}
                >
                  <ActiveMission
                    heading={t("activeMission")}
                    title={missionTitle}
                    description={missionDescription}
                    progressLabel={tc("journeyProgress")}
                    progressPercent={expedition.journeyPercent}
                    stagesLabel={t("stagesCleared")}
                    stagesDone={locationStagesDone}
                    stagesTotal={locationStages.length}
                    ctaHref={missionHref}
                    ctaLabel={
                      milestone.kind === "gym" ? tc("challengeGym") : tc("continueExpedition")
                    }
                  />
                </CollapsibleOnMobile>
              </div>

              <section className="order-2 lg:order-3 lg:col-span-3 lg:mt-2">
                <SquadHeader t={t} />
                {squadGrid}
              </section>
            </div>
          )}

          {/* Sin expedición no hay grid que ordenar: el equipo va solo. */}
          {!(expedition && milestone) && (
            <section className="mt-4">
              <SquadHeader t={t} />
              {squadGrid}
            </section>
          )}


          {isDev && <CampaignDevPanel locale={locale} />}
        </div>
      </div>
    </div>
  );
}
