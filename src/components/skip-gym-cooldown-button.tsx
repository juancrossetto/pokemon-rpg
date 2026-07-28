"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { skipGymCooldown } from "@/actions/skip-gym-cooldown";
import { gymCooldownSkipCost } from "@/lib/gym-cooldown";

/**
 * Pagar gemas para limpiar el cooldown de un gimnasio tras una derrota.
 */
export function SkipGymCooldownButton({
  gymId,
  hoursLeft,
  remainingMs,
  gems,
  compact = false,
}: {
  gymId: string;
  hoursLeft: number;
  /** Si no viene, se estima desde hoursLeft (ceil → peor caso). */
  remainingMs?: number;
  gems: number;
  /** Variante chica para el panel de misión. */
  compact?: boolean;
}) {
  const t = useTranslations("gyms");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ms = remainingMs ?? hoursLeft * 60 * 60 * 1000;
  const cost = gymCooldownSkipCost(ms);
  const canPay = gems >= cost && cost > 0;

  function onClick() {
    if (!canPay || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await skipGymCooldown(gymId, locale);
      if (!result.ok) {
        setError(t(`skipCooldownErrors.${result.error}`));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className={`flex flex-col gap-1.5 ${
        compact ? "items-stretch" : "w-full items-stretch sm:items-end"
      }`}
    >
      {!compact && (
        <p className="text-label-sm text-amber-300/90 sm:text-right">
          {t("cooldownHint", { hours: hoursLeft })}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !canPay}
        onClick={onClick}
        title={t("skipCooldownHint", { cost })}
        className={`inline-flex items-center justify-center gap-1.5 border border-fuchsia-400/35 bg-fuchsia-500/15 font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact
            ? "rounded-md px-4 py-2.5 text-label-sm"
            : "rounded-lg px-5 py-3 text-label-md"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]!">diamond</span>
        {pending ? t("skipCooldownPending") : t("skipCooldown")}
        <span className="inline-flex items-center gap-0.5 font-mono text-[13px]">
          <span className="material-symbols-outlined text-[15px]!">diamond</span>
          {cost}
        </span>
      </button>
      {!canPay && cost > 0 ? (
        <span className={`text-[10px] text-error/90 ${compact ? "" : "sm:text-right"}`}>
          {t("skipCooldownNoGems")}
        </span>
      ) : (
        <span
          className={`text-[10px] text-on-surface-variant ${compact ? "" : "sm:text-right"}`}
        >
          {t("skipCooldownHint", { cost })}
        </span>
      )}
      {error ? (
        <span className={`text-[10px] text-error ${compact ? "" : "sm:text-right"}`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
