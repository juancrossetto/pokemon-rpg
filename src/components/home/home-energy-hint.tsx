"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { hasSeen, markSeen } from "@/lib/journey-ux";

/** Pista de novato: la energía va a Aventura, no al grind del Parque. */
export function HomeEnergyHint({ enabled }: { enabled: boolean }) {
  const t = useTranslations("home.energyHint");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setVisible(enabled && !hasSeen("energy-adventure-hint"));
    });
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!visible) return null;

  return (
    <aside className="flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/8 px-3 py-2.5">
      <span className="material-symbols-outlined mt-0.5 text-[18px]! text-sky-300">bolt</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-white">{t("title")}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-white/65">{t("body")}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          markSeen("energy-adventure-hint");
          setVisible(false);
        }}
        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50 hover:bg-white/8 hover:text-white"
      >
        {t("dismiss")}
      </button>
    </aside>
  );
}
