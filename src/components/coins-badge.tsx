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
/** Saltos mayores (admin / sync raro) se snappean sin animar. */
const MAX_ANIM_JUMP = 50_000;

const LAST_SHOWN_KEY = "pokerpg:coins-last-shown";

function readLastShown(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_SHOWN_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastShown(n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LAST_SHOWN_KEY, String(n));
  } catch {
    /* private mode */
  }
}

function initialDisplay(coins: number): number {
  if (typeof window === "undefined") return coins;
  const pending = peekPendingCoinDelta();
  if (pending !== 0) return Math.max(0, coins - pending);
  const last = readLastShown();
  if (
    last !== null &&
    last !== coins &&
    Math.abs(coins - last) <= MAX_ANIM_JUMP
  ) {
    return last;
  }
  return coins;
}

/**
 * Contador de monedas del header: suma/resta de a 1.
 *
 * Escucha `announceCoinDelta` y el prop `coins` tras un refresh. Si el layout
 * se remonta con el total nuevo *antes* del anuncio (carrera con
 * `revalidatePath(..., "layout")`), anima desde el último valor mostrado.
 */
export function CoinsBadge({ coins, size = "md", showIcon = true }: CoinsBadgeProps) {
  const [display, setDisplay] = useState(() => initialDisplay(coins));
  const [fx, setFx] = useState<"up" | "down" | null>(null);
  const [floater, setFloater] = useState<number | null>(null);
  const displayRef = useRef(display);
  const targetRef = useRef(coins);
  const rafRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const clearFxRef = useRef<number | null>(null);

  function stopTicking() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function commitDisplay(n: number) {
    displayRef.current = n;
    writeLastShown(n);
    setDisplay(n);
  }

  function tweenTo(target: number, announcedDelta?: number) {
    targetRef.current = target;
    const from = displayRef.current;
    if (from === target) {
      clearPendingCoinDelta();
      writeLastShown(target);
      return;
    }

    clearPendingCoinDelta();

    const delta = target - from;
    const abs = Math.abs(delta);
    setFx(delta > 0 ? "up" : "down");
    setFloater(announcedDelta ?? delta);

    if (clearFxRef.current) window.clearTimeout(clearFxRef.current);
    stopTicking();

    const duration = Math.min(
      MAX_COUNT_MS,
      Math.max(MIN_COUNT_MS, abs * PREFERRED_MS_PER_COIN),
    );
    const msPerStep = duration / abs;
    let current = from;
    let acc = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const end = targetRef.current;
      const dir = end >= current ? 1 : -1;
      acc += now - last;
      last = now;

      while (acc >= msPerStep && current !== end) {
        acc -= msPerStep;
        current += dir;
      }
      if ((dir > 0 && current > end) || (dir < 0 && current < end)) {
        current = end;
      }

      if (current !== displayRef.current) {
        commitDisplay(current);
      }

      if (current === end) {
        rafRef.current = null;
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
    const start = displayRef.current;
    const pending = peekPendingCoinDelta();

    const kick = requestAnimationFrame(() => {
      readyRef.current = true;
      if (pending !== 0 && start !== coins) {
        // Saldo server ya incluye el premio, pero el FX todavía no: quedamos
        // en `start` hasta announce/flush (sync con el vuelo del loot).
        targetRef.current = start;
        writeLastShown(start);
        return;
      }
      if (start !== coins) {
        tweenTo(coins, pending !== 0 ? pending : coins - start);
      } else {
        clearPendingCoinDelta();
        writeLastShown(coins);
      }
    });
    return () => cancelAnimationFrame(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    if (peekPendingCoinDelta() !== 0) return;
    if (coins === targetRef.current) return;
    const kick = requestAnimationFrame(() => tweenTo(coins));
    return () => cancelAnimationFrame(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prop-driven
  }, [coins]);

  useEffect(() => {
    function onDelta(event: Event) {
      const delta = (event as CustomEvent<CoinDeltaDetail>).detail?.delta;
      if (!delta || !Number.isFinite(delta)) return;
      const from = displayRef.current;
      // Si el prop ya trae el premio (revalidate temprano), animamos hasta
      // ese total. Si todavía no, sumamos el delta al valor en pantalla.
      const end =
        delta > 0 ? Math.max(coins, from + delta) : Math.min(coins, from + delta);
      if (from === end) {
        clearPendingCoinDelta();
        setFx(delta > 0 ? "up" : "down");
        setFloater(delta);
        if (clearFxRef.current) window.clearTimeout(clearFxRef.current);
        clearFxRef.current = window.setTimeout(() => {
          setFx(null);
          setFloater(null);
        }, 900);
        return;
      }
      tweenTo(end, delta);
    }
    window.addEventListener(COIN_DELTA_EVENT, onDelta);
    return () => window.removeEventListener(COIN_DELTA_EVENT, onDelta);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coins kept fresh
  }, [coins]);

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
