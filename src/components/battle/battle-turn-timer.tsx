"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { forfeitIdleBattle } from "@/actions/forfeit-idle-battle";
import { playBattleSfx } from "@/lib/battle-sfx";
import { BATTLE_TURN_IDLE_MS } from "@/lib/battle-turn-timer";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Umbral a partir del cual suena la alarma (un beep por segundo). */
const ALARM_MS = 8_000;

type TimerTone = "calm" | "warn" | "urgent" | "critical";

function toneForRemaining(ms: number): TimerTone {
  if (ms <= ALARM_MS) return "critical";
  if (ms <= 20_000) return "urgent";
  if (ms <= 35_000) return "warn";
  return "calm";
}

const TONE_CLASS: Record<TimerTone, string> = {
  calm: "border-white/15 bg-black/55 text-white/85",
  warn: "border-yellow-400/45 bg-yellow-500/15 text-yellow-100",
  urgent: "border-amber-400/55 bg-amber-500/22 text-amber-50",
  critical:
    "border-pokeball-red/70 bg-pokeball-red/30 text-white shadow-[0_0_18px_rgba(220,38,38,0.35)] animate-pulse",
};

/**
 * Reloj de decisión: cuenta atrás mientras el jugador elige acción.
 * Al llegar a 0 llama al forfeit server-side (el servidor también valida).
 * Escala color → rojo y, en los últimos segundos, beep de alarma.
 */
export function BattleTurnTimer({
  battleId,
  locale,
  deadlineAt,
  paused,
  onExpired,
}: {
  battleId: string;
  locale: string;
  /** ISO del deadline; null = sin mostrar. */
  deadlineAt: string | null;
  /** Pausar durante animaciones / outcome. */
  paused: boolean;
  onExpired: () => void;
}) {
  const t = useTranslations("battle");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const expiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  const lastAlarmSecRef = useRef<number | null>(null);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    expiredRef.current = false;
    lastAlarmSecRef.current = null;
  }, [deadlineAt]);

  useEffect(() => {
    if (!deadlineAt || paused) {
      const id = requestAnimationFrame(() => setRemainingMs(null));
      return () => cancelAnimationFrame(id);
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const deadline = new Date(deadlineAt).getTime();

    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(left);

      if (left > 0 && left <= ALARM_MS) {
        const sec = Math.ceil(left / 1000);
        if (sec !== lastAlarmSecRef.current) {
          lastAlarmSecRef.current = sec;
          playBattleSfx("timerTick");
        }
      }

      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        void (async () => {
          const result = await forfeitIdleBattle(battleId, locale);
          if (result.ok || result.error === "already_closed") {
            onExpiredRef.current();
          }
        })();
      }
    };

    const raf = requestAnimationFrame(() => {
      tick();
      intervalId = setInterval(tick, 250);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (intervalId) clearInterval(intervalId);
    };
  }, [deadlineAt, paused, battleId, locale]);

  if (remainingMs == null || !deadlineAt) return null;

  const tone = toneForRemaining(remainingMs);
  // Barra de progreso bajo el número: se vacía con el tiempo.
  const fillPct = Math.max(
    0,
    Math.min(100, (remainingMs / BATTLE_TURN_IDLE_MS) * 100),
  );

  return (
    <div
      className={`pointer-events-none absolute bottom-2 left-2 z-40 flex min-w-[4.75rem] flex-col gap-1 overflow-hidden rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wider shadow-lg backdrop-blur-md sm:bottom-3 sm:left-3 sm:text-label-sm ${TONE_CLASS[tone]}`}
      role="timer"
      aria-live="polite"
      aria-label={t("turnTimerAria", { time: formatCountdown(remainingMs) })}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`material-symbols-outlined text-[14px]! sm:text-[16px]! ${
            tone === "critical" ? "text-white" : ""
          }`}
        >
          {tone === "critical" ? "timer_off" : "timer"}
        </span>
        <span>{formatCountdown(remainingMs)}</span>
      </div>
      <span
        className="block h-0.5 w-full overflow-hidden rounded-full bg-black/35"
        aria-hidden
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-200 ease-linear ${
            tone === "critical"
              ? "bg-white"
              : tone === "urgent"
                ? "bg-amber-300"
                : tone === "warn"
                  ? "bg-yellow-300"
                  : "bg-white/55"
          }`}
          style={{ width: `${fillPct}%` }}
        />
      </span>
    </div>
  );
}
