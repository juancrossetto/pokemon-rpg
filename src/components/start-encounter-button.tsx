"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useActionState, useEffect, useRef } from "react";
import { startEncounter, type StartEncounterResult } from "@/actions/start-encounter";
import { WILD_ENCOUNTER_ENERGY_COST } from "@/lib/energy";
import {
  announceEnergyDelta,
  clearPendingEnergyDelta,
} from "@/lib/resource-fx";

const ENERGY_ICON = "/items/hd/energy.png";
const COMPASS_ICON = "/nav/compass-icon.png?v=2";

export function StartEncounterButton({
  locale,
  label,
  errors,
  disabled = false,
  energyCost = WILD_ENCOUNTER_ENERGY_COST,
  autoStart = false,
}: {
  locale: string;
  label: string;
  errors: Record<"no_lead" | "fainted_lead" | "no_energy" | "no_stage" | "locked", string>;
  disabled?: boolean;
  /** Coste real de la zona (puede diferir del default). */
  energyCost?: number;
  /** @deprecated El CTA ya no usa GameCtaButton; se mantiene por callers viejos. */
  className?: string;
  /** Mobile: dispara Explorar al montar (home → `/battle?play=1`). */
  autoStart?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const didAutoStart = useRef(false);
  const [state, formAction, pending] = useActionState<StartEncounterResult | null>(
    async () => (await startEncounter(locale)) ?? null,
    null,
  );

  const busy = pending || disabled;

  useEffect(() => {
    if (state && !state.success) clearPendingEnergyDelta();
  }, [state]);

  useEffect(() => {
    if (!autoStart || busy || didAutoStart.current) return;
    didAutoStart.current = true;
    const id = requestAnimationFrame(() => {
      formRef.current?.requestSubmit();
    });
    return () => cancelAnimationFrame(id);
  }, [autoStart, busy]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        announceEnergyDelta(-energyCost);
      }}
      className="flex w-full flex-col items-stretch gap-2"
    >
      <button
        type="submit"
        disabled={busy}
        className={`game-cta game-cta--red mb-0! w-full gap-2 whitespace-nowrap sm:gap-2.5 ${busy ? "game-cta--disabled" : "cta-pulse"}`}
      >
        <Image
          src={COMPASS_ICON}
          alt=""
          width={28}
          height={28}
          className="game-cta__icon shrink-0 object-contain"
          aria-hidden
        />
        <span className="game-cta__label">{pending ? "…" : label}</span>
        <span aria-hidden className="h-4 w-px shrink-0 bg-white/25" />
        <span className="inline-flex shrink-0 items-center gap-1 font-sans text-[13px] font-semibold tabular-nums tracking-normal text-white normal-case">
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
        <p className="text-center text-label-sm text-error">{errors[state.error]}</p>
      )}
    </form>
  );
}
