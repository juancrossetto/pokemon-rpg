"use client";

import { RewardList } from "@/components/events/reward-chip";
import type { DailyDayState } from "@/lib/events/state";

export type CalendarLabels = {
  /** Con `{day}` sin interpolar. */
  dailyDay: string;
  statusToday: string;
  statusClaimed: string;
  statusUpcoming: string;
  rewards: { coins: string; energy: string; item: string };
};

/**
 * Calendario del regalo diario (grilla clásica).
 *
 * Sigue en el Event Hub. El modal de bienvenida usa `DailyRewardStrip` (popup
 * horizontal); esta grilla se conserva para fusionar ambos más adelante.
 *
 * Cuatro columnas en mobile y siete desde `sm`: una grilla de 7 en 320px deja
 * casilleros de 38px, donde no entra ni el número ni el sprite.
 */
export function DailyCalendar({
  days,
  labels,
  compact = false,
}: {
  days: DailyDayState[];
  labels: CalendarLabels;
  /** `true` en el modal, donde el alto disponible es menor. */
  compact?: boolean;
}) {
  return (
    <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {days.map((day) => {
        const isToday = day.status === "today";
        const isClaimed = day.status === "claimed";
        const statusLabel = isToday
          ? labels.statusToday
          : isClaimed
            ? labels.statusClaimed
            : labels.statusUpcoming;

        const isFinal = day.variant === "final";
        const isSpecial = day.variant === "special";

        return (
          <li
            key={day.day}
            className={`day-cell relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border p-1.5 text-center ${
              // Alto fijo (no min-h): el día final trae varios premios y con
              // altura fluida estiraba la fila entera y rompía la grilla.
              compact ? "h-[68px]" : "h-[76px]"
            } ${
              isToday
                ? "day-today border-[color-mix(in_srgb,var(--ev-accent)_70%,transparent)] bg-[#12141c]"
                : isClaimed
                  ? "border-white/[0.06] bg-[#0e1016] opacity-55"
                  : isFinal
                    ? "border-electric-yellow/40 bg-[#12141c]"
                    : isSpecial
                      ? "border-[color-mix(in_srgb,var(--ev-accent)_35%,transparent)] bg-[#12141c]"
                      : "border-white/[0.08] bg-[#12141c]"
            }`}
          >
            {/* Brillo superior: da volumen a la celda sin sumar otro borde. */}
            {!isClaimed && (
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-px ${
                  isToday
                    ? "bg-gradient-to-r from-transparent via-tertiary/70 to-transparent"
                    : isFinal
                      ? "bg-gradient-to-r from-transparent via-electric-yellow/60 to-transparent"
                      : "bg-gradient-to-r from-transparent via-white/12 to-transparent"
                }`}
              />
            )}

            <span
              className={`font-mono text-[9px] uppercase tracking-wide ${
                isToday ? "text-tertiary" : "text-on-surface-variant/70"
              }`}
            >
              {labels.dailyDay.replace("{day}", String(day.day))}
            </span>

            <span className={isClaimed ? "opacity-45 grayscale" : undefined}>
              <RewardList
                rewards={day.rewards}
                size="sm"
                unitLabels={labels.rewards}
                layout="calendar"
              />
            </span>

            {isClaimed && (
              // Disco sólido en vez de un check suelto: se lee de un vistazo
              // cuáles ya cobraste al recorrer la grilla.
              <span
                aria-hidden
                className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-tertiary"
              >
                <span className="material-symbols-outlined text-[11px]! leading-none text-surface">
                  check
                </span>
              </span>
            )}
            {/* El estado nunca depende solo del color o del borde. */}
            <span className="sr-only">{statusLabel}</span>
          </li>
        );
      })}
    </ul>
  );
}
