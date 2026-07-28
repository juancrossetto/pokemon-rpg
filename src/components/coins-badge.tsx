"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearPendingCoinDelta,
  COIN_DELTA_EVENT,
  peekPendingCoinDelta,
  type CoinDeltaDetail,
} from "@/lib/coin-fx";

type CoinsBadgeProps = {
  coins: number;
  /** `sm` = barra mobile vieja; `md` = chip desktop; `bar` = valor dentro de ResourcePill. */
  size?: "sm" | "md" | "bar";
  /** Si false, solo anima el número (el ícono vive en la pastilla). */
  showIcon?: boolean;
};

/** ms por moneda cuando el delta es chico — se siente el +1. */
const PREFERRED_MS_PER_COIN = 48;
/** Tope para que un premio grande no tarde una eternidad. */
const MAX_COUNT_MS = 5200;
const MIN_COUNT_MS = 1600;

/**
 * Contador de monedas del header: suma/resta de a 1, lento, para que se vea.
 * Escucha `announceCoinDelta` y también el prop `coins` tras un refresh.
 */
export function CoinsBadge({ coins, size = "md", showIcon = true }: CoinsBadgeProps) {
  const [display, setDisplay] = useState(coins);
  const [fx, setFx] = useState<"up" | "down" | null>(null);
  const [floater, setFloater] = useState<number | null>(null);
  const displayRef = useRef(coins);
  const targetRef = useRef(coins);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const clearFxRef = useRef<number | null>(null);

  function stopTicking() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function tweenTo(target: number, announcedDelta?: number) {
    targetRef.current = target;
    const from = displayRef.current;
    if (from === target) return;

    const delta = target - from;
    const step = delta > 0 ? 1 : -1;
    setFx(step > 0 ? "up" : "down");
    setFloater(announcedDelta ?? delta);

    if (clearFxRef.current) window.clearTimeout(clearFxRef.current);
    stopTicking();

    const abs = Math.abs(delta);
    const duration = Math.min(
      MAX_COUNT_MS,
      Math.max(MIN_COUNT_MS, abs * PREFERRED_MS_PER_COIN),
    );
    const startedAt = performance.now();
    const startFrom = from;

    const frame = (now: number) => {
      const end = targetRef.current;
      const progress = Math.min(1, (now - startedAt) / duration);
      const next =
        progress >= 1 ? end : Math.round(startFrom + (end - startFrom) * progress);

      if (next !== displayRef.current) {
        displayRef.current = next;
        setDisplay(next);
      }

      if (progress >= 1) {
        rafRef.current = null;
        clearPendingCoinDelta();
        clearFxRef.current = window.setTimeout(() => {
          setFx(null);
          setFloater(null);
        }, 900);
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Remount tras revalidate: el saldo del server ya es el final, pero
      // quedó un delta pendiente — arrancamos desde el valor anterior.
      const pending = peekPendingCoinDelta();
      if (pending !== 0) {
        const from = Math.max(0, coins - pending);
        if (from !== coins) {
          displayRef.current = from;
          targetRef.current = coins;
          setDisplay(from);
          tweenTo(coins, pending);
          return;
        }
      }
      displayRef.current = coins;
      targetRef.current = coins;
      setDisplay(coins);
      return;
    }
    tweenTo(coins);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reaccionamos al prop
  }, [coins]);

  useEffect(() => {
    function onDelta(event: Event) {
      const delta = (event as CustomEvent<CoinDeltaDetail>).detail?.delta;
      if (!delta || !Number.isFinite(delta)) return;
      tweenTo(targetRef.current + delta, delta);
    }
    window.addEventListener(COIN_DELTA_EVENT, onDelta);
    return () => window.removeEventListener(COIN_DELTA_EVENT, onDelta);
  }, []);

  useEffect(() => {
    return () => {
      stopTicking();
      if (clearFxRef.current) window.clearTimeout(clearFxRef.current);
    };
  }, []);

  const isSm = size === "sm";
  const isBar = size === "bar";

  return (
    <span
      id={isBar ? undefined : "header-coins"}
      className={`relative inline-flex items-center gap-1 font-mono leading-none text-electric-yellow transition-[box-shadow,transform,color] duration-300 ${
        isBar
          ? "text-[11px] font-semibold text-white sm:text-[12px]"
          : isSm
            ? "px-2 py-1 text-[11px]"
            : "rounded-full border border-electric-yellow/25 bg-electric-yellow/10 px-2.5 py-1 text-label-sm"
      } ${
        fx === "up"
          ? isBar
            ? "scale-[1.04]"
            : "scale-[1.04] text-electric-yellow shadow-[0_0_16px_rgba(242,192,0,0.45)]"
          : fx === "down"
            ? "scale-[1.02] text-pokeball-red"
            : ""
      }`}
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={isBar || undefined}
    >
      {showIcon && (
        <span
          className={`material-symbols-outlined ${
            isBar ? "text-[15px]!" : isSm ? "text-[13px]!" : "text-[16px]!"
          } ${fx === "up" ? "coin-spin-nudge" : ""}`}
        >
          paid
        </span>
      )}
      <span className="tabular-nums font-semibold">{display}</span>
      {floater !== null && floater !== 0 && (
        <span
          key={`${floater}-${fx}`}
          aria-hidden
          className={`coin-delta-float pointer-events-none absolute left-1/2 -top-3.5 -translate-x-1/2 font-bold tabular-nums ${
            isSm || isBar ? "text-[10px]" : "text-[11px]"
          } ${floater > 0 ? "text-electric-yellow" : "text-pokeball-red"}`}
        >
          {floater > 0 ? `+${floater}` : floater}
        </span>
      )}
    </span>
  );
}
