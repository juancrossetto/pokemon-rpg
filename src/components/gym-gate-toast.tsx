"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const VISIBLE_MS = 3800;
const EXIT_MS = 380;

type Phase = "in" | "out";

/**
 * Popup de requisitos / error al iniciar un gimnasio: entra desde arriba,
 * se queda un rato y sale hacia abajo.
 */
export function GymGateToast({
  token,
  children,
}: {
  /** Cambia en cada disparo para rearmar la animación. */
  token: number;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (token <= 0 || !children) return;

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
  }, [token, children]);

  if (!phase || token <= 0) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[min(38vh,16.5rem)] z-[80] flex justify-center px-4"
    >
      <div
        className={`gym-gate-toast pointer-events-auto w-full max-w-lg sm:max-w-2xl ${
          phase === "out" ? "gym-gate-toast--out" : "gym-gate-toast--in"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
