"use client";

import { useRef } from "react";
import { Link } from "@/i18n/navigation";

type Kind = "all" | "pokemon" | "item";
type Sort = "recent" | "price_asc" | "price_desc" | "level_desc";

const INPUT_CLASS =
  "bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50";
const PRIMARY_BUTTON_CLASS =
  "text-label-md px-4 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors";

/**
 * Filtros del mercado. Kind/sort se aplican al cambiar (sin click extra);
 * búsqueda y rango de precio siguen con el botón Filtrar.
 */
export function MarketFilterForm({
  q,
  kind,
  sort,
  min,
  max,
  minPrice,
  maxPrice,
  hasFilters,
  labels,
  kinds,
  sorts,
}: {
  q: string;
  kind: Kind;
  sort: Sort;
  min: number | null;
  max: number | null;
  minPrice: number;
  maxPrice: number;
  hasFilters: boolean;
  labels: {
    searchPlaceholder: string;
    apply: string;
    clear: string;
    sortLabel: string;
    minPrice: string;
    maxPrice: string;
    kind: Record<Kind, string>;
    sort: Record<Sort, string>;
  };
  kinds: readonly Kind[];
  sorts: readonly Sort[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const visibleSorts = kind === "item" ? sorts.filter((s) => s !== "level_desc") : sorts;

  return (
    <form
      ref={formRef}
      method="get"
      className="bg-glass-surface border border-white/10 rounded-xl p-3 grid gap-2"
    >
      <input type="hidden" name="tab" value="browse" />
      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <div className="relative min-w-0">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            maxLength={50}
            placeholder={labels.searchPlaceholder}
            className={`${INPUT_CLASS} w-full pl-8`}
          />
        </div>
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} shrink-0`}>
          {labels.apply}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          name="kind"
          defaultValue={kind}
          className={`${INPUT_CLASS} w-full min-w-0`}
          onChange={() => formRef.current?.requestSubmit()}
        >
          {kinds.map((value) => (
            <option key={value} value={value}>
              {labels.kind[value]}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={kind === "item" && sort === "level_desc" ? "recent" : sort}
          className={`${INPUT_CLASS} w-full min-w-0`}
          aria-label={labels.sortLabel}
          onChange={() => formRef.current?.requestSubmit()}
        >
          {visibleSorts.map((value) => (
            <option key={value} value={value}>
              {labels.sort[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          name="min"
          min={minPrice}
          max={maxPrice}
          defaultValue={min ?? ""}
          placeholder={labels.minPrice}
          className={`${INPUT_CLASS} w-full min-w-0`}
        />
        <input
          type="number"
          name="max"
          min={minPrice}
          max={maxPrice}
          defaultValue={max ?? ""}
          placeholder={labels.maxPrice}
          className={`${INPUT_CLASS} w-full min-w-0`}
        />
      </div>
      {hasFilters && (
        <Link
          href="/market?tab=browse"
          className="justify-self-start text-label-md px-3 py-1.5 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          {labels.clear}
        </Link>
      )}
    </form>
  );
}
