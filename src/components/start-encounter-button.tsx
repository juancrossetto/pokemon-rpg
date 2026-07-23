"use client";

import { useActionState } from "react";
import { startEncounter, type StartEncounterResult } from "@/actions/start-encounter";

export function StartEncounterButton({
  locale,
  label,
  errors,
}: {
  locale: string;
  label: string;
  errors: Record<"no_lead" | "fainted_lead" | "no_energy", string>;
}) {
  const [state, formAction, pending] = useActionState<StartEncounterResult | null>(
    async () => (await startEncounter(locale)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
      >
        {label}
      </button>
      {state && !state.success && (
        <p className="text-label-sm text-error">{errors[state.error]}</p>
      )}
    </form>
  );
}
