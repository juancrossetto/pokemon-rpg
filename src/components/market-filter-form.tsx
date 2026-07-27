"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import type { MarketCategory } from "@/lib/market-hub";

type Sort = "recent" | "price_asc" | "price_desc" | "level_desc";

export type MarketFilterLabels = {
  searchPlaceholder: string;
  searchLabel: string;
  apply: string;
  clear: string;
  sortLabel: string;
  minPrice: string;
  maxPrice: string;
  price: string;
  reset: string;
  /** Mobile: botón que abre el panel, título del panel y cierre. */
  openFilters: string;
  filtersTitle: string;
  close: string;
  sort: Record<Sort, string>;
};

type FilterProps = {
  q: string;
  cat: MarketCategory;
  sort: Sort;
  min: number | null;
  max: number | null;
  minPrice: number;
  maxPrice: number;
  hasFilters: boolean;
  labels: MarketFilterLabels;
  sorts: readonly Sort[];
};

const FIELD =
  "h-11 w-full min-w-0 rounded-md border border-white/12 bg-black/40 px-2.5 text-label-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/45 focus:border-pokeball-red/55 focus:ring-1 focus:ring-pokeball-red/30 sm:h-9";

const FIELD_LABEL =
  "mb-1 block text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70";

/** `level_desc` solo tiene sentido cuando hay Pokémon en los resultados. */
function visibleSorts(sorts: readonly Sort[], cat: MarketCategory): readonly Sort[] {
  return cat !== "pokemon" && cat !== "all" ? sorts.filter((s) => s !== "level_desc") : sorts;
}

/** Cuántos filtros hay puestos — alimenta el contador del botón en mobile. */
function activeCount({ q, min, max, sort }: Pick<FilterProps, "q" | "min" | "max" | "sort">): number {
  return [q !== "", min !== null, max !== null, sort !== "recent"].filter(Boolean).length;
}

/**
 * Campos del filtro. Se usan tal cual en la barra inline (tablet/desktop) y
 * dentro del bottom sheet (mobile) para que exista una sola definición de los
 * inputs y del contrato `method="get"` que ya usa la página.
 */
