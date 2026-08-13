"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { openDailyRewardModal } from "@/lib/daily-gift-fx";
import { ProgressRing, SegmentedBar } from "@/components/events/quest-parts";
import { playCenterHealFx } from "@/components/heal-button";
import { healTeam } from "@/actions/heal-team";
import { playUiSfx } from "@/lib/battle-sfx";
import { announceCoinDelta } from "@/lib/coin-fx";
import { HomeObjectivesRail } from "@/components/home/home-objectives-rail";
import {
  RouteTrainersSheet,
  type RouteTrainerRow,
} from "@/components/adventure/route-trainers-sheet";
import { announceHomeTeamHealed } from "@/lib/home-heal-fx";
import {
  HEAL_COOLDOWN_MINUTES,
  HEAL_RUSH_BASE_COST,
  isPokemonCenterFree,
} from "@/lib/healing";
import type { HomeDailyAction, HomeObjective } from "@/lib/home-hub";

function objectivesWithClaimedOverrides(
  objectives: HomeObjective[],
  claimedIds: ReadonlySet<string>,
): HomeObjective[] {
  if (claimedIds.size === 0) return objectives;
  return objectives.map((o) =>
    claimedIds.has(o.id) ? { ...o, claimed: true, claimable: false } : o,
  );
}

export type HomeDailyActionLabels = {
  title: string;
  items: Record<string, string>;
  statusReady: string;
  statusHealthy: string;
  statusHealthyCooldown: string;
  statusRush: string;
};

type HealLive = {
  needsHealing: boolean;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
  teamMaxLevel: number;
};

