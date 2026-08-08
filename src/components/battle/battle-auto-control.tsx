"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  BATTLE_AUTO_UNLOCK_COUNT,
  BATTLE_AUTO_UNLOCK_LEVEL,
  getBattleAuto,
  getServerBattleAuto,
  setBattleAuto,
  subscribeBattleAuto,
  toggleBattleAuto,
} from "@/lib/battle-auto";
import { showToast } from "@/lib/app-toast";

/**
 * Toggle AUTO del HUD de combate. Misma pastilla circular que velocidad/mute;
 * activo = borde/texto más vivos para que se lea el estado de un vistazo.
 *
 * Bloqueado hasta ≥3 Pokémon a nivel ≥10 (progresión early-game).
 * No usamos `disabled` nativo: en varios browsers el tooltip no aparece al
 * hover sobre un botón disabled. Hover/focus muestran el requisito; en tap
 * (mobile) también sale un toast.
 */
export function BattleAutoControl({
  unlocked = true,
  className = "",
}: {
  unlocked?: boolean;
  className?: string;
}) {
  const t = useTranslations("battle");
  const on = useSyncExternalStore(
    subscribeBattleAuto,
    getBattleAuto,
    getServerBattleAuto,
  );

  useEffect(() => {
    if (!unlocked && getBattleAuto()) setBattleAuto(false);
  }, [unlocked]);

  const lockedHint = t("autoBattleLocked", {
    count: BATTLE_AUTO_UNLOCK_COUNT,
    level: BATTLE_AUTO_UNLOCK_LEVEL,
  });
  const label = !unlocked
    ? lockedHint
    : on
      ? t("autoBattleOn")
      : t("autoBattleOff");

  return (
    <div className={`group/auto relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!unlocked) {
            showToast(lockedHint, "info");
            return;
          }
          toggleBattleAuto();
        }}
        className={`flex h-8 w-8 flex-col items-center justify-center gap-0 rounded-full border shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors md:h-9 md:w-9 ${
          !unlocked
            ? "cursor-help border-white/15 bg-[#0a0a0a]/80 text-white/35"
            : on
              ? "border-[color-mix(in_srgb,var(--theme-primary)_45%,#2a2a2a)] bg-[color-mix(in_srgb,var(--theme-primary)_18%,#0a0a0a)] text-[var(--theme-primary-bright)] hover:bg-[color-mix(in_srgb,var(--theme-primary)_26%,#0a0a0a)]"
              : "border-white/40 bg-[#141414]/95 text-white hover:border-white/55 hover:bg-[#1a1a1a]"
        }`}
        title={label}
        aria-label={label}
        aria-pressed={unlocked ? on : undefined}
        aria-disabled={!unlocked}
      >
        <span className="material-symbols-outlined text-[13px]! leading-none md:text-[15px]!">
          {unlocked ? "autorenew" : "lock"}
        </span>
        <span className="text-[6px] font-bold leading-none tracking-wide md:text-[7px]">
          AUTO
        </span>
      </button>

      {!unlocked ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden w-max max-w-[11.5rem] -translate-y-1/2 rounded-md border border-white/15 bg-[#0c0e14]/96 px-2 py-1.5 text-left text-[10px] leading-snug text-white/90 opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.55)] transition-opacity duration-150 group-hover/auto:opacity-100 group-focus-within/auto:opacity-100 md:block"
        >
          {lockedHint}
        </span>
      ) : null}
    </div>
  );
}
