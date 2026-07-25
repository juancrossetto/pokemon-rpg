import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spriteFor } from "@/lib/shiny";
import { calculateMaxHp, calculateStat, xpForLevel, xpToNextLevel } from "@/lib/stats";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { getLocale } from "next-intl/server";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { buildExpeditionView } from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import { CurrentExpedition } from "@/components/current-expedition";
import { CampaignDevPanel } from "@/components/campaign-dev-panel";
import { ActiveMission } from "@/components/active-mission";
import { SystemStatus } from "@/components/system-status";
import { HomeEmptySquadSlot, HomeSquadCard } from "@/components/home-squad-card";
import type { CampaignLocationKind } from "@/lib/campaign";

const TEAM_SIZE = 6;

/** Clima ambiental derivado del tipo de ubicación — determinista, sin datos falsos. */
const CLIMATE_ICON: Record<CampaignLocationKind, string> = {
  town: "sunny",
  route: "partly_cloudy_day",
  forest: "rainy",
  dungeon: "dark_mode",
  gym: "bolt",
};

export default async function Home() {
  const [t, session, locale] = await Promise.all([
    getTranslations("home"),
    auth(),
    getLocale(),
  ]);

  if (session?.user) {
    await redirectIfInBattle(session.user.id, locale);
    return <Dashboard username={session.user.name ?? ""} userId={session.user.id} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile md:px-margin-desktop py-8 text-center">
      <p className="text-label-md text-pokeball-red uppercase tracking-widest flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-pokeball-red animate-pulse" />
        {t("eyebrow")}
      </p>
      <h1 className="max-w-2xl text-headline-lg md:text-display-lg text-white tracking-tight">
        {t("title")}
      </h1>
      <p className="max-w-md text-body-lg text-on-surface-variant">{t("subtitle")}</p>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <Link
          href="/pokedex"
          className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
        >
          {t("pokedexLink")}
        </Link>
        <Link
          href="/register"
          className="glass-panel rounded-lg px-6 py-2 text-label-md text-on-surface hover:bg-white/5 transition-colors"
        >
          {t("register")}
        </Link>
      </div>
    </div>
  );
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
      moves: { include: { move: true }, orderBy: { slot: "asc" } },
    },
    orderBy: { teamSlot: "asc" },
  });

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
          className="mt-2 rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
        >
          {t("chooseStarterLink")}
        </Link>
      </div>
    );
  }

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

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative px-margin-mobile md:px-margin-desktop py-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-label-md text-pokeball-red uppercase tracking-widest flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pokeball-red animate-pulse" />
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

          {expedition && milestone && (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <CurrentExpedition
                  locationNameKey={expedition.location.nameKey}
                  locationKindKey={`kinds.${expedition.location.kind}`}
                  stageNameKey={expedition.stage.nameKey}
                  mapSrc={expedition.mapSrc}
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
            </div>
          )}

          <section className="mt-4">
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
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {slots.map((instance, i) => {
                if (!instance) {
                  return <HomeEmptySquadSlot key={`empty-${i}`} label={t("emptySlot")} />;
                }

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

                return (
                  <HomeSquadCard
                    key={instance.id}
                    slot={i + 1}
                    isLead={i === 0}
                    nickname={instance.nickname}
                    speciesName={instance.species.name}
                    level={instance.level}
                    types={instance.species.types}
                    spriteUrl={spriteFor(instance.species.spriteUrl, instance.isShiny)}
                    currentHp={instance.currentHp}
                    maxHp={maxHp}
                    xpPct={xpPct}
                    xpToNextLabel={tt("expToNext", { xp: xpToNext })}
                    atk={calculateStat(
                      instance.species.baseAttack,
                      instance.ptStrength,
                      instance.level,
                    )}
                    def={calculateStat(
                      instance.species.baseDefense,
                      instance.ptDexterity,
                      instance.level,
                    )}
                    spAtk={calculateStat(
                      instance.species.baseSpAtk,
                      instance.ptIntelligence,
                      instance.level,
                    )}
                    spDef={calculateStat(
                      instance.species.baseSpDef,
                      instance.ptIntelligence,
                      instance.level,
                    )}
                    speed={calculateStat(
                      instance.species.baseSpeed,
                      instance.ptSpeed,
                      instance.level,
                    )}
                    moves={instance.moves.map((m) => ({
                      name: m.move.name,
                      type: m.move.type,
                    }))}
                    labels={{
                      hp: tt("stats.hp"),
                      exp: tt("stats.exp"),
                      expToNext: tt("expToNext", { xp: xpToNext }),
                      atk: tt("stats.atk"),
                      def: tt("stats.def"),
                      spAtk: tt("stats.spAtk"),
                      spDef: tt("stats.spDef"),
                      speed: tt("stats.speed"),
                      level: tt("level", { level: instance.level }),
                      lead: tt("lead"),
                      slot: tt("slotLabel", { slot: i + 1 }),
                      fainted: tt("fainted"),
                    }}
                  />
                );
              })}
            </div>
          </section>

          {isDev && <CampaignDevPanel locale={locale} />}
        </div>
      </div>
    </div>
  );
}
