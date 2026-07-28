"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { claimDailyReward } from "@/actions/claim-reward";
import { announceCoinDelta } from "@/lib/coin-fx";
import { DailyCalendar, type CalendarLabels } from "@/components/events/daily-calendar";
import { RewardList } from "@/components/events/reward-chip";
import type { RewardDef } from "@/lib/events/rewards";
import type { DailyDayState } from "@/lib/events/state";

export type GiftModalLabels = CalendarLabels & {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Con `{current}` y `{total}`. */
  progress: string;
  claim: string;
  claiming: string;
  close: string;
  claimedTitle: string;
  continueLabel: string;
  /** Texto del acceso que reabre el modal tras cerrarlo sin reclamar. */
  reopen: string;
};

const SEEN_KEY = "pokerpg:daily-gift-seen";

/**
 * Estado "ya lo vi en esta sesión", sobre `sessionStorage`.
 *
 * `useSyncExternalStore` y no `useState` + efecto: el snapshot del servidor
 * devuelve siempre `false`, así que no hay desajuste de hidratación, y leer en
 * el render evita el render en cascada que marca el lint.
 */
let listeners: Array<() => void> = [];

function subscribe(onChange: () => void): () => void {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
}

function wasSeen(): boolean {
  return sessionStorage.getItem(SEEN_KEY) === "1";
}

function markSeen(): void {
  sessionStorage.setItem(SEEN_KEY, "1");
  for (const listener of listeners) listener();
}

function reopen(): void {
  sessionStorage.removeItem(SEEN_KEY);
  for (const listener of listeners) listener();
}

const OAK_GIFT_ART = "/events/gift_oak.png";

/**
 * Modal del regalo diario, centrado y modal de verdad.
 *
 * Se abre **una sola vez por sesión** cuando hay un regalo sin reclamar. El
 * brief pedía no interrumpir en cada navegación: al cerrarlo o reclamarlo se
 * marca visto y no vuelve a aparecer hasta la próxima sesión, pero el regalo
 * sigue accesible desde Eventos y desde el badge del navbar.
 *
 * La ilustración es el Profesor Oak con el regalo (`public/events/gift_oak.png`).
 */
