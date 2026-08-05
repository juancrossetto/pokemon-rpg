"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { forfeitIdleBattle } from "@/actions/forfeit-idle-battle";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Reloj de decisión: cuenta atrás mientras el jugador elige acción.
 * Al llegar a 0 llama al forfeit server-side (el servidor también valida).
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

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    expiredRef.current = false;
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

  const urgent = remainingMs <= 15_000;
  const critical = remainingMs <= 5_000;

  return (
    <div
      className={`pointer-events-none absolute bottom-2 left-2 z-40 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider shadow-lg backdrop-blur-md sm:bottom-3 sm:left-3 sm:text-label-sm ${
        critical
          ? "border-pokeball-red/60 bg-pokeball-red/25 text-white animate-pulse"
          : urgent
            ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
            : "border-white/15 bg-black/55 text-white/85"
      }`}
      role="timer"
      aria-live="polite"
      aria-label={t("turnTimerAria", { time: formatCountdown(remainingMs) })}
    >
      <span className="material-symbols-outlined text-[14px]! sm:text-[16px]!">timer</span>
      <span>{formatCountdown(remainingMs)}</span>
    </div>
  );
}
