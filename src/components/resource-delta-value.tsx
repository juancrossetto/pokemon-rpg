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

/**
 * Valor del chip de energía/gemas con flash de gasto/ganancia + floater.
 */
export function ResourceDeltaValue({
  kind,
  value,
  suffix,
}: {
  kind: Kind;
  value: number;
  /** Texto fijo tras el número (ej. `/30` de energía). */
  suffix?: ReactNode;
}) {
  const [fx, setFx] = useState<"up" | "down" | null>(null);
  const [floater, setFloater] = useState<number | null>(null);
  const clearRef = useRef<number | null>(null);
  const readyRef = useRef(false);

  function playFlash(delta: number) {
    if (clearRef.current) window.clearTimeout(clearRef.current);
    setFx(delta > 0 ? "up" : "down");
    setFloater(delta);
    if (kind === "energy") clearPendingEnergyDelta();
    else clearPendingGemDelta();
    pulseLootTarget(kind);
    clearRef.current = window.setTimeout(() => {
      setFx(null);
      setFloater(null);
    }, FX_MS);
  }

  useEffect(() => {
    const kick = requestAnimationFrame(() => {
      readyRef.current = true;
      const pending =
        kind === "energy" ? peekPendingEnergyDelta() : peekPendingGemDelta();
      if (pending !== 0) playFlash(pending);
    });
    return () => cancelAnimationFrame(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    const eventName = kind === "energy" ? ENERGY_DELTA_EVENT : GEM_DELTA_EVENT;
    function onDelta(event: Event) {
      const delta = (event as CustomEvent<ResourceDeltaDetail>).detail?.delta;
      if (!delta || !Number.isFinite(delta)) return;
      playFlash(delta);
    }
    window.addEventListener(eventName, onDelta);
    return () => window.removeEventListener(eventName, onDelta);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kind stable
  }, [kind]);

  useEffect(() => {
    return () => {
      if (clearRef.current) window.clearTimeout(clearRef.current);
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
        {value.toLocaleString()}
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
