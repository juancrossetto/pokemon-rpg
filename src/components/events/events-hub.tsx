"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
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
        <h1 className="text-[clamp(1.5rem,6vw,2rem)] font-semibold leading-tight tracking-tight text-white">
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
    <section
      className="glass-panel relative overflow-hidden rounded-xl border p-3 sm:p-4"
      style={{
        borderColor: `${accent}59`,
        background: `linear-gradient(135deg, ${accent}1f, transparent 65%)`,
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"
            style={{ borderColor: `${accent}66`, background: `${accent}1f`, color: accent }}
          >
            <span className="material-symbols-outlined text-[20px]!">{limited.icon}</span>
          </span>
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: accent }}
            >
              {labels.limitedBadge}
            </p>
            <h2 className="text-label-md font-semibold text-white">{labels.limitedName}</h2>
            <p className="text-[11px] leading-snug text-on-surface-variant">
              {labels.limitedTagline}
            </p>
          </div>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-on-surface-variant">
          {fill(labels.limitedEnds, { time: formatRemaining(remaining) })}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {limited.missions.map((mission) => {
          const done = mission.current >= mission.target;
          const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));
          return (
            <li
              key={mission.id}
              className={`rounded-lg border px-2.5 py-2 ${
                mission.claimable
                  ? "border-tertiary/55 bg-tertiary/10"
                  : mission.claimed
                    ? "border-white/[0.07] bg-white/[0.02] opacity-60"
                    : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`material-symbols-outlined text-[16px]! ${
                    done ? "text-emerald-400" : "text-on-surface-variant/60"
                  }`}
                >
                  {done ? "task_alt" : "radio_button_unchecked"}
                </span>
                <span className="min-w-0 flex-1 text-label-sm leading-snug text-on-surface">
                  {labels.limitedMissions[mission.id] ?? mission.id}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">
                  {mission.current}/{mission.target}
                </span>
              </div>

              {!done && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, background: accent }}
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                <RewardList rewards={mission.rewards} size="sm" unitLabels={labels.rewards} />
                {mission.claimed ? (
                  <span className="flex items-center gap-1 text-[10px] uppercase text-emerald-400">
                    <span aria-hidden className="material-symbols-outlined text-[13px]!">
                      check
                    </span>
                    {labels.claimed}
                  </span>
                ) : mission.claimable ? (
                  <button
                    type="button"
                    onClick={() => claim(mission.id)}
                    disabled={pending}
                    className="h-9 shrink-0 rounded-md bg-tertiary px-3 text-[10px] font-bold uppercase tracking-wide text-surface transition hover:bg-tertiary/85 disabled:opacity-60"
                  >
                    {busy === mission.id ? "…" : labels.claim}
                  </button>
                ) : mission.href ? (
                  <Link
                    href={mission.href}
                    className="shrink-0 rounded-md border border-white/12 px-2 py-1 text-[10px] uppercase text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
                  >
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
    <section className="glass-panel rounded-xl border border-white/10 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-label-md font-semibold text-white">{labels.dailyTitle}</h2>
          <p className="text-[11px] leading-snug text-on-surface-variant">
            {labels.dailySubtitle}
          </p>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-on-surface-variant">
          {fill(labels.dailyProgress, { current: daily.currentDay, total: daily.length })}
        </p>
      </div>

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

      <div className="mt-3">
        {daily.canClaim ? (
          <button
            type="button"
            onClick={claim}
            disabled={pending}
            className="daily-claim-cta h-11 w-full rounded-md bg-pokeball-red text-label-sm font-bold uppercase tracking-wide text-white transition hover:bg-pokeball-red/85 disabled:opacity-60"
          >
            {pending ? "…" : labels.dailyClaim}
          </button>
        ) : (
          <p className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 text-label-sm text-on-surface-variant">
            <span aria-hidden className="material-symbols-outlined text-[16px]! text-emerald-400">
              check_circle
            </span>
            {labels.dailyClaimed}
            <span className="text-on-surface-variant/60">
              · {fill(labels.dailyNext, { time: formatRemaining(remaining) })}
            </span>
          </p>
        )}
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
    <section className="glass-panel rounded-xl border border-white/10 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-label-md font-semibold text-white">{labels.weeklyTitle}</h2>
          <p className="text-[11px] leading-snug text-on-surface-variant">
            {labels.weeklySubtitle}
          </p>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-on-surface-variant">
          {fill(labels.weeklyReset, { time: formatRemaining(remaining) })}
        </p>
      </div>

      {/* La barra dice qué mide, no es un porcentaje suelto. */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-label-sm">
          <span className="text-on-surface-variant">
            {fill(labels.weeklyPercent, { percent: weekly.percent })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={weekly.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-pokeball-red transition-[width] duration-500"
            style={{ width: `${weekly.percent}%` }}
          />
        </div>
      </div>

      <ul className="mb-3 flex flex-col gap-1.5">
        {weekly.objectives.map((objective) => {
          const done = objective.current >= objective.target;
          return (
            <li
              key={objective.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-label-sm"
            >
              <span
                aria-hidden
                className={`material-symbols-outlined text-[16px]! ${
                  done ? "text-emerald-400" : "text-on-surface-variant/60"
                }`}
              >
                {done ? "task_alt" : "radio_button_unchecked"}
              </span>
              <span className="min-w-0 flex-1 leading-snug text-on-surface">
                {labels.objectives[objective.id]}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">
                {Math.min(objective.current, objective.target)}/{objective.target}
              </span>
              {!done && objective.href && (
                <Link
                  href={objective.href}
                  className="shrink-0 rounded-md border border-white/12 px-2 py-1 text-[10px] uppercase text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
                >
                  {labels.goTo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {weekly.milestones.map((milestone) => (
          <li
            key={milestone.percent}
            className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center ${
              milestone.claimable
                ? "border-tertiary/55 bg-tertiary/10"
                : milestone.claimed
                  ? "border-white/[0.07] bg-white/[0.02] opacity-60"
                  : "border-white/10 bg-black/20"
            }`}
          >
            <span className="font-mono text-[10px] uppercase text-on-surface-variant">
              {fill(labels.milestone, { percent: milestone.percent })}
            </span>
            <RewardList rewards={milestone.rewards} size="sm" unitLabels={labels.rewards} />
            {milestone.claimed ? (
              <span className="flex items-center gap-1 text-[10px] uppercase text-emerald-400">
                <span aria-hidden className="material-symbols-outlined text-[13px]!">
                  check
                </span>
                {labels.claimed}
              </span>
            ) : milestone.claimable ? (
              <button
                type="button"
                onClick={() => claim(milestone.percent)}
                disabled={pending}
                className="h-9 w-full rounded-md bg-tertiary text-[10px] font-bold uppercase tracking-wide text-surface transition hover:bg-tertiary/85 disabled:opacity-60"
              >
                {busy === milestone.percent ? "…" : labels.claim}
              </button>
            ) : (
              <span className="flex h-9 items-center text-[10px] uppercase text-on-surface-variant/60">
                {labels.locked}
              </span>
            )}
          </li>
        ))}
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
            className="h-11 flex-1 rounded-md bg-pokeball-red text-label-sm font-bold text-white transition hover:bg-pokeball-red/85"
          >
            {labels.revealClose}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
