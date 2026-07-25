"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { healTeam } from "@/actions/heal-team";
import { minutesLeft } from "@/lib/healing";

/**
 * Centro Pokémon: gratis cuando pasó el cooldown, o pago para saltearlo.
 * El cooldown que llega por props es el del servidor al renderizar; sólo se usa
 * para decidir qué botón mostrar — la validación real vive en la acción.
 */
export function HealButton({
  locale,
  needsHealing,
  cooldownMsLeft,
  rushCost,
  coins,
}: {
  locale: string;
  needsHealing: boolean;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
}) {
  const t = useTranslations("team");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onCooldown = cooldownMsLeft > 0;
  const canPay = coins >= rushCost;

  function run(rush: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await healTeam(locale, rush);
      if (!result.ok) setError(result.error);
    });
  }

  if (!needsHealing) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-label-sm font-semibold text-on-surface-variant"
      >
        <span className="material-symbols-outlined text-[16px]">healing</span>
        {t("autoHeal")}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {onCooldown ? (
        <button
          type="button"
          disabled={pending || !canPay}
          onClick={() => run(true)}
          title={t("healRushHint", { minutes: minutesLeft(cooldownMsLeft) })}
          className="inline-flex items-center gap-1.5 rounded-full bg-electric-yellow/15 border border-electric-yellow/40 px-4 py-2 text-label-sm font-semibold text-electric-yellow transition hover:bg-electric-yellow/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          {t("healRush")}
          <span className="inline-flex items-center gap-0.5 font-mono">
            <span className="material-symbols-outlined text-[14px]">paid</span>
            {rushCost}
          </span>
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="inline-flex items-center gap-1.5 rounded-full bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white shadow-[0_6px_18px_rgba(238,21,21,0.25)] transition hover:bg-pokeball-red/90 active:scale-[0.98] disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]">healing</span>
          {t("autoHeal")}
        </button>
      )}

      <span className="text-[10px] text-on-surface-variant">
        {onCooldown
          ? t("healCooldown", { minutes: minutesLeft(cooldownMsLeft) })
          : t("healFree")}
      </span>

      {error && <span className="text-[10px] text-error">{t(`healErrors.${error}`)}</span>}
    </div>
  );
}
