"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { hasSeenUnlock, markUnlockSeen } from "@/lib/journey-ux";
import { playUnlockToastAppear, playUnlockToastDismiss } from "@/lib/ui-toast-sfx";

const VISIBLE_MS = 3400;
const EXIT_MS = 320;

type Phase = "in" | "out";

/** Beat corto al desbloquear una zona nueva — rebota, se queda un rato y sale con sonido. */
export function UnlockCelebration({
  locationId,
  locationName,
}: {
  locationId: string | null;
  locationName: string | null;
}) {
  const t = useTranslations("ux");
  const [phase, setPhase] = useState<Phase | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!locationId || !locationName) return;
    if (hasSeenUnlock(locationId)) return;
    markUnlockSeen(locationId);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitMs = reduced ? 0 : EXIT_MS;

    const raf = window.requestAnimationFrame(() => {
      setPhase("in");
      playUnlockToastAppear();

      const exitTimer = window.setTimeout(() => {
        playUnlockToastDismiss();
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
  }, [locationId, locationName]);

  if (!phase || !locationName) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4"
    >
      <div
        className={`unlock-toast flex max-w-sm items-center gap-3 rounded-2xl border border-tertiary/45 bg-surface-container-highest/95 px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(125,211,252,0.08)] backdrop-blur-md ${
          phase === "out" ? "unlock-toast--out" : "unlock-toast--in"
        }`}
      >
        <span className="unlock-toast-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary ring-1 ring-tertiary/30">
          <span className="material-symbols-outlined text-[22px]!">lock_open</span>
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-tertiary">
            {t("unlockEyebrow")}
          </p>
          <p className="truncate text-label-md font-bold text-white">
            {t("unlockBody", { name: locationName })}
          </p>
        </div>
      </div>
    </div>
  );
}
