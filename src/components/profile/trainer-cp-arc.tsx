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
  const clamped = Math.max(0, Math.min(1, pct));
  const filled = Math.round(clamped * 100);
  const arcOffset = 100 - filled;
  const gradientId = "cp-arc-fluor";

  const angle = ((180 - 180 * clamped) * Math.PI) / 180;
  const KNOB_CX = 160 + 144 * Math.cos(angle);
  const KNOB_CY = 158 - 144 * Math.sin(angle);

  return (
    <>
      {/*
        Label + cifra como un solo bloque flúor (misma jerarquía). El arco va
        detrás de la escena (z-0); este bloque encima (z-3).
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-baseline justify-center gap-2 pt-0.5">
        <p className="tp-id__cp-label text-[1.85rem] uppercase leading-none tracking-[0.08em] sm:text-[2.15rem]">
          {label}
        </p>
        <p className="tp-id__cp-value text-[1.85rem] leading-none tracking-[-0.02em] tabular-nums sm:text-[2.15rem]">
          {value.toLocaleString()}
        </p>
      </div>

      <svg
        viewBox="0 0 320 168"
        preserveAspectRatio="xMidYMax meet"
        /* Detrás del Pokémon/entrenador (z-0); la escena va en z-2. */
        className="pointer-events-none absolute inset-x-0 bottom-2 top-[2.1rem] z-0 mx-auto w-full max-w-[27rem] overflow-visible sm:top-[2.35rem]"
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
        {/*
          Perilla en la punta del recorrido. Sin ella el arco es un adorno: el
          punto es lo que dice "vas por acá" y convierte el trazo en un
          medidor. La posición se calcula, no se aproxima — el arco es una
          semicircunferencia de centro (160,158) y radio 144 (los extremos
          están a 288 de distancia, así que el navegador escala el radio de 142
          al mínimo que los une), y el barrido va de 180° a 0°.
        */}
        <circle
          className="tp-cp-arc__knob"
          cx={KNOB_CX}
          cy={KNOB_CY}
          r="4.5"
          fill="#ffffff"
          style={{ filter: `drop-shadow(0 0 6px ${ARC_TO})` }}
        />
      </svg>
    </>
  );
}
