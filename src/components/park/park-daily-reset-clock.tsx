"use client";

import { useEffect, useRef, useState } from "react";

/** `h:mm:ss` — el cupo diario vuelve a medianoche UTC, no en unos minutos. */
function formatResetClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Reloj hasta el próximo día de juego.
 *
 * El valor inicial es el `resetMs` del servidor para no pintar `Date.now()` en
 * el primer render (rompería la hidratación). Los ticks van en el intervalo,
 * no sueltos en el efecto. Lo usan la mina y la pesca: mismo cupo diario.
 */
export function ParkDailyResetClock({
  resetAt,
  resetMs,
  visible,
  label,
  onExpired,
}: {
  resetAt: string;
  resetMs: number;
  visible: boolean;
  label: (time: string) => string;
  onExpired: () => void;
}) {
  const [msLeft, setMsLeft] = useState(resetMs);
  const [lastServerMs, setLastServerMs] = useState(resetMs);
  const expired = useRef(false);

  if (lastServerMs !== resetMs) {
    setLastServerMs(resetMs);
    setMsLeft(resetMs);
  }

  useEffect(() => {
    expired.current = false;
    const target = new Date(resetAt).getTime();
    const tick = () => setMsLeft(Math.max(0, target - Date.now()));
    const raf = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [resetAt]);

  useEffect(() => {
    if (msLeft > 0 || expired.current) return;
    expired.current = true;
    onExpired();
  }, [msLeft, onExpired]);

  if (!visible) return null;

  const time = formatResetClock(msLeft);
  return (
    <span className="park-reset" aria-label={label(time)}>
      <span className="material-symbols-outlined" aria-hidden>
        schedule
      </span>
      <span className="park-reset__full">{label(time)}</span>
      <span className="park-reset__short" aria-hidden>
        {time}
      </span>
    </span>
  );
}
