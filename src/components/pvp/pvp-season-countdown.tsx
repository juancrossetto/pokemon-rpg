"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatSeasonCountdown } from "@/lib/pvp/hub";

/** Countdown client-side de cierre de temporada (UTC). */
export function PvpSeasonCountdown({ endsAtIso }: { endsAtIso: string }) {
  const t = useTranslations("pvp");
  const endsAt = new Date(endsAtIso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => setNow(Date.now());
    raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 30_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const remaining = now == null ? null : formatSeasonCountdown(endsAt - now);
  if (!remaining) {
    return (
      <span className="font-mono text-[11px] tabular-nums text-white/45">…</span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums pvp-arena-accent-text"
      title={t("seasonCountdownTitle")}
    >
      <span className="material-symbols-outlined text-[14px]! opacity-80">
        schedule
      </span>
      {t("seasonCountdown", {
        days: remaining.days,
        hours: remaining.hours,
        minutes: remaining.minutes,
      })}
    </span>
  );
}
