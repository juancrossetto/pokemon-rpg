"use client";

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
}: {
  days: DailyDayState[];
  labels: StripLabels;
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
      <ul className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
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
            <li key={day.day} className="relative min-w-0 pt-2">
              {(isSpecial || isFinal) && (
                <span
                  className={[
                    "daily-reward-badge absolute left-1/2 top-0 z-20 -translate-x-1/2 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider sm:px-2 sm:text-[9px]",
                    isFinal ? "is-rare" : "is-special",
                  ].join(" ")}
                >
                  {isFinal ? labels.badgeRare : labels.badgeSpecial}
                </span>
              )}

              <div
                className={[
                  "daily-reward-card relative flex aspect-[3/4] w-full flex-col items-center justify-center px-1 pt-3 pb-2",
                  isToday
                    ? "is-today"
                    : isClaimed
                      ? "is-claimed"
                      : isFinal
                        ? "is-final"
                        : isSpecial
                          ? "is-special"
                          : "is-idle",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "pointer-events-none absolute inset-[16%] rounded-full blur-md",
                    isFinal
                      ? "bg-[#ff3b3b]/28"
                      : isSpecial
                        ? "bg-lime-400/28"
                        : isToday
                          ? "bg-[#ff8a00]/40"
                          : "bg-[#ff8a00]/14",
                  ].join(" ")}
                />

                {isLocked && (
                  <span
                    aria-hidden
                    className="absolute left-2 top-2 z-10 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:left-2.5 sm:top-2.5"
                  >
                    <span className="material-symbols-outlined text-[15px]! sm:text-[17px]!">
                      lock
                    </span>
                  </span>
                )}

                <span
                  className={[
                    "relative z-[1] grid scale-[1.15] place-items-center sm:scale-125",
                    isClaimed ? "opacity-40 grayscale" : isLocked ? "opacity-75" : "",
                  ].join(" ")}
                >
                  <RewardList
                    rewards={day.rewards}
                    size="md"
                    unitLabels={labels.rewards}
                    layout="calendar"
                  />
                </span>

                {isClaimed && (
                  <span
                    aria-hidden
                    className="daily-reward-check absolute inset-x-0 bottom-[16%] z-20 mx-auto grid h-8 w-8 place-items-center sm:h-9 sm:w-9"
                  >
                    <span className="material-symbols-outlined text-[20px]! font-bold sm:text-[22px]!">
                      check
                    </span>
                  </span>
                )}

                <span className="sr-only">{statusLabel}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Timeline + labels en la misma grilla de 6 */}
      <div className="relative mt-3">
        <div
          aria-hidden
          className="daily-reward-timeline absolute top-[5px] right-[8.33%] left-[8.33%] h-[3px] overflow-hidden rounded-full bg-[#1a2448]"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff8a00] via-[#f2c000] to-[#ff8a00] shadow-[0_0_12px_rgba(255,138,0,0.75)]"
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
                    "relative z-[1] mb-1.5 h-2.5 w-px",
                    reached ? "bg-[#ff9a1a]" : "bg-[#2a3558]",
                  ].join(" ")}
                />
                <span
                  className={[
                    "text-[9px] font-semibold tracking-wide sm:text-[11px]",
                    reached ? "text-white" : "text-[#3d4a6e]",
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
