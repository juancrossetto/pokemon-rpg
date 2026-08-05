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
      className={`flex h-8 w-8 flex-col items-center justify-center gap-0 rounded-full border border-white/40 bg-[#141414]/95 text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors hover:border-white/55 hover:bg-[#1a1a1a] md:h-9 md:w-9 ${className}`}
      title={label}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-[13px]! leading-none md:text-[15px]!">fast_forward</span>
      <span className="text-[7px] font-bold leading-none tabular-nums md:text-[8px]">{speed}x</span>
    </button>
  );
}
