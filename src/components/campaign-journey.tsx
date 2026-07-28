"use client";

import Image from "next/image";
import { useEffect, useState, useTransition, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { selectLocation, setFarmingStage } from "@/actions/campaign";
import { startTrainerBattle } from "@/actions/route-trainer";
import { claimZoneObjective } from "@/actions/zone-rewards";
import {
  evaluateObjectives,
  type ZoneObjectiveId,
  type ZoneObjectiveState,
} from "@/lib/campaign/objectives";
import { RARITY_ORDER, type Rarity } from "@/lib/campaign/rarity";
import { itemSpriteUrl } from "@/lib/item-sprites";
import {
  FootprintIcon,
  GymIcon,
  MapIcon,
  MasteryIcon,
  PokeballIcon,
  PokedexIcon,
  SparkleIcon,
  TrainerIcon,
  ZoneIcon,
  type ZoneIconKind,
  type ZoneIconProps,
} from "@/components/zone-icons";
import type { Chapter } from "@/lib/campaign/chapters";
import type { MapLocation } from "@/lib/campaign/map-selection";
import type { CampaignLocationKind } from "@/lib/campaign/types";
import { masteryBonuses, masteryProgressPercent } from "@/lib/mastery";
import {
  ZoneRewardPopup,
  type ZoneRewardClaim,
} from "@/components/zone-reward-popup";
import { announceCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import { NextMilestoneChip } from "@/components/next-milestone-chip";
import { HubHelpPanel, CoachMark } from "@/components/journey-guidance";
import { UnlockCelebration } from "@/components/unlock-celebration";
import type { CampaignMilestone } from "@/lib/campaign/types";
import { milestoneCtaKey, milestoneHref } from "@/lib/journey-ux";

/**
 * Paleta de la campaña — cuatro familias, cada una con un significado.
 *
 * Antes cada tipo de zona tenía su color (celeste, verde, lima, gris, dorado) y
 * cada rareza el suyo: nueve acentos compitiendo, ninguno significando nada. La
 * regla ahora es que el color solo aparece cuando informa:
 *
 * - Neutro (blancos)  → estructura y tipo de zona. La identidad la da el ícono.
 * - Rojo              → dónde estás y la acción principal.
 * - Dorado            → gimnasios, recompensas y rareza. El eje de "valor".
 * - Verde             → hecho: capturado, entrenador vencido, objetivo cumplido.
 */

/** Rareza sobre un solo tono: la jerarquía se lee por intensidad, no por color. */
const RARITY_STYLE: Record<Rarity, string> = {
  common: "border-white/10",
  uncommon: "border-white/25",
  rare: "border-tertiary/35",
  veryRare: "border-tertiary/60",
  elite: "border-electric-yellow shadow-[0_0_10px_rgba(242,192,0,0.35)]",
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
    text: "text-on-surface-variant",
    ring: "border-white/15 bg-white/[0.06]",
    glow: "rgba(255,255,255,0.18)",
  },
  route: {
    icon: "route",
    text: "text-on-surface-variant",
    ring: "border-white/15 bg-white/[0.06]",
    glow: "rgba(255,255,255,0.18)",
  },
  forest: {
    icon: "forest",
    text: "text-on-surface-variant",
    ring: "border-white/15 bg-white/[0.06]",
    glow: "rgba(255,255,255,0.18)",
  },
  dungeon: {
    icon: "dungeon",
    text: "text-on-surface-variant",
    ring: "border-white/15 bg-white/[0.06]",
    glow: "rgba(255,255,255,0.18)",
  },
  gym: {
    icon: "gym",
    text: "text-tertiary",
    ring: "border-tertiary/50 bg-tertiary/10",
    glow: "rgba(242,192,0,0.45)",
  },
};

/** Cada objetivo con su ícono: tres círculos idénticos no decían nada. */
const OBJECTIVE_ICON: Record<ZoneObjectiveId, (p: ZoneIconProps) => ReactElement> = {
  stages: FootprintIcon,
  pokedex: PokedexIcon,
  trainers: TrainerIcon,
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
  gymId: string;
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
}) {
  const t = useTranslations("campaign");
  const tUx = useTranslations("ux");
  const [chapterIndex, setChapterIndex] = useState(initialChapter);
  const [zoneId, setZoneId] = useState<string | null>(farmingLocationId);
  const [pending, startTransition] = useTransition();
  const [claimPopup, setClaimPopup] = useState<ZoneRewardClaim | null>(null);
  const [unlockToast, setUnlockToast] = useState<{ id: string; name: string } | null>(null);

  const chapter = chapters[chapterIndex] ?? chapters[0];
  const zone = chapter?.zones.find((z) => z.id === zoneId) ?? chapter?.zones[0] ?? null;
  const farmingZone =
    chapters.flatMap((c) => c.zones).find((z) => z.id === farmingLocationId) ?? null;
  const ctaHref = milestoneHref(milestone);
  const ctaKey = milestoneCtaKey(milestone);
  const helpBullets = (tUx.raw("help.campaign") as string[]) ?? [];

  function pickZone(id: string) {
    setZoneId(id);
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
        showToast(t("rewardClaimed"), "error");
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
      await startTrainerBattle(trainerId, locale);
    });
  }

  useEffect(() => {
    try {
      const key = "pokerpg:zones-unlocked-count";
      const prev = Number(window.sessionStorage.getItem(key) ?? "0");
      if (summary.zonesUnlocked > prev && prev > 0 && farmingZone) {
        setUnlockToast({ id: farmingZone.id, name: t(farmingZone.nameKey) });
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

      <HubHelpPanel storageKey="hub-help-campaign" bullets={helpBullets} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <NextMilestoneChip milestone={milestone} withCta className="w-full sm:w-auto" />
        <CoachMark storageKey="coach-explore" message={tUx("coachExplore")}>
          <Link
            href={ctaHref}
            className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-pokeball-red px-5 text-label-md font-bold text-white shadow-[0_8px_24px_rgba(238,21,21,0.35)] transition hover:bg-pokeball-red/90 sm:inline-flex"
          >
            <span className="material-symbols-outlined text-[18px]!">
              {milestone.kind === "gym" ? "military_tech" : "explore"}
            </span>
            {t(ctaKey)}
          </Link>
        </CoachMark>
      </div>

      <JourneyStrip
        chapters={chapters}
        activeIndex={chapterIndex}
        onPick={setChapterIndex}
        percent={summary.journeyPercent}
        label={t("journeyProgress")}
        chapterLabel={t("chapter")}
      />

      {chapter && (
        <div className="mt-4">
          <ChapterHero chapter={chapter} mapSrc={regionMapSrc} />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(280px,340px)]">
        <aside className="hidden flex-col gap-3 lg:flex">
          <nav className="glass-panel rounded-xl border border-white/10 p-2">
            {chapters.map((c, i) => {
              const active = i === chapterIndex;
              return (
                <button
                  key={c.number}
                  type="button"
                  onClick={() => setChapterIndex(i)}
                  disabled={!c.unlocked}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-label-sm transition ${
                    active
                      ? "bg-pokeball-red/15 text-white"
                      : c.unlocked
                        ? "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                        : "text-on-surface-variant/40"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]!">
                    {c.completed ? "task_alt" : c.unlocked ? "play_circle" : "lock"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {c.number}. {t(c.nameKey)}
                  </span>
                  {c.unlocked && (
                    <span className="font-mono text-[10px] text-on-surface-variant">
                      {c.percent}%
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <JourneySummaryCard summary={summary} mapSrc={regionMapSrc} />
        </aside>

        <div className="min-w-0">
          {chapter && (
            <ol className="relative flex flex-col gap-2">
              <span
                aria-hidden
                className="absolute left-[18px] top-6 bottom-6 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent"
              />
              {chapter.zones.map((z) => (
                <ZoneRow
                  key={z.id}
                  zone={z}
                  selected={zone?.id === z.id}
                  isFarming={z.id === farmingLocationId}
                  gymRequirement={gymRequirements[z.id]}
                  chapter={chapter}
                  teamMaxLevel={summary.teamMaxLevel}
                  onPick={() => pickZone(z.id)}
                />
              ))}
            </ol>
          )}
        </div>

        <div className="order-first lg:order-none lg:sticky lg:top-20 lg:self-start">
          {zone && (
            <ZonePanel
              zone={zone}
              isFarming={zone.id === farmingLocationId}
              farmingStageId={farmingStageId}
              pending={pending}
              gymRequirement={gymRequirements[zone.id]}
              onTravel={() => travelTo(zone.id)}
              onFarmStage={farmStage}
              onChallengeTrainer={challengeTrainer}
              onClaim={(objective) => claim(zone.id, objective)}
              exploreHref={ctaHref}
              exploreLabel={t(ctaKey)}
              showExploreCta={zone.id === farmingLocationId && milestone.kind !== "complete"}
            />
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-3 sm:hidden">
        <Link
          href={ctaHref}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-pokeball-red text-label-md font-bold text-white shadow-[0_12px_32px_rgba(238,21,21,0.45)]"
        >
          <span className="material-symbols-outlined text-[20px]!">
            {milestone.kind === "gym" ? "military_tech" : "explore"}
          </span>
          {t(ctaKey)}
        </Link>
      </div>
      <div className="h-16 sm:hidden" aria-hidden />
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
    <section className="glass-panel rounded-xl border border-white/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
          {label}
        </span>
        <span className="font-mono text-label-sm text-on-surface">{percent}%</span>
      </div>
      {/*
        Grilla, no scroll horizontal: los capítulos son números, entran los 9 en
        375px. Con `overflow-x-auto` mobile mostraba la barra de scroll debajo —
        se leía como una barra de progreso suelta — y cortaba el capítulo 5 al
        medio.
      */}
      <div
        className="grid gap-1 sm:gap-1.5"
        // Derivado de la cantidad de capítulos: otra región con otro número
        // sigue entrando en una fila sin tocar esto.
        style={{ gridTemplateColumns: `repeat(${chapters.length}, minmax(0, 1fr))` }}
      >
        {chapters.map((c, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={c.number}
              type="button"
              onClick={() => onPick(i)}
              disabled={!c.unlocked}
              title={`${chapterLabel} ${c.number}`}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition sm:px-2 ${
                active
                  ? "border-pokeball-red/50 bg-pokeball-red/10"
                  : c.unlocked
                    ? "border-white/10 bg-black/20 hover:bg-white/5"
                    : "border-white/5 bg-black/10 opacity-50"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
                  c.completed
                    ? "border-tertiary/60 bg-tertiary/20 text-tertiary"
                    : c.unlocked
                      ? "border-white/25 bg-white/5 text-white"
                      : "border-white/10 text-on-surface-variant/50"
                }`}
              >
                {c.completed ? "★" : c.number}
              </span>
              <span className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-pokeball-red transition-all duration-500"
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

function ChapterHero({ chapter, mapSrc }: { chapter: Chapter; mapSrc: string }) {
  const t = useTranslations("campaign");
  const gymStyle = KIND_STYLE.gym;

  return (
    <section className="glass-panel relative overflow-hidden rounded-xl border border-white/10">
      <div className="pointer-events-none absolute inset-0">
        <Image src={mapSrc} alt="" fill className="object-cover opacity-25" sizes="800px" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-pokeball-red">
            {t("chapter")} {chapter.number}
          </p>
          <h2 className="mt-0.5 text-headline-lg tracking-tight text-white">
            {t(chapter.nameKey)}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <FootprintIcon className="h-3.5 w-3.5" />
              {chapter.stagesDone}/{chapter.stagesTotal} {t("stagesShort")}
            </span>
            <span className="inline-flex items-center gap-1">
              <PokedexIcon className="h-3.5 w-3.5" />
              {chapter.speciesCaught}/{chapter.speciesTotal}
            </span>
            {chapter.gym && (
              <span className={`inline-flex items-center gap-1 ${gymStyle.text}`}>
                <GymIcon className="h-3.5 w-3.5" />
                {chapter.completed ? t("chapterDone") : t(chapter.gym.nameKey)}
              </span>
            )}
          </p>
        </div>

        <div className="w-full max-w-[220px]">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              {t("chapterProgress")}
            </span>
            <span className="font-mono text-label-sm text-white">{chapter.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                chapter.completed ? "bg-tertiary" : "bg-pokeball-red"
              }`}
              style={{ width: `${chapter.percent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ZoneRow({
  zone,
  selected,
  isFarming,
  gymRequirement,
  chapter,
  teamMaxLevel,
  onPick,
}: {
  zone: MapLocation;
  selected: boolean;
  isFarming: boolean;
  gymRequirement?: GymRequirement;
  chapter: Chapter;
  teamMaxLevel: number;
  onPick: () => void;
}) {
  const t = useTranslations("campaign");
  const kind = kindOf(zone);
  const style = KIND_STYLE[kind];
  const isGym = kind === "gym";
  const done = zone.totalStages > 0 && zone.completedStages >= zone.totalStages;
  const caught = zone.encounters.filter((e) => e.caught).length;
  const pct = zone.totalStages > 0 ? (zone.completedStages / zone.totalStages) * 100 : 0;

  const requirementsLeft = isGym
    ? [
        chapter.stagesDone < chapter.stagesTotal ? t("reqStages") : null,
        gymRequirement && teamMaxLevel < gymRequirement.recommendedLevel
          ? t("reqLevel", { level: gymRequirement.recommendedLevel })
          : null,
      ].filter(Boolean)
    : [];

  return (
    <li className="relative flex gap-3">
      <span
        className={`relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
          !zone.unlocked
            ? "border-white/15 bg-surface-container text-on-surface-variant/50"
            : isFarming
              ? "border-pokeball-red bg-pokeball-red/15 text-pokeball-red"
              : `${style.ring} ${style.text}`
        }`}
        style={
          isFarming || (zone.unlocked && isGym)
            ? { boxShadow: `0 0 16px ${isFarming ? "rgba(238,21,21,0.45)" : style.glow}` }
            : undefined
        }
      >
        {zone.unlocked ? (
          <ZoneIcon kind={style.icon} className="h-[19px] w-[19px]" />
        ) : (
          <span className="material-symbols-outlined text-[18px]!">lock</span>
        )}
      </span>

      <button
        type="button"
        onClick={onPick}
        className={`glass-panel min-w-0 flex-1 rounded-xl border p-3 text-left transition ${
          selected ? "border-white/25 bg-white/[0.04]" : "border-white/10 hover:bg-white/[0.03]"
        } ${!zone.unlocked ? "opacity-55" : ""} ${
          isFarming ? "ring-1 ring-pokeball-red/40" : ""
        } ${
          // El gimnasio cierra el capítulo: pesa el doble que una ruta.
          isGym ? "py-4" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`${isGym ? "text-headline-md" : "text-body-md font-semibold"} text-white`}>
            {t(zone.nameKey)}
          </h3>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.ring} ${style.text}`}
          >
            {t(zone.kindKey)}
          </span>
          {isFarming && (
            <span className="inline-flex items-center gap-1 rounded-full border border-pokeball-red/50 bg-pokeball-red/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pokeball-red shadow-[0_0_12px_rgba(238,21,21,0.35)]">
              <span className="material-symbols-outlined text-[12px]!">my_location</span>
              {t("farming")}
            </span>
          )}
          {done && !isGym && (
            <span className="material-symbols-outlined text-[16px]! text-emerald-400">
              task_alt
            </span>
          )}
        </div>

        {zone.unlocked && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
            {zone.totalStages > 0 && (
              <span className="inline-flex items-center gap-1">
                <FootprintIcon className="h-3.5 w-3.5" />
                {zone.completedStages}/{zone.totalStages}
              </span>
            )}
            {zone.encounters.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <PokedexIcon className="h-3.5 w-3.5" />
                {caught}/{zone.encounters.length}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <PokeballIcon className="h-3.5 w-3.5" />
              {t("wildLevels", { min: zone.levelMin, max: zone.levelMax })}
            </span>
          </div>
        )}

        {zone.unlocked && zone.totalStages > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              // Terminada se apaga a verde tenue: informa sin gritar. La barra
              // roja es la que tiene que llamar la atención, la que falta.
              className={`h-full rounded-full transition-all duration-500 ${
                done ? "bg-emerald-400/50" : "bg-pokeball-red"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {isGym && zone.unlocked && requirementsLeft.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5">
            {requirementsLeft.map((r) => (
              <li key={r} className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]! text-error">
                  radio_button_unchecked
                </span>
                {r}
              </li>
            ))}
          </ul>
        )}
      </button>
    </li>
  );
}

function ZonePanel({
  zone,
  isFarming,
  farmingStageId,
  pending,
  gymRequirement,
  onTravel,
  onFarmStage,
  onChallengeTrainer,
  onClaim,
  exploreHref,
  exploreLabel,
  showExploreCta,
}: {
  zone: MapLocation;
  isFarming: boolean;
  farmingStageId: string;
  pending: boolean;
  gymRequirement?: GymRequirement;
  onTravel: () => void;
  onFarmStage: (stageId: string) => void;
  onChallengeTrainer: (trainerId: string) => void;
  onClaim: (objective: ZoneObjectiveId) => void;
  exploreHref?: string;
  exploreLabel?: string;
  showExploreCta?: boolean;
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

  return (
    <section
      className={`glass-panel rounded-xl border p-4 ${
        isFarming ? "border-pokeball-red/50 shadow-[0_0_28px_rgba(238,21,21,0.18)]" : "border-white/10"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${style.ring} ${style.text}`}
        >
          <ZoneIcon kind={style.icon} className="h-[21px] w-[21px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-headline-md text-white">{t(zone.nameKey)}</h3>
            {isFarming && (
              <span className="inline-flex items-center gap-1 rounded-full border border-pokeball-red/50 bg-pokeball-red/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pokeball-red">
                <span className="material-symbols-outlined text-[12px]!">my_location</span>
                {tUx("youAreHere")}
              </span>
            )}
          </div>
          <p className="text-label-sm text-on-surface-variant">
            {t(zone.kindKey)}
            <span className="mx-1.5 text-on-surface-variant/40">•</span>
            {t("wildLevels", { min: zone.levelMin, max: zone.levelMax })}
            <span className="mx-1.5 text-on-surface-variant/40">•</span>
            {t(`encounterRate.${zone.encounterRate}`)}
          </p>
        </div>
      </div>

      {showExploreCta && exploreHref && exploreLabel && (
        <Link
          href={exploreHref}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-pokeball-red px-4 text-label-md font-bold text-white transition hover:bg-pokeball-red/90"
        >
          <span className="material-symbols-outlined text-[18px]!">explore</span>
          {exploreLabel}
        </Link>
      )}

      {zone.unlocked && zone.trainers.length > 0 && (
        <p className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-label-sm text-on-surface">
          <span className="font-bold text-white">
            {trainersDone}/{zone.trainers.length}
          </span>{" "}
          <span className="text-on-surface-variant">{t("obj_trainers")}</span>
        </p>
      )}

      {zone.unlocked && (
        <div className="mt-3 rounded-lg border border-tertiary/25 bg-tertiary/[0.06] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-label-sm text-tertiary">
              <MasteryIcon className="h-4 w-4" />
              {t("mastery")} Lv. {zone.masteryLevel}
            </span>
            <span className="font-mono text-[11px] text-on-surface-variant">
              {masteryProgressPercent(zone.masteryXp)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-tertiary transition-all duration-500"
              style={{ width: `${masteryProgressPercent(zone.masteryXp)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-on-surface-variant">
            {t("masteryBonuses", {
              xp: masteryBonuses(zone.masteryLevel).xp,
              capture: masteryBonuses(zone.masteryLevel).capture,
              coins: masteryBonuses(zone.masteryLevel).coins,
            })}
          </p>
        </div>
      )}

      {!zone.unlocked ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-label-sm text-on-surface-variant">
          {t("zoneLocked")}
        </p>
      ) : (
        <>
          {/* Objetivos: lo que responde "¿qué me falta acá?" */}
          <p className="mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {t("objectives")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {objectives.map((obj) => (
              <Objective
                key={obj.id}
                state={obj}
                label={t(`obj_${obj.id}`)}
                claimLabel={t("claim")}
                claimedLabel={t("claimed")}
                pending={pending}
                onClaim={() => onClaim(obj.id)}
              />
            ))}
            {isGym && (
              <li className="flex items-center gap-2 rounded-lg border border-tertiary/25 bg-tertiary/[0.06] px-2.5 py-1.5 text-label-sm">
                <GymIcon className="h-4 w-4 shrink-0 text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-on-surface-variant">
                  {t("objBadge")}
                </span>
                <span className="font-mono text-[11px] text-tertiary">
                  {gymRequirement ? `Lv. ${gymRequirement.recommendedLevel}` : ""}
                </span>
              </li>
            )}
          </ul>

          {/* Pokédex de la zona */}
          {zone.encounters.length > 0 && (
            <>
              <p className="mt-4 mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t("zoneWilds")}
                <span className="font-mono normal-case tracking-normal">
                  {caught}/{zone.encounters.length}
                  <span className="ml-1.5 text-on-surface-variant/60">
                    ({seenCount} {t("seenShort")})
                  </span>
                </span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {zone.encounters.map((mon) => (
                  <li
                    key={mon.speciesId}
                    title={mon.seen ? `${mon.name} · ${t(`rarity.${mon.rarity}`)}` : "???"}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-lg border bg-surface-container-high/50 ${
                      mon.seen ? RARITY_STYLE[mon.rarity] : "border-white/10"
                    }`}
                  >
                    {mon.seen ? (
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={40}
                        height={40}
                        className={`h-9 w-9 object-contain ${
                          mon.caught ? "" : "opacity-60 grayscale"
                        }`}
                      />
                    ) : (
                      // Sin descubrir: la silueta de la pokébola en vez de un
                      // signo de pregunta suelto, que se leía como un error.
                      <PokeballIcon className="h-6 w-6 text-on-surface-variant/25" />
                    )}
                    {mon.caught && (
                      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-surface">
                        <span className="material-symbols-outlined text-[10px]! leading-none">
                          check
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Entrenadores de la zona */}
          {zone.trainers.length > 0 && (
            <>
              <p className="mt-4 mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t("trainersTitle")}
                <span className="font-mono normal-case tracking-normal">
                  {zone.trainers.filter((tr) => tr.defeated).length}/{zone.trainers.length}
                </span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {zone.trainers.map((tr) => (
                  <li
                    key={tr.id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                      tr.defeated
                        ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                        : "border-white/10 bg-black/20"
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
                    <span className="min-w-0 flex-1 truncate text-label-sm text-on-surface">
                      {t(tr.nameKey)}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
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
                        className="shrink-0 rounded-md bg-pokeball-red px-2 py-1 text-[10px] font-bold uppercase text-white transition hover:bg-pokeball-red/85 disabled:opacity-40"
                      >
                        {t("trainerFight")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Acciones */}
          <div className="mt-4 flex flex-col gap-2">
            {isGym ? (
              <Link
                href={gymRequirement ? `/gyms/${gymRequirement.gymId}` : "/gyms"}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-tertiary px-4 py-2.5 text-label-md font-semibold text-surface transition hover:bg-tertiary/85"
              >
                <span className="material-symbols-outlined text-[18px]!">military_tech</span>
                {t("challengeGym")}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending || isFarming}
                  onClick={onTravel}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-pokeball-red px-4 py-2.5 text-label-md font-semibold text-white transition hover:bg-pokeball-red/85 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]!">my_location</span>
                  {isFarming ? t("youAreHere") : t("moveHere")}
                </button>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {t("pickStage")}
                </p>
                <ul className="flex flex-col gap-1">
                  {zone.stages.map((stage) => {
                    const current = stage.id === farmingStageId;
                    return (
                      <li key={stage.id}>
                        <button
                          type="button"
                          disabled={pending || !stage.unlocked || stage.isGym}
                          onClick={() => onFarmStage(stage.id)}
                          className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-label-sm transition ${
                            current
                              ? "border-pokeball-red/40 bg-pokeball-red/10 text-white"
                              : stage.unlocked && !stage.isGym
                                ? "border-white/10 bg-black/20 text-on-surface hover:bg-white/5"
                                : "border-white/5 bg-black/10 text-on-surface-variant/50"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]!">
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
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Rareza más alta de la zona — sin depender de que la hayas visto. */
function topRarityOf(encounters: { rarity: Rarity }[]): Rarity {
  return encounters.reduce<Rarity>(
    (best, e) => (RARITY_ORDER[e.rarity] > RARITY_ORDER[best] ? e.rarity : best),
    "common",
  );
}

/** Mismo criterio que `RARITY_STYLE`: un solo tono, subiendo de intensidad. */
function rarityText(rarity: Rarity): string {
  return {
    common: "text-on-surface-variant",
    uncommon: "text-on-surface",
    rare: "text-tertiary/70",
    veryRare: "text-tertiary",
    elite: "text-electric-yellow",
  }[rarity];
}

function Objective({
  state,
  label,
  claimLabel,
  claimedLabel,
  pending,
  onClaim,
}: {
  state: ZoneObjectiveState;
  label: string;
  claimLabel: string;
  claimedLabel: string;
  pending: boolean;
  onClaim: () => void;
}) {
  const Icon = OBJECTIVE_ICON[state.id];
  const pct = state.target > 0 ? Math.min(100, (state.current / state.target) * 100) : 0;

  return (
    <li
      className={`rounded-lg border px-2.5 py-2 text-label-sm transition ${
        state.claimable
          ? "border-tertiary/50 bg-tertiary/10 text-on-surface"
          : state.done
            ? "border-emerald-400/30 bg-emerald-400/[0.07] text-on-surface"
            : "border-white/10 bg-black/20 text-on-surface-variant"
      }`}
    >
      {/*
        Dos líneas, no una: en la columna de 320px el objetivo entraba truncado
        ("Completar la P…") y el texto es justamente lo que hay que leer.
      */}
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-px h-4 w-4 shrink-0 ${
            state.done ? "text-emerald-400" : "text-on-surface-variant/70"
          }`}
        />
        <span className="min-w-0 flex-1 leading-snug">{label}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums">
          {state.current}/{state.target}
        </span>
      </div>

      {!state.done && (
        <div className="ml-6 mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/35 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="ml-6 mt-1.5 flex items-center justify-between gap-2">
        {/* La recompensa es el gancho: el objeto se ve y la moneda va en el
            mismo dorado que el contador del header. */}
        <span
          title={`${state.reward.quantity}× ${state.reward.itemName}`}
          className={`inline-flex items-center gap-1.5 text-[11px] ${
            state.claimed ? "opacity-40" : ""
          }`}
        >
          <span className="inline-flex items-center gap-0.5 text-on-surface-variant">
            <Image
              src={itemSpriteUrl(state.reward.itemName)}
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
            />
            ×{state.reward.quantity}
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono text-electric-yellow">
            <span className="material-symbols-outlined text-[14px]!">paid</span>
            {state.reward.coins}
          </span>
        </span>

        {state.claimable ? (
          <button
            type="button"
            disabled={pending}
            onClick={onClaim}
            // Relleno sólido: es lo único con fondo lleno del panel, no necesita
            // un color propio para pedir el click.
            className="shrink-0 rounded-md bg-tertiary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-surface transition hover:bg-tertiary/85 disabled:opacity-40"
          >
            {claimLabel}
          </button>
        ) : state.claimed ? (
          <span className="shrink-0 text-[10px] uppercase text-on-surface-variant/50">
            {claimedLabel}
          </span>
        ) : null}
      </div>
    </li>
  );
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
    { Icon: GymIcon, tone: "text-tertiary", label: t("badges"), value: `${summary.badges}/${summary.badgesTotal}` },
    { Icon: PokedexIcon, tone: "text-on-surface-variant", label: t("pokedexShort"), value: `${summary.speciesCaught}/${summary.speciesTotal}` },
    { Icon: MapIcon, tone: "text-on-surface-variant", label: t("zonesUnlocked"), value: `${summary.zonesUnlocked}/${summary.zonesTotal}` },
    { Icon: SparkleIcon, tone: "text-electric-yellow", label: t("shinies"), value: `${summary.shinies}` },
  ];

  return (
    <section className="glass-panel relative overflow-hidden rounded-xl border border-white/10 p-3">
      <div className="pointer-events-none absolute inset-0">
        <Image src={mapSrc} alt="" fill className="object-cover opacity-[0.12]" sizes="240px" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black/90" />
      </div>
      <div className="relative">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          {t("journeySummary")}
        </p>
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-label-sm">
              <r.Icon className={`h-4 w-4 shrink-0 ${r.tone}`} />
              <span className="min-w-0 flex-1 truncate text-on-surface-variant">{r.label}</span>
              <span className="font-mono text-on-surface">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
