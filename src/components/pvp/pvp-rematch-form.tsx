"use client";

import { startPvpRematch } from "@/actions/start-pvp-battle";
import { SubmitButton } from "@/components/submit-button";
import { PVP_BATTLE_ENERGY_COST } from "@/lib/energy";
import { announceEnergyDelta } from "@/lib/resource-fx";

/** Formulario de rematch con flash de energía en el header. */
export function PvpRematchForm({
  locale,
  foeId,
  label,
  pendingLabel,
  className,
  wrapClassName,
}: {
  locale: string;
  foeId: string;
  label: string;
  pendingLabel: string;
  className: string;
  wrapClassName?: string;
}) {
  return (
    <form
      action={startPvpRematch.bind(null, locale, foeId)}
      onSubmit={() => announceEnergyDelta(-PVP_BATTLE_ENERGY_COST)}
      className={wrapClassName}
    >
      <SubmitButton
        label={label}
        pendingLabel={pendingLabel}
        className={className}
      />
    </form>
  );
}