function formatHealTimer(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function healChip(
  live: HealLive,
  labels: HomeDailyActionLabels,
): { text: string; hot: boolean; rush: boolean } {
  const noviceFree = isPokemonCenterFree(live.teamMaxLevel);
  const onCooldown = !noviceFree && live.cooldownMsLeft > 0;
  if (live.needsHealing) {
    if (!onCooldown) {
      return { text: labels.statusReady, hot: true, rush: false };
    }
    const canPay = live.coins >= live.rushCost;
    return {
      text: labels.statusRush.replace("{cost}", String(live.rushCost)),
      hot: canPay,
      rush: true,
    };
  }
  if (onCooldown) {
    return {
      text: labels.statusHealthyCooldown.replace(
        "{time}",
        formatHealTimer(live.cooldownMsLeft),
      ),
      hot: false,
      rush: false,
    };
  }
  return { text: labels.statusHealthy, hot: false, rush: false };
}

const ACCENT: Record<string, string> = {
  daily: "var(--color-pokeball-red)",
  pvp: "var(--color-electric-yellow)",
  gyms: "var(--theme-primary-bright)",
  heal: "var(--color-pokeball-red)",
  streak: "var(--color-pokeball-red)",
  friends: "var(--color-water-blue)",
  market: "var(--color-gem)",
  clans: "var(--color-water-blue)",
  pokedex: "var(--color-electric-yellow)",
};

function SectionLabel({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string | null;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-px truncate text-[12px] font-semibold leading-tight text-white/70">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          prefetch={false}
          className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:text-white/75"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Acciones diarias: 4 tiles en un mismo panel (junto al Active Team).
 * El Centro Pokémon lleva timer live + rush, y cura el squad al instante.
 */
export function HomeDailyActions({
  actions,
  labels,
}: {
  actions: HomeDailyAction[];
  labels: HomeDailyActionLabels;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [healPending, startHeal] = useTransition();
  const [healError, setHealError] = useState(false);

  const serverHeal = actions.find((a) => a.heal)?.heal ?? null;
  const healSyncKey = serverHeal
    ? [
        serverHeal.needsHealing ? 1 : 0,
        serverHeal.cooldownMsLeft,
        serverHeal.rushCost,
        serverHeal.coins,
        serverHeal.teamMaxLevel,
      ].join(":")
    : "";

  /** Override de estado del Centro tras curar (antes del refresh). */
  const [healOverride, setHealOverride] = useState<{
    needsHealing: boolean;
    rushCost: number;
    coins: number;
    teamMaxLevel: number;
  } | null>(null);
  const [cooldownLeftMs, setCooldownLeftMs] = useState(
    serverHeal?.cooldownMsLeft ?? 0,
  );
  const [lastHealKey, setLastHealKey] = useState(healSyncKey);
  if (lastHealKey !== healSyncKey) {
    setLastHealKey(healSyncKey);
    setHealOverride(null);
    setCooldownLeftMs(serverHeal?.cooldownMsLeft ?? 0);
  }

  const healTimerArmed = cooldownLeftMs > 0;
  useEffect(() => {
    if (!healTimerArmed) return;
    const id = window.setInterval(() => {
      setCooldownLeftMs((prev) => Math.max(0, prev - 250));
    }, 250);
    return () => window.clearInterval(id);
  }, [healTimerArmed]);

  const healLive: HealLive | null = (() => {
    if (!serverHeal && !healOverride) return null;
    return {
      needsHealing: healOverride?.needsHealing ?? serverHeal!.needsHealing,
      rushCost: healOverride?.rushCost ?? serverHeal!.rushCost,
      coins: healOverride?.coins ?? serverHeal!.coins,
      teamMaxLevel: healOverride?.teamMaxLevel ?? serverHeal!.teamMaxLevel,
      cooldownMsLeft: cooldownLeftMs,
    };
  })();

  function runHeal(live: HealLive) {
    if (healPending || !live.needsHealing) return;

    const noviceFree = isPokemonCenterFree(live.teamMaxLevel);
    const onCooldown = !noviceFree && live.cooldownMsLeft > 0;
    const rush = onCooldown;
    if (rush && live.coins < live.rushCost) return;

    const paid = rush ? live.rushCost : 0;
    const snapshot = {
      needsHealing: live.needsHealing,
      rushCost: live.rushCost,
      coins: live.coins,
      teamMaxLevel: live.teamMaxLevel,
    };
    const snapshotCd = live.cooldownMsLeft;
    setHealError(false);
    playUiSfx("heal");
    playCenterHealFx();
    // Squad al instante — no esperar al router.refresh().
    announceHomeTeamHealed();
    setHealOverride({
      needsHealing: false,
      coins: live.coins - paid,
      rushCost: HEAL_RUSH_BASE_COST,
      teamMaxLevel: live.teamMaxLevel,
    });
    setCooldownLeftMs(noviceFree ? 0 : HEAL_COOLDOWN_MINUTES * 60_000);

    startHeal(async () => {
      const result = await healTeam(locale, rush);
      if (!result.ok) {
        setHealError(true);
        setHealOverride(snapshot);
        setCooldownLeftMs(snapshotCd);
        router.refresh();
        return;
      }
      if (rush) announceCoinDelta(-paid);
      router.refresh();
    });
  }

  return (
    <section className="home-ops-deck__actions min-w-0" aria-label={labels.title}>
      <div className="hidden sm:block">
        <SectionLabel title={labels.title} />
      </div>
      <div className="home-ops-deck__grid grid grid-cols-4 gap-1 px-0.5 pt-1.5 pb-0.5 sm:gap-1.5 sm:px-0 sm:py-0">
        {actions.map((action) => {
          const accent = ACCENT[action.id] ?? "var(--color-electric-yellow)";
          const label = labels.items[action.labelKey] ?? action.labelKey;
          const isHealTile = Boolean(action.heal && healLive);
          const chip = isHealTile
            ? healChip(healLive!, labels)
            : {
                text: action.status,
                hot: Boolean(action.hot),
                rush: false,
              };
          const statusText = chip.text;
          const tileHot = chip.hot;

          const noviceFree = isHealTile
            ? isPokemonCenterFree(healLive!.teamMaxLevel)
            : false;
          const onCooldown =
            isHealTile && !noviceFree && healLive!.cooldownMsLeft > 0;
          const canRush = Boolean(
            isHealTile &&
              healLive!.needsHealing &&
              onCooldown &&
              healLive!.coins >= healLive!.rushCost,
          );
          const healDisabled = Boolean(
            isHealTile &&
              (!healLive!.needsHealing || (onCooldown && !canRush)),
          );
          const healBusy = Boolean(isHealTile && healPending);

          const className = [
            "home-daily-tile group relative flex aspect-square w-full flex-col items-center justify-center overflow-visible rounded-xl text-center transition sm:aspect-auto sm:flex-row sm:items-center sm:justify-start sm:gap-2.5 sm:overflow-hidden sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-left",
            "active:scale-[0.96]",
            tileHot ? "home-daily-tile--hot" : "",
            healBusy || healDisabled ? "opacity-70" : "",
          ].join(" ");
          const style = { "--daily-accent": accent } as CSSProperties;

          const chipTone = tileHot
            ? "home-daily-tile__badge--hot"
            : "home-daily-tile__badge--idle";

          const chipInner = statusText ? (
            <span className="inline-flex max-w-full items-center gap-0.5 truncate">
              {chip.rush ? (
                <span
                  className="material-symbols-outlined text-[11px]! leading-none opacity-90 sm:text-[12px]!"
                  aria-hidden
                >
                  paid
                </span>
              ) : null}
              {statusText}
            </span>
          ) : null;

          const statusChipDesktop = chipInner ? (
            <span
              className={`home-daily-tile__badge max-w-full font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em] tabular-nums ${chipTone}`}
            >
              <span className="home-daily-tile__status-dot shrink-0" aria-hidden />
              {chipInner}
            </span>
          ) : null;

          const statusChipMobile = chipInner ? (
            <span
              className={`home-daily-tile__badge max-w-[110%] font-mono text-[9px] font-bold uppercase leading-none tracking-wide tabular-nums ${chipTone}`}
            >
              <span className="home-daily-tile__status-dot shrink-0" aria-hidden />
              {chipInner}
            </span>
          ) : null;

          const inner = (
            <>
              <span
                aria-hidden
                className="home-daily-tile__glow pointer-events-none absolute inset-0 rounded-[inherit]"
              />

              {statusChipMobile ? (
                <span className="absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-1/2 sm:hidden">
                  {statusChipMobile}
                </span>
              ) : null}

              <span className="idle-reward__chest relative z-[1] flex h-[78%] w-[78%] max-h-11 max-w-11 items-center justify-center sm:h-11 sm:w-11 sm:max-h-none sm:max-w-none sm:shrink-0">
                <Image
                  src={action.iconSrc}
                  alt=""
                  width={56}
                  height={56}
                  draggable={false}
                  className="home-daily-tile__icon h-[86%] w-[86%] object-contain drop-shadow-[0_5px_9px_rgba(0,0,0,0.6)] transition duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_color-mix(in_srgb,var(--daily-accent)_55%,transparent)]"
                  unoptimized
                />
              </span>

              <span className="relative z-[1] hidden min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex">
                <span
                  className={`max-w-full truncate text-[11px] font-bold uppercase tracking-[0.1em] transition-colors group-hover:text-white ${
                    tileHot ? "text-white" : "text-white/78"
                  }`}
                >
                  {label}
                </span>
                {statusChipDesktop}
              </span>
            </>
          );

          if (action.openDailyGift) {
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => openDailyRewardModal()}
                className={className}
                style={style}
                aria-label={
                  statusText ? `${label}. ${statusText}` : label
                }
                title={label}
              >
                {inner}
              </button>
            );
          }

          if (action.heal && healLive) {
            const titleHint = healError
              ? label
              : !healLive.needsHealing
                ? onCooldown
                  ? `${label} · ${formatHealTimer(healLive.cooldownMsLeft)}`
                  : label
                : onCooldown
                  ? `${label} · ${healLive.rushCost}`
                  : label;
            return (
              <button
                key={action.id}
                type="button"
                disabled={healBusy || healDisabled}
                onClick={() => runHeal(healLive)}
                className={className}
                style={style}
                aria-label={
                  statusText ? `${label}. ${statusText}` : label
                }
                title={titleHint}
              >
                {inner}
              </button>
            );
          }

          if (action.href) {
            return (
              <Link
                key={action.id}
                href={action.href}
                prefetch={false}
                className={className}
                style={style}
                aria-label={
                  statusText ? `${label}. ${statusText}` : label
                }
                title={label}
              >
                {inner}
              </Link>
            );
          }

          return (
            <div
              key={action.id}
              className={className}
              style={style}
              aria-label={label}
              title={label}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** @deprecated Preferí HomeDailyActions. */
export const HomeQuickAccess = HomeDailyActions;

type EventsTab = "adventure" | "weekly" | "event";

/**
 * Un knob del theme por pestaña. El color deja de ser decoración y pasa a
 * informar en qué dominio estás parado: violeta = aventura, fucsia = semanal,
 * azul = evento limitado.
 */
const TAB_ACCENT: Record<EventsTab, string> = {
  adventure: "var(--theme-secondary)",
  weekly: "var(--theme-primary)",
  event: "var(--theme-tertiary)",
};

export type HomeEventsAdventure = {
  zoneId: string | null;
  zoneName: string | null;
  objectives: HomeObjective[];
  trainers: Array<{
    id: string;
    nameKey: string;
    spriteUrl: string;
    level: number;
    defeated: boolean;
  }>;
};

export type HomeEventsWeekly = {
  percent: number;
  objectives: Array<{
    id: string;
    current: number;
    target: number;
    href: string | null;
  }>;
  claimableMilestones: number;
};

export type HomeEventsLimited = {
  name: string;
  missions: Array<{
    id: string;
    current: number;
    target: number;
    claimed: boolean;
    claimable: boolean;
    href: string | null;
  }>;
};

/**
 * Hub de misiones en home: aventura de zona + semanal + evento limitado.
 * Misma card con pestañas que el viejo progreso de zona, pero con info accionable.
 */
export function HomeEventsProgress({
  adventure,
  weekly,
  limited,
  labels,
}: {
  adventure: HomeEventsAdventure;
  weekly: HomeEventsWeekly;
  limited: HomeEventsLimited;
  labels: {
    progressTitle: string;
    /** "Objetivos de zona" — título del carrusel mobile. */
    objectivesTitle: string;
    /** "Recompensas" — título del bloque de recompensa final. */
    rewardsTitle: string;
    emptyAdventure: string;
    emptyWeekly: string;
    emptyEvent: string;
    claimable: string;
    claimAction: string;
    fightAction: string;
    claimed: string;
    openCampaign: string;
    openEvents: string;
    tabAdventure: string;
    tabWeekly: string;
    tabEvent: string;
    weeklyReady: string;
    objectiveLabels: Record<string, string>;
    weeklyLabels: Record<string, string>;
    missionLabels: Record<string, string>;
    rewardCoins: string;
  };
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [claimedIds, setClaimedIds] = useState<Set<string>>(() => new Set());
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [tab, setTab] = useState<EventsTab>(() =>
    adventure.objectives.some((o) => o.claimable)
      ? "adventure"
      : adventure.objectives.length > 0
        ? "adventure"
        : "weekly",
  );

  /**
   * Cobra y devuelve la recompensa, para que el carrusel mobile pueda
   * mostrarla en el centro antes de que el vuelo la lleve al header.
   */
  async function claimObjectiveAsync(
    objectiveId: string,
    origin?: { x: number; y: number },
  ): Promise<{ src: string; label: string } | null> {
    if (!adventure.zoneId || pending || claimedIds.has(objectiveId)) return null;

    // Cobrado al instante en mobile; si el server falla, revertimos.
    setClaimedIds((prev) => new Set(prev).add(objectiveId));

    const { claimZoneObjective } = await import("@/actions/zone-rewards");
    const { playLootCollectFx, rewardToLootPiece } = await import("@/lib/loot-fly-fx");
    const { itemDisplayUrl } = await import("@/lib/item-sprites");
    const result = await claimZoneObjective(locale, adventure.zoneId!, objectiveId);
    if (!result.ok) {
      setClaimedIds((prev) => {
        const next = new Set(prev);
        next.delete(objectiveId);
        return next;
      });
      return null;
    }
    playLootCollectFx({
      origin,
      coinsDelta: result.coins,
      pieces: [
        ...(result.coins > 0
          ? [rewardToLootPiece({ kind: "coins", amount: result.coins })]
          : []),
        rewardToLootPiece({
          kind: "item",
          itemName: result.itemName,
          quantity: result.quantity,
        }),
      ],
    });
    router.refresh();
    return {
      src: itemDisplayUrl(result.itemName, "hd"),
      label: `${result.itemName} ×${result.quantity}`,
    };
  }

  function claimObjective(objectiveId: string, origin?: { x: number; y: number }) {
    if (!adventure.zoneId || pending || claimedIds.has(objectiveId)) return;
    setClaimedIds((prev) => new Set(prev).add(objectiveId));
    startTransition(async () => {
      const { claimZoneObjective } = await import("@/actions/zone-rewards");
      const { playLootCollectFx, rewardToLootPiece } = await import("@/lib/loot-fly-fx");
      const result = await claimZoneObjective(locale, adventure.zoneId!, objectiveId);
      if (!result.ok) {
        setClaimedIds((prev) => {
          const next = new Set(prev);
          next.delete(objectiveId);
          return next;
        });
        return;
      }
      playLootCollectFx({
        origin,
        coinsDelta: result.coins,
        pieces: [
          ...(result.coins > 0
            ? [rewardToLootPiece({ kind: "coins", amount: result.coins })]
            : []),
          rewardToLootPiece({
            kind: "item",
            itemName: result.itemName,
            quantity: result.quantity,
          }),
        ],
      });
      router.refresh();
    });
  }

  const adventureObjectives = useMemo(
    () => objectivesWithClaimedOverrides(adventure.objectives, claimedIds),
    [adventure.objectives, claimedIds],
  );

  const adventureDone = adventureObjectives.filter((o) => o.done || o.claimed).length;
  const adventurePct =
    adventure.objectives.length === 0
      ? 0
      : Math.round((adventureDone / adventure.objectives.length) * 100);

  const limitedDone = limited.missions.filter(
    (m) => m.claimed || m.current >= m.target,
  ).length;
  const limitedPct =
    limited.missions.length === 0
      ? 0
      : Math.round((limitedDone / limited.missions.length) * 100);

  const tabs: { id: EventsTab; label: string; hot?: boolean }[] = [
    {
      id: "adventure",
      label: labels.tabAdventure,
      hot: adventureObjectives.some((o) => o.claimable),
    },
    {
      id: "weekly",
      label: labels.tabWeekly,
      hot: weekly.claimableMilestones > 0,
    },
    {
      id: "event",
      label: labels.tabEvent,
      hot: limited.missions.some((m) => m.claimable),
    },
  ];

  const footer =
    tab === "adventure"
      ? {
          pct: adventurePct,
          left: `${adventurePct}%`,
          right: `${adventureDone}/${adventure.objectives.length}`,
          href: "/campaign" as const,
          cta: labels.openCampaign,
          icon: "map",
        }
      : tab === "weekly"
        ? {
            pct: weekly.percent,
            left: `${weekly.percent}%`,
            right:
              weekly.claimableMilestones > 0
                ? labels.weeklyReady.replace(
                    "{count}",
                    String(weekly.claimableMilestones),
                  )
                : `${weekly.objectives.filter((o) => o.current >= o.target).length}/${weekly.objectives.length}`,
            href: "/events" as const,
            cta: labels.openEvents,
            icon: "event",
          }
        : {
            pct: limitedPct,
            left: `${limitedPct}%`,
            right: `${limitedDone}/${limited.missions.length}`,
            href: "/events" as const,
            cta: labels.openEvents,
            icon: "event",
          };

  const subtitle =
    tab === "adventure"
      ? adventure.zoneName
      : tab === "event"
        ? limited.name
        : null;

  // ¿La pestaña abierta tiene algo para reclamar? El ícono de la cinta hace bob
  // cuando sí: es la señal de "hay premio esperando" que el panel no daba —
  // había que abrir la lista para enterarse.
  const tabHasClaimable = tabs.find((it) => it.id === tab)?.hot === true;

  return (
    <section className="min-w-0">
      {/* Mobile: carrusel de anillos con la recompensa de ruta. La card con
          pestañas sigue de lg para arriba, donde además hay semanales y
          evento limitado. */}
      <HomeObjectivesRail
        objectives={adventureObjectives}
        title={labels.objectivesTitle}
        claimLabel={labels.claimAction}
        claimedLabel={labels.claimed}
        fightLabel={labels.fightAction}
        objectiveLabels={labels.objectiveLabels}
        progressLabel="{current}/{target}"
        rewardCoinsLabel={labels.rewardCoins}
        onClaim={claimObjectiveAsync}
        onOpenTrainers={
          adventure.trainers.some((tr) => !tr.defeated)
            ? () => {
                playUiSfx("badge");
                setTrainersOpen(true);
              }
            : undefined
        }
      />
      <RouteTrainersSheet
        open={trainersOpen}
        onClose={() => setTrainersOpen(false)}
        locale={locale}
        zoneName={adventure.zoneName}
        trainers={adventure.trainers as RouteTrainerRow[]}
      />

      {/* `ev-quest--desktop` y no `hidden lg:block`: `.ev-quest` declara
          `display:flex` más abajo en la hoja y con la misma especificidad le
          gana a la utilidad, así que el panel se colaba en mobile. */}
      <div
        className="ev-quest ev-quest--desktop"
        style={{ ["--ev-accent" as string]: TAB_ACCENT[tab] }}
      >
        <div className="ev-ribbon">
          <span
            aria-hidden
            className={`ev-ribbon__icon${tabHasClaimable ? " home-reward-bob" : ""}`}
          >
            <Image
              src="/nav/adventure-icon.png"
              alt=""
              width={72}
              height={72}
              draggable={false}
              className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              unoptimized
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="ev-ribbon__eyebrow">{labels.progressTitle}</span>
            <span className="ev-ribbon__title truncate">
              {subtitle ?? labels.tabAdventure}
            </span>
          </span>
          <Link href={footer.href} className="ev-ribbon__timer shrink-0">
            {footer.cta}
          </Link>
        </div>

        {/* Contenedor propio: `.ev-quest__list` es un flex con wrap pensado para
            hijos `.ev-quest__card`, y meterle las pestañas las dejaba al costado
            del contenido en vez de arriba. */}
        <div className="home-quest-panel">
        <div
          role="tablist"
          className="home-quest-tabs"
          aria-label={labels.progressTitle}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`home-quest-tab${tab === t.id ? " is-active" : ""}`}
            >
              {t.label}
              {t.hot ? <span aria-hidden className="home-quest-tab__dot" /> : null}
            </button>
          ))}
        </div>

        <div>
          {tab === "adventure" ? (
            adventure.objectives.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-white/45">
                {labels.emptyAdventure}
              </p>
            ) : (
              <ul className="home-quest-rows">
                {adventureObjectives.map((obj) => {
                  const complete = obj.done || obj.claimed;
                  const claimable = obj.claimable;
                  const pct =
                    obj.target > 0
                      ? Math.min(100, Math.round((obj.current / obj.target) * 100))
                      : 0;
                  return (
                    <li
                      key={obj.id}
                      className={`ev-quest__card${claimable ? " is-ready" : ""}${
                        complete && !claimable ? " is-done" : ""
                      }`}
                    >
                      <div className="ev-quest__body">
                        <div className="ev-quest__main">
                          <SegmentedBar pct={complete ? 100 : pct} />
                          <p className="ev-quest__text truncate">
                            {labels.objectiveLabels[obj.id] ?? obj.labelKey}
                          </p>
                          {claimable && adventure.zoneId ? (
                            <button
                              type="button"
                              disabled={pending}
                              className="home-quest-ready home-reward-shine"
                              onClick={(e) =>
                                claimObjective(obj.id, {
                                  x: e.clientX,
                                  y: e.clientY,
                                })
                              }
                            >
                              {labels.claimAction}
                            </button>
                          ) : claimable ? (
                            <span className="home-quest-ready home-reward-shine">
                              {labels.claimable}
                            </span>
                          ) : null}
                        </div>
                        <ProgressRing
                          current={Math.min(obj.current, obj.target)}
                          target={obj.target}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {tab === "weekly" ? (
            weekly.objectives.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-white/45">
                {labels.emptyWeekly}
              </p>
            ) : (
              <ul className="home-quest-rows">
                {weekly.objectives.map((obj) => {
                  const complete = obj.current >= obj.target;
                  const pct =
                    obj.target > 0
                      ? Math.min(100, Math.round((obj.current / obj.target) * 100))
                      : 0;
                  return (
                    <li
                      key={obj.id}
                      className={`ev-quest__card${complete ? " is-done" : ""}`}
                    >
                      <div className="ev-quest__body">
                        <div className="ev-quest__main">
                          <SegmentedBar pct={complete ? 100 : pct} />
                          <p className="ev-quest__text truncate">
                            {labels.weeklyLabels[obj.id] ?? obj.id}
                          </p>
                        </div>
                        <ProgressRing
                          current={Math.min(obj.current, obj.target)}
                          target={obj.target}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {tab === "event" ? (
            limited.missions.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-white/45">
                {labels.emptyEvent}
              </p>
            ) : (
              <ul className="home-quest-rows">
                {limited.missions.map((mission) => {
                  const complete =
                    mission.claimed || mission.current >= mission.target;
                  const pct =
                    mission.target > 0
                      ? Math.min(
                          100,
                          Math.round((mission.current / mission.target) * 100),
                        )
                      : 0;
                  return (
                    <li
                      key={mission.id}
                      className={`ev-quest__card${mission.claimable ? " is-ready" : ""}${
                        mission.claimed ? " is-done" : ""
                      }`}
                    >
                      <div className="ev-quest__body">
                        <div className="ev-quest__main">
                          <SegmentedBar pct={complete ? 100 : pct} />
                          <p className="ev-quest__text truncate">
                            {labels.missionLabels[mission.id] ?? mission.id}
                          </p>
                          {mission.claimable ? (
                            <span className="home-quest-ready home-reward-shine">
                              {labels.claimable}
                            </span>
                          ) : null}
                        </div>
                        <ProgressRing
                          current={Math.min(mission.current, mission.target)}
                          target={mission.target}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {/* Resumen al pie. El CTA vive sólo en la cinta: antes estaba también
              acá abajo como botón grande y era el mismo destino dos veces. */}
          <div className="home-quest-foot">
            <span>{footer.left}</span>
            <span className="home-quest-foot__count">{footer.right}</span>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

/** @deprecated Preferí HomeEventsProgress. */
export const HomeZoneProgress = HomeEventsProgress;
/** @deprecated Preferí HomeEventsProgress. */
export const HomeMissionsCarousel = HomeEventsProgress;
