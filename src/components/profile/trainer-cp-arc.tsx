"use client";

/**
 * PC centrado sobre el Pokémon, con el arco de progreso alrededor.
 *
 * El arco no es decorativo: lleva el mismo progreso de rango que la barra de
 * abajo, dibujado con `pathLength="100"` para que el `stroke-dasharray` se pueda
 * expresar directamente en porcentaje sin calcular la longitud real de la curva.
 *
 * El SVG conserva su relación de aspecto (nada de `preserveAspectRatio="none"`):
 * estirado, el trazo engorda de un lado y adelgaza del otro.
 */
export function TrainerCpArc({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  /** 0–1. */
  pct: number;
  color: string;
}) {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * 100);
  const gradientId = "cp-arc-gradient";

  return (
    <>
      {/* El número arriba de todo; la escena se baja para no chocarlo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex flex-col items-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">{label}</p>
        <p className="font-mono text-[2.35rem] font-black leading-none tracking-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.7)] sm:text-[2.75rem]">
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
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <path
          d="M8 146 A 152 152 0 0 1 312 146"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M8 146 A 152 152 0 0 1 312 146"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          style={{ filter: `drop-shadow(0 0 6px ${color}99)` }}
        />
      </svg>
    </>
  );
}
