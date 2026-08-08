"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { startPvpRematch } from "@/actions/start-pvp-battle";
import { SubmitButton } from "@/components/submit-button";
import { PVP_BATTLE_ENERGY_COST } from "@/lib/energy";
import { announceEnergyDelta } from "@/lib/resource-fx";
import { formatPvpCooldown } from "@/lib/pvp/cooldown";

/** Formulario de rematch con flash de energía y contador de cooldown. */
export function PvpRematchForm({
  locale,
  foeId,
  label,
  pendingLabel,
  className,
  wrapClassName,
  cooldownMsLeft = 0,
  disabled = false,
}: {
  locale: string;
  foeId: string;
  label: string;
  pendingLabel: string;
  className: string;
  wrapClassName?: string;
  /** Ms restantes del cooldown contra este rival (0 = libre). */
  cooldownMsLeft?: number;
  disabled?: boolean;
}) {
  const t = useTranslations("pvp");
  const router = useRouter();
  const [leftMs, setLeftMs] = useState(Math.max(0, cooldownMsLeft));

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (!cancelled) setLeftMs(Math.max(0, cooldownMsLeft));
    });
    if (cooldownMsLeft <= 0) {
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }
    const started = Date.now();
    const initial = Math.max(0, cooldownMsLeft);
    const interval = window.setInterval(() => {
      const next = Math.max(0, initial - (Date.now() - started));
      setLeftMs(next);
      if (next <= 0) {
        window.clearInterval(interval);
        router.refresh();
      }
    }, 250);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [cooldownMsLeft, router]);

  const onCooldown = leftMs > 0;
  const timeLabel = formatPvpCooldown(leftMs);
  const buttonLabel = onCooldown ? `${label} · ${timeLabel}` : label;
  const hint = onCooldown ? t("cooldownReadyIn", { time: timeLabel }) : undefined;

  return (
    <form
      action={startPvpRematch.bind(null, locale, foeId)}
      onSubmit={(e) => {
        if (onCooldown || disabled) {
          e.preventDefault();
          return;
        }
        announceEnergyDelta(-PVP_BATTLE_ENERGY_COST);
      }}
      className={wrapClassName}
    >
      <SubmitButton
        label={buttonLabel}
        pendingLabel={pendingLabel}
        disabled={disabled || onCooldown}
        className={className}
        title={hint}
      />
    </form>
  );
}
