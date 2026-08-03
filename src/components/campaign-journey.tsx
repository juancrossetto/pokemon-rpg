"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CampaignPrimaryObjective, CampaignJourneyMenuTrigger } from "@/components/campaign-primary-objective";
import { selectLocation, setFarmingStage } from "@/actions/campaign";
import { startTrainerBattle } from "@/actions/route-trainer";
import { claimZoneObjective } from "@/actions/zone-rewards";
import {
  evaluateObjectives,
  type ZoneObjectiveId,
  type ZoneObjectiveState,
} from "@/lib/campaign/objectives";
import { type Rarity } from "@/lib/campaign/rarity";
import { itemSpriteUrl } from "@/lib/item-sprites";
import {
  MasteryIcon,
  ZoneIcon,
  type ZoneIconKind,
} from "@/components/zone-icons";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import type { Chapter } from "@/lib/campaign/chapters";
import type { MapEncounter, MapLocation } from "@/lib/campaign/map-selection";
import type { CampaignLocationKind } from "@/lib/campaign/types";
import {
  campaignBannerForChapter,
  campaignMapHasArt,
  campaignMapArtLayout,
  campaignMapSrc,
  getCampaignPrimaryAction,
  getZoneUnlockRequirements,
  resolveZoneNodeStatus,
  type CampaignNodeStatus,
  type CampaignProgressRow,
  type CampaignRequirement,
} from "@/lib/campaign";
import { masteryBonuses, masteryProgressPercent } from "@/lib/mastery";
import {
  ZoneRewardPopup,
  type ZoneRewardClaim,
} from "@/components/zone-reward-popup";
import { announceCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import {
  campaignClaimErrorKey,
  campaignTrainerErrorKey,
} from "@/lib/campaign/client-errors";
import { HubHelpPanel, CoachMark } from "@/components/journey-guidance";
import { UnlockCelebration } from "@/components/unlock-celebration";
import { CampaignUnlockFeedback } from "@/components/campaign-unlock-feedback";
import { GameCtaButton } from "@/components/game-cta-button";
import type { CampaignMilestone } from "@/lib/campaign/types";

function translateRequirement(
  t: (key: string, values?: Record<string, string | number>) => string,
  req: CampaignRequirement,
): string {
  const raw = req.descriptionParams ?? {};
  const params: Record<string, string | number> = { ...raw };
  for (const key of ["location", "stage"] as const) {
    const val = raw[key];
    if (typeof val === "string" && val.includes(".")) {
      params[key] = t(val);
    }
  }
  return t(req.descriptionKey, params);
}

/** Orden Kanto → tipo de medalla (arte local, no trainers). */
const BADGE_TYPE_BY_ORDER: Record<number, string> = {
  1: "rock",
  2: "water",
  3: "electric",
  4: "grass",
  5: "poison",
  6: "psychic",
  7: "fire",
  8: "ground",
};

const PATH_PROGRESS_FILL = "campaign-warm-bar";
/** Hecho / valor → tertiary del theme. */
const PATH_DONE = "var(--color-electric-yellow)";
const PATH_DONE_SOFT = "color-mix(in srgb, var(--color-electric-yellow) 16%, transparent)";
const PATH_DONE_RING = "color-mix(in srgb, var(--color-electric-yellow) 75%, transparent)";
const PATH_DONE_GLOW = "color-mix(in srgb, var(--color-electric-yellow) 55%, transparent)";
const PATH_DONE_GLOW_STRONG = "color-mix(in srgb, var(--color-electric-yellow) 88%, transparent)";
const PATH_NODE_SM = "h-6 w-6 sm:h-8 sm:w-8"; /* rail normal — compacto en mobile */
const PATH_NODE_GYM = "h-9 w-9 sm:h-12 sm:w-12 lg:h-14 lg:w-14"; /* gimnasio */

function zoneBarFill(isGym: boolean, done: boolean, inProgress: boolean): string {
  if (isGym || inProgress) return PATH_PROGRESS_FILL;
  if (done) return "bg-electric-yellow";
  return "bg-white/20";
}

/**
 * Paleta de la campaña — cuatro familias, cada una con un significado.
 *
 * Antes cada tipo de zona tenía su color (celeste, verde, lima, gris, dorado) y
 * cada rareza el suyo: nueve acentos compitiendo, ninguno significando nada. La
 * regla ahora es que el color solo aparece cuando informa:
 *
 * - Neutro (blancos)  → estructura y tipo de zona. La identidad la da el ícono.
 * - Primary           → dónde estás y la acción principal.
 * - Tertiary          → gimnasios, recompensas y “hecho” del path.
 * - Verde             → capturado / entrenador vencido / objetivo cumplido.
 */

/** Rareza sobre un solo tono: la jerarquía se lee por intensidad, no por color. */
const RARITY_STYLE: Record<Rarity, string> = {
  common: "border-white/10",
  uncommon: "border-white/25",
  rare: "border-tertiary/35",
  veryRare: "border-tertiary/60",
  elite: "border-electric-yellow shadow-[0_0_10px_color-mix(in_srgb,var(--color-electric-yellow)_35%,transparent)]",
};

/**
 * Identidad por tipo de zona: la lleva el ícono, no el color.
 * El gimnasio es la excepción — cierra el capítulo y se gana el dorado.
 */
const KIND_STYLE: Record<
  CampaignLocationKind,
  { icon: ZoneIconKind; text: string; ring: string; glow: string }
> = {
  town: {
    icon: "town",
    text: "text-white/55",
    ring: "border-white/12 bg-[#1a1c24]",
    glow: "rgba(255,255,255,0.18)",
  },
  route: {
    icon: "route",
    text: "text-white/55",
    ring: "border-white/12 bg-[#1a1c24]",
    glow: "rgba(255,255,255,0.18)",
  },
  forest: {
    icon: "forest",
    text: "text-white/55",
    ring: "border-white/12 bg-[#1a1c24]",
    glow: "rgba(255,255,255,0.18)",
  },
  dungeon: {
    icon: "dungeon",
    text: "text-white/55",
    ring: "border-white/12 bg-[#1a1c24]",
    glow: "rgba(255,255,255,0.18)",
  },
  gym: {
    icon: "gym",
    text: "text-electric-yellow",
    ring: "border-electric-yellow/45 bg-[#1a1c24]",
    glow: "color-mix(in srgb, var(--color-electric-yellow) 45%, transparent)",
  },
};

const SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45";

/** Iconos de objetivo: PNG de juego, sin tile de fondo. */
const OBJECTIVE_ICON_SRC: Record<Exclude<ZoneObjectiveId, "trainers">, string> = {
  stages: "/nav/beast-icon.png",
  pokedex: "/nav/collection-icon.png",
};

function kindOf(zone: MapLocation): CampaignLocationKind {
  return zone.kindKey.replace("kinds.", "") as CampaignLocationKind;
}

export type JourneySummary = {
  badges: number;
  badgesTotal: number;
  speciesCaught: number;
  speciesTotal: number;
  zonesUnlocked: number;
  zonesTotal: number;
  shinies: number;
  journeyPercent: number;
  teamMaxLevel: number;
};

export type GymRequirement = {
  /** Nivel máximo del equipo del líder — referencia para el jugador. */
  recommendedLevel: number;
  badgeName: string;
  /** Tipo del gimnasio → `/gyms/badges/{type}.png`. */
  badgeType: string;
  gymId: string;
  /** Sprite del líder. `null` si el gimnasio no tiene arte asociado. */
  leaderSpriteUrl: string | null;
};

export function CampaignJourney({
  locale,
  chapters,
  initialChapter,
  farmingLocationId,
  farmingStageId,
  summary,
  gymRequirements,
  regionMapSrc,
  milestone,
  progress,
  earnedGymOrders,
}: {
  locale: string;
  chapters: Chapter[];
  initialChapter: number;
  farmingLocationId: string;
  farmingStageId: string;
  summary: JourneySummary;
  gymRequirements: Record<string, GymRequirement>;
  regionMapSrc: string;
  milestone: CampaignMilestone;
  progress: CampaignProgressRow;
  earnedGymOrders: number[];
}) {
  const t = useTranslations("campaign");
  const tUx = useTranslations("ux");
  const [chapterIndex, setChapterIndex] = useState(initialChapter);
  /** null = ninguna card del recorrido expandida (todas colapsadas). */
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [claimPopup, setClaimPopup] = useState<ZoneRewardClaim | null>(null);
  const [unlockToast, setUnlockToast] = useState<{ id: string; name: string } | null>(null);

  const chapter = chapters[chapterIndex] ?? chapters[0];
  const zone =
    (zoneId ? chapter?.zones.find((z) => z.id === zoneId) : null) ??
    chapter?.zones.find((z) => z.id === farmingLocationId) ??
    chapter?.zones[0] ??
    null;
  const farmingZone =
    chapters.flatMap((c) => c.zones).find((z) => z.id === farmingLocationId) ?? null;

  const gymRecLevel =
    milestone.kind === "gym" && milestone.locationId
      ? gymRequirements[milestone.locationId]?.recommendedLevel
      : chapter?.gym
        ? gymRequirements[chapter.gym.id]?.recommendedLevel
        : null;

  const primaryAction = getCampaignPrimaryAction({
    progress,
    earnedGymOrders,
    teamMaxLevel: summary.teamMaxLevel,
    chapter: chapter ?? null,
    gymRecommendedLevel: gymRecLevel,
  });

  const gymChallengeHref =
    primaryAction.action === "challenge_gym" && primaryAction.milestone.kind === "gym"
      ? gymRequirements[primaryAction.milestone.locationId ?? ""]?.gymId
        ? `/gyms/${gymRequirements[primaryAction.milestone.locationId!].gymId}`
        : primaryAction.href
      : null;
  const helpBullets = (tUx.raw("help.campaign") as string[]) ?? [];
  // Título del banner = destino del capítulo que estás mirando (no farming sticky).
  const locationLabelKey =
    chapter?.nameKey ??
    zone?.nameKey ??
    farmingZone?.nameKey ??
    primaryAction.locationNameKey ??
    "regions.kanto";
  const bannerArt = campaignBannerForChapter(chapter?.number ?? 1);
  const chapterBadgeEarned =
    chapter?.gymOrder != null && earnedGymOrders.includes(chapter.gymOrder);

  function openChapter(i: number) {
    setChapterIndex(i);
    const next = chapters[i];
    if (!next) return;
    // Al cambiar de capítulo, colapsar el recorrido otra vez.
    if (!next.zones.some((z) => z.id === zoneId)) {
      setZoneId(null);
    }
  }

  function pickZone(id: string) {
    setZoneId((prev) => (prev === id ? null : id));
  }

  function travelTo(id: string) {
    startTransition(async () => {
      await selectLocation(id, locale);
      const nameKey = chapters.flatMap((c) => c.zones).find((z) => z.id === id)?.nameKey;
      if (nameKey) showToast(t("movedHere", { name: t(nameKey) }), "success");
    });
  }

  function farmStage(stageId: string) {
    startTransition(async () => {
      await setFarmingStage(stageId, locale);
      const stageName = chapters
        .flatMap((c) => c.zones)
        .flatMap((z) => z.stages)
        .find((s) => s.id === stageId)?.nameKey;
      if (stageName) showToast(t("stageSet", { name: t(stageName) }), "info");
    });
  }

  function claim(locationId: string, objective: ZoneObjectiveId) {
    startTransition(async () => {
      const result = await claimZoneObjective(locale, locationId, objective);
      if (!result.ok) {
        showToast(t(campaignClaimErrorKey(result.error)), "error");
        return;
      }
      announceCoinDelta(result.coins);
      setClaimPopup({
        objectiveLabel: t(`obj_${objective}`),
        coins: result.coins,
        itemName: result.itemName,
        quantity: result.quantity,
      });
    });
  }

  function challengeTrainer(trainerId: string) {
    startTransition(async () => {
      const result = await startTrainerBattle(trainerId, locale);
      if (result && !result.success) {
        showToast(t(campaignTrainerErrorKey(result.error)), "error");
      }
    });
  }

  useEffect(() => {
    try {
      const key = "pokerpg:zones-unlocked-count";
      const prev = Number(window.sessionStorage.getItem(key) ?? "0");
      if (summary.zonesUnlocked > prev && prev > 0 && farmingZone) {
        const toast = { id: farmingZone.id, name: t(farmingZone.nameKey) };
        requestAnimationFrame(() => setUnlockToast(toast));
      }
      window.sessionStorage.setItem(key, String(summary.zonesUnlocked));
    } catch {
      /* ignore */
    }
  }, [summary.zonesUnlocked, farmingZone, t]);

  return (
    <div className={pending ? "opacity-90 transition-opacity" : undefined}>
      {unlockToast && (
        <UnlockCelebration locationId={unlockToast.id} locationName={unlockToast.name} />
      )}
      {claimPopup && (
        <ZoneRewardPopup
          reward={claimPopup}
          labels={{
            title: t("rewardClaimed"),
            coins: t("rewardCoins"),
            continue: t("rewardContinue"),
          }}
          onContinue={() => setClaimPopup(null)}
        />
      )}

      {/* Hero banner ilustrado + próximo objetivo */}
      <CoachMark storageKey="coach-explore" message={tUx("coachExplore")}>
        <div>
          <CampaignUnlockFeedback
            action={primaryAction.action}
            locationName={
              primaryAction.locationNameKey
                ? t(primaryAction.locationNameKey)
                : undefined
            }
          />
          <CampaignPrimaryObjective
            action={primaryAction}
            gymHref={gymChallengeHref}
            bannerSrc={bannerArt.src}
            bannerObjectPosition={bannerArt.objectPosition}
            locationName={t(locationLabelKey)}
            regionLabel={t("regions.kanto")}
            chapterLabel={chapter ? `${t("chapter")} ${chapter.number}` : null}
            stagesDone={chapter?.stagesDone ?? 0}
            stagesTotal={chapter?.stagesTotal ?? 0}
            journeyMenu={
              <details className="group relative">
                <CampaignJourneyMenuTrigger
                  desktopLabel={t("viewFullJourney")}
                  mobileLabel={t("journeyProgress")}
                />
                <div className="absolute right-0 z-30 mt-2 w-[min(100vw-1.5rem,22rem)] rounded-2xl game-float-card p-2 sm:w-96">
                  <JourneyStrip
                    chapters={chapters}
                    activeIndex={chapterIndex}
                    onPick={(i) => {
                      openChapter(i);
                    }}
                    percent={summary.journeyPercent}
                    label={t("journeyProgress")}
                    chapterLabel={t("chapter")}
                  />
                  <div className="mt-2">
                    <JourneySummaryCard summary={summary} mapSrc={regionMapSrc} />
                  </div>
                  <HubHelpPanel
                    storageKey="hub-help-campaign"
                    bullets={helpBullets}
                    handbookChapter="journey"
                  />
                </div>
              </details>
            }
          />
        </div>
      </CoachMark>

      {/*
        Mobile: mapa → detalle (objetivos / premios).
        Desktop lg+: recorrido | panel sticky. xl+: + aside de capítulos.
      */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(280px,340px)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <aside className="hidden flex-col gap-3 xl:flex">
          <nav className="game-float-card rounded-2xl p-2" aria-label={t("chapter")}>
            <p className={`mb-1.5 px-1.5 pt-1 ${SECTION_LABEL}`}>{t("chapterPath")}</p>
            {chapters.map((c, i) => {
              const active = i === chapterIndex;
              return (
                <button
                  key={c.number}
                  type="button"
                  onClick={() => openChapter(i)}
                  disabled={!c.unlocked}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-label-sm transition ${
                    active
                      ? "bg-[#1a1c24] text-white ring-1 ring-pokeball-red/55 shadow-[0_0_18px_color-mix(in_srgb,var(--color-pokeball-red)_22%,transparent)]"
                      : c.unlocked
                        ? "text-white/55 hover:bg-[#1a1c24] hover:text-white"
                        : "text-white/30"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[16px]! ${
                      c.completed
                        ? "text-electric-yellow"
                        : active
                          ? "text-pokeball-red"
                          : ""
                    }`}
                  >
                    {c.completed ? "check_circle" : c.unlocked ? "play_arrow" : "lock"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {c.number}. {t(c.nameKey)}
                  </span>
                </button>
              );
            })}
          </nav>
          <p className={`px-1 ${SECTION_LABEL}`}>{t("secondaryChapter")}</p>
          <JourneySummaryCard summary={summary} mapSrc={regionMapSrc} />
        </aside>

        <div className="min-w-0 order-1 lg:order-none">
          <nav
            className="mb-3 flex gap-1.5 overflow-x-auto pb-1 xl:hidden"
            aria-label={t("chapter")}
          >
            {chapters.map((c, i) => {
              const active = i === chapterIndex;
              return (
                <button
                  key={c.number}
                  type="button"
                  onClick={() => openChapter(i)}
                  disabled={!c.unlocked}
                  title={`${t("chapter")} ${c.number}`}
                  className={`min-h-8 shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold leading-tight transition sm:min-h-10 sm:px-3 sm:py-1.5 sm:text-label-sm ${
                    active
                      ? "game-float-card text-white ring-1 ring-pokeball-red/55"
                      : c.unlocked
                        ? "bg-[#1a1c24] text-white/55"
                        : "bg-[#12141c] text-white/30"
                  }`}
                >
                  {t(c.nameKey)}
                </button>
              );
            })}
          </nav>

          {chapter && (
            <>
              <p className={`mb-2 ${SECTION_LABEL}`}>{t("chapterPath")}</p>
              <ol className="relative flex flex-col gap-2.5 sm:gap-3.5">
                {chapter.zones.map((z, i) => {
                  const nodeStatus = resolveZoneNodeStatus({
                    zone: z,
                    farmingLocationId,
                    selectedZoneId: zoneId,
                    chapter,
                    badgeEarned: chapterBadgeEarned,
                  });
                  return (
                    <ZoneRow
                      key={z.id}
                      zone={z}
                      isLast={i === chapter.zones.length - 1}
                      selected={zoneId === z.id}
                      isFarming={z.id === farmingLocationId}
                      gymRequirement={gymRequirements[z.id]}
                      chapter={chapter}
                      teamMaxLevel={summary.teamMaxLevel}
                      nodeStatus={nodeStatus}
                      unlockRequirements={getZoneUnlockRequirements(z.id, progress)}
                      onPick={() => pickZone(z.id)}
                    />
                  );
                })}
              </ol>
            </>
          )}
        </div>

        {/*
          `min-w-0`: sin esto el track del grid no puede encoger por debajo del
          contenido más ancho y empuja la columna hermana.
        */}
        <div className="min-w-0 order-2 lg:order-none lg:sticky lg:top-20 lg:self-start">
          {zone && (
            <ZonePanel
              zone={zone}
              chapter={chapter}
              isFarming={zone.id === farmingLocationId}
              farmingStageId={farmingStageId}
              pending={pending}
              gymRequirement={gymRequirements[zone.id]}
              gymWon={
                zone.gymOrder != null && earnedGymOrders.includes(zone.gymOrder)
              }
              teamMaxLevel={summary.teamMaxLevel}
              unlockRequirements={getZoneUnlockRequirements(zone.id, progress)}
              onTravel={() => travelTo(zone.id)}
              onFarmStage={farmStage}
              onChallengeTrainer={challengeTrainer}
              onClaim={(objective) => claim(zone.id, objective)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function JourneyStrip({
  chapters,
  activeIndex,
  onPick,
  percent,
  label,
  chapterLabel,
}: {
  chapters: Chapter[];
  activeIndex: number;
  onPick: (i: number) => void;
  percent: number;
  label: string;
  chapterLabel: string;
}) {
  return (
    <section className="game-float-card rounded-2xl p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={SECTION_LABEL}>{label}</span>
        <span className="font-mono text-label-sm text-white/70">{percent}%</span>
      </div>
      <div
        className="grid items-stretch gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${chapters.length}, minmax(0, 1fr))` }}
      >
        {chapters.map((c, i) => {
          const active = i === activeIndex;
          const badgeType = c.gymOrder != null ? BADGE_TYPE_BY_ORDER[c.gymOrder] : null;
          return (
            <button
              key={c.number}
              type="button"
              onClick={() => onPick(i)}
              disabled={!c.unlocked}
              title={`${chapterLabel} ${c.number}`}
              className={`relative flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-0.5 py-2 transition sm:min-h-[4rem] sm:px-1 ${
                active
                  ? "bg-pokeball-red/14"
                  : c.unlocked
                    ? "bg-[#161822] hover:bg-[#1a1c24]"
                    : "bg-[#12141c] opacity-45"
              }`}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9 ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--color-pokeball-red)_14%,#0a0610)] shadow-[0_0_0_2px_var(--color-pokeball-red)]"
                    : c.completed
                      ? "bg-[#1a1c24] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-electric-yellow)_45%,transparent)]"
                      : c.unlocked
                        ? "bg-[#12141c] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                        : "bg-[#0c0e14] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                }`}
              >
                {!c.unlocked ? (
                  <span className="material-symbols-outlined text-[16px]! text-white/40">
                    lock
                  </span>
                ) : badgeType ? (
                  <Image
                    src={gymBadgeImageUrl(badgeType)}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                    className={`h-6 w-6 object-contain sm:h-7 sm:w-7 ${
                      c.completed || active ? "" : "opacity-55 grayscale"
                    }`}
                    aria-hidden
                  />
                ) : (
                  <span
                    className={`material-symbols-outlined text-[18px]! ${
                      c.completed || active ? "text-electric-yellow" : "text-white/50"
                    }`}
                  >
                    {c.completed ? "military_tech" : "flag"}
                  </span>
                )}
              </span>
              <span className="h-1 w-[85%] overflow-hidden rounded-full bg-black/45">
                <span
                  className={`block h-full rounded-full ${PATH_PROGRESS_FILL} transition-all duration-500`}
                  style={{ width: `${c.unlocked ? c.percent : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ZoneRow({
  zone,
  isLast,
  selected,
  isFarming,
  gymRequirement,
  chapter,
  teamMaxLevel,
  nodeStatus,
  unlockRequirements,
  onPick,
}: {
  zone: MapLocation;
  isLast: boolean;
  selected: boolean;
  isFarming: boolean;
  gymRequirement?: GymRequirement;
  chapter: Chapter;
  teamMaxLevel: number;
  nodeStatus: CampaignNodeStatus;
  unlockRequirements: CampaignRequirement[];
  onPick: () => void;
}) {
  const t = useTranslations("campaign");
  const kind = kindOf(zone);
  const style = KIND_STYLE[kind];
  const isGym = kind === "gym";
  const gymWon = isGym && (nodeStatus === "completed" || nodeStatus === "reward_pending");
  const done = nodeStatus === "completed" || gymWon;
  /** Solo la card clickeada se expande; el resto queda colapsada. */
  const compact = !selected;
  const caught = zone.encounters.filter((e) => e.caught).length;
  const pct = zone.totalStages > 0 ? (zone.completedStages / zone.totalStages) * 100 : 0;
  const pathPct = isGym
    ? chapter.completed || gymWon
      ? 100
      : 0
    : done
      ? 100
      : pct;
  const hasStageArt = campaignMapHasArt(zone.id);
  const artLayout = campaignMapArtLayout(zone.id);
  const artBleed = hasStageArt && artLayout === "bleed";
  const thumbSrc = campaignMapSrc(zone.id);
  const nodeClass = isGym ? PATH_NODE_GYM : PATH_NODE_SM;
  /** Debajo del círculo (mt-2 + tamaño del nodo). */
  const railLineTop = isGym
    ? "top-[calc(0.5rem+2.25rem)] sm:top-[calc(0.5rem+3rem)] lg:top-[calc(0.5rem+3.5rem)]"
    : "top-[calc(0.5rem+1.5rem)] sm:top-[calc(0.5rem+2rem)]";
  const lineFilled =
    done || pathPct >= 100 || isFarming || nodeStatus === "current" || nodeStatus === "in_progress";
  const lineFillPct = done || pathPct >= 100 ? 100 : Math.min(100, Math.max(0, pathPct));

  const requirementsLeft =
    isGym && zone.unlocked && !gymWon
      ? [
          chapter.stagesDone < chapter.stagesTotal
            ? t("reqStagesDetail", {
                done: chapter.stagesDone,
                total: chapter.stagesTotal,
              })
            : null,
          gymRequirement && teamMaxLevel < gymRequirement.recommendedLevel
            ? t("reqLevel", { level: gymRequirement.recommendedLevel })
            : null,
        ].filter(Boolean)
      : [];

  const statusLabel =
    nodeStatus === "locked"
      ? t("nodeLocked")
      : gymWon
        ? t("nodeWon")
        : nodeStatus === "completed"
          ? t("nodeCompleted")
          : nodeStatus === "in_progress"
            ? t("nodeInProgress")
            : nodeStatus === "current"
              ? t("nodeCurrent")
              : null;

  return (
    <li className="relative flex items-stretch gap-2 sm:gap-3">
      {/* Ancho fijo (= gimnasio) para centrar nodos chicos y la línea. */}
      <div className="relative w-9 shrink-0 self-stretch sm:w-12 lg:w-14">
        <span
          className={`relative z-10 mx-auto mt-1.5 flex ${nodeClass} items-center justify-center rounded-full border sm:mt-2 ${
            !zone.unlocked
              ? "border-white/15 bg-[#12141c] text-white/35"
              : isFarming || nodeStatus === "current"
                ? "border-pokeball-red bg-[color-mix(in_srgb,var(--color-pokeball-red)_14%,#0a0610)] text-pokeball-red"
                : done
                  ? "bg-[color-mix(in_srgb,var(--color-electric-yellow)_10%,#0a0610)]"
                  : `${style.ring} ${style.text}`
          }`}
          style={
            done && zone.unlocked
              ? {
                  borderColor: PATH_DONE_RING,
                  color: PATH_DONE,
                  boxShadow: `0 0 8px ${PATH_DONE_GLOW}, 0 0 16px ${PATH_DONE_GLOW}, inset 0 0 8px ${PATH_DONE_SOFT}`,
                }
              : isFarming || nodeStatus === "current"
                ? { boxShadow: "0 0 12px color-mix(in srgb, var(--color-pokeball-red) 40%, transparent)" }
                : zone.unlocked && isGym && !done
                  ? { boxShadow: `0 0 10px ${style.glow}` }
                  : undefined
          }
          aria-current={selected || isFarming ? "step" : undefined}
        >
          {!zone.unlocked ? (
            <span
              className={`material-symbols-outlined ${isGym ? "text-[16px]! sm:text-[20px]! lg:text-[22px]!" : "text-[12px]! sm:text-[15px]!"}`}
            >
              lock
            </span>
          ) : done ? (
            <span
              className={`material-symbols-outlined font-bold ${isGym ? "text-[16px]! sm:text-[22px]! lg:text-[24px]!" : "text-[12px]! sm:text-[16px]!"}`}
              style={{
                color: PATH_DONE,
                filter: `drop-shadow(0 0 5px ${PATH_DONE_GLOW_STRONG})`,
              }}
            >
              check
            </span>
          ) : isGym && gymRequirement?.leaderSpriteUrl ? (
            <Image
              src={gymRequirement.leaderSpriteUrl}
              alt=""
              width={56}
              height={56}
              unoptimized
              className={
                gymRequirement.leaderSpriteUrl.includes("/avatars/")
                  ? "h-7 w-7 object-contain object-bottom drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                  : "h-7 w-7 object-contain object-bottom [image-rendering:pixelated] sm:h-10 sm:w-10 lg:h-11 lg:w-11"
              }
            />
          ) : (
            <ZoneIcon
              kind={style.icon}
              className={isGym ? "h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" : "h-3 w-3 sm:h-4 sm:w-4"}
            />
          )}
        </span>
        {!isLast ? (
          <span
            aria-hidden
            className={`pointer-events-none absolute left-1/2 z-0 w-[2px] min-h-[1.5rem] -translate-x-1/2 overflow-visible rounded-full bg-white/15 ${railLineTop} -bottom-3.5`}
          >
            <span
              className="campaign-path-neon absolute inset-x-0 top-0 w-full rounded-full transition-[height] duration-500 ease-out"
              style={{
                height: `${lineFillPct}%`,
                background: lineFilled
                  ? `linear-gradient(180deg, ${PATH_DONE} 0%, var(--theme-primary-bright) 55%, var(--color-pokeball-red) 100%)`
                  : "transparent",
                opacity: lineFilled && lineFillPct > 0 ? 1 : 0,
              }}
            />
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onPick}
        aria-expanded={selected}
        className={`game-float-card game-float-card--interactive relative min-w-0 flex-1 overflow-hidden rounded-xl text-left transition sm:rounded-2xl ${
          hasStageArt && zone.unlocked ? "p-0" : compact ? "px-2.5 py-1 sm:px-3 sm:py-1.5" : "p-2.5 sm:p-3"
        } ${
          !zone.unlocked
            ? "opacity-45"
            : selected
              ? "ring-2 ring-electric-yellow/80 shadow-[0_0_28px_color-mix(in_srgb,var(--color-electric-yellow)_42%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-electric-yellow)_25%,transparent)]"
              : isFarming || nodeStatus === "current"
                ? "ring-1 ring-pokeball-red/55 shadow-[0_0_20px_color-mix(in_srgb,var(--color-pokeball-red)_18%,transparent)]"
                : isGym && !done
                  ? "ring-1 ring-electric-yellow/40"
                  : ""
        }`}
      >
        {artBleed && zone.unlocked ? (
          <div
            className={`relative isolate ${
              compact ? "min-h-[4.25rem] sm:min-h-[5.5rem]" : "min-h-[6.25rem] sm:min-h-[8.5rem]"
            }`}
          >
            <div className="pointer-events-none absolute inset-0">
              <Image
                src={thumbSrc}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                quality={95}
                unoptimized
                className="object-cover object-center"
                priority={false}
              />
              {/* Solo legibilidad a la izquierda — el panorama se ve entero. */}
              <div className="absolute inset-0 bg-linear-to-r from-[#0a0b10]/75 via-[#0a0b10]/25 to-transparent sm:via-[#0a0b10]/12 sm:w-[55%]" />
              <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-[#0a0b10]/35 to-transparent" />
              {selected ? (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(80%_70%_at_20%_50%,color-mix(in_srgb,var(--color-electric-yellow)_22%,transparent)_0%,transparent_65%)]"
                />
              ) : null}
            </div>
            <div
              className={`relative z-[1] flex flex-col justify-center ${
                compact ? "px-2.5 py-2 sm:px-3 sm:py-2.5" : "px-3 py-2.5 sm:px-4 sm:py-3.5"
              }`}
            >
              <ZoneRowBody
                zone={zone}
                t={t}
                compact={compact}
                isGym={isGym}
                gymWon={gymWon}
                done={done}
                statusLabel={statusLabel}
                nodeStatus={nodeStatus}
                style={style}
                isFarming={isFarming}
                caught={caught}
                pct={pct}
                requirementsLeft={requirementsLeft}
                unlockRequirements={unlockRequirements}
              />
            </div>
          </div>
        ) : (
        <div className={`flex ${
            hasStageArt && zone.unlocked
              ? compact
                ? "min-h-[4.25rem] items-stretch sm:min-h-[5.25rem]"
                : "min-h-[5.75rem] items-stretch sm:min-h-[7.75rem]"
              : compact
                ? "items-center gap-2"
                : "items-start gap-2.5"
          }`}
        >
          {zone.unlocked && (hasStageArt || !compact) ? (
            <span
              className={`relative shrink-0 overflow-hidden ${
                hasStageArt
                  ? compact
                    ? "w-[4.25rem] self-stretch sm:w-[5.25rem]"
                    : "w-[5.25rem] self-stretch sm:w-[7.5rem]"
                  : "mt-0.5 h-10 w-10 rounded-xl ring-1 ring-white/10 sm:h-12 sm:w-12"
              }`}
            >
              <Image
                src={thumbSrc}
                alt=""
                fill
                sizes={hasStageArt ? "100px" : "48px"}
                className="object-cover"
              />
              {hasStageArt ? (
                <>
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-r from-transparent via-[#12141c]/25 to-[#12141c]"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-[#12141c]/70 to-transparent"
                  />
                </>
              ) : (
                <span className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
              )}
            </span>
          ) : null}

          <div
            className={`min-w-0 flex-1 ${
              hasStageArt && zone.unlocked
                ? compact
                  ? "flex flex-col justify-center py-1.5 pr-2.5 pl-1.5 sm:py-2 sm:pr-3 sm:pl-2"
                  : "flex flex-col justify-center py-2 pr-2.5 pl-1.5 sm:py-3 sm:pr-3.5 sm:pl-2"
                : ""
            }`}
          >
              <ZoneRowBody
                zone={zone}
                t={t}
                compact={compact}
                isGym={isGym}
                gymWon={gymWon}
                done={done}
                statusLabel={statusLabel}
                nodeStatus={nodeStatus}
                style={style}
                isFarming={isFarming}
                caught={caught}
                pct={pct}
                requirementsLeft={requirementsLeft}
                unlockRequirements={unlockRequirements}
              />
          </div>
        </div>
        )}
      </button>
    </li>
  );
}

function ZoneRowBody({
  zone,
  t,
  compact,
  isGym,
  gymWon,
  done,
  statusLabel,
  nodeStatus,
  style,
  isFarming,
  caught,
  pct,
  requirementsLeft,
  unlockRequirements,
}: {
  zone: MapLocation;
  t: ReturnType<typeof useTranslations>;
  compact: boolean;
  isGym: boolean;
  gymWon: boolean;
  done: boolean;
  statusLabel: string | null;
  nodeStatus: CampaignNodeStatus;
  style: (typeof KIND_STYLE)[CampaignLocationKind];
  isFarming: boolean;
  caught: number;
  pct: number;
  requirementsLeft: (string | null)[];
  unlockRequirements: CampaignRequirement[];
}) {
  return (
    <>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <h3
            className={`${
              isGym && !compact
                ? "text-[14px] font-bold leading-tight sm:text-headline-md"
                : compact
                  ? "text-[12px] font-semibold leading-tight sm:text-body-sm"
                  : "text-[13px] font-semibold leading-tight sm:text-body-md"
            } ${compact ? "text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]" : "text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]"}`}
          >
            {t(zone.nameKey)}
          </h3>
          {statusLabel && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider sm:px-2 sm:text-[9px] ${
                gymWon || (done && !isGym)
                  ? ""
                  : nodeStatus === "current" || nodeStatus === "in_progress"
                    ? "bg-pokeball-red/18 text-pokeball-red"
                    : "bg-[#1a1c24]/80 text-white/45"
              }`}
              style={
                gymWon || (done && !isGym)
                  ? { backgroundColor: PATH_DONE_SOFT, color: PATH_DONE }
                  : undefined
              }
            >
              {(gymWon || (done && !isGym)) && (
                <span className="material-symbols-outlined text-[10px]! leading-none sm:text-[11px]!">check</span>
              )}
              {statusLabel}
            </span>
          )}
          {!compact && (
            <span
              className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.ring} ${style.text}`}
            >
              {t(zone.kindKey)}
            </span>
          )}
          {isFarming && (
            <span className="inline-flex items-center gap-1 rounded-md bg-pokeball-red/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pokeball-red">
              <span className="material-symbols-outlined text-[12px]!">my_location</span>
              {t("farming")}
            </span>
          )}
        </div>

        {!compact && zone.unlocked && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-white/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
            {zone.totalStages > 0 && (
              <span className="inline-flex items-center gap-1">
                <Image src="/nav/adventure-icon.png" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" aria-hidden />
                <span className="text-white">{zone.completedStages}/{zone.totalStages}</span>
              </span>
            )}
            {zone.encounters.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Image src="/nav/collection-icon.png" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" aria-hidden />
                <span className="text-white">{caught}/{zone.encounters.length}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Image src="/nav/battle-wild-icon.png" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" aria-hidden />
              {t("wildLevels", { min: zone.levelMin, max: zone.levelMax })}
            </span>
          </div>
        )}

        {!compact && zone.unlocked && zone.totalStages > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
            <div
              className={`h-full rounded-full ${zoneBarFill(isGym, done, isFarming || nodeStatus === "current" || nodeStatus === "in_progress")} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {!compact && isGym && zone.unlocked && requirementsLeft.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5">
            {requirementsLeft.map((r) => (
              <li key={r} className="flex items-center gap-1 text-[11px] text-white/50">
                <span className="material-symbols-outlined text-[13px]! text-pokeball-red">
                  radio_button_unchecked
                </span>
                {r}
              </li>
            ))}
          </ul>
        )}

        {!compact && !zone.unlocked && unlockRequirements.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5">
            {unlockRequirements.map((req) => (
              <li
                key={req.id}
                className="flex items-start gap-1 text-[11px] text-white/45"
              >
                <span className="material-symbols-outlined mt-px text-[13px]!">lock</span>
                <span>{translateRequirement(t, req)}</span>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

function ZonePanel({
  zone,
  chapter,
  isFarming,
  farmingStageId,
  pending,
  gymRequirement,
  gymWon = false,
  teamMaxLevel,
  unlockRequirements,
  onTravel,
  onFarmStage,
  onChallengeTrainer,
  onClaim,
}: {
  zone: MapLocation;
  chapter: Chapter;
  isFarming: boolean;
  farmingStageId: string;
  pending: boolean;
  gymRequirement?: GymRequirement;
  gymWon?: boolean;
  teamMaxLevel: number;
  unlockRequirements: CampaignRequirement[];
  onTravel: () => void;
  onFarmStage: (stageId: string) => void;
  onChallengeTrainer: (trainerId: string) => void;
  onClaim: (objective: ZoneObjectiveId) => void;
}) {
  const t = useTranslations("campaign");
  const tUx = useTranslations("ux");
  const kind = kindOf(zone);
  const style = KIND_STYLE[kind];
  const isGym = kind === "gym";
  const caught = zone.encounters.filter((e) => e.caught).length;
  const seenCount = zone.encounters.filter((e) => e.seen).length;
  const objectives = evaluateObjectives(zone, new Set(zone.claimedObjectives));
  const trainersDone = zone.trainers.filter((tr) => tr.defeated).length;
  const gymReady = isGym && chapter.stagesDone >= chapter.stagesTotal;

  return (
    <section
      className={`game-float-card rounded-2xl p-4 ${
        isFarming ? "ring-1 ring-pokeball-red/45 shadow-[0_0_22px_color-mix(in_srgb,var(--color-pokeball-red)_16%,transparent)]" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 sm:h-14 sm:w-14 ${style.ring} ${style.text}`}
          style={
            isGym && gymRequirement?.leaderSpriteUrl
              ? { boxShadow: `0 0 16px ${style.glow}` }
              : { boxShadow: "0 0 16px color-mix(in srgb, var(--color-pokeball-red) 20%, transparent)" }
          }
        >
          {isGym && gymRequirement?.leaderSpriteUrl ? (
            <Image
              src={gymRequirement.leaderSpriteUrl}
              alt=""
              width={48}
              height={48}
              unoptimized
              className={
                gymRequirement.leaderSpriteUrl.includes("/avatars/")
                  ? "h-10 w-10 object-contain object-bottom drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:h-11 sm:w-11"
                  : "h-10 w-10 object-contain object-bottom [image-rendering:pixelated] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:h-11 sm:w-11"
              }
            />
          ) : (
            <ZoneIcon kind={style.icon} className="h-9 w-9 sm:h-10 sm:w-10" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-headline-md text-white">{t(zone.nameKey)}</h3>
            {isFarming && (
              <span className="inline-flex items-center gap-1 rounded-md bg-pokeball-red/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pokeball-red">
                <span className="material-symbols-outlined text-[12px]!">my_location</span>
                {tUx("youAreHere")}
              </span>
            )}
          </div>
          <p className="hidden text-label-sm text-white/45 lg:block">
            {t(zone.kindKey)}
            <span className="mx-1.5 text-white/25">•</span>
            {t("wildLevels", { min: zone.levelMin, max: zone.levelMax })}
            <span className="mx-1.5 text-white/25">•</span>
            {t(`encounterRate.${zone.encounterRate}`)}
          </p>
        </div>
      </div>

      {zone.unlocked && zone.trainers.length > 0 && (
        <p className="game-float-tile mt-3 hidden rounded-xl px-3 py-2 text-label-sm text-white/80 lg:block">
          <span className="font-bold text-electric-yellow">
            {trainersDone}/{zone.trainers.length}
          </span>{" "}
          <span className="text-white/45">{t("obj_trainers")}</span>
        </p>
      )}

      {zone.unlocked && (
        <details className="mt-3 hidden border-t border-white/[0.08] pt-3 open:pb-1 lg:block">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5 text-label-sm text-pokeball-red">
              <MasteryIcon className="h-4 w-4" />
              {t("mastery")} · Lv. {zone.masteryLevel} · {masteryProgressPercent(zone.masteryXp)}%
            </span>
            <span className="material-symbols-outlined text-[16px]! text-white/40">
              expand_more
            </span>
          </summary>
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="campaign-warm-bar h-full rounded-full transition-all duration-500"
                style={{ width: `${masteryProgressPercent(zone.masteryXp)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-white/45">
              {t("masteryBonuses", {
                xp: masteryBonuses(zone.masteryLevel).xp,
                capture: masteryBonuses(zone.masteryLevel).capture,
                coins: masteryBonuses(zone.masteryLevel).coins,
              })}
            </p>
          </div>
        </details>
      )}

      {!zone.unlocked ? (
        <div className="game-float-tile mt-3 rounded-xl border-dashed px-3 py-4">
          <p className="text-center text-label-sm text-white/45">{t("zoneLocked")}</p>
          {unlockRequirements.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {unlockRequirements.map((req) => (
                <li
                  key={req.id}
                  className="flex items-start gap-2 text-label-sm text-white/50"
                >
                  <span className="material-symbols-outlined mt-0.5 text-[16px]!">lock</span>
                  <span>{translateRequirement(t, req)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <p className={`mt-4 mb-2 ${SECTION_LABEL}`}>{t("objectives")}</p>
          <ul className="flex flex-col divide-y divide-white/[0.06]">
            {objectives.map((obj, index) => {
              const trainerSprite =
                obj.id === "trainers"
                  ? (zone.trainers.find((tr) => !tr.defeated)?.spriteUrl ??
                    zone.trainers[0]?.spriteUrl ??
                    null)
                  : null;
              return (
                <Objective
                  key={obj.id}
                  state={obj}
                  step={index + 1}
                  isMain={obj.id === "stages"}
                  roleLabel={obj.id === "stages" ? t("objRoleMain") : t("objRoleOptional")}
                  label={t(`obj_${obj.id}`)}
                  claimLabel={t("claim")}
                  claimedLabel={t("claimed")}
                  pending={pending}
                  trainerSpriteUrl={trainerSprite}
                  encounters={obj.id === "pokedex" ? zone.encounters : undefined}
                  onClaim={() => onClaim(obj.id)}
                />
              );
            })}
            {isGym && gymRequirement && (
              gymWon ? (
                <li className="game-float-tile flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 ring-electric-yellow/35">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
                    <Image
                      src={gymBadgeImageUrl(gymRequirement.badgeType)}
                      alt=""
                      width={44}
                      height={44}
                      className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_color-mix(in_srgb,var(--color-electric-yellow)_35%,transparent)]"
                    />
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-electric-yellow text-[#1a1208]">
                      <span className="material-symbols-outlined text-[11px]! leading-none">
                        check
                      </span>
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-electric-yellow">
                      {t("nodeWon")}
                    </p>
                    <p className="truncate text-label-sm text-white">
                      {gymRequirement.badgeName || t("objBadge")}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[20px]! text-electric-yellow">
                    task_alt
                  </span>
                </li>
              ) : (
                <li className="game-float-tile flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 ring-pokeball-red/35">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
                    <Image
                      src={gymBadgeImageUrl(gymRequirement.badgeType)}
                      alt=""
                      width={44}
                      height={44}
                      className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_color-mix(in_srgb,var(--color-pokeball-red)_35%,transparent)]"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-pokeball-red">
                      {t("objRoleRequirement")}
                    </p>
                    <p className="truncate text-label-sm text-white">
                      {gymRequirement.badgeName || t("objBadge")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#12141c] px-2 py-1 font-mono text-[11px] text-electric-yellow">
                    {`Lv. ${gymRequirement.recommendedLevel}`}
                  </span>
                </li>
              )
            )}
          </ul>

          {zone.encounters.length > 0 && (
            <div className="mt-4 hidden lg:block">
              <p className={`mb-1.5 flex items-center justify-between ${SECTION_LABEL}`}>
                {t("zoneWilds")}
                <span className="font-mono normal-case tracking-normal text-white/70">
                  {caught}/{zone.encounters.length}
                  <span className="ml-1.5 text-white/40">
                    ({seenCount} {t("seenShort")})
                  </span>
                </span>
              </p>
              <ul className="flex flex-wrap gap-2">
                {zone.encounters.map((mon) => (
                  <li
                    key={mon.speciesId}
                    title={`${mon.name}${mon.seen ? ` · ${t(`rarity.${mon.rarity}`)}` : ""}`}
                    className="flex w-14 flex-col items-center gap-1"
                  >
                    <span
                      className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1c24] border ${
                        mon.caught
                          ? RARITY_STYLE[mon.rarity]
                          : mon.seen
                            ? RARITY_STYLE[mon.rarity]
                            : "border-white/8"
                      }`}
                    >
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={44}
                        height={44}
                        className={`h-10 w-10 object-contain ${
                          mon.caught
                            ? ""
                            : mon.seen
                              ? "opacity-60 grayscale"
                              : "brightness-0 opacity-40"
                        }`}
                      />
                      {mon.caught && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-surface">
                          <span className="material-symbols-outlined text-[11px]! leading-none">
                            check
                          </span>
                        </span>
                      )}
                    </span>
                    <span
                      className={`max-w-full truncate text-center text-[9px] capitalize leading-tight ${
                        mon.caught
                          ? "text-white"
                          : mon.seen
                            ? "text-white/55"
                            : "text-white/35"
                      }`}
                    >
                      {mon.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {zone.trainers.length > 0 && (
            <>
              <p className={`mt-4 mb-1.5 flex items-center justify-between ${SECTION_LABEL}`}>
                <span>{t("trainersTitle")}</span>
                <span className="font-mono normal-case tracking-normal text-white/70">
                  {zone.trainers.filter((tr) => tr.defeated).length}/{zone.trainers.length}
                </span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {zone.trainers.map((tr) => (
                  <li
                    key={tr.id}
                    className={`game-float-tile flex items-center gap-2 rounded-xl px-2.5 py-1.5 ${
                      tr.defeated ? "opacity-60" : ""
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Image
                        src={tr.spriteUrl}
                        alt=""
                        width={28}
                        height={28}
                        className={`h-7 w-7 object-contain ${tr.defeated ? "opacity-55 grayscale" : ""}`}
                        unoptimized
                      />
                      {tr.defeated && (
                        <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <span className="material-symbols-outlined text-[10px]! leading-none">
                            check
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-label-sm text-white">
                      {t(tr.nameKey)}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-white/45">
                      Lv. {tr.level}
                    </span>
                    {tr.defeated ? (
                      <span className="shrink-0 text-[10px] uppercase text-emerald-400">
                        {t("trainerBeaten")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onChallengeTrainer(tr.id)}
                        className="ui-btn-primary shrink-0 px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        {t("trainerFight")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {isGym ? (
              <div className="game-float-tile hidden rounded-xl px-3 py-2.5 ring-1 ring-tertiary/25 lg:block">
                <p className="text-label-sm text-white/80">
                  {gymReady ? t("gymChallengeHint") : t("gymLockedHint")}
                </p>
                {!gymReady && (
                  <ul className="mt-2 flex flex-col gap-1">
                    <li
                      className={`flex items-center gap-1.5 text-[11px] ${
                        chapter.stagesDone >= chapter.stagesTotal
                          ? "text-emerald-400"
                          : "text-white/45"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]!">
                        {chapter.stagesDone >= chapter.stagesTotal
                          ? "check_circle"
                          : "radio_button_unchecked"}
                      </span>
                      {t("reqStagesDetail", {
                        done: chapter.stagesDone,
                        total: chapter.stagesTotal,
                      })}
                    </li>
                    {gymRequirement && (
                      <li
                        className={`flex items-center gap-1.5 text-[11px] ${
                          teamMaxLevel >= gymRequirement.recommendedLevel
                            ? "text-emerald-400"
                            : "text-white/45"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]!">
                          {teamMaxLevel >= gymRequirement.recommendedLevel
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                        {t("reqLevel", { level: gymRequirement.recommendedLevel })}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <>
                {!isFarming ? (
                  <GameCtaButton
                    icon="explore"
                    variant="red"
                    disabled={pending}
                    onClick={onTravel}
                  >
                    {t("startExploring")}
                  </GameCtaButton>
                ) : (
                  <GameCtaButton href="/battle" icon="explore" variant="red">
                    {t("continueExpedition")}
                  </GameCtaButton>
                )}

                {/* Stages solo desktop: en mobile el objetivo principal ya marca el progreso. */}
                <div className="hidden lg:block">
                  <p className={`mt-1 ${SECTION_LABEL}`}>{t("pickStage")}</p>
                  <ul className="flex flex-col gap-1">
                    {zone.stages.map((stage) => {
                      const current = stage.id === farmingStageId;
                      return (
                        <li key={stage.id}>
                          <button
                            type="button"
                            disabled={pending || !stage.unlocked || stage.isGym}
                            onClick={() => onFarmStage(stage.id)}
                            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-label-sm transition ${
                              current
                                ? "bg-[#1a1c24] text-white ring-1 ring-electric-yellow/65 shadow-[0_0_16px_color-mix(in_srgb,var(--color-electric-yellow)_28%,transparent)]"
                                : stage.unlocked && !stage.isGym
                                  ? "game-float-tile text-white/80 hover:brightness-110"
                                  : "bg-[#12141c] text-white/30"
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined text-[15px]! ${
                                current || stage.done ? "text-electric-yellow" : ""
                              }`}
                            >
                              {stage.isGym
                                ? "military_tech"
                                : !stage.unlocked
                                  ? "lock"
                                  : stage.done
                                    ? "task_alt"
                                    : current
                                      ? "my_location"
                                      : "radio_button_unchecked"}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{t(stage.nameKey)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Objective({
  state,
  step,
  isMain,
  roleLabel,
  label,
  claimLabel,
  claimedLabel,
  pending,
  trainerSpriteUrl,
  encounters,
  onClaim,
}: {
  state: ZoneObjectiveState;
  step: number;
  isMain: boolean;
  roleLabel: string;
  label: string;
  claimLabel: string;
  claimedLabel: string;
  pending: boolean;
  trainerSpriteUrl?: string | null;
  encounters?: MapEncounter[];
  onClaim: () => void;
}) {
  const pct = state.target > 0 ? Math.min(100, (state.current / state.target) * 100) : 0;
  const iconSrc =
    state.id === "trainers"
      ? (trainerSpriteUrl ?? "/nav/battle-icon.png")
      : OBJECTIVE_ICON_SRC[state.id];

  const shell = state.claimable
    ? "rounded-lg bg-electric-yellow/[0.07]"
    : "";

  return (
    <li className={`px-0.5 py-2.5 transition ${shell}`}>
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
            state.done
              ? "bg-electric-yellow/20 text-electric-yellow"
              : isMain
                ? "bg-pokeball-red/20 text-pokeball-red"
                : "bg-white/8 text-white/55"
          }`}
          aria-hidden
        >
          {state.done ? (
            <span className="material-symbols-outlined text-[14px]! leading-none">check</span>
          ) : (
            step
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="relative hidden h-7 w-7 shrink-0 place-items-center sm:grid" aria-hidden>
              <Image
                src={iconSrc}
                alt=""
                width={28}
                height={28}
                className={`h-6 w-6 object-contain ${
                  state.id === "trainers" ? "[image-rendering:pixelated]" : ""
                } ${state.done && state.id === "trainers" ? "opacity-70 grayscale" : ""}`}
                unoptimized={state.id === "trainers"}
              />
            </span>
            <span
              className={`hidden rounded px-1.5 py-px text-[8px] font-bold uppercase tracking-wider sm:inline ${
                isMain
                  ? "bg-pokeball-red/18 text-pokeball-red"
                  : "bg-white/5 text-white/45"
              }`}
            >
              {roleLabel}
            </span>
            <p className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight text-white sm:text-[13px]">
              {label}
            </p>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/90 sm:text-[12px]">
              {state.current}
              <span className="text-white/40">/{state.target}</span>
            </span>
          </div>

          {!state.done ? (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10 sm:h-1.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  state.claimable || isMain ? "campaign-warm-bar" : "bg-white/35"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}

          {encounters && encounters.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {encounters.map((mon) => (
                <li
                  key={mon.speciesId}
                  title={mon.name}
                  className="relative flex h-9 w-9 items-center justify-center"
                >
                  <Image
                    src={mon.spriteUrl}
                    alt={mon.name}
                    width={36}
                    height={36}
                    className={`h-8 w-8 object-contain ${
                      mon.caught
                        ? ""
                        : mon.seen
                          ? "opacity-55 grayscale"
                          : "brightness-0 opacity-40"
                    }`}
                  />
                  {mon.caught ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 text-surface">
                      <span className="material-symbols-outlined text-[9px]! leading-none">
                        check
                      </span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <ObjectiveRewardBits state={state} compact />
            <ObjectiveClaimControl
              state={state}
              claimLabel={claimLabel}
              claimedLabel={claimedLabel}
              pending={pending}
              onClaim={onClaim}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function ObjectiveRewardBits({
  state,
  compact = false,
}: {
  state: ZoneObjectiveState;
  compact?: boolean;
}) {
  return (
    <div
      title={`${state.reward.quantity}× ${state.reward.itemName}`}
      className={`flex items-center gap-2 ${state.claimed ? "opacity-45" : ""} ${compact ? "sm:gap-2.5" : "gap-2.5"}`}
    >
      <span className="inline-flex items-center gap-0.5">
        <Image
          src={itemSpriteUrl(state.reward.itemName)}
          alt=""
          width={22}
          height={22}
          className={`object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] ${
            compact ? "h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" : "h-[22px] w-[22px]"
          }`}
        />
        <span
          className={`font-mono font-semibold tabular-nums text-white ${
            compact ? "text-[10px] sm:text-[11px]" : "text-[11px]"
          }`}
        >
          ×{state.reward.quantity}
        </span>
      </span>
      <span
        className={`inline-flex items-center gap-0.5 font-mono font-semibold tabular-nums text-electric-yellow ${
          compact ? "text-[10px] sm:text-[11px]" : "text-[11px]"
        }`}
      >
        <span className={`material-symbols-outlined ${compact ? "text-[14px]! sm:text-[16px]!" : "text-[16px]!"}`}>
          paid
        </span>
        {state.reward.coins}
      </span>
    </div>
  );
}

function ObjectiveClaimControl({
  state,
  claimLabel,
  claimedLabel,
  pending,
  onClaim,
}: {
  state: ZoneObjectiveState;
  claimLabel: string;
  claimedLabel: string;
  pending: boolean;
  onClaim: () => void;
}) {
  if (state.claimable) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={onClaim}
        className="shrink-0 rounded-md bg-electric-yellow px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1a1208] shadow-[0_4px_14px_color-mix(in_srgb,var(--color-electric-yellow)_28%,transparent)] transition hover:brightness-110 disabled:opacity-40 sm:px-2.5"
      >
        {claimLabel}
      </button>
    );
  }
  if (state.claimed) {
    return (
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90 sm:text-[10px]">
        {claimedLabel}
      </span>
    );
  }
  return null;
}

function JourneySummaryCard({
  summary,
  mapSrc,
}: {
  summary: JourneySummary;
  mapSrc: string;
}) {
  const t = useTranslations("campaign");
  // Solo se colorean las medallas y los shinies: lo escaso. El resto es neutro.
  const rows = [
    { iconSrc: "/nav/gym-icon.png", label: t("badges"), value: `${summary.badges}/${summary.badgesTotal}` },
    { iconSrc: "/nav/collection-icon.png", label: t("pokedexShort"), value: `${summary.speciesCaught}/${summary.speciesTotal}` },
    { iconSrc: "/nav/map-icon.png", label: t("zonesUnlocked"), value: `${summary.zonesUnlocked}/${summary.zonesTotal}` },
    { iconSrc: "/ranking/insignia-gold.png", label: t("shinies"), value: `${summary.shinies}` },
  ];

  return (
    <section className="game-float-card relative overflow-hidden rounded-2xl p-3">
      <div className="pointer-events-none absolute inset-0">
        <Image src={mapSrc} alt="" fill className="object-cover opacity-[0.08]" sizes="240px" />
        <div className="absolute inset-0 bg-linear-to-b from-[#12141c]/80 to-[#12141c]" />
      </div>
      <div className="relative">
        <p className={`mb-2 ${SECTION_LABEL}`}>{t("journeySummary")}</p>
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-label-sm">
              <Image
                src={r.iconSrc}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] shrink-0 object-contain"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-white/50">{r.label}</span>
              <span className="font-mono text-white">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
