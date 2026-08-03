"use client";

import Image from "next/image";

import { ProgressRail } from "@/components/trainer-profile-parts";

/** Caja fija: todos los PNG de la ficha ocupan el mismo marco. */
const FACT_ICON_BOX = "grid h-9 w-9 shrink-0 place-items-center";
const FACT_ICON_IMG =
  "h-[34px] w-[34px] object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]";

export type StatRow = {
  id: string;
  /** Material Symbol de respaldo si falta `iconSrc`. */
  icon: string;
  /** Arte propio (PNG) — set `*-profile.png` de la ficha. */
  iconSrc?: string;
  label: string;
  value: string;
  /** Aclaración corta al lado del valor: "512/251", "Rating 1240". */
  hint?: string;
  /** 0–1. Si viene, se dibuja un hilo de progreso bajo la fila. */
  pct?: number;
};

/**
 * Actividad del entrenador como lista, no como grilla de tiles.
 *
 * Valor + hint en un solo renglón; valores en blanco (sin acento amarillo).
 */
export function TrainerStatRows({ rows }: { rows: StatRow[] }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-white/8 bg-[#0e1118]/90">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className={index > 0 ? "border-t border-white/6" : undefined}
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span aria-hidden className={FACT_ICON_BOX}>
              {row.iconSrc ? (
                <Image
                  src={row.iconSrc}
                  alt=""
                  width={68}
                  height={68}
                  className={FACT_ICON_IMG}
                />
              ) : (
                <span className="material-symbols-outlined text-[22px]! text-white/70">
                  {row.icon}
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">
              {row.label}
            </span>

            <span className="flex shrink-0 items-baseline justify-end gap-1.5 text-right">
              <span className="font-mono text-[14px] font-bold tabular-nums leading-none text-white">
                {row.value}
              </span>
              {row.hint ? (
                <span className="font-mono text-[10px] tabular-nums leading-none text-white/40">
                  {row.hint}
                </span>
              ) : null}
            </span>
          </div>

          {row.pct != null ? (
            <div className="px-3.5 pb-2.5">
              <ProgressRail
                pct={row.pct}
                color="var(--color-pokeball-red)"
                toColor="var(--theme-primary-bright)"
                height={3}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
