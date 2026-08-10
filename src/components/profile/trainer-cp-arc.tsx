"use client";

import type { CSSProperties } from "react";

/**
 * PC + arco de progreso del banner de perfil.
 *
 * - `value`: cifra centrada bajo el nombre (mismo eje).
 * - `arc`: semicírculo detrás de la escena.
 * Colores = degradé de tipos del compañero (mismo que el nombre).
 */
export function TrainerCpArc({
  label,
  value,
  pct,
  from,
  to,
  mode = "full",
}: {
  label: string;
  value: number;
  /** 0–1. */
  pct: number;
  from: string;
  to: string;
  /** `value` = sólo la cifra; `arc` = sólo el SVG; `full` = ambos. */
  mode?: "full" | "value" | "arc";
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const filled = Math.round(clamped * 100);
  const arcOffset = 100 - filled;
  const gradientId = `cp-arc-${from.replace("#", "")}-${to.replace("#", "")}`;

  const angle = ((180 - 180 * clamped) * Math.PI) / 180;
  const KNOB_CX = 160 + 144 * Math.cos(angle);
  const KNOB_CY = 158 - 144 * Math.sin(angle);

  const mid = from;
  const showValue = mode === "full" || mode === "value";
  const showArc = mode === "full" || mode === "arc";

  return (
    <>
      {showValue ? (
        <div
          className="tp-id__cp pointer-events-none relative z-[3] flex items-center justify-center gap-2.5"
          style={
            {
              "--cp-accent": from,
              "--cp-accent-to": to,
            } as CSSProperties
          }
        >
          <p className="tp-id__cp-label">{label}</p>
          <p className="tp-id__cp-value">{value.toLocaleString()}</p>
        </div>
      ) : null}

      {showArc ? (
        <svg
          viewBox="0 0 320 168"
          preserveAspectRatio="xMidYMax meet"
          className="pointer-events-none absolute inset-x-0 bottom-2 top-0 z-0 mx-auto w-full max-w-[27rem] overflow-visible"
          fill="none"
          aria-hidden
          style={{ "--arc-offset": arcOffset } as CSSProperties}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={from} />
              <stop offset="55%" stopColor={mid} />
              <stop offset="100%" stopColor={to} />
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
            stroke={mid}
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
              filter: `drop-shadow(0 0 3px ${mid}66)`,
              strokeDashoffset: arcOffset,
            }}
          />
          <circle
            className="tp-cp-arc__knob"
            cx={KNOB_CX}
            cy={KNOB_CY}
            r="4.5"
            fill="#ffffff"
            style={{ filter: `drop-shadow(0 0 6px ${to})` }}
          />
        </svg>
      ) : null}
    </>
  );
}
