"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { openDailyRewardModal } from "@/lib/daily-gift-fx";
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
 * Acciones diarias estilo Clash: tiles grandes, chip de estado, glow + hover.
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
      <SectionLabel title={labels.title} />
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
        {actions.map((action) => {
          const accent = ACCENT[action.id] ?? "var(--color-electric-yellow)";
          const label = labels.items[action.labelKey] ?? action.labelKey;
          const className = [
            "home-daily-tile group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl px-0.5 py-2 text-center transition sm:gap-1.5 sm:rounded-2xl sm:px-1.5 sm:py-3",
            "active:scale-[0.96]",
            action.hot ? "home-daily-tile--hot" : "",
          ].join(" ");
          const style = { "--daily-accent": accent } as CSSProperties;

          const inner = (
            <>
              <span
                aria-hidden
                className="home-daily-tile__glow pointer-events-none absolute inset-0"
              />
              <span className="relative z-[1] flex h-9 w-9 items-center justify-center sm:h-14 sm:w-14">
                <Image
                  src={action.iconSrc}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_color-mix(in_srgb,var(--daily-accent)_55%,transparent)]"
                  unoptimized
                />
              </span>
              <span className="relative z-[1] max-w-full truncate px-0.5 text-[8px] font-bold uppercase tracking-[0.04em] text-white/85 group-hover:text-white sm:text-[11px] sm:tracking-[0.06em]">
                {label}
              </span>
              {action.status ? (
                <span
                  className={`relative z-[1] max-w-[95%] truncate rounded-md px-1 py-0.5 font-mono text-[8px] font-bold tabular-nums leading-none sm:px-1.5 sm:text-[10px] ${
                    action.hot
                      ? "bg-[color-mix(in_srgb,var(--daily-accent)_28%,transparent)] text-white ring-1 ring-[color-mix(in_srgb,var(--daily-accent)_55%,transparent)]"
                      : "bg-black/35 text-white/60"
                  }`}
                >
                  {action.status}
                </span>
              ) : (
                <span className="h-[12px] sm:h-[14px]" aria-hidden />
              )}
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
              >
                {inner}
              </button>
            );
          }

          if (action.href) {
            return (
              // Seis destinos en la home, todos siempre montados: con el
              // prefetch por default de Link, cada carga de home dispara un
              // request RSC a los seis apenas entran en viewport (que es
              // inmediato, están arriba del fold). Ninguno es el camino
              // principal —"Salir a explorar" y el equipo activo sí lo son y
              // mantienen el prefetch normal— así que se desactiva acá.
              <Link
                key={action.id}
                href={action.href}
                prefetch={false}
                className={className}
                style={style}
              >
                {inner}
              </Link>
            );
          }

          return (
            <div key={action.id} className={className} style={style}>
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

  return (
    <section className="min-w-0">
      <SectionLabel
        title={labels.progressTitle}
        subtitle={subtitle}
        actionHref={footer.href}
        actionLabel={footer.cta}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#12141c]/90">
        <div
          role="tablist"
          className="flex border-b border-white/8"
          aria-label={labels.progressTitle}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition sm:text-[11px] ${
                tab === t.id
                  ? "bg-white/[0.06] text-white shadow-[inset_0_-2px_0_0_var(--color-pokeball-red)]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
              {t.hot ? (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-pokeball-red shadow-[0_0_6px_var(--color-pokeball-red)]"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="p-3.5 sm:p-4">
          {tab === "adventure" ? (
            adventure.objectives.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-white/45">
                {labels.emptyAdventure}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {adventure.objectives.map((obj) => {
                  const complete = obj.done || obj.claimed;
                  return (
                    <li
                      key={obj.id}
                      className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-2"
                    >
                      <MissionCheck complete={complete} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">
                        {labels.objectiveLabels[obj.id] ?? obj.labelKey}
                      </span>
                      {obj.claimable ? (
                        <span className="shrink-0 rounded-md bg-pokeball-red/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pokeball-red">
                          {labels.claimable}
                        </span>
                      ) : null}
                      <span
                        className={`shrink-0 font-mono text-[12px] font-bold tabular-nums ${
                          complete ? "text-electric-yellow" : "text-white/45"
                        }`}
                      >
                        {obj.current}/{obj.target}
                      </span>
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
              <ul className="flex flex-col gap-2">
                {weekly.objectives.map((obj) => {
                  const complete = obj.current >= obj.target;
                  return (
                    <li
                      key={obj.id}
                      className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-2"
                    >
                      <MissionCheck complete={complete} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">
                        {labels.weeklyLabels[obj.id] ?? obj.id}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[12px] font-bold tabular-nums ${
                          complete ? "text-electric-yellow" : "text-white/45"
                        }`}
                      >
                        {Math.min(obj.current, obj.target)}/{obj.target}
                      </span>
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
              <ul className="flex flex-col gap-2">
                {limited.missions.map((mission) => {
                  const complete =
                    mission.claimed || mission.current >= mission.target;
                  return (
                    <li
                      key={mission.id}
                      className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-2"
                    >
                      <MissionCheck complete={complete} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">
                        {labels.missionLabels[mission.id] ?? mission.id}
                      </span>
                      {mission.claimable ? (
                        <span className="shrink-0 rounded-md bg-pokeball-red/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pokeball-red">
                          {labels.claimable}
                        </span>
                      ) : mission.claimed ? (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-white/35">
                          {labels.claimed}
                        </span>
                      ) : null}
                      <span
                        className={`shrink-0 font-mono text-[12px] font-bold tabular-nums ${
                          complete ? "text-electric-yellow" : "text-white/45"
                        }`}
                      >
                        {mission.current}/{mission.target}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
              <span>{footer.left}</span>
              <span>{footer.right}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/45">
              <div
                className="campaign-warm-bar h-full rounded-full transition-[width] duration-500"
                style={{ width: `${footer.pct}%` }}
              />
            </div>
          </div>

          <Link
            href={footer.href}
            className="mt-3.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-pokeball-red/45 bg-transparent text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:border-pokeball-red/70 hover:bg-pokeball-red/10"
          >
            <span className="material-symbols-outlined text-[16px]!">
              {footer.icon}
            </span>
            {footer.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

function MissionCheck({ complete }: { complete: boolean }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
        complete
          ? "bg-[color-mix(in_srgb,var(--color-electric-yellow)_18%,transparent)] text-electric-yellow"
          : "bg-white/6 text-white/35"
      }`}
    >
      <span className="material-symbols-outlined text-[16px]!">
        {complete ? "check_circle" : "radio_button_unchecked"}
      </span>
    </span>
  );
}

/** @deprecated Preferí HomeEventsProgress. */
export const HomeZoneProgress = HomeEventsProgress;
/** @deprecated Preferí HomeEventsProgress. */
export const HomeMissionsCarousel = HomeEventsProgress;
