"use client";

import Image from "next/image";
import { useActionState, useEffect } from "react";
import { startGymRun, type StartGymRunResult } from "@/actions/start-gym-run";
import {
  announceEnergyDelta,
  clearPendingEnergyDelta,
} from "@/lib/resource-fx";

const ENERGY_ICON = "/items/hd/energy.png";

export function StartGymRunButton({
  gymId,
  locale,
  label,
  energyCost,
  errors,
}: {
  gymId: string;
  locale: string;
  label: string;
  /** Costo del primer combate de la corrida (subordinado, o líder si el
   *  gimnasio no tiene pasillo) — no del desafío entero. */
  energyCost: number;
  errors: Record<
    | "no_lead"
    | "fainted_lead"
    | "locked"
    | "region_locked"
    | "on_cooldown"
    | "closed"
    | "stages_incomplete"
    | "team_not_ready",
    string
  >;
}) {
  const [state, formAction, pending] = useActionState<StartGymRunResult | null>(
    async () => (await startGymRun(gymId, locale)) ?? null,
    null,
  );

  useEffect(() => {
    if (state && !state.success) clearPendingEnergyDelta();
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        announceEnergyDelta(-energyCost);
      }}
      className="flex w-full flex-col items-center gap-2 sm:w-auto"
    >
      <button
        type="submit"
        disabled={pending}
        className="game-cta game-cta--red mb-0! w-full gap-2 disabled:opacity-50 sm:w-auto sm:gap-2.5"
      >
        <span className="game-cta__label">{label}</span>
        <span aria-hidden className="h-4 w-px shrink-0 bg-white/25" />
        <span className="inline-flex items-center gap-1 font-sans text-[13px] font-semibold tabular-nums tracking-normal text-white normal-case">
          <Image
            src={ENERGY_ICON}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            unoptimized
          />
          <span>−{energyCost}</span>
        </span>
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
