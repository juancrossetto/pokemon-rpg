"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { itemHdIconUrl } from "@/lib/item-sprites";
import {
  claimDailyReward,
  claimEventMission,
  claimWeeklyMilestone,
} from "@/actions/claim-reward";
import { announceCoinDelta } from "@/lib/coin-fx";
import { RewardChip, RewardList } from "@/components/events/reward-chip";
import { DailyCalendar } from "@/components/events/daily-calendar";
import type { RewardDef } from "@/lib/events/rewards";
import type { DailyState, LimitedEventState, WeeklyState } from "@/lib/events/state";

export type EventsLabels = {
  eyebrow: string;
  title: string;
  subtitle: string;
  pending: string;
  dailyTitle: string;
  dailySubtitle: string;
  dailyDay: string;
  dailyClaim: string;
  dailyClaimed: string;
  dailyNext: string;
  dailyProgress: string;
  weeklyTitle: string;
  weeklySubtitle: string;
  weeklyPercent: string;
  weeklyReset: string;
  objectives: Record<string, string>;
  milestone: string;
  claim: string;
  claimed: string;
  locked: string;
  goTo: string;
  rewards: { coins: string; energy: string; item: string };
  revealTitle: string;
  revealClose: string;
  revealInventory: string;
  errorClaimed: string;
  errorNotAvailable: string;
  errorGeneric: string;
  close: string;
  statusToday: string;
  statusClaimed: string;
  statusUpcoming: string;
  limitedBadge: string;
  limitedEnds: string;
  limitedName: string;
  limitedTagline: string;
  limitedMissions: Record<string, string>;
  /** "Parte {current} de {total}:" */
  limitedPartOf: string;
  /** "Recompensas:" */
  rewardsLabel: string;
};

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );

/**
 * Reloj compartido por toda la pantalla.
 *
 * El brief pedía no crear un temporizador por card. Un solo intervalo emite el
 * "ahora" y todas las cuentas regresivas se derivan de él; además tiquea cada
 * 30s en vez de cada segundo, porque los plazos que se muestran son de horas y
 * refrescar 60 veces por minuto solo gasta renders.
 */
function useSharedClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** "2 d 14 h" / "3 h 20 m" / "12 m". Sin concatenar frases traducidas. */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 m";
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} d ${hours % 24} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} m`;
  return `${minutes} m`;
}

export function EventsHub({
  daily,
  weekly,
  limited,
  pendingCount,
  labels,
  locale,
}: {
  daily: DailyState;
  weekly: WeeklyState;
  limited: LimitedEventState;
  pendingCount: number;
  labels: EventsLabels;
  locale: string;
}) {
  const now = useSharedClock();
  const [reveal, setReveal] = useState<RewardDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onError(code: string) {
    setError(
      code === "already_claimed"
        ? labels.errorClaimed
        : code === "not_available"
          ? labels.errorNotAvailable
          : labels.errorGeneric,
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <header className="min-w-0">
        <p className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-pokeball-red sm:text-label-sm">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
          {labels.eyebrow}
        </p>
        <h1 className="page-title text-[clamp(1.5rem,6vw,2rem)] text-white">
          {labels.title}
        </h1>
        <p className="mt-0.5 text-[12px] leading-snug text-on-surface-variant sm:text-label-md">
          {labels.subtitle}
        </p>
        {pendingCount > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-tertiary/35 bg-tertiary/10 px-2.5 py-1 text-label-sm text-tertiary">
            <span aria-hidden className="material-symbols-outlined text-[16px]!">
              redeem
            </span>
            {fill(labels.pending, { count: pendingCount })}
          </p>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error"
        >
          {error}
        </p>
      )}

      {/* El evento va primero: es lo único de la pantalla que caduca. */}
      <LimitedPanel
        limited={limited}
        labels={labels}
        locale={locale}
        now={now}
        onReveal={setReveal}
        onError={onError}
        clearError={() => setError(null)}
      />

      <DailyPanel
        daily={daily}
        labels={labels}
        locale={locale}
        now={now}
        onReveal={setReveal}
        onError={onError}
        clearError={() => setError(null)}
      />

      <WeeklyPanel
        weekly={weekly}
        labels={labels}
        locale={locale}
        now={now}
        onReveal={setReveal}
        onError={onError}
        clearError={() => setError(null)}
      />

      {reveal && (
        <RewardReveal rewards={reveal} labels={labels} onClose={() => setReveal(null)} />
      )}
    </div>
  );
}

/* ── Evento por tiempo limitado ───────────────────────────────────────── */

/**
 * A diferencia del semanal, cada misión se cobra por separado y la card se
 * tiñe con el color de la edición: el evento tiene que distinguirse a simple
 * vista de las dos secciones permanentes que tiene debajo.
 */
function LimitedPanel({
  limited,
  labels,
  locale,
  now,
  onReveal,
  onError,
  clearError,
}: {
  limited: LimitedEventState;
  labels: EventsLabels;
  locale: string;
  now: number;
  onReveal: (rewards: RewardDef[]) => void;
  onError: (code: string) => void;
  clearError: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const remaining = new Date(limited.endsAt).getTime() - now;
  const accent = limited.accent;

  function claim(missionId: string) {
    if (pending) return;
    clearError();
    setBusy(missionId);
    startTransition(async () => {
      const result = await claimEventMission(locale, missionId);
      setBusy(null);
      if (!result.ok) {
        onError(result.error);
        return;
      }
      if (result.coinsDelta !== 0) announceCoinDelta(result.coinsDelta);
      onReveal(result.granted);
    });
  }

  return (
    <section className="ev-quest" style={{ ["--ev-accent" as string]: accent }}>
      <header className="ev-ribbon">
        <span aria-hidden className="ev-ribbon__icon">
          <Image
            src={itemHdIconUrl(limited.iconItem) ?? "/items/hd/poke-ball.png"}
            alt=""
            width={72}
            height={72}
            className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            unoptimized
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="ev-ribbon__eyebrow">{labels.limitedBadge}</span>
          <span className="ev-ribbon__title">{labels.limitedName}</span>
        </span>
        <span className="ev-ribbon__timer">
          <span className="material-symbols-outlined text-[14px]!">schedule</span>
          {fill(labels.limitedEnds, { time: formatRemaining(remaining) })}
        </span>
      </header>

      <ul className="ev-quest__list">
        {limited.missions.map((mission, index) => {
          const done = mission.current >= mission.target;
          const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));
          const partLabel = fill(labels.limitedPartOf, {
            current: index + 1,
            total: limited.missions.length,
          });
          const missionText = labels.limitedMissions[mission.id] ?? mission.id;
          const badgeReward = mission.rewards[0] ?? null;
          return (
            <li
              key={mission.id}
              className={`ev-quest__card ${mission.claimable ? "is-ready" : ""} ${
                mission.claimed ? "is-done" : ""
              }`}
            >
              <div className="ev-quest__body">
                <div className="ev-quest__main min-w-0 flex-1">
                  <div className="ev-quest__track">
                    <SegmentedBar pct={done ? 100 : pct} segments={4} />
                    {badgeReward ? <MissionBadge reward={badgeReward} /> : null}
                  </div>
                  <p className="ev-quest__text">
                    <span className="ev-quest__part">{partLabel}</span>{" "}
                    {missionText}
                  </p>
                </div>
                <ProgressRing
                  current={Math.min(mission.current, mission.target)}
                  target={mission.target}
                />
              </div>

              <div className="ev-quest__foot">
                <span className="ev-quest__rewards">
                  <span className="ev-quest__rewards-label">{labels.rewardsLabel}</span>
                  <span className="ev-quest__rewards-pill">
                    <RewardList
                      rewards={mission.rewards}
                      size="xs"
                      unitLabels={labels.rewards}
                    />
                  </span>
                </span>
                {mission.claimed ? (
                  <span className="ev-tag ev-tag--done">{labels.claimed}</span>
                ) : mission.claimable ? (
                  <button
                    type="button"
                    onClick={() => claim(mission.id)}
                    disabled={pending}
                    className="ev-cta ev-cta--solid"
                  >
                    {busy === mission.id ? "…" : labels.claim}
                  </button>
                ) : mission.href ? (
                  <Link href={mission.href} className="ev-cta">
                    {labels.goTo}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Barra por tramos: degradé continuo de la 1ª a la última franja. */
function SegmentedBar({ pct, segments = 4 }: { pct: number; segments?: number }) {
  const filled = (pct / 100) * segments;
  return (
    <span
      className="ev-seg"
      aria-hidden
      style={{ ["--ev-seg-n" as string]: segments }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="ev-seg__slot">
          <span
            className="ev-seg__fill"
            style={{
              width: `${Math.max(0, Math.min(1, filled - i)) * 100}%`,
              ["--ev-seg-i" as string]: i,
            }}
          />
        </span>
      ))}
    </span>
  );
}

/** Insignia al final de la barra — premio de la misión, como en la referencia. */
function MissionBadge({ reward }: { reward: RewardDef }) {
  let src = "/items/hd/poke-ball.png";
  if (reward.kind === "item") {
    src = itemHdIconUrl(reward.itemName) ?? "/items/hd/poke-ball.png";
  } else if (reward.kind === "coins") {
    src = "/items/hd/poke-coin-bundle-s.png";
  } else if (reward.kind === "energy") {
    src = "/items/hd/energy.png";
  } else if (reward.kind === "gems") {
    src = "/items/hd/gem.png";
  }
  return (
    <span className="ev-quest__badge" aria-hidden>
      <Image src={src} alt="" width={40} height={40} className="h-full w-full object-contain" unoptimized />
    </span>
  );
}

/** Anillo con la fracción al centro, como el contador de la referencia. */
function ProgressRing({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <span className="ev-ring">
      <svg viewBox="0 0 56 56" aria-hidden focusable="false">
        <circle className="ev-ring__track" cx="28" cy="28" r="23" pathLength={100} />
        <circle
          className="ev-ring__fill"
          cx="28"
          cy="28"
          r="23"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
        />
      </svg>
      <span className="ev-ring__label">
        {current}/{target}
      </span>
    </span>
  );
}

/* ── Regalo diario ────────────────────────────────────────────────────── */

function DailyPanel({
  daily,
  labels,
  locale,
  now,
  onReveal,
  onError,
  clearError,
}: {
  daily: DailyState;
  labels: EventsLabels;
  locale: string;
  now: number;
  onReveal: (rewards: RewardDef[]) => void;
  onError: (code: string) => void;
  clearError: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const remaining = new Date(daily.nextResetAt).getTime() - now;

  function claim() {
    if (pending || !daily.canClaim) return;
    clearError();
    startTransition(async () => {
      const result = await claimDailyReward(locale);
      if (!result.ok) {
        onError(result.error);
        return;
      }
      if (result.coinsDelta !== 0) announceCoinDelta(result.coinsDelta);
      onReveal(result.granted);
    });
  }

  return (
    <section className="ev-quest" style={{ ["--ev-accent" as string]: "#38bdf8" }}>
      <header className="ev-ribbon">
        <span aria-hidden className="ev-ribbon__icon">
          <span className="material-symbols-outlined text-[22px]! text-white">
            redeem
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="ev-ribbon__title">{labels.dailyTitle}</span>
        </span>
        <span className="ev-ribbon__timer">
          <span className="material-symbols-outlined text-[14px]!">today</span>
          {fill(labels.dailyProgress, {
            current: daily.currentDay,
            total: daily.length,
          })}
        </span>
      </header>

      <div className="ev-quest__list ev-daily__body">
        <p className="ev-daily__hint">{labels.dailySubtitle}</p>
        <DailyCalendar
          days={daily.days}
          labels={{
            dailyDay: labels.dailyDay,
            statusToday: labels.statusToday,
            statusClaimed: labels.statusClaimed,
            statusUpcoming: labels.statusUpcoming,
            rewards: labels.rewards,
          }}
        />

        <div className="ev-daily__action">
          {daily.canClaim ? (
            <button
              type="button"
              onClick={claim}
              disabled={pending}
              className="ev-cta ev-cta--solid ev-daily__claim"
            >
              {pending ? "…" : labels.dailyClaim}
            </button>
          ) : (
            <p className="ev-claimed-note">
              <span aria-hidden className="material-symbols-outlined text-[16px]!">
                check_circle
              </span>
              {labels.dailyClaimed}
              <span className="opacity-60">
                · {fill(labels.dailyNext, { time: formatRemaining(remaining) })}
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Desafío semanal ──────────────────────────────────────────────────── */

function WeeklyPanel({
  weekly,
  labels,
  locale,
  now,
  onReveal,
  onError,
  clearError,
}: {
  weekly: WeeklyState;
  labels: EventsLabels;
  locale: string;
  now: number;
  onReveal: (rewards: RewardDef[]) => void;
  onError: (code: string) => void;
  clearError: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const remaining = new Date(weekly.nextResetAt).getTime() - now;
  const accent = "#ec4899";
  const objectiveTotal = weekly.objectives.length;

  function claim(milestone: number) {
    if (pending) return;
    clearError();
    setBusy(milestone);
    startTransition(async () => {
      const result = await claimWeeklyMilestone(locale, milestone);
      setBusy(null);
      if (!result.ok) {
        onError(result.error);
        return;
      }
      if (result.coinsDelta !== 0) announceCoinDelta(result.coinsDelta);
      onReveal(result.granted);
    });
  }

  return (
    <section className="ev-quest" style={{ ["--ev-accent" as string]: accent }}>
      <header className="ev-ribbon">
        <span aria-hidden className="ev-ribbon__icon">
          <span className="material-symbols-outlined text-[22px]! text-white">
            calendar_month
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="ev-ribbon__eyebrow">
            {fill(labels.weeklyPercent, { percent: weekly.percent })}
          </span>
          <span className="ev-ribbon__title">{labels.weeklyTitle}</span>
        </span>
        <span className="ev-ribbon__timer">
          <span className="material-symbols-outlined text-[14px]!">schedule</span>
          {fill(labels.weeklyReset, { time: formatRemaining(remaining) })}
        </span>
      </header>

      <ul className="ev-quest__list">
        {weekly.objectives.map((objective, index) => {
          const done = objective.current >= objective.target;
          const pct = Math.min(
            100,
            Math.round((objective.current / Math.max(1, objective.target)) * 100),
          );
          const partLabel = fill(labels.limitedPartOf, {
            current: index + 1,
            total: objectiveTotal,
          });
          return (
            <li
              key={objective.id}
              className={`ev-quest__card ${done ? "is-done" : ""}`}
            >
              <div className="ev-quest__body">
                <div className="ev-quest__main min-w-0 flex-1">
                  <div className="ev-quest__track">
                    <SegmentedBar pct={done ? 100 : pct} segments={4} />
                  </div>
                  <p className="ev-quest__text">
                    <span className="ev-quest__part">{partLabel}</span>{" "}
                    {labels.objectives[objective.id]}
                  </p>
                </div>
                <ProgressRing
                  current={Math.min(objective.current, objective.target)}
                  target={objective.target}
                />
              </div>
              <div className="ev-quest__foot">
                <span className="ev-quest__rewards" />
                {done ? (
                  <span className="ev-tag ev-tag--done">{labels.claimed}</span>
                ) : objective.href ? (
                  <Link href={objective.href} className="ev-cta">
                    {labels.goTo}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}

        {weekly.milestones.map((milestone) => {
          const pct = Math.min(
            100,
            Math.round((weekly.percent / milestone.percent) * 100),
          );
          const badgeReward = milestone.rewards[0] ?? null;
          return (
            <li
              key={milestone.percent}
              className={`ev-quest__card ${milestone.claimable ? "is-ready" : ""} ${
                milestone.claimed ? "is-done" : ""
              }`}
            >
              <div className="ev-quest__body">
                <div className="ev-quest__main min-w-0 flex-1">
                  <div className="ev-quest__track">
                    <SegmentedBar pct={pct} segments={4} />
                    {badgeReward ? <MissionBadge reward={badgeReward} /> : null}
                  </div>
                  <p className="ev-quest__text">
                    <span className="ev-quest__part">
                      {fill(labels.milestone, { percent: milestone.percent })}
                    </span>
                  </p>
                </div>
                <ProgressRing
                  current={Math.min(weekly.percent, milestone.percent)}
                  target={milestone.percent}
                />
              </div>
              <div className="ev-quest__foot">
                <span className="ev-quest__rewards">
                  <span className="ev-quest__rewards-label">{labels.rewardsLabel}</span>
                  <span className="ev-quest__rewards-pill">
                    <RewardList
                      rewards={milestone.rewards}
                      size="xs"
                      unitLabels={labels.rewards}
                    />
                  </span>
                </span>
                {milestone.claimed ? (
                  <span className="ev-tag ev-tag--done">{labels.claimed}</span>
                ) : milestone.claimable ? (
                  <button
                    type="button"
                    onClick={() => claim(milestone.percent)}
                    disabled={pending}
                    className="ev-cta ev-cta--solid"
                  >
                    {busy === milestone.percent ? "…" : labels.claim}
                  </button>
                ) : (
                  <span className="ev-tag">{labels.locked}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Confirmación de recompensa ───────────────────────────────────────── */

/**
 * Panel de confirmación reutilizable: muestra lo que efectivamente entregó el
 * servidor, no lo que el cliente esperaba. Si una recompensa se omitió por
 * faltar del catálogo, acá no aparece —y eso es correcto: se informa lo real.
 */
function RewardReveal({
  rewards,
  labels,
  onClose,
}: {
  rewards: RewardDef[];
  labels: EventsLabels;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="market-sheet-backdrop-in absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-reveal-title"
        className="market-sheet-in reward-halo relative w-full max-w-sm overflow-hidden rounded-t-2xl border-t border-tertiary/25 bg-[#0b0d13]/98 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center backdrop-blur-xl sm:rounded-2xl sm:border sm:pb-5"
      >
        {/* Línea superior teñida: marca que es un panel de premio sin teñir la
            card entera ni recurrir a un gradiente fuerte. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-tertiary/70 to-transparent"
        />

        <span
          aria-hidden
          className="relative mx-auto grid h-12 w-12 place-items-center rounded-full border border-tertiary/30 bg-tertiary/10"
        >
          <span className="material-symbols-outlined text-[26px]! text-tertiary">redeem</span>
        </span>
        <h2
          id="reward-reveal-title"
          className="relative mt-2 text-headline-md tracking-tight text-white"
        >
          {labels.revealTitle}
        </h2>

        {/*
          Una recompensa ocupa una tarjeta ancha; varias se reparten en fila.
          Antes una sola quedaba en una caja enorme y vacía, que es lo que hacía
          ver el panel desangelado.
        */}
        <ul
          className={`relative mt-4 grid gap-2 ${
            rewards.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {rewards.map((reward, index) => (
            <li
              key={`${reward.kind}-${index}`}
              className="reward-pop flex items-center justify-center gap-2 rounded-xl border border-tertiary/20 bg-gradient-to-b from-white/[0.06] to-transparent px-3 py-3"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <RewardChip reward={reward} size="lg" unitLabels={labels.rewards} />
            </li>
          ))}
        </ul>

        <div className="relative mt-5 flex items-center gap-2">
          <Link
            href="/inventory"
            className="flex h-11 flex-1 items-center justify-center rounded-md border border-white/12 text-label-sm text-on-surface-variant transition hover:border-white/25"
          >
            {labels.revealInventory}
          </Link>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className="ui-btn-primary h-11 flex-1 text-label-sm font-bold"
          >
            {labels.revealClose}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
