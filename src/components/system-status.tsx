"use client";

import { useEffect, useState } from "react";

export function SystemStatus({
  timeLabel,
  climateLabel,
  climateValue,
  climateIcon,
}: {
  timeLabel: string;
  climateLabel: string;
  climateValue: string;
  climateIcon: string;
}) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    // Card "informativa": es el dato de menor jerarquía de la Home, así que en
    // mobile va a una sola línea sin etiquetas ni segundos. Desde sm recupera
    // el formato de dos líneas que ya tenía en desktop.
    <div className="flex items-stretch divide-x divide-white/10 rounded-lg border border-white/10 bg-surface-container-low/60">
      <div className="px-2 py-1 text-right sm:px-4 sm:py-1.5">
        <p className="hidden text-[10px] uppercase tracking-wider text-on-surface-variant/70 sm:block">
          {timeLabel}
        </p>
        <p className="flex items-center gap-1 font-mono text-[12px] tabular-nums text-white sm:text-[13px]">
          <span className="material-symbols-outlined text-[13px]! text-on-surface-variant sm:hidden">
            schedule
          </span>
          {/* Sin segundos en mobile: sólo suman ruido y ancho. */}
          <span className="sm:hidden">{time ? time.slice(0, 5) : "--:--"}</span>
          <span className="hidden sm:inline">{time ?? "--:--:--"}</span>
        </p>
      </div>
      <div className="px-2 py-1 text-right sm:px-4 sm:py-1.5">
        <p className="hidden text-[10px] uppercase tracking-wider text-on-surface-variant/70 sm:block">
          {climateLabel}
        </p>
        <p className="flex items-center justify-end gap-1 text-[12px] font-medium text-white sm:text-[13px]">
          <span className="material-symbols-outlined text-[13px]! text-sky-300 sm:text-[14px]!">
            {climateIcon}
          </span>
          {climateValue}
        </p>
      </div>
    </div>
  );
}
