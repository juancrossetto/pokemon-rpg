"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { startGymRun, type StartGymRunResult } from "@/actions/start-gym-run";
import { GymGateToast } from "@/components/gym-gate-toast";

const ENERGY_ICON = "/items/hd/energy.png";

type GymStartError =
  | "no_lead"
  | "fainted_lead"
  | "locked"
  | "region_locked"
  | "on_cooldown"
  | "closed"
  | "stages_incomplete"
  | "team_not_ready";

export function StartGymRunButton({
  gymId,
  locale,
  label,
  energyCost,
  errors,
  warning,
  children,
}: {
  gymId: string;
  locale: string;
  label: string;
  /** Costo del primer combate de la corrida (subordinado, o líder si el
   *  gimnasio no tiene pasillo) — no del desafío entero. */
  energyCost: number;
  errors: Record<GymStartError, string>;
  /** Aviso persistente de equipo (en la card, no el popup). */
  warning?: ReactNode;
  /** Bloque de recompensa a la izquierda del CTA. */
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<StartGymRunResult | null>(
    async () => (await startGymRun(gymId, locale)) ?? null,
    null,
  );
  const [toastToken, setToastToken] = useState(0);
  const [toastText, setToastText] = useState<string | null>(null);

  useEffect(() => {
    if (!state || state.success) return;

    const text = `${errors[state.error]}${
      state.error === "on_cooldown" && state.hoursLeft
        ? ` (${state.hoursLeft}h)`
        : ""
    }${
      state.error === "closed" && state.opensHour !== undefined
        ? ` (${String(state.opensHour).padStart(2, "0")}:00 – ${String(state.closesHour).padStart(2, "0")}:00)`
        : ""
    }`;

    const raf = window.requestAnimationFrame(() => {
      setToastText(text);
      setToastToken((n) => n + 1);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [state, errors]);

  return (
    <>
      <GymGateToast token={toastToken}>
        {toastText ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-amber-400/50 bg-[#1a1c24] px-4 py-3 text-left shadow-[0_20px_48px_rgba(0,0,0,0.65)] sm:gap-3 sm:px-6 sm:py-4"
          >
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px]! text-amber-300 sm:text-[24px]!">
              warning
            </span>
            <p className="text-[13px] leading-snug text-amber-50 sm:text-[15px]">{toastText}</p>
          </div>
        ) : null}
      </GymGateToast>
      <form
        action={formAction}
        className={
          children
            ? "grid w-full grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6 sm:gap-y-4"
            : "flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:items-end"
        }
      >
        {children}
        {warning ? <div className="sm:col-span-2">{warning}</div> : null}
        <button
          type="submit"
          disabled={pending}
          className={`game-cta game-cta--red mb-0! w-full gap-2 disabled:opacity-50 sm:w-auto sm:shrink-0 sm:gap-2.5${
            children ? " sm:col-start-2 sm:row-start-1 sm:justify-self-end" : ""
          }`}
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
      </form>
    </>
  );
}
