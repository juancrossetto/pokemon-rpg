"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { openDailyRewardModal } from "@/lib/daily-gift-fx";
import { ProgressRing, SegmentedBar } from "@/components/events/quest-parts";
import type { HomeDailyAction, HomeObjective } from "@/lib/home-hub";

const ACCENT: Record<string, string> = {
  daily: "var(--color-pokeball-red)",
  pvp: "var(--color-electric-yellow)",
  gyms: "var(--theme-primary-bright)",
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
 * Acciones diarias estilo Clash: slots con ícono HD + badge de estado.
 * Mobile: sin labels de texto (solo ícono + chip) — aria-label para a11y.
 * Desktop: chip arriba + ícono + título.
 */
export function HomeDailyActions({
  actions,
  labels,
}: {
  actions: HomeDailyAction[];
  labels: { title: string; items: Record<string, string> };
}) {
  return (
    <section className="min-w-0" aria-label={labels.title}>
      <div className="hidden sm:block">
        <SectionLabel title={labels.title} />
      </div>
      {/* Grid fijo (no scroll): el overflow-x del home recortaba la 1ª tile y el glow.
          4 columnas desde que la sección quedó sólo con acciones con estado; en
          desktop no se estiran a lo ancho — se agrupan a la izquierda para que
          no compitan en peso con el banner de arriba. */}
      <div className="grid grid-cols-4 gap-1.5 px-0.5 pt-2.5 pb-1 sm:gap-2.5 sm:px-0 sm:py-0">
        {actions.map((action) => {
          const accent = ACCENT[action.id] ?? "var(--color-electric-yellow)";
          const label = labels.items[action.labelKey] ?? action.labelKey;
          const className = [
            // Mobile: slot cuadrado. Desktop: fila horizontal —con 4 columnas
            // repartidas a lo ancho, la tile queda ancha y baja, y una columna
            // centrada dejaba el aire muerto a los costados.
            "home-daily-tile group relative flex aspect-square w-full flex-col items-center justify-center overflow-visible rounded-[0.85rem] text-center transition sm:aspect-auto sm:flex-row sm:items-center sm:justify-start sm:gap-2.5 sm:overflow-hidden sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-left",
            "active:scale-[0.96]",
            action.hot ? "home-daily-tile--hot" : "",
          ].join(" ");
          const style = { "--daily-accent": accent } as CSSProperties;

          const statusChipDesktop = action.status ? (
            <span
              className={`max-w-full truncate rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums leading-none ${
                action.hot
                  ? "bg-[color-mix(in_srgb,var(--daily-accent)_28%,transparent)] text-white ring-1 ring-[color-mix(in_srgb,var(--daily-accent)_55%,transparent)]"
                  : "bg-black/45 text-white/70"
              }`}
            >
              {action.status}
            </span>
          ) : null;

          const statusChipMobile = action.status ? (
            <span
              className={`home-daily-tile__badge max-w-[110%] truncate px-1 py-0.5 font-mono text-[8px] font-black uppercase leading-none tracking-wide tabular-nums ${
                action.hot
                  ? "home-daily-tile__badge--hot"
                  : "home-daily-tile__badge--idle"
              }`}
            >
              {action.status}
            </span>
          ) : null;

          const inner = (
            <>
              <span
                aria-hidden
                className="home-daily-tile__glow pointer-events-none absolute inset-0 rounded-[inherit]"
              />

              {/* Mobile: badge flotante arriba (estilo chest slot) */}
              {statusChipMobile ? (
                <span className="absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-1/2 sm:hidden">
                  {statusChipMobile}
                </span>
              ) : null}

              <span className="relative z-[1] flex h-[78%] w-[78%] max-h-11 max-w-11 items-center justify-center sm:h-11 sm:w-11 sm:max-h-none sm:max-w-none sm:shrink-0">
                <Image
                  src={action.iconSrc}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_color-mix(in_srgb,var(--daily-accent)_55%,transparent)]"
                  unoptimized
                />
              </span>

              {/* Desktop: rótulo y estado apilados a la derecha del ícono. */}
              <span className="relative z-[1] hidden min-w-0 flex-1 flex-col items-start gap-1 sm:flex">
                <span className="max-w-full truncate text-[11px] font-bold uppercase tracking-[0.06em] text-white/85 group-hover:text-white">
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
                  action.status ? `${label}. ${action.status}` : label
                }
                title={label}
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
                  action.status ? `${label}. ${action.status}` : label
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
  zoneName: string | null;
  objectives: HomeObjective[];
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
    emptyAdventure: string;
    emptyWeekly: string;
    emptyEvent: string;
    claimable: string;
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
  };
}) {
  const [tab, setTab] = useState<EventsTab>(() =>
    adventure.objectives.length > 0 ? "adventure" : "weekly",
  );

  const adventureDone = adventure.objectives.filter(
    (o) => o.done || o.claimed,
  ).length;
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
      hot: adventure.objectives.some((o) => o.claimable),
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

  const claimableCount =
    adventure.objectives.filter((o) => o.claimable).length +
    weekly.claimableMilestones +
    limited.missions.filter((m) => m.claimable).length;

  return (
    <section className="min-w-0">
      {/* Mobile: resumen tipo HUD de misión (no list-row Material) */}
      <div className="sm:hidden">
        <Link
          href={
            claimableCount > 0 && weekly.claimableMilestones > 0
              ? "/events"
              : "/campaign"
          }
          className={`home-mission-hud relative flex flex-col gap-2 overflow-hidden rounded-2xl border px-3 py-2.5 transition active:scale-[0.99] ${
            claimableCount > 0
              ? "home-mission-hud--claim border-pokeball-red/45 bg-gradient-to-br from-pokeball-red/[0.14] via-[#12141c] to-[#0c0e16]"
              : "border-white/10 bg-[#12141c]/95"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <Image
                src="/nav/adventure-icon.png"
                alt=""
                width={40}
                height={40}
                className="h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                unoptimized
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="page-title block text-[11px] tracking-[0.12em] text-secondary">
                {labels.progressTitle}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-semibold text-white">
                {adventure.zoneName ?? labels.tabAdventure}
                <span className="font-mono text-[11px] tabular-nums text-white/50">
                  {adventureDone}/{adventure.objectives.length || 0}
                </span>
              </span>
            </span>
            {claimableCount > 0 ? (
              <span className="page-title shrink-0 rounded-md bg-pokeball-red/25 px-2 py-1 text-[9px] tracking-wider text-pokeball-red ring-1 ring-pokeball-red/40">
                {labels.claimable}
              </span>
            ) : null}
          </span>
          <span
            className="h-1.5 overflow-hidden rounded-full bg-black/45"
            aria-hidden
          >
            <span
              className="campaign-warm-bar block h-full rounded-full"
              style={{ width: `${adventurePct}%` }}
            />
          </span>
        </Link>
      </div>

      <div className="hidden sm:block">
      {/* Mismo patrón que /events: cinta de encabezado + filas con anillo, para
          que las dos superficies de misiones se lean como el mismo sistema.
          El acento sale de los tres knobs del theme, uno por pestaña. */}
      <div className="ev-quest" style={{ ["--ev-accent" as string]: TAB_ACCENT[tab] }}>
        <div className="ev-ribbon">
          <span aria-hidden className="ev-ribbon__icon">
            <Image
              src="/nav/adventure-icon.png"
              alt=""
              width={72}
              height={72}
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
                {adventure.objectives.map((obj) => {
                  const complete = obj.done || obj.claimed;
                  const pct =
                    obj.target > 0
                      ? Math.min(100, Math.round((obj.current / obj.target) * 100))
                      : 0;
                  return (
                    <li
                      key={obj.id}
                      className={`ev-quest__card${obj.claimable ? " is-ready" : ""}${
                        complete && !obj.claimable ? " is-done" : ""
                      }`}
                    >
                      <div className="ev-quest__body">
                        <div className="ev-quest__main">
                          <SegmentedBar pct={complete ? 100 : pct} />
                          <p className="ev-quest__text truncate">
                            {labels.objectiveLabels[obj.id] ?? obj.labelKey}
                          </p>
                          {obj.claimable ? (
                            <span className="home-quest-ready">{labels.claimable}</span>
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
                            <span className="home-quest-ready">{labels.claimable}</span>
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
      </div>
    </section>
  );
}

/** @deprecated Preferí HomeEventsProgress. */
export const HomeZoneProgress = HomeEventsProgress;
/** @deprecated Preferí HomeEventsProgress. */
export const HomeMissionsCarousel = HomeEventsProgress;
