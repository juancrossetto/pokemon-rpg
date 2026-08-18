"use client";

import { useEffect, useRef, useState } from "react";

const VISIBLE_MS = 2400;
const EXIT_MS = 280;

export type ParkToastKind = "ok" | "miss" | "error";

type Phase = "in" | "out";

/**
 * Aviso del minijuego activo: aparece sobre el panel, se desvanece solo.
 *
 * El log compartido de la pantalla del parque se quedaba anclado entre las
 * pestañas y el juego, y un "Goldeen se escapó" seguía visible en el casino.
 * Acá cada disparo vive en su tab, con una salida corta.
 */
export function ParkToast({
  token,
  tab,
  icon,
  message,
  kind,
}: {
  token: number;
  tab: string;
  icon: string;
  message: string;
  kind: ParkToastKind;
}) {
  const [phase, setPhase] = useState<Phase | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (token <= 0 || !message) return;

    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitMs = reduced ? 0 : EXIT_MS;

    const raf = window.requestAnimationFrame(() => {
      setPhase("in");
      const exitTimer = window.setTimeout(() => {
        if (exitMs === 0) {
          setPhase(null);
          return;
        }
        setPhase("out");
        const hideTimer = window.setTimeout(() => setPhase(null), exitMs);
        timers.current.push(hideTimer);
      }, VISIBLE_MS);
      timers.current.push(exitTimer);
    });

    return () => {
      window.cancelAnimationFrame(raf);
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
  }, [token, message]);

  if (!phase || token <= 0) return null;

  return (
    <div className="park-toast-host" aria-live="polite">
      <p
        className={`park-toast${phase === "out" ? " is-out" : " is-in"}`}
        data-tab={tab}
        data-kind={kind}
      >
        <span className="material-symbols-outlined park-toast__icon" aria-hidden>
          {icon}
        </span>
        <span>{message}</span>
      </p>
    </div>
  );
}
