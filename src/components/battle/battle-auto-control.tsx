"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  getBattleAuto,
  getServerBattleAuto,
  subscribeBattleAuto,
  toggleBattleAuto,
} from "@/lib/battle-auto";

/**
 * Toggle AUTO del HUD de combate. Misma pastilla circular que velocidad/mute;
 * activo = borde/texto más vivos para que se lea el estado de un vistazo.
 */
export function BattleAutoControl({ className = "" }: { className?: string }) {
  const t = useTranslations("battle");
  const on = useSyncExternalStore(
    subscribeBattleAuto,
    getBattleAuto,
    getServerBattleAuto,
  );

  const label = on ? t("autoBattleOn") : t("autoBattleOff");

  return (
    <button
      type="button"
      onClick={() => toggleBattleAuto()}
      className={`flex h-8 w-8 flex-col items-center justify-center gap-0 rounded-full border shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors md:h-9 md:w-9 ${
        on
          ? "border-[color-mix(in_srgb,var(--theme-primary)_45%,#2a2a2a)] bg-[color-mix(in_srgb,var(--theme-primary)_18%,#0a0a0a)] text-[var(--theme-primary-bright)] hover:bg-[color-mix(in_srgb,var(--theme-primary)_26%,#0a0a0a)]"
          : "border-white/40 bg-[#141414]/95 text-white hover:border-white/55 hover:bg-[#1a1a1a]"
      } ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={on}
    >
      <span className="material-symbols-outlined text-[13px]! leading-none md:text-[15px]!">autorenew</span>
      <span className="text-[6px] font-bold leading-none tracking-wide md:text-[7px]">AUTO</span>
    </button>
  );
}
