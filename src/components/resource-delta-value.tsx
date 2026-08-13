"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clearPendingEnergyDelta,
  clearPendingGemDelta,
  ENERGY_DELTA_EVENT,
  GEM_DELTA_EVENT,
  peekPendingEnergyDelta,
  peekPendingGemDelta,
  type ResourceDeltaDetail,
} from "@/lib/resource-fx";
import { pulseLootTarget } from "@/lib/loot-fly-fx";

type Kind = "energy" | "gems";

const FX_MS = 900;
/*
  Energía y gemas se mueven de a poco (comprar 5, 10, 30), al revés que las
  monedas que llegan de a cientos. Con los tiempos de `CoinsBadge` —mínimo
  1600 ms— un +5 tardaba 320 ms por punto: el chip ya había aterrizado y el
  número seguía subiendo. Acá el piso es corto y el ritmo por punto manda.
*/
const PREFERRED_MS_PER_POINT = 80;
const MAX_COUNT_MS = 1800;
const MIN_COUNT_MS = 420;
const MAX_ANIM_JUMP = 200;

const LAST_SHOWN_KEY: Record<Kind, string> = {
  energy: "pokerpg:energy-last-shown",
  gems: "pokerpg:gems-last-shown",
};

function peekPending(kind: Kind): number {
  return kind === "energy" ? peekPendingEnergyDelta() : peekPendingGemDelta();
}

function clearPending(kind: Kind): void {
  if (kind === "energy") clearPendingEnergyDelta();
  else clearPendingGemDelta();
}

function readLastShown(kind: Kind): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_SHOWN_KEY[kind]);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastShown(kind: Kind, n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LAST_SHOWN_KEY[kind], String(n));
  } catch {
    /* private mode */
  }
}

function resolveClientStart(kind: Kind, value: number): number {
  const pending = peekPending(kind);
  if (pending !== 0) return Math.max(0, value - pending);
  const last = readLastShown(kind);
  if (
    last !== null &&
    last !== value &&
    Math.abs(value - last) <= MAX_ANIM_JUMP
  ) {
    return last;
  }
  return value;
}

/**
 * Contador de energía/gemas del header: suma/resta de a 1, como el badge de oro.
 */
export function ResourceDeltaValue({
  kind,
  value,
  suffix,
}: {
  kind: Kind;
  value: number;
  suffix?: ReactNode;
}) {
  const [display, setDisplay] = useState(value);
  const [fx, setFx] = useState<"up" | "down" | null>(null);
  const [floater, setFloater] = useState<number | null>(null);
  const displayRef = useRef(display);
  const targetRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const clearFxRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  function stopTicking() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function commitDisplay(n: number) {
    displayRef.current = n;
    writeLastShown(kind, n);
    setDisplay(n);
  }

  function playFx(delta: number) {
    if (clearFxRef.current) window.clearTimeout(clearFxRef.current);
    setFx(delta > 0 ? "up" : "down");
    setFloater(delta);
    pulseLootTarget(kind);
    clearFxRef.current = window.setTimeout(() => {
      setFx(null);
      setFloater(null);
    }, FX_MS);
  }

  function tweenTo(target: number, announcedDelta?: number) {
    targetRef.current = target;
    const from = displayRef.current;
    if (from === target) {
      clearPending(kind);
      writeLastShown(kind, target);
      if (announcedDelta && announcedDelta !== 0) playFx(announcedDelta);
      return;
    }

    clearPending(kind);
    const delta = target - from;
    playFx(announcedDelta ?? delta);
    stopTicking();

    const abs = Math.abs(delta);
    const duration = Math.min(
      MAX_COUNT_MS,
      Math.max(MIN_COUNT_MS, abs * PREFERRED_MS_PER_POINT),
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
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => {
    const kick = requestAnimationFrame(() => {
      const clientStart = resolveClientStart(kind, value);
      if (clientStart !== displayRef.current) {
        commitDisplay(clientStart);
      }
      const start = displayRef.current;
      const pending = peekPending(kind);

      readyRef.current = true;
      if (pending !== 0 && start !== value) {
        if (pending < 0) {
          // Gasto ya anunciado en otra vista (→ batalla): contar ya.
          tweenTo(value, pending);
          return;
        }
        // Ganancia sembrada: esperar announce/flush (sync con loot / shop).
        targetRef.current = start;
        writeLastShown(kind, start);
        return;
      }
      if (start !== value) {
        tweenTo(value, pending !== 0 ? pending : value - start);
      } else {
        clearPending(kind);
        writeLastShown(kind, value);
      }
    });
    return () => cancelAnimationFrame(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    if (peekPending(kind) !== 0) return;
    if (value === targetRef.current) return;
    const kick = requestAnimationFrame(() => tweenTo(value));
    return () => cancelAnimationFrame(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prop-driven
  }, [value]);

  useEffect(() => {
    const eventName = kind === "energy" ? ENERGY_DELTA_EVENT : GEM_DELTA_EVENT;
    function onDelta(event: Event) {
      const detail = (event as CustomEvent<ResourceDeltaDetail>).detail;
      const delta = detail?.delta;
      if (!delta || !Number.isFinite(delta)) return;
      const from = displayRef.current;
      const server = valueRef.current;
      const knownAfter =
        typeof detail.balanceAfter === "number" &&
        Number.isFinite(detail.balanceAfter)
          ? Math.max(0, detail.balanceAfter)
          : null;

      // Misma regla que CoinsBadge: si el prop todavía no refresheó, contamos
      // desde la pantalla (from + delta). Si el caller pasó balanceAfter, ese
      // es el destino — no esperamos revalidatePath del layout.
      const end =
        knownAfter !== null
          ? knownAfter
          : delta > 0
            ? Math.max(server, from + delta)
            : Math.min(server, from + delta);

      if (from === end) {
        // Remount snappeó al total nuevo: rebobinar y contar de a 1.
        if (knownAfter !== null) {
          const rewind = Math.max(0, end - delta);
          if (rewind !== end) {
            commitDisplay(rewind);
            tweenTo(end, delta);
            return;
          }
        }
        clearPending(kind);
        playFx(delta);
        return;
      }
      tweenTo(end, delta);
    }
    window.addEventListener(eventName, onDelta);
    return () => window.removeEventListener(eventName, onDelta);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kind stable
  }, [kind]);

  useEffect(() => {
    return () => {
      stopTicking();
      if (clearFxRef.current) window.clearTimeout(clearFxRef.current);
    };
  }, []);

  const toneClass =
    fx === "down"
      ? kind === "energy"
        ? "resource-delta-value--energy-spend"
        : "resource-delta-value--gem-spend"
      : fx === "up"
        ? kind === "energy"
          ? "resource-delta-value--energy-gain"
          : "resource-delta-value--gem-gain"
        : "";

  return (
    <span className="relative inline-flex items-baseline gap-0 leading-none">
      <span className={`tabular-nums font-semibold ${toneClass}`.trim()}>
        {display.toLocaleString()}
      </span>
      {suffix}
      {floater !== null && floater !== 0 ? (
        <span
          key={`${floater}-${fx}`}
          aria-hidden
          className={`coin-delta-float pointer-events-none absolute left-1/2 -top-3.5 -translate-x-1/2 text-[10px] font-bold tabular-nums ${
            floater > 0
              ? kind === "energy"
                ? "text-sky-300"
                : "text-[#e879f9]"
              : kind === "energy"
                ? "text-[#38bdf8]"
                : "text-[#e879f9]"
          }`}
        >
          {floater > 0 ? `+${floater}` : floater}
        </span>
      ) : null}
    </span>
  );
}
