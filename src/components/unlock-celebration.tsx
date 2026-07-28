"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { hasSeenUnlock, markUnlockSeen } from "@/lib/journey-ux";

/** Beat corto al desbloquear una zona nueva — no es un modal eterno. */
export function UnlockCelebration({
  locationId,
  locationName,
}: {
  locationId: string | null;
  locationName: string | null;
}) {
  const t = useTranslations("ux");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!locationId || !locationName) return;
    if (hasSeenUnlock(locationId)) return;
    markUnlockSeen(locationId);
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 3200);
    return () => window.clearTimeout(timer);
  }, [locationId, locationName]);

  if (!show || !locationName) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4"
    >
      <div className="app-toast-in flex max-w-sm items-center gap-3 rounded-2xl border border-tertiary/40 bg-surface-container-highest/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary">
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
