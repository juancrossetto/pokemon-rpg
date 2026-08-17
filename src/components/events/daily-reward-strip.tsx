"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { RewardList } from "@/components/events/reward-chip";
import type { CalendarLabels } from "@/components/events/daily-calendar";
import type { DailyDayState } from "@/lib/events/state";

export type StripLabels = CalendarLabels & {
  badgeSpecial: string;
  badgeRare: string;
};

const WINDOW = 6;

/** Ventana de 6 días centrada en el actual (como el popup de referencia). */
function visibleDays(days: DailyDayState[]): DailyDayState[] {
  if (days.length <= WINDOW) return days;
  const todayIdx = Math.max(
    0,
    days.findIndex((d) => d.status === "today"),
  );
  let start = Math.max(0, todayIdx - 2);
  let end = start + WINDOW;
  if (end > days.length) {
    end = days.length;
    start = Math.max(0, end - WINDOW);
  }
  return days.slice(start, end);
}

/**
 * Franja horizontal tipo “Daily Reward” para el modal de bienvenida.
 *
 * La grilla clásica (`DailyCalendar`) se deja intacta para Eventos / fusión
 * futura; este strip es sólo la superficie del popup.
 */
export function DailyRewardStrip({
  days,
  labels,
  onClaimToday,
  claiming = false,
}: {
  days: DailyDayState[];
  labels: StripLabels;
  /** Si hay regalo de hoy, tocar la card lo reclama (sin CTA aparte). */
  onClaimToday?: () => void;
  claiming?: boolean;
}) {
  const windowDays = visibleDays(days);
  const reachedCount = windowDays.filter(
    (d) => d.status === "claimed" || d.status === "today",
  ).length;
  // La barra llega hasta el centro del día actual / último alcanzado.
  const progressRatio =
    windowDays.length <= 1
      ? 1
      : Math.min(1, Math.max(0, (reachedCount - 0.5) / (windowDays.length - 1)));

  return (
    <div className="daily-reward-strip w-full">
      {/* Cards */}
      <ul className="grid grid-cols-6 gap-2 sm:gap-3">
        {windowDays.map((day) => {
          const isToday = day.status === "today";
          const isClaimed = day.status === "claimed";
          const isLocked = day.status === "upcoming";
          const isFinal = day.variant === "final";
          const isSpecial = day.variant === "special";
          const statusLabel = isToday
            ? labels.statusToday
            : isClaimed
              ? labels.statusClaimed
              : labels.statusUpcoming;

          return (
            <li key={day.day} className="relative min-w-0 pt-2.5">
              {(isSpecial || isFinal) && (
                <span
                  className={[
                    "daily-reward-badge absolute left-1/2 top-0 z-20 -translate-x-1/2 px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px]",
                    isFinal ? "is-rare" : "is-special",
                  ].join(" ")}
                >
                  {isFinal ? labels.badgeRare : labels.badgeSpecial}
                </span>
              )}

              <div
                role={isToday && onClaimToday ? "button" : undefined}
                tabIndex={isToday && onClaimToday ? 0 : undefined}
                data-autofocus={isToday && onClaimToday ? true : undefined}
                aria-label={isToday && onClaimToday ? labels.statusToday : undefined}
                aria-disabled={isToday && onClaimToday ? claiming : undefined}
                onClick={
                  isToday && onClaimToday && !claiming ? onClaimToday : undefined
                }
                onKeyDown={
                  isToday && onClaimToday && !claiming
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onClaimToday();
                        }
                      }
                    : undefined
                }
                className={[
                  "daily-reward-card aspect-square w-full px-0 pt-0.5 pb-0.5 sm:aspect-[5/6]",
                  // Estado (hoy / reclamado / idle) + rareza (borde/fondo) en capas.
                  isToday ? "is-today" : isClaimed ? "is-claimed" : "is-idle",
                  isFinal ? "is-final" : isSpecial ? "is-special" : "is-normal",
                  isToday && onClaimToday
                    ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/70"
                    : "",
                  claiming && isToday ? "opacity-70" : "",
                ].join(" ")}
              >
                <div className="daily-reward-card-face relative min-h-0 flex-1">
                  {isLocked && (
                    <span
                      aria-hidden
                      className="absolute left-1 top-1 z-10 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:left-1.5 sm:top-1.5"
                    >
                      <span className="material-symbols-outlined text-[13px]! sm:text-[15px]!">
                        lock
                      </span>
                    </span>
                  )}

                  <span className="relative z-[1] flex min-h-0 w-full flex-1 flex-col items-center justify-between">
                    <RewardList
                      rewards={day.rewards}
                      size="lg"
                      unitLabels={labels.rewards}
                      layout="strip"
                      claimedOverlay={
                        isClaimed ? (
                          <span
                            aria-hidden
                            className="daily-reward-check absolute bottom-[-2%] left-1/2 z-20 w-[38%] max-w-7 -translate-x-1/2 sm:w-[34%] sm:max-w-8"
                          >
                            <Image
                              src="/ui/daily-reward-check.png"
                              alt=""
                              width={88}
                              height={88}
                              className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                              unoptimized
                            />
                          </span>
                        ) : null
                      }
                    />
                  </span>

                  <span className="sr-only">{statusLabel}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Timeline + labels en la misma grilla de 6 */}
      <div className="relative mt-3">
        <div
          aria-hidden
          className="daily-reward-timeline absolute top-[5px] right-[8.33%] left-[8.33%] h-[5px] rounded-full"
        >
          <div
            className="daily-reward-timeline-fill h-full rounded-full"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        <ul className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
          {windowDays.map((day) => {
            const reached = day.status === "claimed" || day.status === "today";
            return (
              <li
                key={`label-${day.day}`}
                className="flex flex-col items-center pt-0.5"
              >
                <span
                  className={[
                    "daily-reward-timeline-tick relative z-[1] mb-1.5",
                    reached ? "is-reached" : "is-upcoming",
                  ].join(" ")}
                />
                <span
                  className={[
                    "daily-reward-day-label text-[11px] sm:text-[13px]",
                    reached ? "is-reached" : "is-upcoming",
                  ].join(" ")}
                >
                  {labels.dailyDay.replace("{day}", String(day.day))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
