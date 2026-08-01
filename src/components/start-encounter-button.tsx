"use client";

import { useActionState } from "react";
import { startEncounter, type StartEncounterResult } from "@/actions/start-encounter";
import { GameCtaButton } from "@/components/game-cta-button";

export function StartEncounterButton({
  locale,
  label,
  errors,
  disabled = false,
}: {
  locale: string;
  label: string;
  errors: Record<"no_lead" | "fainted_lead" | "no_energy" | "no_stage" | "locked", string>;
  disabled?: boolean;
  /** @deprecated El CTA usa GameCtaButton; se mantiene por compatibilidad de callers. */
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<StartEncounterResult | null>(
    async () => (await startEncounter(locale)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="flex w-full flex-col items-stretch gap-2">
      <GameCtaButton type="submit" disabled={pending || disabled} className="cta-pulse">
        {pending ? "…" : label}
      </GameCtaButton>
      {state && !state.success && (
        <p className="text-center text-label-sm text-error">{errors[state.error]}</p>
      )}
    </form>
  );
}
