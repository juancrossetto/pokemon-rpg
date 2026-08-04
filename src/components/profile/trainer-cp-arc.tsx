"use client";

import type { CSSProperties } from "react";

const ARC_FROM = "#1a6dff";
const ARC_MID = "#2eb8ff";
const ARC_TO = "#5ef0ff";

/**
 * PC centrado sobre el Pokémon, con el arco de progreso alrededor.
 *
 * Glow fluor celeste (hub PvP), sin naranja hardcodeado.
 * El trazo se dibuja al montar (ver `.tp-cp-arc__*` en globals.css).
 */
export function TrainerCpArc({
  label,
  value,
  pct,
}: {
  label: string;
  value: number;
  /** 0–1. */
  pct: number;
  /** @deprecated Se ignora. */
  color?: string;
}) {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * 100);
  const arcOffset = 100 - filled;
  const gradientId = "cp-arc-fluor";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-baseline justify-center gap-2 pt-0.5">
        <p className="tp-id__cp-label text-[1.45rem] uppercase leading-none tracking-[0.16em] text-white/60 sm:text-[1.65rem]">
          {label}
        </p>
        <p className="tp-id__cp-value text-[2.45rem] leading-none tracking-[-0.02em] text-white tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-[2.9rem]">
          {value}
        </p>
      </div>

      <svg
        viewBox="0 0 320 168"
        preserveAspectRatio="xMidYMax meet"
        className="pointer-events-none absolute inset-x-0 bottom-2 top-0 z-[1] mx-auto w-full max-w-[27rem] overflow-visible"
        fill="none"
        aria-hidden
        style={{ "--arc-offset": arcOffset } as CSSProperties}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={ARC_FROM} />
            <stop offset="55%" stopColor={ARC_MID} />
            <stop offset="100%" stopColor={ARC_TO} />
          </linearGradient>
        </defs>

        <path
          className="tp-cp-arc__track"
          d="M16 158 A 142 142 0 0 1 304 158"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          className="tp-cp-arc__glow"
          d="M16 158 A 142 142 0 0 1 304 158"
          stroke={ARC_MID}
          strokeWidth="3.5"
          strokeLinecap="round"
          pathLength={100}
          opacity={0.28}
          style={{
            filter: "blur(1.5px)",
            strokeDashoffset: arcOffset,
          }}
        />
        <path
          className="tp-cp-arc__fill"
          d="M16 158 A 142 142 0 0 1 304 158"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={100}
          style={{
            filter: `drop-shadow(0 0 3px ${ARC_MID}66)`,
            strokeDashoffset: arcOffset,
          }}
        />
      </svg>
    </>
  );
}
