"use client";

const ARC_ORANGE = "#ff4d00";
const ARC_MID = "#ff9f0a";
const ARC_YELLOW = "#ffe566";

/**
 * PC centrado sobre el Pokémon, con el arco de progreso alrededor.
 *
 * El arco no es decorativo: lleva el mismo progreso de rango que la barra de
 * abajo, dibujado con `pathLength="100"` para que el `stroke-dasharray` se pueda
 * expresar directamente en porcentaje sin calcular la longitud real de la curva.
 *
 * El SVG conserva su relación de aspecto (nada de `preserveAspectRatio="none"`):
 * estirado, el trazo engorda de un lado y adelgaza del otro.
 *
 * Glow flúor contenido — halo corto, sin mancha naranja que robe la escena.
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
  /** @deprecated El arco usa naranja flúor fijo. Se ignora. */
  color?: string;
}) {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * 100);
  const gradientId = "cp-arc-fluor";

  return (
    <>
      {/* PC + número: rótulo en Barlow, cifra en Oxanium (ver `.tp-id__cp-*`). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-baseline justify-center gap-2 pt-0.5">
        <p className="tp-id__cp-label text-[0.95rem] uppercase leading-none tracking-[0.22em] text-white/45 sm:text-[1.05rem]">
          {label}
        </p>
        <p className="tp-id__cp-value text-[2.45rem] leading-none tracking-[-0.02em] text-white tabular-nums drop-shadow-[0_3px_14px_rgba(0,0,0,0.7)] sm:text-[2.9rem]">
          {value.toLocaleString()}
        </p>
      </div>

      {/*
        El arco envuelve a las figuras: arranca debajo del número y su cuerda
        cae a la altura de los pies. `xMidYMax meet` conserva la relación de
        aspecto —estirado, el trazo engorda de un lado y adelgaza del otro— y lo
        ancla abajo, que es lo que mantiene las puntas sobre la línea de piso.
      */}
      <svg
        viewBox="0 0 320 150"
        preserveAspectRatio="xMidYMax meet"
        className="pointer-events-none absolute inset-x-0 bottom-2 top-[3.6rem] z-[1] mx-auto w-full max-w-[27rem]"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={ARC_ORANGE} />
            <stop offset="55%" stopColor={ARC_MID} />
            <stop offset="100%" stopColor={ARC_YELLOW} />
          </linearGradient>
        </defs>

        <path
          d="M8 146 A 152 152 0 0 1 312 146"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Halo fino: poco blur, poca opacidad — flúor sin mancha. */}
        <path
          d="M8 146 A 152 152 0 0 1 312 146"
          stroke={ARC_ORANGE}
          strokeWidth="3.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          opacity={0.28}
          style={{ filter: "blur(1.5px)" }}
        />
        <path
          d="M8 146 A 152 152 0 0 1 312 146"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          style={{
            filter: `drop-shadow(0 0 3px ${ARC_ORANGE}66)`,
          }}
        />
      </svg>
    </>
  );
}