export function DailyGiftModal({
  days,
  currentDay,
  total,
  labels,
  locale,
  showChip = true,
}: {
  days: DailyDayState[];
  currentDay: number;
  total: number;
  labels: GiftModalLabels;
  locale: string;
  /** Si false, al cerrar sin reclamar no deja chip (Home usa IdleRewardWidget). */
  showChip?: boolean;
}) {
  const seen = useSyncExternalStore(subscribe, wasSeen, () => true);
  const [claimed, setClaimed] = useState<RewardDef[] | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = !seen || claimed !== null;

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!pending) markSeen();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, pending]);

  function claim() {
    if (pending) return;
    startTransition(async () => {
      const result = await claimDailyReward(locale);
      if (!result.ok) {
        // Otra pestaña se adelantó: se cierra sin cartel de error, no hay nada
        // que el jugador deba corregir.
        markSeen();
        return;
      }
      if (result.coinsDelta !== 0) announceCoinDelta(result.coinsDelta);
      setClaimed(result.granted);
    });
  }

  function close() {
    markSeen();
    setClaimed(null);
  }

  if (!open) {
    if (!showChip) return null;
    /*
      Cerrado y sin reclamar: queda un acceso discreto para volver a abrirlo.
      En Home el IdleRewardWidget cubre este rol — pasar showChip={false}.
    */
    return (
      <button
        type="button"
        onClick={reopen}
        className="gift-chip mb-4 inline-flex max-w-full items-center gap-2 rounded-md border border-emerald-400/35 bg-emerald-400/[0.08] py-1.5 pl-1.5 pr-3 text-left transition hover:border-emerald-400/55 hover:bg-emerald-400/[0.13]"
      >
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded border border-emerald-400/30 bg-emerald-400/10"
        >
          <span className="material-symbols-outlined text-[16px]! text-emerald-300">redeem</span>
        </span>
        <span className="min-w-0 truncate text-label-sm text-emerald-100">{labels.reopen}</span>
        <span
          aria-hidden
          className="material-symbols-outlined shrink-0 text-[16px]! text-emerald-400/80"
        >
          chevron_right
        </span>
      </button>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3"
      role="presentation"
    >
      <button
        type="button"
        aria-label={labels.close}
        onClick={close}
        className="market-sheet-backdrop-in absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-gift-title"
        className="gift-modal-in reward-halo relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-tertiary/30 bg-[#0b0d13]/98 backdrop-blur-xl"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-tertiary/70 to-transparent"
        />

        {/*
          ── Cabecera ─────────────────────────────────────────────────
          Oak es la ilustración hero (derecha), no un thumbnail al lado
          del título. El texto queda a la izquierda con espacio libre.
        */}
        <div className="relative shrink-0 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Image
              src="/campaign/maps/regions/kanto.webp"
              alt=""
              fill
              sizes="512px"
              className="object-cover object-center opacity-[0.13]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d13] via-[#0b0d13]/92 to-[#0b0d13]/50" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(242,192,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(242,192,0,0.5) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
          </div>

          <button
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-black/55 text-on-surface-variant backdrop-blur-sm transition hover:border-white/25 hover:text-on-surface"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]!">
              close
            </span>
          </button>

          <div className="relative flex min-h-[152px] items-stretch sm:min-h-[168px]">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center py-4 pl-4 pr-3">
              <p className="mb-0.5 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-tertiary/90">
                <span aria-hidden className="h-1 w-1 rounded-full bg-tertiary" />
                {labels.eyebrow}
              </p>
              <h2
                id="daily-gift-title"
                className="text-[clamp(1.35rem,5.5vw,1.85rem)] font-semibold leading-tight tracking-tight text-white"
              >
                {labels.title}
              </h2>
              <p className="mt-1.5 text-[11px] leading-snug text-on-surface-variant sm:text-label-sm">
                {labels.subtitle}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span
                  role="progressbar"
                  aria-valuenow={currentDay}
                  aria-valuemin={1}
                  aria-valuemax={total}
                  className="h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-white/10"
                >
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-tertiary/70 to-tertiary transition-[width] duration-500"
                    style={{ width: `${(currentDay / total) * 100}%` }}
                  />
                </span>
                <span className="shrink-0 font-mono text-[10px] text-tertiary">
                  {labels.progress
                    .replace("{current}", String(currentDay))
                    .replace("{total}", String(total))}
                </span>
              </div>
            </div>

            <div
              aria-hidden
              className="gift-lead relative z-[5] flex w-[124px] shrink-0 items-end justify-center self-stretch pt-9 sm:w-[148px]"
            >
              <span className="pointer-events-none absolute inset-x-0 bottom-0 top-8 bg-[radial-gradient(ellipse_at_50%_60%,rgba(242,192,0,0.18),transparent_72%)]" />
              <Image
                src={OAK_GIFT_ART}
                alt=""
                width={280}
                height={300}
                priority
                unoptimized
                className="relative h-[128px] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)] sm:h-[144px]"
              />
            </div>
          </div>
        </div>

        {/* ── Calendario: el único bloque que scrollea ───────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto border-y border-white/[0.07] px-4 py-3">
          <DailyCalendar days={days} labels={labels} compact />
        </div>

        {/* ── Acción, fija abajo ────────────────────────────────────── */}
        <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {claimed ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 rounded-xl border border-tertiary/25 bg-gradient-to-b from-white/[0.06] to-transparent px-3 py-3">
                <span
                  aria-hidden
                  className="material-symbols-outlined text-[20px]! text-emerald-400"
                >
                  check_circle
                </span>
                <span className="text-label-sm text-on-surface">{labels.claimedTitle}</span>
                <RewardList rewards={claimed} size="md" unitLabels={labels.rewards} />
              </div>
              <button
                type="button"
                data-autofocus
                onClick={close}
                className="h-12 w-full rounded-md bg-pokeball-red text-label-md font-bold text-white transition hover:bg-pokeball-red/85"
              >
                {labels.continueLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-autofocus
              onClick={claim}
              disabled={pending}
              className="daily-claim-cta h-12 w-full rounded-md bg-tertiary text-label-md font-bold uppercase tracking-wide text-surface transition hover:bg-tertiary/85 disabled:opacity-60"
            >
              {pending ? labels.claiming : labels.claim}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
