"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { skipGymCooldown } from "@/actions/skip-gym-cooldown";
import { formatGymCooldown, gymCooldownSkipCost } from "@/lib/gym-cooldown";
import { announceGemDelta, clearPendingGemDelta } from "@/lib/resource-fx";

const GEM_ICON = "/items/hd/gem.png";

/**
 * Pagar gemas para desafiar de nuevo al líder tras una derrota.
 * Misma carcasa `game-cta` que torre / desafiar gimnasio.
 */
export function SkipGymCooldownButton({
  gymId,
  hoursLeft,
  remainingMs,
  gems,
  compact = false,
  className = "",
}: {
  gymId: string;
  hoursLeft: number;
  /** Si no viene, se estima desde hoursLeft (ceil → peor caso). */
  remainingMs?: number;
  gems: number;
  /** Variante chica para la barra sticky mobile. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("gyms");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ms = remainingMs ?? hoursLeft * 60 * 60 * 1000;
  const [leftMs, setLeftMs] = useState(ms);
  const cost = gymCooldownSkipCost(leftMs);
  const canPay = gems >= cost && cost > 0;
  const timeLabel = formatGymCooldown(leftMs);
  const disabled = pending || !canPay;

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (!cancelled) setLeftMs(ms);
    });
    const interval = setInterval(() => {
      setLeftMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [ms]);

  function onClick() {
    if (disabled) return;
    setError(null);
    announceGemDelta(-cost);
    startTransition(async () => {
      const result = await skipGymCooldown(gymId, locale);
      if (!result.ok) {
        clearPendingGemDelta();
        setError(t(`skipCooldownErrors.${result.error}`));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className={`flex flex-col gap-2 ${
        compact ? "items-stretch" : "w-full items-stretch sm:items-end"
      } ${className}`.trim()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={t("skipCooldownHint", { cost })}
        className={`game-cta game-cta--gem mb-0! gap-2 whitespace-nowrap sm:gap-2.5 ${
          compact
            ? "min-h-11 w-auto! px-4 py-2.5 text-[0.78rem]"
            : "px-5 py-3"
        } ${disabled ? "game-cta--disabled" : ""}`.trim()}
      >
        {pending ? (
          <span className="game-cta__label pl-0.5">{t("skipCooldownPending")}</span>
        ) : (
          <>
            <span className="game-cta__label whitespace-nowrap">
              {t("skipCooldown")}
            </span>
            <span aria-hidden className="h-4 w-px shrink-0 bg-white/30" />
            <span
              className={`inline-flex shrink-0 items-center gap-1 font-sans font-semibold tabular-nums tracking-normal text-white normal-case ${
                compact ? "text-[12px]" : "text-[13px]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]! opacity-90">
                schedule
              </span>
              <span className="font-mono">{timeLabel}</span>
            </span>
            <span aria-hidden className="h-4 w-px shrink-0 bg-white/30" />
            <span
              className={`inline-flex shrink-0 items-center gap-1 font-sans font-semibold tabular-nums tracking-normal text-white normal-case ${
                compact ? "text-[12px]" : "text-[13px]"
              }`}
            >
              <Image
                src={GEM_ICON}
                alt=""
                width={22}
                height={22}
                className={`shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] ${
                  compact ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]"
                }`}
                unoptimized
              />
              <span>{cost}</span>
            </span>
          </>
        )}
      </button>
      {!canPay && cost > 0 ? (
        <p
          className={`px-1 text-[11px] leading-snug text-error/90 ${
            compact ? "" : "sm:text-right"
          }`}
        >
          {t("skipCooldownNoGems")}
        </p>
      ) : null}
      {error ? (
        <p
          className={`px-1 text-[11px] leading-snug text-error ${
            compact ? "" : "sm:text-right"
          }`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
