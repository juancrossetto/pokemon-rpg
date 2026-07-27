"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { healTeam } from "@/actions/heal-team";
import { HEAL_FREE_UNTIL_LEVEL, minutesLeft } from "@/lib/healing";
import { playBattleSfx } from "@/lib/battle-sfx";
import { announceCoinDelta } from "@/lib/coin-fx";

/**
 * Centro Pokémon: gratis cuando pasó el cooldown, o pago para saltearlo.
 * Hasta `HEAL_FREE_UNTIL_LEVEL` es gratis sin espera (arranque de perfiles nuevos).
 * El cooldown que llega por props es el del servidor al renderizar; sólo se usa
 * para decidir qué botón mostrar — la validación real vive en la acción.
 */
export function HealButton({
  locale,
  needsHealing,
  cooldownMsLeft,
  rushCost,
  coins,
  teamMaxLevel,
}: {
  locale: string;
  needsHealing: boolean;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
  /** Nivel del Pokémon más alto del equipo. */
  teamMaxLevel: number;
}) {
  const t = useTranslations("team");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fxKey, setFxKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const noviceFree = teamMaxLevel <= HEAL_FREE_UNTIL_LEVEL;
  const onCooldown = !noviceFree && cooldownMsLeft > 0;
  const canPay = coins >= rushCost;

  function run(rush: boolean) {
    setError(null);
    setFxKey((k) => k + 1);
    playBattleSfx("heal");
    startTransition(async () => {
      const result = await healTeam(locale, rush);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (rush) announceCoinDelta(-rushCost);
    });
  }

  if (!needsHealing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled
          title={noviceFree ? t("healNoviceFreeHint", { level: HEAL_FREE_UNTIL_LEVEL }) : undefined}
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-surface-container-high px-4 py-2 text-label-sm font-semibold text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-[16px]!">healing</span>
          {t("autoHeal")}
        </button>
        {noviceFree ? (
          <span className="whitespace-nowrap text-[10px] font-medium text-emerald-400/90">
            {t("healNoviceFree", { level: HEAL_FREE_UNTIL_LEVEL })}
          </span>
        ) : null}
      </div>
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
          className="inline-flex items-center gap-1.5 rounded-md bg-electric-yellow/15 border border-electric-yellow/40 px-4 py-2 text-label-sm font-semibold text-electric-yellow transition hover:bg-electric-yellow/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]!">bolt</span>
          {t("healRush")}
          <span className="inline-flex items-center gap-0.5 font-mono">
            <span className="material-symbols-outlined text-[14px]!">paid</span>
            {rushCost}
          </span>
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          title={noviceFree ? t("healNoviceFreeHint", { level: HEAL_FREE_UNTIL_LEVEL }) : undefined}
          className="inline-flex items-center gap-1.5 rounded-md bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white shadow-[0_6px_18px_rgba(238,21,21,0.25)] transition hover:bg-pokeball-red/90 active:scale-[0.98] disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]!">healing</span>
          {t("autoHeal")}
        </button>
      )}

      {noviceFree ? (
        <span className="whitespace-nowrap text-[10px] font-medium text-emerald-400/90">
          {t("healNoviceFree", { level: HEAL_FREE_UNTIL_LEVEL })}
        </span>
      ) : onCooldown ? (
        <span className="whitespace-nowrap text-[10px] text-on-surface-variant">
          {t("healCooldown", { minutes: minutesLeft(cooldownMsLeft) })}
        </span>
      ) : (
        <span className="whitespace-nowrap text-[10px] text-on-surface-variant">{t("healFree")}</span>
      )}

      {error && <span className="text-[10px] text-error">{t(`healErrors.${error}`)}</span>}

      {mounted && fxKey > 0
        ? createPortal(<CenterHealFx key={fxKey} />, document.body)
        : null}
    </div>
  );
}

/** Destello rojo del Centro Pokémon al curar el equipo. */
function CenterHealFx() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center overflow-hidden"
    >
      <span className="center-heal-wash absolute inset-0" />
      <span className="center-heal-burst absolute h-[min(70vw,420px)] w-[min(70vw,420px)] rounded-full" />
      <span className="center-heal-ring absolute h-[min(55vw,320px)] w-[min(55vw,320px)] rounded-full border-2 border-pokeball-red/80" />
      <span className="center-heal-cross absolute flex items-center justify-center">
        <span className="material-symbols-outlined text-[64px]! text-pokeball-red drop-shadow-[0_0_24px_rgba(238,21,21,0.85)]">
          cardiology
        </span>
      </span>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="center-heal-spark absolute h-2 w-2 rounded-full bg-pokeball-red"
          style={
            {
              "--sx": `${Math.cos((i / 10) * Math.PI * 2) * 110}px`,
              "--sy": `${Math.sin((i / 10) * Math.PI * 2) * 90 - 20}px`,
              animationDelay: `${i * 35}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
