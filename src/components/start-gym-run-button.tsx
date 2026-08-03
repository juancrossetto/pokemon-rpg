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
  errors: Record<
    | "no_lead"
    | "fainted_lead"
    | "locked"
    | "region_locked"
    | "on_cooldown"
    | "closed"
    | "stages_incomplete",
    string
  >;
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
        className="game-cta game-cta--red disabled:opacity-50"
      >
        <span className="material-symbols-outlined game-cta__icon">swords</span>
        <span className="game-cta__label">{label}</span>
      </button>
      {state && !state.success && (
        <p className="text-label-sm text-error">
          {errors[state.error]}
          {state.error === "on_cooldown" && state.hoursLeft ? ` (${state.hoursLeft}h)` : ""}
          {state.error === "closed" && state.opensHour !== undefined
            ? ` (${String(state.opensHour).padStart(2, "0")}:00 – ${String(state.closesHour).padStart(2, "0")}:00)`
            : ""}
        </p>
      )}
    </form>
  );
}
