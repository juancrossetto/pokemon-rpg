"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { claimDailyReward } from "@/actions/claim-reward";
import { flushPendingCoinDelta, seedPendingCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import type { CalendarLabels } from "@/components/events/daily-calendar";
import {
  DailyRewardStrip,
  type StripLabels,
} from "@/components/events/daily-reward-strip";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import type { RewardDef } from "@/lib/events/rewards";
import type { DailyDayState } from "@/lib/events/state";
import {
  DAILY_GIFT_OPEN_EVENT,
  DAILY_GIFT_SEEN_KEY,
  openDailyRewardModal,
} from "@/lib/daily-gift-fx";

export { openDailyRewardModal };

const COIN_BUNDLE_HD = "/items/hd/poke-coin-bundle-s.png";
const ENERGY_HD = "/items/hd/energy.png";

const HOLD_MS = 950;
const FLY_MS = 620;

type LootVisual = {
  src: string;
  amount: string;
  pixelated: boolean;
  target: "coins" | "energy" | "gems" | "inventory";
};

function lootVisual(reward: RewardDef): LootVisual {
  if (reward.kind === "item") {
    const hd = itemHdIconUrl(reward.itemName);
    return {
      src: hd ?? itemSpriteUrl(reward.itemName),
      amount: `×${reward.quantity}`,
      pixelated: !hd,
      target: "inventory",
    };
  }
  if (reward.kind === "coins") {
    return {
      src: COIN_BUNDLE_HD,
      amount: reward.amount.toLocaleString(),
      pixelated: false,
      target: "coins",
    };
  }
  if (reward.kind === "energy") {
    return {
      src: ENERGY_HD,
      amount: reward.amount.toLocaleString(),
      pixelated: false,
      target: "energy",
    };
  }
  return {
    src: COIN_BUNDLE_HD,
    amount: reward.amount.toLocaleString(),
    pixelated: false,
    target: "gems",
  };
}

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

/** Destino del vuelo: pastilla de recurso o link de inventario. */
function resolveLootTarget(kind: LootVisual["target"]): { x: number; y: number } {
  if (kind === "coins" || kind === "energy" || kind === "gems") {
    const pill = document.querySelector(`[data-loot-target="${kind}"]`);
    if (pill && isVisible(pill)) {
      const r = pill.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  const inv = [...document.querySelectorAll<HTMLElement>('a[href*="/inventory"]')].find(
    isVisible,
  );
  if (inv) {
    const r = inv.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Mobile: tab Colección (mochila vive ahí) o esquina inferior derecha.
  const collection = document.querySelector<HTMLElement>(
    '[data-nav-group="collection"], a[href*="/team"]',
  );
  if (collection && isVisible(collection)) {
    const r = collection.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  return {
    x: window.innerWidth * 0.82,
    y: window.innerHeight * 0.92,
  };
}

/** Destello breve en la pastilla del header cuando llega el loot. */
function pulseLootTarget(kind: LootVisual["target"]): void {
  if (kind !== "coins" && kind !== "energy" && kind !== "gems") return;
  const pill = document.querySelector(`[data-loot-target="${kind}"]`);
  if (!pill) return;
  pill.classList.remove("loot-target-pulse");
  // Re-trigger CSS animation.
  void (pill as HTMLElement).offsetWidth;
  pill.classList.add("loot-target-pulse");
  window.setTimeout(() => pill.classList.remove("loot-target-pulse"), 900);
}

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

const SEEN_KEY = DAILY_GIFT_SEEN_KEY;

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
      className={`h-[14px] w-[56px] shrink-0 text-pokeball-red drop-shadow-[0_0_6px_color-mix(in_srgb,var(--color-pokeball-red)_70%,transparent)] sm:h-4 sm:w-[72px] ${
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
 * Al reclamar se cierra el banner y se muestra un reveal compacto del loot.
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
  const [loot, setLoot] = useState<RewardDef[] | null>(null);
  const [lootPhase, setLootPhase] = useState<"hold" | "fly">("hold");
  const [flyStyle, setFlyStyle] = useState<CSSProperties>({});
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const lootOrbRef = useRef<HTMLDivElement>(null);
  const pendingCoinsRef = useRef(0);
  const lootDoneRef = useRef(false);
  const bannerOpen = isClient && !seen && loot === null;

  useEffect(() => {
    if (!isClient || typeof window === "undefined") return;

    function consumeDailyQuery() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("daily") !== "1") return;
      reopen();
      params.delete("daily");
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }

    function onOpenEvent() {
      reopen();
    }

    consumeDailyQuery();
    window.addEventListener(DAILY_GIFT_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener(DAILY_GIFT_OPEN_EVENT, onOpenEvent);
    };
  }, [isClient]);

  useEffect(() => {
    if (!bannerOpen) return;

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
  }, [bannerOpen, pending]);

  useEffect(() => {
    if (!loot) return;
    lootDoneRef.current = false;

    function finish() {
      if (lootDoneRef.current) return;
      lootDoneRef.current = true;
      // Por si el flush del vuelo no corrió (Escape / reduced motion).
      if (pendingCoinsRef.current !== 0) {
        flushPendingCoinDelta();
        pendingCoinsRef.current = 0;
      }
      setLoot(null);
      setLootPhase("hold");
      setFlyStyle({});
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let holdTimer = 0;
    let flyTimer = 0;
    const raf = requestAnimationFrame(() => {
      setLootPhase("hold");
      holdTimer = window.setTimeout(() => {
        if (reduced) {
          finish();
          return;
        }
        const orb = lootOrbRef.current?.getBoundingClientRect();
        const visual = lootVisual(loot[0]);
        const target = resolveLootTarget(visual.target);
        if (orb) {
          const cx = orb.left + orb.width / 2;
          const cy = orb.top + orb.height / 2;
          setFlyStyle({
            ["--loot-dx" as string]: `${target.x - cx}px`,
            ["--loot-dy" as string]: `${target.y - cy}px`,
          });
        }
        setLootPhase("fly");
        // El contador del header arranca cuando el loot sale hacia la pastilla.
        if (pendingCoinsRef.current !== 0) {
          flushPendingCoinDelta();
          pendingCoinsRef.current = 0;
        }
        pulseLootTarget(visual.target);
        flyTimer = window.setTimeout(() => finish(), FLY_MS);
      }, HOLD_MS);
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(holdTimer);
      window.clearTimeout(flyTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [loot]);

  function claim() {
    if (pending) return;
    startTransition(async () => {
      const result = await claimDailyReward(locale);
      if (!result.ok) {
        showToast(labels.claimedTitle, "info");
        markSeen();
        return;
      }
      markSeen();
      pendingCoinsRef.current = result.coinsDelta;
      if (result.coinsDelta !== 0) seedPendingCoinDelta(result.coinsDelta);
      lootDoneRef.current = false;
      setLootPhase("hold");
      setFlyStyle({});
      setLoot(result.granted);
    });
  }

  function closeBanner() {
    markSeen();
  }

  function finishLoot() {
    if (lootDoneRef.current) return;
    lootDoneRef.current = true;
    if (pendingCoinsRef.current !== 0) {
      flushPendingCoinDelta();
      pendingCoinsRef.current = 0;
    }
    setLoot(null);
    setLootPhase("hold");
    setFlyStyle({});
  }

  if (!isClient) return null;

  if (loot) {
    const primary = lootVisual(loot[0]);
    const extras = loot.slice(1).map(lootVisual);

    return createPortal(
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        role="presentation"
      >
        <button
          type="button"
          aria-label={labels.close}
          onClick={finishLoot}
          className="market-sheet-backdrop-in absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-loot-title"
          className="pointer-events-none relative flex flex-col items-center"
        >
          <h2 id="daily-loot-title" className="sr-only">
            {labels.claimedTitle}
          </h2>
          <div
            ref={lootOrbRef}
            className={`daily-reward-loot-orb ${
              lootPhase === "fly" ? "is-flying" : "is-holding"
            }`}
            style={flyStyle}
          >
            <span aria-hidden className="daily-reward-loot-glow" />
            <span aria-hidden className="daily-reward-loot-ring" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <Image
                src={primary.src}
                alt=""
                width={160}
                height={160}
                className={[
                  "h-28 w-28 object-contain sm:h-32 sm:w-32",
                  primary.pixelated ? "[image-rendering:pixelated]" : "",
                ].join(" ")}
                unoptimized
              />
              <span className="daily-reward-loot-qty font-mono text-[1.35rem] font-bold tabular-nums text-white sm:text-[1.5rem]">
                {primary.amount}
              </span>
              {extras.length > 0 && (
                <ul className="mt-1 flex items-center justify-center gap-3">
                  {extras.map((extra, index) => (
                    <li key={`${extra.src}-${index}`} className="flex flex-col items-center gap-1">
                      <Image
                        src={extra.src}
                        alt=""
                        width={56}
                        height={56}
                        className={[
                          "h-12 w-12 object-contain",
                          extra.pixelated ? "[image-rendering:pixelated]" : "",
                        ].join(" ")}
                        unoptimized
                      />
                      <span className="font-mono text-[12px] font-bold tabular-nums text-white/90">
                        {extra.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!bannerOpen) {
    if (!showChip) return null;
    return (
      <button
        type="button"
        onClick={reopen}
        className="gift-chip mb-4 inline-flex max-w-full items-center gap-2 rounded-md border border-pokeball-red/40 bg-pokeball-red/10 py-1.5 pl-1.5 pr-3 text-left transition hover:border-pokeball-red/60 hover:bg-pokeball-red/16"
      >
        <Image
          src="/nav/event-icon.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          aria-hidden
        />
        <span className="min-w-0 truncate text-label-sm text-electric-yellow/90">
          {labels.reopen}
        </span>
        <span
          aria-hidden
          className="material-symbols-outlined shrink-0 text-[16px]! text-pokeball-red"
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
        onClick={closeBanner}
        className="market-sheet-backdrop-in absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-gift-title"
        className="gift-modal-in daily-reward-popup relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-pokeball-red/45 shadow-[0_0_48px_color-mix(in_srgb,var(--color-pokeball-red)_28%,transparent),0_28px_90px_rgba(0,0,0,0.7)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 daily-reward-popup-bg"
        />

        <button
          type="button"
          onClick={closeBanner}
          aria-label={labels.close}
          className="absolute right-1.5 top-1.5 z-30 grid h-7 w-7 place-items-center text-electric-yellow transition hover:text-electric-yellow/80 sm:right-3 sm:top-3 sm:h-10 sm:w-10"
        >
          <span
            aria-hidden
            className="material-symbols-outlined text-[18px]! font-bold drop-shadow-[0_0_8px_color-mix(in_srgb,var(--color-electric-yellow)_65%,transparent)] sm:text-[28px]!"
          >
            close
          </span>
        </button>

        <div className="relative shrink-0 px-4 pb-0 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <TitleFlourish side="left" />
            <h2
              id="daily-gift-title"
              className="daily-reward-title text-center text-[clamp(1.55rem,4.5vw,2.15rem)] text-pokeball-red"
            >
              {labels.title}
            </h2>
            <TitleFlourish side="right" />
          </div>
          <p className="daily-reward-subtitle mt-2 text-center text-[13px] text-white/90 sm:text-[15px]">
            {labels.subtitle}
          </p>
          <p className="sr-only">
            {labels.progress
              .replace("{current}", String(currentDay))
              .replace("{total}", String(total))}
          </p>
        </div>

        <div className="relative px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-5">
          <DailyRewardStrip
            days={days}
            labels={labels}
            onClaimToday={pending ? undefined : claim}
            claiming={pending}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
