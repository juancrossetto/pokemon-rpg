"use client";

import { useEffect, useState } from "react";
import { formatCountdown, msUntilNextEnergyPoint } from "@/lib/energy";

/**
 * Energía del header con cuenta regresiva al próximo punto.
 *
 * El contador se calcula en el cliente a partir de `energyUpdatedAt` — el mismo
 * dato con el que el servidor deriva la energía actual — así que no hace falta
 * pedir nada: el reloj llega a cero exactamente cuando el servidor daría el
 * punto siguiente.
 *
 * El slot del timer siempre ocupa ancho fijo para que el header no “salte” ni
 * deje un hueco vacío mientras hidrata o cuando la barra está llena (MAX).
 */
export function EnergyMeter({
  energy,
  energyMax,
  energyUpdatedAt,
  pct,
  label,
  fullLabel,
}: {
  energy: number;
  energyMax: number;
  /** ISO: los server components no pueden pasar `Date` a uno de cliente. */
  energyUpdatedAt: string;
  pct: number;
  label: string;
  /** Texto cuando la barra está llena (no hay nada que esperar). */
  fullLabel: string;
}) {
  // `undefined` = todavía sin calcular (SSR y primer frame); `null` = llena.
  const [remaining, setRemaining] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    const updatedAt = new Date(energyUpdatedAt);
    const tick = () => setRemaining(msUntilNextEnergyPoint(energy, energyMax, updatedAt));
    // El primer cálculo va en un frame aparte: llamar a setState de forma
    // síncrona dentro del efecto encadena un render de más (y es justo el
    // antipatrón que marca react-hooks). Un frame es imperceptible.
    const raf = requestAnimationFrame(tick);
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [energy, energyMax, energyUpdatedAt]);

  const isFull = remaining === null;
  const countdown = typeof remaining === "number" ? formatCountdown(remaining) : null;
  const timerText =
    remaining === undefined ? "--:--" : isFull ? "MAX" : (countdown ?? "--:--");

  return (
    <span
      className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono leading-none text-sky-300"
      title={isFull ? fullLabel : countdown ? `${label} · +1 ${countdown}` : label}
      aria-label={`${label}: ${energy}/${energyMax}${countdown ? ` · +1 en ${countdown}` : isFull ? ` · ${fullLabel}` : ""}`}
    >
      <span className="material-symbols-outlined text-[13px]!">bolt</span>
      {energy}
      <span aria-hidden className="h-1 w-5 overflow-hidden rounded-full bg-sky-400/20">
        <span
          className="block h-full rounded-full bg-sky-400/80 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={`min-w-[34px] text-right text-[10px] tabular-nums ${
          isFull ? "font-semibold text-sky-200" : "text-sky-300/85"
        }`}
      >
        {timerText}
      </span>
    </span>
  );
}
