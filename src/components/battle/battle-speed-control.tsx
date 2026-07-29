"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  getBattleSpeed,
  getServerBattleSpeed,
  nextBattleSpeed,
  setBattleSpeed,
  subscribeBattleSpeed,
} from "@/lib/battle-speed";

/**
 * Chip 1x / 2x / 3x para acelerar el timeline de combate. Arranca en 1x en el
 * servidor y adopta la preferencia guardada post-hidratación.
 */
export function BattleSpeedControl({ className = "" }: { className?: string }) {
  const t = useTranslations("battle");
  const speed = useSyncExternalStore(
    subscribeBattleSpeed,
    getBattleSpeed,
    getServerBattleSpeed,
  );

  const label = t("animationSpeed", { speed });

  return (
    <button
      type="button"
      onClick={() => setBattleSpeed(nextBattleSpeed(getBattleSpeed()))}
      className={`flex h-9 items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2.5 text-white/90 backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-black/70 ${className}`}
      title={label}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-[18px]!">speed</span>
      <span className="text-[11px] font-bold tabular-nums">{speed}x</span>
    </button>
  );
}
