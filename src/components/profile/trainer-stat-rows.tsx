"use client";

import Image from "next/image";

import { ProgressRail } from "@/components/trainer-profile-parts";

export type StatRow = {
  id: string;
  /** Material Symbol. Se ignora si viene `iconSrc`. */
  icon: string;
  /** Arte propio (PNG) — para Pokédex, torre, aventura. */
  iconSrc?: string;
  label: string;
  value: string;
  /** Aclaración corta bajo el valor: "512/1010", "Rating 1240". */
  hint?: string;
  /** 0–1. Si viene, se dibuja un hilo de progreso bajo la fila. */
  pct?: number;
  accent: string;
};

/**
 * Actividad del entrenador como lista, no como grilla de tiles.
 *
 * En una pantalla ancha, cuatro tiles de 2×2 dejaban el dato a un extremo y el
 * título al otro, con medio metro de vacío en el medio: mucha información
 * repartida y poca legible de un vistazo. Una lista de filas —ícono, etiqueta a
 * la izquierda, valor a la derecha— empareja todos los valores en una misma
 * columna, que es lo que la hace escaneable (y es el patrón de la pantalla de
 * perfil de GO que se tomó como referencia).
 */
export function TrainerStatRows({ rows }: { rows: StatRow[] }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-white/8 bg-[#0e1118]/90">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className={index > 0 ? "border-t border-white/[0.06]" : undefined}
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            {/*
              Arte y símbolo comparten la misma caja: mezclar PNG sueltos con
              chips con borde dejaba las filas desalineadas y con dos pesos
              visuales distintos en la misma lista.
            */}
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border"
              style={{
                borderColor: `${row.accent}40`,
                background: `${row.accent}14`,
                color: row.accent,
              }}
            >
              {row.iconSrc ? (
                <Image
                  src={row.iconSrc}
                  alt=""
                  width={24}
                  height={24}
                  className="h-[22px] w-[22px] object-contain"
                />
              ) : (
                <span className="material-symbols-outlined text-[17px]!">{row.icon}</span>
              )}
            </span>

            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">
              {row.label}
            </span>

            <span className="shrink-0 text-right">
              <span
                className="block font-mono text-[14px] font-bold tabular-nums leading-none"
                style={{ color: row.accent }}
              >
                {row.value}
              </span>
              {row.hint ? (
                <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-white/40">
                  {row.hint}
                </span>
              ) : null}
            </span>
          </div>

          {row.pct != null ? (
            <div className="px-3.5 pb-2.5">
              <ProgressRail pct={row.pct} color={row.accent} height={3} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
