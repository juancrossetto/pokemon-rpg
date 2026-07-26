"use client";

import { useState } from "react";

/**
 * Colapsa una sección sólo en mobile; desde `lg` queda siempre visible y el
 * botón desaparece.
 *
 * Se usa en el Home para "Misión activa": era un bloque largo de texto que en
 * el teléfono se comía la pantalla antes de que el jugador llegara a ver su
 * equipo. En desktop hay espacio de sobra, así que ahí no se toca.
 *
 * No se usó `<details>` porque forzarlo abierto en desktop depende de anular
 * el comportamiento del user-agent con CSS, que varía entre navegadores.
 */
export function CollapsibleOnMobile({
  title,
  icon,
  summary,
  children,
}: {
  title: string;
  icon?: string;
  /** Línea corta visible cuando está cerrado, para que el bloque diga algo. */
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/20 lg:hidden"
      >
        {icon && (
          <span className="material-symbols-outlined text-[18px]! shrink-0 text-pokeball-red">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-label-sm uppercase tracking-wider text-on-surface-variant">
            {title}
          </span>
          {summary && !open && (
            <span className="mt-0.5 block truncate text-[12px] text-on-surface">{summary}</span>
          )}
        </span>
        <span
          className={`material-symbols-outlined text-[20px]! shrink-0 text-on-surface-variant transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      <div className={`${open ? "mt-2 block" : "hidden"} h-full lg:mt-0 lg:block`}>{children}</div>
    </div>
  );
}
