"use client";

import Image from "next/image";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { healTeam } from "@/actions/heal-team";
import { HEAL_FREE_UNTIL_LEVEL, minutesLeft } from "@/lib/healing";
import { playBattleSfx } from "@/lib/battle-sfx";
import { announceCoinDelta } from "@/lib/coin-fx";

function ChanseyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <Image
      src="/nav/chansey-icon.png"
      alt=""
      width={28}
      height={28}
      className={`shrink-0 object-contain ${className}`}
      aria-hidden
    />
  );
}

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
  stretch = false,
}: {
  locale: string;
  needsHealing: boolean;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
  /** Nivel del Pokémon más alto del equipo. */
  teamMaxLevel: number;
  /** Ancho completo (toolbar mobile del hub Equipo). */
  stretch?: boolean;
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
  const shell = stretch
    ? "flex w-full min-w-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end"
    : "flex flex-col items-end gap-1";
  const btnBase = stretch
    ? "inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold sm:w-auto sm:justify-start sm:px-4 sm:text-label-sm"
    : "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-label-sm font-semibold";
  const hintAlign = stretch ? "text-center sm:text-right" : "text-right";

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
      <div className={shell}>
        <button
          type="button"
          disabled
          title={noviceFree ? t("healNoviceFreeHint", { level: HEAL_FREE_UNTIL_LEVEL }) : undefined}
          className={`${btnBase} cursor-not-allowed bg-surface-container-high text-on-surface-variant`}
        >
          <ChanseyIcon className="h-5 w-5 opacity-80" />
          {t("autoHeal")}
        </button>
        {noviceFree ? (
          <span className={`whitespace-nowrap text-[10px] font-medium text-emerald-400/90 ${hintAlign}`}>
            {t("healNoviceFree", { level: HEAL_FREE_UNTIL_LEVEL })}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={shell}>
      {onCooldown ? (
        <button
          type="button"
          disabled={pending || !canPay}
          onClick={() => run(true)}
          title={t("healRushHint", { minutes: minutesLeft(cooldownMsLeft) })}
          className={`${btnBase} border border-electric-yellow/40 bg-electric-yellow/15 text-electric-yellow transition hover:bg-electric-yellow/25 disabled:cursor-not-allowed disabled:opacity-50`}
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
          className={`${btnBase} bg-pokeball-red text-white shadow-[0_6px_18px_rgba(238,21,21,0.25)] transition hover:bg-pokeball-red/90 active:scale-[0.98] disabled:opacity-60`}
        >
          <ChanseyIcon className="h-6 w-6" />
          {t("autoHeal")}
        </button>
      )}

      {noviceFree ? (
        <span className={`whitespace-nowrap text-[10px] font-medium text-emerald-400/90 ${hintAlign}`}>
          {t("healNoviceFree", { level: HEAL_FREE_UNTIL_LEVEL })}
        </span>
      ) : onCooldown ? (
        <span className={`whitespace-nowrap text-[10px] text-on-surface-variant ${hintAlign}`}>
          {t("healCooldown", { minutes: minutesLeft(cooldownMsLeft) })}
        </span>
      ) : (
        <span className={`whitespace-nowrap text-[10px] text-on-surface-variant ${hintAlign}`}>
          {t("healFree")}
        </span>
      )}

      {error && (
        <span className={`text-[10px] text-error ${hintAlign}`}>{t(`healErrors.${error}`)}</span>
      )}

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