function FilterFields({
  q,
  sort,
  cat,
  min,
  max,
  minPrice,
  maxPrice,
  labels,
  sorts,
  idPrefix,
  onSortChange,
}: FilterProps & { idPrefix: string; onSortChange?: () => void }) {
  return (
    <>
      <label className="relative block min-w-0 flex-1 sm:min-w-[200px]" htmlFor={`${idPrefix}-q`}>
        <span className={FIELD_LABEL}>{labels.searchLabel}</span>
        <span className="material-symbols-outlined pointer-events-none absolute bottom-3 left-2.5 text-[18px]! text-on-surface-variant/65 sm:bottom-2">
          search
        </span>
        <input
          id={`${idPrefix}-q`}
          type="text"
          name="q"
          defaultValue={q}
          maxLength={50}
          placeholder={labels.searchPlaceholder}
          className={`${FIELD} pl-9`}
        />
      </label>

      {/* Los dos precios comparten fila en mobile: son un rango, se leen juntos
          y así no ocupan dos bloques enteros del panel. */}
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <label className="min-w-0 sm:w-28" htmlFor={`${idPrefix}-min`}>
          <span className={FIELD_LABEL}>{labels.minPrice}</span>
          <input
            id={`${idPrefix}-min`}
            type="number"
            inputMode="numeric"
            name="min"
            min={minPrice}
            max={maxPrice}
            defaultValue={min ?? ""}
            placeholder="—"
            className={FIELD}
          />
        </label>

        <label className="min-w-0 sm:w-28" htmlFor={`${idPrefix}-max`}>
          <span className={FIELD_LABEL}>{labels.maxPrice}</span>
          <input
            id={`${idPrefix}-max`}
            type="number"
            inputMode="numeric"
            name="max"
            min={minPrice}
            max={maxPrice}
            defaultValue={max ?? ""}
            placeholder="—"
            className={FIELD}
          />
        </label>
      </div>

      <label className="block w-full min-w-0 sm:w-44" htmlFor={`${idPrefix}-sort`}>
        <span className={FIELD_LABEL}>{labels.sortLabel}</span>
        <select
          id={`${idPrefix}-sort`}
          name="sort"
          defaultValue={cat !== "all" && cat !== "pokemon" && sort === "level_desc" ? "recent" : sort}
          className={FIELD}
          onChange={onSortChange}
        >
          {visibleSorts(sorts, cat).map((value) => (
            <option key={value} value={value}>
              {labels.sort[value]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/**
 * Filtros del mercado.
 *
 * - Tablet y desktop: la barra inline de siempre.
 * - Mobile: un botón compacto con contador que abre un bottom sheet. La barra
 *   completa expandida ocupaba media pantalla antes del primer producto, y sus
 *   campos de ancho fijo (`sm:w-28`, `sm:w-44`) desbordaban el viewport.
 *
 * Los dos caminos envían el mismo formulario GET, así que el filtrado, el
 * orden y la conservación de la categoría no cambian.
 */
export function MarketFilterForm(props: FilterProps) {
  const { cat, hasFilters, labels } = props;
  const inlineFormRef = useRef<HTMLFormElement>(null);
  const count = activeCount(props);

  return (
    <>
      {/* ── Inline: tablet + desktop ─────────────────────────────────── */}
      <form
        ref={inlineFormRef}
        method="get"
        className="hidden flex-col gap-2 rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md sm:flex sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input type="hidden" name="tab" value="browse" />
        {cat !== "all" && <input type="hidden" name="cat" value={cat} />}
        <FilterFields
          {...props}
          idPrefix="mkt-inline"
          onSortChange={() => inlineFormRef.current?.requestSubmit()}
        />
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <button
            type="submit"
            className="market-buy-btn h-9 flex-1 rounded-md bg-pokeball-red px-4 text-label-sm font-semibold uppercase tracking-wide text-white transition sm:flex-none"
          >
            {labels.apply}
          </button>
          {hasFilters && (
            <Link
              href="/market?tab=browse"
              className="inline-flex h-9 items-center rounded-md border border-white/12 px-3 text-label-sm text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
            >
              {labels.reset}
            </Link>
          )}
        </div>
      </form>

      {/* ── Bottom sheet: mobile ─────────────────────────────────────── */}
      <MarketFilterSheet {...props} count={count} />
    </>
  );
}

function MarketFilterSheet(props: FilterProps & { count: number }) {
  const { cat, hasFilters, labels, count } = props;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    // El botón que abrió el sheet, guardado para devolverle el foco al cerrar.
    const opener = openerRef.current;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      // Trampa de foco: dentro del sheet el tab no debe volver a la página.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    // El primer campo real toma el foco al abrir; al cerrar vuelve al botón.
    // El `:not([type="hidden"])` importa: el form arranca con los inputs
    // ocultos `tab` y `cat`, y enfocar uno de esos no hace nada.
    panelRef.current
      ?.querySelector<HTMLElement>('input:not([type="hidden"]), select')
      ?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      opener?.focus();
    };
  }, [open]);

  const sheet = (
    <div className="fixed inset-0 z-[70] sm:hidden" role="presentation">
      <button
        type="button"
        aria-label={labels.close}
        onClick={() => setOpen(false)}
        className="market-sheet-backdrop-in absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="market-sheet-in absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-white/12 bg-[#0b0d13]/98 backdrop-blur-xl"
      >
        <form method="get" className="flex min-h-0 flex-col">
          <input type="hidden" name="tab" value="browse" />
          {cat !== "all" && <input type="hidden" name="cat" value={cat} />}

          {/* Encabezado fijo */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-3">
            <span aria-hidden className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20" />
            <h2 id={titleId} className="text-label-md font-semibold text-on-surface">
              {labels.filtersTitle}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={labels.close}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]!">close</span>
            </button>
          </div>

          {/* Área desplazable */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            <FilterFields {...props} idPrefix="mkt-sheet" />
          </div>

          {/* Acciones fijas, por encima del home indicator */}
          <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Link
                  href="/market?tab=browse"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center rounded-md border border-white/12 px-4 text-label-sm text-on-surface-variant"
                >
                  {labels.clear}
                </Link>
              )}
              <button
                type="submit"
                className="h-11 flex-1 rounded-md bg-pokeball-red px-4 text-label-sm font-bold uppercase tracking-wide text-white"
              >
                {labels.apply}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="sm:hidden">
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/12 bg-black/35 px-4 text-label-sm text-on-surface transition active:bg-white/[0.06]"
      >
        <span className="material-symbols-outlined text-[18px]!">tune</span>
        {labels.openFilters}
        {count > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pokeball-red px-1.5 text-[11px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {/* Portal a body: el contenedor de la página crea contexto de apilado y
          el sheet quedaría por debajo de la bottom nav. Solo se monta tras un
          click, así que `document` siempre existe acá. */}
      {open && createPortal(sheet, document.body)}
    </div>
  );
}
