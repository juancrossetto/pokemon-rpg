"use client";

import { useActionState } from "react";
import { startEncounter, type StartEncounterResult } from "@/actions/start-encounter";

export function StartEncounterButton({
  locale,
  label,
  errors,
  disabled = false,
  className,
}: {
  locale: string;
  label: string;
  errors: Record<"no_lead" | "fainted_lead" | "no_energy" | "no_stage", string>;
  disabled?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<StartEncounterResult | null>(
    async () => (await startEncounter(locale)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="flex w-full flex-col items-stretch gap-2">
      <button
        type="submit"
        disabled={pending || disabled}
        className={
          className ??
          "rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white transition-colors hover:bg-pokeball-red/80 disabled:opacity-50"
        }
      >
        {pending ? "…" : label}
      </button>
      {state && !state.success && (
        <p className="text-center text-label-sm text-error">{errors[state.error]}</p>
      )}
    </form>
  );
}
