"use client";

import { useActionState } from "react";
import { startGymRun, type StartGymRunResult } from "@/actions/start-gym-run";

export function StartGymRunButton({
  gymId,
  locale,
  label,
  errors,
}: {
  gymId: string;
  locale: string;
  label: string;
  errors: Record<"no_lead" | "fainted_lead" | "locked" | "on_cooldown", string>;
}) {
  const [state, formAction, pending] = useActionState<StartGymRunResult | null>(
    async () => (await startGymRun(gymId, locale)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-pokeball-red px-6 py-3 text-label-md text-white hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">swords</span>
        {label}
      </button>
      {state && !state.success && (
        <p className="text-label-sm text-error">
          {errors[state.error]}
          {state.error === "on_cooldown" && state.hoursLeft ? ` (${state.hoursLeft}h)` : ""}
        </p>
      )}
    </form>
  );
}
