"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { claimDailyReward } from "@/actions/claim-reward";
import { announceCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import type { CalendarLabels } from "@/components/events/daily-calendar";
import {
  DailyRewardStrip,
  type StripLabels,
} from "@/components/events/daily-reward-strip";
import { RewardList } from "@/components/events/reward-chip";
import type { RewardDef } from "@/lib/events/rewards";
import type { DailyDayState } from "@/lib/events/state";

export type GiftModalLabels = CalendarLabels &
  StripLabels & {
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
 * Dos stores:
 * - `isClient`: false en SSR/hidratación → no pintamos ni modal ni chip.
 * - `seen`: lee sessionStorage sólo en cliente.
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

/** Store vacío: false en SSR, true en cliente (React re-render post-hidratación). */
function subscribeClient(): () => void {
  return () => {};
}

function TitleFlourish({ side }: { side: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 72 18"
      className={`h-[14px] w-[56px] shrink-0 text-[#ff8a00] drop-shadow-[0_0_6px_rgba(255,138,0,0.7)] sm:h-4 sm:w-[72px] ${
        side === "right" ? "scale-x-[-1]" : ""
      }`}
    >
      <path
        d="M1 9h22M23 9h14l6-5M37 9l6 5M50 4v10M56 9h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect x="64" y="6" width="6" height="6" fill="currentColor" transform="rotate(45 67 9)" />
    </svg>
  );
}

/**
 * Modal del regalo diario (popup horizontal tipo Daily Reward).
 *
 * Se abre **una sola vez por sesión** cuando hay un regalo sin reclamar.
 * La grilla clásica (`DailyCalendar` + cabecera Oak) se conserva en Eventos
 * para fusionar más adelante; acá vive el strip nuevo.
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
  showChip?: boolean;
}) {
  const isClient = useSyncExternalStore(subscribeClient, () => true, () => false);
  const seen = useSyncExternalStore(subscribe, wasSeen, () => true);
  const [claimed, setClaimed] = useState<RewardDef[] | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = (isClient && !seen) || claimed !== null;

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
        showToast(labels.claimedTitle, "info");
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

  if (!isClient) return null;

  if (!open) {
    if (!showChip) return null;
    return (
      <button
        type="button"
        onClick={reopen}
        className="gift-chip mb-4 inline-flex max-w-full items-center gap-2 rounded-md border border-[#ff8a00]/40 bg-[#ff8a00]/10 py-1.5 pl-1.5 pr-3 text-left transition hover:border-[#ff8a00]/60 hover:bg-[#ff8a00]/16"
      >
        <Image
          src="/nav/event-icon.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          aria-hidden
        />
        <span className="min-w-0 truncate text-label-sm text-[#ffe0a8]">
          {labels.reopen}
        </span>
        <span
          aria-hidden
          className="material-symbols-outlined shrink-0 text-[16px]! text-[#ff8a00]"
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
        className="gift-modal-in daily-reward-popup relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#ff8a00]/40 shadow-[0_0_48px_rgba(255,138,0,0.22),0_28px_90px_rgba(0,0,0,0.7)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a2744] via-[#101a30] to-[#0a1224]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(255,138,0,0.22),transparent_50%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#ff9a1a] to-transparent"
        />

        <button
          type="button"
          onClick={close}
          aria-label={labels.close}
          className="absolute right-2.5 top-2.5 z-30 grid h-10 w-10 place-items-center text-[#f2c000] transition hover:text-[#ffe066] sm:right-3 sm:top-3"
        >
          <span aria-hidden className="material-symbols-outlined text-[28px]! font-bold drop-shadow-[0_0_8px_rgba(242,192,0,0.65)]">
            close
          </span>
        </button>

        <div className="relative shrink-0 px-4 pb-0 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <TitleFlourish side="left" />
            <h2
              id="daily-gift-title"
              className="daily-reward-title text-center text-[clamp(1.55rem,4.5vw,2.15rem)] font-black uppercase tracking-[0.04em] text-[#ff9a1a]"
            >
              {labels.title}
            </h2>
            <TitleFlourish side="right" />
          </div>
          <p className="mt-2 text-center text-[13px] text-white/90 sm:text-[15px]">
            {labels.subtitle}
          </p>
          <p className="sr-only">
            {labels.progress
              .replace("{current}", String(currentDay))
              .replace("{total}", String(total))}
          </p>
        </div>

        <div className="relative px-3 py-4 sm:px-7 sm:py-5">
          <DailyRewardStrip days={days} labels={labels} />
        </div>

        <div className="relative shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:px-8">
          {claimed ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-[#ff8a00]/30 bg-gradient-to-b from-[#ff8a00]/10 to-transparent px-3 py-3">
                <span
                  aria-hidden
                  className="material-symbols-outlined text-[20px]! text-[#ff8a00]"
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
                className="h-12 w-full rounded-lg bg-pokeball-red text-label-md font-bold text-white transition hover:bg-pokeball-red/85"
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
              className="daily-claim-cta h-12 w-full rounded-lg bg-gradient-to-b from-[#ffb000] to-[#ff7a00] text-label-md font-black uppercase tracking-wide text-[#1a1200] shadow-[0_0_24px_rgba(255,138,0,0.4)] transition hover:brightness-110 disabled:opacity-60"
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
